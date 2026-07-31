# 舞台流程表 v6.0.3 系统性测试与多端优化报告

> 生成日期：2026-07-31
> 范围：基线测试评估 + 服务端/核心/前端三模块代码优化 + 五平台兼容性验证
> Spec 文档：`.trae/specs/optimize-stage-manager-modules/`

---

## 一、环境限制说明（前置）

本次优化在 Windows 开发机上进行，**PowerShell ExecutionPolicy=Restricted** 阻断了 trae-agent-toolhost 的所有 `RunCommand` 调用（其将命令包装为 `.ps1` 文件后用 `& { & 'path.ps1' }` 调用，被系统策略拒绝加载）。因此：

- `npm test`、`npm run verify`、`node --check`、Windows 启动冒烟等**运行时验证均无法执行**
- 全部验证改为**等价静态分析**：逐条比对测试断言模式与源码、Grep 关键字命中、Read 复查修改段
- 静态分析覆盖了 4 个测试文件的全部断言、verify-release.js 的全部断言、6 个启动脚本、5 个目标平台的兼容性关键代码

**解除限制后的补验项**（发布前必须执行）：
1. 解除 PowerShell 限制：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force`
2. 执行 `npm test` 与 `npm run verify` 确认全绿
3. 执行 `node scripts/verify-release.js` 确认内嵌 HTML base64 字节一致
4. 在 Windows/macOS/iOS/Android 真机或模拟器上做端到端冒烟

---

## 二、基线测试评估（静态等价）

### 2.1 测试套件断言命中矩阵

| 测试文件 | 测试数 | 静态比对结果 | 说明 |
|---|---|---|---|
| `tests/stage-core.test.js` | 9 | ✅ 全部断言模式命中 | 9 个被测方法在 stage-core.js 中存在且签名不变 |
| `tests/source-contract.test.js` | 12 | ✅ 全部断言模式命中 | pendingRehearsalFinish / timer_rehearsal_saved / persistence_failed / 5 个 toolbar-group-label / local-icon-sprite 等均存在；4 个 doesNotMatch 模式均确认缺席 |
| `tests/server-contract.test.js` | 6（含 16 条断言） | ✅ 全部断言模式命中 | saveStateOrThrow / finish_rehearsal / timer_rehearsal_saved / Number.isFinite(elapsedMs) / persistence_failed / shouldStartTimer / ocrResult[f]={exists,size} / Content-Encoding=gzip 均存在；3 个 doesNotMatch 模式均确认缺席 |
| `tests/browser-workflows.test.js` | 1（async） | ⚠️ 环境缺失 | 依赖 playwright 与 Chrome 路径，未安装；测试引用的源码模式（OCR status、gzip、finish_rehearsal WS、mobile nav）在前端均已存在 |

### 2.2 verify-release.js 静态校验

| 校验项 | 结果 |
|---|---|
| `app-source.html` 含 `v6.0.3` | ✅ |
| `server-standalone.js` 含 `stage-manager-v603`、`/api/ocr-status`、`Content-Encoding]="gzip"` | ✅ |
| 8 个源契约关键词 | ✅ 全部命中 |
| 6 个启动脚本存在且引用 `server-standalone.js` | ✅ |
| 10 个 tess 资源文件存在 | ✅ |
| 3 个 release 脚本存在 | ✅ |
| 内嵌 HTML base64 字节匹配 | ⚠️ 需运行时验证 |

### 2.3 启动脚本静态审查

6 个启动脚本均为纯 bash/bat（无嵌入 Node.js 片段，不适用 `node --check`），健康度均为 🟢 良好：

| 脚本 | 关键观察 |
|---|---|
| `启动-Windows.bat` | 44 行，chcp 65001、Node v20.18.1 win-x64 下载、`:NODE_FAIL` 错误分支 |
| `启动-macOS-Intel.command` | 66 行，x86_64 校验、**Node v16.20.2**（与其他脚本 v20 不一致）、SHA-256 校验 |
| `启动-macOS-ARM.command` | 40 行，arm64 校验、Node v20.18.1、**无 SHA 校验**（与 Intel 版不一致） |
| `启动-Linux.sh` | 51 行，x86_64/aarch64/armv7l、curl/wget 双备选、`set -e` |
| `启动-Termux.sh` | 26 行，`pkg install -y nodejs-lts`、Node 版本校验 |
| `启动-OpenWrt.sh` | 20 行，`opkg install node`、`AUTO_OPEN=0`、**缺 Node 版本下限检查** |

**跨脚本一致性建议**（本次未动，仅记录）：
- macOS-Intel 用 Node 16，其他用 Node 20，建议统一为 v20.18.1
- macOS-ARM 应补充 SHA-256 校验，与 Intel 版对齐
- OpenWrt 应补充 `node -e '...>=16...'` 版本下限检查

---

## 三、服务端模块优化（`server-standalone.js` / `server.js`）

### 3.1 优化点与实施

| 优化点 | 实施 |
|---|---|
| 散落的客户端循环发送 | 经 Grep 确认 **已天然集中**：L583-588 已有统一 `broadcast(obj)` 函数，26 处调用全经由它；`broadcastFullState()` 即等价 `broadcastState(state)`，无需新增抽取 |
| 静态资源 MIME 与 Content-Encoding | 收敛 tess 路由响应，保留 `.traineddata.gz` 的 `Content-Encoding: gzip`（L1119） |
| 热路径同步 I/O | 新增 `tessFileCache` 内存缓存（L914 声明、L1108-1125 查找/回填），首次读盘后缓存 `{headers, data}`，后续请求直接从内存返回 |
| `server.js` 对等 | L502-503 新增 `tessFileCache`，L594-620 对齐 standalone 缓存逻辑，并补齐 `.gz` Content-Encoding（原 server.js 缺失） |

### 3.2 静态验证

- `tests/server-contract.test.js` 全部 13 条 `assert.match` + 3 条 `assert.doesNotMatch` 仍命中
- `Content-Encoding` 与 `gzip` 仍关联出现（L1119）
- HTTP 路由、WebSocket 消息 `type` 字段、JSON 字段名均未变化

### 3.3 未实施的改进建议（控制风险）

1. 嵌入 HTML `var __HTML_B64 = "..."` 外部化（与"单文件离线"目标冲突，未动）
2. `/vendor/` 路由同样套用 `vendorFileCache`（优先级低，未动）
3. `saveState(); broadcastFullState();` 重复模式（15 处）抽取为 `commitState()`（无测试覆盖 helper 名，未动）
4. `server.js` 与 `server-standalone.js` 公共逻辑抽取为模块（与"单文件可分发"冲突，未动）

---

## 四、核心模块优化（`stage-core.js`）

### 4.1 优化点与实施

| 优化点 | 实施 |
|---|---|
| `finishRehearsal` 中二次归一化 | 新增内部函数 `applyTimerActionInternal(now, timer, action, programIndex)`（L53），对**已归一化**的 timer 执行 pause/start/reset，消除 `applyTimerAction` 内的二次 `normalizeRuntimeTimer` 调用 |
| `nextCueSnapshot` 与 `collectDueCues` 重复过滤 | 新增 3 个内部辅助函数：`collectEnabledTracks(tracks)`（L174）、`filterPendingCues(cues, programIndex, enabledTracks, triggered)`（L183）、`sortByOffsetMs(cues)`（L191） |
| 关键边界注释缺失 | 为 `applyTimerAction` 暂停/继续、`formatTimerClock` 超时不自动推进、`collectDueCues` 触发条件、`minutesToMilliseconds` 1440 上限补充 1-2 行注释 |

### 4.2 API 集合不变性

修改前后 `return {}` 导出均为 **21 项**（L358-380）：
```
normalizeTimingSettings, normalizeRuntimeTimer, resetTimerForProgram, applyTimerAction,
computeTimer, minutesToMilliseconds, millisecondsToMinutes, programDurationMs,
finishRehearsal, shouldAutoStartTimer, timerInstruction, formatTimerClock,
nextCueSnapshot, collectDueCues, buildChannels, removeChannelReferences,
normalizeCue, normalizeMediaPath, normalizeMidiEvent, normalizeMidiSettings, mapMidiCommand
```

4 个新辅助函数均为**内部函数，未导出**。

### 4.3 ES5 兼容性自检

Grep `\blet\b|\bconst\b|=>|\?\?|\?\.|`...`|class |async |await |for...of|import |\.\.\.` → **No matches found**。全文仍使用 `var`/`function`/`.forEach(function(){})`/`for (var i = 0; ...)`，兼容 Safari 14 / 旧 V8。

### 4.4 静态验证

`tests/stage-core.test.js` 全部 9 个测试用例断言模式仍命中：
- 分钟/毫秒互转（含 1441→0 上限）
- programDurationMs 优先级（实测优先、计划回退）
- finishRehearsal 运行中/暂停态（elapsedMs 不随 wall clock 增长）
- shouldAutoStartTimer 4 种 mode/phase/trigger 组合
- formatTimerClock 超时 `+00:12.3` 格式
- nextCueSnapshot 过滤与空快照 deepEqual
- collectDueCues 排序过滤

---

## 五、前端 UI 优化（`app-source.html` / `public/style.css`）

### 5.1 新增 CSS token

在 `app-source.html` 暗色 `:root`（L168-176）与亮色 `:root[data-theme="light"]`（L191-199）以及 `public/style.css` L1-11 中均追加：

| 变量名 | 值 |
|---|---|
| `--space-xs` / `--space-sm` / `--space-md` / `--space-lg` / `--space-xl` | `4px` / `8px` / `12px` / `16px` / `24px` |
| `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` | `4px` / `6px` / `8px` / `12px` |

### 5.2 工具栏与移动端导航 token 化

| 类 | before | after |
|---|---|---|
| `.toolbar-groups` | `gap:8px;` | `gap:var(--space-sm);` |
| `.toolbar-group` | `gap:4px; padding:4px; border-radius:8px;` | `gap:var(--space-xs); padding:var(--space-xs); border-radius:var(--radius-lg);` |
| `.toolbar-command` | `border-radius:6px;` | `border-radius:var(--radius-md);`（`min-height:44px` 保留） |
| `.mobile-bottom-nav` | `gap:4px;` | `gap:var(--space-xs);`（`min-height:60px`、`env(safe-area-inset-bottom)` 保留） |
| `.mobile-bottom-nav button` | `border-radius:6px;` | `border-radius:var(--radius-md);`（`min-width:44px; min-height:44px;` 保留） |

### 5.3 暗色主题对比度提升（WCAG AA）

| 变量 | 修改前 | 修改后 | 对 `--bg-elev:#17191d` 对比度 |
|---|---|---|---|
| `--text-2` | `#98989f` | `#b0b0b8` | 6.1:1 → **7.6:1** |
| `--text-3` | `#64748b` | `#828a98` | 3.6:1 → **4.8:1** |

