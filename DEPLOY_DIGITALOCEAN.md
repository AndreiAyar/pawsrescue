# Deploy PawsRescue on DigitalOcean

This setup runs the Next.js web app, NestJS API, and AI service in Docker on one
VPS. The VPS's existing Nginx installation handles public HTTP/HTTPS traffic.
PostgreSQL stays on Supabase.

## 1. Supabase

1. In Supabase, open **Connect** and select **Session pooler**. A regular
   DigitalOcean Droplet is commonly IPv4-only, while Supabase direct connections
   use IPv6 by default. Session mode is also appropriate for a persistent API.
2. Copy its host, port, username, password, and database into the separate
   `DB_*` variables. Separate variables do not require URL-encoding the password.
3. Set `DB_POOL_MAX=10`. Start small because every API process owns its pool.
4. Confirm the `vector` extension is enabled. The existing migration also runs
   `create extension if not exists vector`.
5. Never commit the URI. Rotate the database password if it has ever appeared in
   Git history, logs, screenshots, or chat.

Do not use the Transaction pooler URI for app startup migrations. The API runs
pending MikroORM migrations once during startup, before accepting traffic.

## 2. Droplet and DNS

Recommended starting size for the AI container is at least **4 vCPU / 8 GB RAM**.
The Torch image and model cache are much heavier than the web and API services.

1. Create an Ubuntu LTS Droplet with SSH-key authentication.
2. Enable DigitalOcean backups.
3. Configure the VPS firewall to allow inbound `22/tcp` from your own IP only,
   plus `80/tcp` and `443/tcp` from all addresses. Do not expose
   `3060`, `3015`, `5432`, `6379`, or `8000`.
4. Add a DNS `A` record for the production hostname pointing to the Droplet IP.
5. Install Docker Engine and the Docker Compose plugin from Docker's official
   Ubuntu repository.

Confirm Docker Compose supports `--wait` (Compose v2.20 or newer is a safe
baseline):

```bash
docker compose version
```

## 3. Get the source

```bash
git clone YOUR_REPOSITORY_URL pawsrescue
cd pawsrescue
```

## 4. Configure Nginx

Copy the included virtual host and replace the example domain:

```bash
sudo cp deploy/nginx-pawsrescue.conf /etc/nginx/sites-available/pawsrescue
sudo nano /etc/nginx/sites-available/pawsrescue
sudo ln -s /etc/nginx/sites-available/pawsrescue /etc/nginx/sites-enabled/pawsrescue
sudo nginx -t
sudo systemctl reload nginx
```

If `sites-enabled/pawsrescue` already exists, do not create the symlink again.

Enable HTTPS with Certbot if this hostname does not already have a certificate:

```bash
sudo certbot --nginx -d YOUR_DOMAIN
```

## 5. First deploy

On the Droplet:

```bash
cp deploy/.env.production.example .env.production.local
nano .env.production.local
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Set these values in `.env.production.local`:

- `NEXT_PUBLIC_MAPTILER_API_KEY`: your MapTiler browser key, restricted to your
  production origin. This value is embedded at build time; rebuild the web image
  after changing it.
- `DB_HOST_NEST`: Supabase Session pooler hostname.
- `DB_PORT_NEST`: `5432` for Session mode.
- `DB_USER_NEST`: normally `postgres.PROJECT_REF`, not only `postgres`.
- `DB_PASSWORD_NEST`: the Supabase database password.
- `DB_NAME_NEST`: normally `postgres`.
- `DB_SSL`: `true`.
- `DB_SSL_REJECT_UNAUTHORIZED`: `true`. If your connection requires a custom CA,
  set `DB_SSL_CA` to the trusted certificate PEM (literal `\n` for line breaks).
  Keep server certificate verification enabled.
- `AI_TRANSFORMERS_MODEL_NAME`: `facebook/dinov2-small` by default. Changing the
  model or crop settings requires rebuilding stored embeddings.
- `AI_MATCH_MAX_DISTANCE`: `0.5` initially; this is a retrieval heuristic, not
  identity confidence.
- `DB_POOL_MAX`: keep `10` initially.
- `AI_REQUEST_TIMEOUT_MS`: keep `180000` initially; this caps an AI request at
  three minutes.

Check deployment with:

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml ps
docker compose --env-file .env.production.local -f docker-compose.prod.yml logs --tail=200
curl -fsS https://YOUR_DOMAIN/api/health
docker compose --env-file .env.production.local -f docker-compose.prod.yml exec api node dist/src/scripts/migration-status.js
```

The migration list must show no pending migrations. The baseline creates the
original table on empty databases; existing installations retain their table and
data. Historical migrations remain unchanged. Do not run `schema:create` before
startup migrations, or manually mark migrations applied to an unknown schema.

The deploy command waits up to ten minutes for AI, API, and Web health checks.
It exits with an error instead of reporting a successful deployment when a
container is unhealthy.

Nginx reaches the Web container on `127.0.0.1:3060`. Next.js also listens on
port `3060` inside Docker, avoiding conflicts and keeping the Web port consistent
in development, Docker, health checks, and Nginx.

## 6. Updates and rollback

Deploy an update:

```bash
git pull --ff-only
./deploy/deploy.sh
```

Before risky updates, record the current commit with `git rev-parse HEAD` and
take a Droplet snapshot. To roll back, check out that commit and rerun the deploy
script. Database migrations need a separately tested down/forward strategy; a
container rollback does not undo schema changes.

## 7. Backups and operations

- Redis runs as its own Compose service with append-only persistence in
  `pawsrescue_redis-data`; the API connects to `redis:6379` over the internal
  network. The deploy command starts it and waits for its health check before
  starting the API. No Redis port is published on the host. Preserve this volume
  during updates; `docker compose down` keeps it, while `down -v` deletes it.
  Inspect it with `docker compose --env-file .env.production.local -f docker-compose.prod.yml exec -T redis redis-cli ping`
  or the corresponding `logs redis` command. The BullMQ worker runs in the Python AI service and writes embeddings
  directly to Postgres. The API only adds jobs; restarting it does not stop inference.
- Supabase protects database data according to the backup/PITR options enabled
  on your Supabase plan. Verify those settings rather than assuming they exist.
- Uploaded photos live in the Docker volume `pawsrescue_shared-uploads`. Droplet
  backups help, but also copy this volume regularly to Spaces or another remote
  backup target.
- The AI model cache is in `pawsrescue_ai-cache`; it can be rebuilt and does not
  need the same backup priority as uploads.
- Watch disk, RAM, and CPU alerts in DigitalOcean. AI readiness loads weights and validates feature extraction. The first cold
  download can take several minutes; inspect AI logs if the wait times out.
- Run only one API replica while migrations execute automatically at startup.
  Move migrations to a one-off release job before scaling API replicas.

## Release checks

`/health` is liveness; the AI container uses `/ready` to verify model loading.
A healthy stack still needs a smoke test through the public hostname: open the
map, submit a fictional report and scan a known fixture photo. Verify HTTPS,
MapTiler origin restrictions and photo backup restoration on the target server.
The local Next API proxy is disabled in production; Nginx owns `/api/` routing.
Never enable `API_PROXY_ENABLED` on the public Web service to bypass that boundary.

When using `DATABASE_URL`, configure TLS in the URI as well as `DB_SSL=true`;
avoid URI options that disable certificate verification. Separate `DB_*` values
with `DB_SSL_CA` avoid conflicting URI SSL options.
