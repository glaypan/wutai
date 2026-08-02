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

  // 内部辅助：对已归一化的 timer 执行动作，避免下游重复调用 normalizeRuntimeTimer（仅模块内部使用）
  function applyTimerActionInternal(now, timer, action, programIndex) {
    var timestamp = asPositiveNumber(now);
    if (action === 'reset') return resetTimerForProgram(programIndex);
    if (action === 'pause') {
      // 暂停仅对正在运行且已开始的 timer 生效，记录 pausedAt 供后续继续时累加暂停时长
      if (timer.running && timer.startedAt) {
        timer.running = false;
        timer.pausedAt = timestamp;
      }
      return timer;
    }
    if (action === 'start') {
      if (timer.running) return timer;
      // 继续：从暂停态恢复时把这段暂停时长累加进 pausedTotalMs；首次启动则重置起点
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

  function applyTimerAction(now, value, action, programIndex) {
    var timer = normalizeRuntimeTimer(value, programIndex);
    return applyTimerActionInternal(now, timer, action, programIndex);
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

  function minutesToMilliseconds(value) {
    var minutes = Number(value);
    // 1440 分钟 = 24 小时，作为节目时长的硬上限；超出或非法输入返回 0 表示拒绝
    if (!isFinite(minutes) || minutes < 0 || minutes > 1440) return 0;
    return Math.round(minutes * 60000);
  }

  function millisecondsToMinutes(value) {
    var milliseconds = Number(value);
    if (!isFinite(milliseconds) || milliseconds < 0 || milliseconds > 86400000) return 0;
    return milliseconds / 60000;
  }

  function programDurationMs(program, preferRehearsal) {
    var item = program && typeof program === 'object' ? program : {};
    var rehearsalMs = asPositiveNumber(item.rehearsalDurationMs);
    if (preferRehearsal !== false && rehearsalMs) return rehearsalMs;
    return minutesToMilliseconds(item.duration);
  }

  function finishRehearsal(now, timerState, programIndex, program) {
    var timer = normalizeRuntimeTimer(timerState, programIndex);
    var timing = computeTimer(now, timer, program);
    // timer 已归一化，直接走 internal 避免二次归一化（行为与 applyTimerAction 完全一致）
    var stopped = applyTimerActionInternal(now, timer, 'pause', programIndex);
    return {
      elapsedMs: timing.elapsedMs,
      rehearsalDurationMs: timing.elapsedMs,
      runtimeTimer: stopped
    };
  }

  function shouldAutoStartTimer(mode, timingSettings, trigger) {
    var settings = normalizeTimingSettings(timingSettings);
    return mode === 'performance' && settings.enabled && settings.phase === 'show' &&
      (trigger === 'go' || trigger === 'program_switch');
  }

  function timerInstruction(mode, timingSettings, timerState, program) {
    var settings = normalizeTimingSettings(timingSettings);
    var timer = timerState && typeof timerState === 'object' ? timerState : {};
    var item = program && typeof program === 'object' ? program : {};
    if (!settings.enabled) return '请先开启“启用节目计时”。';
    if (settings.phase === 'rehearsal') {
      if (timer.running) return '彩排计时中，点击“结束彩排”保存实际用时。';
      if (asPositiveNumber(timer.startedAt)) return '彩排已暂停，可继续或结束并保存实际用时。';
      return '选择节目后点击“开始彩排”记录实际用时。';
    }
    if (!programDurationMs(item, settings.preferRehearsal)) return '请先设置节目时长，再开始演出倒计时。';
    if (mode !== 'performance') return '切换到演出模式后，GO 或节目切换会开始倒计时。';
    if (timer.running) return '演出倒计时进行中。';
    return '点击 GO 或切换节目开始演出倒计时。';
  }

  function formatTimerClock(value, signed) {
    var raw = Number(value);
    var milliseconds = isFinite(raw) ? raw : 0;
    // 超时不自动推进节目：负值表示已超时，取绝对值显示并在 signed 模式下加 '+' 前缀提示
    var prefix = signed && milliseconds < 0 ? '+' : '';
    var absolute = Math.abs(milliseconds);
    var minutes = Math.floor(absolute / 60000);
    var seconds = Math.floor((absolute % 60000) / 1000);
    var tenths = Math.floor((absolute % 1000) / 100);
    return prefix + (minutes < 10 ? '0' : '') + minutes + ':' +
      (seconds < 10 ? '0' : '') + seconds + '.' + tenths;
  }

  // 内部辅助：构建已启用轨道的 id 集合（enabled !== false 即视为启用，两个调用点逻辑等价）
  function collectEnabledTracks(tracks) {
    var map = {};
    (Array.isArray(tracks) ? tracks : []).forEach(function (track) {
      if (track && track.enabled !== false) map[String(track.id)] = true;
    });
    return map;
  }

  // 内部辅助：过滤出当前节目下、属于启用轨道且尚未触发的 cue（仅模块内部使用）
  function filterPendingCues(cues, programIndex, enabledTracks, triggered) {
    return (Array.isArray(cues) ? cues : []).filter(function (cue) {
      return cue && Number(cue.programIndex) === Number(programIndex) &&
        enabledTracks[String(cue.trackId)] === true && !triggered[String(cue.id)];
    });
  }

  // 内部辅助：按 offsetMs 升序排序（filter 已返回新数组，可直接原地 sort 不污染原数组）
  function sortByOffsetMs(cues) {
    return cues.sort(function (a, b) {
      return (Number(a.offsetMs) || 0) - (Number(b.offsetMs) || 0);
    });
  }

  function nextCueSnapshot(timeline, programIndex, elapsedMs, triggeredIds, autoCue) {
    var source = timeline || {};
    var tracks = Array.isArray(source.tracks) ? source.tracks : [];
    var enabledTracks = collectEnabledTracks(tracks);
    var trackNames = {};
    var triggered = triggeredIds || {};
    var elapsed = Math.max(0, Number(elapsedMs) || 0);

    tracks.forEach(function (track) {
      if (!track || track.enabled === false) return;
      trackNames[String(track.id)] = String(track.name || track.id || '');
    });

    var pending = sortByOffsetMs(filterPendingCues(source.cues, programIndex, enabledTracks, triggered));
    var cue = pending.length ? pending[0] : null;
    return {
      cue: cue,
      trackName: cue ? trackNames[String(cue.trackId)] || '' : '',
      remainingMs: cue ? Math.max(0, Number(cue.offsetMs) || 0) - elapsed : null,
      manual: !autoCue
    };
  }

  function collectDueCues(timeline, programIndex, elapsedMs, triggeredIds) {
    var source = timeline || {};
    var enabledTracks = collectEnabledTracks(source.tracks);
    var triggered = triggeredIds || {};
    var elapsed = Math.max(0, Number(elapsedMs) || 0);

    // Cue 触发条件：节目匹配 + 启用轨道 + 未触发 + offsetMs 已到达当前 elapsed
    return sortByOffsetMs(filterPendingCues(source.cues, programIndex, enabledTracks, triggered).filter(function (cue) {
      return Math.max(0, Number(cue.offsetMs) || 0) <= elapsed;
    }));
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

  function createEventBuffer(limit) {
    var max = Math.max(1, parseInt(limit, 10) || 200);
    var sequence = 0;
    var items = [];
    return {
      push: function (event) {
        var stored = Object.assign({}, event, { seq: ++sequence });
        items.push(stored);
        if (items.length > max) items.shift();
        return stored;
      },
      after: function (lastSeq) {
        var value = Number(lastSeq);
        if (!Number.isInteger(value) || value < 0) return null;
        if (items.length && value < items[0].seq - 1) return null;
        return items.filter(function (item) { return item.seq > value; });
      },
      currentSeq: function () { return sequence; }
    };
  }

  function createActionDeduper(ttlMs, limit) {
    var ttl = Math.max(1, Number(ttlMs) || 300000);
    var max = Math.max(1, parseInt(limit, 10) || 1000);
    var records = new Map();

    function cleanup(now) {
      records.forEach(function (record, key) {
        if (record.expiresAt <= now) records.delete(key);
      });
      while (records.size > max) records.delete(records.keys().next().value);
    }

    return {
      run: function (actionId, now, execute) {
        var timestamp = Number(now);
        cleanup(timestamp);
        if (records.has(actionId)) return { duplicate: true, result: records.get(actionId).result };
        var result = execute();
        records.set(actionId, { expiresAt: timestamp + ttl, result: result });
        cleanup(timestamp);
        return { duplicate: false, result: result };
      }
    };
  }

  function transitionTally(tally, nextStatus, now) {
    var current = tally && tally.status || 'sent';
    var allowed = { acknowledged: true, dismissed: true, expired: true };
    if (current !== 'sent' || !allowed[nextStatus]) throw new Error('invalid tally transition');
    var result = Object.assign({}, tally, { status: nextStatus });
    var timestamp = Number(now);
    if (!Number.isFinite(timestamp)) timestamp = Date.now();
    result[nextStatus + 'At'] = timestamp;
    return result;
  }

  function transitionApproval(approval, nextStatus, now, details) {
    if (!approval || (approval.status || 'pending') !== 'pending' || ['approved', 'rejected', 'expired'].indexOf(nextStatus) < 0) throw new Error('invalid approval transition');
    var timestamp = Number(now);
    if (!Number.isFinite(timestamp)) timestamp = Date.now();
    var result = Object.assign({}, approval, { status: nextStatus, resolvedAt: timestamp });
    details = details || {};
    if (details.reason !== undefined) result.reason = String(details.reason).slice(0, 500);
    if (details.note !== undefined) result.note = String(details.note).slice(0, 500);
    return result;
  }

  return {
    normalizeTimingSettings: normalizeTimingSettings,
    normalizeRuntimeTimer: normalizeRuntimeTimer,
    resetTimerForProgram: resetTimerForProgram,
    applyTimerAction: applyTimerAction,
    computeTimer: computeTimer,
    minutesToMilliseconds: minutesToMilliseconds,
    millisecondsToMinutes: millisecondsToMinutes,
    programDurationMs: programDurationMs,
    finishRehearsal: finishRehearsal,
    shouldAutoStartTimer: shouldAutoStartTimer,
    timerInstruction: timerInstruction,
    formatTimerClock: formatTimerClock,
    nextCueSnapshot: nextCueSnapshot,
    collectDueCues: collectDueCues,
    buildChannels: buildChannels,
    removeChannelReferences: removeChannelReferences,
    normalizeCue: normalizeCue,
    normalizeMediaPath: normalizeMediaPath,
    normalizeMidiEvent: normalizeMidiEvent,
    normalizeMidiSettings: normalizeMidiSettings,
    mapMidiCommand: mapMidiCommand,
    createEventBuffer: createEventBuffer,
    createActionDeduper: createActionDeduper,
    transitionTally: transitionTally,
    transitionApproval: transitionApproval
  };
}));
