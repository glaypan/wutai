#!/bin/bash
# 舞台流程表 - 树莓派/Linux 一键安装脚本
# 适用于：树莓派、NanoPi、各种 Linux ARM/x86 设备
# 用法：bash install-rpi.sh

set -e

echo ""
echo "=================================================="
echo "  舞台流程表 - 树莓派/Linux 服务器安装"
echo "=================================================="
echo ""

# 检测系统
ARCH=$(uname -m)
echo "[i] 系统架构: $ARCH"
echo "[i] 操作系统: $(uname -s)"

# 安装目录
INSTALL_DIR="$HOME/stage-manager"
echo "[i] 安装目录: $INSTALL_DIR"

# ---------- 1. 检查/安装 Node.js ----------
if command -v node &> /dev/null; then
  NODE_VER=$(node --version)
  echo "[v] Node.js 已安装: $NODE_VER"
  # 检查版本是否 >= 14
  NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 14 ]; then
    echo "[!] Node.js 版本过低 (需要 v14+)，正在升级..."
    NEED_INSTALL_NODE=true
  fi
else
  echo "[!] 未检测到 Node.js，正在安装..."
  NEED_INSTALL_NODE=true
fi

if [ "$NEED_INSTALL_NODE" = "true" ]; then
  # 树莓派 / Debian / Ubuntu
  if command -v apt-get &> /dev/null; then
    echo "[+] 通过 apt 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
  # CentOS / RHEL / Fedora
  elif command -v yum &> /dev/null; then
    echo "[+] 通过 yum 安装 Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
  # Alpine
  elif command -v apk &> /dev/null; then
    echo "[+] 通过 apk 安装 Node.js..."
    sudo apk add nodejs npm
  # 直接下载二进制
  else
    echo "[+] 下载 Node.js 二进制包..."
    NODE_VERSION="v18.20.4"
    case "$ARCH" in
      armv7l) NODE_ARCH="armv7l" ;;
      aarch64|arm64) NODE_ARCH="arm64" ;;
      x86_64) NODE_ARCH="x64" ;;
      *) echo "[X] 不支持的架构: $ARCH"; exit 1 ;;
    esac
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
    NODE_TAR="/tmp/stage_manager_node.tar.xz"
    NODE_DIR="$HOME/.local/nodejs"
    curl -L --fail "$NODE_URL" -o "$NODE_TAR"
    mkdir -p "$NODE_DIR"
    tar -xJf "$NODE_TAR" -C "$NODE_DIR" --strip-components=1
    export PATH="$NODE_DIR/bin:$PATH"
    echo 'export PATH="$HOME/.local/nodejs/bin:$PATH"' >> "$HOME/.bashrc"
    echo "[v] Node.js 安装完成: $(node --version)"
  fi
fi

# ---------- 2. 创建安装目录 ----------
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ---------- 3. 复制文件 ----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 如果同目录有 server.js，复制过来
if [ -f "$SCRIPT_DIR/server.js" ]; then
  cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
  echo "[v] 已复制 server.js"
fi

# 如果同目录有 舞台流程表.html，复制过来
if [ -f "$SCRIPT_DIR/舞台流程表.html" ]; then
  cp "$SCRIPT_DIR/舞台流程表.html" "$INSTALL_DIR/"
  echo "[v] 已复制 舞台流程表.html"
fi

# 如果同目录有 package.json，复制过来
if [ -f "$SCRIPT_DIR/package.json" ]; then
  cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
  echo "[v] 已复制 package.json"
fi

# 检查必要文件
if [ ! -f "$INSTALL_DIR/server.js" ]; then
  echo "[X] 未找到 server.js，请将本脚本放在项目目录下运行"
  echo "    或从 https://github.com/glaypan/wutai 下载项目文件"
  exit 1
fi

# ---------- 4. 安装依赖 ----------
echo "[+] 安装依赖 (ws 模块)..."
npm install ws 2>/dev/null || npm install --force ws
echo "[v] 依赖安装完成"

# ---------- 5. 设置端口（可选） ----------
DEFAULT_PORT=3000
echo ""
read -p "请输入服务器端口 (默认 3000，直接回车使用默认): " INPUT_PORT
PORT=${INPUT_PORT:-$DEFAULT_PORT}

# ---------- 6. 创建 systemd 服务（可选，开机自启） ----------
echo ""
read -p "是否设置开机自启 (systemd 服务)? (y/N): " SET_AUTOSTART
if [[ "$SET_AUTOSTART" =~ ^[Yy]$ ]]; then
  SERVICE_FILE="/etc/systemd/system/stage-manager.service"
  echo "[+] 创建 systemd 服务..."
  sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Stage Manager WebSocket Server
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) server.js
Environment=PORT=$PORT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable stage-manager
  sudo systemctl start stage-manager
  echo "[v] 开机自启已设置，服务已启动"
  echo "    管理命令:"
  echo "    sudo systemctl start stage-manager    # 启动"
  echo "    sudo systemctl stop stage-manager     # 停止"
  echo "    sudo systemctl restart stage-manager  # 重启"
  echo "    sudo systemctl status stage-manager   # 状态"
  echo "    sudo journalctl -u stage-manager -f   # 查看日志"
else
  # 直接启动
  export PORT=$PORT
  echo ""
  echo "=================================================="
  echo "  安装完成！"
  echo "=================================================="
  echo ""
  echo "  启动命令: cd $INSTALL_DIR && PORT=$PORT node server.js"
  echo ""
  
  # 获取IP
  echo "  本机IP地址:"
  hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^$' | while read ip; do
    echo "    http://$ip:$PORT"
  done
  echo ""
  echo "  其他设备用浏览器访问以上地址即可"
  echo "  手机/iPad 打开 HTML 文件后，点击右上角连接状态"
  echo "  输入服务器IP地址连接"
  echo ""
  
  read -p "是否现在启动服务器? (Y/n): " START_NOW
  if [[ ! "$START_NOW" =~ ^[Nn]$ ]]; then
    cd "$INSTALL_DIR"
    PORT=$PORT node server.js
  fi
fi
