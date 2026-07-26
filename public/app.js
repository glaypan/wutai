// app.js - 舞台流程表前端逻辑（修复+增强版）
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${location.host}`);

let localState = { showName: "舞台流程表", mode: "setup", currentProgramIndex: 0, programs: [] };
let timerInfo = { remaining: 0, running: false, finished: false };
let editingIndex = null;
let addMics = []; // 添加节目弹窗的话筒临时数组

function sendMsg(obj) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

// ---------- 连接状态 ----------
const connStatus = document.getElementById('conn-status');
ws.onopen = () => {
  connStatus.classList.add('connected');
  connStatus.querySelector('.conn-text').textContent = "已连接";
  sendMsg({ type: "get_state" });
};
ws.onclose = () => {
  connStatus.classList.remove('connected');
  connStatus.querySelector('.conn-text').textContent = "断开，重连中...";
  setTimeout(() => location.reload(), 2500);
};
ws.onerror = () => { connStatus.querySelector('.conn-text').textContent = "连接异常"; };

ws.onmessage = (ev) => {
  const data = JSON.parse(ev.data);
  switch (data.type) {
    case "full_state":
      localState = data.state || localState;
      timerInfo = data.timer || timerInfo;
      if (data.clientCount !== undefined) updateClientCount(data.clientCount);
      renderAll();
      break;
    case "timer":
      timerInfo.remaining = data.remaining;
      timerInfo.running = data.running;
      timerInfo.finished = !!data.finished;
      renderTimer();
      document.getElementById('timer-finished').classList.toggle('hidden', !data.finished);
      break;
    case "client_count":
      updateClientCount(data.count);
      break;
  }
};

function updateClientCount(n) {
  const el = document.getElementById('client-count');
  if (el) el.textContent = n ? `👥 ${n} 个连接` : '';
}

// ---------- 模式切换 ----------
window.toggleMode = function () {
  const newMode = localState.mode === 'setup' ? 'performance' : 'setup';
  localState.mode = newMode;
  sendMsg({ type: "update_state", data: { mode: newMode } });
};

// ---------- 渲染 ----------
function renderAll() {
  document.getElementById('show-name-display').innerText = localState.showName || "舞台流程表";
  const toggleBtn = document.getElementById('mode-toggle-btn');
  if (localState.mode === 'setup') {
    toggleBtn.textContent = "⚙️ 设置模式";
    toggleBtn.classList.remove('performance');
  } else {
    toggleBtn.textContent = "🎬 演出模式";
    toggleBtn.classList.add('performance');
  }
  document.getElementById('setup-view').classList.toggle('hidden', localState.mode !== 'setup');
  document.getElementById('performance-view').classList.toggle('hidden', localState.mode !== 'performance');
  renderProgramList();
  renderStageView();
  renderTimer();
  if (editingIndex !== null) renderEditMicList();
}

function renderProgramList() {
  const wrap = document.getElementById('program-list');
  wrap.innerHTML = "";
  (localState.programs || []).forEach((prog, idx) => {
    const div = document.createElement('div');
    div.className = `program-item ${localState.currentProgramIndex === idx ? 'active' : ''} ${prog.completed ? 'completed' : ''}`;
    const activeMics = (prog.mics || []).filter(m => m.active).map(x => x.name).join(" / ");
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="prog-no">${idx + 1}</span>
          <strong>${escapeHtml(prog.name)}</strong>
        </div>
        <span>${prog.duration > 0 ? formatSec(prog.duration) : "无计时"}</span>
      </div>
      <div style="font-size:13px;color:#999;margin-top:4px;">${escapeHtml(prog.notes || "")}</div>
      ${activeMics ? `<div style="font-size:12px;color:#77aaff;margin-top:4px;">🎤 ${escapeHtml(activeMics)}</div>` : ""}
    `;
    div.onclick = () => {
      if (localState.mode === 'performance') sendMsg({ type: "set_current", index: idx });
      else openEditProgram(idx);
    };
    wrap.appendChild(div);
  });
}

