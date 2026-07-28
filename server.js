// server.js - 舞台流程表 WebSocket + HTTP 服务器（多角色版）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = parseInt(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, 'show.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- 默认状态 ----------
const defaultState = {
  showName: "舞台流程表",
  mode: "setup",
  currentProgramIndex: 0,
  version: 3,
  globalChannels: { mics: [], lines: [] },
  programs: []
};

// ---------- 状态加载/保存 ----------
function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return mergeState({ ...defaultState, ...parsed });
    }
  } catch (e) {
    console.error('加载 show.json 失败，使用默认状态:', e.message);
  }
  return mergeState({ ...defaultState });
}

// 服务端状态合并（与前端 mergeState 保持一致）
function mergeMusicField(p) {
  const cue = (p.musicCue || '').trim();
  const node = (p.musicNode || '').trim();
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
  const oldVersion = s.version || 1;
  const merged = {
    showName: s.showName || "舞台流程表",
    mode: s.mode || "setup",
    currentProgramIndex: s.currentProgramIndex || 0,
    version: 3,
    globalChannels: s.globalChannels || { mics: [], lines: [] },
    programs: (s.programs || []).map(function(p) {
      // 迁移：旧版 completed 布尔 → status 枚举
      var status = p.status;
      if (!status) {
        status = p.completed ? 'completed' : 'pending';
      }
      // 迁移：旧版 duration 秒 → 分钟（version < 3 且 duration >= 60 视为秒）
      var duration = p.duration || 0;
      if (oldVersion < 3 && duration >= 60) {
        duration = Math.round(duration / 60);
      }
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

let state = loadState();
// 边界修正：currentProgramIndex 越界时拉回
if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) {
  state.currentProgramIndex = Math.max(0, state.programs.length - 1);
}

// ---------- 角色权限校验 ----------
var FIELD_PERM = {
  notes:    ['control', 'assistant', 'backstage'],
  musicCue: ['control', 'assistant'],
  useChannels: ['control', 'assistant']
};

function canEditField(role, field) {
  var allowed = FIELD_PERM[field];
  return allowed && allowed.indexOf(role) !== -1;
}

// ---------- WebSocket ----------
const server = http.createServer(function(req, res) { serveStatic(req, res); });
const wss = new WebSocketServer({ server });

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
    case 'get_state':
      broadcastFullState();
      break;

    case 'update_state':
      if (role !== 'control') return sendError(ws, 'forbidden', 'update_state');
      if (msg.data && typeof msg.data === 'object') {
        state = mergeState(Object.assign({}, state, msg.data));
        if (state.programs.length > 0 && state.currentProgramIndex > state.programs.length - 1) {
          state.currentProgramIndex = Math.max(0, state.programs.length - 1);
        }
        saveState();
        broadcastFullState();
      }
      break;

    case 'set_current':
      if (role !== 'control' && role !== 'director') return sendError(ws, 'forbidden', 'set_current');
      if (typeof msg.index === 'number' && msg.index >= 0 && msg.index <= state.programs.length - 1) {
        state.currentProgramIndex = msg.index;
        // 设置新当前节目为 active
        if (state.programs[msg.index]) {
          state.programs[msg.index].status = 'active';
        }
        saveState();
        broadcastFullState();
      }
      break;

    case 'advance':
      if (role !== 'control' && role !== 'director') return sendError(ws, 'forbidden', 'advance');
      doAdvance();
      break;

    case 'prev':
      if (role !== 'control' && role !== 'director') return sendError(ws, 'forbidden', 'prev');
      doNav(-1);
      break;

    case 'next':
      if (role !== 'control' && role !== 'director') return sendError(ws, 'forbidden', 'next');
      doNav(1);
      break;

    case 'reset_all':
      if (role !== 'control') return sendError(ws, 'forbidden', 'reset_all');
      state.programs.forEach(function(p) { p.status = 'pending'; });
      state.currentProgramIndex = 0;
      if (state.programs[0]) state.programs[0].status = 'active';
      saveState();
      broadcastFullState();
      break;

    case 'reset_one':
      if (role !== 'control') return sendError(ws, 'forbidden', 'reset_one');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx].status = 'pending';
        saveState();
        broadcastFullState();
      }
      break;

    case 'update_program_field':
      if (!canEditField(role, msg.field)) return sendError(ws, 'forbidden', 'update_program_field');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx][msg.field] = msg.value;
        saveState();
        broadcastFullState();
      }
      break;

    case 'import_programs':
      if (role !== 'control') return sendError(ws, 'forbidden', 'import_programs');
      var newProgs = (msg.programs || []).map(function(p) {
        return {
          name: p.name || "",
          duration: p.duration || 0,
          notes: p.notes || "",
          musicCue: p.musicCue || "",
          status: p.status || 'pending',
          useChannels: p.useChannels || []
        };
      });
      if (msg.mode === 'replace') {
        state.programs = newProgs;
        state.currentProgramIndex = 0;
      } else {
        state.programs = state.programs.concat(newProgs);
      }
      saveState();
      broadcastFullState();
      break;
  }
}