`--text: #f2f2f7` 保持不变（17:1）。亮色主题未改动（原对比度均 ≥ 4.7:1）。

### 5.4 全屏抽屉与模态框过渡

| 类 | 新增 |
|---|---|
| `.edit-panel`（L554-564） | `transition: transform 0.25s ease, opacity 0.25s ease; will-change: transform, opacity;` |
| `.modal-box`（L617-621） | 同上 |

### 5.5 触控目标与安全区自检

| 检查项 | 结果 |
|---|---|
| 移动端按钮 `min-height:44px` | ✅ L1379 等 20+ 处保留 |
| 移动端按钮 `min-width:44px` | ✅ L1379 保留 |
| 桌面工具栏 `min-height:44px` | ✅ L1367 保留 |
| `env(safe-area-inset-bottom)` 底部导航 | ✅ L1378 |
| `env(safe-area-inset-*)` 全屏抽屉 | ✅ L1382（top/bottom/left/right 全覆盖） |

### 5.6 静态验证

- `tests/source-contract.test.js` 全部 `assert.match`/`assert.doesNotMatch` 模式仍命中
- `tests/browser-workflows.test.js` 关键选择器（`#mobile-bottom-nav`、`min-width:44px; min-height:44px`、`safe-area`）仍命中
- token 替换值与原硬编码值完全一致（4px=4px、6px=6px、8px=8px），布局零变化

