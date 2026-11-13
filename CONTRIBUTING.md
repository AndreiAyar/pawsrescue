# Contributing to PawsRescue

PawsRescue helps people find missing animals. Help with code, design, Romanian
and English translations, documentation, and testing is welcome.

For a small fix, open a pull request. For a larger change, open an issue first
so we can agree on the problem and keep the implementation focused.

## Start here

Use Node.js 22 (22.12 or newer), npm, and Docker with Compose. Native AI
development also needs Python 3.11; see [local setup](docs/DEVELOPMENT.md).
Linux and macOS are the primary development environments. On Windows, use
WSL2 or Docker Desktop; the Python launch scripts require a POSIX shell.

```sh
git clone https://github.com/YOUR_USERNAME/pawsrescue.git
cd pawsrescue
npm ci
npm run setup:env
```

Fork the repository first and replace `YOUR_USERNAME` with your GitHub username.
The setup command copies sanitized examples and never overwrites existing env
files. Use your own MapTiler key: `.env` for containers, or
`apps/web/.env.local` for native development. Restrict it to your own origins.

- **All containers:** `npm run docker:up`. No local Python installation required.
- **Native app code:** follow [DEVELOPMENT.md](docs/DEVELOPMENT.md), start a local
  Postgres/pgvector database, install the AI environment, then `npm run dev:local`.

Use a development database you control. You do not need the maintainer's
Supabase account, uploads, credentials, or MapTiler account.

## Where changes belong

| Area                                         | Location              |
| -------------------------------------------- | --------------------- |
| Web UI and translations                      | `apps/web`            |
| HTTP API, migrations, job producer           | `apps/api`            |
| Photo matching, Python worker, vector writes | `apps/ai`             |
| Shared React components                      | `packages/ui`         |
| Setup and architecture                       | `docs/DEVELOPMENT.md` |

The API saves a report and queues its ID. Python computes and commits its
embedding, then completes the job. Keep jobs safe to retry: do not overwrite an
already committed embedding. Scan uses the same inference code through HTTP.

## Before opening a pull request

Run the checks relevant to your change:

```sh
npm run lint
npm run check-types
npm run build
npm run --workspace api test -- --runInBand
npm run --workspace api test:e2e -- --runInBand
npm run test:map-cache
npm run --workspace ai test
```

Queue changes also need `npm run test:queue:local`; it uses disposable local
Postgres and Redis containers. Install the Python worker dependencies first
as described in [the integration test guide](docs/DEVELOPMENT.md#integration-test).
Do not point tests or seed scripts at a production database.

Keep PRs small. Explain the problem, the resulting behavior, and what you
checked. Include screenshots for visible UI changes. Add a migration for schema
changes and document new environment variables in the sanitized examples.

## Data and third-party material

Use fictional animals and `example.com` contacts in examples. Do not attach real
contact details, exact private locations, database dumps, credentials, or model
caches. Uploads are runtime data; only reviewed fixtures belong in Git.

Keep upstream copyright and license notices. Check [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
before adding photos, fonts, models, or dependencies. Contributions must be
material you have permission to contribute under the project's [MIT license](LICENSE).

See [SECURITY.md](SECURITY.md) for vulnerabilities and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community expectations.