function renderStageView() {
  const idx = localState.currentProgramIndex;
  const progs = localState.programs || [];
  const current = progs[idx];
  const next = progs[idx + 1];

  document.getElementById('current-name').innerText = current ? current.name : "—";
  document.getElementById('current-notes').innerText = current ? (current.notes || "") : "";
  document.getElementById('next-name').innerText = next ? next.name : "无";

  const totalEl = document.getElementById('current-total');
  if (totalEl) totalEl.innerText = current && current.duration > 0 ? `总时长 ${formatSec(current.duration)}` : "";

  const renderMics = (wrapId, mics) => {
    const w = document.getElementById(wrapId);
    w.innerHTML = "";
    (mics || []).filter(m => m.active).forEach(m => {
      const span = document.createElement('span');
      span.className = "mic-tag";
      span.textContent = m.name;
      w.appendChild(span);
    });
  };
  renderMics('current-mics', current && current.mics);
  renderMics('next-mics', next && next.mics);
}

function renderEditMicList() {
  const wrap = document.getElementById('mic-list');
  wrap.innerHTML = "";
  if (editingIndex === null) return;
  const prog = localState.programs[editingIndex];
  if (!prog || !prog.mics) return;
  prog.mics.forEach((mic, micIdx) => {
    const row = document.createElement('div');
    row.className = "mic-row";
    row.innerHTML = `
      <input class="mic-name-input" value="${escapeAttr(mic.name)}" data-micidx="${micIdx}">
      <button class="mic-toggle-btn ${mic.active ? 'active' : ''}" data-micidx="${micIdx}">${mic.active ? "启用" : "关闭"}</button>
      <button class="mic-del-btn" data-micidx="${micIdx}">删除</button>`;
    wrap.appendChild(row);
  });
  bindMicRowEvents(wrap, editingIndex, () => renderEditMicList(), true);
}

function renderAddMicList() {
  const wrap = document.getElementById('add-mic-list');
  if (!wrap) return;
  wrap.innerHTML = "";
  addMics.forEach((mic, micIdx) => {
    const row = document.createElement('div');
    row.className = "mic-row";
    row.innerHTML = `
      <input class="mic-name-input" value="${escapeAttr(mic.name)}" data-micidx="${micIdx}">
      <button class="mic-toggle-btn ${mic.active ? 'active' : ''}" data-micidx="${micIdx}">${mic.active ? "启用" : "关闭"}</button>
      <button class="mic-del-btn" data-micidx="${micIdx}">删除</button>`;
    wrap.appendChild(row);
  });
  bindMicRowEvents(wrap, null, () => renderAddMicList(), false, addMics);
}

// 通用话筒行事件绑定
function bindMicRowEvents(wrap, idx, rerender, editMode, arrIn) {
  wrap.querySelectorAll('.mic-toggle-btn').forEach(btn => {
    btn.onclick = function () {
      const m = Number(this.dataset.micidx);
      const arr = editMode ? localState.programs[idx].mics : arrIn;
      arr[m].active = !arr[m].active;
      rerender();
    };
  });
  wrap.querySelectorAll('.mic-name-input').forEach(input => {
    input.oninput = function () {
      const m = Number(this.dataset.micidx);
      const arr = editMode ? localState.programs[idx].mics : arrIn;
      arr[m].name = this.value;
    };
  });
  wrap.querySelectorAll('.mic-del-btn').forEach(btn => {
    btn.onclick = function () {
      const m = Number(this.dataset.micidx);
      const arr = editMode ? localState.programs[idx].mics : arrIn;
      arr.splice(m, 1);
      rerender();
    };
  });
}

function renderTimer() {
  const disp = document.getElementById('timer-display');
  if (!disp) return;
  disp.innerText = formatSec(timerInfo.remaining || 0);
  disp.classList.toggle('running', !!timerInfo.running && !timerInfo.finished);
  disp.classList.toggle('finished', !!timerInfo.finished);
}

