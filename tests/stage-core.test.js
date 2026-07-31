'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const StageCore = require('../stage-core.js');

test('分钟和毫秒互转且支持小数分钟', () => {
  assert.equal(StageCore.minutesToMilliseconds('3.5'), 210000);
  assert.equal(StageCore.minutesToMilliseconds('4.25'), 255000);
  assert.equal(StageCore.millisecondsToMinutes(210000), 3.5);
  assert.equal(StageCore.millisecondsToMinutes(0), 0);
  assert.equal(StageCore.minutesToMilliseconds(NaN), 0);
  assert.equal(StageCore.minutesToMilliseconds(-1), 0);
  assert.equal(StageCore.minutesToMilliseconds(1441), 0);
});

test('实测优先，计划时长作为回退', () => {
  assert.equal(StageCore.programDurationMs({ duration: 4.5, rehearsalDurationMs: 210000 }, true), 210000);
  assert.equal(StageCore.programDurationMs({ duration: 4.5, rehearsalDurationMs: 0 }, true), 270000);
  assert.equal(StageCore.programDurationMs({ duration: 4.5, rehearsalDurationMs: 210000 }, false), 270000);
  assert.equal(StageCore.programDurationMs({ duration: 0, rehearsalDurationMs: 0 }, true), 0);
});

test('结束彩排保存经过时间并停止 timer', () => {
  const result = StageCore.finishRehearsal(10000, {
    programIndex: 2, startedAt: 1000, pausedAt: 0, pausedTotalMs: 0, running: true
  }, 2, { duration: 5, rehearsalDurationMs: 0 });
  assert.equal(result.elapsedMs, 9000);
  assert.equal(result.rehearsalDurationMs, 9000);
  assert.equal(result.runtimeTimer.running, false);
  assert.equal(result.runtimeTimer.programIndex, 2);
});

test('暂停中的彩排结束后经过时间不随 wall clock 增长', () => {
  const result = StageCore.finishRehearsal(20000, {
    programIndex: 1, startedAt: 1000, pausedAt: 7000, pausedTotalMs: 1000, running: false
  }, 1, { duration: 5 });
  assert.equal(result.elapsedMs, 5000);
  assert.equal(result.rehearsalDurationMs, 5000);
});

test('彩排不因节目切换自动启动，演出仅在启用时自动启动', () => {
  assert.equal(StageCore.shouldAutoStartTimer('performance', { enabled: true, phase: 'rehearsal' }, 'program_switch'), false);
  assert.equal(StageCore.shouldAutoStartTimer('performance', { enabled: true, phase: 'show' }, 'program_switch'), true);
  assert.equal(StageCore.shouldAutoStartTimer('performance', { enabled: true, phase: 'show' }, 'go'), true);
  assert.equal(StageCore.shouldAutoStartTimer('performance', { enabled: false, phase: 'show' }, 'go'), false);
});

test('倒计时超时使用带加号的格式且不自动推进', () => {
  assert.equal(StageCore.formatTimerClock(-12300, true), '+00:12.3');
  assert.equal(StageCore.formatTimerClock(12300, false), '00:12.3');
  assert.equal(StageCore.timerInstruction('rehearsal', { enabled: true, phase: 'rehearsal' }, { running: false, startedAt: 0 }, { duration: 3 }), '选择节目后点击“开始彩排”记录实际用时。');
});

test('下一 Cue 快照过滤禁用轨道和已触发 Cue', () => {
  const snapshot = StageCore.nextCueSnapshot({
    tracks: [
      { id: 'audio', name: '音频', enabled: true },
      { id: 'light', name: '灯光', enabled: false }
    ],
    cues: [
      { id: 'done', programIndex: 2, trackId: 'audio', offsetMs: 1000, label: '已完成' },
      { id: 'disabled', programIndex: 2, trackId: 'light', offsetMs: 1500, label: '禁用' },
      { id: 'next', programIndex: 2, trackId: 'audio', offsetMs: 5000, label: '下一条' }
    ]
  }, 2, 2000, { done: true }, false);
  assert.equal(snapshot.cue.id, 'next');
  assert.equal(snapshot.trackName, '音频');
  assert.equal(snapshot.remainingMs, 3000);
  assert.equal(snapshot.manual, true);
});

test('没有待触发 Cue 时返回空快照', () => {
  assert.deepEqual(StageCore.nextCueSnapshot({ tracks: [], cues: [] }, 0, 0, {}, true), {
    cue: null,
    trackName: '',
    remainingMs: null,
    manual: false
  });
});

test('collectDueCues 保持既有排序和过滤行为', () => {
  const due = StageCore.collectDueCues({
    tracks: [{ id: 'audio', enabled: true }, { id: 'off', enabled: false }],
    cues: [
      { id: 'late', programIndex: 0, trackId: 'audio', offsetMs: 2000 },
      { id: 'early', programIndex: 0, trackId: 'audio', offsetMs: 500 },
      { id: 'future', programIndex: 0, trackId: 'audio', offsetMs: 3000 },
      { id: 'disabled', programIndex: 0, trackId: 'off', offsetMs: 100 }
    ]
  }, 0, 2500, { early: true });
  assert.deepEqual(due.map(cue => cue.id), ['late']);
});
