'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'app-source.html');
const serverPath = path.join(ROOT, 'server-standalone.js');
const assignment = /var __HTML_B64 = "[^"]+";/g;
const html = fs.readFileSync(htmlPath);
const server = fs.readFileSync(serverPath, 'utf8');

assert.equal((server.match(assignment) || []).length, 1, 'expected exactly one __HTML_B64 assignment');
const updated = server.replace(assignment, `var __HTML_B64 = "${html.toString('base64')}";`);
assert.equal((updated.match(assignment) || []).length, 1, 'embedding changed assignment count');
fs.writeFileSync(serverPath, updated, 'utf8');

const reread = fs.readFileSync(serverPath, 'utf8');
const match = reread.match(/var __HTML_B64 = "([^"]+)";/);
assert.ok(match, 'embedded HTML assignment missing after write');
assert.deepEqual(Buffer.from(match[1], 'base64'), html, 'embedded HTML differs from source bytes');
console.log(`Embedded ${html.length} bytes from app-source.html`);
