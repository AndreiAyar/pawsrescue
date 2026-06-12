# Deploy PawsRescue on DigitalOcean

This setup runs the Next.js web app, NestJS API, and AI service in Docker on one
VPS. The VPS's existing Nginx installation handles public HTTP/HTTPS traffic.
PostgreSQL stays on Supabase.

## 1. Supabase

1. In Supabase, open **Connect** and copy the **Session pooler** URI. A regular
   DigitalOcean Droplet is commonly IPv4-only, while Supabase direct connections
   use IPv6 by default. Session mode is also appropriate for a persistent API.
2. Keep port `5432`, append `?sslmode=require` if it is missing, and URL-encode
   special characters in the database password.
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
   `3000`, `3015`, `5432`, or `8000`.
4. Add a DNS `A` record for the production hostname pointing to the Droplet IP.
5. Install Docker Engine and the Docker Compose plugin from Docker's official
   Ubuntu repository.

Confirm Docker Compose supports `--wait` (Compose v2.20 or newer is a safe
baseline):

```bash
docker compose version
```

## 3. Configure Nginx

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

## 4. First deploy

On the Droplet:

```bash
git clone YOUR_REPOSITORY_URL pawsrescue
cd pawsrescue
cp deploy/.env.production.example .env.production.local
nano .env.production.local
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Set these values in `.env.production.local`:

- `DATABASE_URL`: Supabase Session pooler URI with `sslmode=require`.
- `DB_POOL_MAX`: keep `10` initially.
- `AI_REQUEST_TIMEOUT_MS`: keep `180000` initially; this caps an AI request at
  three minutes.

Check deployment with:

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml ps
docker compose --env-file .env.production.local -f docker-compose.prod.yml logs --tail=200
curl -fsS https://YOUR_DOMAIN/api/health
cd apps/api && npx mikro-orm migration:list
```

The migration list must show the existing migrations as executed. Do not launch
against an empty database without first creating a proper baseline migration:
the oldest migration in this repository expects the `lost_pets` table to exist.

The deploy command waits up to four minutes for AI, API, and Web health checks.
It exits with an error instead of reporting a successful deployment when a
container is unhealthy.

## 5. Updates and rollback

Deploy an update:

```bash
git pull --ff-only
./deploy/deploy.sh
```

Before risky updates, record the current commit with `git rev-parse HEAD` and
take a Droplet snapshot. To roll back, check out that commit and rerun the deploy
script. Database migrations need a separately tested down/forward strategy; a
container rollback does not undo schema changes.

## 6. Backups and operations

- Supabase protects database data according to the backup/PITR options enabled
  on your Supabase plan. Verify those settings rather than assuming they exist.
- Uploaded photos live in the Docker volume `pawsrescue_shared-uploads`. Droplet
  backups help, but also copy this volume regularly to Spaces or another remote
  backup target.
- The AI model cache is in `pawsrescue_ai-cache`; it can be rebuilt and does not
  need the same backup priority as uploads.
- Watch disk, RAM, and CPU alerts in DigitalOcean. AI startup can legitimately
  take longer, so its health check has a 90-second grace period.
- Run only one API replica while migrations execute automatically at startup.
  Move migrations to a one-off release job before scaling API replicas.
