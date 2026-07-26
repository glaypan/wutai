#!/data/data/com.termux/files/usr/bin/bash
# 舞台流程表 - 安卓手机 Termux 一键安装脚本
# 用法：在 Termux 中执行 bash install-android.sh
# 全程免 root
# 自动识别脚本所在目录，支持中文文件夹名

set -e

echo ""
echo "=================================================="
echo "  舞台流程表 - 安卓手机服务器安装"
echo "  (基于 Termux，免 root)"
echo "=================================================="
echo ""

# ---------- 自动识别脚本所在目录 ----------
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "[i] 脚本所在目录: $SCRIPT_DIR"

# 安装目录：脚本所在目录下的 stage-manager 子目录
INSTALL_DIR="$SCRIPT_DIR/stage-manager"
echo "[i] 工作目录: $INSTALL_DIR"

# ---------- 1. 更新系统 ----------
echo "[1/6] 更新 Termux 软件源..."
pkg update -y && pkg upgrade -y -o Dpkg::Options::="--force-confold"

# ---------- 2. 安装 Node.js ----------
echo ""
echo "[2/6] 安装 Node.js LTS..."
pkg install -y nodejs-lts
echo "[v] Node.js 版本: $(node --version)"

# ---------- 3. 安装依赖 ----------
echo ""
echo "[3/6] 安装必要工具..."
pkg install -y git curl termux-api

# ---------- 4. 创建项目目录 ----------
echo ""
echo "[4/6] 创建项目目录: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# ---------- 5. 下载/复制文件 ----------
# 检查是否有同目录的文件（用户从项目目录运行）
if [ -f "$SCRIPT_DIR/server.js" ]; then
  cp "$SCRIPT_DIR/server.js" "$INSTALL_DIR/"
  echo "[v] 已复制 server.js"
else
  # 从 GitHub 下载
  echo "[+] 从 GitHub 下载项目文件..."
  curl -L --fail -o server.js "https://raw.githubusercontent.com/glaypan/wutai/main/server.js" || {
    echo "[X] 无法下载 server.js"
    echo "    请将本脚本放在项目目录下运行"
    echo "    或检查网络连接"
    exit 1
  }
  curl -L --fail -o "舞台流程表.html" "https://raw.githubusercontent.com/glaypan/wutai/main/舞台流程表.html" || echo "[!] 下载 HTML 文件失败，跳过"
  curl -L --fail -o package.json "https://raw.githubusercontent.com/glaypan/wutai/main/package.json" || echo "[!] 下载 package.json 失败，跳过"
fi

# 安装 ws 依赖
echo "[+] 安装 ws 依赖..."
npm install ws
echo "[v] 依赖安装完成"

# ---------- 6. 设置端口 ----------
DEFAULT_PORT=3000
echo ""
read -p "请输入服务器端口 (默认 3000): " INPUT_PORT
PORT=${INPUT_PORT:-$DEFAULT_PORT}

# ---------- 获取唤醒锁 ----------
echo ""
echo "[5/6] 获取唤醒锁（防止手机休眠杀进程）..."
termux-wake-lock 2>/dev/null || echo "[!] termux-wake-lock 不可用，请手动安装 termux-api"

# ---------- 设置开机自启 ----------
echo ""
echo "[6/6] 开机自启设置..."
echo "  开机自启需要 Termux:Boot 插件"
echo "  请从 F-Droid 下载安装: Termux:Boot"
echo "  安装后点开一次 Termux:Boot 图标激活"
echo ""

read -p "是否创建开机自启脚本? (Y/n): " SET_BOOT
if [[ ! "$SET_BOOT" =~ ^[Nn]$ ]]; then
  mkdir -p "$HOME/.termux/boot"
  cat > "$HOME/.termux/boot/start-stage-manager" <<BEOF
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd "$INSTALL_DIR"
export PORT=$PORT
node server.js >> "$INSTALL_DIR/server.log" 2>&1
BEOF
  chmod +x "$HOME/.termux/boot/start-stage-manager"
  echo "[v] 开机自启脚本已创建"
  echo "    路径: ~/.termux/boot/start-stage-manager"
  echo ""
  echo "  注意: 必须安装 Termux:Boot 并点开一次才生效"
  echo "  下载: https://f-droid.org/packages/com.termux.boot/"
fi

# ---------- 显示网络信息 ----------
echo ""
echo "=================================================="
echo "  ✅ 安装完成！"
echo "=================================================="
echo ""
echo "  工作目录: $INSTALL_DIR"
echo "  服务器端口: $PORT"
echo ""
echo "  --- 网络连接方式 ---"
echo ""
echo "  方式1: 手机和设备连同一WiFi（最简单）"
echo "  ┌─────────┐         ┌──────────┐"
echo "  │ 手机     │←─WiFi──→│ 路由器    │"
echo "  │(Termux)  │         │          │"
echo "  └─────────┘         └────┬─────┘"
echo "                           │ WiFi"
echo "                    ┌──────┼──────┐"
echo "                    │      │      │"
echo "                 手机/iPad/电脑(浏览器)"
echo ""

# 获取手机WiFi IP
WIFI_IP=$(ip addr show wlan0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -1)
if [ -n "$WIFI_IP" ]; then
  echo "  📱 手机 WiFi IP: $WIFI_IP"
  echo "  其他设备浏览器访问: http://$WIFI_IP:$PORT"
fi

echo ""
echo "  方式2: USB共享网络到路由器"
echo "  ┌─────────┐  USB    ┌──────────┐  WiFi  ┌──────┐"
echo "  │ 手机     │─共享──→│ 路由器    │───────→│设备   │"
echo "  │(Termux)  │         │(USB WAN) │        │(浏览器)│"
echo "  └─────────┘         └──────────┘        └──────┘"
echo ""
echo "  USB共享IP通常为: 192.168.42.1"
echo "  需在路由器设置端口转发: WAN端口 → 192.168.42.1:$PORT"
echo ""

# 获取USB网络IP
USB_IP=$(ip addr show usb0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1 | head -1)
if [ -n "$USB_IP" ]; then
  echo "  📱 手机 USB IP: $USB_IP"
fi

echo ""
echo "  --- 重要设置 ---"
echo ""
echo "  1. 关闭电池优化: 设置→应用→Termux→电池→不受限"
echo "  2. 允许后台运行: 设置→应用→Termux→自启动→允许"
echo "  3. 锁定后台: 最近任务里锁定Termux"
echo ""
echo "  --- 启动命令 ---"
echo "  cd \"$INSTALL_DIR\" && PORT=$PORT node server.js"
echo ""
echo "  --- 查看日志 ---"
echo "  cat \"$INSTALL_DIR/server.log\""
echo ""

read -p "是否现在启动服务器? (Y/n): " START_NOW
if [[ ! "$START_NOW" =~ ^[Nn]$ ]]; then
  cd "$INSTALL_DIR"
  PORT=$PORT node server.js
fi
