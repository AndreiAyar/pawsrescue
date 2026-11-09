#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_PYTHON="$APP_DIR/.venv/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
  echo "AI virtualenv is missing."
  echo "Run: npm run --workspace ai setup"
  exit 1
fi

cd "$APP_DIR"
exec "$VENV_PYTHON" "$@"