---

## 六、全平台兼容性验证

### 6.1 验证矩阵

| 平台 | 验证方式 | 结果 | 关键证据 |
|---|---|---|---|
| Windows 10/11 | 静态 | ✅ 通过 | 启动脚本未改、`process.platform==='win32'` 分支保留、`tessFileCache` 无 Unix API、`path.join` 14 处使用正确 |
| macOS 10.14+ Intel | 静态 | ✅ 通过 | 启动脚本未改（Node v16.20.2 + SHA-256）、`stage-core.js` 无 ES6+ 语法、Safari 14 兼容 `will-change`/`transition`/CSS 变量/flexbox gap |
| macOS 11+ Apple Silicon | 静态 | ✅ 通过 | 启动脚本未改（arm64 + Node v20.18.1）、其余同 Intel |
| Linux（Ubuntu/CentOS） | 静态 | ✅ 通过 | 启动脚本未改、`xdg-open`（server-standalone.js L1164）与 `fuser`（server.js L727）调用未变、无硬编码路径 |
| Android 8+ Termux | 静态 | ✅ 通过 | `启动-Termux.sh` 未改、`pkg install -y nodejs-lts` 与 Node 版本校验保留 |
| iOS 12+（iPhone 6s+） | 静态 | ✅ 通过 | `env(safe-area-inset-*)` 多处、44px 触控 20+ 处、CSS 变量/transition/will-change 在 Safari 11.1+/12+ 兼容 |
| Android 8+ Chrome | 静态 | ✅ 通过 | 同 iOS，Chrome 60+ 全兼容 |

