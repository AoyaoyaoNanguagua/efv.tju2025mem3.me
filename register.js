(function () {
  "use strict";

  const SESSION_KEY = "efv-session-token";
  const SAVE_KEY = "efv-play-profile-v2";

  const CHARACTERS = [
    {
      id: "lina",
      name: "莉娜",
      color: "#d98ad7",
      portrait: "assets/portraits/lina.png"
    },
    {
      id: "ayu",
      name: "阿宇",
      color: "#d99a4a",
      portrait: "assets/portraits/ayu.png"
    }
  ];

  let selectedCharacterId = "lina";
  const $ = selector => document.querySelector(selector);

  function getCharacter(id) {
    return CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
  }

  function setHint(message) {
    $("#registerHint").textContent = message;
  }

  async function apiRequest(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok) throw new Error(data.error || "服务器暂时不可用");
    return data;
  }

  function renderCharacterOptions() {
    const wrap = $("#characterOptions");
    wrap.innerHTML = CHARACTERS.map(character => `
      <button class="character-option" type="button" data-character="${character.id}" style="--character:${character.color}">
        <img src="${character.portrait}" alt="${character.name}">
        <b>${character.name}</b>
      </button>
    `).join("");

    wrap.addEventListener("click", event => {
      const button = event.target.closest("[data-character]");
      if (!button) return;
      selectedCharacterId = button.dataset.character;
      updateCharacterOptions();
    });
    updateCharacterOptions();
  }

  function updateCharacterOptions() {
    document.querySelectorAll(".character-option").forEach(button => {
      button.classList.toggle("active", button.dataset.character === selectedCharacterId);
    });
    document.documentElement.style.setProperty("--character", getCharacter(selectedCharacterId).color);
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
        const data = await apiRequest("/api/register", {
          username,
          nickname,
          password,
          characterId: selectedCharacterId
        });
        localStorage.setItem(SESSION_KEY, data.token);
        localStorage.setItem(SAVE_KEY, JSON.stringify(data.profile));
        setHint("注册成功，正在进入校园...");
        window.location.href = "play.html?autostart=1";
      } catch (error) {
        button.disabled = false;
        setHint(error.message || "注册失败，请稍后再试。");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderCharacterOptions();
    bindRegisterForm();
  });
})();
