#!/bin/sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server-standalone.js"

cd "$SCRIPT_DIR" || exit 1

if [ ! -f "$SERVER_JS" ]; then
  echo "[ERROR] server-standalone.js was not found next to this launcher."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js was not found."
  echo "Install it with: opkg update && opkg install node"
  exit 1
fi

echo "Starting Stage Manager..."
AUTO_OPEN=0 node "$SERVER_JS"
