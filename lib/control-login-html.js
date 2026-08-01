'use strict';

/**
 * 构建控制端登录页面的完整 HTML 字串。
 *
 * 页面包含一个密码输入框和登录按钮，用户名为固定值 "admin"（不显示）。
 * 登录成功后跳转至 /?role=control&password=<密码>，失败时显示错误提示。
 *
 * 设计基准对标 QLab / CuePiot 等专业舞台控制软件，采用广播级极简风格，
 * 支持深色（默认）/浅色双主题，主题偏好保存于 localStorage("stage-portal-theme")。
 *
 * @returns {string} 自包含的 HTML 页面字串
 */
function buildControlLoginHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>舞台流程表 - 控制端登录</title>
  <style>
    /* ===== 主题变量 ===== */
    :root,
    :root[data-theme="dark"] {
      --bg: #1a1a1a;
      --card: #2d2d2d;
      --input-bg: #1f1f1f;
      --border: #3a3a3a;
      --text: #e1e1e1;
      --text-secondary: #999999;
      --accent: #ff7700;
      --accent-hover: #ff8c1a;
      --accent-ring: rgba(255, 119, 0, 0.16);
      --error: #e55555;
      --shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
    }

    :root[data-theme="light"] {
      --bg: #e8e8e8;
      --card: #ffffff;
      --input-bg: #f5f5f5;
      --border: #d0d0d0;
      --text: #1a1a1a;
      --text-secondary: #666666;
      --accent: #e06000;
      --accent-hover: #c45400;
      --accent-ring: rgba(224, 96, 0, 0.14);
      --error: #dc2626;
      --shadow: 0 10px 34px rgba(0, 0, 0, 0.12);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html,
    body {
      height: 100%;
    }

    body {
      font-family: -apple-system, "SF Pro Text", "PingFang SC",
                   "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      transition: background 0.25s ease, color 0.25s ease;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ===== 主题切换按钮（右上角） ===== */
    .theme-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 50%;
      color: var(--text-secondary);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.2s ease, border-color 0.2s ease,
                  background 0.2s ease, transform 0.1s ease;
      z-index: 10;
    }

    .theme-toggle:hover {
      color: var(--accent);
      border-color: var(--accent);
    }

    .theme-toggle:active {
      transform: scale(0.94);
    }

    .theme-toggle .icon-sun {
      display: block;
    }

    .theme-toggle .icon-moon {
      display: none;
    }

    :root[data-theme="light"] .theme-toggle .icon-sun {
      display: none;
    }

    :root[data-theme="light"] .theme-toggle .icon-moon {
      display: block;
    }

    /* ===== 登录卡片 ===== */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 44px 36px 36px;
      width: 100%;
      max-width: 380px;
      box-shadow: var(--shadow);
      animation: fadeIn 0.5s ease-out both;
    }

    .title {
      font-size: 22px;
      font-weight: 600;
      text-align: center;
      color: var(--text);
      letter-spacing: 2px;
    }

    .title-underline {
      width: 36px;
      height: 3px;
      background: var(--accent);
      border-radius: 2px;
      margin: 12px auto 14px;
    }

    .subtitle {
      font-size: 13px;
      color: var(--text-secondary);
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 32px;
    }

    .input-wrap {
      margin-bottom: 16px;
    }

    .input-wrap input {
      width: 100%;
      padding: 12px 14px;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease,
                  background 0.25s ease;
    }

    .input-wrap input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-ring);
    }

    .input-wrap input::placeholder {
      color: var(--text-secondary);
      opacity: 0.85;
    }

    .btn-login {
      width: 100%;
      padding: 12px;
      background: var(--accent);
      border: none;
      border-radius: 8px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 1px;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    .btn-login:hover {
      background: var(--accent-hover);
    }

    .btn-login:active {
      opacity: 0.9;
    }

    .btn-login:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error-msg {
      display: none;
      color: var(--error);
      font-size: 13px;
      text-align: center;
      margin-top: 16px;
    }

    .back-link {
      display: block;
      text-align: center;
      margin-top: 26px;
      font-size: 12px;
      color: var(--text-secondary);
      text-decoration: none;
      letter-spacing: 0.5px;
      transition: color 0.2s ease;
    }

    .back-link:hover {
      color: var(--accent);
    }
  </style>
</head>
<body>
  <button class="theme-toggle" type="button" aria-label="切换主题">
    <svg class="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
    <svg class="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>

  <div class="card">
    <h1 class="title">舞台流程表</h1>
    <div class="title-underline"></div>
    <p class="subtitle">控制端登录</p>
    <form id="loginForm">
      <div class="input-wrap">
        <input
          type="password"
          id="password"
          placeholder="请输入密码"
          autocomplete="current-password"
        />
      </div>
      <button type="submit" class="btn-login" id="loginBtn">登录</button>
    </form>
    <div class="error-msg" id="errorMsg"></div>
    <a class="back-link" id="backLink" href="#">返回入口页</a>
  </div>

  <script>
    (function () {
      var root = document.documentElement;

      // 读取主题偏好（默认深色）
      try {
        var stored = localStorage.getItem("stage-portal-theme");
        if (stored === "light" || stored === "dark") {
          root.setAttribute("data-theme", stored);
        }
      } catch (e) {}

      // 主题切换
      var toggleBtn = document.querySelector(".theme-toggle");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
          var current = root.getAttribute("data-theme");
          var next = current === "light" ? "dark" : "light";
          root.setAttribute("data-theme", next);
          try {
            localStorage.setItem("stage-portal-theme", next);
          } catch (e) {}
        });
      }

      var passwordInput = document.getElementById("password");
      var loginBtn = document.getElementById("loginBtn");
      var errorMsg = document.getElementById("errorMsg");
      var loginForm = document.getElementById("loginForm");
      var backLink = document.getElementById("backLink");

      // 设置返回入口链接（端口取自 localStorage "stage-entry-port"）
      if (backLink) {
        var host = window.location.hostname;
        var entryPort = 3000;
        try {
          var storedPort = localStorage.getItem("stage-entry-port");
          if (storedPort) entryPort = parseInt(storedPort) || 3000;
        } catch (e) {}
        backLink.href = "http://" + host + ":" + entryPort + "/";
      }

      // 页面加载后自动聚焦密码输入框
      passwordInput.focus();

      function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = "block";
      }

      function clearError() {
        errorMsg.style.display = "none";
        errorMsg.textContent = "";
      }

      function setLoading(loading) {
        loginBtn.disabled = loading;
        loginBtn.textContent = loading ? "登录中..." : "登录";
      }

      function handleLogin() {
        var password = passwordInput.value.trim();
        if (!password) {
          showError("请输入密码");
          return;
        }

        clearError();
        setLoading(true);

        var targetUrl =
          "/?role=control&password=" + encodeURIComponent(password);

        // 先通过 fetch 验证，捕获 401 后再决定跳转或显示错误
        fetch(targetUrl, { credentials: "same-origin" })
          .then(function (response) {
            if (response.ok) {
              window.location.href = targetUrl;
            } else if (response.status === 401) {
              showError("密码错误，请重新输入");
              setLoading(false);
              passwordInput.select();
            } else {
              showError("登录失败，请稍后重试");
              setLoading(false);
            }
          })
          .catch(function () {
            showError("网络错误，请检查连接");
            setLoading(false);
          });
      }

      // 表单提交（点击按钮或按 Enter 均触发）
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        handleLogin();
      });

      // 输入时清除错误提示
      passwordInput.addEventListener("input", function () {
        if (errorMsg.style.display === "block") {
          clearError();
        }
      });
    })();
  </script>
</body>
</html>`;
}

module.exports = buildControlLoginHtml;
module.exports.buildControlLoginHtml = buildControlLoginHtml;
