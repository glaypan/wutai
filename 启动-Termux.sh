#!/data/data/com.termux/files/usr/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_JS="$SCRIPT_DIR/server-standalone.js"

cd "$SCRIPT_DIR"

if [ ! -f "$SERVER_JS" ]; then
  echo "[ERROR] server-standalone.js was not found next to this launcher."
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! node -e 'var m=Number(process.versions.node.split(".")[0]); process.exit(m>=16?0:1)' >/dev/null 2>&1; then
  if command -v pkg >/dev/null 2>&1; then
    echo "[1/2] Installing Node.js with Termux pkg..."
    pkg install -y nodejs-lts
  else
    echo "[ERROR] Termux pkg was not found. Install Node.js manually and run this launcher again."
    exit 1
  fi
fi

echo "[2/2] Starting Stage Manager..."
echo "If Android does not open the browser automatically, copy the control URL printed below."
AUTO_OPEN=1 node "$SERVER_JS"
