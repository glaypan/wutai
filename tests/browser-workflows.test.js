'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CONTROL_TOKEN = '111111111111111111111111111111111111111111111111';
const DIRECTOR_TOKEN = '222222222222222222222222222222222222222222222222';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function testState() {
  return {
    showName: 'v6.0.3 浏览器测试',
    mode: 'setup',
    currentProgramIndex: 0,
    version: 5,
    globalChannels: { mics: [], lines: [] },
    programs: [
      { name: '节目 A', duration: 4.5, rehearsalDurationMs: 210000, notes: '', musicCue: '', status: 'active', useChannels: [] },
      { name: '节目 B', duration: 2, rehearsalDurationMs: 0, notes: '', musicCue: '', status: 'pending', useChannels: [] }
    ],
    subtitle: { lines: [], currentIndex: -1, visible: false },
    screenSettings: { fontSize: 72, showStatus: true, showChannels: true, showMusic: true, showNotes: true, showNext: true, showProgress: true, displayMode: 'live' },
    timeline: {
      tracks: [{ id: 'audio', name: '音频', type: 'audio', enabled: true }],
      cues: [{ id: 'cue-1', programIndex: 0, trackId: 'audio', offsetMs: 5000, durationMs: 0, label: '开场音乐' }]
    },
    timingSettings: { enabled: true, phase: 'rehearsal', autoCue: false, preferRehearsal: true },
    runtimeTimer: { programIndex: 0, startedAt: 0, pausedAt: 0, pausedTotalMs: 0, running: false },
    midiBridgeSettings: { enabled: true, channel: 0, go: { type: 'note', val: 60 }, next: { type: 'note', val: 62 }, prev: { type: 'note', val: 58 } },
    channelTypes: {
      mics: [
        { v: 'wireless_headset', t: '头戴无线麦' },
        { v: 'test_mic', t: '测试话筒' }
      ],
      lines: [
        { v: 'stereo_line', t: '立体声线路' },
        { v: 'test_line', t: '测试线路' }
      ]
    }
  };
}

async function waitForHttp(url, child) {
  const deadline = Date.now() + 15000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error(`server did not become ready: ${url}`);
}

