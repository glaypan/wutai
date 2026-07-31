// server.js - 舞台流程表 WebSocket + HTTP 服务器（多角色版）
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { MIME, sendTo, sendError, createBroadcasters } = require('./lib/server-shared');
const { buildClientPortalHtml } = require('./lib/client-portal-html');
const CLIENT_PORTAL_HTML = buildClientPortalHtml();

// ---------- 配置文件 ----------
var CONFIG_FILE = path.join(__dirname, 'config.json');
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch(e) { console.error('加载 config.json 失败:', e.message); }
  return {};
}
function saveConfig(cfg) {
  try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8'); } catch(e) { console.error('保存 config.json 失败:', e.message); }
}
var _config = loadConfig();

const PORT = parseInt(process.env.PORT) || _config.port || 3000;
const CLIENT_PORT_ENV_OVERRIDE = !!process.env.CLIENT_PORT;
const CLIENT_PORT = parseInt(process.env.CLIENT_PORT) || _config.clientPort || _config.displayPort || 3002;
var actualClientPort = CLIENT_PORT;
if (CLIENT_PORT === PORT) {
  actualClientPort = PORT === 65535 ? 65534 : PORT + 1;
  console.warn('[!] clientPort 与主端口相同，自动调整为 ' + actualClientPort);
}
const DATA_FILE = path.join(__dirname, 'show.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------- 默认状态 ----------
const defaultState = {
  showName: "舞台流程表",
  mode: "setup",
  currentProgramIndex: 0,
  version: 3,
  globalChannels: { mics: [], lines: [] },
  programs: [],
  subtitle: { lines: [], currentIndex: -1, visible: false }
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
  // 字幕状态合并
  merged.subtitle = s.subtitle || { lines: [], currentIndex: -1, visible: false };
  if (!merged.subtitle.lines) merged.subtitle.lines = [];
  if (typeof merged.subtitle.currentIndex !== 'number') merged.subtitle.currentIndex = -1;
  if (typeof merged.subtitle.visible !== 'boolean') merged.subtitle.visible = false;
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
const clientServer = http.createServer(function(req, res) { serveStatic(req, res, true); });
const clientWss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });
clientServer.on('upgrade', function(req, socket, head) {
  clientWss.handleUpgrade(req, socket, head, function(ws) {
    clientWss.emit('connection', ws, req);
  });
});

function setupConnection(ws) {
  sendTo(ws, { type: 'full_state', state: state, clientCount: wss.clients.size + clientWss.clients.size });
  broadcastClientCount();

  ws.on('message', function(raw) {
    var msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    handleMessage(ws, msg);
  });

  ws.on('close', function() { broadcastClientCount(); });
}
wss.on('connection', setupConnection);
clientWss.on('connection', setupConnection);

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
        commitState();
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
        commitState();
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
      commitState();
      break;

    case 'reset_one':
      if (role !== 'control') return sendError(ws, 'forbidden', 'reset_one');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx].status = 'pending';
        commitState();
      }
      break;

    case 'update_program_field':
      if (!canEditField(role, msg.field)) return sendError(ws, 'forbidden', 'update_program_field');
      if (typeof msg.idx === 'number' && state.programs[msg.idx]) {
        state.programs[msg.idx][msg.field] = msg.value;
        commitState();
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
      commitState();
      break;

    // ---------- 字幕功能 ----------
    case 'set_subtitle_lines':
      // 设置字幕内容（仅控制端）
      if (role !== 'control') return sendError(ws, 'forbidden', 'set_subtitle_lines');
      state.subtitle.lines = (msg.lines || []).filter(function(l) { return typeof l === 'string'; });
      state.subtitle.currentIndex = -1;
      commitState();
      break;

    case 'control_subtitle':
      // 字幕控制：上一句/下一句/显示/隐藏/跳转（控制端/导演端/助理端）
      if (role !== 'control' && role !== 'director' && role !== 'assistant') return sendError(ws, 'forbidden', 'control_subtitle');
      if (msg.action === 'next') {
        state.subtitle.currentIndex = Math.min(state.subtitle.currentIndex + 1, state.subtitle.lines.length - 1);
      } else if (msg.action === 'prev') {
        state.subtitle.currentIndex = Math.max(state.subtitle.currentIndex - 1, -1);
      } else if (msg.action === 'goto') {
        if (typeof msg.index === 'number') {
          state.subtitle.currentIndex = Math.max(-1, Math.min(msg.index, state.subtitle.lines.length - 1));
        }
      } else if (msg.action === 'show') {
        state.subtitle.visible = true;
      } else if (msg.action === 'hide') {
        state.subtitle.visible = false;
      } else if (msg.action === 'clear') {
        state.subtitle.lines = [];
        state.subtitle.currentIndex = -1;
        state.subtitle.visible = false;
      }
      commitState();
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
  commitState();
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
  commitState();
}

