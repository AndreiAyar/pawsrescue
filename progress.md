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
- Switched the default runtime direction to real mode:
  - `USE_MOCK_DATA=false` is now the default in env examples and Docker Compose
  - mock mode remains available only when explicitly enabled with `USE_MOCK_DATA=true`
- Fixed the mock toggle behavior in API service logic:
  - unset `USE_MOCK_DATA` no longer silently falls back to mock mode
- Updated actual local runtime env files for local development:
  - `apps/api/.env.development.local` now includes `PORT`, `AI_SERVICE_URL`, `USE_MOCK_DATA=false`, and `UPLOAD_DIR`
  - `apps/web/.env.development` now includes `API_URL=http://localhost:3015`
- Applied pending MikroORM migrations directly against the configured Supabase database:
  - `Migration20260610221500`
  - `Migration20260611101500`
  - `Migration20260611113000`
- Fixed local upload-path resolution between API and AI:
  - API now resolves relative `UPLOAD_DIR` values to absolute local paths
  - AI now resolves relative incoming image paths more safely for local runs
- Improved matcher error visibility in API:
  - AI request failures now surface explicit messages
  - vector query failures now surface explicit SQL-related messages instead of a generic 500
- Installed the missing `transformers` runtime into `apps/ai/.venv`
  - `apps/ai/requirements.txt` now includes `transformers==4.56.0`
  - verified import with `transformers.__version__ == 4.56.0`

In Progress
- Consolidating read-side behavior so mock mode and real mode are consistent across list, detail, match, and clusters.
- Final local runtime verification still needs a clean restart of `ai` and `api` on the user's machine and one real `scan -> match` retry after the latest fixes.

Latest update
- Tightened read-side API consistency in `apps/api/src/lost-pets/lost-pets.service.ts`:
  - mock list/detail now go through the same normalizer as real records
  - mock match responses now return the same top-level shape as real match responses, including `queryEmbedding: null`
  - verified `npm run --workspace api build` still passes after the contract cleanup
- Added focused service verification for mock and real mode contracts:
  - `apps/api/src/lost-pets/lost-pets.service.spec.ts`
  - covers mock list/detail shape
  - covers mock match response shape
  - covers real list/detail normalization with embedding metadata
  - covers real match normalization with query embedding metadata
  - verified with `npm run --workspace api test -- lost-pets.service.spec.ts --runInBand`
- Completed the local real-mode unblockers:
  - migrated the Supabase schema so `lost_pets.embedding` and related columns now exist
  - fixed local `AI_SERVICE_URL` / `USE_MOCK_DATA` runtime env settings
  - fixed relative upload paths so AI can find locally uploaded matcher images
  - installed `transformers` so the primary AI path no longer warns that the dependency is missing

Latest update
- Kept the new embedding work surgical in `apps/ai/main.py`:
  - `auto` now combines the `transformers` DINOv3 path with the pawsmatch-inspired `timm` path when both succeed
  - added `AI_OFFLINE_MODEL_LOAD=true|false` so offline/local verification can fail fast instead of hanging on model-download retries
  - when offline mode is enabled, the service now skips the `timm` branch cleanly and reports the actual model path used
- Fixed real API response consistency in `apps/api/src/lost-pets/lost-pets.service.ts`:
  - legacy nullable rows are normalized to safe defaults (`type: "other"`, `email: ""`, `updatedAt: createdAt`)
  - `POST /lost-pets` now returns `embeddingInfo` immediately after a successful embed instead of only showing it on later reads
- Expanded focused verification:
  - `npm run --workspace ai check`
  - `npm run --workspace api build`
  - `npm run --workspace api test -- lost-pets.service.spec.ts --runInBand`
  - verified temporary real-mode stack on `127.0.0.1:8010` and `127.0.0.1:3016`
  - verified `GET /health` for both services
  - verified `GET /lost-pets` now normalizes legacy database rows
  - verified real `POST /lost-pets/match` returns a real embedding path and a successful match
- verified real `POST /lost-pets` returns `embeddingInfo` in the create response
- verified later `GET /lost-pets/:id` returns the same embedding metadata

Latest update
- Re-verified the currently running local stack on the user's machine instead of starting duplicate services:
  - confirmed listeners already existed for `ai` on `127.0.0.1:8000`
  - confirmed listeners already existed for `api` on `3015`
  - confirmed the web app was already serving on `3000`
