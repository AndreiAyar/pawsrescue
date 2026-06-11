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
- `apps/ai` is now also wired into the Turborepo dev flow for local development.

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
- local real-mode env has been wired for `api` and `web`
- still needs end-to-end runtime verification against the live local processes

### Slice 3: Mock toggle for demo
Status: Partially done
- mock clusters
- mock matches
- mock list/detail support added in service logic
- default behavior now points to real mode unless `USE_MOCK_DATA=true` is explicitly set
- still needs one final consistency pass across all read endpoints

### Slice 4: AI microservice
Status: Mostly done
- `/embed` exists
- local image-path contract exists
- primary embedder now adapts the DINO/timm path from `pawsmatch`
- fallback embedder remains available so the service still works without model runtime success
- `apps/ai` is now exposed as a Turborepo workspace task for local dev ergonomics
- the AI service now uses a pawsmatch-inspired `timm` ensemble (`vit_base_patch16_224_dino` plus `vit_base_patch8_224_dino`) with a deterministic fallback
- `transformers` is now installed locally in `apps/ai/.venv`
- still needs one live post-restart verification against the actual local stack

### Slice 5: Vector search
Status: Partially done
- pgvector migration exists
- embedding save path exists
- `POST /lost-pets/match` exists
- embedding dimension upgraded to fit the richer AI embeddings
- query-time embedding metadata is now surfaced in the scan UI
- Supabase schema migrations for embedding columns have now been applied
- still needs runtime verification and quality tuning of embeddings

### Slice 6: Final polish
Status: Not started
- full local walkthrough
- cleanup of rough edges
- remove obvious demo/runtime friction

## Confirmed Technical Decisions
- DB can be local Postgres in Docker or the configured Supabase Postgres for local development.
- AI lives in `apps/ai`, but must reuse and adapt good parts from `[/Users/ayar/Personal Dev/pawsmatch/](/Users/ayar/Personal%20Dev/pawsmatch/)`.
- Images are uploaded by the user, stored locally for MVP, and shared with AI by file path through a shared volume.
- No queues, no auth, no email flow, no object storage in v1.
- Keep the code straightforward and easy to inspect.

## Immediate Next Steps
- Continue from the current branch: `dev`.
- Review current modified files with `git status`.
- Restart `apps/ai` and `apps/api` locally so the latest env and dependency fixes are active.
- Retry one real `POST /lost-pets/match` flow and confirm the returned embedding metadata after the `transformers` install.
- Verify the real local flow: `report -> search -> detail -> scan -> match`.
- Only after local real-mode behavior is stable, do the Browser walkthrough and tighten the remaining flow gaps.