// sendTo / sendError 来自 lib/server-shared.js
// broadcast / broadcastFullState / broadcastClientCount 通过工厂注入服务器拓扑
var broadcasters = createBroadcasters({
  getServers: function() { return [wss, clientWss]; },
  getState: function() { return state; },
  getClientCount: function() { return wss.clients.size + clientWss.clients.size; }
});
var broadcast = broadcasters.broadcast;
var broadcastFullState = broadcasters.broadcastFullState;
var broadcastClientCount = broadcasters.broadcastClientCount;

// 持久化状态并广播全量状态（saveState + broadcastFullState 的常用组合）
function commitState() {
  saveState();
  broadcastFullState();
}

// ---------- OSC 控制 (UDP 监听，零依赖) ----------
// 支持的 OSC 地址:
//   /stage/go     - GO (完成当前，前进到下一个)
//   /stage/next   - 下一个节目
//   /stage/prev   - 上一个节目
//   /stage/goto N - 跳转到第 N 个节目 (N 为整数参数)
var OSC_PORT = parseInt(process.env.OSC_PORT) || _config.oscPort || 5300;
var oscEnabled = process.env.OSC_DISABLE !== '1';

// 最小化 OSC 消息解析器 (OSC 1.0 规范)
function parseOscMessage(buf) {
  try {
    var offset = 0;
    // 读取地址模式 (null-terminated, 4字节对齐)
    var addrEnd = buf.indexOf(0, offset);
    if (addrEnd < 0) return null;
    var address = buf.toString('ascii', offset, addrEnd);
    offset = Math.ceil((addrEnd + 1) / 4) * 4;
    // 读取类型标签 (以逗号开头的 null-terminated 字符串)
    var tagEnd = buf.indexOf(0, offset);
    if (tagEnd < 0) return { address: address, args: [] };
    var tags = buf.toString('ascii', offset + 1, tagEnd); // 跳过逗号
    offset = Math.ceil((tagEnd + 1) / 4) * 4;
    // 解析参数
    var args = [];
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (t === 'i') {
        args.push(buf.readInt32BE(offset)); offset += 4;
      } else if (t === 'f') {
        args.push(buf.readFloatBE(offset)); offset += 4;
      } else if (t === 's') {
        var sEnd = buf.indexOf(0, offset);
        if (sEnd < 0) break;
        args.push(buf.toString('utf-8', offset, sEnd));
        offset = Math.ceil((sEnd + 1) / 4) * 4;
      }
    }
    return { address: address, args: args };
  } catch (e) {
    return null;
  }
}

