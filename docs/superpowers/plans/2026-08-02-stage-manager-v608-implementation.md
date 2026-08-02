# Stage Manager v6.0.8 双版本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变离线运行方式的前提下，为正式版和 beta-design 版依次交付 H1 断线恢复、H2 Tally 增强、H3 审批增强和 H4 移动端适配。

**Architecture:** 两个版本保持独立交付目录，共享 WebSocket 协议、服务端逻辑、`stage-core.js` 纯逻辑和测试契约；`app-source.html` 分别实现正式版紧凑界面与 beta-design 高可见移动界面。每个功能严格按测试、共享内核、正式版 UI、beta UI、双版本回归的顺序闭环。

**Tech Stack:** Node.js 18.17+、原生 `node:test`、原生 HTTP、`ws`、单文件 HTML/CSS/JavaScript、PowerShell。

---

## 路径约定

计划中的工作仓库根目录为 `E:\AI\git-trae`：

```text
E:\AI\git-trae\
  stage-manager-v6.0.7\
  stage-manager-v6.0.7beta-design\
  docs\
  tests\
```

原始来源：

```text
E:\AI\舞台\舞台流程表-v6.0.7-安装包\stage-manager
E:\AI\舞台\舞台流程表-v6.0.7beta-design-安装包\stage-manager
```

除任务 0 外，以下相对路径均以 `E:\AI\git-trae` 为根目录。所有 Git 提交步骤只在用户明确授权提交后执行。

### Task 0: 建立统一 Git 工作副本

**Files:**
- Create: `E:\AI\git-trae\.gitignore`
- Create: `E:\AI\git-trae\README.md`
- Copy: `E:\AI\舞台\舞台流程表-v6.0.7-安装包\stage-manager` to `E:\AI\git-trae\stage-manager-v6.0.7`
- Copy: `E:\AI\舞台\舞台流程表-v6.0.7beta-design-安装包\stage-manager` to `E:\AI\git-trae\stage-manager-v6.0.7beta-design`
- Copy: `E:\AI\舞台\docs` to `E:\AI\git-trae\docs`

- [ ] **Step 1: 检查目标目录为空且来源存在**

```powershell
$repo = 'E:\AI\git-trae'
$stable = 'E:\AI\舞台\舞台流程表-v6.0.7-安装包\stage-manager'
$beta = 'E:\AI\舞台\舞台流程表-v6.0.7beta-design-安装包\stage-manager'
Test-Path $stable
Test-Path $beta
Get-ChildItem -Force $repo
```

Expected: 两个 `Test-Path` 都为 `True`；目标目录没有需要保留的文件。

- [ ] **Step 2: 复制两个工作目录和文档**

```powershell
Copy-Item $stable "$repo\stage-manager-v6.0.7" -Recurse
Copy-Item $beta "$repo\stage-manager-v6.0.7beta-design" -Recurse
Copy-Item 'E:\AI\舞台\docs' "$repo\docs" -Recurse
```

Expected: 目标仓库内出现两个独立可运行目录和 `docs`。

- [ ] **Step 3: 创建忽略规则**

```gitignore
**/.runtime/
**/node_modules/
**/*.log
**/*.tmp
**/exports/
**/config.json
**/show.json
.superpowers/
```

说明：把两版现有 `config.json` 复制为 `config.example.json`，清除真实 Token、密码哈希和内网信息后再跟踪；`show.json` 仅在确认不含客户数据时才改为跟踪。

- [ ] **Step 4: 初始化仓库并检查基线**

```powershell
Set-Location 'E:\AI\git-trae'
git init
git status --short
```

Expected: Git 仓库初始化成功，只显示待跟踪的源码、示例配置和文档。

- [ ] **Step 5: 仅在获得明确授权后提交基线**

```powershell
git add .
git commit -m "chore: import stage manager v6.0.7 baseline"
```

Expected: 产生可回退的未修改基线提交。

### Task 1: 补齐可运行测试基线

