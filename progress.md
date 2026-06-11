# Progress Log

## 2026-06-10
Incremental MVP work started on `dev`.

Done
- Created local MVP skeleton with `docker-compose.yml`, `.dockerignore`, root `.env.example`, and service-level env examples.
- Added `apps/ai` FastAPI service stub with `/health` and `/embed`.
- Added Dockerfiles for `web`, `api`, and `ai`.
- Implemented real lost-pet create flow in API with basic validation.
- Implemented photo upload in `report` using multipart form data.
- Added local upload storage in API and static serving via `/uploads/...`.
- Added shared upload volume design for `api` and `ai`.
- Added AI call from API create flow using shared file paths.
- Added pgvector migration for `embedding` column and auto-run migrations on API boot.
- Implemented `POST /lost-pets/match` in API.
- Implemented `scan` page UI with upload and match results.
- Implemented `pet details` page backed by API.
- Connected `search` page list section to `GET /lost-pets`.
- Added mock-mode support for clusters and matches.
- Added mock list/detail support so demo mode can navigate `search -> detail` and `scan -> detail`.
- Upgraded AI embedding from pure stub metadata to a simple RGB-based image embedding using Pillow + NumPy.
- Replaced the simple RGB embedder with a richer AI embedding flow in `apps/ai`:
  - primary path adapted from `[/Users/ayar/Personal Dev/pawsmatch/compare.py](/Users/ayar/Personal%20Dev/pawsmatch/compare.py)` using a `timm` DINO image model
  - deterministic local fallback embedder kept in place so the service still works when the model is unavailable
- Expanded pgvector storage from `vector(3)` to `vector(768)` with a follow-up migration that clears old incompatible MVP embeddings before resizing the column.
- Added persistent embedding tracking fields on lost pets:
  - `embedding_model`
  - `embedding_fallback_used`
  - `embedding_warning`
- Propagated embedding tracking through API responses:
  - listing detail now exposes `embeddingInfo`
  - match results now expose `queryEmbedding`
- Added a small UI status panel for embedding metadata in:
  - `scan`
  - `pet details`
- Clarified AI service response contracts:
  - `/health` now exposes default model config and `timmAvailable`
  - `/embed` now always returns `model`, `fallbackUsed`, and `warning`
- Verified Python syntax for `apps/ai/main.py`.
- Verified `npm run --workspace api build` still passes after the embedding integration changes.

In Progress
- Consolidating read-side behavior so mock mode and real mode are consistent across list, detail, match, and clusters.
- Full local runtime verification of the upgraded AI path still needs Docker or an equivalent local service run.

Next Up
- Verify the full local stack with Docker and Browser: `report -> create -> search -> detail -> scan -> match`.
- Confirm the `timm` model downloads and serves correctly in the AI container, then compare a couple of real match results against the fallback path.
- Finish the mock/real consistency pass for read endpoints.
- Clean up existing unrelated TypeScript issues so builds/checks are easier to trust.

Known Issues
- Existing unrelated API TypeScript error:
  - `apps/api/test/app.e2e-spec.ts`
- Existing unrelated web TypeScript errors:
  - `apps/web/app/components/Map/clusterCache.ts`
- Existing unrelated API Jest failure:
  - `apps/api/src/app.controller.spec.ts` still expects `"Hello World!"` while the app returns `"PawsRescue API"`
- Docker/Browser verification could not be completed inside this local session because `docker` was not available in PATH here.

Important Files
- `apps/api/src/lost-pets/lost-pets.controller.ts`
- `apps/api/src/lost-pets/lost-pets.service.ts`
- `apps/api/src/lost-pets/lost-pets.entity.ts`
- `apps/api/src/uploads/upload-config.ts`
- `apps/web/app/[lang]/report/ReportForm.tsx`
- `apps/web/app/[lang]/scan/ScanForm.tsx`
- `apps/web/app/[lang]/search/page.tsx`
- `apps/web/app/[lang]/pets/[id]/page.tsx`
- `apps/ai/main.py`
- `apps/ai/requirements.txt`
- `apps/api/src/migrations/Migration20260611101500.ts`
- `apps/api/src/migrations/Migration20260611113000.ts`
- `docker-compose.yml`

Notes
- The user wants the MVP to stay very simple, easy to follow, and minimally invasive.
- Demo mode must remain available via `USE_MOCK_DATA=true|false`.
- Images should be uploaded by the user, saved locally for MVP, and passed to AI by shared file path.
