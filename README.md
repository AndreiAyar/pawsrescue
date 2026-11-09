# PawsRescue

Fullstack app for finding pets with the help of AI. 🐈🐱 (Dogs included ! :) )

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

With the API and AI services running, add the eight fictional Timișoara cat
listings with `node scripts/seed-timisoara-cats.mjs`. The script uploads the
reviewed photos, generates image embeddings, and skips listings already added.
Names, locations, photo references, and example.com contacts are recorded in
`scripts/timisoara-cats.json`. The scan page uses the standard photo upload flow.

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

## What's inside?


This Turborepo includes the following packages/apps:


### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app
- `web`: another [Next.js](https://nextjs.org/) app
- `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages for this monorepo, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build
yarn dlx turbo build
pnpm exec turbo build
```

You can build a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo build --filter=docs

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo build --filter=docs
yarn exec turbo build --filter=docs
pnpm exec turbo build --filter=docs
```


### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev
yarn exec turbo dev
pnpm exec turbo dev
```

You can develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo dev --filter=web

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo dev --filter=web
yarn exec turbo dev --filter=web
pnpm exec turbo dev --filter=web
```

### Remote Caching (we dont use this ATM.. no Vercel Hosting)

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo

# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo login

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo login
yarn exec turbo login
pnpm exec turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
# With [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation) installed (recommended)
turbo link

# Without [global `turbo`](https://turborepo.com/docs/getting-started/installation#global-installation), use your package manager
npx turbo link
yarn exec turbo link
pnpm exec turbo link
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Configuration Options](https://turborepo.com/docs/reference/configuration)
- [CLI Usage](https://turborepo.com/docs/reference/command-line-reference)

Keep credentials in ignored local environment files. Only sanitized `.env.example`
templates belong in Git. PostgreSQL passwords in local templates are development
defaults; set your own credentials for deployed databases.
