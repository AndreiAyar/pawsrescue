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
- Strengthened the AI embedding path with a pawsmatch-inspired `timm` ensemble:
  - `vit_base_patch16_224_dino` remains the primary backbone
  - `vit_base_patch8_224_dino` is now tried alongside it and the successful embeddings are averaged
  - the service still falls back to the deterministic local embedder if the model load path is unavailable
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
- Added a simple local runtime helper:
  - `npm run check:ai`
  - optional usage: `node scripts/check-ai-runtime.mjs /absolute/path/to/image.jpg`
  - this checks `/health` and can also verify `/embed` against a real shared file path
- Connected `apps/ai` to the Turborepo workspace flow with a local `package.json`:
  - `npm run --workspace ai check` works
  - `npm run --workspace ai dev` now resolves as a real workspace task
  - local runtime still depends on Python packages such as `uvicorn` being installed in the active Python environment
- Added local AI bootstrap scripts under `apps/ai/scripts`:
  - `npm run --workspace ai setup` creates `.venv` and installs Python requirements
  - `npm run --workspace ai dev` and `start` now run through the local `.venv`
- Verified AI local bootstrap end-to-end:
  - initial blocker was missing Python packages
  - after setup, `ai` is no longer the failing task in `npm run dev`
- Replaced the fragile `@repo/ui` Tailwind watch command with a small polling-based watcher script so `dev:styles` no longer depends on FSEvents.
- Verified Python syntax for `apps/ai/main.py`.
- Verified `npm run --workspace api build` still passes after the embedding integration changes.
- Verified the helper script syntax and confirmed it currently fails with `fetch failed` when the AI service is not running in this local session.
- Verified `npm run dev` now gets past both `ai#dev` and `@repo/ui#dev:styles`; in this local session the next blocker is sandbox port binding for `web` and `docs` (`listen EPERM` on ports `3000` and `3001`).
- Verified the AI service in-process with a real uploaded image path through FastAPI's test client:
  - `/health` returns the expected model metadata
  - `/embed` returns a 768-dim vector and degrades cleanly to the deterministic fallback in this offline sandbox

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
- `apps/ai/package.json`
- `apps/ai/requirements.txt`
- `apps/ai/scripts/setup-venv.sh`
- `apps/ai/scripts/run-python.sh`
- `apps/ai/scripts/run-uvicorn.sh`
- `apps/api/src/migrations/Migration20260611101500.ts`
- `apps/api/src/migrations/Migration20260611113000.ts`
- `docker-compose.yml`
- `packages/ui/scripts/dev-styles.mjs`
- `scripts/check-ai-runtime.mjs`

Notes
- The user wants the MVP to stay very simple, easy to follow, and minimally invasive.
- Demo mode must remain available via `USE_MOCK_DATA=true|false`.
- Images should be uploaded by the user, saved locally for MVP, and passed to AI by shared file path.
