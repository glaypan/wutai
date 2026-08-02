'use strict';

/**
 * 生成舞台流程表总控入口页面的 HTML。
 *
 * @param {Object} config - 配置端口 { entryPort, port, clientPort, screenPort }
 * @param {Object} passwordStatus - 各角色是否需要密码
 *   { control, director, assistant, backstage, console, screen }
 * @param {Object} ports - 实际运行时端口 { entryPort, port, clientPort, screenPort, subtitlePort, subtitleEnabled }
 * @returns {string} 完整的 HTML 字符串
 */
function buildEntryPortalHtml(config, passwordStatus, ports) {
  var controlPort = ports.port;
  var clientPort = ports.clientPort;
  var screenPort = ports.screenPort;
  var entryPort = ports.entryPort;
  var subtitlePort = ports.subtitlePort || 0;
  var subtitleEnabled = ports.subtitleEnabled || false;

  // 入口卡片配置（含控台端；字幕屏按需显示）
  var cards = [
    {
      icon: '🎛️',
      title: '控制端',
      desc: '舞台流程总控制台，管理全部流程节点与设备调度',
      role: 'control',
      port: controlPort,
      path: '/?role=control',
      needsPassword: true,
      placeholder: '默认: admin'
    },
    {
      icon: '🎬',
      title: '导演端',
      desc: '导演工作台，掌控流程推进与 cue 点触发',
      role: 'director',
      port: clientPort,
      path: '/?role=director',
      needsPassword: !!passwordStatus.director,
      placeholder: '请输入密码'
    },
    {
      icon: '📋',
      title: '助理端',
      desc: '舞台助理工作台，协助流程管理与状态跟踪',
      role: 'assistant',
      port: clientPort,
      path: '/?role=assistant',
      needsPassword: !!passwordStatus.assistant,
      placeholder: '请输入密码'
    },
    {
      icon: '🎭',
      title: '幕后端',
      desc: '幕后工作人员视图，实时查看当前流程状态',
      role: 'backstage',
      port: clientPort,
      path: '/?role=backstage',
      needsPassword: !!passwordStatus.backstage,
      placeholder: '请输入密码'
    },
    {
      icon: '🎚️',
      title: '控台端',
      desc: '控台视角，与助理权限相同',
      role: 'console',
      port: clientPort,
      path: '/?role=console',
      needsPassword: !!passwordStatus.console,
      placeholder: '请输入密码'
    },
    {
      icon: '🖥️',
      title: '提示屏',
      desc: '舞台提示屏，全屏显示当前流程与提示信息',
      role: 'screen',
      port: screenPort,
      path: '/',
      needsPassword: false,
      placeholder: ''
    }
  ];

  // 字幕屏卡片仅在启用且端口有效时显示
  if (subtitleEnabled && subtitlePort > 0) {
    cards.push({
      icon: '💬',
      title: '字幕屏',
      desc: '独立字幕显示屏，全屏显示字幕内容',
      role: 'subtitle',
      port: subtitlePort,
      path: '/',
      needsPassword: false,
      placeholder: ''
    });
  }

  function renderCard(card) {
    var passwordHtml = '';
    if (card.needsPassword) {
      passwordHtml =
        '        <div class="card-password">\n' +
        '          <input type="password" class="password-input" placeholder="' + card.placeholder + '">\n' +
        '        </div>\n';
    }
    return (
      '      <div class="card" data-role="' + card.role + '" data-port="' + card.port +
      '" data-path="' + card.path + '" data-needs-password="' + card.needsPassword + '">\n' +
      '        <div class="card-icon">' + card.icon + '</div>\n' +
      '        <h2 class="card-title">' + card.title + '</h2>\n' +
      '        <p class="card-desc">' + card.desc + '</p>\n' +
      passwordHtml +
      '        <button class="card-btn" type="button">进入</button>\n' +
      '      </div>'
    );
  }

  var cardsHtml = cards.map(renderCard).join('\n');

  var html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>舞台流程表 - 总控入口</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background-color: #1a1a2e;
      color: #e0e0e0;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .main-title {
      font-size: 2.2rem;
      color: #e94560;
      margin-bottom: 10px;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .subtitle {
      font-size: 1rem;
      color: #a0a0b0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px;
      margin-bottom: 40px;
    }
    .card {
      background-color: #16213e;
      border: 1px solid #0f3460;
      border-radius: 12px;
      padding: 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    }
    .card:hover {
      transform: translateY(-6px);
      box-shadow: 0 12px 30px rgba(233, 69, 96, 0.15);
      border-color: #e94560;
    }
    .card-icon {
      font-size: 2.8rem;
      margin-bottom: 16px;
    }
    .card-title {
      font-size: 1.3rem;
      color: #ffffff;
      margin-bottom: 10px;
    }
    .card-desc {
      font-size: 0.9rem;
      color: #a0a0b0;
      line-height: 1.5;
      margin-bottom: 20px;
      min-height: 54px;
    }
    .card-password {
      width: 100%;
      margin-bottom: 20px;
    }
    .password-input {
      width: 100%;
      padding: 10px 14px;
      background-color: #1a1a2e;
      border: 1px solid #0f3460;
      border-radius: 8px;
      color: #ffffff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.25s ease;
    }
    .password-input:focus { border-color: #e94560; }
    .password-input::placeholder { color: #606080; }
    .card-btn {
      width: 100%;
      padding: 12px 20px;
      background-color: #0f3460;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.25s ease, transform 0.15s ease;
      margin-top: auto;
    }
    .card-btn:hover { background-color: #e94560; }
    .card-btn:active { transform: scale(0.97); }
    .footer {
      text-align: center;
      padding: 24px 0;
      color: #606080;
      font-size: 0.85rem;
      border-top: 1px solid #0f3460;
    }
    .footer p { margin: 4px 0; }
    .footer .server-host { color: #a0a0b0; }
    @media (max-width: 600px) {
      .container { padding: 24px 16px; }
      .main-title { font-size: 1.6rem; }
      .grid { grid-template-columns: 1fr; gap: 16px; }
      .card { padding: 20px 16px; }
      .card-icon { font-size: 2.2rem; margin-bottom: 10px; }
      .card-title { font-size: 1.1rem; }
      .card-desc { font-size: 0.85rem; min-height: 40px; }
      .footer { font-size: 0.75rem; }
      .footer p { word-break: break-all; }
    }
    @media (max-width: 400px) {
      .main-title { font-size: 1.3rem; }
      .card { padding: 16px 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="main-title">舞台流程表 - 总控入口</h1>
      <p class="subtitle">请选择要进入的工作端</p>
    </header>
    <main class="grid">
${cardsHtml}
    </main>
    <footer class="footer">
      <p>服务器地址：<span class="server-host" id="server-host"></span></p>
      <p>入口端口: ${entryPort} ｜ 控制端口: ${controlPort} ｜ 客户端端口: ${clientPort} ｜ 提示屏端口: ${screenPort}${subtitleEnabled ? ' ｜ 字幕屏端口: ' + subtitlePort : ''}</p>
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
        var role = card.getAttribute("data-role");
        var input = card.querySelector(".password-input");
        var form = document.createElement("form");
        form.method = "POST";
        form.action = "http://" + host + ":" + port + "/api/auth/login";
        var roleField = document.createElement("input");
        roleField.type = "hidden";
        roleField.name = "role";
        roleField.value = role;
        form.appendChild(roleField);
        if (input) {
          var passwordField = document.createElement("input");
          passwordField.type = "hidden";
          passwordField.name = "password";
          passwordField.value = input.value;
          form.appendChild(passwordField);
        }
        document.body.appendChild(form);
        form.submit();
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
    })();
  </script>
</body>
</html>`;

  return html;
}

module.exports = buildEntryPortalHtml;
