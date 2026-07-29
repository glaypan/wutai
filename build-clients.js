// build-clients.js - 生成跨平台安装脚本
// 创建 Windows (.bat) 和 macOS (.command) 安装脚本
// 脚本内嵌完整服务器代码 + HTML + ws模块，运行时自动检查并安装 Node.js
// 安装后零依赖，无需 npm install

var fs = require('fs');
var path = require('path');

var DOWNLOAD_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// 读取 HTML 内容
var htmlContent = fs.readFileSync(path.join(__dirname, '舞台流程表.html'), 'utf-8');

// 读取 ws 模块所有文件
var wsFiles = {};
var wsRoot = path.join(__dirname, 'node_modules', 'ws');
try {
  // ws/index.js
  wsFiles['index.js'] = fs.readFileSync(path.join(wsRoot, 'index.js'), 'utf-8');
  // ws/browser.js
  wsFiles['browser.js'] = fs.readFileSync(path.join(wsRoot, 'browser.js'), 'utf-8');
  // ws/package.json
  wsFiles['package.json'] = fs.readFileSync(path.join(wsRoot, 'package.json'), 'utf-8');
  // ws/lib/*.js
  var wsLibDir = path.join(wsRoot, 'lib');
  fs.readdirSync(wsLibDir).forEach(function(f) {
    if (f.endsWith('.js')) {
      wsFiles['lib/' + f] = fs.readFileSync(path.join(wsLibDir, f), 'utf-8');
    }
  });
  console.log('[v] 已读取 ws 模块: ' + Object.keys(wsFiles).length + ' 个文件');
} catch(e) {
  console.error('[!] 无法读取 ws 模块: ' + e.message);
  process.exit(1);
}

// 读取 Tesseract OCR 数据文件（二进制，base64 编码嵌入）
var tessFiles = {};
var tessDir = path.join(__dirname, 'tess');
try {
  fs.readdirSync(tessDir).forEach(function(f) {
    var filePath = path.join(tessDir, f);
    var stat = fs.statSync(filePath);
    if (stat.isFile()) {
      var data = fs.readFileSync(filePath);
      tessFiles[f] = data.toString('base64');
    }
  });
  var tessTotal = Object.keys(tessFiles).reduce(function(sum, k) { return sum + tessFiles[k].length; }, 0);
  console.log('[v] 已读取 OCR 数据: ' + Object.keys(tessFiles).length + ' 个文件, ' + (tessTotal / 1024 / 1024).toFixed(1) + ' MB (base64)');
} catch(e) {
  console.error('[!] 无法读取 OCR 数据: ' + e.message);
}

// ========== 生成自包含服务器脚本 ==========
var standaloneServer = generateStandaloneServer(htmlContent, wsFiles, tessFiles);
var serverB64 = Buffer.from(standaloneServer).toString('base64');

console.log('\n═══════════════════════════════════════════════════');
console.log('  舞台流程表 - 跨平台安装包构建');
console.log('═══════════════════════════════════════════════════\n');
console.log('服务器脚本: ' + (standaloneServer.length / 1024).toFixed(1) + ' KB');
console.log('Base64 编码: ' + (serverB64.length / 1024).toFixed(1) + ' KB');

// 分块
var CHUNK_SIZE = 4000;
var b64Lines = [];
for (var i = 0; i < serverB64.length; i += CHUNK_SIZE) {
  b64Lines.push(serverB64.substring(i, i + CHUNK_SIZE));
}
console.log('分块: ' + b64Lines.length + ' 行\n');

// ========== Windows ==========
var winBat = generateWindowsInstaller(b64Lines);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-win.bat'), winBat, 'utf-8');
console.log('✅ Windows: downloads/stage-manager-win.bat (' + (winBat.length / 1024).toFixed(0) + ' KB)');

// ========== macOS ==========
var macSh = generateMacInstaller(b64Lines);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-macos-intel.command'), macSh, 'utf-8');
fs.chmodSync(path.join(DOWNLOAD_DIR, 'stage-manager-macos-intel.command'), 0o755);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-macos-arm64.command'), macSh, 'utf-8');
fs.chmodSync(path.join(DOWNLOAD_DIR, 'stage-manager-macos-arm64.command'), 0o755);
console.log('✅ macOS Intel: downloads/stage-manager-macos-intel.command');
console.log('✅ macOS ARM:   downloads/stage-manager-macos-arm64.command');

// ========== Linux (x64/ARMv7/ARM64 - 树莓派等) ==========
var linuxSh = generateLinuxInstaller(b64Lines);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-linux.sh'), linuxSh, 'utf-8');
fs.chmodSync(path.join(DOWNLOAD_DIR, 'stage-manager-linux.sh'), 0o755);
console.log('✅ Linux (x64/ARM/ARM64): downloads/stage-manager-linux.sh (' + (linuxSh.length / 1024).toFixed(0) + ' KB)');

// ========== Android Termux ==========
var termuxSh = generateTermuxInstaller(b64Lines);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-termux.sh'), termuxSh, 'utf-8');
fs.chmodSync(path.join(DOWNLOAD_DIR, 'stage-manager-termux.sh'), 0o755);
console.log('✅ Android Termux: downloads/stage-manager-termux.sh');

// ========== OpenWrt ==========
var openwrtSh = generateOpenWrtInstaller(b64Lines);
fs.writeFileSync(path.join(DOWNLOAD_DIR, 'stage-manager-openwrt.sh'), openwrtSh, 'utf-8');
fs.chmodSync(path.join(DOWNLOAD_DIR, 'stage-manager-openwrt.sh'), 0o755);
console.log('✅ OpenWrt: downloads/stage-manager-openwrt.sh');

console.log('\n═══════════════════════════════════════════════════');
console.log('  构建完成！启动服务器后页面 ⬇️ 按钮可下载');
console.log('  iOS/Android 浏览器打开后可「添加到主屏幕」安装PWA');
console.log('═══════════════════════════════════════════════════');


