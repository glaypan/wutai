// client.js - 独立桌面客户端入口（pkg 打包用）
// 运行后自动启动服务器并显示局域网IP
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var { WebSocketServer, WebSocket } = require('ws');

var PORT = parseInt(process.env.PORT) || 3000;

// ---------- 获取局域网IP ----------
function getLocalIPs() {
  var interfaces = os.networkInterfaces();
  var ips = [];
  for (var name in interfaces) {
    interfaces[name].forEach(function(iface) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    });
  }
  return ips;
}

var localIPs = getLocalIPs();
var primaryIP = localIPs.length > 0 ? localIPs[0] : 'localhost';

// ---------- 数据存储路径 ----------
// pkg 打包后 process.execPath 是可执行文件路径
// 数据文件存放在可执行文件同目录
var APP_DIR;
var DATA_FILE;
var HTML_CONTENT;

try {
  // 尝试从 pkg 虚拟文件系统读取 HTML
  HTML_CONTENT = fs.readFileSync(path.join(__dirname, '舞台流程表.html'), 'utf-8');
} catch(e) {
  // 开发模式：从工作目录读取
  try {
    HTML_CONTENT = fs.readFileSync(path.join(process.cwd(), '舞台流程表.html'), 'utf-8');
  } catch(e2) {
    HTML_CONTENT = '<html><body><h1>错误：未找到舞台流程表.html</h1></body></html>';
  }
}

// 数据文件存放在可执行文件同目录
if (process.pkg) {
  APP_DIR = path.dirname(process.execPath);
} else {
  APP_DIR = process.cwd();
}
DATA_FILE = path.join(APP_DIR, 'show.json');

// ---------- 默认状态 ----------
var defaultState = {
  showName: "舞台流程表",
  mode: "setup",
  currentProgramIndex: 0,
  version: 3,
  globalChannels: { mics: [], lines: [] },
  programs: []
};

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return mergeState(Object.assign({}, defaultState, parsed));
    }
  } catch (e) {
    console.error('加载 show.json 失败，使用默认状态:', e.message);
  }
  return mergeState(Object.assign({}, defaultState));
}

function mergeMusicField(p) {
  var cue = (p.musicCue || '').trim();
  var node = (p.musicNode || '').trim();
  if (!node) return cue;
  return cue ? '\u3010\u8282\u70b9\u3011' + node + '\n' + cue : node;
}

function ensureChannel(ch) {
  return {
    id: ch.id || ('ch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    name: ch.name || '',
    type: ch.type || '',
    notes: ch.notes || '',
    customType: ch.customType || ''
  };
}

function mergeState(s) {
  var oldVersion = s.version || 1;
  var merged = {
    showName: s.showName || "舞台流程表",
    mode: s.mode || "setup",
    currentProgramIndex: s.currentProgramIndex || 0,
    version: 3,
    globalChannels: s.globalChannels || { mics: [], lines: [] },
    programs: (s.programs || []).map(function(p) {
      var status = p.status;
      if (!status) { status = p.completed ? 'completed' : 'pending'; }
      var duration = p.duration || 0;
      if (oldVersion < 3 && duration >= 60) { duration = Math.round(duration / 60); }
      return {
        name: p.name || "",
        duration: duration,
        notes: p.notes || "",
        musicCue: mergeMusicField(p),
        status: status,
        useChannels: p.useChannels || (p.mics ? p.mics.filter(function(m){return m.active;}).map(function(m){return m.name;}) : [])
      };
    })
  };
  if (!merged.globalChannels.mics) merged.globalChannels.mics = [];
  if (!merged.globalChannels.lines) merged.globalChannels.lines = [];
  merged.globalChannels.mics = merged.globalChannels.mics.map(ensureChannel);
  merged.globalChannels.lines = merged.globalChannels.lines.map(ensureChannel);
  return merged;
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存 show.json 失败:', e.message);
  }
}

var state = loadState();
if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) {
  state.currentProgramIndex = Math.max(0, state.programs.length - 1);
}

// ---------- 角色权限 ----------
var FIELD_PERM = {
  notes: ['control', 'assistant', 'backstage'],
  musicCue: ['control', 'assistant'],
  useChannels: ['control', 'assistant']
};
function canEditField(role, field) {
  var allowed = FIELD_PERM[field];
  return allowed && allowed.indexOf(role) !== -1;
}

// ---------- WebSocket ----------
var server = http.createServer(function(req, res) { serveStatic(req, res); });
var wss = new WebSocketServer({ server });

