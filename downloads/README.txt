舞台流程表 v4.0 - 全平台安装包
============================================

【安装包列表】
  stage-manager-win.bat           Windows (x64)
  stage-manager-macos-intel.command  macOS Intel 芯片
  stage-manager-macos-arm64.command  macOS M系列芯片 (Apple Silicon)
  stage-manager-linux.sh          Linux (x64/ARMv7/ARM64 - 含树莓派)
  stage-manager-termux.sh         Android (需安装 Termux)
  stage-manager-openwrt.sh        OpenWrt 路由器

【各平台使用方法】

1. Windows
   - 双击 stage-manager-win.bat
   - 首次运行会自动下载 Node.js（约30秒）
   - 服务器启动后自动打开浏览器

2. macOS (Intel)
   - 双击 stage-manager-macos-intel.command
   - 若提示安全限制：右键 → 打开 → 确认打开
   - 首次运行会自动下载 Node.js

3. macOS (M系列芯片)
   - 双击 stage-manager-macos-arm64.command
   - 若提示安全限制：右键 → 打开 → 确认打开
   - 首次运行会自动下载 Node.js

4. Linux / 树莓派
   - 终端执行: bash stage-manager-linux.sh
   - 自动检测架构 (x64/ARMv7/ARM64)
   - 自动下载对应版本的 Node.js
   - 树莓派需确保有网络连接

5. Android (Termux)
   - 先安装 Termux: https://f-droid.org/packages/com.termux/
   - 将 stage-manager-termux.sh 传入手机
   - 在 Termux 中执行: bash stage-manager-termux.sh
   - 自动通过 pkg 安装 Node.js

6. OpenWrt 路由器
   - 通过 SSH 上传 stage-manager-openwrt.sh 到路由器
   - 执行: sh stage-manager-openwrt.sh
   - 需要至少 80MB 可用存储空间
   - 自动通过 opkg 安装 Node.js
   - 若存储不足，建议外接U盘

【iOS / Android 浏览器端 (PWA)】
  无需安装包！服务器启动后：
  - iOS: Safari 打开服务器地址 → 分享 → 添加到主屏幕
  - Android: Chrome 打开服务器地址 → 菜单 → 安装应用
  - 安装后可像原生App一样全屏使用

【浏览器端】
  任何现代浏览器打开服务器地址即可使用
  支持角色: 控制端/导演端/助理端/幕后端/提示屏

【特性】
  - 完全离线运行，无需互联网
  - 内嵌 PDF.js 解析库（支持文本型和图片型PDF）
  - 内嵌 Tesseract.js OCR 引擎（支持中英文识别）
  - WebSocket 实时同步
  - 端口冲突自动处理
  - PWA 可安装到手机桌面
