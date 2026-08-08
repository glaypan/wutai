'use strict';

var crypto = require('crypto');

function parseCookieHeader(header) {
  var result = {};
  String(header || '').split(';').forEach(function(part) {
    var index = part.indexOf('=');
    if (index < 1) return;
    var name = part.slice(0, index).trim();
    var value = part.slice(index + 1).trim();
    try { result[name] = decodeURIComponent(value); }
    catch (e) { result[name] = value; }
  });
  return result;
}

function createSessionStore(options) {
  options = options || {};
  var ttlMs = Math.max(60000, Number(options.ttlMs) || 43200000);
  var maxSessions = Math.max(10, Number(options.maxSessions) || 1000);
  var now = options.now || Date.now;
  var sessions = new Map();

  function cleanup() {
    var timestamp = now();
    sessions.forEach(function(session, id) {
      if (session.expiresAt <= timestamp) sessions.delete(id);
    });
    while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value);
  }

  return {
    create: function(role) {
      cleanup();
      var id = crypto.randomBytes(32).toString('hex');
      sessions.set(id, { role: role, expiresAt: now() + ttlMs });
      return id;
    },
    getRole: function(id) {
      var session = sessions.get(String(id || ''));
      if (!session) return null;
      if (session.expiresAt <= now()) {
        sessions.delete(String(id));
        return null;
      }
      return session.role;
    },
    revoke: function(id) {
      sessions.delete(String(id || ''));
    },
    revokeRole: function(role) {
      sessions.forEach(function(session, id) {
        if (session.role === role) sessions.delete(id);
      });
    },
    setNow: function(nextNow) {
      now = nextNow;
    }
  };
}

module.exports = {
  createSessionStore: createSessionStore,
  parseCookieHeader: parseCookieHeader
};
