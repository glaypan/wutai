'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const outFlag = process.argv.indexOf('--out');
if (outFlag < 0 || !process.argv[outFlag + 1]) throw new Error('usage: node scripts/package-release.js --out <directory>');
const OUT = path.resolve(process.argv[outFlag + 1]);
const STAGE = path.join(OUT, 'stage-manager-v6.0.3');
const FILES = ['app-source.html', 'server-standalone.js', 'stage-core.js', 'README.md', 'RELEASE-v6.0.3.md', '使用说明.txt', '启动-Windows.bat', '启动-macOS-Intel.command', '启动-macOS-ARM.command', '启动-Linux.sh', '启动-OpenWrt.sh', '启动-Termux.sh'];
const RESOURCE_FILES = {
  tess: ['pdf.min.js', 'pdf.worker.min.js', 'tesseract.min.js', 'worker.min.js', 'tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd.wasm.js', 'tesseract-core.wasm.js', 'chi_sim.traineddata.gz', 'eng.traineddata.gz'],
  vendor: ['FileSaver.min.js', 'html2pdf.bundle.min.js', 'mammoth.browser.min.js'],
  media: ['使用说明.txt']
};
const FORBIDDEN = /(^|[\\/])(config\.json(?:\.bak)?|show\.json(?:\.bak)?|node_modules|docs|tests|scripts|\.snapshots|\.reviews|\.superpowers)([\\/]|$)/i;

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
for (const name of FILES) {
  const source = path.join(ROOT, name);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(STAGE, name), { recursive: true, force: true });
}
for (const [directory, names] of Object.entries(RESOURCE_FILES)) {
  const targetDirectory = path.join(STAGE, directory);
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const name of names) fs.copyFileSync(path.join(ROOT, directory, name), path.join(targetDirectory, name));
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
for (const file of walk(STAGE)) {
  const relative = path.relative(STAGE, file);
  if (FORBIDDEN.test(relative)) throw new Error(`forbidden release entry: ${relative}`);
}

const zip = path.join(OUT, 'stage-manager-v6.0.3-all-platforms.zip');
const tgz = path.join(OUT, 'stage-manager-v6.0.3-all-platforms.tar.gz');
for (const file of [zip, tgz, `${zip}.sha256`, `${tgz}.sha256`, path.join(OUT, 'SHA256SUMS.txt')]) fs.rmSync(file, { force: true });
if (process.platform === 'win32') {
  const q = value => value.replace(/'/g, "''");
  childProcess.execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -LiteralPath '${q(STAGE)}' -DestinationPath '${q(zip)}' -CompressionLevel Optimal -Force`], { stdio: 'inherit' });
} else {
  childProcess.execFileSync('zip', ['-qr', zip, path.basename(STAGE)], { cwd: OUT, stdio: 'inherit' });
}
childProcess.execFileSync('tar', ['-czf', tgz, path.basename(STAGE)], { cwd: OUT, stdio: 'inherit' });

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const lines = [zip, tgz].map(file => `${hash(file)}  ${path.basename(file)}`);
fs.writeFileSync(`${zip}.sha256`, `${lines[0]}\n`, 'ascii');
fs.writeFileSync(`${tgz}.sha256`, `${lines[1]}\n`, 'ascii');
fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'ascii');
console.log(lines.join('\n'));
