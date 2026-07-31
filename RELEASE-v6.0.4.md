# 舞台流程表 v6.0.4

## 新增与改进

本版本落实 v6.0.3 优化报告中的全部中期改进建议（见 `OPTIMIZATION-REPORT-v6.0.3.md` 第八章），在不改变对外行为与兼容性承诺的前提下完成代码可维护性升级：

- **HTML 外部化**：`server-standalone.js` 启动时通过 `fs.readFileSync` 从同目录 `app-source.html` 读取 HTML，不再内嵌 `__HTML_B64` base64 字符串。原 `__HTML_B64` 行作为死代码保留，工具脚本不再生成或校验它。
- **`/vendor/` 路由缓存**：新增 `vendorFileCache`，套用与 `/tess/` 路由相同的 `{headers, data}` 内存缓存模式，消除第三方库热路径重复磁盘 I/O。
- **`commitState()` 抽取**：将 `saveState(); broadcastFullState();` 重复模式（约 15 处）收敛为统一函数，降低拼写遗漏与漏广播风险。
- **共享服务器模块**：新增 `lib/server-shared.js`，抽取 `server.js` 与 `server-standalone.js` 中完全相同的 `MIME` 类型表、`sendTo` / `sendError`，并通过 `createBroadcasters(options)` 工厂注入两文件的服务器拓扑差异（单一 `wss` vs 多 `WebSocketServer`、是否携带 `cueTriggeredIds`）。
- **启动脚本一致性**：
  - `启动-macOS-Intel.command` 的 Node 版本从 16.20.2 升级到 20.18.1，与其他平台对齐。
  - `启动-macOS-ARM.command` 补充 Node 运行时 SHA-256 校验，与 Intel 版对齐。
  - `启动-OpenWrt.sh` 补充 Node 版本下限检查（≥16）。
- **工具链更新**：`scripts/embed-app-source.js`、`scripts/verify-release.js`、`build-package.js` 同步为校验“HTML 运行时外部化”契约，不再要求内嵌 base64 blob。

## 安装

从 GitHub Release 下载 `stage-manager-v6.0.4-all-platforms.zip` 或 `.tar.gz`，完整解压后运行对应平台启动脚本。安装包不包含 `show.json`、`config.json` 等现场数据。

## 升级

1. 备份旧版本目录中的 `show.json`、`show.json.bak` 和 `config.json`。
2. 将 v6.0.4 解压到新目录并先启动一次。
3. 停止服务器，再按需迁移自己的数据文件。
4. 启动后检查节目、角色权限、端口、OCR 状态和 Cue 设置。

不要把新版本文件直接混合覆盖到正在运行的旧目录。

## 兼容平台

- Windows 10/11
- macOS 10.14.6 及更高版本，Intel 与 Apple Silicon
- Linux、树莓派、OpenWrt
- Android Termux
- iPhone、iPad、Android 手机和平板网页端

## 校验

Release 页面提供 `SHA256SUMS.txt` 及各压缩包的 `.sha256` 文件。下载后应先核对哈希，再用于正式演出环境。

## 行为与兼容性说明

- **对外行为零变化**：HTTP 路由、WebSocket 消息 `type` 字段、JSON 字段名、`stage-core.js` 导出的 21 项 API 均未变化。
- **ES5 兼容**：`lib/server-shared.js` 与 `stage-core.js` 仍使用 `var` / `function` / `.forEach(function(){})` 写法，兼容 Safari 14 / 旧 V8。
- **单文件离线分发约束**：`server-standalone.js` 现依赖同目录的 `app-source.html` 与 `lib/server-shared.js`；安装包内已包含这两个文件，离线运行不受影响。

## 修改文件清单

| 文件 | 修改类型 | 摘要 |
|---|---|---|
| `server-standalone.js` | 重构 | HTML 外部化（`HTML_CONTENT`）；新增 `vendorFileCache`；抽取 `commitState()`；改用 `lib/server-shared.js` |
| `server.js` | 重构 | 抽取 `commitState()`；改用 `lib/server-shared.js`（`createBroadcasters` 注入拓扑） |
| `lib/server-shared.js` | 新增 | 共享 `MIME` / `sendTo` / `sendError` / `createBroadcasters` 工厂 |
| `scripts/embed-app-source.js` | 优化 | 改为校验外部化契约，不再生成 base64 blob |
| `scripts/verify-release.js` | 优化 | 校验 `HTML_CONTENT` 运行时读取，移除 base64 字节比对 |
| `build-package.js` | 优化 | 不再生成 `__HTML_B64`，改为直接复制 `app-source.html` 到输出目录 |
| `启动-macOS-Intel.command` | 修复 | Node 版本 16.20.2 → 20.18.1，对齐其他平台 |
| `启动-macOS-ARM.command` | 修复 | 补充 Node 运行时 SHA-256 校验 |
| `启动-OpenWrt.sh` | 修复 | 补充 Node 版本下限检查（≥16） |
| `package.json` / `README.md` | 维护 | 版本号更新到 6.0.4 |

## 发布前必做（运行时补验）

本次开发机 PowerShell ExecutionPolicy=Restricted 阻断 `RunCommand`（trae-agent-toolhost 将命令包装为 `.ps1` 后被系统策略拒绝加载），因此以下步骤需手动执行。

### 1. 解除 PowerShell 限制

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
```

### 2. 运行测试与校验

```powershell
npm test
npm run verify
```

- `npm test` 执行 4 个测试文件：`stage-core` / `source-contract` / `server-contract` / `browser-workflows`（后者需 playwright 与 Chrome）。
- `npm run verify` 即 `node scripts/verify-release.js`，校验外部化 HTML 契约、6 个启动脚本、10 个 tess 资源、源契约关键词等。

### 3. 生成发布包

```powershell
npm run package -- --out dist
```

`scripts/package-release.js` 会：

1. 在 `dist/` 下创建 `stage-manager-v6.0.4/` 文件夹，复制以下内容：
   - 代码：`app-source.html`、`server-standalone.js`、`stage-core.js`、`lib/`
   - 文档：`README.md`、`RELEASE-v6.0.4.md`、`使用说明.txt`
   - 启动脚本：`启动-Windows.bat`、`启动-macOS-Intel.command`、`启动-macOS-ARM.command`、`启动-Linux.sh`、`启动-OpenWrt.sh`、`启动-Termux.sh`
   - 资源：`tess/`（10 个文件）、`vendor/`（3 个文件）、`media/使用说明.txt`
2. 校验无禁止条目（`config.json`、`show.json`、`node_modules`、`scripts`、`tests` 等不得入包）。
3. 生成 `stage-manager-v6.0.4-all-platforms.zip`、`.tar.gz` 及各自的 `.sha256`，汇总为 `dist/SHA256SUMS.txt`。

### 4. 端到端冒烟

在 Windows / macOS / iOS / Android 真机或模拟器上启动并验证：节目增删、角色权限、端口、OCR 状态、Cue 设置。

### 5. Git 提交、打标签并推送

```powershell
git add -A
git commit -m "release: v6.0.4 - HTML 外部化、vendor 缓存、commitState 抽取、共享服务器模块"
git tag v6.0.4
git push origin main --tags
```

### 6. 创建 GitHub Release

将 `dist/` 下生成的 `stage-manager-v6.0.4-all-platforms.zip`、`.tar.gz`、`.sha256`、`SHA256SUMS.txt` 上传到 GitHub Release `v6.0.4`，Release 说明引用本文件。
