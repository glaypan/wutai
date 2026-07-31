'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const html = read('app-source.html');
const server = read('server-standalone.js');

assert.match(html, /v6\.0\.3/);
assert.match(server, /stage-manager-v603/);
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

const embedded = server.match(/var __HTML_B64 = "([^"]+)";/);
assert.ok(embedded, 'missing embedded HTML');
assert.deepEqual(Buffer.from(embedded[1], 'base64'), fs.readFileSync(path.join(ROOT, 'app-source.html')), 'embedded HTML byte mismatch');
console.log(`Release verification passed: ${launchers.length} launchers, ${tessFiles.length} OCR resources`);
