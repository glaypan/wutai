// build-package.js - 生成多文件 ZIP 安装包
// 不再将 tess 文件嵌入安装脚本，而是作为独立文件打包
// 更可靠、更快速、体积更小

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');

var WORKSPACE = '/workspace';
var OUTPUT_DIR = path.join(WORKSPACE, 'downloads', 'package');
var ZIP_PATH = path.join(WORKSPACE, 'downloads', '舞台流程表-安装包.zip');

// 清理输出目录
if (fs.existsSync(OUTPUT_DIR)) {
  execSync('rm -rf "' + OUTPUT_DIR + '"');
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUTPUT_DIR, 'tess'), { recursive: true });

console.log('═══════════════════════════════════════════════════');
console.log('  舞台流程表 - 多文件 ZIP 安装包构建');
console.log('═══════════════════════════════════════════════════\n');

// ========== 1. 读取 HTML ==========
var htmlContent = fs.readFileSync(path.join(WORKSPACE, '舞台流程表.html'), 'utf-8');
var htmlB64 = Buffer.from(htmlContent).toString('base64');
console.log('[1] HTML: ' + (htmlContent.length / 1024).toFixed(1) + ' KB');

// ========== 2. 读取 ws 模块 ==========
var wsFiles = {};
var wsRoot = path.join(WORKSPACE, 'node_modules', 'ws');
try {
  wsFiles['index.js'] = fs.readFileSync(path.join(wsRoot, 'index.js'), 'utf-8');
  wsFiles['browser.js'] = fs.readFileSync(path.join(wsRoot, 'browser.js'), 'utf-8');
  wsFiles['package.json'] = fs.readFileSync(path.join(wsRoot, 'package.json'), 'utf-8');
  var wsLibDir = path.join(wsRoot, 'lib');
  fs.readdirSync(wsLibDir).forEach(function(f) {
    if (f.endsWith('.js')) {
      wsFiles['lib/' + f] = fs.readFileSync(path.join(wsLibDir, f), 'utf-8');
    }
  });
  console.log('[2] ws 模块: ' + Object.keys(wsFiles).length + ' 个文件');
} catch(e) {
  console.error('[!] 无法读取 ws 模块: ' + e.message);
  process.exit(1);
}
var wsJson = JSON.stringify(wsFiles);

// ========== 3. 生成独立服务器 ==========
var serverCode = generateStandaloneServer(htmlB64, wsJson);
fs.writeFileSync(path.join(OUTPUT_DIR, 'server-standalone.js'), serverCode, 'utf-8');
console.log('[3] 独立服务器: ' + (serverCode.length / 1024).toFixed(1) + ' KB');

// ========== 4. 复制 tess 文件 ==========
var tessSrcDir = path.join(WORKSPACE, 'tess');
var tessCount = 0;
fs.readdirSync(tessSrcDir).forEach(function(f) {
  var srcPath = path.join(tessSrcDir, f);
  var stat = fs.statSync(srcPath);
  if (stat.isFile()) {
    var dstPath = path.join(OUTPUT_DIR, 'tess', f);
    execSync('cp "' + srcPath + '" "' + dstPath + '"');
    tessCount++;
  }
});
console.log('[4] tess 文件: ' + tessCount + ' 个文件已复制');

// ========== 5. 生成平台启动脚本 ==========
// Windows
var winBat = generateWindowsLauncher();
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-Windows.bat'), winBat, 'utf-8');
console.log('[5a] Windows 启动脚本');

// macOS Intel
var macIntel = generateMacLauncher('x64');
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-macOS-Intel.command'), macIntel, 'utf-8');
fs.chmodSync(path.join(OUTPUT_DIR, '启动-macOS-Intel.command'), 0o755);

// macOS ARM
var macArm = generateMacLauncher('arm64');
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-macOS-ARM.command'), macArm, 'utf-8');
fs.chmodSync(path.join(OUTPUT_DIR, '启动-macOS-ARM.command'), 0o755);
console.log('[5b] macOS 启动脚本 (Intel + ARM)');

// Linux
var linuxSh = generateLinuxLauncher();
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-Linux.sh'), linuxSh, 'utf-8');
fs.chmodSync(path.join(OUTPUT_DIR, '启动-Linux.sh'), 0o755);
console.log('[5c] Linux 启动脚本');

// Termux
var termuxSh = generateTermuxLauncher();
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-Termux.sh'), termuxSh, 'utf-8');
fs.chmodSync(path.join(OUTPUT_DIR, '启动-Termux.sh'), 0o755);
console.log('[5d] Android Termux 启动脚本');

// OpenWrt
var openwrtSh = generateOpenWrtLauncher();
fs.writeFileSync(path.join(OUTPUT_DIR, '启动-OpenWrt.sh'), openwrtSh, 'utf-8');
fs.chmodSync(path.join(OUTPUT_DIR, '启动-OpenWrt.sh'), 0o755);
console.log('[5e] OpenWrt 启动脚本');

// ========== 6. 生成 README ==========
var readme = generateReadme();
fs.writeFileSync(path.join(OUTPUT_DIR, '使用说明.txt'), readme, 'utf-8');
console.log('[6] 使用说明');

