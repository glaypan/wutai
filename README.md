# Stage Manager v6.0.8

本仓库维护舞台流程表正式版与 beta-design 版。两个安装包独立运行，复用实时协议、`stage-core.js` 业务逻辑、认证模型和测试契约；正式版保持紧凑稳定，beta-design 增强视觉反馈。

## 目录

- `舞台流程表-v6.0.7-安装包/stage-manager`：正式版。
- `舞台流程表-v6.0.7beta-design-安装包/stage-manager`：beta-design 版。
- `docs/使用说明与优化建议.md`：部署、登录、运行检查和后续迭代建议。
- `docs/superpowers/specs`：双版本设计规范。
- `docs/superpowers/plans`：已执行的实现计划。

## 快速启动

每个版本独立进入其 `stage-manager` 目录执行：

```powershell
Copy-Item config.example.json config.json
Copy-Item show.example.json show.json
npm install
npm start
```

需要 Node.js `>=18.17`。`config.json` 和 `show.json` 被 Git 忽略，不能提交真实密码哈希、Token、内网地址或演出数据。

启动后打开入口页，选择角色并输入该角色密码。密码仅作为 POST 请求体提交，成功后浏览器保存 12 小时 HttpOnly 会话 Cookie；地址栏只保留 `?role=角色`，不含密码或 Token。

## 验证

```powershell
npm test
node --check server-standalone.js
```

两套安装包均应独立执行以上命令。详见 [使用说明与优化建议](docs/使用说明与优化建议.md)。
