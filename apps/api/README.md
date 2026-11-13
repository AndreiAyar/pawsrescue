# PawsRescue API

NestJS API for reports, geographic clusters, uploads, and photo search.
MikroORM owns the PostgreSQL schema and migrations. Uploads create BullMQ jobs;
the Python service consumes them and saves embeddings directly to Postgres.

Follow [local setup](../../docs/DEVELOPMENT.md) before starting the API with
`npm run --workspace api dev` from the root. It listens on port 3015.
Credentials belong in ignored local env files, never in source code.

- `npm run --workspace api test -- --runInBand`: unit tests.
- `npm run --workspace api test:e2e -- --runInBand`: HTTP smoke tests.
- `npm run test:queue:local`: cross-process tests with disposable local services.

Add a migration for schema changes; do not run schema generation against a
shared or production database. See [contributing](../../CONTRIBUTING.md).
