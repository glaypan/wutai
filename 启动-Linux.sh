#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server-standalone.js"
RUNTIME_DIR="$SCRIPT_DIR/.runtime"
NODE_BIN=""

cd "$SCRIPT_DIR"

if [ ! -f "$SERVER_JS" ]; then
  echo "[ERROR] server-standalone.js was not found next to this launcher."
  exit 1
fi

if command -v node >/dev/null 2>&1 && node -e 'var m=Number(process.versions.node.split(".")[0]); process.exit(m>=16?0:1)' >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi

if [ -z "$NODE_BIN" ]; then
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64|amd64) NODE_NAME="node-v20.18.1-linux-x64" ;;
    aarch64|arm64) NODE_NAME="node-v20.18.1-linux-arm64" ;;
    armv7l|armv7*) NODE_NAME="node-v20.18.1-linux-armv7l" ;;
    *) echo "[ERROR] Unsupported Linux architecture: $ARCH"; exit 1 ;;
  esac
  NODE_HOME="$RUNTIME_DIR/$NODE_NAME"
  NODE_BIN="$NODE_HOME/bin/node"
  if [ ! -x "$NODE_BIN" ]; then
    echo "[1/2] Downloading local Node.js runtime..."
    mkdir -p "$RUNTIME_DIR"
    TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t stage-manager)"
    trap 'rm -rf "$TMP_DIR"' EXIT
    if command -v curl >/dev/null 2>&1; then
      curl -fL "https://nodejs.org/dist/v20.18.1/$NODE_NAME.tar.xz" -o "$TMP_DIR/node.tar.xz"
    elif command -v wget >/dev/null 2>&1; then
      wget -O "$TMP_DIR/node.tar.xz" "https://nodejs.org/dist/v20.18.1/$NODE_NAME.tar.xz"
    else
      echo "[ERROR] curl or wget is required to download Node.js."
      exit 1
    fi
    tar -xJf "$TMP_DIR/node.tar.xz" -C "$RUNTIME_DIR"
    chmod +x "$NODE_BIN"
    rm -rf "$TMP_DIR"
    trap - EXIT
  fi
fi

echo "[2/2] Starting Stage Manager..."
AUTO_OPEN=1 "$NODE_BIN" "$SERVER_JS"
