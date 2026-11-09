#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
APP_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
VENV_DIR="$APP_DIR/.venv"
# The pinned ML dependencies require Python 3.11-3.13.
if [ -z "${PYTHON_BIN:-}" ]; then
  PYTHON_BIN=python3
  for candidate in python3 python3.13 python3.12 python3.11; do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(not ((3, 11) <= sys.version_info[:2] <= (3, 13)))' 2>/dev/null; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi
if ! "$PYTHON_BIN" -c 'import sys; sys.exit(not ((3, 11) <= sys.version_info[:2] <= (3, 13)))'; then
  echo "Install Python 3.11-3.13 and set PYTHON_BIN to its executable."
  exit 1
fi

if [ -x "$VENV_DIR/bin/python" ] && ! "$VENV_DIR/bin/python" -c 'import sys; sys.exit(not ((3, 11) <= sys.version_info[:2] <= (3, 13)))'; then
  echo "Existing virtualenv uses an unsupported Python. Move $VENV_DIR aside and rerun setup."
  exit 1
fi

echo "Creating AI virtualenv in $VENV_DIR"
"$PYTHON_BIN" -m venv "$VENV_DIR"

echo "Installing AI requirements"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$APP_DIR/requirements.txt"

echo ""
echo "AI environment is ready."
echo "Run: npm run --workspace ai dev"
