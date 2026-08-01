'use strict';

/**
 * 构建控制端登录页面的完整 HTML 字串。
 *
 * 页面包含一个密码输入框和登录按钮，用户名为固定值 "admin"（不显示）。
 * 登录成功后跳转至 /?role=control&password=<密码>，失败时显示错误提示。
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
    }

    body {
      background: #0f0f1e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   "PingFang SC", "Microsoft YaHei", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .card {
      background: #1a1a2e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 40px 32px 32px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
      animation: fadeIn 0.6s ease-out both;
    }

    .card h1 {
      font-size: 20px;
      font-weight: 600;
      text-align: center;
      color: #ffffff;
      margin-bottom: 6px;
    }

    .card .subtitle {
      font-size: 13px;
      color: #8888aa;
      text-align: center;
      margin-bottom: 32px;
      letter-spacing: 1px;
    }

    .input-wrap {
      margin-bottom: 18px;
    }

    .input-wrap input {
      width: 100%;
      padding: 12px 16px;
      background: #0f0f1e;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #ffffff;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .input-wrap input:focus {
      border-color: #e94560;
    }

    .input-wrap input::placeholder {
      color: #555577;
    }

    .btn-login {
      width: 100%;
      padding: 12px;
      background: #e94560;
      border: none;
      border-radius: 8px;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease, opacity 0.2s ease;
      user-select: none;
    }

    .btn-login:hover {
      background: #d63851;
    }

    .btn-login:active {
      opacity: 0.88;
    }

    .btn-login:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error-msg {
      display: none;
      color: #e94560;
      font-size: 13px;
      text-align: center;
      margin-top: 16px;
      opacity: 0.9;
    }

    .back-hint {
      text-align: center;
      margin-top: 28px;
      font-size: 12px;
      color: #555577;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>舞台流程表</h1>
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
    <div class="back-hint" id="back-hint">返回入口页</div>
  </div>
  <script>
    (function () {
      var passwordInput = document.getElementById("password");
      var loginBtn = document.getElementById("loginBtn");
      var errorMsg = document.getElementById("errorMsg");
      var loginForm = document.getElementById("loginForm");
      var backHint = document.getElementById("back-hint");

      // 设置返回入口链接
      if (backHint) {
        var host = window.location.hostname;
        var entryPort = 3000;
        try {
          var stored = localStorage.getItem("stage-entry-port");
          if (stored) entryPort = parseInt(stored) || 3000;
        } catch (e) {}
        backHint.innerHTML = '<a href="http://' + host + ':' + entryPort + '/" style="color:#555577;text-decoration:none;">返回入口页</a>';
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
