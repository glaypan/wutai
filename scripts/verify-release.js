'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const html = read('app-source.html');
const server = read('server-standalone.js');

assert.match(html, /v6\.0\.4/);
assert.match(server, /stage-manager-v604/);
assert.match(server, /\/api\/ocr-status/);
assert.match(server, /Content-Encoding["']\]\s*=\s*["']gzip["']/);
for (const contract of ['PDFJS_READY', 'OCR_READY', 'program_delete_many', 'addDel', 'timer-next-cue', 'resetCueTriggeredState', 'minutesToMilliseconds', 'quick-add-type-mics']) {
  assert.ok(html.includes(contract), `missing source contract: ${contract}`);
}

const launchers = ['启动-Windows.bat', '启动-macOS-Intel.command', '启动-macOS-ARM.command', '启动-Linux.sh', '启动-OpenWrt.sh', '启动-Termux.sh'];
for (const launcher of launchers) {
  const file = path.join(ROOT, launcher);
  assert.ok(fs.statSync(file).size > 0, `missing or empty launcher: ${launcher}`);
  assert.ok(fs.readFileSync(file, 'utf8').includes('server-standalone.js'), `launcher does not start server: ${launcher}`);
}

const tessFiles = ['pdf.min.js', 'pdf.worker.min.js', 'tesseract.min.js', 'worker.min.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core.wasm.js', 'chi_sim.traineddata.gz', 'eng.traineddata.gz'];
for (const name of tessFiles) assert.ok(fs.statSync(path.join(ROOT, 'tess', name)).size > 0, `missing OCR resource: ${name}`);
for (const script of ['scripts/embed-app-source.js', 'scripts/verify-release.js', 'scripts/package-release.js']) assert.ok(fs.statSync(path.join(ROOT, script)).size > 0, `missing release script: ${script}`);

// v6.0.4+: HTML is loaded from app-source.html at runtime via fs.readFileSync,
// no longer embedded as a base64 __HTML_B64 blob.
assert.match(
  server,
  /var HTML_CONTENT\s*=\s*fs\.readFileSync\([^)]*app-source\.html[^)]*\)/,
  'server-standalone.js must load HTML_CONTENT from app-source.html at runtime'
);
assert.ok(fs.statSync(path.join(ROOT, 'app-source.html')).size > 1024, 'app-source.html missing or trivially small');

// v6.0.4+: clientPort 聚合入口端口架构契约
assert.match(server, /clientPort/, 'server-standalone.js must reference clientPort');
assert.match(server, /clientWss/, 'server-standalone.js must define clientWss');
assert.match(server, /CLIENT_PORTAL_HTML/, 'server-standalone.js must use CLIENT_PORTAL_HTML');
assert.match(server, /require\(["']\.\/lib\/client-portal-html["']\)/, 'server-standalone.js must require lib/client-portal-html');
assert.ok(!/displayServer|displayWss|DISPLAY_PORT\b/.test(server), 'server-standalone.js must not contain displayServer/displayWss/DISPLAY_PORT');
assert.ok(fs.statSync(path.join(ROOT, 'lib', 'client-portal-html.js')).size > 0, 'missing lib/client-portal-html.js');

// app-source.html 前端迁移契约
assert.match(html, /client-port-input/, 'app-source.html must contain client-port-input');
assert.match(html, /cachedClientPort/, 'app-source.html must reference cachedClientPort');
assert.ok(!/cachedDisplayPort/.test(html), 'app-source.html must not reference cachedDisplayPort');
assert.match(html, /showRoleQR/, 'app-source.html must define showRoleQR');

// server.js 对等契约
const serverJs = read('server.js');
assert.match(serverJs, /clientPort/, 'server.js must reference clientPort');
assert.match(serverJs, /clientWss/, 'server.js must define clientWss');

console.log(`Release verification passed: ${launchers.length} launchers, ${tessFiles.length} OCR resources`);
