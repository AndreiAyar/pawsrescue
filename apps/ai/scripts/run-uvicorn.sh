#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
HOST="${AI_HOST:-127.0.0.1}"

export UPLOAD_DIR="${UPLOAD_DIR:-$APP_DIR/../api/uploads}"

cd "$APP_DIR"

if [ -f "$APP_DIR/.env.local" ]; then
  set -- "$@" --env-file "$APP_DIR/.env.local"
fi

if [ "${1:-}" = "--reload" ]; then
  shift
  exec sh "$SCRIPT_DIR/run-python.sh" \
    -m uvicorn main:app \
    --host "$HOST" \
    --port "${AI_PORT:-8000}" \
    --reload \
    --reload-dir . \
    --reload-exclude ".venv/*" \
    --reload-exclude "__pycache__/*" \
    "$@"
fi

exec sh "$SCRIPT_DIR/run-python.sh" -m uvicorn main:app --host "$HOST" --port "${AI_PORT:-8000}" "$@"