**Files:**
- Modify: `stage-manager-v6.0.7/package.json`
- Modify: `stage-manager-v6.0.7beta-design/package.json`
- Create: `stage-manager-v6.0.7/tests/stage-core.test.js`
- Create: `stage-manager-v6.0.7/tests/server-shared.test.js`
- Create: `stage-manager-v6.0.7/tests/source-contract.test.js`
- Mirror: corresponding files under `stage-manager-v6.0.7beta-design/tests/`
- Create: `tests/dual-version-contract.test.js`

- [ ] **Step 1: 写入失败的双版本导出契约测试**

```javascript
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stable = require('../stage-manager-v6.0.7/stage-core');
const beta = require('../stage-manager-v6.0.7beta-design/stage-core');

test('双版本核心公开 API 一致', () => {
  assert.deepEqual(Object.keys(beta).sort(), Object.keys(stable).sort());
});
```

- [ ] **Step 2: 运行测试并确认当前脚本缺失问题**

```powershell
Set-Location 'E:\AI\git-trae\stage-manager-v6.0.7'
npm test
```

Expected: FAIL，指出当前 `tests/*.test.js` 不存在。

- [ ] **Step 3: 统一测试脚本和 Node 版本**

两版 `package.json` 使用：

```json
"scripts": {
  "start": "node server-standalone.js",
  "test": "node --test tests/stage-core.test.js tests/server-shared.test.js tests/source-contract.test.js"
},
"engines": {
  "node": ">=18.17"
}
```

保留各自版本号；删除指向不存在文件的 `verify`、`package` 和 `browser-workflows.test.js` 脚本。

- [ ] **Step 4: 添加核心、共享广播和源码入口测试**

核心测试至少断言计时暂停、媒体路径安全和公开 API；共享广播测试使用伪 WebSocket 断言只向 `OPEN` 客户端发送；源码契约断言服务端读取 `app-source.html` 且没有把 `public/index.html` 当主入口。

- [ ] **Step 5: 运行三组测试**

```powershell
Set-Location 'E:\AI\git-trae\stage-manager-v6.0.7'; npm test
Set-Location 'E:\AI\git-trae\stage-manager-v6.0.7beta-design'; npm test
Set-Location 'E:\AI\git-trae'; node --test .\tests\dual-version-contract.test.js
```

Expected: 三组测试全部 PASS。

### Task 2: H1 事件序号与动作幂等纯逻辑

**Files:**
- Modify: both `stage-core.js`
- Modify: both `tests/stage-core.test.js`
- Modify: `tests/dual-version-contract.test.js`

- [ ] **Step 1: 写入事件缓存和动作去重失败测试**

```javascript
test('事件缓存只返回 lastSeq 后的连续事件', () => {
  const buffer = core.createEventBuffer(3);
  buffer.push({ type: 'a' });
  buffer.push({ type: 'b' });
  assert.deepEqual(buffer.after(1).map(event => event.seq), [2]);
  assert.equal(buffer.after(-10), null);
});

test('动作去重返回首次结果且不会重复执行', () => {
  const store = core.createActionDeduper(1000, 10);
  const first = store.run('go-1', 100, () => ({ currentProgramIndex: 1 }));
  const second = store.run('go-1', 200, () => ({ currentProgramIndex: 2 }));
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.result.currentProgramIndex, 1);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/stage-core.test.js`

Expected: FAIL，`createEventBuffer` 和 `createActionDeduper` 尚未导出。

- [ ] **Step 3: 实现有界事件缓存和去重器**

新增导出：

```javascript
function createEventBuffer(limit) {
  var max = Math.max(1, Number(limit) || 200);
  var seq = 0;
  var items = [];
  return {
    push: function(event) {
      var stored = Object.assign({}, event, { seq: ++seq });
      items.push(stored);
      if (items.length > max) items.shift();
      return stored;
    },
    after: function(lastSeq) {
      var value = Number(lastSeq);
      if (!Number.isInteger(value) || value < 0) return null;
      if (items.length && value < items[0].seq - 1) return null;
      return items.filter(function(item) { return item.seq > value; });
    },
    currentSeq: function() { return seq; }
  };
}
```

