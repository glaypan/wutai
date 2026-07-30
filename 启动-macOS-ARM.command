#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server-standalone.js"
RUNTIME_DIR="$SCRIPT_DIR/.runtime"
NODE_HOME="$RUNTIME_DIR/node-v20.18.1-darwin-arm64"
NODE_BIN="$NODE_HOME/bin/node"

cd "$SCRIPT_DIR"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "[ERROR] This launcher is for Apple Silicon macOS."
  read -r -p "Press Enter to exit..."
  exit 1
fi

if [ ! -f "$SERVER_JS" ]; then
  echo "[ERROR] server-standalone.js was not found next to this launcher."
  read -r -p "Press Enter to exit..."
  exit 1
fi

if command -v node >/dev/null 2>&1 && node -e 'var m=Number(process.versions.node.split(".")[0]); process.exit(m>=16?0:1)' >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ ! -x "$NODE_BIN" ]; then
  echo "[1/2] Downloading local Node.js runtime..."
  mkdir -p "$RUNTIME_DIR"
  TMP_DIR="$(mktemp -d "$RUNTIME_DIR/node-download.XXXXXX")"
  trap 'rm -rf "$TMP_DIR"' EXIT
  curl -fL "https://nodejs.org/dist/v20.18.1/node-v20.18.1-darwin-arm64.tar.gz" -o "$TMP_DIR/node.tar.gz"
  tar -xzf "$TMP_DIR/node.tar.gz" -C "$RUNTIME_DIR"
  chmod +x "$NODE_BIN"
  rm -rf "$TMP_DIR"
  trap - EXIT
fi

echo "[2/2] Starting Stage Manager..."
AUTO_OPEN=1 "$NODE_BIN" "$SERVER_JS"