function handleOscMessage(msg) {
  var addr = (msg.address || '').toLowerCase();
  var handled = false;

  if (addr === '/stage/go' || addr === '/go' || addr === '/stage/advance') {
    console.log('[OSC] GO');
    doAdvance();
    handled = true;
  } else if (addr === '/stage/next' || addr === '/next') {
    console.log('[OSC] Next');
    doNav(1);
    handled = true;
  } else if (addr === '/stage/prev' || addr === '/prev') {
    console.log('[OSC] Prev');
    doNav(-1);
    handled = true;
  } else if ((addr === '/stage/goto' || addr === '/goto') && msg.args.length > 0) {
    var targetIdx = parseInt(msg.args[0]);
    if (!isNaN(targetIdx) && targetIdx >= 0 && targetIdx <= state.programs.length - 1) {
      console.log('[OSC] Goto ' + targetIdx);
      state.currentProgramIndex = targetIdx;
      if (state.programs[targetIdx]) state.programs[targetIdx].status = 'active';
      commitState();
      handled = true;
    }
  }

  if (!handled) {
    console.log('[OSC] 未识别的地址: ' + addr);
  }
  return handled;
}

var oscSocket = null;
if (oscEnabled) {
  try {
    var dgram = require('dgram');
    oscSocket = dgram.createSocket('udp4');
    oscSocket.on('message', function(buf) {
      var msg = parseOscMessage(buf);
      if (msg && msg.address) {
        handleOscMessage(msg);
      }
    });
    oscSocket.on('error', function(err) {
      console.error('[OSC] 监听错误: ' + err.message);
    });
    oscSocket.bind(OSC_PORT, function() {
      console.log('[OSC] UDP 监听已启动 - 端口 ' + OSC_PORT);
      console.log('[OSC] 支持的地址: /stage/go, /stage/next, /stage/prev, /stage/goto <N>');
    });
  } catch (e) {
    console.error('[OSC] 启动失败: ' + e.message);
  }
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
// MIME 类型表来自 lib/server-shared.js

var DOWNLOAD_DIR = path.join(__dirname, 'downloads');
// OCR 资源（tess/）内存缓存：首次读取后缓存 {headers,data}，后续请求直接从内存返回，避免热路径重复磁盘 I/O
var tessFileCache = {};

function serveStatic(req, res, isClientPortal) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // 聚合入口页：clientPort 根路径无 token 时返回 CLIENT_PORTAL_HTML
  if (isClientPortal && (urlPath === '/' || urlPath === '/index.html')) {
    var portalParams = new URL(req.url, 'http://localhost').searchParams;
    if (!portalParams.get('token')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(CLIENT_PORTAL_HTML);
      return;
    }
  }

  // API: 服务器信息
  if (urlPath === '/api/server-info') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ip: primaryIP, port: actualPort, clientPort: actualClientPort, configuredClientPort: _config.clientPort, clientPortOverride: CLIENT_PORT_ENV_OVERRIDE, ips: localIPs, oscPort: oscEnabled ? OSC_PORT : null }));
    return;
  }

  // API: 端口配置
  if (urlPath === '/api/config') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ port: _config.port || 3000, clientPort: _config.clientPort, actualClientPort: actualClientPort, clientPortOverride: CLIENT_PORT_ENV_OVERRIDE, oscPort: _config.oscPort || 5300 }));
      return;
    }
    if (req.method === 'POST') {
      var body = '';
      req.on('data', function(chunk) { body += chunk; });
      req.on('end', function() {
        try {
          var cfg = JSON.parse(body);
          if (cfg.port) _config.port = parseInt(cfg.port);
          if (cfg.clientPort) {
            var nextClientPort = parseInt(cfg.clientPort);
            if (nextClientPort === _config.port) throw new Error('clientPort 不能与主端口相同');
            _config.clientPort = nextClientPort;
          }
          if (cfg.oscPort) _config.oscPort = parseInt(cfg.oscPort);
          saveConfig(_config);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, port: _config.port, clientPort: _config.clientPort, actualClientPort: actualClientPort, clientPortOverride: CLIENT_PORT_ENV_OVERRIDE, oscPort: _config.oscPort }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
  }

  // PWA: manifest.json
  if (urlPath === '/manifest.json') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      name: "舞台流程表",
      short_name: "舞台流程",
      description: "舞台演出流程管理系统",
      display: "standalone",
      orientation: "any",
      background_color: "#000000",
      theme_color: "#000000",
      start_url: "/?role=control",
      scope: "/",
      icons: [
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
      ]
    }));
    return;
  }

  // PWA: Service Worker
  if (urlPath === '/sw.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end([
      "var CACHE='stage-manager-v2';",
      "self.addEventListener('install',function(e){self.skipWaiting();});",
      "self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});",
      "self.addEventListener('fetch',function(e){",
      "  if(e.request.method!=='GET')return;",
      "  if(e.request.url.indexOf('/tess/')!==-1){e.respondWith(fetch(e.request));return;}",
      "  e.respondWith(",
      "    caches.open(CACHE).then(function(cache){",
      "      return cache.match(e.request).then(function(cached){",
      "        var fetchPromise=fetch(e.request).then(function(response){",
      "          if(response.ok)cache.put(e.request,response.clone());",
      "          return response;",
      "        }).catch(function(){return cached;});",
      "        return fetchPromise;",
      "      });",
      "    })",
      "  );",
      "});"
    ].join('\n'));
    return;
  }

  // PWA: App Icon (SVG)
  if (urlPath === '/icon.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#000"/><text x="256" y="340" font-size="280" text-anchor="middle" fill="#fff" font-family="sans-serif">舞</text></svg>');
    return;
  }

  // /tess/ 静态文件服务（PDF.js + Tesseract OCR，从磁盘读取，首次读取后内存缓存）
  if (urlPath.indexOf('/tess/') === 0) {
    var tessFile = urlPath.replace('/tess/', '');
    // 防路径穿越
    if (tessFile.indexOf('..') !== -1 || tessFile.indexOf('/') !== -1) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    var tessCached = tessFileCache[tessFile];
    if (tessCached) { res.writeHead(200, tessCached.headers); res.end(tessCached.data); return; }
    var tessPath = path.join(__dirname, 'tess', tessFile);
    fs.readFile(tessPath, function(err, data) {
      if (err) {
        console.error('[tess] 文件未找到: ' + tessFile);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      var tessExt = path.extname(tessFile).toLowerCase();
      var tessMime = MIME[tessExt] || 'application/octet-stream';
      var tessHeaders = { 'Content-Type': tessMime, 'Content-Length': data.length, 'Cache-Control': 'no-cache' };
      if (tessExt === '.gz') tessHeaders['Content-Encoding'] = 'gzip';
      tessFileCache[tessFile] = { headers: tessHeaders, data: data };
      res.writeHead(200, tessHeaders);
      res.end(data);
    });
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
  console.log('║  聚合入口:  http://localhost:' + actualClientPort + ''.padEnd(16 - String(actualClientPort).length, ' ') + '║');
  console.log('║  导演端:   /?role=director                          ║');
  console.log('║  助理端:   /?role=assistant                        ║');
  console.log('║  幕后端:   /?role=backstage                        ║');
  console.log('║  提示屏:   /?role=screen                            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  OSC 控制: UDP 端口 ' + (oscEnabled ? OSC_PORT : '已禁用') + '                          ║');
  console.log('║  /stage/go  /stage/next  /stage/prev  /stage/goto ║');
  console.log('╚══════════════════════════════════════════════════╝');
  if (actualPort !== PORT) {
    console.log('[i] 注意: 默认端口 ' + PORT + ' 被占用，已自动切换到 ' + actualPort);
  }
}

// 启动服务器
startListening(PORT);

clientServer.on('error', function(e) {
  if (e.code === 'EADDRINUSE') {
    console.error('[!] 客户端入口端口 ' + CLIENT_PORT + ' 被占用: ' + e.message);
  } else {
    console.error('[!] clientServer 错误: ' + e.message);
  }
});
clientServer.on('listening', function() {
  actualClientPort = clientServer.address().port;
});
clientServer.listen(actualClientPort);
