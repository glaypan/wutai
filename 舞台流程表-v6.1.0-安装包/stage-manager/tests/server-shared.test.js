'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const shared = require('../lib/server-shared');

test('sendTo 只向 OPEN WebSocket 发送 JSON', () => {
  const sent = [];
  shared.sendTo({ readyState: WebSocket.OPEN, send: value => sent.push(value) }, { type: 'ping' });
  shared.sendTo({ readyState: WebSocket.CLOSED, send: () => sent.push('closed') }, { type: 'nope' });
  assert.deepEqual(sent, ['{"type":"ping"}']);
});

test('广播工厂只向 OPEN 客户端广播并合并 full_state 扩展字段', () => {
  const sent = [];
  const server = {
    clients: new Set([
      { readyState: WebSocket.OPEN, send: value => sent.push(JSON.parse(value)) },
      { readyState: WebSocket.CLOSED, send: () => sent.push({ closed: true }) }
    ])
  };
  const broadcasters = shared.createBroadcasters({
    getServers: () => [server],
    getState: () => ({ mode: 'setup' }),
    getClientCount: () => 1,
    getExtraFields: () => ({ cueTriggeredIds: [] })
  });
  broadcasters.broadcastFullState();
  assert.deepEqual(sent, [{ type: 'full_state', state: { mode: 'setup' }, clientCount: 1, cueTriggeredIds: [] }]);
});

test('广播事件附加序号并可读取恢复事件', () => {
  const sent = [];
  const server = { clients: new Set([{ readyState: WebSocket.OPEN, send: value => sent.push(JSON.parse(value)) }]) };
  const broadcasters = shared.createBroadcasters({
    getServers: () => [server],
    getState: () => ({}),
    getClientCount: () => 1,
    getExtraFields: () => ({}),
    getEventMeta: () => ({ seq: 7, serverInstanceId: 'server-1' })
  });
  broadcasters.broadcast({ type: 'cue_triggered', cue: { id: 'cue-1' } });
  assert.deepEqual(sent, [{ type: 'cue_triggered', cue: { id: 'cue-1' }, seq: 7, serverInstanceId: 'server-1' }]);
  assert.deepEqual(broadcasters.getEventBuffer().map(item => item.type), ['cue_triggered']);
});
