# PawsRescue web

Next.js app with Romanian and English routes, report creation, a MapTiler map,
and photo search. Shared components live in `packages/ui`.

Start from the [repository setup](../../docs/DEVELOPMENT.md), then use
`npm run --workspace web dev` from the root. The app runs on port 3060.
Set `NEXT_PUBLIC_MAPTILER_API_KEY` in `apps/web/.env.local` and keep the map's
upstream attribution visible. `API_URL` is server-side; browser requests use `/api`.

See [contributing](../../CONTRIBUTING.md) and [deployment](../../DEPLOY_DIGITALOCEAN.md).