// ========== 生成自包含服务器脚本 ==========
function generateStandaloneServer(htmlContent, wsFiles, tessFiles) {
  var htmlB64 = Buffer.from(htmlContent).toString('base64');
  var wsJson = JSON.stringify(wsFiles);
  var tessJson = JSON.stringify(tessFiles);

  var lines = [];
  lines.push('// stage-manager-standalone.js - 自包含服务器');
  lines.push('// 自动生成，内嵌 HTML 和 ws 模块，无需外部依赖');
  lines.push('');
  lines.push('var http = require("http");');
  lines.push('var fs = require("fs");');
  lines.push('var path = require("path");');
  lines.push('var os = require("os");');
  lines.push('');
  // ========== 内嵌数据 ==========
  lines.push('// ========== 内嵌数据 ==========');
  lines.push('var __HTML_B64 = "' + htmlB64 + '";');
  lines.push('var __WS_FILES = ' + wsJson + ';');
  lines.push('var __TESS_FILES = ' + tessJson + ';');
  lines.push('');
  // ========== 启动时写入 ws 模块到临时目录 ==========
  lines.push('// ========== 写入 ws 模块到 node_modules ==========');
  lines.push('(function() {');
  lines.push('  var wsDir = path.join(process.cwd(), "node_modules", "ws");');
  lines.push('  var wsLibDir = path.join(wsDir, "lib");');
  lines.push('  try {');
  lines.push('    if (!fs.existsSync(wsDir)) {');
  lines.push('      fs.mkdirSync(wsDir, { recursive: true });');
  lines.push('    }');
  lines.push('    if (!fs.existsSync(wsLibDir)) {');
  lines.push('      fs.mkdirSync(wsLibDir, { recursive: true });');
  lines.push('    }');
  lines.push('    Object.keys(__WS_FILES).forEach(function(relPath) {');
  lines.push('      var fullPath = path.join(wsDir, relPath);');
  lines.push('      var fullDir = path.dirname(fullPath);');
  lines.push('      if (!fs.existsSync(fullDir)) {');
  lines.push('        fs.mkdirSync(fullDir, { recursive: true });');
  lines.push('      }');
  lines.push('      if (!fs.existsSync(fullPath)) {');
  lines.push('        fs.writeFileSync(fullPath, __WS_FILES[relPath], "utf-8");');
  lines.push('      }');
  lines.push('    });');
  lines.push('  } catch(e) {');
  lines.push('    console.error("写入 ws 模块失败:", e.message);');
  lines.push('  }');
  lines.push('})();');
  lines.push('');
  // ========== 启动时写入 tess 文件到磁盘 ==========
  lines.push('// ========== 写入 tess 文件到磁盘（PDF.js + OCR）==========');
  lines.push('(function() {');
  lines.push('  var tessDir = path.join(process.cwd(), "tess");');
  lines.push('  try {');
  lines.push('    if (!fs.existsSync(tessDir)) {');
  lines.push('      fs.mkdirSync(tessDir, { recursive: true });');
  lines.push('    }');
  lines.push('    var fileCount = 0;');
  lines.push('    Object.keys(__TESS_FILES).forEach(function(filename) {');
  lines.push('      var filePath = path.join(tessDir, filename);');
  lines.push('      if (!fs.existsSync(filePath)) {');
  lines.push('        var data = Buffer.from(__TESS_FILES[filename], "base64");');
  lines.push('        fs.writeFileSync(filePath, data);');
  lines.push('        fileCount++;');
  lines.push('      }');
  lines.push('    });');
  lines.push('    if (fileCount > 0) {');
  lines.push('      console.log("[tess] 已写入 " + fileCount + " 个文件到 " + tessDir);');
  lines.push('    } else {');
  lines.push('      console.log("[tess] 文件已存在，跳过写入");');
  lines.push('    }');
  lines.push('  } catch(e) {');
  lines.push('    console.error("[tess] 写入文件失败:", e.message);');
  lines.push('  }');
  lines.push('})();');
  lines.push('');
  lines.push('');
  lines.push('var HTML_CONTENT = Buffer.from(__HTML_B64, "base64").toString("utf-8");');
  lines.push('var { WebSocketServer, WebSocket } = require("ws");');
  lines.push('');
  // ========== 配置文件 ==========
  lines.push('// ========== 配置文件 ==========');
  lines.push('var CONFIG_FILE = path.join(process.cwd(), "config.json");');
  lines.push('function loadConfig() {');
  lines.push('  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")); } catch(e) {}');
  lines.push('  return {};');
  lines.push('}');
  lines.push('function saveConfig(cfg) {');
  lines.push('  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8"); } catch(e) {}');
  lines.push('}');
  lines.push('var _config = loadConfig();');
  lines.push('');
  // ========== 服务器配置 ==========
  lines.push('var PORT = parseInt(process.env.PORT) || _config.port || 3000;');
  lines.push('');
  // ========== 获取局域网IP（过滤虚拟网卡）==========
  lines.push('var VIRTUAL_PREFIXES = ["172.16.","172.17.","172.18.","172.19.","172.20.","172.21.","172.22.","172.23.","172.24.","172.25.","172.26.","172.27.","172.28.","172.29.","172.30.","172.31.","10.147.","10.94.","169.254.","100.64.","100.65.","100.66.","100.67.","100.68.","100.69.","192.0.0.","198.18.","198.19."];');
  lines.push('var VIRTUAL_NAME_HINTS = ["vmware","vmnet","vbox","docker","wsl","hyper-v","vethernet","tailscale","zerotier","tap","tun","utun","bridge","virbr"];');
  lines.push('function isVirtualInterface(name) {');
  lines.push('  var lower = (name || "").toLowerCase();');
  lines.push('  return VIRTUAL_NAME_HINTS.some(function(h) { return lower.indexOf(h) !== -1; });');
  lines.push('}');
  lines.push('function isVirtualIP(addr) {');
  lines.push('  return VIRTUAL_PREFIXES.some(function(p) { return addr.indexOf(p) === 0; });');
  lines.push('}');
  lines.push('function getLocalIPs() {');
  lines.push('  var interfaces = os.networkInterfaces();');
  lines.push('  var real = []; var virtual = [];');
  lines.push('  for (var name in interfaces) {');
  lines.push('    if (isVirtualInterface(name)) continue;');
  lines.push('    interfaces[name].forEach(function(iface) {');
  lines.push('      if (iface.family === "IPv4" && !iface.internal) {');
  lines.push('        if (isVirtualIP(iface.address)) { virtual.push(iface.address); }');
  lines.push('        else { real.push(iface.address); }');
  lines.push('      }');
  lines.push('    });');
  lines.push('  }');
  lines.push('  if (real.length > 0) return real;');
  lines.push('  return virtual;');
  lines.push('}');
  lines.push('');
  lines.push('var localIPs = getLocalIPs();');
  lines.push('var primaryIP = localIPs.length > 0 ? localIPs[0] : "localhost";');
  lines.push('');
  // ========== 数据存储 ==========
  lines.push('var APP_DIR = process.cwd();');
  lines.push('var DATA_FILE = path.join(APP_DIR, "show.json");');
  lines.push('');
  lines.push('var defaultState = {');
  lines.push('  showName: "舞台流程表", mode: "setup", currentProgramIndex: 0,');
  lines.push('  version: 3, globalChannels: { mics: [], lines: [] }, programs: [], subtitle: { lines: [], currentIndex: -1, visible: false }');
  lines.push('};');
  lines.push('');
  lines.push('function loadState() {');
  lines.push('  try {');
  lines.push('    if (fs.existsSync(DATA_FILE)) {');
  lines.push('      var parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));');
  lines.push('      return mergeState(Object.assign({}, defaultState, parsed));');
  lines.push('    }');
  lines.push('  } catch (e) { console.error("加载 show.json 失败:", e.message); }');
  lines.push('  return mergeState(Object.assign({}, defaultState));');
  lines.push('}');
  lines.push('');
  lines.push('function mergeMusicField(p) {');
  lines.push('  var cue = (p.musicCue || "").trim();');
  lines.push('  var node = (p.musicNode || "").trim();');
  lines.push('  if (!node) return cue;');
  lines.push('  return cue ? "\\u3010\\u8282\\u70b9\\u3011" + node + "\\n" + cue : node;');
  lines.push('}');
  lines.push('');
  lines.push('function ensureChannel(ch) {');
  lines.push('  return { id: ch.id || ("ch_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6)),');
  lines.push('    name: ch.name || "", type: ch.type || "", notes: ch.notes || "", customType: ch.customType || "" };');
  lines.push('}');
  lines.push('');
  lines.push('function mergeState(s) {');
  lines.push('  var oldVersion = s.version || 1;');
  lines.push('  var merged = {');
  lines.push('    showName: s.showName || "舞台流程表", mode: s.mode || "setup",');
  lines.push('    currentProgramIndex: s.currentProgramIndex || 0, version: 3,');
  lines.push('    globalChannels: s.globalChannels || { mics: [], lines: [] },');
  lines.push('    programs: (s.programs || []).map(function(p) {');
  lines.push('      var status = p.status; if (!status) { status = p.completed ? "completed" : "pending"; }');
  lines.push('      var duration = p.duration || 0;');
  lines.push('      if (oldVersion < 3 && duration >= 60) { duration = Math.round(duration / 60); }');
  lines.push('      return { name: p.name || "", duration: duration, notes: p.notes || "",');
  lines.push('        musicCue: mergeMusicField(p), status: status,');
  lines.push('        useChannels: p.useChannels || (p.mics ? p.mics.filter(function(m){return m.active;}).map(function(m){return m.name;}) : []) };');
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
  lines.push('');
  lines.push('function saveState() {');
  lines.push('  try { fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8"); }');
  lines.push('  catch (e) { console.error("保存 show.json 失败:", e.message); }');
  lines.push('}');
  lines.push('');
  lines.push('var state = loadState();');
  lines.push('if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) {');
  lines.push('  state.currentProgramIndex = Math.max(0, state.programs.length - 1);');
  lines.push('}');
  lines.push('');
  // ========== 权限 ==========
  lines.push('var FIELD_PERM = {');
  lines.push('  notes: ["control", "assistant", "backstage"],');
  lines.push('  musicCue: ["control", "assistant"],');
  lines.push('  useChannels: ["control", "assistant"]');
  lines.push('};');
  lines.push('function canEditField(role, field) {');
  lines.push('  var allowed = FIELD_PERM[field];');
  lines.push('  return allowed && allowed.indexOf(role) !== -1;');
  lines.push('}');
  lines.push('');
  // ========== HTTP + WebSocket ==========
  lines.push('var server = http.createServer(function(req, res) { serveStatic(req, res); });');
  lines.push('var wss = new WebSocketServer({ server });');
  lines.push('');
  lines.push('wss.on("connection", function(ws) {');
  lines.push('  sendTo(ws, { type: "full_state", state: state, clientCount: wss.clients.size });');
  lines.push('  broadcastClientCount();');
  lines.push('  ws.on("message", function(raw) {');
  lines.push('    var msg; try { msg = JSON.parse(raw.toString()); } catch (e) { return; }');
  lines.push('    handleMessage(ws, msg);');
  lines.push('  });');
  lines.push('  ws.on("close", function() { broadcastClientCount(); });');
  lines.push('});');
  lines.push('');
  lines.push('function handleMessage(ws, msg) {');
  lines.push('  var role = msg.role || "control";');
  lines.push('  switch (msg.type) {');
  lines.push('    case "get_state": broadcastFullState(); break;');
  lines.push('    case "update_state":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "update_state");');
  lines.push('      if (msg.data && typeof msg.data === "object") {');
  lines.push('        state = mergeState(Object.assign({}, state, msg.data));');
  lines.push('        if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1)');
  lines.push('          state.currentProgramIndex = Math.max(0, state.programs.length - 1);');
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
  lines.push('      if (typeof msg.idx === "number" && state.programs[msg.idx]) {');
  lines.push('        state.programs[msg.idx].status = "pending"; saveState(); broadcastFullState();');
  lines.push('      } break;');
  lines.push('    case "update_program_field":');
  lines.push('      if (!canEditField(role, msg.field)) return sendError(ws, "forbidden", "update_program_field");');
  lines.push('      if (typeof msg.idx === "number" && state.programs[msg.idx]) {');
  lines.push('        state.programs[msg.idx][msg.field] = msg.value; saveState(); broadcastFullState();');
  lines.push('      } break;');
  lines.push('    case "import_programs":');
  lines.push('      if (role !== "control") return sendError(ws, "forbidden", "import_programs");');
  lines.push('      var newProgs = (msg.programs || []).map(function(p) {');
  lines.push('        return { name: p.name || "", duration: p.duration || 0, notes: p.notes || "",');
  lines.push('          musicCue: p.musicCue || "", status: p.status || "pending", useChannels: p.useChannels || [] };');
  lines.push('      });');
  lines.push('      if (msg.mode === "replace") { state.programs = newProgs; state.currentProgramIndex = 0; }');
  lines.push('      else { state.programs = state.programs.concat(newProgs); }');
  lines.push('      saveState(); broadcastFullState(); break;');
  // ---------- 字幕功能 ----------
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
  lines.push('function doAdvance() {');
  lines.push('  var idx = state.currentProgramIndex;');
  lines.push('  if (idx >= 0 && idx < state.programs.length) state.programs[idx].status = "completed";');
  lines.push('  var nextIdx = Math.min(idx + 1, Math.max(0, state.programs.length - 1));');
  lines.push('  state.currentProgramIndex = nextIdx;');
  lines.push('  if (state.programs[nextIdx] && state.programs[nextIdx].status !== "completed") state.programs[nextIdx].status = "active";');
  lines.push('  saveState(); broadcastFullState();');
  lines.push('}');
  lines.push('function doNav(dir) {');
  lines.push('  var idx = state.currentProgramIndex; var newIdx = idx + dir;');
  lines.push('  if (newIdx < 0) newIdx = 0;');
  lines.push('  if (newIdx > state.programs.length - 1) newIdx = Math.max(0, state.programs.length - 1);');
  lines.push('  state.currentProgramIndex = newIdx;');
  lines.push('  if (state.programs[newIdx] && state.programs[newIdx].status !== "completed") state.programs[newIdx].status = "active";');
  lines.push('  saveState(); broadcastFullState();');
  lines.push('}');
  lines.push('');
  lines.push('function sendTo(ws, obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }');
  lines.push('function sendError(ws, code, action) { sendTo(ws, { type: "error", code: code, action: action }); }');
  lines.push('function broadcast(obj) { var data = JSON.stringify(obj); wss.clients.forEach(function(c) { if (c.readyState === WebSocket.OPEN) c.send(data); }); }');
  lines.push('function broadcastFullState() { broadcast({ type: "full_state", state: state, clientCount: wss.clients.size }); }');
  lines.push('function broadcastClientCount() { broadcast({ type: "client_count", count: wss.clients.size }); }');
  lines.push('');
  // ========== OSC 控制 (UDP, 零依赖) ==========
  lines.push('var OSC_PORT = parseInt(process.env.OSC_PORT) || _config.oscPort || 5300;');
  lines.push('var oscEnabled = process.env.OSC_DISABLE !== "1";');
  lines.push('function parseOscMessage(buf) {');
  lines.push('  try { var offset = 0; var addrEnd = buf.indexOf(0, offset);');
  lines.push('  if (addrEnd < 0) return null; var address = buf.toString("ascii", offset, addrEnd);');
  lines.push('  offset = Math.ceil((addrEnd + 1) / 4) * 4; var tagEnd = buf.indexOf(0, offset);');
  lines.push('  if (tagEnd < 0) return { address: address, args: [] };');
  lines.push('  var tags = buf.toString("ascii", offset + 1, tagEnd);');
  lines.push('  offset = Math.ceil((tagEnd + 1) / 4) * 4; var args = [];');
  lines.push('  for (var i = 0; i < tags.length; i++) {');
  lines.push('    if (tags[i] === "i") { args.push(buf.readInt32BE(offset)); offset += 4; }');
  lines.push('    else if (tags[i] === "f") { args.push(buf.readFloatBE(offset)); offset += 4; }');
  lines.push('    else if (tags[i] === "s") { var sEnd = buf.indexOf(0, offset); if (sEnd < 0) break;');
  lines.push('      args.push(buf.toString("utf-8", offset, sEnd)); offset = Math.ceil((sEnd + 1) / 4) * 4; }');
  lines.push('  } return { address: address, args: args }; } catch(e) { return null; } }');
  lines.push('function handleOscMessage(msg) {');
  lines.push('  var addr = (msg.address || "").toLowerCase();');
  lines.push('  if (addr === "/stage/go" || addr === "/go") { doAdvance(); }');
  lines.push('  else if (addr === "/stage/next" || addr === "/next") { doNav(1); }');
  lines.push('  else if (addr === "/stage/prev" || addr === "/prev") { doNav(-1); }');
  lines.push('  else if ((addr === "/stage/goto" || addr === "/goto") && msg.args.length > 0) {');
  lines.push('    var t = parseInt(msg.args[0]); if (!isNaN(t) && t >= 0 && t <= state.programs.length - 1) {');
  lines.push('      state.currentProgramIndex = t; if (state.programs[t]) state.programs[t].status = "active";');
  lines.push('      saveState(); broadcastFullState(); } } }');
  lines.push('var oscSocket = null;');
  lines.push('if (oscEnabled) { try {');
  lines.push('  var dgram = require("dgram"); oscSocket = dgram.createSocket("udp4");');
  lines.push('  oscSocket.on("message", function(buf) { var m = parseOscMessage(buf); if (m && m.address) handleOscMessage(m); });');
  lines.push('  oscSocket.on("error", function(e) { console.error("[OSC] " + e.message); });');
  lines.push('  oscSocket.bind(OSC_PORT, function() { console.log("[OSC] UDP 监听端口 " + OSC_PORT); });');
  lines.push('} catch(e) { console.error("[OSC] 启动失败: " + e.message); } }');
  lines.push('');
  // ========== 静态文件服务 ==========
  lines.push('function serveStatic(req, res) {');
  lines.push('  var urlPath = decodeURIComponent((req.url || "/").split("?")[0]);');
  lines.push('  if (urlPath === "/api/server-info") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('    res.end(JSON.stringify({ ip: primaryIP, port: actualPort, ips: localIPs, oscPort: oscEnabled ? OSC_PORT : null }));');
  lines.push('    return;');
  lines.push('  }');
  // API: 端口配置
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
  lines.push('  if (urlPath === "/" || urlPath === "/index.html") {');
  lines.push('    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });');
  lines.push('    res.end(HTML_CONTENT);');
  lines.push('    return;');
  lines.push('  }');
  // PWA: manifest.json
  lines.push('  if (urlPath === "/manifest.json") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });');
  lines.push('    res.end(JSON.stringify({ name: "舞台流程表", short_name: "舞台流程", display: "standalone", background_color: "#000", theme_color: "#000", start_url: "/?role=control", scope: "/", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] }));');
  lines.push('    return;');
  lines.push('  }');
  // PWA: Service Worker
  lines.push('  if (urlPath === "/sw.js") {');
  lines.push('    res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });');
  lines.push('    res.end("var CACHE=\\\'stage-manager-v2\\\';self.addEventListener(\\\'install\\\',function(e){self.skipWaiting();});self.addEventListener(\\\'activate\\\',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});self.addEventListener(\\\'fetch\\\',function(e){if(e.request.method!==\\\'GET\\\')return;if(e.request.url.indexOf(\\\'/tess/\\\')!==-1){e.respondWith(fetch(e.request));return;}e.respondWith(caches.open(CACHE).then(function(c){return c.match(e.request).then(function(f){var p=fetch(e.request).then(function(r){if(r.ok)c.put(e.request,r.clone());return r;}).catch(function(){return f;});return p;});}));});");');
  lines.push('    return;');
  lines.push('  }');
  // PWA: App Icon (SVG)
  lines.push('  if (urlPath === "/icon.svg") {');
  lines.push('    res.writeHead(200, { "Content-Type": "image/svg+xml" });');
  lines.push('    res.end(\'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#000"/><text x="256" y="340" font-size="280" text-anchor="middle" fill="#fff" font-family="sans-serif">舞</text></svg>\');');
  lines.push('    return;');
  lines.push('  }');
  // /tess/ 静态文件服务（从磁盘读取，完全离线）
  lines.push('  if (urlPath.indexOf("/tess/") === 0) {');
  lines.push('    var tessFile = urlPath.replace("/tess/", "");');
  lines.push('    if (tessFile.indexOf("..") !== -1 || tessFile.indexOf("/") !== -1) {');
  lines.push('      res.writeHead(403); res.end("Forbidden"); return;');
  lines.push('    }');
  lines.push('    var tessPath = path.join(process.cwd(), "tess", tessFile);');
  lines.push('    fs.readFile(tessPath, function(err, data) {');
  lines.push('      if (err) {');
  lines.push('        console.error("[tess] 文件未找到: " + tessFile);');
  lines.push('        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });');
  lines.push('        res.end("404 Not Found");');
  lines.push('        return;');
  lines.push('      }');
  lines.push('      var tessExt = path.extname(tessFile).toLowerCase();');
  lines.push('      var tessMime = {".js":"application/javascript; charset=utf-8",".gz":"application/gzip",".wasm":"application/wasm"}[tessExt] || "application/octet-stream";');
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
  lines.push('var MAX_RETRIES = 5;');
  lines.push('');
  lines.push('function killProcessOnPort(port, callback) {');
  lines.push('  var exec = require("child_process").exec;');
  lines.push('  var platform = process.platform;');
  lines.push('  var myPid = String(process.pid);');
  lines.push('  if (platform === "win32") {');
  lines.push('    exec("netstat -ano | findstr :" + port, function(err, stdout) {');
  lines.push('      if (err || !stdout) { callback(); return; }');
  lines.push('      var lines = stdout.trim().split("\\n");');
  lines.push('      var pids = [];');
  lines.push('      lines.forEach(function(line) {');
  lines.push('        if (line.indexOf("LISTENING") !== -1) {');
  lines.push('          var parts = line.trim().split(/\\s+/);');
  lines.push('          var pid = parts[parts.length - 1];');
  lines.push('          if (pid && pid !== myPid && pids.indexOf(pid) === -1) pids.push(pid);');
  lines.push('        }');
  lines.push('      });');
  lines.push('      if (pids.length === 0) { callback(); return; }');
  lines.push('      exec("taskkill /F /PID " + pids.join(" /PID "), function() { callback(); });');
  lines.push('    });');
  lines.push('  } else {');
  lines.push('    var cmd = "lsof -ti:" + port + " 2>/dev/null | grep -v " + myPid + " | xargs kill -9 2>/dev/null";');
  lines.push('    if (platform !== "darwin") cmd += "; fuser -k " + port + "/tcp 2>/dev/null || true";');
  lines.push('    exec(cmd, function() { callback(); });');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push('function startListening(port) {');
  lines.push('  tryingPort = port;');
  lines.push('  try { server.close(); } catch(e) {}');
  lines.push('  server.listen(port);');
  lines.push('}');
  lines.push('');
  lines.push('function handleServerError(e) {');
  lines.push('  if (e.code === "EADDRINUSE" && retryCount < MAX_RETRIES) {');
  lines.push('    retryCount++;');
  lines.push('    if (retryCount === 1) {');
  lines.push('      console.log("");');
  lines.push('      console.log("[!] 检测到端口 " + tryingPort + " 被占用");');
  lines.push('      console.log("[!] 正在自动清理旧进程...");');
  lines.push('      killProcessOnPort(tryingPort, function() {');
  lines.push('        setTimeout(function() {');
  lines.push('          console.log("[i] 正在重新启动服务器...");');
  lines.push('          startListening(PORT);');
  lines.push('        }, 1000);');
  lines.push('      });');
  lines.push('    } else {');
  lines.push('      var nextPort = PORT + retryCount - 1;');
  lines.push('      console.log("[!] 端口 " + tryingPort + " 仍被占用，尝试端口 " + nextPort + "...");');
  lines.push('      startListening(nextPort);');
  lines.push('    }');
  lines.push('  } else if (e.code === "EACCES") {');
  lines.push('    console.error("[!] 权限不足，无法绑定端口 " + tryingPort);');
  lines.push('    process.exit(1);');
  lines.push('  } else {');
  lines.push('    console.error("[!] 服务器错误: " + e.message);');
  lines.push('    process.exit(1);');
  lines.push('  }');
  lines.push('}');
  lines.push('');
  lines.push('wss.on("error", handleServerError);');
  lines.push('');
  lines.push('server.on("listening", function() {');
  lines.push('  actualPort = server.address().port;');
  lines.push('  console.log("");');
  lines.push('  console.log("==================================================");');
  lines.push('  console.log("  舞台流程表 - 桌面客户端已启动");');
  lines.push('  console.log("==================================================");');
  lines.push('  console.log("");');
  lines.push('  console.log("  ✅ 服务器已启动，其他设备可通过以下地址访问：");');
  lines.push('  console.log("");');
  lines.push('  console.log("  本机: http://localhost:" + actualPort);');
  lines.push('  if (localIPs.length > 0) {');
  lines.push('    localIPs.forEach(function(ip) {');
  lines.push('      console.log("  局域网: http://" + ip + ":" + actualPort);');
  lines.push('    });');
  lines.push('  }');
  lines.push('  console.log("");');
  lines.push('  console.log("  📱 控制端:   http://" + (localIPs[0]||"localhost") + ":" + actualPort + "/?role=control");');
  lines.push('  console.log("  🎬 导演端:   http://" + (localIPs[0]||"localhost") + ":" + actualPort + "/?role=director");');
  lines.push('  console.log("  🎭 助理端:   http://" + (localIPs[0]||"localhost") + ":" + actualPort + "/?role=assistant");');
  lines.push('  console.log("  📋 幕后端:   http://" + (localIPs[0]||"localhost") + ":" + actualPort + "/?role=backstage");');
  lines.push('  console.log("  🖥️ 提示屏:   http://" + (localIPs[0]||"localhost") + ":" + actualPort + "/?role=screen");');
  lines.push('  console.log("");');
  lines.push('  console.log("  💾 数据文件: " + DATA_FILE);');
  lines.push('  if (actualPort !== PORT) {');
  lines.push('    console.log("");');
  lines.push('    console.log("  [i] 注意: 默认端口 " + PORT + " 被占用，已自动切换到 " + actualPort);');
  lines.push('  }');
  lines.push('  console.log("");');
  lines.push('  console.log("  按 Ctrl+C 停止服务器");');
  lines.push('  console.log("");');
  lines.push('  // 自动打开浏览器');
  lines.push('  var url = "http://localhost:" + actualPort + "/?role=control";');
  lines.push('  var platform = os.platform();');
  lines.push('  var openCmd;');
  lines.push('  if (platform === "win32") { openCmd = "start \\"\\" \\"" + url + "\\""; }');
  lines.push('  else if (platform === "darwin") { openCmd = "open \\"" + url + "\\""; }');
  lines.push('  else { openCmd = "xdg-open \\"" + url + "\\""; }');
  lines.push('  try { require("child_process").exec(openCmd); } catch(e) {}');
  lines.push('});');
  lines.push('');
  lines.push('startListening(PORT);');
  lines.push('');
  lines.push('process.on("SIGINT", function() { console.log("\\n正在关闭服务器..."); process.exit(0); });');
  lines.push('');

  return lines.join('\n');
}


// ========== Windows 安装脚本 ==========
function generateWindowsInstaller(b64Lines) {
  var L = [];
  L.push('@echo off');
  L.push('chcp 65001 >nul 2>&1');
  L.push('title 舞台流程表 - 服务器');
  L.push('setlocal enabledelayedexpansion');
  L.push('');
  L.push('echo.');
  L.push('echo ==================================================');
  L.push('echo   舞台流程表 - Windows 服务器启动器');
  L.push('echo ==================================================');
  L.push('echo.');
  L.push('');
  // 自动识别脚本所在目录（支持中文路径、空格、特殊字符）
  L.push('echo [i] 脚本所在目录: %~dp0');
  L.push('set "SCRIPT_DIR=%~dp0"');
  L.push('set "APP_DIR=%SCRIPT_DIR%stage-manager"');
  L.push('echo [i] 工作目录: %APP_DIR%');
  L.push('if not exist "%APP_DIR%" mkdir "%APP_DIR%"');
  L.push('cd /d "%APP_DIR%"');
  L.push('');
  // 检查 Node.js
  L.push('where node >nul 2>&1');
  L.push('if %errorlevel% neq 0 (');
  L.push('  echo [!] 未检测到 Node.js，正在自动下载...');
  L.push('  set "NODE_VER=v18.20.4"');
  L.push('  set "NODE_URL=https://nodejs.org/dist/!NODE_VER!/node-!NODE_VER!-win-x64.zip"');
  L.push('  set "NODE_ZIP=%TEMP%\\nodejs.zip"');
  L.push('  set "NODE_DIR=%LOCALAPPDATA%\\StageManager\\nodejs"');
  L.push('  echo [+] 下载 Node.js !NODE_VER! ...');
  L.push('  curl -L -o "!NODE_ZIP!" "!NODE_URL!"');
  L.push('  if !errorlevel! neq 0 (');
  L.push('    echo [X] Node.js 下载失败，请手动安装: https://nodejs.org/');
  L.push('    pause');
  L.push('    exit /b 1');
  L.push('  )');
  L.push('  echo [+] 解压 Node.js ...');
  L.push('  if not exist "%LOCALAPPDATA%\\StageManager" mkdir "%LOCALAPPDATA%\\StageManager"');
  L.push('  if not exist "%TEMP%\\node_extract" mkdir "%TEMP%\\node_extract"');
  L.push('  tar -xf "!NODE_ZIP!" -C "%TEMP%\\node_extract"');
  L.push('  if not exist "!NODE_DIR!" mkdir "!NODE_DIR!"');
  L.push('  xcopy /E /I /Y "%TEMP%\\node_extract\\node-!NODE_VER!-win-x64\\*" "!NODE_DIR!" >nul 2>&1');
  L.push('  set "PATH=!NODE_DIR!;%PATH%"');
  L.push('  echo [v] Node.js 安装完成:');
  L.push('  "!NODE_DIR!\\node.exe" --version');
  L.push(') else (');
  L.push('  echo [v] Node.js 已安装:');
  L.push('  node --version');
  L.push(')');
  L.push('');
  // 写入 base64
  L.push('echo [+] 写入服务器文件 (共 ' + b64Lines.length + ' 段)...');
  L.push('set "B64_FILE=%TEMP%\\stage_manager_server.b64"');
  L.push('');
  L.push('> "%B64_FILE%" echo ' + b64Lines[0]);
  for (var i = 1; i < b64Lines.length; i++) {
    L.push('>> "%B64_FILE%" echo ' + b64Lines[i]);
  }
  L.push('');
  // 使用 node -e 直接解码（避免写入临时 JS 文件的转义问题）
  // Node.js 的 Buffer.from(str,'base64') 自动忽略空白字符，无需 regex
  L.push('echo [+] 解码服务器文件...');
  L.push('node -e "var fs=require(\'fs\');fs.writeFileSync(process.argv[1],Buffer.from(fs.readFileSync(process.argv[2],\'utf-8\'),\'base64\'));" "%APP_DIR%\\server.js" "%B64_FILE%"');
  L.push('if !errorlevel! neq 0 (');
  L.push('  echo [X] 服务器文件写入失败');
  L.push('  pause');
  L.push('  exit /b 1');
  L.push(')');
  L.push('del "%B64_FILE%" >nul 2>&1');
  L.push('echo [v] 服务器文件已就绪');
  L.push('');
  // 启动
  L.push('echo.');
  L.push('echo ==================================================');
  L.push('echo   服务器正在启动...');
  L.push('echo   请记录下方显示的 IP 地址，告知其他设备');
  L.push('echo ==================================================');
  L.push('echo.');
  L.push('');
  L.push('node server.js');
  L.push('');
  L.push('pause');
  return L.join('\r\n');
}


// ========== macOS 安装脚本 ==========
function generateMacInstaller(b64Lines) {
  var L = [];
  L.push('#!/bin/bash');
  L.push('# 舞台流程表 - macOS 服务器启动器');
  L.push('# 支持 macOS 10.14+ (Intel 和 Apple Silicon)');
  L.push('# 双击运行，或终端执行: bash xxx.command');
  L.push('');
  L.push('set -e');
  L.push('');
  // 自动识别脚本所在目录（支持中文路径、空格、特殊字符）
  L.push('SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"');
  L.push('APP_DIR="$SCRIPT_DIR/stage-manager"');
  L.push('echo "[i] 脚本所在目录: $SCRIPT_DIR"');
  L.push('echo "[i] 工作目录: $APP_DIR"');
  L.push('mkdir -p "$APP_DIR"');
  L.push('cd "$APP_DIR"');
  L.push('');
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  舞台流程表 - macOS 服务器启动器"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  // 检测架构
  L.push('ARCH=$(uname -m)');
  L.push('if [ "$ARCH" = "arm64" ]; then');
  L.push('  echo "[i] 检测到 Apple Silicon (M系列芯片)"');
  L.push('  NODE_ARCH="arm64"');
  L.push('else');
  L.push('  echo "[i] 检测到 Intel 处理器"');
  L.push('  NODE_ARCH="x64"');
  L.push('fi');
  L.push('');
  // 检查 Node.js
  L.push('if command -v node &> /dev/null; then');
  L.push('  echo "[v] Node.js 已安装: $(node --version)"');
  L.push('else');
  L.push('  echo "[!] 未检测到 Node.js，正在自动下载..."');
  L.push('  NODE_VERSION="v18.20.4"');
  L.push('  NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz"');
  L.push('  NODE_TAR="/tmp/stage_manager_node.tar.gz"');
  L.push('  NODE_DIR="$HOME/.local/stage-manager-nodejs"');
  L.push('  echo "[+] 下载 Node.js ${NODE_VERSION} (${NODE_ARCH})..."');
  L.push('  curl -L --fail "$NODE_URL" -o "$NODE_TAR"');
  L.push('  echo "[+] 解压 Node.js ..."');
  L.push('  mkdir -p "$NODE_DIR"');
  L.push('  tar -xzf "$NODE_TAR" -C "$NODE_DIR" --strip-components=1');
  L.push('  export PATH="$NODE_DIR/bin:$PATH"');
  L.push('  echo "[v] Node.js 安装完成: $(node --version)"');
  L.push('fi');
  L.push('');
  // 写入 base64 并解码
  // 使用 heredoc 写入 b64 文件 + node 解码，确保跨版本兼容性
  L.push('echo "[+] 写入服务器文件 (共 ' + b64Lines.length + ' 段)..."');
  L.push('B64_FILE="$APP_DIR/server.b64"');
  L.push('cat > "$B64_FILE" <<\'STAGE_MANAGER_B64_END\'');
  for (var i = 0; i < b64Lines.length; i++) {
    L.push(b64Lines[i]);
  }
  L.push('STAGE_MANAGER_B64_END');
  L.push('node -e "var fs=require(\'fs\');fs.writeFileSync(process.argv[1],Buffer.from(fs.readFileSync(process.argv[2],\'utf-8\'),\'base64\'));" server.js "$B64_FILE"');
  L.push('if [ $? -ne 0 ]; then');
  L.push('  echo "[X] 服务器文件写入失败"');
  L.push('  read -p "按回车键退出..."');
  L.push('  exit 1');
  L.push('fi');
  L.push('rm -f "$B64_FILE"');
  L.push('echo "[v] 服务器文件已就绪"');
  L.push('');
  // 启动
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  服务器正在启动..."');
  L.push('echo "  请记录下方显示的 IP 地址，告知其他设备"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  L.push('node server.js');
  L.push('');
  L.push('read -p "按回车键退出..."');
  return L.join('\n');
}


// ========== Linux 安装脚本 (x64/ARMv7/ARM64 - 树莓派/Ubuntu/Debian 等) ==========
function generateLinuxInstaller(b64Lines) {
  var L = [];
  L.push('#!/bin/bash');
  L.push('# 舞台流程表 - Linux 服务器启动器');
  L.push('# 支持 x86_64, ARMv7 (树莓派32位), ARM64 (树莓派64位)');
  L.push('# 双击运行或终端执行: bash xxx.sh');
  L.push('');
  L.push('set -e');
  L.push('');
  L.push('SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"');
  L.push('APP_DIR="$SCRIPT_DIR/stage-manager"');
  L.push('echo "[i] 脚本所在目录: $SCRIPT_DIR"');
  L.push('echo "[i] 工作目录: $APP_DIR"');
  L.push('mkdir -p "$APP_DIR"');
  L.push('cd "$APP_DIR"');
  L.push('');
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  舞台流程表 - Linux 服务器启动器"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  // 检测架构
  L.push('ARCH=$(uname -m)');
  L.push('echo "[i] 系统架构: $ARCH"');
  L.push('if [ "$ARCH" = "x86_64" ] || [ "$ARCH" = "amd64" ]; then');
  L.push('  NODE_ARCH="x64"');
  L.push('  NODE_TAR_ARCH="linux-x64"');
  L.push('elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then');
  L.push('  NODE_ARCH="arm64"');
  L.push('  NODE_TAR_ARCH="linux-arm64"');
  L.push('elif [ "$ARCH" = "armv7l" ] || [ "$ARCH" = "armhf" ]; then');
  L.push('  NODE_ARCH="armv7l"');
  L.push('  NODE_TAR_ARCH="linux-armv7l"');
  L.push('else');
  L.push('  echo "[!] 未知的系统架构: $ARCH"');
  L.push('  echo "[!] 尝试使用 x64 版本"');
  L.push('  NODE_ARCH="x64"');
  L.push('  NODE_TAR_ARCH="linux-x64"');
  L.push('fi');
  L.push('');
  // 检查 Node.js
  L.push('if command -v node &> /dev/null; then');
  L.push('  echo "[v] Node.js 已安装: $(node --version)"');
  L.push('else');
  L.push('  echo "[!] 未检测到 Node.js，正在自动下载..."');
  L.push('  NODE_VERSION="v18.20.4"');
  L.push('  NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${NODE_TAR_ARCH}.tar.xz"');
  L.push('  NODE_TAR="/tmp/stage_manager_node.tar.xz"');
  L.push('  NODE_DIR="$HOME/.local/stage-manager-nodejs"');
  L.push('  echo "[+] 下载 Node.js ${NODE_VERSION} (${NODE_TAR_ARCH})..."');
  L.push('  curl -L --fail "$NODE_URL" -o "$NODE_TAR" || {');
  L.push('    echo "[X] Node.js 下载失败，请手动安装: https://nodejs.org/"');
  L.push('    exit 1');
  L.push('  }');
  L.push('  echo "[+] 解压 Node.js ..."');
  L.push('  mkdir -p "$NODE_DIR"');
  L.push('  tar -xJf "$NODE_TAR" -C "$NODE_DIR" --strip-components=1');
  L.push('  export PATH="$NODE_DIR/bin:$PATH"');
  L.push('  echo "[v] Node.js 安装完成: $(node --version)"');
  L.push('fi');
  L.push('');
  // 写入 base64 并解码
  L.push('echo "[+] 写入服务器文件 (共 ' + b64Lines.length + ' 段)..."');
  L.push('B64_FILE="$APP_DIR/server.b64"');
  L.push('cat > "$B64_FILE" <<\'STAGE_MANAGER_B64_END\'');
  for (var i = 0; i < b64Lines.length; i++) {
    L.push(b64Lines[i]);
  }
  L.push('STAGE_MANAGER_B64_END');
  L.push('node -e "var fs=require(\'fs\');fs.writeFileSync(process.argv[1],Buffer.from(fs.readFileSync(process.argv[2],\'utf-8\'),\'base64\'));" server.js "$B64_FILE"');
  L.push('if [ $? -ne 0 ]; then');
  L.push('  echo "[X] 服务器文件写入失败"');
  L.push('  exit 1');
  L.push('fi');
  L.push('rm -f "$B64_FILE"');
  L.push('echo "[v] 服务器文件已就绪"');
  L.push('');
  // 启动
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  服务器正在启动..."');
  L.push('echo "  请记录下方显示的 IP 地址，告知其他设备"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  L.push('node server.js');
  L.push('');
  return L.join('\n');
}


// ========== Android Termux 安装脚本 ==========
function generateTermuxInstaller(b64Lines) {
  var L = [];
  L.push('#!/bin/bash');
  L.push('# 舞台流程表 - Android Termux 服务器启动器');
  L.push('# 需先安装 Termux: https://f-droid.org/packages/com.termux/');
  L.push('# 在 Termux 中执行: bash termux-start.sh');
  L.push('');
  L.push('set -e');
  L.push('');
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  舞台流程表 - Android Termux 服务器启动器"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  // 检查 Termux 环境
  L.push('if [ -z "$TERMUX_VERSION" ]; then');
  L.push('  echo "[!] 此脚本需要在 Termux 中运行"');
  L.push('  echo "[!] 请先安装 Termux: https://f-droid.org/packages/com.termux/"');
  L.push('  exit 1');
  L.push('fi');
  L.push('');
  L.push('APP_DIR="$HOME/stage-manager"');
  L.push('mkdir -p "$APP_DIR"');
  L.push('cd "$APP_DIR"');
  L.push('echo "[i] 工作目录: $APP_DIR"');
  L.push('');
  // 安装 Node.js
  L.push('if command -v node &> /dev/null; then');
  L.push('  echo "[v] Node.js 已安装: $(node --version)"');
  L.push('else');
  L.push('  echo "[!] 未检测到 Node.js，正在安装..."');
  L.push('  pkg update -y && pkg install -y nodejs');
  L.push('  echo "[v] Node.js 安装完成: $(node --version)"');
  L.push('fi');
  L.push('');
  // 写入 base64 并解码
  L.push('echo "[+] 写入服务器文件 (共 ' + b64Lines.length + ' 段)..."');
  L.push('B64_FILE="$APP_DIR/server.b64"');
  L.push('cat > "$B64_FILE" <<\'STAGE_MANAGER_B64_END\'');
  for (var i = 0; i < b64Lines.length; i++) {
    L.push(b64Lines[i]);
  }
  L.push('STAGE_MANAGER_B64_END');
  L.push('node -e "var fs=require(\'fs\');fs.writeFileSync(process.argv[1],Buffer.from(fs.readFileSync(process.argv[2],\'utf-8\'),\'base64\'));" server.js "$B64_FILE"');
  L.push('rm -f "$B64_FILE"');
  L.push('echo "[v] 服务器文件已就绪"');
  L.push('');
  // 启动
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  服务器正在启动..."');
  L.push('echo "  其他设备可通过本机 IP 访问"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  L.push('node server.js');
  L.push('');
  return L.join('\n');
}


// ========== OpenWrt 安装脚本 (路由器) ==========
function generateOpenWrtInstaller(b64Lines) {
  var L = [];
  L.push('#!/bin/sh');
  L.push('# 舞台流程表 - OpenWrt 路由器服务器启动器');
  L.push('# 需要 OpenWrt 18.06+ 且有足够存储空间 (至少 80MB)"');
  L.push('# 通过 SSH 执行: sh openwrt-start.sh');
  L.push('');
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  舞台流程表 - OpenWrt 路由器服务器启动器"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  // 检查存储空间
  L.push('FREE_SPACE=$(df -m / | tail -1 | awk \'{print $4}\')');
  L.push('echo "[i] 可用存储空间: ${FREE_SPACE}MB"');
  L.push('if [ "$FREE_SPACE" -lt 80 ]; then');
  L.push('  echo "[X] 存储空间不足！需要至少 80MB，当前仅 ${FREE_SPACE}MB"');
  L.push('  echo "[i] 建议: 1) 使用外接U盘 2) 使用精简版(不含OCR数据)"');
  L.push('  exit 1');
  L.push('fi');
  L.push('');
  // 检查内存
  L.push('FREE_MEM=$(cat /proc/meminfo | grep MemAvailable | awk \'{print int($2/1024)}\')');
  L.push('echo "[i] 可用内存: ${FREE_MEM}MB"');
  L.push('if [ "$FREE_MEM" -lt 128 ]; then');
  L.push('  echo "[!] 内存较少 (${FREE_MEM}MB)，可能影响性能"');
  L.push('fi');
  L.push('');
  L.push('APP_DIR="/root/stage-manager"');
  L.push('mkdir -p "$APP_DIR"');
  L.push('cd "$APP_DIR"');
  L.push('echo "[i] 工作目录: $APP_DIR"');
  L.push('');
  // 安装 Node.js
  L.push('if command -v node &> /dev/null; then');
  L.push('  echo "[v] Node.js 已安装: $(node --version)"');
  L.push('else');
  L.push('  echo "[!] 未检测到 Node.js，尝试通过 opkg 安装..."');
  L.push('  opkg update');
  L.push('  opkg install node');
  L.push('  if command -v node &> /dev/null; then');
  L.push('    echo "[v] Node.js 安装完成: $(node --version)"');
  L.push('  else');
  L.push('    echo "[X] 无法安装 Node.js"');
  L.push('    echo "[i] 请手动安装 node 包: opkg install node"');
  L.push('    echo "[i] 或下载适用于 OpenWrt 的 Node.js"');
  L.push('    exit 1');
  L.push('  fi');
  L.push('fi');
  L.push('');
  // 写入 base64 并解码 (busybox ash 支持 heredoc)
  L.push('echo "[+] 写入服务器文件 (共 ' + b64Lines.length + ' 段)..."');
  L.push('B64_FILE="$APP_DIR/server.b64"');
  L.push('cat > "$B64_FILE" <<\'STAGE_MANAGER_B64_END\'');
  for (var i = 0; i < b64Lines.length; i++) {
    L.push(b64Lines[i]);
  }
  L.push('STAGE_MANAGER_B64_END');
  L.push('node -e "var fs=require(\'fs\');fs.writeFileSync(process.argv[1],Buffer.from(fs.readFileSync(process.argv[2],\'utf-8\'),\'base64\'));" server.js "$B64_FILE"');
  L.push('if [ $? -ne 0 ]; then');
  L.push('  echo "[X] 服务器文件写入失败"');
  L.push('  exit 1');
  L.push('fi');
  L.push('rm -f "$B64_FILE"');
  L.push('echo "[v] 服务器文件已就绪"');
  L.push('');
  // 启动
  L.push('echo ""');
  L.push('echo "=================================================="');
  L.push('echo "  服务器正在启动..."');
  L.push('echo "  其他设备可通过路由器 IP 访问"');
  L.push('echo "=================================================="');
  L.push('echo ""');
  L.push('');
  L.push('node server.js');
  L.push('');
  return L.join('\n');
}
