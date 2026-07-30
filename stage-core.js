(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StageCore = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalizeTimingSettings(value) {
    var source = value && typeof value === 'object' ? value : {};
    return {
      enabled: source.enabled === true,
      phase: source.phase === 'show' ? 'show' : 'rehearsal',
      autoCue: source.autoCue === true,
      preferRehearsal: source.preferRehearsal !== false
    };
  }

  function asPositiveNumber(value) {
    var number = Number(value);
    return isFinite(number) && number > 0 ? number : 0;
  }

  function asNonNegativeNumber(value) {
    var number = Number(value);
    return isFinite(number) && number >= 0 ? number : 0;
  }

  function resetTimerForProgram(programIndex) {
    return {
      programIndex: Math.max(0, parseInt(programIndex, 10) || 0),
      startedAt: 0,
      pausedAt: 0,
      pausedTotalMs: 0,
      running: false
    };
  }

  function normalizeRuntimeTimer(value, programIndex) {
    var source = value && typeof value === 'object' ? value : {};
    var targetProgram = Math.max(0, parseInt(programIndex, 10) || 0);
    var timerProgram = Math.max(0, parseInt(source.programIndex, 10) || 0);
    if (timerProgram !== targetProgram) return resetTimerForProgram(targetProgram);
    return {
      programIndex: timerProgram,
      startedAt: asPositiveNumber(source.startedAt),
      pausedAt: asPositiveNumber(source.pausedAt),
      pausedTotalMs: asNonNegativeNumber(source.pausedTotalMs),
      running: source.running === true
    };
  }

  function applyTimerAction(now, value, action, programIndex) {
    var timestamp = asPositiveNumber(now);
    var timer = normalizeRuntimeTimer(value, programIndex);
    if (action === 'reset') return resetTimerForProgram(programIndex);
    if (action === 'pause') {
      if (timer.running && timer.startedAt) {
        timer.running = false;
        timer.pausedAt = timestamp;
      }
      return timer;
    }
    if (action === 'start') {
      if (timer.running) return timer;
      if (timer.startedAt && timer.pausedAt) {
        timer.pausedTotalMs += Math.max(0, timestamp - timer.pausedAt);
      } else {
        timer.startedAt = timestamp;
        timer.pausedTotalMs = 0;
      }
      timer.pausedAt = 0;
      timer.running = true;
    }
    return timer;
  }

  function computeTimer(now, timerState, program) {
    var state = timerState || {};
    var item = program || {};
    var startedAt = asPositiveNumber(state.startedAt);
    var endAt = state.running === false && asPositiveNumber(state.pausedAt)
      ? asPositiveNumber(state.pausedAt)
      : asPositiveNumber(now);
    var elapsedMs = startedAt ? Math.max(0, endAt - startedAt - asPositiveNumber(state.pausedTotalMs)) : 0;
    var phase = state.phase === 'show' ? 'show' : 'rehearsal';
    var rehearsalMs = asPositiveNumber(item.rehearsalDurationMs);
    var plannedMs = asPositiveNumber(item.duration) * 60000;
    var durationMs = state.preferRehearsal !== false && rehearsalMs ? rehearsalMs : plannedMs;
    var remainingMs = phase === 'show' && durationMs ? durationMs - elapsedMs : null;

    return {
      elapsedMs: elapsedMs,
      durationMs: durationMs,
      remainingMs: remainingMs,
      overtime: remainingMs !== null && remainingMs < 0
    };
  }

  function collectDueCues(timeline, programIndex, elapsedMs, triggeredIds) {
    var source = timeline || {};
    var enabledTracks = {};
    var triggered = triggeredIds || {};
    var tracks = Array.isArray(source.tracks) ? source.tracks : [];
    var cues = Array.isArray(source.cues) ? source.cues : [];

    tracks.forEach(function (track) {
      if (track && track.enabled !== false) enabledTracks[String(track.id)] = true;
    });

    return cues.filter(function (cue) {
      return cue && Number(cue.programIndex) === Number(programIndex) &&
        enabledTracks[String(cue.trackId)] === true &&
        !triggered[String(cue.id)] &&
        Math.max(0, Number(cue.offsetMs) || 0) <= Math.max(0, Number(elapsedMs) || 0);
    }).sort(function (a, b) {
      return (Number(a.offsetMs) || 0) - (Number(b.offsetMs) || 0);
    });
  }

  function buildChannels(category, type, count, baseIndex, idSeed, label, customType) {
    var prefix = category === 'lines' ? 'line' : 'mic';
    var total = Math.max(1, Math.min(99, parseInt(count, 10) || 1));
    var start = Math.max(0, parseInt(baseIndex, 10) || 0);
    var channelType = type || (category === 'lines' ? 'stereo_line' : 'wireless_headset');
    var custom = channelType === 'custom' ? String(customType || '').trim() : '';
    var baseName = custom || String(label || (category === 'lines' ? '线路' : '话筒'));
    var channels = [];

    for (var i = 0; i < total; i++) {
      channels.push({
        id: prefix + '_' + String(idSeed || Date.now()) + '_' + (start + i),
        name: baseName + (start + i + 1),
        type: channelType,
        notes: '',
        customType: custom
      });
    }
    return channels;
  }

  function removeChannelReferences(programs, channelId) {
    return (Array.isArray(programs) ? programs : []).map(function (program) {
      var copy = {};
      var source = program || {};
      Object.keys(source).forEach(function (key) { copy[key] = source[key]; });
      copy.useChannels = (Array.isArray(source.useChannels) ? source.useChannels : []).filter(function (id) {
        return id !== channelId;
      });
      return copy;
    });
  }

  function normalizeCue(value) {
    var cue = value && typeof value === 'object' ? value : {};
    return {
      id: String(cue.id || ('cue_' + Date.now())).slice(0, 80),
      programIndex: Math.max(0, parseInt(cue.programIndex, 10) || 0),
      trackId: String(cue.trackId || 'audio').slice(0, 40),
      offsetMs: Math.max(0, Math.min(86400000, parseInt(cue.offsetMs, 10) || 0)),
      durationMs: Math.max(0, Math.min(86400000, parseInt(cue.durationMs, 10) || 0)),
      label: String(cue.label || '').slice(0, 300),
      payload: cue.payload && typeof cue.payload === 'object' ? cue.payload : {}
    };
  }

  function normalizeMediaPath(value) {
    var raw = String(value || '');
    var decoded;
    try { decoded = decodeURIComponent(raw); } catch (error) { return null; }
    if (decoded.indexOf('\\') !== -1 || decoded.indexOf('\0') !== -1) return null;
    var prefix = decoded.indexOf('/media/') === 0 ? '/media/' : (decoded.indexOf('media/') === 0 ? 'media/' : '');
    if (!prefix) return null;
    var relative = decoded.slice(prefix.length);
    if (!relative) return null;
    var parts = relative.split('/');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || parts[i] === '.' || parts[i] === '..') return null;
    }
    return parts.join('/');
  }

  function normalizeMidiEvent(value) {
    var source = value && typeof value === 'object' ? value : {};
    var status = Number(source.status);
    var data1 = Number(source.data1);
    var data2 = source.data2 === undefined ? 0 : Number(source.data2);
    if (!isFinite(status) || status < 0 || status > 255 || Math.floor(status) !== status) return null;
    if (!isFinite(data1) || data1 < 0 || data1 > 127 || Math.floor(data1) !== data1) return null;
    if (!isFinite(data2) || data2 < 0 || data2 > 127 || Math.floor(data2) !== data2) return null;
    return {
      status: status,
      data1: data1,
      data2: data2,
      channel: (status & 15) + 1
    };
  }

  function normalizeMidiSettings(value) {
    var source = value && typeof value === 'object' ? value : {};
    var defaults = {
      go: { type: 'note', val: 60 },
      next: { type: 'note', val: 62 },
      prev: { type: 'note', val: 58 }
    };
    var result = {
      enabled: source.enabled !== false,
      channel: 0
    };
    var channel = Number(source.channel);
    if (isFinite(channel) && Math.floor(channel) === channel && channel >= 0 && channel <= 16) result.channel = channel;
    ['go', 'next', 'prev'].forEach(function (key) {
      var mapping = source[key] && typeof source[key] === 'object' ? source[key] : {};
      var type = ['note', 'cc', 'pc'].indexOf(mapping.type) >= 0 ? mapping.type : defaults[key].type;
      var number = Number(mapping.val);
      var val = isFinite(number) && Math.floor(number) === number && number >= 0 && number <= 127 ? number : defaults[key].val;
      result[key] = { type: type, val: val };
    });
    return result;
  }

  function mapMidiCommand(value, settings) {
    var event = normalizeMidiEvent(value);
    var config = settings && typeof settings === 'object' ? settings : {};
    if (!event || config.enabled === false) return null;
    var configuredChannel = Math.max(0, Math.min(16, parseInt(config.channel, 10) || 0));
    if (configuredChannel && configuredChannel !== event.channel) return null;

    var command = event.status >> 4;
    var messageType = null;
    if (command === 9 && event.data2 > 0) messageType = 'note';
    else if (command === 11) messageType = 'cc';
    else if (command === 12) messageType = 'pc';
    if (!messageType) return null;

    var actions = [
      { key: 'go', action: 'advance' },
      { key: 'next', action: 'next' },
      { key: 'prev', action: 'prev' }
    ];
    for (var i = 0; i < actions.length; i++) {
      var mapping = config[actions[i].key];
      if (mapping && mapping.type === messageType && Number(mapping.val) === event.data1) return actions[i].action;
    }
    return null;
  }

  return {
    normalizeTimingSettings: normalizeTimingSettings,
    normalizeRuntimeTimer: normalizeRuntimeTimer,
    resetTimerForProgram: resetTimerForProgram,
    applyTimerAction: applyTimerAction,
    computeTimer: computeTimer,
    collectDueCues: collectDueCues,
    buildChannels: buildChannels,
    removeChannelReferences: removeChannelReferences,
    normalizeCue: normalizeCue,
    normalizeMediaPath: normalizeMediaPath,
    normalizeMidiEvent: normalizeMidiEvent,
    normalizeMidiSettings: normalizeMidiSettings,
    mapMidiCommand: mapMidiCommand
  };
}));