wss.on('connection', function(ws) {
  sendTo(ws, { type: 'full_state', state: state, clientCount: wss.clients.size });
  broadcastClientCount();
  ws.on('message', function(raw) {
    var msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    handleMessage(ws, msg);
  });
  ws.on('close', function() { broadcastClientCount(); });
});

function handleMessage(ws, msg) {
  var role = msg.role || 'control';
  switch (msg.type) {
    case 'get_state': broadcastFullState(); break;
    case 'update_state':
      if (role !== 'control') return sendError(ws, 'forbidden', 'update_state');
      if (msg.data && typeof msg.data === 'object') {
        state = mergeState(Object.assign({}, state, msg.data));
        if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) {
          state.currentProgramIndex = Math.max(0, state.programs.length - 1);
        }
        saveState(); broadcastFullState();
      }
      break;
    case 'set_current':
      if (role !== 'control') return sendError(ws, 'forbidden', 'set_current');
      if (typeof msg.index === 'number' && msg.index >= 0 && msg.index <= state.programs.length - 1) {
        state.currentProgramIndex = msg.index;
        if (state.programs[msg.index]) state.programs[msg.index].status = 'active';
        saveState(); broadcastFullState();
      }
      break;
    case 'advance': if (role !== 'control') return sendError(ws, 'forbidden', 'advance'); doAdvance(); break;
    case 'prev': if (role !== 'control') return sendError(ws, 'forbidden', 'prev'); doNav(-1); break;
    case 'next': if (role !== 'control') return sendError(ws, 'forbidden', 'next'); doNav(1); break;
    case 'reset_all':
      if (role !== 'control') return sendError(ws, 'forbidden', 'reset_all');
      state.programs.forEach(function(p) { p.status = 'pending'; });
      state.currentProgramIndex = 0;
      if (state.programs[0]) state.programs[0].status = 'active';
      saveState(); broadcastFullState();
      break;
    case 'reset_one':
      if (role !== 'control') return sendError(ws, 'forbidden', 'reset_one');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx].status = 'pending';
        saveState(); broadcastFullState();
      }
      break;
    case 'update_program_field':
      if (!canEditField(role, msg.field)) return sendError(ws, 'forbidden', 'update_program_field');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx][msg.field] = msg.value;
        saveState(); broadcastFullState();
      }
      break;
    case 'import_programs':
      if (role !== 'control') return sendError(ws, 'forbidden', 'import_programs');
      var newProgs = (msg.programs || []).map(function(p) {
        return { name: p.name || "", duration: p.duration || 0, notes: p.notes || "", musicCue: p.musicCue || "", status: p.status || 'pending', useChannels: p.useChannels || [] };
      });
      if (msg.mode === 'replace') { state.programs = newProgs; state.currentProgramIndex = 0; }
      else { state.programs = state.programs.concat(newProgs); }
      saveState(); broadcastFullState();
      break;
  }
}

function doAdvance() {
  var idx = state.currentProgramIndex;
  if (idx >= 0 && idx < state.programs.length) state.programs[idx].status = 'completed';
  var nextIdx = Math.min(idx + 1, Math.max(0, state.programs.length - 1));
  state.currentProgramIndex = nextIdx;
  if (state.programs[nextIdx] && state.programs[nextIdx].status !== 'completed') state.programs[nextIdx].status = 'active';
  saveState(); broadcastFullState();
}
function doNav(dir) {
  var idx = state.currentProgramIndex;
  var newIdx = idx + dir;
  if (newIdx < 0) newIdx = 0;
  if (newIdx > state.programs.length - 1) newIdx = Math.max(0, state.programs.length - 1);
  state.currentProgramIndex = newIdx;
  if (state.programs[newIdx] && state.programs[newIdx].status !== 'completed') state.programs[newIdx].status = 'active';
  saveState(); broadcastFullState();
}

