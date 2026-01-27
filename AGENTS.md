# Repository Guidelines

## Project Structure & Module Organization
- `apps/api`: NestJS API using MikroORM/PostgreSQL. Source lives in `apps/api/src`, migrations in `apps/api/src/migrations`, and tests in `apps/api/test`.
- `apps/web`: Next.js app (App Router) with routes in `apps/web/app` and static assets in `apps/web/public`.
- `apps/docs`: Next.js docs site (parallel structure to `apps/web`).
- `packages/`: shared packages such as `packages/ui` (reusable React components) plus shared config packages (`eslint-config`, `typescript-config`, `tailwind-config`).
- `turbo.json`: task pipeline for build/lint/typecheck/dev across workspaces.

## Build, Test, and Development Commands
- `npm run dev`: run all apps/packages in dev mode via Turborepo.
- `npx turbo run dev --filter=web`: run a single app (swap `web` for `docs` or `api`).
- `npm run build`: build all apps/packages.
- `npm run lint`: lint all workspaces.
- `npm run check-types`: run TypeScript typechecks across workspaces.
- `npm run format`: format `*.ts`, `*.tsx`, `*.md` with Prettier.
- Workspace examples: `npm run --workspace api dev`, `npm run --workspace api test`.

## Coding Style & Naming Conventions
- TypeScript is the default everywhere; prefer `.ts`/`.tsx` and keep code in existing folder patterns.
- Formatting is enforced with Prettier; linting uses ESLint (Next.js lint rules in web/docs).
- Add new API modules under `apps/api/src` and shared UI components under `packages/ui/src`.
- Test files use `*.spec.ts` and e2e tests live under `apps/api/test`.

## Testing Guidelines
- API tests use Jest.
- Unit tests: `apps/api/src/**/*.spec.ts`.
- E2E tests: `apps/api/test/*.e2e-spec.ts`.
- Commands: `npm run --workspace api test`, `npm run --workspace api test:e2e`, `npm run --workspace api test:cov`.

## Commit & Pull Request Guidelines
- Commit messages are sentence-style, imperative, and descriptive (e.g., "Add create pet page", "Update CORS policy").
- PRs should include: a clear summary, testing steps, and linked issues when applicable.
- For UI changes, include screenshots or short clips for `apps/web` or `apps/docs`.
- For schema changes, add/update MikroORM migrations in `apps/api/src/migrations` and mention them in the PR.

## Configuration & Secrets
- Environment files are app-specific (see `apps/api/.env.development.local`, `apps/web/.env.development`).
- Do not commit real secrets; use local env files and document any new required variables in PRs.
