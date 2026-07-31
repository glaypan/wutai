'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function source() {
  return fs.readFileSync(path.join(ROOT, 'app-source.html'), 'utf8');
}

test('program editor converts rehearsal duration between stored milliseconds and displayed minutes', () => {
  const html = source();
  assert.match(html, /彩排实测时长（分钟，0 = 未记录）/);
  assert.match(html, /StageCore\.millisecondsToMinutes\(p\.rehearsalDurationMs\)/);
  assert.match(html, /StageCore\.minutesToMilliseconds\([^\n]*edit-rehearsal-duration/);
  assert.doesNotMatch(html, /rehearsalDurationMs\s*\/\s*100/);
  assert.doesNotMatch(html, /edit-rehearsal-duration[^\n]*\*\s*1000/);
});

test('rehearsal finish keeps one stopped pending result until persistence succeeds', () => {
  const html = source();
  assert.match(html, /var pendingRehearsalFinish\s*=\s*null/);
  assert.match(html, /StageCore\.finishRehearsal\(/);
  assert.match(html, /action:\s*['"]finish_rehearsal['"]/);
  assert.match(html, /type:\s*['"]timer_rehearsal_saved['"]|case\s+['"]timer_rehearsal_saved['"]/);
  assert.match(html, /code\s*===\s*['"]persistence_failed['"]/);
  assert.match(html, /重试保存/);
  assert.doesNotMatch(html, /save_rehearsal/);
});

test('rehearsal save success reports the measured duration in minutes', () => {
  const html = source();
  const minuteToasts = html.match(/showToast\('已保存 ' \+ StageCore\.millisecondsToMinutes\([^;]+\) \+ ' 分钟'\)/g) || [];
  assert.ok(minuteToasts.length >= 3, `expected all save paths to include minutes, found ${minuteToasts.length}`);
});

test('save confirmation does not read pending rehearsal data after clearing it', () => {
  const html = source();
  assert.doesNotMatch(
    html,
    /pendingRehearsalFinish\s*=\s*null;\s*showToast\([^;]+pendingRehearsalFinish/s
  );
});

test('timer UI exposes explicit rehearsal and performance fallback controls', () => {
  const html = source();
  for (const text of ['开始彩排', '结束并保存', '重新开始', '开始演出倒计时（手动备用）', '选择节目后点击“开始彩排”记录实际用时。']) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /不自动跳到下一个节目|不自动推进/);
  assert.match(html, /StageCore\.timerInstruction\(/);
  assert.match(html, /StageCore\.nextCueSnapshot\(/);
});

test('timer can render while setup mode is active', () => {
  const html = source();
  assert.match(html, /id="shared-timer-region"[\s\S]{0,300}id="timer-section"[^>]*class="timer-section"/);
  assert.match(html, /var visible\s*=\s*settings\.enabled\s*&&\s*ROLE\s*!==\s*['"]screen['"]/);
});

test('local navigation delegates timer auto-start decisions to StageCore', () => {
  const html = source();
  assert.match(html, /function shouldStartLocalTimer\(trigger\)\s*\{[\s\S]{0,180}StageCore\.shouldAutoStartTimer\(localState\.mode, localState\.timingSettings, trigger\)/);
  assert.match(html, /resetLocalTimer\(shouldStartLocalTimer\(['"]go['"]\)\)/);
  assert.match(html, /resetLocalTimer\(shouldStartLocalTimer\(['"]program_switch['"]\)\)/);
  assert.doesNotMatch(html, /resetLocalTimer\(localState\.mode === ['"]performance['"] && localState\.timingSettings\.enabled\)/);
});

test('all channel type controls share the editable global type source', () => {
  const html = source();
  assert.match(html, /function populateChannelTypeSelect\(select, ctype, preserveValue\)/);
  assert.match(html, /function refreshChannelTypeControls\(ctype\)/);
  assert.match(html, /document\.querySelectorAll\('\[data-channel-type-select="' \+ ctype \+ '"\]'\)/);
  assert.match(html, /function renderBatchTypeGrid\(ctype\)[\s\S]{0,220}getChannelTypes\(ctype\)/);
  assert.match(html, /function getBatchTypeSelections\(ctype\)[\s\S]{0,220}getChannelTypes\(ctype\)/);
  assert.doesNotMatch(html, /const micTypeOpt\s*=\s*\[/);
  assert.doesNotMatch(html, /const lineTypeOpt\s*=\s*\[/);
});

test('opening every program editor refreshes both channel type selectors', () => {
  const html = source();
  assert.match(html, /window\.openEditProgram\s*=\s*function\s*\(idx\)[\s\S]{0,1200}\['mics','lines'\]\.forEach\(function\(ctype\)\s*\{\s*refreshChannelTypeControls\(ctype\);/);
  assert.match(html, /id="quick-add-type-mics"[^>]*data-channel-type-select="mics"/);
  assert.match(html, /id="quick-add-type-lines"[^>]*data-channel-type-select="lines"/);
});

test('desktop toolbar uses five named groups and local accessible icons', () => {
  const html = source();
  for (const group of ['节目', '舞台控制', '文件', '输出', '系统']) {
    assert.match(html, new RegExp('toolbar-group-label[^>]*>' + group + '<'));
  }
  assert.match(html, /id="local-icon-sprite"/);
  assert.match(html, /<symbol\s+id="icon-[^"]+"/);
  assert.doesNotMatch(html, /https?:\/\/[^"']*(lucide|icon)/i);

  const iconOnlyButtons = html.match(/<button\b[^>]*class="[^"]*icon-btn[^"]*"[^>]*>/g) || [];
  assert.ok(iconOnlyButtons.length > 0, 'expected icon-only buttons');
  for (const button of iconOnlyButtons) {
    assert.match(button, /\btitle="[^"]+"/, button);
    assert.match(button, /\baria-label="[^"]+"/, button);
  }
});

test('mobile navigation exposes four views, safe area, and 44px targets', () => {
  const html = source();
  assert.match(html, /id="mobile-bottom-nav"/);
  for (const view of ['programs', 'timer', 'cue', 'settings']) {
    assert.match(html, new RegExp('data-mobile-view="' + view + '"'));
    assert.match(html, new RegExp("setMobileView\\(['\"]" + view + "['\"]\\)"));
  }
  for (const label of ['节目', '计时', 'Cue', '设置']) assert.ok(html.includes(label), label);
  assert.match(html, /function\s+setMobileView\s*\(view\)/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /\.mobile-bottom-nav[\s\S]{0,800}min-height:\s*44px/);
  assert.match(html, /@media\s*\(max-width:\s*600px\)[\s\S]{0,2400}(\.modal-box|\.edit-panel)[\s\S]{0,800}(inset:\s*0|width:\s*100%)/);
  assert.match(html, /overflow-x:\s*hidden/);
});

test('OCR readiness requires a present non-empty structured resource entry', () => {
  const html = source();
  assert.match(html, /function\s+ocrResourceReady\s*\(entry\)\s*\{[\s\S]{0,180}entry\.exists\s*===\s*true[\s\S]{0,100}Number\(entry\.size\)\s*>\s*0/);
  assert.match(html, /ocrResourceReady\(files\[['"]pdf\.min\.js['"]\]\)/);
  assert.match(html, /coreFiles\.every\(function\(name\)\s*\{\s*return\s+ocrResourceReady\(files\[name\]\);\s*\}\)/);
  assert.doesNotMatch(html, /return\s+!!files\[name\]/);
});