`createActionDeduper(ttlMs, limit)` 使用 `Map` 保存 `{ expiresAt, result }`，每次 `run` 前清理过期项，并按插入顺序限制容量。

- [ ] **Step 4: 双版同步并运行测试**

Run: 两版 `npm test` 和根目录双版本契约测试。

Expected: PASS，两个 `stage-core.js` 导出键完全一致。

### Task 3: H1 服务端恢复协议

**Files:**
- Modify: both `lib/server-shared.js`
- Modify: both `server-standalone.js`
- Create: both `tests/server-contract.test.js`
- Modify: both `package.json`

- [ ] **Step 1: 为恢复响应写失败的服务端契约测试**

测试建立临时数据目录和随机端口，连接后发送：

```javascript
{ type: 'resume', serverInstanceId, lastSeq: 0 }
```

断言缓存命中返回 `resume_events`，实例变化返回带 `serverInstanceId` 和 `seq` 的 `full_state`。

- [ ] **Step 2: 把服务入口封装为可关闭工厂**

导出：

```javascript
function createStageServer(options) {
  return { start, close, getPorts };
}

module.exports = { createStageServer };

if (require.main === module) {
  createStageServer().start();
}
```

`options` 支持 `dataDir`、随机 HTTP 端口、`oscEnabled:false` 和 `autoOpen:false`。`close()` 必须关闭 HTTP、WebSocket、UDP、审批扫描和自动 Cue 定时器。

- [ ] **Step 3: 为广播事件附加序号**

统一事件包：

```javascript
{
  type: 'event',
  seq,
  serverInstanceId,
  event: originalMessage
}
```

`full_state` 增加 `seq`、`serverInstanceId`；`resume_events` 增加 `events` 数组。`client_count` 不进入动作恢复缓存。

- [ ] **Step 4: 为高风险消息加入 `actionId` 去重**

在权限校验后、状态变更前处理 `advance`、`prev`、`next`、`set_current`、`cue_trigger`、`tally_signal` 和 `mode_switch_response`。重复动作返回：

```javascript
{ type: 'action_result', actionId, duplicate: true, result }
```

- [ ] **Step 5: 运行服务端契约**

```powershell
npm run test:server
```

Expected: 增量恢复、全量恢复、重复 GO 不推进第二次、随机端口释放全部 PASS。

### Task 4: H1 双版本客户端重连

**Files:**
- Modify: both `app-source.html`
- Modify: both `tests/source-contract.test.js`

- [ ] **Step 1: 写源码契约失败测试**

断言两版包含 `lastSeq`、`serverInstanceId`、`connectionState`、`resume`、`actionId`、退避数组 `[1000, 2000, 4000, 8000]`。

- [ ] **Step 2: 实现连接状态机**

在现有 `tryConnectWS()` 周围加入单一连接管理器，禁止并发重连。`onclose` 进入 `reconnecting`，按 1/2/4/8 秒加随机抖动重试，不再切入可执行高风险动作的本地模式。

- [ ] **Step 3: 实现恢复消息应用**

`full_state` 重置基线；`resume_events` 按连续 `seq` 应用；发现缺口发送 `{ type:'get_state' }`。每个事件应用成功后再更新 `lastSeq`。

- [ ] **Step 4: 给动作发送器增加 ID**

```javascript
function createActionId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
```

`sendMsg` 对状态变更消息补充 `actionId`，但重连后不自动重发。

- [ ] **Step 5: 添加非遮挡连接状态条并双版验证**

正式版使用顶部紧凑状态条；beta 版使用更明显但不遮挡控制区的状态条。浏览器断网 1-3 秒后恢复时页面不刷新、节目状态不倒退、GO 不重复。

