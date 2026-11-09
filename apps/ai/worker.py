"""One job: load report → compute embedding → commit it → acknowledge the job."""
import asyncio
import logging
import math
import os
from pathlib import Path

from bullmq import Queue, Worker
from bullmq.custom_errors import UnrecoverableError
from fastapi import HTTPException

from worker_db import ReportStore, load_worker_env

logger = logging.getLogger("pawsrescue.worker")
QUEUE_NAME = "pet-embeddings"
JOB_OPTIONS = {
    "attempts": 3, "backoff": {"type": "exponential", "delay": 2000},
    "removeOnComplete": {"age": 86400, "count": 1000}, "removeOnFail": {"count": 1000},
}


async def process_job(job, store, compute):
    pet_id = job.data.get("petId")
    if type(pet_id) is not int or pet_id <= 0:
        raise UnrecoverableError("Job must contain a valid petId")
    report = await store.get(pet_id)
    # Safe redelivery: a committed result is never computed or overwritten again.
    if not report or report["embedding_status"] == "ready":
        return {"petId": pet_id}
    if not report["image_urls"]:
        await store.set_status(pet_id, "none")
        return {"petId": pet_id}

    try:
        await store.set_status(pet_id, "processing")
        paths = [str(Path(os.environ["UPLOAD_DIR"]) / Path(url).name)
                 for url in report["image_urls"]]
        # CPU work must leave asyncio free to renew the BullMQ job lock.
        result = await asyncio.to_thread(compute, paths)
        vector = result.get("embedding", [])
        if (result.get("fallbackUsed") or not result.get("model") or len(vector) != 1024
                or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector)
                or not any(vector)):
            raise RuntimeError("AI returned an invalid embedding")
        await store.save(pet_id, result)  # Commit before BullMQ marks completed.
        logger.info("Report %s ready", pet_id)
        return {"petId": pet_id}
    except Exception as error:
        permanent = isinstance(error, HTTPException) and error.status_code in (400, 422)
        final_attempt = job.attemptsMade + 1 >= job.opts.get("attempts", 1)
        try:
            await store.set_status(pet_id, "failed" if permanent or final_attempt else "pending")
        except Exception:
            logger.exception("Could not update report %s; recovery will reconcile it", pet_id)
        if permanent:
            raise UnrecoverableError("Invalid uploaded photo") from error
        raise


async def recover_pending(queue, store):
    # Also covers a report saved while Redis was unavailable. Stable IDs deduplicate.
    for report in await store.pending():
        pet_id = report["id"]
        job = await queue.add("generate-embedding", {"petId": pet_id},
                              {**JOB_OPTIONS, "jobId": f"embed-pet-{pet_id}"})
        if await job.getState() == "failed":
            await store.set_status(pet_id, "failed")


async def run_worker(compute, stop):
    load_worker_env()
    store = ReportStore()
    options = {"prefix": os.getenv("QUEUE_PREFIX", "pawsrescue"), "connection": {
        "host": os.getenv("REDIS_HOST", "127.0.0.1"),
        "port": int(os.getenv("REDIS_PORT", "6379")),
        "password": os.getenv("REDIS_PASSWORD") or None,
    }}
    queue = Queue(QUEUE_NAME, options)
    worker = None

    async def process(job, _token):
        return await process_job(job, store, compute)

    try:
        while not stop.is_set():
            try:
                await queue.setGlobalConcurrency(1)
                if worker is None:
                    worker = Worker(QUEUE_NAME, process, {**options, "concurrency": 1})
                    worker.on("error", lambda error, *args: logger.error("Worker: %s", error))
                    worker.on("failed", lambda job, error: logger.warning("Job %s: %s", job.id, error))
                    logger.info("Python worker listening on %s", QUEUE_NAME)
                await recover_pending(queue, store)
            except Exception:
                # The API may still be running migrations, or Redis/DB may be down.
                logger.exception("Recovery will retry")
            try:
                await asyncio.wait_for(stop.wait(), timeout=30)
            except asyncio.TimeoutError:
                pass
    finally:
        if worker:
            await worker.close()  # Finish active inference before shutting down.
        await queue.close()