// ========== 7. 打包 ZIP ==========
console.log('\n[7] 正在打包 ZIP...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}
// 使用 zip 命令打包
try {
  execSync('cd "' + OUTPUT_DIR + '" && zip -r "' + ZIP_PATH + '" . ', { stdio: 'pipe' });
} catch(e) {
  // 如果 zip 命令不存在，尝试使用 python
  console.log('  zip 命令不可用，使用 Python 打包...');
  execSync('python3 -c "' +
    'import zipfile, os; ' +
    'zf = zipfile.ZipFile(\\\"' + ZIP_PATH + '\\\", \\\"w\\\", zipfile.ZIP_DEFLATED); ' +
    '[zf.write(os.path.join(root, f), os.path.relpath(os.path.join(root, f), \\\"' + OUTPUT_DIR + '\\\")) for root, dirs, files in os.walk(\\\"' + OUTPUT_DIR + '\\\") for f in files]; ' +
    'zf.close()"');
}

var zipSize = fs.statSync(ZIP_PATH).size;
console.log('\n═══════════════════════════════════════════════════');
console.log('  ✅ 构建完成！');
console.log('  ZIP 大小: ' + (zipSize / 1024 / 1024).toFixed(1) + ' MB');
console.log('  位置: ' + ZIP_PATH);
console.log('═══════════════════════════════════════════════════\n');


// ========== 独立服务器生成 ==========
function generateStandaloneServer(htmlB64, wsJson) {
  var lines = [];
  lines.push('// stage-manager-standalone.js - 舞台流程表独立服务器');
  lines.push('// 内嵌 HTML 和 ws 模块，tess 文件从同目录读取');
  lines.push('');
  lines.push('var http = require("http");');
  lines.push('var fs = require("fs");');
  lines.push('var path = require("path");');
  lines.push('var os = require("os");');
  lines.push('var dgram = require("dgram");');
  lines.push('');
  // ========== 内嵌数据 ==========
  lines.push('var __HTML_B64 = "' + htmlB64 + '";');
  lines.push('var __WS_FILES = ' + wsJson + ';');
  lines.push('');
  lines.push('var HTML_CONTENT = Buffer.from(__HTML_B64, "base64").toString("utf-8");');
  lines.push('');
  // ========== 写入 ws 模块 ==========
  lines.push('(function() {');
  lines.push('  var wsDir = path.join(__dirname, "node_modules", "ws");');
  lines.push('  var wsLibDir = path.join(wsDir, "lib");');
  lines.push('  try {');
  lines.push('    if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });');
  lines.push('    if (!fs.existsSync(wsLibDir)) fs.mkdirSync(wsLibDir, { recursive: true });');
  lines.push('    Object.keys(__WS_FILES).forEach(function(relPath) {');
  lines.push('      var fullPath = path.join(wsDir, relPath);');
  lines.push('      var fullDir = path.dirname(fullPath);');
  lines.push('      if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });');
  lines.push('      if (!fs.existsSync(fullPath)) fs.writeFileSync(fullPath, __WS_FILES[relPath], "utf-8");');
  lines.push('    });');
  lines.push('  } catch(e) { console.error("写入 ws 模块失败:", e.message); }');
  lines.push('})();');
  lines.push('');
  lines.push('var { WebSocketServer, WebSocket } = require("ws");');
  lines.push('');
  // ========== 配置文件 ==========
  lines.push('var CONFIG_FILE = path.join(__dirname, "config.json");');
  lines.push('function loadConfig() {');
  lines.push('  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")); } catch(e) {}');
  lines.push('  return {};');
  lines.push('}');
  lines.push('function saveConfig(cfg) {');
  lines.push('  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8"); } catch(e) {}');
  lines.push('}');
  lines.push('var _config = loadConfig();');
  lines.push('');
  lines.push('var PORT = parseInt(process.env.PORT) || _config.port || 3000;');
  lines.push('var OSC_PORT = parseInt(process.env.OSC_PORT) || _config.oscPort || 5300;');
  lines.push('var oscEnabled = process.env.OSC_DISABLE !== "1";');
  lines.push('');
  // ========== 获取局域网IP ==========
  lines.push('var VIRTUAL_PREFIXES = ["172.16.","172.17.","172.18.","172.19.","172.20.","172.21.","172.22.","172.23.","172.24.","172.25.","172.26.","172.27.","172.28.","172.29.","172.30.","172.31.","10.147.","10.94.","169.254.","100.64.","100.65.","100.66.","100.67.","100.68.","100.69.","192.0.0.","198.18.","198.19."];');
  lines.push('var VIRTUAL_NAME_HINTS = ["vmware","vmnet","vbox","docker","wsl","hyper-v","vethernet","tailscale","zerotier","tap","tun","utun","bridge","virbr"];');
  lines.push('function isVirtualInterface(name) { var lower = (name || "").toLowerCase(); return VIRTUAL_NAME_HINTS.some(function(h) { return lower.indexOf(h) !== -1; }); }');
  lines.push('function isVirtualIP(addr) { return VIRTUAL_PREFIXES.some(function(p) { return addr.indexOf(p) === 0; }); }');
  lines.push('function getLocalIPs() {');
  lines.push('  var interfaces = os.networkInterfaces();');
  lines.push('  var real = []; var virtual = [];');
  lines.push('  for (var name in interfaces) {');
  lines.push('    if (isVirtualInterface(name)) continue;');
  lines.push('    interfaces[name].forEach(function(iface) {');
  lines.push('      if (iface.family === "IPv4" && !iface.internal) {');
  lines.push('        if (isVirtualIP(iface.address)) { virtual.push(iface.address); } else { real.push(iface.address); }');
  lines.push('      }');
  lines.push('    });');
  lines.push('  }');
  lines.push('  return real.length > 0 ? real : virtual;');
  lines.push('}');
  lines.push('var localIPs = getLocalIPs();');
  lines.push('var primaryIP = localIPs.length > 0 ? localIPs[0] : "localhost";');
  lines.push('');
  // ========== 数据存储 ==========
  lines.push('var DATA_FILE = path.join(__dirname, "show.json");');
  lines.push('var defaultState = { showName: "舞台流程表", mode: "setup", currentProgramIndex: 0, version: 3, globalChannels: { mics: [], lines: [] }, programs: [], subtitle: { lines: [], currentIndex: -1, visible: false } };');
  lines.push('function loadState() {');
  lines.push('  try { if (fs.existsSync(DATA_FILE)) { return mergeState(Object.assign({}, defaultState, JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")))); } }');
  lines.push('  catch (e) { console.error("加载 show.json 失败:", e.message); }');
  lines.push('  return mergeState(Object.assign({}, defaultState));');
  lines.push('}');
  lines.push('function mergeMusicField(p) { var cue = (p.musicCue || "").trim(); var node = (p.musicNode || "").trim(); if (!node) return cue; return cue ? "\\u3010\\u8282\\u70b9\\u3011" + node + "\\n" + cue : node; }');
  lines.push('function ensureChannel(ch) { return { id: ch.id || ("ch_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6)), name: ch.name || "", type: ch.type || "", notes: ch.notes || "", customType: ch.customType || "" }; }');
  lines.push('function mergeState(s) {');
  lines.push('  var oldVersion = s.version || 1;');
  lines.push('  var merged = {');
  lines.push('    showName: s.showName || "舞台流程表", mode: s.mode || "setup",');
  lines.push('    currentProgramIndex: s.currentProgramIndex || 0, version: 3,');
  lines.push('    globalChannels: s.globalChannels || { mics: [], lines: [] },');
  lines.push('    programs: (s.programs || []).map(function(p) {');
  lines.push('      var status = p.status; if (!status) { status = p.completed ? "completed" : "pending"; }');
  lines.push('      var duration = p.duration || 0; if (oldVersion < 3 && duration >= 60) { duration = Math.round(duration / 60); }');
  lines.push('      return { name: p.name || "", duration: duration, notes: p.notes || "", musicCue: mergeMusicField(p), status: status, useChannels: p.useChannels || (p.mics ? p.mics.filter(function(m){return m.active;}).map(function(m){return m.name;}) : []) };');
  lines.push('    })');
  lines.push('  };');
  lines.push('  merged.subtitle = s.subtitle || { lines: [], currentIndex: -1, visible: false };');
  lines.push('  if (!merged.subtitle.lines) merged.subtitle.lines = [];');
  lines.push('  if (typeof merged.subtitle.currentIndex !== "number") merged.subtitle.currentIndex = -1;');
  lines.push('  if (typeof merged.subtitle.visible !== "boolean") merged.subtitle.visible = false;');
  lines.push('  if (!merged.globalChannels.mics) merged.globalChannels.mics = [];');
  lines.push('  if (!merged.globalChannels.lines) merged.globalChannels.lines = [];');
  lines.push('  merged.globalChannels.mics = merged.globalChannels.mics.map(ensureChannel);');
  lines.push('  merged.globalChannels.lines = merged.globalChannels.lines.map(ensureChannel);');
  lines.push('  return merged;');
  lines.push('}');
  lines.push('function saveState() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8"); } catch (e) { console.error("保存 show.json 失败:", e.message); } }');
  lines.push('var state = loadState();');
  lines.push('if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) state.currentProgramIndex = Math.max(0, state.programs.length - 1);');
  lines.push('');
  // ========== 权限 ==========
  lines.push('var FIELD_PERM = { notes: ["control", "assistant", "backstage"], musicCue: ["control", "assistant"], useChannels: ["control", "assistant"] };');
  lines.push('function canEditField(role, field) { var allowed = FIELD_PERM[field]; return allowed && allowed.indexOf(role) !== -1; }');
  lines.push('');
  // ========== HTTP + WebSocket ==========
  lines.push('var server = http.createServer(function(req, res) { serveStatic(req, res); });');
  lines.push('var wss = new WebSocketServer({ server });');
  lines.push('wss.on("connection", function(ws) {');
  lines.push('  sendTo(ws, { type: "full_state", state: state, clientCount: wss.clients.size });');
  lines.push('  broadcastClientCount();');
  lines.push('  ws.on("message", function(raw) { var msg; try { msg = JSON.parse(raw.toString()); } catch (e) { return; } handleMessage(ws, msg); });');
  lines.push('  ws.on("close", function() { broadcastClientCount(); });');
  lines.push('});');
  lines.push('');
  // ========== 消息处理 ==========
  lines.push('function handleMessage(ws, msg) {');
  lines.push('  var role = msg.role || "control";');
  lines.push('  switch (msg.type) {');
  lines.push('    case "get_state": broadcastFullState(); break;');
  lines.push('    case "update_state":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "update_state");');
  lines.push('      if (msg.data && typeof msg.data === "object") {');
  lines.push('        state = mergeState(Object.assign({}, state, msg.data));');
  lines.push('        if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) state.currentProgramIndex = Math.max(0, state.programs.length - 1);');
  lines.push('        saveState(); broadcastFullState();');
  lines.push('      } break;');
  lines.push('    case "set_current":');
  lines.push('      if (role !== "control" && role !== "director") return sendError(ws, "forbidden", "set_current");');
  lines.push('      if (typeof msg.index === "number" && msg.index >= 0 && msg.index <= state.programs.length - 1) {');
  lines.push('        state.currentProgramIndex = msg.index;');
  lines.push('        if (state.programs[msg.index]) state.programs[msg.index].status = "active";');
  lines.push('        saveState(); broadcastFullState();');
  lines.push('      } break;');
  lines.push('    case "advance": if (role !== "control" && role !== "director") return sendError(ws, "forbidden", "advance"); doAdvance(); break;');
  lines.push('    case "prev": if (role !== "control" && role !== "director") return sendError(ws, "forbidden", "prev"); doNav(-1); break;');
  lines.push('    case "next": if (role !== "control" && role !== "director") return sendError(ws, "forbidden", "next"); doNav(1); break;');
  lines.push('    case "reset_all":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "reset_all");');
  lines.push('      state.programs.forEach(function(p) { p.status = "pending"; });');
  lines.push('      state.currentProgramIndex = 0;');
  lines.push('      if (state.programs[0]) state.programs[0].status = "active";');
  lines.push('      saveState(); broadcastFullState(); break;');
  lines.push('    case "reset_one":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "reset_one");');
  lines.push('      if (typeof msg.idx === "number" && state.programs[msg.idx]) { state.programs[msg.idx].status = "pending"; saveState(); broadcastFullState(); } break;');
  lines.push('    case "update_program_field":');
  lines.push('      if (!canEditField(role, msg.field)) return sendError(ws, "forbidden", "update_program_field");');
  lines.push('      if (typeof msg.idx === "number" && state.programs[msg.idx]) { state.programs[msg.idx][msg.field] = msg.value; saveState(); broadcastFullState(); } break;');
  lines.push('    case "import_programs":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "import_programs");');
  lines.push('      var newProgs = (msg.programs || []).map(function(p) { return { name: p.name || "", duration: p.duration || 0, notes: p.notes || "", musicCue: p.musicCue || "", status: p.status || "pending", useChannels: p.useChannels || [] }; });');
  lines.push('      if (msg.mode === "replace") { state.programs = newProgs; state.currentProgramIndex = 0; } else { state.programs = state.programs.concat(newProgs); }');
  lines.push('      saveState(); broadcastFullState(); break;');
  lines.push('    case "set_subtitle_lines":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "set_subtitle_lines");');
  lines.push('      state.subtitle.lines = (msg.lines || []).filter(function(l) { return typeof l === "string"; });');
  lines.push('      state.subtitle.currentIndex = -1; saveState(); broadcastFullState(); break;');
  lines.push('    case "control_subtitle":');
  lines.push('      if (role !== "control" && role !== "director" && role !== "assistant") return sendError(ws, "forbidden", "control_subtitle");');
  lines.push('      if (msg.action === "next") { state.subtitle.currentIndex = Math.min(state.subtitle.currentIndex + 1, state.subtitle.lines.length - 1); }');
  lines.push('      else if (msg.action === "prev") { state.subtitle.currentIndex = Math.max(state.subtitle.currentIndex - 1, -1); }');
  lines.push('      else if (msg.action === "goto") { if (typeof msg.index === "number") state.subtitle.currentIndex = Math.max(-1, Math.min(msg.index, state.subtitle.lines.length - 1)); }');
  lines.push('      else if (msg.action === "show") { state.subtitle.visible = true; }');
  lines.push('      else if (msg.action === "hide") { state.subtitle.visible = false; }');
  lines.push('      else if (msg.action === "clear") { state.subtitle.lines = []; state.subtitle.currentIndex = -1; state.subtitle.visible = false; }');
  lines.push('      saveState(); broadcastFullState(); break;');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  // ========== 导航函数 ==========
  lines.push('function doAdvance() {');
  lines.push('  var idx = state.currentProgramIndex;');
  lines.push('  if (idx >= 0 && idx < state.programs.length) state.programs[idx].status = "completed";');
  lines.push('  var nextIdx = Math.min(idx + 1, Math.max(0, state.programs.length - 1));');
  lines.push('  state.currentProgramIndex = nextIdx;');
  lines.push('  if (state.programs[nextIdx] && state.programs[nextIdx].status !== "completed") state.programs[nextIdx].status = "active";');
  lines.push('  saveState(); broadcastFullState();');
  lines.push('}');
  lines.push('function doNav(dir) {');
  lines.push('  var idx = state.currentProgramIndex;');
  lines.push('  var newIdx = idx + dir; if (newIdx < 0) newIdx = 0; if (newIdx > state.programs.length - 1) newIdx = Math.max(0, state.programs.length - 1);');
  lines.push('  state.currentProgramIndex = newIdx;');
  lines.push('  if (state.programs[newIdx] && state.programs[newIdx].status !== "completed") state.programs[newIdx].status = "active";');
  lines.push('  saveState(); broadcastFullState();');
  lines.push('}');
  lines.push('function sendTo(ws, obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }');
  lines.push('function sendError(ws, code, action) { sendTo(ws, { type: "error", code: code, action: action }); }');
  lines.push('function broadcast(obj) { var data = JSON.stringify(obj); wss.clients.forEach(function(c) { if (c.readyState === WebSocket.OPEN) c.send(data); }); }');
  lines.push('function broadcastFullState() { broadcast({ type: "full_state", state: state, clientCount: wss.clients.size }); }');
  lines.push('function broadcastClientCount() { broadcast({ type: "client_count", count: wss.clients.size }); }');
  lines.push('');
  // ========== OSC ==========
  lines.push('function parseOscMessage(buf) {');
  lines.push('  try {');
  lines.push('    var offset = 0; var addrEnd = buf.indexOf(0, offset); if (addrEnd < 0) return null;');
  lines.push('    var address = buf.toString("ascii", offset, addrEnd);');
  lines.push('    offset = Math.ceil((addrEnd + 1) / 4) * 4;');
  lines.push('    var tagEnd = buf.indexOf(0, offset); if (tagEnd < 0) return { address: address, args: [] };');
  lines.push('    var tags = buf.toString("ascii", offset + 1, tagEnd);');
  lines.push('    offset = Math.ceil((tagEnd + 1) / 4) * 4;');
  lines.push('    var args = [];');
  lines.push('    for (var i = 0; i < tags.length; i++) {');
  lines.push('      var t = tags[i];');
  lines.push('      if (t === "i") { args.push(buf.readInt32BE(offset)); offset += 4; }');
  lines.push('      else if (t === "f") { args.push(buf.readFloatBE(offset)); offset += 4; }');
  lines.push('      else if (t === "s") { var sEnd = buf.indexOf(0, offset); if (sEnd < 0) break; args.push(buf.toString("utf-8", offset, sEnd)); offset = Math.ceil((sEnd + 1) / 4) * 4; }');
  lines.push('    }');
  lines.push('    return { address: address, args: args };');
  lines.push('  } catch (e) { return null; }');
  lines.push('}');
  lines.push('function handleOscMessage(msg) {');
  lines.push('  var addr = (msg.address || "").toLowerCase();');
  lines.push('  if (addr === "/stage/go" || addr === "/go" || addr === "/stage/advance") { console.log("[OSC] GO"); doAdvance(); }');
  lines.push('  else if (addr === "/stage/next" || addr === "/next") { console.log("[OSC] Next"); doNav(1); }');
  lines.push('  else if (addr === "/stage/prev" || addr === "/prev") { console.log("[OSC] Prev"); doNav(-1); }');
  lines.push('  else if ((addr === "/stage/goto" || addr === "/goto") && msg.args.length > 0) {');
  lines.push('    var targetIdx = parseInt(msg.args[0]);');
  lines.push('    if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx <= state.programs.length - 1) {');
  lines.push('      console.log("[OSC] Goto " + targetIdx); state.currentProgramIndex = targetIdx;');
  lines.push('      if (state.programs[targetIdx]) state.programs[targetIdx].status = "active";');
  lines.push('      saveState(); broadcastFullState();');
  lines.push('    }');
  lines.push('  }');
  lines.push('}');
  lines.push('var oscSocket = null;');
  lines.push('if (oscEnabled) { try {');
  lines.push('  oscSocket = dgram.createSocket("udp4");');
  lines.push('  oscSocket.on("message", function(buf) { var m = parseOscMessage(buf); if (m && m.address) handleOscMessage(m); });');
  lines.push('  oscSocket.on("error", function(e) { console.error("[OSC] " + e.message); });');
  lines.push('  oscSocket.bind(OSC_PORT, function() { console.log("[OSC] UDP 监听端口 " + OSC_PORT); });');
  lines.push('} catch(e) { console.error("[OSC] 启动失败: " + e.message); } }');
  lines.push('');
  // ========== 静态文件服务 ==========
  lines.push('var MIME = { ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml", ".gz":"application/gzip", ".wasm":"application/wasm" };');
  lines.push('function serveStatic(req, res) {');
  lines.push('  var urlPath = decodeURIComponent((req.url || "/").split("?")[0]);');
  // API: server-info
  lines.push('  if (urlPath === "/api/server-info") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('    res.end(JSON.stringify({ ip: primaryIP, port: actualPort, ips: localIPs, oscPort: oscEnabled ? OSC_PORT : null }));');
  lines.push('    return;');
  lines.push('  }');
  // API: config
  lines.push('  if (urlPath === "/api/config") {');
  lines.push('    if (req.method === "GET") {');
  lines.push('      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('      res.end(JSON.stringify({ port: _config.port || 3000, oscPort: _config.oscPort || 5300 }));');
  lines.push('      return;');
  lines.push('    }');
  lines.push('    if (req.method === "POST") {');
  lines.push('      var body = "";');
  lines.push('      req.on("data", function(chunk) { body += chunk; });');
  lines.push('      req.on("end", function() {');
  lines.push('        try {');
  lines.push('          var cfg = JSON.parse(body);');
  lines.push('          if (cfg.port) _config.port = parseInt(cfg.port);');
  lines.push('          if (cfg.oscPort) _config.oscPort = parseInt(cfg.oscPort);');
  lines.push('          saveConfig(_config);');
  lines.push('          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('          res.end(JSON.stringify({ ok: true, port: _config.port, oscPort: _config.oscPort }));');
  lines.push('        } catch(e) {');
  lines.push('          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('          res.end(JSON.stringify({ ok: false, error: e.message }));');
  lines.push('        }');
  lines.push('      });');
  lines.push('      return;');
  lines.push('    }');
  lines.push('  }');
  // HTML
  lines.push('  if (urlPath === "/" || urlPath === "/index.html") {');
  lines.push('    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });');
  lines.push('    res.end(HTML_CONTENT);');
  lines.push('    return;');
  lines.push('  }');
  // manifest.json
  lines.push('  if (urlPath === "/manifest.json") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('    res.end(JSON.stringify({ name: "舞台流程表", short_name: "舞台流程", display: "standalone", background_color: "#000", theme_color: "#000", start_url: "/?role=control", scope: "/", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] }));');
  lines.push('    return;');
  lines.push('  }');
  // sw.js
  lines.push('  if (urlPath === "/sw.js") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });');
  lines.push('    res.end("var CACHE=\\\'stage-manager-v2\\\';self.addEventListener(\\\'install\\\',function(e){self.skipWaiting();});self.addEventListener(\\\'activate\\\',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});self.addEventListener(\\\'fetch\\\',function(e){if(e.request.method!==\\\'GET\\\')return;if(e.request.url.indexOf(\\\'/tess/\\\')!==-1){e.respondWith(fetch(e.request));return;}e.respondWith(caches.open(CACHE).then(function(c){return c.match(e.request).then(function(f){var p=fetch(e.request).then(function(r){if(r.ok)c.put(e.request,r.clone());return r;}).catch(function(){return f;});return p;});}));});");');
  lines.push('    return;');
  lines.push('  }');
  // icon.svg
  lines.push('  if (urlPath === "/icon.svg") {');
  lines.push('    res.writeHead(200, { "Content-Type": "image/svg+xml" });');
  lines.push('    res.end(\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#000"/><text x="256" y="340" font-size="280" text-anchor="middle" fill="#fff" font-family="sans-serif">舞</text></svg>\');');
  lines.push('    return;');
  lines.push('  }');
  // /tess/ 静态文件服务 - 从同目录的 tess/ 文件夹读取
  lines.push('  if (urlPath.indexOf("/tess/") === 0) {');
  lines.push('    var tessFile = urlPath.replace("/tess/", "");');
  lines.push('    if (tessFile.indexOf("..") !== -1 || tessFile.indexOf("/") !== -1) { res.writeHead(403); res.end("Forbidden"); return; }');
  lines.push('    var tessPath = path.join(__dirname, "tess", tessFile);');
  lines.push('    fs.readFile(tessPath, function(err, data) {');
  lines.push('      if (err) { console.error("[tess] 文件未找到: " + tessFile); res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 Not Found"); return; }');
  lines.push('      var tessExt = path.extname(tessFile).toLowerCase();');
  lines.push('      var tessMime = MIME[tessExt] || "application/octet-stream";');
  lines.push('      res.writeHead(200, { "Content-Type": tessMime, "Content-Length": data.length, "Cache-Control": "no-cache" });');
  lines.push('      res.end(data);');
  lines.push('    });');
  lines.push('    return;');
  lines.push('  }');
  lines.push('  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });');
  lines.push('  res.end("404 Not Found");');
  lines.push('}');
  lines.push('');
  // ========== 启动 ==========
  lines.push('var actualPort = PORT;');
  lines.push('var tryingPort = PORT;');
  lines.push('var retryCount = 0;');
  lines.push('server.on("error", function(e) {');
  lines.push('  if (e.code === "EADDRINUSE" && retryCount < 10) {');
  lines.push('    retryCount++;');
  lines.push('    tryingPort = PORT + retryCount;');
  lines.push('    console.log("[!] 端口 " + PORT + " 被占用，尝试 " + tryingPort + " ...");');
  lines.push('    server.listen(tryingPort);');
  lines.push('  } else { console.error("服务器错误: " + e.message); process.exit(1); }');
  lines.push('});');
  lines.push('server.on("listening", function() {');
  lines.push('  actualPort = server.address().port;');
  lines.push('  console.log("═══════════════════════════════════════════════════");');
  lines.push('  console.log("  舞台流程表 服务器已启动");');
  lines.push('  console.log("═══════════════════════════════════════════════════");');
  lines.push('  console.log("");');
  lines.push('  console.log("  本机访问:  http://localhost:" + actualPort);');
  lines.push('  if (localIPs.length > 0) { localIPs.forEach(function(ip) { console.log("  局域网访问: http://" + ip + ":" + actualPort); }); }');
  lines.push('  if (oscEnabled) console.log("  OSC 监听:  UDP " + OSC_PORT);');
  lines.push('  console.log("");');
  lines.push('  console.log("  按 Ctrl+C 停止服务器");');
  lines.push('  console.log("═══════════════════════════════════════════════════");');
  lines.push('});');
  lines.push('server.listen(tryingPort);');
  lines.push('');
  return lines.join('\n');
}

// ========== 平台启动脚本 ==========
function generateWindowsLauncher() {
  return [
    '@echo off',
    'chcp 65001 >nul 2>&1',
    'title 舞台流程表',
    'cd /d "%~dp0"',
    '',
    'echo ═══════════════════════════════════════════════════',
    'echo   舞台流程表 - Windows 启动器',
    'echo ═══════════════════════════════════════════════════',
    '',
    ':: 检查 Node.js',
    'where node >nul 2>&1',
    'if %errorlevel% == 0 (',
    '  echo [v] Node.js 已安装',
    '  goto :START',
    ') else (',
    '  echo [!] 未检测到 Node.js，正在下载安装...',
    '  echo     请等待安装完成后重新运行此脚本',
    '  if exist "%TEMP%\\node-installer.msi" del "%TEMP%\\node-installer.msi"',
    '  powershell -Command "Invoke-WebRequest -Uri \'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi\' -OutFile \'%TEMP%\\node-installer.msi\'"',
    '  if exist "%TEMP%\\node-installer.msi" (',
    '    echo [+] 正在安装 Node.js...',
    '    msiexec /i "%TEMP%\\node-installer.msi" /qn',
    '    timeout /t 5 /nobreak >nul',
    '    echo [v] Node.js 安装完成',
    '    del "%TEMP%\\node-installer.msi"',
    '    goto :START',
    '  ) else (',
    '    echo [x] 下载失败，请手动安装 Node.js: https://nodejs.org/',
    '    pause',
    '    exit /b 1',
    '  )',
    ')',
    '',
    ':START',
    'echo.',
    'echo [+] 正在启动服务器...',
    'echo.',
    'start "" "http://localhost:3000"',
    'node "%~dp0server-standalone.js"',
    'pause'
  ].join('\r\n');
}

function generateMacLauncher(arch) {
  var nodeUrl = arch === 'arm64' 
    ? 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-darwin-arm64.tar.gz'
    : 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-darwin-x64.tar.gz';
  var nodeName = arch === 'arm64' ? 'node-v20.18.1-darwin-arm64' : 'node-v20.18.1-darwin-x64';
  
  return [
    '#!/bin/bash',
    'cd "$(dirname "$0")"',
    '',
    'echo "═══════════════════════════════════════════════════"',
    'echo "  舞台流程表 - macOS (' + (arch === 'arm64' ? 'Apple Silicon' : 'Intel') + ')"',
    'echo "═══════════════════════════════════════════════════"',
    '',
    '# 检查 Node.js',
    'if command -v node &>/dev/null; then',
    '  echo "[v] Node.js 已安装: $(node -v)"',
    'else',
    '  echo "[!] 未检测到 Node.js，正在下载安装..."',
    '  curl -L "' + nodeUrl + '" -o /tmp/node.tar.gz',
    '  sudo tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1',
    '  rm -f /tmp/node.tar.gz',
    '  echo "[v] Node.js 安装完成: $(node -v)"',
    'fi',
    '',
    'echo ""',
    'echo "[+] 正在启动服务器..."',
    'echo ""',
    '',
    '# 打开浏览器',
    'open "http://localhost:3000" &',
    '',
    'node "$(dirname "$0")/server-standalone.js"',
    ''
  ].join('\n');
}

function generateLinuxLauncher() {
  return [
    '#!/bin/bash',
    'cd "$(dirname "$0")"',
    '',
    'echo "═══════════════════════════════════════════════════"',
    'echo "  舞台流程表 - Linux"',
    'echo "═══════════════════════════════════════════════════"',
    '',
    '# 检查 Node.js',
    'if command -v node &>/dev/null; then',
    '  echo "[v] Node.js 已安装: $(node -v)"',
    'else',
    '  echo "[!] 未检测到 Node.js，正在下载安装..."',
    '  ARCH=$(uname -m)',
    '  if [ "$ARCH" = "x86_64" ]; then NODE_ARCH="linux-x64";',
    '  elif [ "$ARCH" = "aarch64" ]; then NODE_ARCH="linux-arm64";',
    '  elif [ "$ARCH" = "armv7l" ]; then NODE_ARCH="linux-armv7l";',
    '  else echo "[x] 不支持的架构: $ARCH"; exit 1; fi',
    '  curl -L "https://nodejs.org/dist/v20.18.1/node-v20.18.1-${NODE_ARCH}.tar.xz" -o /tmp/node.tar.xz',
    '  sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1',
    '  rm -f /tmp/node.tar.xz',
    '  echo "[v] Node.js 安装完成: $(node -v)"',
    'fi',
    '',
    'echo ""',
    'echo "[+] 正在启动服务器..."',
    'echo ""',
    '',
    '# 打开浏览器',
    'if command -v xdg-open &>/dev/null; then xdg-open "http://localhost:3000" & fi',
    '',
    'node "$(dirname "$0")/server-standalone.js"',
    ''
  ].join('\n');
}

function generateTermuxLauncher() {
  return [
    '#!/bin/bash',
    'cd "$(dirname "$0")"',
    '',
    'echo "═══════════════════════════════════════════════════"',
    'echo "  舞台流程表 - Android Termux"',
    'echo "═══════════════════════════════════════════════════"',
    '',
    '# 检查 Node.js',
    'if command -v node &>/dev/null; then',
    '  echo "[v] Node.js 已安装: $(node -v)"',
    'else',
    '  echo "[!] 未检测到 Node.js，正在安装..."',
    '  pkg update -y && pkg install -y nodejs',
    '  echo "[v] Node.js 安装完成: $(node -v)"',
    'fi',
    '',
    'echo ""',
    'echo "[+] 正在启动服务器..."',
    'echo ""',
    'echo "  在手机浏览器打开: http://localhost:3000"',
    'echo ""',
    '',
    'node "$(dirname "$0")/server-standalone.js"',
    ''
  ].join('\n');
}

function generateOpenWrtLauncher() {
  return [
    '#!/bin/sh',
    'cd "$(dirname "$0")"',
    '',
    'echo "═══════════════════════════════════════════════════"',
    'echo "  舞台流程表 - OpenWrt"',
    'echo "═══════════════════════════════════════════════════"',
    '',
    '# 检查 Node.js',
    'if command -v node &>/dev/null; then',
    '  echo "[v] Node.js 已安装: $(node -v)"',
    'else',
    '  echo "[!] Node.js not found"',
    '  echo "    Install: opkg update && opkg install node"',
    '  exit 1',
    'fi',
    '',
    'echo ""',
    'echo "[+] 正在启动服务器..."',
    'echo ""',
    '',
    'node "$(dirname "$0")/server-standalone.js"',
    ''
  ].join('\n');
}

function generateReadme() {
  return [
    '═══════════════════════════════════════════════════════',
    '  舞台流程表 - 安装使用说明',
    '═══════════════════════════════════════════════════════',
    '',
    '【文件列表】',
    '  server-standalone.js    独立服务器（内含网页和WebSocket）',
    '  tess/                   PDF.js 和 OCR 引擎文件（离线）',
    '  启动-Windows.bat        Windows 启动脚本',
    '  启动-macOS-Intel.command  macOS Intel 启动脚本',
    '  启动-macOS-ARM.command    macOS Apple Silicon 启动脚本',
    '  启动-Linux.sh           Linux 启动脚本',
    '  启动-Termux.sh          Android Termux 启动脚本',
    '  启动-OpenWrt.sh         OpenWrt 启动脚本',
    '',
    '【使用方法】',
    '',
    '  1. 解压此 ZIP 到任意文件夹',
    '  2. 双击对应平台的启动脚本',
    '     - Windows: 双击「启动-Windows.bat」',
    '     - macOS: 双击「启动-macOS-ARM.command」(Apple Silicon) 或',
    '              「启动-macOS-Intel.command」(Intel)',
    '     - Linux: 在终端运行 bash 启动-Linux.sh',
    '     - Android: 在 Termux 中运行 bash 启动-Termux.sh',
    '     - OpenWrt: 在 SSH 中运行 sh 启动-OpenWrt.sh',
    '  3. 浏览器会自动打开页面',
    '  4. 同一局域网的其他设备可访问显示的 IP 地址',
    '',
    '【端口配置】',
    '  在页面右上角点击 🎹 图标',
    '  → 「设置」标签页可修改服务器端口和 OSC 端口',
    '  → 修改后需重启服务器生效',
    '',
    '【OSC 控制】',
    '  OSC UDP 端口: 5300（可在设置中修改）',
    '  支持的地址:',
    '    /stage/go     - GO（完成当前，前进到下一个）',
    '    /stage/next    - 下一个节目',
    '    /stage/prev    - 上一个节目',
    '    /stage/goto N  - 跳转到第 N 个节目',
    '',
    '【MIDI 控制】',
    '  需使用 Chrome/Edge 浏览器',
    '  在设置面板中可学习 MIDI 控制映射',
    '',
    '【PDF 导入和 OCR】',
    '  PDF.js 和 Tesseract OCR 已内置（离线可用）',
    '  支持导入 PDF 文件并自动 OCR 识别中文/英文',
    '',
    '【注意事项】',
    '  - tess/ 文件夹必须与 server-standalone.js 在同一目录',
    '  - 首次运行会自动安装 Node.js（如未安装）',
    '  - 数据保存在同目录的 show.json 文件中',
    ''
  ].join('\n');
}
