# Local development

1. Install Node.js 22.12+ and Python 3.11–3.13.
2. Run `npm ci`, then `npm run --workspace ai setup`. To choose a Python
   interpreter explicitly, use `PYTHON_BIN=python3.11 npm run --workspace ai setup`.
3. Start Redis and PostgreSQL with pgvector installed. With Docker installed and
   running, use `docker compose up -d --wait db redis`. If your Postgres database
   is already hosted elsewhere, start only Redis with `npm run redis:up`.
   See [native Redis on macOS](#redis-without-docker-on-macos) if Docker is unavailable.
   Enable the extension in your development database
   with `CREATE EXTENSION IF NOT EXISTS vector;` if your database role cannot
   create extensions itself.
4. Copy `apps/api/.env.example` to `apps/api/.env.development.local` and configure
   your database connection. The API applies migrations at startup, including the baseline for an empty
   database. Do not run `schema:create` before these migrations.
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and set
   `NEXT_PUBLIC_MAPTILER_API_KEY` to your own MapTiler browser key. Restrict it to
   your allowed origins in MapTiler. For AI model settings, copy
   `apps/ai/.env.example` to `apps/ai/.env.local`.
6. With Docker running, use `npm run dev:local` from the repository root. This
   starts Redis first and then the apps through Turbo. If you started Redis
   natively instead, use `npm run dev`.

Local services: web at http://localhost:3060, docs at http://localhost:3001,
API at http://localhost:3015, and AI health at http://localhost:8000/health.

### Demo photos and image matching

The API stores uploaded photos in `apps/api/uploads` and queues embedding jobs
in Redis. A Nest worker calls the local AI service after the report is saved.
Images and embeddings must use the same model as
future scans. The default is `facebook/dinov2-small`, a public model that does not require
Hugging Face credentials. Local Python launch scripts load `apps/ai/.env.local`;
Docker receives the model through Compose environment variables. Both use the
same model by default.

Demo replacement photos are stored locally with a `demo-unsplash-` prefix;
their sources and listing IDs are recorded in `scripts/demo-photo-sources.json`.
These are representative stock photos, not recovered original pet photos.

With the API and AI services running, add the eight fictional Timișoara cat
listings with `node scripts/seed-timisoara-cats.mjs`. The script uploads the
reviewed photos, generates image embeddings, and skips listings already added.
Names, locations, photo references, and example.com contacts are recorded in
`scripts/timisoara-cats.json`. The scan page uses the standard photo upload flow.

If the model changes, run `npm run --workspace api embeddings:rebuild` with the AI
service running before demonstrating scans. This updates all available image
embeddings, so back up the database first.

## Commands

```sh
npm run build
npm run lint
npm run check-types
npm run --workspace api test
```

## Development UI

The Next.js development indicator is disabled so local walkthroughs have clean
frames. Application errors are still reported normally.

## Configuration

Keep credentials in ignored local environment files. Only sanitized
`.env.example` templates belong in Git. Uploaded photos and AI model caches
are runtime data, not application source.

See [DigitalOcean deployment](../DEPLOY_DIGITALOCEAN.md) for production setup.

## Redis startup and operations

Use the Redis service in `docker-compose.yml` for repeatable local development,
while running the application code natively for fast reloads:

```sh
npm run dev:local
```

Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/)
and open it before using this command. Verify the engine is ready with
`docker info` and Compose is available with `docker compose version`.
Docker Desktop does not require a Docker Hub login for this local workflow.

`dev:local` runs `npm run redis:up && npm run dev`: Redis must become healthy
before Turbo starts the applications. You can still run these as two separate
commands, in that order. Running `npx turbo dev` separately is unnecessary.
Check Redis with `npm run redis:check` (expected: `PONG`).

`redis:up` starts Redis in the background and waits for its health check.
`redis:check` should print `PONG`. `npm run dev` starts the web/docs apps, Nest API
and Python AI service. Nest automatically starts the BullMQ worker; it does not
start Redis or Python itself. There is no separate worker terminal to launch.

The API's local defaults are `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6379` and
`AI_SERVICE_URL=http://localhost:8000`. Inside Compose, the API uses the service
names `redis:6379` and `http://ai:8000` instead of localhost. Database settings
remain in `apps/api/.env.development.local`; using Redis locally does not
require replacing an existing hosted Postgres connection.

```sh
docker compose ps redis
docker compose logs -f redis
npm run redis:stop
```

Stopping the applications does not stop Redis. `redis:stop` stops the Redis
container and preserves its volume. With the Docker engine running, the
`unless-stopped` restart policy recovers a running service after an engine
restart; manually stopped services need `redis:up` again. This does not install
or start Docker itself.

Both Compose files enable append-only persistence, mount `redis-data`, and use
`maxmemory-policy noeviction`. Development exposes Redis only on localhost;
production exposes no Redis host port. A Nest process connects to the configured
service, just as it connects to Postgres. Deployment starts Redis as its own
service. Larger deployments can use a managed Redis service with the same
durability and BullMQ compatibility requirements.

Do not run Docker Redis and a native Redis process on the same host port.
Switching between them does not automatically move queue data between their
storage directories; let pending work finish before switching. Postgres keeps
the report status independently of Redis job history.

### Redis without Docker on macOS

Install Redis using Homebrew, then run it in a separate terminal with queue
persistence enabled:

```sh
brew install redis
mkdir -p apps/api/.tmp/redis
redis-server --bind 127.0.0.1 --port 6379 \
  --appendonly yes --maxmemory-policy noeviction \
  --dir "$PWD/apps/api/.tmp/redis"
```

Run those commands from the repository root. In another terminal, confirm
`redis-cli -h 127.0.0.1 -p 6379 ping` prints `PONG`, then run `npm run dev`.
The data directory is ignored by Git. A native Redis installation can also be
managed by `brew services` after configuring its Redis config with the same
persistence and eviction settings. The `npm run redis:*` helpers target Docker;
use `redis-cli` to inspect a native installation.

Official references: [Redis on Docker](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/)
and [Redis on macOS](https://redis.io/docs/latest/operate/oss_and_stack/install/archive/install-redis/install-redis-on-mac-os/).

## Full local Docker stack

Copy `.env.example` to `.env`, set your MapTiler key, then run `npm run docker:up`.
The Web container enables the same-origin API proxy for this local setup. Open
http://localhost:3060/en. The first AI request downloads model weights into the
`ai-cache` volume and can take longer. Services bind to localhost; changing a host
port does not change the fixed internal service ports.

`npm run docker:down` preserves data. Never add `-v` unless you intend to delete
that stack's database, uploaded photos and model cache.

## Photo search behavior

The API returns at most ten same-model candidates below `AI_MATCH_MAX_DISTANCE`
(default `0.5`, cosine distance). This is a configurable retrieval heuristic,
not a validated identity or accuracy threshold. A valid search can return no
candidates; users can try another photo, remove the city filter or browse the map.
The UI labels results as similar-looking pets and does not turn similarity into
an identity probability. Failed model loading returns an unavailable state;
handcrafted fallback vectors are never presented as AI matches.

Supported images are JPG, PNG, GIF and WebP (up to four, 8 MB each and 25 MP).
HEIC/HEIF must be exported to one of these formats first. The detector crops cats;
other animals and undetected cats use the full photo.

`GET /health` checks that the Python process is running. `GET /ready` loads actual
weights and checks feature extraction; production Compose waits for this endpoint.
Use `npm run check:ai -- /absolute/path/to/photo.jpg` for an embedding smoke check.

## Checks

Run `npm run check-types`, `npm run lint`, `npm run --workspace api test`,
`npm run --workspace api test:e2e`, `npm run test:map-cache`, and
`npm run --workspace ai test` before submitting changes. GitHub Actions also
builds the apps and checks migrations against a disposable pgvector database.
The MapLibre override keeps the SDK's transitive renderer on a patched version;
map interaction is checked separately from TypeScript compilation. The Web app
uses the supported Next.js Webpack build to apply the SDK compatibility alias
consistently to dependencies as well as application imports.

## Queued upload processing

```text
POST /lost-pets → save photos + report (pending) → BullMQ { petId } → return 201
worker → Python POST /embed → save vector + ready status
GET /lost-pets/:id → current embeddingStatus + embeddingInfo
```

The queue contains IDs, never image bytes. Redis must use persistent storage
and `maxmemory-policy noeviction`; both Compose files configure this. Local
development also needs Redis running (`docker compose up -d redis`). Its host,
port and optional password are configured in `apps/api/.env.example`.

The worker starts after migrations, uses a fresh MikroORM context for each job,
and limits upload inference to one active job across API replicas. There are
three attempts with exponential backoff for temporary failures; invalid photos
fail immediately. Fallback vectors are never marked ready. Final failures are
visible as `embeddingStatus: failed` on the report. Reports without photos have
status `none` and do not create jobs.

If Redis is unavailable during upload, the saved report stays pending and its
photos remain intact. Every 30 seconds, and at startup, recovery schedules
pending/processing reports using stable job IDs. Repeated scheduling does not
create multiple queued copies. Re-delivery of a ready report skips inference.
Completed Redis jobs are retained for at most one day/1,000 jobs and failed
jobs for 1,000 jobs; the report's final status remains in Postgres. Graceful
shutdown finishes active jobs before closing the producer/database.

Scan stays synchronous, including its existing temporary-file cleanup. This
change adds no notification delivery or automatic matching after uploads.
`embeddings:rebuild` remains an explicit maintenance command and disables the
background worker in that process.

Runtime migrations disable automatic schema snapshots: Supabase manages other
schemas in the same database, whose checks must not be compiled into an app
migration snapshot. Migration SQL and migration history remain authoritative.

Run `npm run --workspace api test:queue` with Redis and a pgvector database
available. It uses the configured API development database (or
`QUEUE_TEST_DATABASE_URL`), creates a randomly named `queue_test_*` schema and
Redis key prefix, and removes only its own test data. The Redis test port can
be overridden with `QUEUE_TEST_REDIS_PORT`.

The suite runs actual HTTP multipart uploads, migrations twice, real Redis
workers and Postgres writes. A controlled AI HTTP fixture exercises 12
simultaneous uploads, independent vectors, deduplication, retry exhaustion,
invalid/fallback responses, producer disconnection, recovery, worker restart
and synchronous scan cleanup. Two worker instances verify the shared concurrency
limit. This isolates queue correctness from model
accuracy. For actual model validation, run `npm run check:ai -- /absolute/path/to/photo.jpg`
against the running Python service.
Set `QUEUE_TEST_REAL_AI_URL=http://localhost:8000` when running `test:queue`
to also upload a reviewed demo photo through the actual AI model. That optional
test creates and removes its own file in `apps/api/uploads` so it works with
the Python service's upload-directory restriction.