### Task 5: H2 Tally 状态模型与服务端

**Files:**
- Modify: both `stage-core.js`
- Modify: both `server-standalone.js`
- Modify: both `config.json` normalization
- Modify: corresponding tests

- [ ] **Step 1: 写 Tally 状态转换失败测试**

```javascript
test('Tally 只能从 sent 进入一个终态', () => {
  const sent = core.transitionTally({ tallyId: 't1', status: 'sent' }, 'acknowledged', 100);
  assert.equal(sent.status, 'acknowledged');
  assert.throws(() => core.transitionTally(sent, 'dismissed', 200));
});
```

- [ ] **Step 2: 实现 `transitionTally` 和有界历史**

只允许 `sent` 到 `acknowledged`、`dismissed` 或 `expired`；历史默认 100 条，配置规范化限制为 20-500 条。

- [ ] **Step 3: 替换旧 `tally_signal` 服务端分支**

兼容接收旧消息，但内部统一生成 `tallyId` 和 `tally.sent`。新增 `tally_acknowledge`、`tally_dismiss`，校验目标角色和终态冲突，并广播结构化事件。

- [ ] **Step 4: 加入过期扫描与审计字段**

到期后生成 `tally.expired`；日志记录发送者、目标、节目、状态和时间，历史与扫描定时器均可关闭。

- [ ] **Step 5: 运行 Tally 核心和服务端测试**

Expected: 单角色、多角色、全员、重复确认、过期和历史上限全部 PASS。

### Task 6: H2 双版本 Tally 界面

**Files:**
- Modify: both `app-source.html`
- Modify: both `tests/source-contract.test.js`

- [ ] **Step 1: 写声音、振动、确认和历史契约测试**

断言存在本地设置键、`navigator.vibrate` 能力检测、已提醒 `tallyId` 集合、确认与关闭动作。

- [ ] **Step 2: 实现共享行为**

同一 `tallyId` 只提醒一次；音频必须由用户交互解锁，失败时保持视觉提示；设置存入 `localStorage`，不存敏感信息。

- [ ] **Step 3: 实现正式版紧凑 UI**

使用顶部固定提示条、确认/关闭图标按钮和最近历史列表，动态文字不得挤压 GO 区。

- [ ] **Step 4: 实现 beta 高可见 UI**

使用移动端底部操作区、大尺寸确认按钮和明确状态色；桌面仍保持紧凑模式。

- [ ] **Step 5: 浏览器双版回归**

验证单角色、多角色、禁音、禁振、重连补发不重复提醒、发送端收到确认时间。

### Task 7: H3 审批状态机与审计

**Files:**
- Modify: both `stage-core.js`
- Modify: both `server-standalone.js`
- Modify: both config normalization
- Modify: corresponding tests

- [ ] **Step 1: 写审批状态机失败测试**

```javascript
test('审批终态不能再次响应', () => {
  const approved = core.transitionApproval({ requestId: 'r1', status: 'pending' }, 'approved', {});
  assert.throws(() => core.transitionApproval(approved, 'rejected', {}));
});
```

- [ ] **Step 2: 实现状态机和配置白名单**

区分 10 秒等待提示阈值与实际过期时间。自动批准配置按动作类型白名单生效，默认关闭。

- [ ] **Step 3: 扩展请求和响应协议**

请求增加创建/过期时间和来源；响应增加 `note` 或 `rejectionReason`。所有文本限长并在前端按纯文本渲染。

- [ ] **Step 4: 完整记录审计**

批准、拒绝、自动批准、过期和重复响应都写入结构化内存日志；日志保持 500 条上限，不阻塞现场动作。

- [ ] **Step 5: 运行审批契约测试**

Expected: 10 秒等待提示不等于过期、重复响应冲突、白名单自动批准、拒绝原因回传全部 PASS。

### Task 8: H3 双版本审批界面

**Files:**
- Modify: both `app-source.html`
- Modify: both source contract tests

- [ ] **Step 1: 实现等待状态和倒计时**

