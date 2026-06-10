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

In Progress
- Consolidating read-side behavior so mock mode and real mode are consistent across list, detail, match, and clusters.
- Preparing to replace or extend the simple RGB embedder with useful logic adapted from `[/Users/ayar/Personal Dev/pawsmatch/](/Users/ayar/Personal%20Dev/pawsmatch/)`.

Next Up
- Pull the useful embedding logic from `pawsmatch` into `apps/ai` without overcomplicating the service.
- Decide whether to keep the RGB embedder as fallback and add a heavier model behind a flag.
- Verify the full local stack with Docker and Browser: `report -> create -> search -> detail -> scan -> match`.
- Clean up existing unrelated TypeScript issues so builds/checks are easier to trust.

Known Issues
- Existing unrelated API TypeScript error:
  - `apps/api/test/app.e2e-spec.ts`
- Existing unrelated web TypeScript errors:
  - `apps/web/app/components/Map/clusterCache.ts`
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
- `docker-compose.yml`

Notes
- The user wants the MVP to stay very simple, easy to follow, and minimally invasive.
- Demo mode must remain available via `USE_MOCK_DATA=true|false`.
- Images should be uploaded by the user, saved locally for MVP, and passed to AI by shared file path.