// Go 按钮：当前 → completed，前进到下一节目 → active
function doAdvance() {
  var idx = state.currentProgramIndex;
  if (idx >= 0 && idx < state.programs.length) {
    state.programs[idx].status = 'completed';
  }
  var nextIdx = Math.min(idx + 1, Math.max(0, state.programs.length - 1));
  state.currentProgramIndex = nextIdx;
  if (state.programs[nextIdx] && state.programs[nextIdx].status !== 'completed') {
    state.programs[nextIdx].status = 'active';
  }
  saveState();
  broadcastFullState();
}

// 上一个/下一个导航
function doNav(dir) {
  var idx = state.currentProgramIndex;
  var newIdx = idx + dir;
  if (newIdx < 0) newIdx = 0;
  if (newIdx > state.programs.length - 1) newIdx = Math.max(0, state.programs.length - 1);
  state.currentProgramIndex = newIdx;
  if (state.programs[newIdx] && state.programs[newIdx].status !== 'completed') {
    state.programs[newIdx].status = 'active';
  }
  saveState();
  broadcastFullState();
}

function sendTo(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function sendError(ws, code, action) {
  sendTo(ws, { type: 'error', code: code, action: action });
}

function broadcast(obj) {
  var data = JSON.stringify(obj);
  wss.clients.forEach(function(c) {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

function broadcastFullState() {
  broadcast({ type: 'full_state', state: state, clientCount: wss.clients.size });
}

function broadcastClientCount() {
  broadcast({ type: 'client_count', count: wss.clients.size });
}

// ---------- 获取局域网IP ----------
// 过滤虚拟网卡（VMware/Hyper-V/WSL/Docker/Tailscale 等），只保留真实局域网 IP
var VIRTUAL_PREFIXES = [
  '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.',
  '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
  '10.147.', '10.94.',   // Tailscale / 部分虚拟网卡
  '169.254.',            // link-local
  '100.64.', '100.65.', '100.66.', '100.67.', '100.68.', '100.69.', // CGNAT
  '192.0.0.', '198.18.', '198.19.'
];
var VIRTUAL_NAME_HINTS = ['vmware', 'vmnet', 'vbox', 'docker', 'wsl', 'hyper-v', 'vethernet', 'tailscale', 'zerotier', 'tap', 'tun', 'utun', 'bridge', 'virbr'];

function isVirtualInterface(name) {
  var lower = (name || '').toLowerCase();
  return VIRTUAL_NAME_HINTS.some(function(h) { return lower.indexOf(h) !== -1; });
}

function isVirtualIP(addr) {
  return VIRTUAL_PREFIXES.some(function(p) { return addr.indexOf(p) === 0; });
}

function getLocalIPs() {
  var os = require('os');
  var interfaces = os.networkInterfaces();
  var real = [];
  var virtual = [];
  for (var name in interfaces) {
    if (isVirtualInterface(name)) continue;
    interfaces[name].forEach(function(iface) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (isVirtualIP(iface.address)) {
          virtual.push({ addr: iface.address, name: name });
        } else {
          real.push({ addr: iface.address, name: name });
        }
      }
    });
  }
  // 优先返回真实局域网 IP；若全为虚拟网卡，则退回返回所有
  if (real.length > 0) return real.map(function(x) { return x.addr; });
  return virtual.map(function(x) { return x.addr; });
}

var localIPs = getLocalIPs();
var primaryIP = localIPs.length > 0 ? localIPs[0] : 'localhost';

// ---------- 静态文件服务 ----------
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.exe': 'application/x-msdownload',
  '.bat': 'application/x-msdownload',
  '.command': 'application/octet-stream',
  '.sh': 'application/octet-stream',
  '': 'application/octet-stream'
};

var DOWNLOAD_DIR = path.join(__dirname, 'downloads');

function serveStatic(req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // API: 服务器信息
  if (urlPath === '/api/server-info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ip: primaryIP, port: actualPort, ips: localIPs }));
    return;
  }

  // 下载客户端文件
  if (urlPath.indexOf('/download/') === 0) {
    var dlFile = urlPath.replace('/download/', '');
    var dlPath = path.join(DOWNLOAD_DIR, dlFile);
    // 防路径穿越
    if (dlPath.indexOf(DOWNLOAD_DIR + path.sep) !== 0 && dlPath !== DOWNLOAD_DIR) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.readFile(dlPath, function(err, data) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - 客户端文件尚未生成，请先运行构建脚本: node build-clients.js');
        return;
      }
      // 使用 RFC 5987 编码 filename，兼容中文/特殊字符
      var encodedName = encodeURIComponent(dlFile);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': "attachment; filename=\"" + dlFile + "\"; filename*=UTF-8''" + encodedName
      });
      res.end(data);
    });
    return;
  }

  if (urlPath === '/' || urlPath === '/index.html') urlPath = '/舞台流程表.html';
  // 支持直接访问 舞台流程表.html
  var filePath = path.join(PUBLIC_DIR, urlPath);
  // 防路径穿越
  if (filePath.indexOf(PUBLIC_DIR + path.sep) !== 0 && filePath !== PUBLIC_DIR) {
    // 尝试从根目录读取
    var rootPath = path.join(__dirname, urlPath);
    if (rootPath.indexOf(__dirname + path.sep) === 0) {
      fs.readFile(rootPath, function(err2, data2) {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }
        var ext2 = path.extname(rootPath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext2] || 'application/octet-stream' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, function(err, data) {
    if (err) {
      // 尝试从根目录读取 舞台流程表.html
      var rootPath2 = path.join(__dirname, urlPath);
      if (rootPath2 !== filePath && rootPath2.indexOf(__dirname + path.sep) === 0) {
        fs.readFile(rootPath2, function(err2, data2) {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
          }
          var ext2 = path.extname(rootPath2).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext2] || 'application/octet-stream' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- 端口占用自动处理 ----------
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
    console.error('[!] 提示: set PORT=8080 && node server.js');
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
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     舞台流程表服务已启动                            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  本机访问:  http://localhost:' + actualPort + ''.padEnd(16 - String(actualPort).length, ' ') + '║');
  if (localIPs.length > 0) {
    localIPs.forEach(function(ip) {
      var line = '║  局域网IP:  http://' + ip + ':' + actualPort;
      console.log(line + ''.padEnd(50 - line.length, ' ') + '║');
    });
  }
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  控制端:   /?role=control                          ║');
  console.log('║  导演端:   /?role=director                          ║');
  console.log('║  助理端:   /?role=assistant                        ║');
  console.log('║  幕后端:   /?role=backstage                        ║');
  console.log('║  提示屏:   /?role=screen                            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  if (actualPort !== PORT) {
    console.log('[i] 注意: 默认端口 ' + PORT + ' 被占用，已自动切换到 ' + actualPort);
  }
}

// 启动服务器
startListening(PORT);
