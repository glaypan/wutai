# 舞台流程表 - 系统适配性报告

## 一、macOS 兼容性（最低 macOS 10.14 Mojave）

### 1.1 已验证兼容项

| 项目 | 状态 | 说明 |
|------|------|------|
| Safari 14+ | ✅ | 使用 legacy 构建的 pdf.js 和 mammoth.js，兼容 Safari 14 |
| CSS 变量 | ✅ | Safari 11+ 支持，10.14 自带 Safari 14 |
| Flexbox/Grid | ✅ | Safari 11+ 完全支持 |
| WebSocket API | ✅ | Safari 7+ 原生支持 |
| localStorage | ✅ | Safari 4+ 支持 |
| ES5 兼容写法 | ✅ | 全程使用 var/function，避免 let/const/箭头函数 |
| File API | ✅ | Safari 11+ 支持 FileReader |
| Drag & Drop | ✅ | Safari 11+ 支持 |
| .command 脚本 | ✅ | bash 脚本，macOS 10.14 自带 bash 3.2 |

### 1.2 macOS 安装脚本兼容性

| macOS 版本 | 架构 | Node.js 下载 | base64 解码 | 兼容性 |
|-----------|------|-------------|------------|--------|
| 10.14 Mojave | Intel x64 | ✅ tar.gz | ✅ node -e | ✅ |
| 10.15 Catalina | Intel x64 | ✅ tar.gz | ✅ node -e | ✅ |
| 11 Big Sur | Intel x64 / ARM | ✅ tar.gz | ✅ node -e | ✅ |
| 12 Monterey | Intel x64 / ARM | ✅ tar.gz | ✅ node -e | ✅ |
| 13 Ventura | Intel x64 / ARM | ✅ tar.gz | ✅ node -e | ✅ |
| 14 Sonoma | Intel x64 / ARM | ✅ tar.gz | ✅ node -e | ✅ |
| 15 Sequoia | ARM | ✅ tar.gz | ✅ node -e | ✅ |

**关键设计**：
- 使用 `node -e` 解码 base64（不依赖系统 `base64` 命令的 `-D`/`--decode` 参数差异）
- 自动检测架构（`uname -m`），下载对应的 Node.js
- 自动安装 Node.js 到 `~/.local/stage-manager-nodejs`，不影响系统环境

### 1.3 注意事项

- macOS 10.14 的 Gatekeeper 可能拦截 `.command` 文件
  - 解决：右键点击 → 选择「打开」→ 确认打开
- 首次运行需在终端执行：`chmod +x stage-manager-macos-*.command`

---

## 二、Windows 兼容性

| Windows 版本 | 架构 | 兼容性 | 说明 |
|-------------|------|--------|------|
| Windows 10 | x64 | ✅ | 需内置 curl（1803+）或 tar |
| Windows 11 | x64/ARM | ✅ | 完全兼容 |
| Windows 8.1 | x64 | ⚠️ | 需手动安装 Node.js（无 curl） |
| Windows 7 | x64 | ⚠️ | 需手动安装 Node.js（无 curl） |

**关键设计**：
- 使用 `node -e` 解码 base64（不依赖 PowerShell）
- 使用 `curl` 下载 Node.js（Windows 10 1803+ 自带）
- 使用 `tar` 解压 zip（Windows 10 1803+ 自带）

---

## 三、OpenWrt 路由器部署可行性分析

### 3.1 结论：**有条件可行**

### 3.2 硬件要求

| 要求 | 最低 | 推荐 |
|------|------|------|
| CPU 架构 | ARM64 (aarch64) 或 x86_64 | ARM64 |
| 内存 (RAM) | 256MB | 512MB+ |
| 存储 (Flash) | 32MB + USB extroot | 128MB+ |
| CPU 频率 | 1GHz | 1.5GHz+ |

### 3.3 架构支持详情

| 架构 | 支持情况 | 说明 |
|------|---------|------|
| **aarch64 (ARM64)** | ✅ 完全支持 | 如 MT7988、IPQ8074、GL.iNet MT-6000 |
| **arm (ARMv7+)** | ✅ 支持（需硬件 FPU/VFP） | 需带 NEON/VFP 的 ARM 核心 |
| **x86_64** | ✅ 完全支持 | 软路由/x86 路由器 |
| **mipsel / mips** | ❌ 不支持 | V8 引擎需要硬件 FPU，MT7621 等无法运行 |

### 3.4 可行的路由器型号示例

| 路由器 | 架构 | 内存 | 可行性 |
|--------|------|------|--------|
| GL.iNet MT-6000 | ARM64 | 1GB | ✅ 推荐 |
| 小米 AX6S | ARM | 256MB | ✅ 可行 |
| 红米 AX6000 | ARM64 | 512MB | ✅ 推荐 |
| 友善 NanoPi R4S | ARM64 | 1GB/4GB | ✅ 推荐 |
| 新路由3 (MT7621) | MIPS | 256MB | ❌ 不支持 |
| 普通百元路由器 | MIPS | 64-128MB | ❌ 不支持 |

### 3.5 部署步骤（ARM64/x86 路由器）

```bash
# 1. 安装 Node.js
opkg update
opkg install node npm

# 2. 上传 server.js 和 舞台流程表.html 到路由器
scp server.js root@192.168.1.1:/root/stage-manager/
scp 舞台流程表.html root@192.168.1.1:/root/stage-manager/

# 3. 安装 ws 模块
cd /root/stage-manager
npm install ws

# 4. 启动（限制内存防止 OOM）
node --max-old-space-size=128 --optimize_for_size server.js

# 5. 设置开机自启
# /etc/init.d/stage-manager
```

### 3.6 OpenWrt 限制说明

1. **WebSocket 长连接**：ws 模块可用，但连接数受内存限制（建议 ≤20 个客户端）
2. **CGI 模式不可用**：BusyBox httpd/uHTTPd 的 CGI 模式不支持 WebSocket 长连接
3. **内存优化**：需使用 `--max-old-space-size=128 --optimize_for_size --gc_interval=100` 参数
4. **存储扩展**：Node.js + 依赖约 200MB，内置 Flash 通常不足，**必须 USB extroot**
5. **稳定性**：建议设置 crontab 每天凌晨重启 Node.js 进程释放内存碎片
6. **MIPS 架构**：完全不可用（V8 引擎依赖硬件 FPU）

### 3.7 替代方案（MIPS 路由器）

如果路由器是 MIPS 架构（如 MT7621），Node.js 无法运行，可考虑：
- **uHTTPd + Lua**：OpenWrt 原生方案，资源占用极低，但需重写 WebSocket 逻辑
- **QuickJS**：超轻量 JS 引擎（~210KB），但需自行实现 WebSocket 库
- **外接设备**：用树莓派/旧手机作为服务器，路由器仅提供网络

---

## 四、跨平台总结

| 平台 | 部署方式 | 难度 | 推荐场景 |
|------|---------|------|---------|
| Windows 10+ | 双击 .bat | ⭐ 简单 | 演出场地主力机 |
| macOS 10.14+ | 双击 .command | ⭐ 简单 | Mac 用户 |
| Linux | node server.js | ⭐ 简单 | 技术用户 |
| OpenWrt ARM64 | 手动部署 | ⭐⭐⭐ 中等 | 固定安装、低功耗常驻 |
| OpenWrt MIPS | 不可行 | ❌ | — |
| 浏览器（离线） | 双击 .html | ⭐ 简单 | 单机使用、无服务器 |
