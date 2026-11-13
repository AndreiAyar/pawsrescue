# PawsRescue AI

Python inference service and BullMQ worker. Faster R-CNN detects and crops cats;
DINOv2 extracts features. Queued uploads are committed directly to Postgres
before the job is acknowledged. HTTP `/embed` serves interactive photo searches.

Use Python 3.11 and follow [local setup](../../docs/DEVELOPMENT.md).
`npm run --workspace ai setup` creates `.venv` and installs pinned dependencies;
`npm run --workspace ai dev` starts HTTP and the worker on port 8000.
The first inference downloads model weights. Locally the worker reuses the API's
DB/Redis settings unless overridden in `apps/ai/.env.local`.

`npm run --workspace ai test` runs unit tests. `npm run test:queue:local` runs
Nest/Python integration tests with disposable local Postgres and Redis.
See [third-party notices](../../THIRD_PARTY_NOTICES.md) for model terms.
