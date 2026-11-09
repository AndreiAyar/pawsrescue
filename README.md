# PawsRescue

Fullstack app for finding pets with the help of AI. 🐈

## Local development

1. Install Node.js 20.9+ and Python 3.11–3.13.
2. Run `npm install`, then `npm run --workspace ai setup`. To choose a Python
   interpreter explicitly, use `PYTHON_BIN=python3.11 npm run --workspace ai setup`.
3. Start PostgreSQL with pgvector installed. With Docker installed, run
   `docker compose up -d db`. Enable the extension in your development database
   with `CREATE EXTENSION IF NOT EXISTS vector;` before creating the schema.
4. Copy `apps/api/.env.example` to `apps/api/.env.development.local` and configure
   your database connection. For a new, empty development database, initialize
   its schema with `cd apps/api && npx mikro-orm schema:create --run`.
5. Copy `apps/web/.env.example` to `apps/web/.env.local` and set
   `NEXT_PUBLIC_MAPTILER_API_KEY` to your own MapTiler browser key. Restrict it to
   your allowed origins in MapTiler. For AI model settings, copy
   `apps/ai/.env.example` to `apps/ai/.env.local`.
6. Run `npm run dev` from the repository root.

Local services: web at http://localhost:3060, docs at http://localhost:3001,
API at http://localhost:3015, and AI health at http://localhost:8000/health.

### Demo photos and image matching

The API stores uploaded photos in `apps/api/uploads` and requests embeddings
from the local AI service. Images and embeddings must use the same model as
future scans. For the demo, `apps/ai/.env.local` contains
`AI_TRANSFORMERS_MODEL_NAME=facebook/dinov2-small`, a public model that does not
require Hugging Face credentials. The AI startup script loads this local file.
Without an override, the service still defaults to DINOv3, which requires access.

Demo replacement photos are stored locally with a `demo-unsplash-` prefix;
their sources and listing IDs are recorded in `scripts/demo-photo-sources.json`.
These are representative stock photos, not recovered original pet photos.

If the model changes, run `npm run --workspace api embeddings:rebuild` with the AI
service running before demonstrating scans. This updates all available image
embeddings, so back up the database first.

## Repository structure

- `apps/web`: Next.js application.
- `apps/api`: NestJS API and MikroORM migrations.
- `apps/ai`: Python image matching service.
- `apps/docs`: Next.js documentation app.
- `packages`: shared UI and configuration packages.
- `deploy`: production configuration; see [deployment instructions](DEPLOY_DIGITALOCEAN.md).

## Common commands

```sh
npm run build
npm run lint
npm run check-types
npm run --workspace api test
```

Keep credentials in ignored local environment files. Only sanitized `.env.example`
templates belong in Git. PostgreSQL passwords in local templates are development
defaults; set your own credentials for deployed databases.
