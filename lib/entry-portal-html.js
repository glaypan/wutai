'use strict';

/**
 * 生成舞台流程表总控入口页面的 HTML。
 *
 * 设计基准对标 QLab / CuePilot 等专业舞台控制软件：
 * 暗色优先、锐利边框、单声道端口字体、橙色强调色、
 * 5 张角色卡片（控制端 / 导演端 / 助理端 / 幕后端 / 提示屏）。
 *
 * @param {Object} config - 配置端口 { entryPort, port, clientPort, screenPort }
 * @param {Object} passwordStatus - 各角色是否需要密码
 *   { control, director, assistant, backstage, screen }
 * @param {Object} ports - 实际运行时端口 { entryPort, port, clientPort, screenPort }
 * @returns {string} 完整的 HTML 字符串
 */
function buildEntryPortalHtml(config, passwordStatus, ports) {
  var controlPort = ports.port;
  var clientPort = ports.clientPort;
  var screenPort = ports.screenPort;
  var entryPort = ports.entryPort;

  // 各角色专业线性 SVG 图标（非 emoji）
  var ICONS = {
    control:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="6" y1="4" x2="6" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/>' +
      '<rect x="3.5" y="8" width="5" height="3" rx="0.5"/><rect x="9.5" y="13" width="5" height="3" rx="0.5"/><rect x="15.5" y="6" width="5" height="3" rx="0.5"/></svg>',
    director:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="8" width="19" height="12.5" rx="1"/>' +
      '<path d="M2.5 8l1.2-3 3 1.2M6 8l1.2-3 3 1.2M9.5 8l1.2-3 3 1.2M13 8l1.2-3 3 1.2M16.5 8l1.2-3 3 1.2"/>' +
      '<line x1="2.5" y1="8" x2="21.5" y2="8"/></svg>',
    assistant:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 4H6a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3"/>' +
      '<rect x="9" y="2.5" width="6" height="3.5" rx="1"/>' +
      '<path d="M8.5 11.5l1.2 1.2 2.3-2.4"/><path d="M8.5 16.5l1.2 1.2 2.3-2.4"/>' +
      '<line x1="14" y1="12" x2="17" y2="12"/><line x1="14" y1="17" x2="17" y2="17"/></svg>',
    backstage:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/>' +
      '<rect x="2.8" y="13" width="3.6" height="6" rx="1"/><rect x="17.6" y="13" width="3.6" height="6" rx="1"/>' +
      '<path d="M20 18v1a3 3 0 0 1-3 3h-3"/></svg>',
    screen:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="2.5" y="3.5" width="19" height="13" rx="1.5"/>' +
      '<line x1="8" y1="20.5" x2="16" y2="20.5"/><line x1="12" y1="16.5" x2="12" y2="20.5"/></svg>'
  };

  // 主题切换图标
  var SUN_ICON =
    '<svg class="icon icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/>' +
    '<line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/>' +
    '<line x1="4.9" y1="4.9" x2="6.7" y2="6.7"/><line x1="17.3" y1="17.3" x2="19.1" y2="19.1"/>' +
    '<line x1="4.9" y1="19.1" x2="6.7" y2="17.3"/><line x1="17.3" y1="6.7" x2="19.1" y2="4.9"/></svg>';
  var MOON_ICON =
    '<svg class="icon icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  // 按钮箭头
  var ARROW_ICON =
    '<svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  // 五个入口卡片配置
  var cards = [
    {
      icon: ICONS.control,
      title: '控制端',
      sub: 'CONTROL',
      desc: '舞台流程总控制台，管理全部流程节点与设备调度',
      role: 'control',
      port: controlPort,
      path: '/?role=control',
      needsPassword: true,
      placeholder: '默认: admin'
    },
    {
      icon: ICONS.director,
      title: '导演端',
      sub: 'DIRECTOR',
      desc: '导演工作台，掌控流程推进与 cue 点触发',
      role: 'director',
      port: clientPort,
      path: '/?role=director',
      needsPassword: !!passwordStatus.director,
      placeholder: '请输入密码'
    },
    {
      icon: ICONS.assistant,
      title: '助理端',
      sub: 'ASSISTANT',
      desc: '舞台助理工作台，协助流程管理与状态跟踪',
      role: 'assistant',
      port: clientPort,
      path: '/?role=assistant',
      needsPassword: !!passwordStatus.assistant,
      placeholder: '请输入密码'
    },
    {
      icon: ICONS.backstage,
      title: '幕后端',
      sub: 'BACKSTAGE',
      desc: '幕后工作人员视图，实时查看当前流程状态',
      role: 'backstage',
      port: clientPort,
      path: '/?role=backstage',
      needsPassword: !!passwordStatus.backstage,
      placeholder: '请输入密码'
    },
    {
      icon: ICONS.screen,
      title: '提示屏',
      sub: 'SCREEN',
      desc: '舞台提示屏，全屏显示当前流程与提示信息',
      role: 'screen',
      port: screenPort,
      path: '/',
      needsPassword: false,
      placeholder: ''
    }
  ];

  function renderCard(card) {
    var passwordHtml = '';
    if (card.needsPassword) {
      passwordHtml =
        '        <div class="card-password">\n' +
        '          <input type="password" class="password-input" placeholder="' + card.placeholder + '" autocomplete="off">\n' +
        '        </div>\n';
    }
    var statusClass = card.needsPassword ? 'status-dot--locked' : 'status-dot--open';
    var statusTitle = card.needsPassword ? '需要密码' : '开放访问';
    return (
      '      <article class="card" data-role="' + card.role + '" data-port="' + card.port +
      '" data-path="' + card.path + '" data-needs-password="' + card.needsPassword + '">\n' +
      '        <div class="card-head">\n' +
      '          <div class="card-icon">' + card.icon + '</div>\n' +
      '          <div class="card-titles">\n' +
      '            <h2 class="card-title">' + card.title + ' <span class="status-dot ' + statusClass + '" title="' + statusTitle + '"></span></h2>\n' +
      '            <span class="card-sub">' + card.sub + '</span>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '        <p class="card-desc">' + card.desc + '</p>\n' +
      passwordHtml +
      '        <button class="card-btn" type="button">\n' +
      '          <span>进入</span>' + ARROW_ICON + '\n' +
      '        </button>\n' +
      '      </article>'
    );
  }

  var cardsHtml = cards.map(renderCard).join('\n');

  var html = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#1a1a1a">
  <title>舞台流程表 - 总控入口</title>
  <script>
    (function () {
      try {
        var t = localStorage.getItem("stage-portal-theme");
        document.documentElement.setAttribute("data-theme", (t === "light" || t === "dark") ? t : "dark");
      } catch (e) {
        document.documentElement.setAttribute("data-theme", "dark");
      }
    })();
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    /* ===== 主题变量 ===== */
    :root, :root[data-theme="dark"] {
      --bg: #1a1a1a;
      --card: #2d2d2d;
      --raised: #383838;
      --border: #3a3a3a;
      --text: #e1e1e1;
      --text-2: #999999;
      --text-3: #666666;
      --accent: #ff7700;
      --accent-strong: #ff8c1a;
      --accent-soft: rgba(255, 119, 0, 0.10);
      --accent-border: rgba(255, 119, 0, 0.45);
      --status-green: #4caf50;
      --status-red: #e55555;
      --status-yellow: #ffd54f;
      --field-bg: #232323;
      --field-border: #3a3a3a;
      --btn-text: #1a1a1a;
    }

    :root[data-theme="light"] {
      --bg: #e8e8e8;
      --card: #ffffff;
      --raised: #f0f0f0;
      --border: #d0d0d0;
      --text: #1a1a1a;
      --text-2: #555555;
      --text-3: #8a8a8a;
      --accent: #e06000;
      --accent-strong: #f07010;
      --accent-soft: rgba(224, 96, 0, 0.10);
      --accent-border: rgba(224, 96, 0, 0.50);
      --status-green: #2e7d32;
      --status-red: #c62828;
      --status-yellow: #b8860b;
      --field-bg: #f4f4f4;
      --field-border: #d0d0d0;
      --btn-text: #ffffff;
    }

    html, body { height: 100%; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .container {
      max-width: 1180px;
      margin: 0 auto;
      padding: 48px 24px 32px;
      width: 100%;
    }

    /* ===== Header ===== */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 36px;
    }
    .header-brand { min-width: 0; }
    .main-title {
      font-size: 1.9rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: var(--text);
      line-height: 1.2;
    }
    .title-underline {
      width: 52px;
      height: 3px;
      background: var(--accent);
      margin: 10px 0 12px;
      border-radius: 2px;
    }
    .subtitle {
      font-size: 0.92rem;
      color: var(--text-2);
      letter-spacing: 0.3px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .version-badge {
      font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace;
      font-size: 0.72rem;
      color: var(--text-3);
      border: 1px solid var(--border);
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--card);
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .theme-toggle {
      width: 38px;
      height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text-2);
      cursor: pointer;
      transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
    }
    .theme-toggle:hover { border-color: var(--accent); color: var(--accent); }
    .theme-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .theme-toggle .icon { width: 18px; height: 18px; display: block; }
    :root[data-theme="dark"] .theme-toggle .icon-sun { display: block; }
    :root[data-theme="dark"] .theme-toggle .icon-moon { display: none; }
    :root[data-theme="light"] .theme-toggle .icon-sun { display: none; }
    :root[data-theme="light"] .theme-toggle .icon-moon { display: block; }

    /* ===== Grid ===== */
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 36px;
    }
    @media (min-width: 560px) { .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 820px) { .grid { grid-template-columns: repeat(3, 1fr); } }
    @media (min-width: 1040px) { .grid { grid-template-columns: repeat(5, 1fr); } }

    /* ===== Card ===== */
    .card {
      position: relative;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 20px 18px 18px;
      display: flex;
      flex-direction: column;
      transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
    }
    .card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
    }
    .card-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }
    .card-icon {
      flex-shrink: 0;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--raised);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--accent);
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .card:hover .card-icon {
      background: var(--accent-soft);
      border-color: var(--accent-border);
    }
    .card-icon svg { width: 22px; height: 22px; display: block; }
    .card-titles { min-width: 0; }
    .card-title {
      font-size: 1.02rem;
      font-weight: 600;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 7px;
      line-height: 1.3;
    }
    .card-sub {
      font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace;
      font-size: 0.68rem;
      color: var(--text-3);
      letter-spacing: 1px;
    }
    .status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .status-dot--locked {
      background: var(--status-yellow);
      box-shadow: 0 0 0 2px rgba(255, 213, 79, 0.16);
    }
    .status-dot--open {
      background: var(--status-green);
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.16);
    }

    .card-desc {
      font-size: 0.82rem;
      color: var(--text-2);
      line-height: 1.55;
      margin-bottom: 16px;
      flex-grow: 1;
    }

    .card-password { margin-bottom: 14px; }
    .password-input {
      width: 100%;
      padding: 9px 12px;
      background: var(--field-bg);
      border: 1px solid var(--field-border);
      border-radius: 5px;
      color: var(--text);
      font-size: 0.86rem;
      font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace;
      outline: none;
      transition: border-color 0.2s ease, background 0.2s ease;
    }
    .password-input:focus { border-color: var(--accent); background: var(--raised); }
    .password-input::placeholder { color: var(--text-3); }

    .card-btn {
      margin-top: auto;
      width: 100%;
      padding: 10px 16px;
      background: var(--accent);
      color: var(--btn-text);
      border: 1px solid var(--accent);
      border-radius: 5px;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .card-btn:hover { background: var(--accent-strong); border-color: var(--accent-strong); }
    .card-btn:active { transform: translateY(1px); }
    .card-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .card-btn .btn-arrow {
      width: 15px;
      height: 15px;
      transition: transform 0.2s ease;
    }
    .card-btn:hover .btn-arrow { transform: translateX(2px); }

    /* ===== Footer ===== */
    .footer {
      border-top: 1px solid var(--border);
      padding-top: 20px;
    }
    .ports {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 12px;
    }
    .port {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 6px 12px;
    }
    .port-label {
      font-size: 0.72rem;
      color: var(--text-3);
      letter-spacing: 0.3px;
    }
    .port-num {
      font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--accent);
    }
    .footer-host {
      font-size: 0.78rem;
      color: var(--text-3);
    }
    .footer-host span {
      color: var(--text-2);
      font-family: "SF Mono", "JetBrains Mono", "Roboto Mono", "Menlo", monospace;
    }

    /* ===== Responsive ===== */
    @media (max-width: 640px) {
      .container { padding: 32px 16px 24px; }
      .header { flex-direction: column; align-items: flex-start; }
      .main-title { font-size: 1.6rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-brand">
        <h1 class="main-title">舞台流程表</h1>
        <div class="title-underline"></div>
        <p class="subtitle">总控入口 · 请选择要进入的工作端</p>
      </div>
      <div class="header-actions">
        <span class="version-badge">v6.0.6beta-design</span>
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="切换主题" title="切换主题">
          ${SUN_ICON}
          ${MOON_ICON}
        </button>
      </div>
    </header>
    <main class="grid">
${cardsHtml}
    </main>
    <footer class="footer">
      <div class="ports">
        <div class="port"><span class="port-label">入口端口</span><span class="port-num">${entryPort}</span></div>
        <div class="port"><span class="port-label">控制端口</span><span class="port-num">${controlPort}</span></div>
        <div class="port"><span class="port-label">客户端端口</span><span class="port-num">${clientPort}</span></div>
        <div class="port"><span class="port-label">提示屏端口</span><span class="port-num">${screenPort}</span></div>
      </div>
      <p class="footer-host">服务器地址：<span id="server-host"></span></p>
    </footer>
  </div>
  <script>
    (function() {
      var host = window.location.hostname;
      document.getElementById("server-host").textContent = host;

      // 保存入口端口到 localStorage 供其他页面使用
      try { localStorage.setItem("stage-entry-port", String(${entryPort})); } catch(e) {}

      function navigateFromCard(card) {
        var port = card.getAttribute("data-port");
        var path = card.getAttribute("data-path");
        var needsPassword = card.getAttribute("data-needs-password") === "true";
        var url = "http://" + host + ":" + port + path;
        if (needsPassword) {
          var input = card.querySelector(".password-input");
          var password = input ? input.value : "";
          url += "&password=" + encodeURIComponent(password);
        }
        window.location.href = url;
      }

      var buttons = document.querySelectorAll(".card-btn");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener("click", function() {
          navigateFromCard(this.closest(".card"));
        });
      }

      var inputs = document.querySelectorAll(".password-input");
      for (var j = 0; j < inputs.length; j++) {
        inputs[j].addEventListener("keypress", function(e) {
          if (e.key === "Enter" || e.keyCode === 13) {
            e.preventDefault();
            navigateFromCard(this.closest(".card"));
          }
        });
      }

      // 主题切换
      var toggle = document.getElementById("theme-toggle");
      if (toggle) {
        toggle.addEventListener("click", function() {
          var root = document.documentElement;
          var current = root.getAttribute("data-theme") || "dark";
          var next = current === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          try { localStorage.setItem("stage-portal-theme", next); } catch(e) {}
        });
      }
    })();
  </script>
</body>
</html>`;

  return html;
}

module.exports = buildEntryPortalHtml;