- Re-verified live local endpoints:
  - `GET /health` for `ai`
  - `GET /health` for `api`
  - `GET /lost-pets` returns real records with embedding metadata
  - `POST /lost-pets/match` returns real matches against an existing uploaded image file
- Re-verified the main web routes respond locally:
  - `/ro/report`
  - `/ro/search`
  - `/ro/scan`
- Tightened scan UI copy for the MVP:
  - match results now label pgvector output as `distance` instead of a generic `score`
  - added a short hint that lower distance means a closer visual match
- Found one remaining operational mismatch:
  - the currently running local AI process appears older than the latest checked-in `apps/ai/main.py` health contract and likely needs a manual restart on the user's machine before we call the embedding slice fully current

Latest update
- Restarted the live local AI process and re-verified the real API -> AI path:
  - `GET /health` on `:8000` now matches the latest checked-in `apps/ai/main.py` contract
  - `POST /lost-pets/match` now reports the full ensemble model path in live responses:
    - `ensemble:transformers:facebook/dinov3-vitl16-pretrain-lvd1689m+timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino`
  - `fallbackUsed` is `false` on the live verified path
- Completed a real browser-driven scan verification through the in-app Browser:
  - selected a real uploaded image on `/ro/scan`
  - submitted the scan form successfully
  - confirmed the page renders live match results and query embedding metadata
  - confirmed the new distance wording is visible in the UI
- Improved scan-result UX for demo clarity:
  - match cards now show a friendly `NN% potrivire` / `NN% match` badge derived from vector distance
  - raw vector distance is still shown beneath the badge for debugging/transparency
- Fixed image rendering in the web UI by routing local upload paths through the existing Next dev proxy:
  - scan result thumbnails now use `/api/uploads/...`
  - pet detail hero images now use `/api/uploads/...`
  - verified the proxied image URLs return `200 OK`
  - verified the pet detail page has a live `<img>` after reload in the browser

Latest update
- Re-verified the current branch and live local services on `dev`:
  - working tree is clean
  - `ai` health on `127.0.0.1:8000` returns the latest embedding contract
  - `GET /lost-pets` on `:3015` returns real rows with embedding metadata
  - `POST /lost-pets/match` with a real uploaded local file returns the full live ensemble path:
    - `ensemble:transformers:facebook/dinov3-vitl16-pretrain-lvd1689m+timm:vit_base_patch16_224_dino+vit_base_patch8_224_dino`
  - `fallbackUsed` is `false` on the live verified match response
  - `npm run --workspace api build` passes
  - `npm run --workspace api test -- lost-pets.service.spec.ts --runInBand` passes
- Confirmed the main MVP slice is effectively done:
  - pawsmatch-derived embedding logic is integrated in `apps/ai`
  - real `scan -> match` runtime is healthy
  - report/search/scan routes render locally
- Confirmed the branch is not fully "gold" at whole-repo level yet:
  - `npm run check-types` still fails in `apps/docs/app/page.tsx`
  - error: `Button` is being passed an `appName` prop that does not exist on `ButtonProps`

Next Up
- Do one final happy-path browser pass for `report -> search -> detail -> scan -> match` for demo confidence.
- If we want one more post-MVP improvement, tune match quality/ranking:
  - current live scan test returned multiple cat listings with the same displayed distance bucket, so ranking relevance can still be improved even though the wiring works
- Decide whether the local default AI runtime should keep remote model downloads enabled or whether `AI_OFFLINE_MODEL_LOAD` should be enabled in any local env defaults.
- Clean up existing unrelated TypeScript issues so builds/checks are easier to trust.

Known Issues
- Existing unrelated API TypeScript error:
  - `apps/api/test/app.e2e-spec.ts`
- Existing unrelated web TypeScript errors:
  - `apps/web/app/components/Map/clusterCache.ts`
- Existing unrelated docs TypeScript error:
  - `apps/docs/app/page.tsx`
- Existing unrelated API Jest failure:
  - `apps/api/src/app.controller.spec.ts` still expects `"Hello World!"` while the app returns `"PawsRescue API"`
- Full browser-style verification of the Next.js UI still depends on a reachable `web` process; this turn verified the real API/AI flow directly over HTTP instead.

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
- The active real local database is Supabase, and MikroORM migrations were applied directly against it from `apps/api`.
