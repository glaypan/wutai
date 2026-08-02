'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const stable = require('../舞台流程表-v6.0.7-安装包/stage-manager/stage-core');
const beta = require('../舞台流程表-v6.0.7beta-design-安装包/stage-manager/stage-core');

test('双版本核心公开 API 一致', () => {
  assert.deepEqual(Object.keys(beta).sort(), Object.keys(stable).sort());
});

test('双版本核心对同一输入产生一致结果', () => {
  const input = { id: 'cue-1', programIndex: 0, trackId: 'audio', offsetMs: 500, durationMs: 1000, label: 'a.mp3' };
  assert.deepEqual(beta.normalizeCue(input), stable.normalizeCue(input));
  assert.deepEqual(beta.normalizeMediaPath('/media/audio/a.mp3'), stable.normalizeMediaPath('/media/audio/a.mp3'));
});
