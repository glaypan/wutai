# Stage Manager（舞台流程表）

全平台离线舞台流程与 Cue 管理系统，婚礼/演出/年会现场多设备协作。

## 版本

- `舞台流程表-v6.2.0-安装包/stage-manager`：正式版（当前最新）
- `舞台流程表-v6.1.0-安装包/stage-manager`：上一版
- `舞台流程表-v6.0.7-安装包/stage-manager`：历史正式版
- `舞台流程表-v6.0.7beta-design-安装包/stage-manager`：beta-design 版（增强视觉反馈）

## v6.2.0 更新内容

1. **Tally 信号系统增强**：自动 Tally（GO 后自动预告下一节目）/ 实时 Tally 面板 / 节目卡片闪烁 / Tally 设置 UI / 多角色发送
2. **HTTPS 与反向代理**：云服务器 Nginx + Let's Encrypt 教程 + Mac Caddy 自签 HTTPS
3. 连接状态显示同步时间

详见 `舞台流程表-v6.2.0-安装包/stage-manager/CHANGELOG.md`

## v6.1.0 更新内容

1. 节目列表独立滚动（提示卡片不随列表滚动）
2. 手机端悬浮隐藏/显示列表按钮（各客户端通用）
3. 各客户端可切换控制端
4. 提示屏 18091 502 修复
5. 端口绑定 0.0.0.0

## 快速启动

进入 `舞台流程表-v6.2.0-安装包/stage-manager` 目录：

```bash
cp config.example.json config.json
cp show.example.json show.json
npm install
node server-standalone.js
```

或使用 `启动-Linux.sh`（自动下载 Node，免安装）。

## 端口

| 端口 | 用途 |
|------|------|
| 18088 | 入口页（角色选择） |
| 18089 | 控制端（导演/控台） |
| 18090 | 客户端（助理/幕后） |
| 18091 | 提示屏（大屏显示） |

## 部署

- 云服务器部署：`docs/云服务器部署教程.md`
- HTTPS 与反向代理：`docs/HTTPS与反向代理教程.md`
- 安卓手机（Termux）：`android-files/` + `安卓手机安装说明.md`
- 桌面 Mac/Windows：直接 `node server-standalone.js`

## Release 下载

- v6.2.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.2.0/wutai-server.zip
- v6.1.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.1.0/wutai-server.zip
- 安卓安装文件包：https://github.com/glaypan/wutai/releases/download/android-files-v1/termux.apk 等
