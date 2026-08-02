'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../stage-core');

test('stage-core 公开 API 保持稳定', () => {
  assert.deepEqual(Object.keys(core).sort(), [
    'applyTimerAction', 'buildChannels', 'collectDueCues', 'computeTimer',
    'finishRehearsal', 'formatTimerClock', 'mapMidiCommand',
    'millisecondsToMinutes', 'minutesToMilliseconds', 'nextCueSnapshot',
    'normalizeCue', 'normalizeMediaPath', 'normalizeMidiEvent',
    'normalizeMidiSettings', 'normalizeRuntimeTimer', 'normalizeTimingSettings',
    'programDurationMs', 'removeChannelReferences', 'resetTimerForProgram',
    'shouldAutoStartTimer', 'timerInstruction', 'createEventBuffer',
    'createActionDeduper', 'transitionTally', 'transitionApproval'
  ].sort());
});

test('暂停时间不计入节目运行时间', () => {
  let timer = core.applyTimerAction(1000, null, 'start', 0);
  timer = core.applyTimerAction(4000, timer, 'pause', 0);
  timer = core.applyTimerAction(9000, timer, 'start', 0);
  assert.equal(core.computeTimer(12000, timer, {}).elapsedMs, 6000);
});

test('媒体路径拒绝目录穿越和反斜杠', () => {
  assert.equal(core.normalizeMediaPath('/media/audio/a.mp3'), 'audio/a.mp3');
  assert.equal(core.normalizeMediaPath('/media/../show.json'), null);
  assert.equal(core.normalizeMediaPath('/media/audio\\a.mp3'), null);
});

test('事件缓存返回 lastSeq 之后的连续事件', () => {
  const buffer = core.createEventBuffer(3);
  buffer.push({ type: 'first' });
  buffer.push({ type: 'second' });
  assert.deepEqual(buffer.after(1).map(event => event.seq), [2]);
  assert.equal(buffer.currentSeq(), 2);
});

test('事件缓存无法恢复过旧序号', () => {
  const buffer = core.createEventBuffer(2);
  buffer.push({ type: 'first' });
  buffer.push({ type: 'second' });
  buffer.push({ type: 'third' });
  assert.equal(buffer.after(0), null);
});

test('动作去重返回首次执行结果', () => {
  const store = core.createActionDeduper(1000, 10);
  const first = store.run('go-1', 100, () => ({ currentProgramIndex: 1 }));
  const second = store.run('go-1', 200, () => ({ currentProgramIndex: 2 }));
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.result.currentProgramIndex, 1);
});

test('动作去重记录过期后允许重新执行', () => {
  const store = core.createActionDeduper(100, 10);
  store.run('go-1', 100, () => 1);
  const result = store.run('go-1', 201, () => 2);
  assert.equal(result.duplicate, false);
  assert.equal(result.result, 2);
});

test('Tally 只能从 sent 进入一个终态', () => {
  const acknowledged = core.transitionTally({ tallyId: 't1', status: 'sent' }, 'acknowledged', 100);
  assert.equal(acknowledged.status, 'acknowledged');
  assert.equal(acknowledged.acknowledgedAt, 100);
  assert.throws(() => core.transitionTally(acknowledged, 'dismissed', 200));
});

test('Tally 超过截止时间进入 expired', () => {
  const expired = core.transitionTally({ tallyId: 't2', status: 'sent', expiresAt: 100 }, 'expired', 101);
  assert.equal(expired.status, 'expired');
});

test('审批只能从 pending 进入一个终态', () => {
  const approved = core.transitionApproval({ requestId: 'r1', status: 'pending' }, 'approved', 100, { note: 'ok' });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.resolvedAt, 100);
  assert.equal(approved.note, 'ok');
  assert.throws(() => core.transitionApproval(approved, 'rejected', 200));
});

test('审批拒绝保留拒绝原因', () => {
  const rejected = core.transitionApproval({ requestId: 'r2', status: 'pending' }, 'rejected', 300, { reason: '现场未准备好' });
  assert.equal(rejected.reason, '现场未准备好');
});
