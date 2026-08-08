'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app-source.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server-standalone.js'), 'utf8');

test('主运行入口使用 app-source.html', () => {
  assert.match(server, /app-source\.html/);
  assert.doesNotMatch(server, /public[\\/]index\.html/);
});

test('安装包包含运行所需核心资源', () => {
  for (const file of ['stage-core.js', 'lib/server-shared.js', 'config.example.json']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
  assert.match(source, /stage-core\.js/);
});

test('服务端包含 H1 恢复协议和动作幂等入口', () => {
  assert.match(server, /serverInstanceId/);
  assert.match(server, /resume_events/);
  assert.match(server, /case ["']resume["']/);
  assert.match(server, /actionId/);
});

test('客户端包含 H1 重连恢复状态机', () => {
  assert.match(source, /lastSeq/);
  assert.match(source, /serverInstanceId/);
  assert.match(source, /connectionState/);
  assert.match(source, /resume_events/);
  assert.match(source, /actionId/);
  assert.match(source, /\[1000,\s*2000,\s*4000,\s*8000\]/);
});

test('H2 Tally 包含结构化状态和确认动作', () => {
  assert.match(server, /tallyId/);
  assert.match(server, /tally_acknowledge/);
  assert.match(server, /tally_dismiss/);
  assert.match(source, /navigator\.vibrate/);
  assert.match(source, /tallyId/);
  assert.ok((source.match(/case ["']tally_signal["']/g) || []).length >= 2);
  assert.ok((source.match(/case ["']tally_update["']/g) || []).length >= 2);
  assert.ok((source.match(/case ["']tally_action_result["']/g) || []).length >= 2);
});

test('H3 审批包含状态、原因、备注和审计字段', () => {
  assert.match(server, /transitionApproval/);
  assert.match(server, /status: "pending"/);
  assert.match(server, /expired/);
  assert.match(server, /audit/);
  assert.match(source, /approval.*10|10.*approval/i);
});

test('H4 移动端包含手势和安全区域适配', () => {
  assert.match(source, /PointerEvent|pointerdown/);
  assert.match(source, /safe-area-inset-top/);
  assert.match(source, /touch-action/);
  assert.match(source, /longPress|long-press|longpress/i);
  assert.match(source, /swipe|下拉|refresh/i);
});

test('认证使用 POST 和 Cookie，不把密码或 Token 放入 URL', () => {
  assert.match(server, /POST/);
  assert.match(server, /Set-Cookie/);
  assert.match(server, /stage_(control|client|screen)_session/);
  assert.match(source, /credentials\s*:\s*["']same-origin["']/);
  assert.doesNotMatch(source, /[?&]password=/);
  assert.doesNotMatch(source, /[?&]token=/);
  assert.doesNotMatch(server, /Location[^\n]*password=/);
  assert.doesNotMatch(server, /Location[^\n]*token=/);
  assert.doesNotMatch(server, /function getRequestToken\(/);
  assert.doesNotMatch(server, /function getRequestPassword\(/);
});

test('权限更新携带版本号', () => {
  assert.match(server, /permissionsVersion/);
  assert.match(source, /permissionsVersion/);
  assert.match(source, /data\.permissionsVersion\s*<\s*permissionsVersion/);
});

test('远程连接通过目标端口登录，不直接跨源建立 WebSocket', () => {
  assert.match(source, /function loginToServer\(/);
  assert.doesNotMatch(source, /function tryConnectManualServer\(/);
});

test('密码轮换撤销角色会话，提示屏不自动签发会话', () => {
  assert.match(server, /sessionStore\.revokeRole\(role\)/);
  assert.doesNotMatch(server, /sessionStore\.create\("screen"\)/);
});
