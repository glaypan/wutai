#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_PARENT="$SCRIPT_DIR/.runtime"
NODE_HOME="$RUNTIME_PARENT/node-v16.20.2-darwin-x64"
NODE_BIN="$NODE_HOME/bin/node"
NODE_ARCHIVE="$SCRIPT_DIR/runtime/node-v16.20.2-darwin-x64.tar.gz"
NODE_SHA256="d7a46eaf2b57ffddeda16ece0d887feb2e31a91ad33f8774da553da0249dc4a6"

cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════════════"
echo "  舞台流程表 - macOS 10.14.6 Intel"
echo "═══════════════════════════════════════════════════"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "[错误] 此安装包仅适用于 Intel Mac (x86_64)。"
  read -r -p "按回车键退出..."
  exit 1
fi

if [ ! -x "$NODE_BIN" ] && command -v node >/dev/null 2>&1 && node -e 'var m=Number(process.versions.node.split(".")[0]); process.exit(m>=16?0:1)' >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
fi

if [ ! -x "$NODE_BIN" ]; then
  echo "[+] 首次运行，正在准备内置 Node.js 16.20.2..."
  if [ ! -f "$NODE_ARCHIVE" ]; then
    echo "[错误] 缺少运行环境文件: runtime/node-v16.20.2-darwin-x64.tar.gz"
    read -r -p "按回车键退出..."
    exit 1
  fi

  if command -v shasum >/dev/null 2>&1; then
    ACTUAL_SHA256="$(shasum -a 256 "$NODE_ARCHIVE" | awk '{print $1}')"
  else
    ACTUAL_SHA256="$(openssl dgst -sha256 "$NODE_ARCHIVE" | awk '{print $NF}')"
  fi
  if [ "$ACTUAL_SHA256" != "$NODE_SHA256" ]; then
    echo "[错误] 内置运行环境校验失败，文件可能损坏。"
    echo "实际 SHA-256: $ACTUAL_SHA256"
    read -r -p "按回车键退出..."
    exit 1
  fi

  mkdir -p "$RUNTIME_PARENT"
  RUNTIME_TEMP="$(mktemp -d "$RUNTIME_PARENT/node-extract.XXXXXX")"
  trap 'rm -rf -- "$RUNTIME_TEMP"' EXIT
  tar -xzf "$NODE_ARCHIVE" -C "$RUNTIME_TEMP"
  if [ -e "$NODE_HOME" ]; then
    mv "$NODE_HOME" "$NODE_HOME.incomplete.$(date +%Y%m%d%H%M%S)"
  fi
  mv "$RUNTIME_TEMP/node-v16.20.2-darwin-x64" "$NODE_HOME"
  chmod +x "$NODE_BIN"
  trap - EXIT
  rm -rf -- "$RUNTIME_TEMP"
  echo "[v] 内置运行环境准备完成"
fi

echo ""
echo "[+] 正在启动服务器..."
echo ""

AUTO_OPEN=1 "$NODE_BIN" "$SCRIPT_DIR/server-standalone.js"
