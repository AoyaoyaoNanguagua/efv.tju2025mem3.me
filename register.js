(function () {
  "use strict";

  const $ = selector => document.querySelector(selector);

  function setHint(message) {
    $("#registerHint").textContent = message;
  }

  async function apiRequest(path, body) {
    let response;
    try {
      response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error("服务器暂时不可用");
    }
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) throw new Error(data.error || "服务器暂时不可用");
    return data;
  }

  function bindRegisterForm() {
    $("#registerForm").addEventListener("submit", async event => {
      event.preventDefault();
      const username = $("#registerAccountInput").value.trim();
      const nickname = $("#registerNicknameInput").value.trim();
      const password = $("#registerPasswordInput").value;
      const confirm = $("#registerConfirmInput").value;
      const button = $("#registerButton");

      if (!/^[A-Za-z0-9_-]{3,18}$/.test(username)) {
        setHint("账号请使用 3-18 位字母、数字、下划线或短横线。");
        return;
      }
      if (nickname.length < 1 || nickname.length > 12) {
        setHint("昵称请控制在 1-12 个字。");
        return;
      }
      if (password.length < 6) {
        setHint("密码至少需要 6 位。");
        return;
      }
      if (password !== confirm) {
        setHint("两次输入的密码不一致。");
        return;
      }

      button.disabled = true;
      setHint("正在创建账号...");
      try {
        await apiRequest("/api/register", { username, nickname, password });
        setHint("注册成功，正在返回登录...");
        window.setTimeout(() => {
          window.location.href = "play.html";
        }, 1200);
      } catch (error) {
        button.disabled = false;
        setHint(error.message || "注册失败，请稍后再试。");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", bindRegisterForm);
})();
