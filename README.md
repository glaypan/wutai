# Stage Manager（舞台流程表）

全平台离线舞台流程与 Cue 管理系统，婚礼/演出/年会现场多设备协作。

## 版本

- `舞台流程表-v6.4.1-安装包/stage-manager`：正式版（当前最新）
- `舞台流程表-v6.2.0-安装包/stage-manager`：上一版
- `舞台流程表-v6.1.0-安装包/stage-manager`：上一版
- `舞台流程表-v6.0.7-安装包/stage-manager`：历史正式版
- `舞台流程表-v6.0.7beta-design-安装包/stage-manager`：beta-design 版（增强视觉反馈）

## v6.4.1 更新内容

1. **幂等增强**：pending 短租约 60s + 容量淘汰只删 done + 严格 token 校验 + ID 强唯一

## v6.4.0 更新内容

1. **模板库**：内置婚礼/年会/演出模板 + 新建向导 + 另存为模板 + 模板管理
2. **防误触**：GO 长按 500ms + 服务端幂等（commandId + reservation token）
3. **UI 美化**：SVG 图标系统 + 角色色/状态色令牌 + 入口页重设计

## v6.3.1 更新内容

1. **自动 Tally 触发修复**：节目预设不触发的根因修复（老数据无 id 兼容）+ 去重误拦截修复
2. **手机端优化**：单屏舞台（列表抽屉化）/ Tally 胶囊化 / 弹窗滚动锁定
3. **角色独立端口**：导演 18092 / 助理 18093 / 幕后 18094 / 控台 18095
4. **教程脱敏**：文档不暴露实际外网地址

## v6.3.0 更新内容

1. **项目中心（多场次管理）**：多项目独立存档 / 新建 / 复制 / 重命名 / 归档 / 删除 / 搜索 / 项目另存为（.stageproject 工程包）
2. **Tally 信号系统增强**：节目单 Tally 预设（每节目独立配置）/ 多 Tally 共存 / 全屏闪光边框（角色专属颜色）/ 未确认持续提醒 / 倒计时预警 / 横幅自由拖动缩放
3. **角色独立端口**：导演端 18092 / 助理端 18093 / 幕后端 18094 / 控台端 18095，入口页选角色自动跳转
4. **修复与加固**：claude 代码审查修复（项目数据安全、Tally 判空、定时器防重等）

详见 `舞台流程表-v6.3.0-安装包/stage-manager/CHANGELOG.md`

## v6.2.0 更新内容

1. **Tally 信号系统增强**：自动 Tally（GO 后自动预告下一节目）/ 实时 Tally 面板 / 节目卡片闪烁 / Tally 设置 UI / 多角色发送
2. **HTTPS 与反向代理**：云服务器 Nginx + Let's Encrypt 教程 + Mac Caddy 自签 HTTPS
3. 连接状态显示同步时间

## v6.1.0 更新内容

1. 节目列表独立滚动（提示卡片不随列表滚动）
2. 手机端悬浮隐藏/显示列表按钮（各客户端通用）
3. 各客户端可切换控制端
4. 提示屏 18091 502 修复
5. 端口绑定 0.0.0.0

## 快速启动

进入 `舞台流程表-v6.3.0-安装包/stage-manager` 目录：

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
| 18088 | 入口页（选角色自动跳转） |
| 18089 | 控制端 |
| 18090 | 客户端（通用） |
| 18091 | 提示屏（大屏显示） |
| 18092 | 导演端 |
| 18093 | 助理端 |
| 18094 | 幕后端 |
| 18095 | 控台端 |

## 部署

- 云服务器部署：`docs/云服务器部署教程.md`
- HTTPS 与反向代理：`docs/HTTPS与反向代理教程.md`
- 安卓手机（Termux）：`android-files/` + `安卓手机安装说明.md`
- 桌面 Mac/Windows：直接 `node server-standalone.js`

## Release 下载

- v6.4.1：https://github.com/glaypan/wutai/releases/download/wutai-v6.4.1/wutai-server.zip
- v6.4.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.4.0/wutai-server.zip
- v6.3.1：https://github.com/glaypan/wutai/releases/download/wutai-v6.3.1/wutai-server.zip
- v6.3.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.3.0/wutai-server.zip
- v6.2.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.2.0/wutai-server.zip
- v6.1.0：https://github.com/glaypan/wutai/releases/download/wutai-v6.1.0/wutai-server.zip
- 安卓安装文件包：https://github.com/glaypan/wutai/releases/download/android-files-v1/termux.apk 等
