# 安卓手机做服务器 - 部署指南

## 一、概述

安卓手机通过 Termux 运行 Node.js 服务器，**完全免 root**，可作为舞台流程表的服务器端。

### 三种网络拓扑

```
拓扑A: 手机 + 设备连同一WiFi（最简单，推荐）
┌─────────┐         ┌──────────┐
│ 手机     │←─WiFi──→│ 路由器    │←─WiFi─→ iPad/电脑
│(Termux)  │         │          │
└─────────┘         └──────────┘

拓扑B: 手机USB共享 → 路由器 → 设备
┌─────────┐  USB    ┌──────────┐  WiFi  ┌──────┐
│ 手机     │─共享──→│ 路由器    │───────→│设备   │
│(Termux)  │         │(USB WAN) │        │(浏览器)│
└─────────┘         └──────────┘        └──────┘

拓扑C: 手机热点 → 设备直连
┌─────────┐  热点   ┌──────┐
│ 手机     │───────→│设备   │
│(Termux)  │         │(浏览器)│
└─────────┘         └──────┘
```

---

## 二、安装步骤

### 步骤1: 安装 Termux

**⚠️ 不要从 Google Play 安装**（版本过旧），从以下渠道之一安装：

- **F-Droid**（推荐）：https://f-droid.org/packages/com.termux/
- **GitHub Releases**：https://github.com/termux/termux/releases

### 步骤2: 安装 Node.js 和服务器

打开 Termux，执行：

```bash
# 方式1: 一键脚本（推荐）
# 将 stage-manager-android.sh 传输到手机后执行
bash stage-manager-android.sh

# 方式2: 手动安装
pkg update && pkg upgrade -y
pkg install -y nodejs-lts
mkdir -p ~/stage-manager && cd ~/stage-manager

# 下载服务器文件
curl -L -o server.js "https://raw.githubusercontent.com/glaypan/wutai/main/server.js"
curl -L -o "舞台流程表.html" "https://raw.githubusercontent.com/glaypan/wutai/main/舞台流程表.html"
npm install ws

# 启动
node server.js
```

### 步骤3: 必须的设置（防止被杀）

| 设置项 | 操作 |
|--------|------|
| 电池优化 | 设置 → 应用 → Termux → 电池 → **不受限** |
| 自启动 | 设置 → 应用 → Termux → **允许自启动** |
| 后台锁定 | 最近任务列表 → 锁定 Termux |
| 唤醒锁 | Termux 内执行 `termux-wake-lock` |

### 步骤4: 开机自启（可选）

1. 安装 **Termux:Boot**（F-Droid: https://f-droid.org/packages/com.termux.boot/）
2. 点开一次 Termux:Boot 图标激活
3. 在 Termux 中执行：

```bash
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-stage-manager <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd ~/stage-manager
export PORT=3000
node server.js >> ~/stage-manager/server.log 2>&1
EOF
chmod +x ~/.termux/boot/start-stage-manager
```

---

## 三、网络连接方式

### 方式A: 同一WiFi（推荐，最简单）

1. 手机和 iPad/电脑 连同一个 WiFi
2. 在 Termux 中查看手机 IP：

```bash
ip addr show wlan0 | grep 'inet '
# 输出示例: inet 192.168.1.105/24
```

3. 其他设备浏览器访问 `http://192.168.1.105:3000`
4. 或用 HTML 文件打开，点击连接状态栏输入 IP

### 方式B: USB共享网络到路由器

适用于路由器没有外网、用手机流量的场景。

#### 手机端设置

1. 手机用 USB 线连接路由器的 USB 口
2. 手机设置 → 网络 → USB 网络共享 → **开启**
3. 手机 USB 网络的 IP 通常为 `192.168.42.1`

#### 路由器端设置（关键！）

USB 共享会产生 NAT，路由器 LAN 设备默认**无法直接访问**手机。需要在路由器设置**端口转发**：

| 协议 | WAN端口 | 转发到 | 说明 |
|------|--------|--------|------|
| TCP | 3000 | 192.168.42.1:3000 | 舞台流程表 |

以 OpenWrt 为例：
```bash
# SSH 到路由器
uci add firewall redirect
uci set firewall.@redirect[-1].src='wan'
uci set firewall.@redirect[-1].src_dport='3000'
uci set firewall.@redirect[-1].dest_ip='192.168.42.1'
uci set firewall.@redirect[-1].dest_port='3000'
uci set firewall.@redirect[-1].proto='tcp'
uci set firewall.@redirect[-1].target='DNAT'
uci commit firewall
/etc/init.d/firewall restart
```

普通路由器：登录管理页面 → 端口转发/虚拟服务器 → 添加规则。

设置后，LAN 设备访问 `http://路由器WAN_IP:3000` 即可转发到手机。

### 方式C: 手机热点直连（最简单，无需路由器）

1. 手机开启移动热点
2. iPad/电脑连接手机热点
3. Termux 中查看 IP：

```bash
ip addr show wlan0 | grep 'inet '  # 或 swlan0
# 通常为 192.168.43.1
```

4. 设备直接访问 `http://192.168.43.1:3000`

**优点**：无需路由器，无需端口转发
**缺点**：消耗手机流量，设备数量受热点限制

---

## 四、常见问题

### Q: 其他设备连不上服务器？

检查清单：
- [ ] Termux 中服务器正在运行（显示 IP 地址）
- [ ] 手机和设备在同一网络
- [ ] 手机防火墙未拦截（Termux 默认不拦截）
- [ ] 电池优化已关闭
- [ ] 端口号正确（默认 3000）

### Q: 锁屏后服务器断开？

```bash
# 在 Termux 中执行
termux-wake-lock
```

### Q: USB共享后路由器设备访问不到？

需要设置路由器端口转发（见上方方式B），因为 USB 共享有 NAT。

### Q: 手机流量消耗大吗？

舞台流程表服务器仅传输文本数据（节目单状态），每小时约 1-5MB，流量消耗极小。

### Q: 可以同时用手机做服务器又做控制端吗？

可以！手机用 Termux 运行服务器，同时用手机浏览器打开 `http://localhost:3000` 做控制端。
