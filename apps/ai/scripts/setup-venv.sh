#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$APP_DIR/.venv"
PYTHON_BIN="${PYTHON_BIN:-python3}"

echo "Creating AI virtualenv in $VENV_DIR"
"$PYTHON_BIN" -m venv "$VENV_DIR"

echo "Installing AI requirements"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$APP_DIR/requirements.txt"

echo ""
echo "AI environment is ready."
echo "Run: npm run --workspace ai dev"
