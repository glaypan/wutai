'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source() {
  return fs.readFileSync(path.join(ROOT, 'server-standalone.js'), 'utf8');
}

test('critical rehearsal persistence has a throwing save path', () => {
  const server = source();
  assert.match(server, /function saveStateOrThrow\(\)\s*\{\s*atomicWriteJson\(DATA_FILE, state\);\s*\}/);
});

test('server accepts finish_rehearsal with fixed retry elapsed time and reports success', () => {
  const server = source();
  assert.match(server, /finish_rehearsal/);
  assert.match(server, /timer_rehearsal_saved/);
  assert.match(server, /Number\.isFinite\([^)]*elapsedMs/);
  assert.match(server, /programIndex/);
  assert.doesNotMatch(server, /save_rehearsal/);
});

test('server rolls back failed rehearsal persistence and returns operation-specific error', () => {
  const server = source();
  assert.match(server, /persistence_failed/);
  assert.match(server, /operation:\s*['"]finish_rehearsal['"]/);
  assert.match(server, /catch\s*\([^)]*\)[\s\S]{0,800}runtimeTimer/);
});

test('server delegates GO and program switch auto-start decisions to StageCore', () => {
  const server = source();
  assert.match(server, /function shouldStartTimer\(trigger\)\s*\{[\s\S]{0,160}StageCore\.shouldAutoStartTimer\(state\.mode, state\.timingSettings, trigger\)/);
  assert.match(server, /resetTimerForCurrent\(shouldStartTimer\("go"\)\)/);
  assert.match(server, /resetTimerForCurrent\(shouldStartTimer\("program_switch"\)\)/);
  assert.doesNotMatch(server, /resetTimerForCurrent\(state\.mode === "performance" && state\.timingSettings\.enabled\)/);
});

test('OCR status reports structured existence and size for every required file', () => {
  const server = source();
  assert.match(server, /ocrResult\[f\]\s*=\s*\{\s*exists:\s*true,\s*size:\s*fs\.statSync\([^\n]+\)\.size\s*\}/);
  assert.match(server, /ocrResult\[f\]\s*=\s*\{\s*exists:\s*false,\s*size:\s*0\s*\}/);
  assert.doesNotMatch(server, /ocrResult\[f\]\s*=\s*null/);
});

test('gzip OCR resources are served with gzip content encoding', () => {
  const server = source();
  assert.match(server, /if\s*\(tessExt\s*===\s*["']\.gz["']\)\s*tessHeaders\[["']Content-Encoding["']\]\s*=\s*["']gzip["']/);
});

test('clientPort 聚合入口端口架构', () => {
  const server = source();
  // clientPort 配置与服务器
  assert.match(server, /clientPort/, 'server-standalone.js must reference clientPort');
  assert.match(server, /clientServer/, 'server-standalone.js must define clientServer');
  assert.match(server, /clientWss/, 'server-standalone.js must define clientWss');
  assert.match(server, /CLIENT_PORTAL_HTML/, 'server-standalone.js must use CLIENT_PORTAL_HTML for aggregation portal');
  assert.match(server, /require\(["']\.\/lib\/client-portal-html["']\)/, 'server-standalone.js must require lib/client-portal-html');
  // 移除的 display 代码
  assert.doesNotMatch(server, /displayServer/, 'server-standalone.js must not contain displayServer');
  assert.doesNotMatch(server, /displayWss/, 'server-standalone.js must not contain displayWss');
  assert.doesNotMatch(server, /DISPLAY_PORT\b/, 'server-standalone.js must not contain DISPLAY_PORT');
  // /api/server-info 与 /api/config 含 clientPort 字段
  assert.match(server, /clientPort:\s*actualClientPort/, '/api/server-info must return clientPort');
  assert.match(server, /clientPortOverride/, '/api/server-info must return clientPortOverride');
  // 主端口非控制端角色重定向到 clientPort
  assert.match(server, /302/, 'server-standalone.js must use 302 redirect for port isolation');
  // 启动日志含聚合入口
  assert.match(server, /clientServer\.listen/, 'server-standalone.js must listen on clientServer');
});
