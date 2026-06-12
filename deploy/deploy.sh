#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.production.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy deploy/.env.production.example and fill it in." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml config --quiet
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml build --pull
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml up \
  -d \
  --remove-orphans \
  --wait \
  --wait-timeout 240
docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml ps