function sendTo(ws, obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function sendError(ws, code, action) { sendTo(ws, { type: 'error', code: code, action: action }); }
function broadcast(obj) { var data = JSON.stringify(obj); wss.clients.forEach(function(c) { if (c.readyState === WebSocket.OPEN) c.send(data); }); }
function broadcastFullState() { broadcast({ type: 'full_state', state: state, clientCount: wss.clients.size }); }
function broadcastClientCount() { broadcast({ type: 'client_count', count: wss.clients.size }); }

// ---------- 静态文件服务 ----------
function serveStatic(req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (urlPath === '/api/server-info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ip: primaryIP, port: actualPort, ips: localIPs }));
    return;
  }

  if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/舞台流程表.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML_CONTENT);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

// ---------- 启动 ----------
var actualPort = PORT;
var tryingPort = PORT;
var retryCount = 0;
var MAX_RETRIES = 5;

function killProcessOnPort(port, callback) {
  var exec = require('child_process').exec;
  var platform = process.platform;
  var myPid = String(process.pid);
  if (platform === 'win32') {
    // Windows: 两步查找并杀掉占用端口的进程
    exec('netstat -ano | findstr :' + port, function(err, stdout) {
      if (err || !stdout) { callback(); return; }
      var lines = stdout.trim().split('\n');
      var pids = [];
      lines.forEach(function(line) {
        if (line.indexOf('LISTENING') !== -1) {
          var parts = line.trim().split(/\s+/);
          var pid = parts[parts.length - 1];
          // 排除自身进程
          if (pid && pid !== myPid && pids.indexOf(pid) === -1) pids.push(pid);
        }
      });
      if (pids.length === 0) { callback(); return; }
      exec('taskkill /F /PID ' + pids.join(' /PID '), function() { callback(); });
    });
  } else {
    // Linux/macOS: 查找并杀掉占用端口的进程，排除自身
    var cmd = 'lsof -ti:' + port + ' 2>/dev/null | grep -v ' + myPid + ' | xargs kill -9 2>/dev/null';
    if (platform !== 'darwin') cmd += '; fuser -k ' + port + '/tcp 2>/dev/null || true';
    exec(cmd, function() { callback(); });
  }
}

function startListening(port) {
  tryingPort = port;
  // 清理之前失败的 listen 句柄，防止 ERR_SERVER_ALREADY_LISTEN
  try { server.close(); } catch(e) {}
  server.listen(port);
}

function handleServerError(e) {
  if (e.code === 'EADDRINUSE' && retryCount < MAX_RETRIES) {
    retryCount++;
    if (retryCount === 1) {
      console.log('');
      console.log('[!] 检测到端口 ' + tryingPort + ' 被占用');
      console.log('[!] 正在自动清理旧进程...');
      killProcessOnPort(tryingPort, function() {
        setTimeout(function() {
          console.log('[i] 正在重新启动服务器...');
          startListening(PORT);
        }, 1000);
      });
    } else {
      var nextPort = PORT + retryCount - 1;
      console.log('[!] 端口 ' + tryingPort + ' 仍被占用，尝试端口 ' + nextPort + '...');
      startListening(nextPort);
    }
  } else if (e.code === 'EACCES') {
    console.error('[!] 权限不足，无法绑定端口 ' + tryingPort + '。请使用 1024 以上的端口。');
    process.exit(1);
  } else {
    console.error('[!] 服务器错误: ' + e.message);
    process.exit(1);
  }
}

// 错误处理：ws 库会自动将 HTTP 服务器的 error 事件转发到 WebSocketServer
// 只需在 wss 上监听，避免重复处理
wss.on('error', handleServerError);

server.on('listening', function() {
  actualPort = server.address().port;
  printStartupInfo();
});

function printStartupInfo() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║          舞台流程表 - 桌面客户端已启动                    ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log('║                                                         ║');
  console.log('║  ✅ 服务器已启动，其他设备可通过以下地址访问：           ║');
  console.log('║                                                         ║');
  console.log('║  本机: http://localhost:' + actualPort + ''.padEnd(24 - String(actualPort).length, ' ') + '║');
  if (localIPs.length > 0) {
    localIPs.forEach(function(ip) {
      var line = '║  局域网: http://' + ip + ':' + actualPort;
      console.log(line + ''.padEnd(57 - line.length, ' ') + '║');
    });
  }
  console.log('║                                                         ║');
  console.log('║  📱 控制端:   /?role=control                             ║');
  console.log('║  🎭 助理端:   /?role=assistant                           ║');
  console.log('║  🎬 幕后端:   /?role=backstage                           ║');
  console.log('║                                                         ║');
  console.log('║  💾 数据文件: ' + DATA_FILE + ''.padEnd(57 - 14 - DATA_FILE.length, ' ') + '║');
  console.log('║                                                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  if (actualPort !== PORT) {
    console.log('[i] 注意: 默认端口 ' + PORT + ' 被占用，已自动切换到 ' + actualPort);
  }
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
  console.log('');

  // 自动打开浏览器
  var openCmd;
  var platform = os.platform();
  var url = 'http://localhost:' + actualPort + '/?role=control';
  if (platform === 'win32') {
    openCmd = 'start "" "' + url + '"';
  } else if (platform === 'darwin') {
    openCmd = 'open "' + url + '"';
  } else {
    openCmd = 'xdg-open "' + url + '"';
  }
  try { require('child_process').exec(openCmd); } catch(e) {}
}

// 启动服务器
startListening(PORT);

// 防止窗口意外关闭（pkg 打包后保持运行）
process.on('SIGINT', function() {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});
