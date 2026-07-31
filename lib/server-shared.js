'use strict';

// lib/server-shared.js - server.js 与 server-standalone.js 共享的工具函数
//
// 提取自两个服务器文件中完全相同或仅有微小差异的代码：
//   - MIME 类型表（合并两份的并集，含音频/视频）
//   - sendTo / sendError（完全相同）
//   - broadcast / broadcastFullState / broadcastClientCount（通过工厂函数注入差异）
//
// 差异点：
//   server.js          → 单一 wss，broadcast 遍历 wss.clients
//   server-standalone  → 多个 allWebSocketServers，broadcast 遍历所有服务器 clients
//                        broadcastFullState 额外携带 cueTriggeredIds，clientCount 用 connectionCount()
//
// 用 createBroadcasters(options) 工厂函数注入这些差异，调用方拿到绑定的
// broadcast / broadcastFullState / broadcastClientCount 三个函数。

var WebSocket = require('ws').WebSocket;

// ---------- MIME 类型表（server.js 与 server-standalone.js 的并集） ----------
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.gz': 'application/gzip',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.exe': 'application/x-msdownload',
  '.bat': 'application/x-msdownload',
  '.command': 'application/octet-stream',
  '.sh': 'application/octet-stream',
  '': 'application/octet-stream'
};

// ---------- WebSocket 发送工具（两文件完全相同） ----------
function sendTo(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function sendError(ws, code, action) {
  sendTo(ws, { type: 'error', code: code, action: action });
}

// ---------- 广播工厂（注入服务器拓扑与状态差异） ----------
//
// options.getServers      - 返回 WebSocketServer[]，broadcast 会遍历它们的 clients
// options.getState        - 返回当前 state 对象
// options.getClientCount  - 返回当前客户端总数
// options.getExtraFields  - 可选，返回额外字段合并进 full_state 载荷
function createBroadcasters(options) {
  function broadcast(obj) {
    var data = JSON.stringify(obj);
    options.getServers().forEach(function(server) {
      server.clients.forEach(function(c) {
        if (c.readyState === WebSocket.OPEN) c.send(data);
      });
    });
  }

  function broadcastFullState() {
    var payload = {
      type: 'full_state',
      state: options.getState(),
      clientCount: options.getClientCount()
    };
    var extra = options.getExtraFields && options.getExtraFields();
    if (extra) {
      Object.keys(extra).forEach(function(k) { payload[k] = extra[k]; });
    }
    broadcast(payload);
  }

  function broadcastClientCount() {
    broadcast({ type: 'client_count', count: options.getClientCount() });
  }

  return {
    broadcast: broadcast,
    broadcastFullState: broadcastFullState,
    broadcastClientCount: broadcastClientCount
  };
}

module.exports = {
  MIME: MIME,
  sendTo: sendTo,
  sendError: sendError,
  createBroadcasters: createBroadcasters
};
