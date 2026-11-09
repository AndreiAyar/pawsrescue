import asyncio
import os
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from bullmq.custom_errors import UnrecoverableError
from fastapi import HTTPException

from worker import process_job, recover_pending


def result():
    return {"embedding": [0.5] * 1024, "model": "test-model", "fallbackUsed": False}


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.store = SimpleNamespace(
            get=AsyncMock(return_value={"embedding_status": "pending", "image_urls": ["/uploads/cat.jpg"]}),
            set_status=AsyncMock(), save=AsyncMock())
        self.job = SimpleNamespace(data={"petId": 7}, attemptsMade=0, opts={"attempts": 3})
        self.compute = Mock(return_value=result())
        self.env = patch.dict(os.environ, {"UPLOAD_DIR": "/tmp/photos"})
        self.env.start()
        self.addCleanup(self.env.stop)

    async def test_redelivery_of_ready_or_deleted_report_skips_inference(self):
        for report in [{"embedding_status": "ready"}, None]:
            self.store.get.return_value = report
            self.assertEqual(await process_job(self.job, self.store, self.compute), {"petId": 7})
        self.compute.assert_not_called()
        self.store.save.assert_not_called()

    async def test_success_returns_only_after_the_database_save(self):
        saved = []
        self.store.save.side_effect = lambda *_: saved.append(True)
        self.assertEqual(await process_job(self.job, self.store, self.compute), {"petId": 7})
        self.assertEqual(saved, [True])
        self.compute.assert_called_once_with(["/tmp/photos/cat.jpg"])

    async def test_database_failure_is_retried_instead_of_acknowledged(self):
        self.store.save.side_effect = RuntimeError("Database disconnected")
        with self.assertRaisesRegex(RuntimeError, "Database disconnected"):
            await process_job(self.job, self.store, self.compute)
        self.store.set_status.assert_awaited_with(7, "pending")

    async def test_invalid_photo_fails_immediately(self):
        self.compute.side_effect = HTTPException(status_code=400)
        with self.assertRaises(UnrecoverableError):
            await process_job(self.job, self.store, self.compute)
        self.store.set_status.assert_awaited_with(7, "failed")
        self.store.save.assert_not_called()

    async def test_exhausted_attempt_and_bad_vectors_are_not_saved(self):
        self.job.attemptsMade = 2
        for bad in [{**result(), "fallbackUsed": True}, {**result(), "embedding": [float("nan")] * 1024},
                    {**result(), "embedding": [0.0] * 1024}]:
            self.compute.return_value = bad
            with self.assertRaises(RuntimeError):
                await process_job(self.job, self.store, self.compute)
        self.store.set_status.assert_awaited_with(7, "failed")
        self.store.save.assert_not_called()

    async def test_cpu_work_leaves_the_event_loop_free_for_lock_renewal(self):
        release = threading.Event()
        self.compute.side_effect = lambda _: (release.wait(2), result())[1]
        asyncio.get_running_loop().call_later(0.05, release.set)
        await asyncio.wait_for(process_job(self.job, self.store, self.compute), timeout=1)

    async def test_recovery_reuses_stable_ids_and_reconciles_failed_jobs(self):
        queue = SimpleNamespace(add=AsyncMock(return_value=SimpleNamespace(getState=AsyncMock(return_value="failed"))))
        self.store.pending = AsyncMock(return_value=[{"id": 7}])
        await recover_pending(queue, self.store)
        self.assertEqual(queue.add.call_args.args[2]["jobId"], "embed-pet-7")
        self.store.set_status.assert_awaited_once_with(7, "failed")


if __name__ == "__main__":
    unittest.main()
