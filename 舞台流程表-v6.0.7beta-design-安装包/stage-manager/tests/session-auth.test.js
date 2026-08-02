const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionStore, parseCookieHeader } = require('../lib/session-auth');

test('会话绑定角色并在过期后失效', () => {
  const store = createSessionStore({ ttlMs: 60000, now: () => 1000 });
  const sessionId = store.create('director');
  assert.equal(sessionId.length, 64);
  assert.equal(store.getRole(sessionId), 'director');
  store.setNow(() => 61001);
  assert.equal(store.getRole(sessionId), null);
});

test('Cookie 解析只返回精确的会话值', () => {
  assert.equal(parseCookieHeader('foo=bar; stage_session=abc123; theme=dark').stage_session, 'abc123');
  assert.equal(parseCookieHeader('stage_session=abc%20123').stage_session, 'abc 123');
});