导演端 10 秒后显示“等待中”，但继续等待服务端终态；断线恢复后按服务端时间重新计算。

- [ ] **Step 2: 实现正式版审批列表**

紧凑列表显示请求者、目标、等待时间、批准和拒绝；拒绝原因输入与提交按钮分离。

- [ ] **Step 3: 实现 beta 高可见审批面板**

触摸按钮最小 44px，高优先级状态不与 Tally、连接状态重叠。

- [ ] **Step 4: 验证文本安全和重复提交**

拒绝原因包含 HTML 字符时按文本显示；首次响应后立即禁用操作，服务端仍负责最终冲突检查。

### Task 9: H4 手势纯逻辑与移动布局

**Files:**
- Modify: both `stage-core.js`
- Modify: both `app-source.html`
- Modify: corresponding tests

- [ ] **Step 1: 写手势判定失败测试**

```javascript
test('横向滑动必须超过阈值且纵向偏差受限', () => {
  assert.equal(core.classifyGesture({ dx: 80, dy: 12, durationMs: 240 }), 'swipe-right');
  assert.equal(core.classifyGesture({ dx: 40, dy: 70, durationMs: 240 }), null);
});
```

- [ ] **Step 2: 实现无 DOM 的 `classifyGesture`**

阈值集中在一个配置对象；只返回 `swipe-left`、`swipe-right`、`long-press`、`pull-refresh` 或 `null`。

- [ ] **Step 3: 接入 Pointer Events**

仅从非交互区域开始；使用 `closest('input,textarea,select,button,[contenteditable],a')` 排除控件；`pointercancel` 和超阈值纵向移动必须清除状态。

- [ ] **Step 4: 实现下拉刷新和长按菜单**

下拉只发送状态请求，不刷新页面、不重放动作；长按菜单支持点击空白和 Escape 关闭。

- [ ] **Step 5: 完成正式版与 beta 响应式差异**

正式版移动端保留紧凑控制区；beta 版竖屏使用底部主要操作区、横屏使用节目列表与控制区双栏。两版使用 `env(safe-area-inset-*)`。

- [ ] **Step 6: 四类视口回归**

验证 390x844、844x390、768x1024 和 1440x900。检查文本不溢出、按钮不位移、GO 不被遮挡、手势不从输入控件触发。

### Task 10: 最终双版本验证与发布检查

**Files:**
- Modify: `docs/verification/v6.0.8-checklist.md`
- Modify: both `package.json` version fields
- Modify: visible version labels in both `app-source.html` and `server-standalone.js`

- [ ] **Step 1: 运行全部自动测试**

```powershell
Set-Location 'E:\AI\git-trae\stage-manager-v6.0.7'; npm test; npm run test:server
Set-Location 'E:\AI\git-trae\stage-manager-v6.0.7beta-design'; npm test; npm run test:server
Set-Location 'E:\AI\git-trae'; node --test .\tests\dual-version-contract.test.js
```

Expected: 全部 PASS，无挂起句柄。

- [ ] **Step 2: 分端口启动两个版本**

稳定版使用默认端口；beta 通过环境变量使用 3100-3103，OSC 禁用，避免端口冲突。

- [ ] **Step 3: 浏览器完成 H1-H4 回归**

记录桌面和移动视口截图、控制台错误、网络请求、断线恢复、Tally、审批和手势结果。

- [ ] **Step 4: 更新版本标识**

正式版使用 `6.0.8`，设计版使用 `6.0.8-beta-design`；协议版本保持相同。

- [ ] **Step 5: 检查源码与敏感信息**

```powershell
git status --short
git diff --check
git diff -- . ':!**/config.json' ':!**/show.json'
```

Expected: 无空白错误，无真实 Token、密码、客户数据或内网地址进入差异。

- [ ] **Step 6: 仅在获得明确授权后提交功能**

按 H1、H2、H3、H4 分别提交，不把四项压成一个提交。