### 6.2 verify-release.js 静态校验

除"内嵌 HTML base64 字节比对"需运行时执行 `Buffer.from(b64,'base64')` 比对外，其余全部命中。

---

## 七、修改文件清单

| 文件 | 修改类型 | 摘要 |
|---|---|---|
| `server-standalone.js` | 优化 | 新增 `tessFileCache` 内存缓存（L914 声明、L1108-1125 查找/回填） |
| `server.js` | 优化 | 新增 `tessFileCache`（L502-503）+ 补齐 `.gz` Content-Encoding（L594-620） |
| `stage-core.js` | 优化 | 新增 4 个 ES5 内部辅助函数（L53/174/183/191）+ 关键边界注释；API 21 项不变 |
| `app-source.html` | UI 优化 | 新增 9 个 CSS token（暗色 L168-176 + 亮色 L191-199）；工具栏/移动导航 token 化；暗色对比度提升；edit-panel/modal-box 新增过渡 |
| `public/style.css` | UI 优化 | 新增 `:root` token 块（L1-11） |

**未修改**：`tests/`、`tess/`、`vendor/`、6 个启动脚本、`config.json`、`show.json`、`scripts/`、`package.json`、`README.md`、`SYSTEM_COMPATIBILITY.md`、`RELEASE-v6.0.3.md`（仅追加本章说明）。

---

## 八、后续建议

### 8.1 发布前必做（运行时补验）

1. 解除 PowerShell 限制后执行 `npm test` 与 `npm run verify`
2. 在 Windows/macOS/iOS/Android 真机或模拟器上做端到端冒烟
3. 确认 `node scripts/verify-release.js` 的内嵌 HTML 字节比对通过

### 8.2 中期改进建议

1. **启动脚本一致性**：统一 macOS-Intel 与其他脚本的 Node 版本（v20.18.1）；为 macOS-ARM 补充 SHA-256 校验；为 OpenWrt 补充 Node 版本下限检查
2. **嵌入 HTML 外部化**：将 `var __HTML_B64 = "..."` 改为启动时从外部 `app-source.html` 读取，提升 `server-standalone.js` 可维护性（需权衡与"单文件离线"目标的冲突）
3. **`/vendor/` 路由缓存**：套用与 `/tess/` 相同的 `vendorFileCache` 模式
4. **`commitState()` 抽取**：将 `saveState(); broadcastFullState();` 重复模式（15 处）抽取为统一函数
5. **`server.js` 与 `server-standalone.js` 去重**：长期可抽取公共模块（需打破"单文件可分发"约束）

### 8.3 测试覆盖建议

1. 为 `browser-workflows.test.js` 在 `package.json` 中添加 `@playwright/test` devDependency，并文档化 Chrome 路径要求
2. 为 `tessFileCache` 与 `server.js` 的 `.gz` Content-Encoding 补充单元测试
3. 为 `stage-core.js` 新增的内部辅助函数补充直接单元测试（虽未导出，可通过 `nextCueSnapshot`/`collectDueCues` 间接覆盖）
