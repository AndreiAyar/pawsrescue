# PawsRescue Plan

## Summary
Build a simple local MVP on `dev` with four services:
- `web`
- `api`
- `db`
- `ai`

Keep the implementation basic, demo-friendly, and easy to resume in future chats.

## Working Rules
- Work slice by slice, not all-at-once.
- After each meaningful slice:
  - check local behavior
  - verify API/UI path
  - use Browser when available
  - summarize what works and what is still missing
- Keep mock mode available for demos through `USE_MOCK_DATA=true|false`.

## Current Slice Status

### Slice 0: Local skeleton
Status: Done
- Docker Compose skeleton exists.
- Service-level env examples exist.
- AI service shell exists.

### Slice 1: Real lost-pet create flow
Status: Done
- `POST /lost-pets`
- multipart upload from `report`
- local photo storage
- listing persistence

### Slice 2: Real read flow
Status: Partially done
- `GET /lost-pets`
- `GET /lost-pets/:id`
- `pet details` page connected
- `search` list section connected
- embedding metadata is now surfaced in pet details
- still needs end-to-end runtime verification in Docker/Browser

### Slice 3: Mock toggle for demo
Status: Partially done
- mock clusters
- mock matches
- mock list/detail support added in service logic
- still needs one final consistency pass across all read endpoints

### Slice 4: AI microservice
Status: Mostly done
- `/embed` exists
- local image-path contract exists
- primary embedder now adapts the DINO/timm path from `pawsmatch`
- fallback embedder remains available so the service still works without model runtime success
- still needs runtime verification with the actual local stack

### Slice 5: Vector search
Status: Partially done
- pgvector migration exists
- embedding save path exists
- `POST /lost-pets/match` exists
- embedding dimension upgraded to fit the richer AI embeddings
- query-time embedding metadata is now surfaced in the scan UI
- still needs runtime verification and quality tuning of embeddings

### Slice 6: Final polish
Status: Not started
- full local walkthrough
- cleanup of rough edges
- remove obvious demo/runtime friction

## Confirmed Technical Decisions
- DB is local Postgres in Docker for MVP.
- AI lives in `apps/ai`, but must reuse and adapt good parts from `[/Users/ayar/Personal Dev/pawsmatch/](/Users/ayar/Personal%20Dev/pawsmatch/)`.
- Images are uploaded by the user, stored locally for MVP, and shared with AI by file path through a shared volume.
- No queues, no auth, no email flow, no object storage in v1.
- Keep the code straightforward and easy to inspect.

## Immediate Next Steps
- Continue from the current branch: `dev`.
- Review current modified files with `git status`.
- Verify the current stack locally with Docker if available.
- Confirm the `pawsmatch`-derived `timm` embedder actually boots and serves in `apps/ai`.
- Use `GET /health` plus one real `/embed` or `/lost-pets/match` call to confirm whether the main model or fallback path is being used.
- Only after AI quality is acceptable, do the Browser walkthrough and tighten the remaining flow gaps.
