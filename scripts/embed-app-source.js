'use strict';

// v6.0.4+: HTML is externalized — server-standalone.js reads app-source.html
// at runtime via fs.readFileSync. This script now VERIFIES the externalization
// contract instead of re-embedding a base64 blob into server-standalone.js.
// The legacy __HTML_B64 line (if still present) is treated as dead code and
// is no longer regenerated.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'app-source.html');
const serverPath = path.join(ROOT, 'server-standalone.js');

const html = fs.readFileSync(htmlPath);
const server = fs.readFileSync(serverPath, 'utf8');

assert.ok(html.length > 0, 'app-source.html is empty');
assert.match(
  server,
  /var HTML_CONTENT\s*=\s*fs\.readFileSync\([^)]*app-source\.html[^)]*\)/,
  'server-standalone.js must load HTML_CONTENT from app-source.html at runtime'
);

console.log(`Verified externalized HTML: ${html.length} bytes from app-source.html`);
