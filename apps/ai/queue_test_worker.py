"""Integration fixture: real Python worker/Redis/Postgres; controlled inference."""
import asyncio
import json
import os
import signal
import time
from pathlib import Path

from fastapi import HTTPException
from worker import run_worker

control = Path(os.environ["QUEUE_TEST_CONTROL"])
calls = {}


def compute(paths):
    settings = json.loads(control.read_text())
    if settings["mode"] == "real":
        from main import embed_images
    key = Path(paths[0]).name
    calls[key] = calls.get(key, 0) + 1
    with control.with_suffix(".events").open("a") as events:
        events.write(json.dumps({"file": key, "attempt": calls[key], "mode": settings["mode"]}) + "\n")
    # Lets the test terminate Nest after Python has entered processing.
    if settings["mode"] != "real":
        time.sleep(settings.get("delay", 0.1))
    mode = settings["mode"]
    if mode == "real":
        return embed_images(paths)
    if mode == "invalid":
        raise HTTPException(status_code=400, detail="Invalid photo")
    if mode == "unavailable" or (mode == "transient" and calls[key] == 1):
        raise RuntimeError("Temporary model failure")
    vector = [0.0] * 1024
    vector[0] = 1.0
    vector[1] = sum(map(ord, key)) / 10000
    return {"embedding": vector, "model": "queue-test-model", "fallbackUsed": mode == "fallback"}


async def main():
    stop = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        asyncio.get_running_loop().add_signal_handler(sig, stop.set)
    await run_worker(compute, stop)


if __name__ == "__main__":
    asyncio.run(main())