async function startIsolatedServer() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-manager-v603-'));
  for (const name of ['server-standalone.js', 'stage-core.js', 'app-source.html', 'tess', 'vendor', 'media']) {
    const source = path.join(ROOT, name);
    if (fs.existsSync(source)) fs.cpSync(source, path.join(directory, name), { recursive: true });
  }

  const [port, displayPort] = await Promise.all([freePort(), freePort()]);
  const config = {
    port,
    displayPort,
    oscPort: 5300,
    oscEnabled: false,
    oscAllowLan: false,
    roleTokens: {
      control: CONTROL_TOKEN,
      director: DIRECTOR_TOKEN,
      assistant: '333333333333333333333333333333333333333333333333',
      backstage: '444444444444444444444444444444444444444444444444'
    },
    displayToken: '555555555555555555555555555555555555555555555555',
    passwordHashes: {},
    rolePermissions: {
      director: { nav: true, subtitleControl: true, editNotes: false, editMusic: false, editChannels: false, addDel: false },
      assistant: { nav: false, subtitleControl: true, editNotes: true, editMusic: true, editChannels: true, addDel: false },
      backstage: { nav: false, subtitleControl: false, editNotes: true, editMusic: false, editChannels: false, addDel: false }
    }
  };
  fs.writeFileSync(path.join(directory, 'config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(directory, 'show.json'), JSON.stringify(testState(), null, 2));

  const child = spawn(process.execPath, ['server-standalone.js'], {
    cwd: directory,
    env: {
      ...process.env,
      PORT: String(port),
      DISPLAY_PORT: String(displayPort),
      OSC_DISABLE: '1',
      AUTO_OPEN: '0'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForHttp(`${baseUrl}/?role=control&token=${encodeURIComponent(CONTROL_TOKEN)}`, child);
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}\n${output.slice(-2000)}`);
  }
  return { directory, child, baseUrl, output: () => output };
}

async function stopIsolatedServer(fixture) {
  if (!fixture) return;
  if (fixture.child.exitCode === null) {
    fixture.child.kill();
    await Promise.race([
      new Promise(resolve => fixture.child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
  }
  fs.rmSync(fixture.directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function waitForApplication(page) {
  await page.waitForFunction(() => wsMode === true && localState && localState.programs && localState.programs.length === 2);
}

test('v6.0.3 browser workflows, permissions, OCR resources, and responsive layouts', { timeout: 120000 }, async () => {
  let fixture;
  let browser;
  try {
    fixture = await startIsolatedServer();
    browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const controlUrl = `${fixture.baseUrl}/?role=control&token=${encodeURIComponent(CONTROL_TOKEN)}`;
    await page.goto(controlUrl, { waitUntil: 'domcontentloaded' });
    await waitForApplication(page);

    await page.evaluate(() => window.openEditProgram(0));
    assert.equal(await page.locator('#edit-rehearsal-duration').inputValue(), '3.5');
    await page.locator('#edit-rehearsal-duration').fill('4.25');
    await page.evaluate(() => window.saveProgram());
    await page.waitForFunction(() => localState.programs[0].rehearsalDurationMs === 255000);

    await page.evaluate(() => window.openEditProgram(0));
    const micTypes = await page.locator('#quick-add-type-mics option').allTextContents();
    assert.ok(micTypes.includes('头戴无线麦'));
    assert.ok(micTypes.includes('测试话筒'));
    await page.locator('#quick-add-type-mics').selectOption('test_mic');
    await page.evaluate(() => window.quickAddProgramChannel('mics'));
    await page.waitForFunction(() => {
      const channel = localState.globalChannels.mics.find(item => item.type === 'test_mic');
      return channel && localState.programs[0].useChannels.includes(channel.id);
    });
    await page.evaluate(() => window.closeEditPanel());

    await page.evaluate(() => window.openTimelinePanel());
    await page.locator('#modal-timeline .cue-badge').waitFor();
    assert.match(await page.locator('#modal-timeline .cue-badge').first().innerText(), /待触发|就绪|已触发/);
    await page.evaluate(() => { window.localAutoCueTriggered['cue-1'] = true; window.renderTimelineEditor(); });
    await page.evaluate(() => window.resetCueTriggeredState());
    await page.waitForFunction(() => Object.keys(window.localAutoCueTriggered).length === 0);
    await page.evaluate(() => window.closeModal('modal-timeline'));

    await page.locator('#prog-batch-bar').waitFor();
    assert.equal(await page.locator('#batch-delete-btn').count(), 1);

    const director = await context.newPage();
    await director.goto(`${fixture.baseUrl}/?role=director&token=${encodeURIComponent(DIRECTOR_TOKEN)}`, { waitUntil: 'domcontentloaded' });
    await waitForApplication(director);
    assert.equal(await director.locator('#prog-batch-bar').count(), 0);
    assert.equal(await director.locator('.prog-sel').count(), 0);
    await director.close();

    const ocrResponse = await context.request.get(`${fixture.baseUrl}/api/ocr-status`);
    assert.equal(ocrResponse.status(), 200);
    const ocr = await ocrResponse.json();
    const files = ocr.files || ocr;
    for (const name of ['pdf.min.js', 'tesseract.min.js', 'chi_sim.traineddata.gz', 'eng.traineddata.gz']) {
      assert.equal(files[name].exists, true, name);
      assert.ok(files[name].size > 0, name);
    }
    const gzipResponse = await context.request.get(`${fixture.baseUrl}/tess/chi_sim.traineddata.gz`);
    assert.equal(gzipResponse.status(), 200);
    assert.equal(gzipResponse.headers()['content-encoding'], 'gzip');

    const viewports = [
      { width: 1440, height: 900, mobile: false },
      { width: 768, height: 1024, mobile: false },
      { width: 390, height: 844, mobile: true },
      { width: 320, height: 568, mobile: true }
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => { window.scrollTo(0, 0); window.renderAll(); });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `${viewport.width}x${viewport.height} horizontal overflow: ${overflow}`);
      const navVisible = await page.locator('#mobile-bottom-nav').isVisible();
      assert.equal(navVisible, viewport.mobile, `${viewport.width}x${viewport.height} mobile navigation`);
      if (viewport.mobile) {
        const sizes = await page.locator('#mobile-bottom-nav button').evaluateAll(buttons => buttons.map(button => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }));
        for (const size of sizes) {
          assert.ok(size.width >= 44, `mobile target width ${size.width}`);
          assert.ok(size.height >= 44, `mobile target height ${size.height}`);
        }
      }
    }

    const saved = await page.evaluate(({ token }) => new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${location.host}/?role=control&token=${encodeURIComponent(token)}`);
      const timer = setTimeout(() => { socket.close(); reject(new Error('timer save timeout')); }, 10000);
      socket.onerror = () => { clearTimeout(timer); reject(new Error('timer save websocket error')); };
      socket.onopen = () => socket.send(JSON.stringify({ type: 'timer_control', action: 'finish_rehearsal', programIndex: 0, elapsedMs: 123456 }));
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'timer_rehearsal_saved') {
          clearTimeout(timer);
          socket.close();
          resolve(message);
        } else if (message.type === 'error') {
          clearTimeout(timer);
          socket.close();
          reject(new Error(JSON.stringify(message)));
        }
      };
    }), { token: CONTROL_TOKEN });
    assert.equal(saved.rehearsalDurationMs, 123456);

    const showPath = path.join(fixture.directory, 'show.json');
    const deadline = Date.now() + 5000;
    let persisted;
    while (Date.now() < deadline) {
      persisted = JSON.parse(fs.readFileSync(showPath, 'utf8'));
      if (persisted.programs[0].rehearsalDurationMs === 123456) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(persisted.programs[0].rehearsalDurationMs, 123456);
    await context.close();
  } catch (error) {
    if (fixture) error.message += `\nServer output:\n${fixture.output().slice(-3000)}`;
    throw error;
  } finally {
    if (browser) await browser.close();
    await stopIsolatedServer(fixture);
  }
});