function formatSec(s) {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ---------- 计时器控制 ----------
window.timerControl = function (action) {
  if (action === "start") {
    sendMsg({ type: "timer_start", duration: timerInfo.remaining > 0 ? timerInfo.remaining : 300 });
  } else if (action === "stop") {
    sendMsg({ type: "timer_stop" });
  } else if (action === "reset") {
    sendMsg({ type: "timer_reset" });
  }
};

// 标记完成并进入下一节目
window.advanceProgram = function () {
  const arr = [...(localState.programs || [])];
  const idx = localState.currentProgramIndex;
  if (idx >= 0 && idx < arr.length) arr[idx] = { ...arr[idx], completed: true };
  const nextIdx = Math.min(idx + 1, Math.max(0, arr.length - 1));
  sendMsg({ type: "update_state", data: { programs: arr } });
  sendMsg({ type: "set_current", index: nextIdx });
};

// ---------- 弹窗 ----------
window.closeModal = function (id) { document.getElementById(id).classList.add('hidden'); };

window.openAddProgram = function () {
  addMics = [{ name: "话筒1", active: true }];
  document.getElementById('add-name').value = "";
  document.getElementById('add-duration').value = 0;
  document.getElementById('add-notes').value = "";
  renderAddMicList();
  document.getElementById('modal-add').classList.remove('hidden');
};

window.saveShowName = function () {
  const val = document.getElementById('input-show-name').value.trim();
  if (val) sendMsg({ type: "update_state", data: { showName: val } });
  closeModal('modal-show-name');
};

window.showQR = function () {
  const url = location.href;
  const container = document.getElementById('qr-container');
  container.innerHTML = '';
  document.getElementById('qr-url').textContent = url;
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, { text: url, width: 200, height: 200, colorDark: '#000000', colorLight: '#ffffff' });
  } else {
    container.innerHTML = `<p style="color:#999">二维码库未加载，请访问：<br>${escapeHtml(url)}</p>`;
  }
  document.getElementById('modal-qr').classList.remove('hidden');
};

// 编辑演出名称按钮绑定
document.getElementById('edit-show-name-btn')?.addEventListener('click', () => {
  document.getElementById('input-show-name').value = localState.showName || "";
  document.getElementById('modal-show-name').classList.remove('hidden');
});

// ---------- 节目编辑 ----------
window.openEditProgram = function (idx) {
  editingIndex = idx;
  const p = localState.programs[idx];
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-duration').value = p.duration || 0;
  document.getElementById('edit-notes').value = p.notes || "";
  document.getElementById('setup-placeholder').classList.add('hidden');
  document.getElementById('edit-panel').classList.remove('hidden');
  renderEditMicList();
};

window.closeEditPanel = function () {
  editingIndex = null;
  document.getElementById('edit-panel').classList.add('hidden');
  document.getElementById('setup-placeholder').classList.remove('hidden');
};

window.saveProgram = function () {
  const name = document.getElementById('edit-name').value.trim();
  const duration = Number(document.getElementById('edit-duration').value) || 0;
  const notes = document.getElementById('edit-notes').value.trim();
  if (!name) return alert("节目名称不能为空");
  const arr = [...localState.programs];
  const mics = localState.programs[editingIndex].mics || [];
  arr[editingIndex] = { name, duration, notes, completed: localState.programs[editingIndex].completed || false, mics };
  sendMsg({ type: "update_state", data: { programs: arr } });
  closeEditPanel();
};

window.deleteProgram = function () {
  if (!confirm("确定删除这个节目？")) return;
  const arr = [...localState.programs];
  arr.splice(editingIndex, 1);
  let newIdx = localState.currentProgramIndex;
  if (editingIndex < newIdx) newIdx--;
  if (newIdx < 0) newIdx = 0;
  if (newIdx > arr.length - 1) newIdx = Math.max(0, arr.length - 1);
  sendMsg({ type: "update_state", data: { programs: arr, currentProgramIndex: newIdx } });
  closeEditPanel();
};

// 添加话筒（默认 active:true）
window.addMicRow = function (target) {
  if (target === 'add') {
    addMics.push({ name: "话筒", active: true });
    renderAddMicList();
  } else {
    if (editingIndex === null) return;
    const prog = localState.programs[editingIndex];
    prog.mics = prog.mics || [];
    prog.mics.push({ name: "话筒", active: true });
    renderEditMicList();
  }
};

window.confirmAddProgram = function () {
  const name = document.getElementById('add-name').value.trim();
  const dur = Number(document.getElementById('add-duration').value) || 0;
  const notes = document.getElementById('add-notes').value.trim();
  if (!name) return alert("节目名称不能为空");
  const newProg = {
    name, duration: dur, notes, completed: false,
    mics: addMics.length ? addMics.map(m => ({ ...m })) : [{ name: "话筒1", active: true }]
  };
  const arr = [...(localState.programs || []), newProg];
  sendMsg({ type: "update_state", data: { programs: arr } });
  closeModal('modal-add');
};

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
