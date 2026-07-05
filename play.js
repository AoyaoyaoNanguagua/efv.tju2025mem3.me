(function () {
  "use strict";

  const COLS = 8;
  const ROWS = 8;
  const FRAME_SIZE = 147;
  const ANIMATION_SPEED_FACTOR = 0.68;
  const MAP_TILE_SIZE = 64;
  const PROJECTILE_FRAME_SIZE = 362;
  const PROJECTILE_MAX_RANGE = MAP_TILE_SIZE * 6;
  const PROJECTILE_SPEED_SCALE = 0.72;
  const PROJECTILE_HEAD_ORIGIN = { x: 228 / PROJECTILE_FRAME_SIZE, y: 201 / PROJECTILE_FRAME_SIZE };
  const CAST_SOCKET_FORWARD_OFFSET = 0;

  const MAP_TILESET_KEY = "play-zhonghe-plaza-tileset";
  const MAP_TILEMAP_KEY = "play-zhonghe-plaza-tilemap";
  const MAP_DATA_KEY = "play-zhonghe-map-data";
  const MAP_PROP_ATLAS_KEY = "play-zhonghe-plaza-props";
  const MAP_MACRO_PROP_ATLAS_KEY = "play-zhonghe-plaza-macro-props";
  const MAP_TILESET_PATH = "assets/maps/tilesets/zhonghe-plaza-ground-tileset-v1.png";
  const MAP_PROP_ATLAS_PATH = "assets/maps/props/zhonghe-plaza-props-atlas-v1.png";
  const MAP_MACRO_PROP_ATLAS_PATH = "assets/maps/props/zhonghe-plaza-macro-props-v1.png";
  const MAP_DATA_PATH = "assets/maps/playable/zhonghe-plaza-tilemap-playtest-v1.json";

  const PROJECTILE_ATLAS = "assets/effects/lina-projectiles-atlas-v1.png";
  const PROJECTILE_TEXTURE_KEY = "play-lina-projectiles";
  const LEAF_SLIME_SHEET = "assets/enemies/leaf-poring-sprites-v2.png";
  const LEAF_SLIME_KEY = "play-leaf-slime";
  const LEAF_SLIME_FRAME_SIZE = 128;
  const LEAF_SLIME_COLS = 6;
  const LEAF_SLIME_DETECT_RANGE = MAP_TILE_SIZE * 6;
  const LEAF_SLIME_ATTACK_RANGE = 64;
  const LEAF_SLIME_ATTACK_COOLDOWN = 1250;
  const LEAF_SLIME_HOP_DISTANCE = 72;
  const LEAF_SLIME_HOP_DURATION = 420;
  const LEAF_SLIME_HOP_REST = 260;
  const LEAF_SLIME_ATTACK_DISTANCE = 116;
  const LEAF_SLIME_ATTACK_DURATION = 280;
  const LEAF_SLIME_VANISH_TIME = 520;
  const LEAF_SLIME_HIT_OFFSET_Y = -62;
  const LEAF_SLIME_HIT_RADIUS = 52;

  const BOSS_KEY = "play-ai-professor-boss";
  const BOSS_IMAGE = "assets/enemies/autumn-ruin-portrait-v1.png";
  const SAVE_KEY = "efv-play-profile-v2";
  const SESSION_KEY = "efv-session-token";

  const LINA_STAFF_CAST_SOCKETS = [
    { x: 117, y: 64 },
    { x: 99, y: 46 },
    { x: 110, y: 58 },
    { x: 108, y: 51 }
  ];
  const LINA_DEFAULT_STAFF_SOCKET = LINA_STAFF_CAST_SOCKETS[1];

  const ALL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
  const FOUR_FRAMES = [0, 1, 2, 3];
  const SIX_FRAMES = [0, 1, 2, 3, 4, 5];

  const ACTIONS = [
    { id: "idle", row: 0, fps: 7, repeat: -1, frames: FOUR_FRAMES },
    { id: "walk", row: 1, fps: 12, repeat: -1, frames: SIX_FRAMES },
    { id: "attack", row: 2, fps: 18, repeat: 0, frames: FOUR_FRAMES },
    { id: "hit", row: 3, fps: 11, repeat: 0, frames: FOUR_FRAMES },
    { id: "death", row: 4, fps: 9, repeat: 0, frames: SIX_FRAMES },
    { id: "transform", row: 5, fps: 20, repeat: 0, frames: ALL_FRAMES },
    { id: "catRun", row: 6, fps: 16, repeat: -1, frames: FOUR_FRAMES },
    { id: "catJump", row: 7, fps: 16, repeat: 0, frames: SIX_FRAMES }
  ];

  const DIRECTIONS = [
    { id: "E", x: 1, y: 0, angle: 0 },
    { id: "SE", x: 1, y: 1, angle: 45 },
    { id: "S", x: 0, y: 1, angle: 90 },
    { id: "SW", x: -1, y: 1, angle: 135 },
    { id: "W", x: -1, y: 0, angle: 180 },
    { id: "NW", x: -1, y: -1, angle: 225 },
    { id: "N", x: 0, y: -1, angle: 270 },
    { id: "NE", x: 1, y: -1, angle: 315 }
  ];

  const CHARACTERS = [
    {
      id: "lina",
      name: "莉娜",
      color: "#d98ad7",
      portrait: "assets/portraits/lina.png",
      sprite: "assets/sprites/lina-sprites-v10-anchored-expanded.png",
      baseline: 140,
      speed: 245
    },
    {
      id: "ayu",
      name: "阿宇",
      color: "#d99a4a",
      portrait: "assets/portraits/ayu.png",
      sprite: "assets/sprites/ayu-sprites-v10-imagegen-anchored-clean.png",
      baseline: 140,
      speed: 270
    }
  ];

  const EQUIPMENT = [
    {
      id: "amethyst-staff",
      name: "紫晶治疗杖",
      color: 0xd98ad7,
      css: "#d98ad7",
      attackTexture: "play-lina-attack-amethyst",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-amethyst.png",
      projectileFrame: 0,
      impactFrame: 3,
      projectileOrigin: { x: 228 / PROJECTILE_FRAME_SIZE, y: 201 / PROJECTILE_FRAME_SIZE },
      projectileScale: 0.15,
      speed: 620,
      size: 13,
      range: 900,
      cooldown: 310
    },
    {
      id: "sakura-staff",
      name: "樱花短杖",
      color: 0xf07aa3,
      css: "#f07aa3",
      attackTexture: "play-lina-attack-sakura",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-sakura.png",
      projectileFrame: 4,
      impactFrame: 7,
      projectileOrigin: { x: 237 / PROJECTILE_FRAME_SIZE, y: 178 / PROJECTILE_FRAME_SIZE },
      projectileScale: 0.15,
      speed: 540,
      size: 16,
      range: 820,
      cooldown: 360
    },
    {
      id: "thesis-staff",
      name: "开题星杖",
      color: 0x54b5c8,
      css: "#54b5c8",
      attackTexture: "play-lina-attack-thesis",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-thesis.png",
      projectileFrame: 8,
      impactFrame: 11,
      projectileOrigin: { x: 227 / PROJECTILE_FRAME_SIZE, y: 163 / PROJECTILE_FRAME_SIZE },
      projectileScale: 0.15,
      speed: 760,
      size: 10,
      range: 980,
      cooldown: 240
    }
  ];

  const BASE_STATS = {
    level: 1,
    exp: 0,
    credits: 0,
    maxHp: 160,
    hp: 160
  };

  const BOSS = {
    id: "boss_ai_prof",
    name: "AI 陆教授考核镜像",
    maxHp: 420,
    hp: 420,
    active: false,
    x: 0,
    y: 0,
    damage: 10,
    touchRange: 170,
    attackCooldown: 1500,
    rewardCredits: 8,
    rewardExp: 80
  };

  const app = {
    profile: null,
    authToken: localStorage.getItem(SESSION_KEY) || "",
    game: null,
    scene: null,
    multiplayer: null,
    audio: null,
    selectedCharacterId: "lina",
    boss: { ...BOSS },
    bossRewardClaimed: false,
    lastHealAt: -Infinity,
    connected: false
  };

  const $ = selector => document.querySelector(selector);
  let serverSaveTimer = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeVector(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function nearestDirection(x, y) {
    if (!x && !y) return DIRECTIONS[2];
    const angle = (Phaser.Math.RadToDeg(Math.atan2(y, x)) + 360) % 360;
    const snapped = Math.round(angle / 45) * 45 % 360;
    return DIRECTIONS.find(dir => dir.angle === snapped) || DIRECTIONS[2];
  }

  function directionVector(direction) {
    return normalizeVector(direction.x, direction.y);
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(profile));
    if (!app.authToken) return;
    window.clearTimeout(serverSaveTimer);
    serverSaveTimer = window.setTimeout(() => {
      apiRequest("/api/save", {
        method: "POST",
        body: { profile }
      }).catch(() => {
        renderNetwork("存档待同步", false);
      });
    }, 450);
  }

  function setSession(token) {
    app.authToken = token || "";
    if (app.authToken) localStorage.setItem(SESSION_KEY, app.authToken);
    else localStorage.removeItem(SESSION_KEY);
  }

  function normalizeProfile(profile = {}) {
    const characterId = getCharacter(profile.characterId).id;
    return {
      id: String(profile.id || makeId()),
      account: String(profile.account || profile.username || ""),
      name: String(profile.name || profile.nickname || "同济学术喵").trim().slice(0, 12) || "同济学术喵",
      characterId,
      level: Math.max(1, Number(profile.level || BASE_STATS.level)),
      exp: Math.max(0, Number(profile.exp || BASE_STATS.exp)),
      credits: Math.max(0, Number(profile.credits || BASE_STATS.credits)),
      maxHp: Math.max(1, Number(profile.maxHp || BASE_STATS.maxHp)),
      hp: clamp(Number(profile.hp ?? profile.maxHp ?? BASE_STATS.hp), 0, Math.max(1, Number(profile.maxHp || BASE_STATS.maxHp)))
    };
  }

  async function apiRequest(path, options = {}) {
    const headers = {
      "content-type": "application/json",
      ...(options.headers || {})
    };
    if (app.authToken) headers.authorization = `Bearer ${app.authToken}`;
    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
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

  async function loginWithPassword(username, password) {
    const data = await apiRequest("/api/login", {
      method: "POST",
      body: { username, password }
    });
    setSession(data.token);
    return normalizeProfile(data.profile);
  }

  async function loadSessionProfile() {
    const data = await apiRequest("/api/me");
    return normalizeProfile(data.profile);
  }

  function getCharacter(id) {
    return CHARACTERS.find(character => character.id === id) || CHARACTERS[0];
  }

  function getAction(id) {
    return ACTIONS.find(action => action.id === id) || ACTIONS[0];
  }

  function createProfile(formData = {}) {
    const previous = loadProfile();
    const characterId = formData.characterId || app.selectedCharacterId || previous?.characterId || "lina";
    return {
      id: previous?.id || makeId(),
      name: String(formData.name || previous?.name || "同济学术喵").trim().slice(0, 12) || "同济学术喵",
      characterId,
      ...BASE_STATS,
      ...(previous?.characterId === characterId ? {
        level: previous.level || BASE_STATS.level,
        exp: previous.exp || BASE_STATS.exp,
        credits: previous.credits || BASE_STATS.credits,
        maxHp: previous.maxHp || BASE_STATS.maxHp,
        hp: previous.hp || BASE_STATS.hp
      } : {})
    };
  }

  function renderCharacterOptions() {
    const wrap = $("#characterOptions");
    if (!wrap) return;
    wrap.innerHTML = CHARACTERS.map(character => `
      <button class="character-option" type="button" data-character="${character.id}" style="--character:${character.color}">
        <img src="${character.portrait}" alt="${character.name}">
        <b>${character.name}</b>
      </button>
    `).join("");
    wrap.addEventListener("click", event => {
      const button = event.target.closest("[data-character]");
      if (!button) return;
      app.audio?.start("login");
      app.selectedCharacterId = button.dataset.character;
      updateCharacterOptions();
    });
    updateCharacterOptions();
  }

  function updateCharacterOptions() {
    document.querySelectorAll(".character-option").forEach(button => {
      button.classList.toggle("active", button.dataset.character === app.selectedCharacterId);
    });
    document.documentElement.style.setProperty("--character", getCharacter(app.selectedCharacterId).color);
  }

  function renderHud() {
    if (!app.profile) return;
    $("#hudName").textContent = app.profile.name;
    $("#levelText").textContent = `Lv.${app.profile.level}`;
    $("#creditText").textContent = `学分 ${app.profile.credits}`;
    $("#expText").textContent = `EXP ${app.profile.exp}`;
    const hpRatio = clamp(app.profile.hp / app.profile.maxHp, 0, 1);
    $("#hpBar").style.width = `${Math.round(hpRatio * 100)}%`;
    $("#hpText").textContent = `${Math.max(0, Math.ceil(app.profile.hp))} / ${app.profile.maxHp}`;
    saveProfile(app.profile);
  }

  function renderNetwork(status, online = false) {
    const node = $("#networkStatus");
    node.textContent = status;
    node.classList.toggle("online", online);
    node.classList.toggle("offline", !online);
  }

  function renderPeers(peers) {
    const list = $("#peerList");
    const values = Array.from(peers.values());
    list.innerHTML = values.length
      ? values.map(peer => `<div class="peer"><span>${peer.name}</span><b>${getCharacter(peer.characterId).name}</b></div>`).join("")
      : `<div class="peer"><span>等待同学加入同一房间</span><b>0 online</b></div>`;
  }

  function renderBossHud() {
    const panel = $("#bossPanel");
    panel.classList.toggle("open", !!app.boss.active);
    panel.setAttribute("aria-hidden", String(!app.boss.active));
    const ratio = clamp(app.boss.hp / app.boss.maxHp, 0, 1);
    $("#bossHpBar").style.width = `${Math.round(ratio * 100)}%`;
    $("#bossHpText").textContent = `${Math.max(0, Math.ceil(app.boss.hp))} / ${app.boss.maxHp}`;
  }

  let toastTimer = null;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function getDefaultWsUrl() {
    if (location.protocol === "file:") return "ws://127.0.0.1:8787/ws";
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  class AudioEngine {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.timer = null;
      this.mode = "login";
      this.step = 0;
      this.loginNotes = [392, 493.88, 587.33, 659.25, 587.33, 493.88, 440, 493.88];
      this.gameNotes = [261.63, 329.63, 392, 523.25, 493.88, 392, 349.23, 392];
    }

    unlock() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.ctx) this.ctx = new AudioContextClass();
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    start(mode = this.mode) {
      this.mode = mode;
      this.unlock();
      if (!this.enabled || !this.ctx) return;
      if (!this.timer) {
        this.timer = window.setInterval(() => this.playPulse(), this.mode === "login" ? 620 : 500);
      }
      this.playPulse();
    }

    stop() {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    switchMode(mode) {
      if (this.mode === mode && this.timer) return;
      this.stop();
      this.step = 0;
      this.start(mode);
    }

    toggle() {
      this.enabled = !this.enabled;
      $("#musicToggle").textContent = this.enabled ? "音乐 开" : "音乐 关";
      if (this.enabled) this.start(this.mode);
      else this.stop();
    }

    tone(freq, duration = 0.2, type = "sine", gain = 0.055) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.025);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playPulse() {
      const notes = this.mode === "login" ? this.loginNotes : this.gameNotes;
      const note = notes[this.step % notes.length];
      this.step += 1;
      this.tone(note, 0.34, "triangle", this.mode === "login" ? 0.045 : 0.038);
      this.tone(note / 2, 0.48, "sine", this.mode === "login" ? 0.028 : 0.024);
      if (this.mode === "game" && this.step % 4 === 0) this.tone(note * 1.5, 0.18, "sine", 0.018);
    }

    cast() { this.tone(740, 0.12, "triangle", 0.07); }
    hit() { this.tone(160, 0.13, "sawtooth", 0.05); }
    boss() { this.tone(98, 0.42, "sawtooth", 0.055); }
    heal() {
      this.tone(523.25, 0.18, "sine", 0.06);
      window.setTimeout(() => this.tone(659.25, 0.18, "sine", 0.045), 80);
    }
  }

  class MultiplayerClient {
    constructor() {
      this.ws = null;
      this.peers = new Map();
      this.url = "";
    }

    connect() {
      this.close();
      this.url = getDefaultWsUrl();
      renderNetwork("连接中", false);
      try {
        this.ws = new WebSocket(this.url);
      } catch {
        renderNetwork("同步不可用", false);
        return;
      }
      this.ws.addEventListener("open", () => {
        app.connected = true;
        renderNetwork("多人在线", true);
        this.send({
          type: "join",
          room: "zhonghe-plaza",
          token: app.authToken,
          player: this.currentPlayerState()
        });
        showToast("已连接多人同步服务");
      });
      this.ws.addEventListener("message", event => this.handleMessage(event.data));
      this.ws.addEventListener("close", () => {
        app.connected = false;
        renderNetwork("离线模式", false);
      });
      this.ws.addEventListener("error", () => {
        app.connected = false;
        renderNetwork("同步失败", false);
      });
    }

    close() {
      if (this.ws) this.ws.close();
      this.ws = null;
      this.peers.clear();
      renderPeers(this.peers);
    }

    send(payload) {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify(payload));
    }

    currentPlayerState() {
      const actor = app.scene?.actor;
      return {
        id: app.profile.id,
        name: app.profile.name,
        characterId: app.profile.characterId,
        x: actor?.x || 3200,
        y: actor?.y || 3200,
        flipX: !!actor?.flipX,
        action: app.scene?.networkAction || "idle",
        hp: app.profile.hp,
        maxHp: app.profile.maxHp
      };
    }

    sendState() {
      this.send({ type: "update", player: this.currentPlayerState() });
    }

    sendBossStart(boss) {
      this.send({ type: "bossStart", boss });
    }

    sendBossHit(damage) {
      this.send({ type: "bossHit", damage });
    }

    handleMessage(raw) {
      let message = null;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.type === "queue") {
        app.connected = false;
        renderNetwork("排队中", false);
        showToast(message.text || "当前在线人数已满，请稍后再试。");
        return;
      }
      if (message.type === "authError") {
        app.connected = false;
        setSession("");
        renderNetwork("需要登录", false);
        showToast(message.text || "登录已过期，请重新登录。");
        return;
      }
      if (message.type === "welcome") {
        this.peers.clear();
        (message.peers || []).forEach(peer => {
          if (peer.id !== app.profile.id) this.peers.set(peer.id, peer);
        });
        if (message.boss) syncBossState(message.boss);
        renderPeers(this.peers);
        app.scene?.syncAllPeers(this.peers);
      }
      if (message.type === "peerJoined" || message.type === "peerUpdated") {
        const peer = message.player;
        if (!peer || peer.id === app.profile.id) return;
        this.peers.set(peer.id, peer);
        renderPeers(this.peers);
        app.scene?.syncPeer(peer);
      }
      if (message.type === "peerLeft") {
        this.peers.delete(message.id);
        renderPeers(this.peers);
        app.scene?.removePeer(message.id);
      }
      if (message.type === "bossState" && message.boss) {
        syncBossState(message.boss);
      }
      if (message.type === "notice" && message.text) showToast(message.text);
    }
  }

  function syncBossState(boss) {
    const wasActive = app.boss.active;
    app.boss = { ...app.boss, ...boss };
    renderBossHud();
    app.scene?.syncBoss();
    if (wasActive && !app.boss.active && app.boss.hp <= 0) claimBossReward();
  }

  class PlayScene extends Phaser.Scene {
    constructor() {
      super("Play");
      this.lastNetworkSendAt = 0;
      this.lastBossHitAt = 0;
      this.lastShotAt = 0;
      this.remotePlayers = new Map();
    }

    preload() {
      this.load.image(MAP_TILESET_KEY, MAP_TILESET_PATH);
      this.load.image(MAP_PROP_ATLAS_KEY, MAP_PROP_ATLAS_PATH);
      this.load.image(MAP_MACRO_PROP_ATLAS_KEY, MAP_MACRO_PROP_ATLAS_PATH);
      this.load.tilemapTiledJSON(MAP_TILEMAP_KEY, MAP_DATA_PATH);
      this.load.json(MAP_DATA_KEY, MAP_DATA_PATH);
      this.load.spritesheet(PROJECTILE_TEXTURE_KEY, PROJECTILE_ATLAS, {
        frameWidth: PROJECTILE_FRAME_SIZE,
        frameHeight: PROJECTILE_FRAME_SIZE
      });
      this.load.spritesheet(LEAF_SLIME_KEY, LEAF_SLIME_SHEET, {
        frameWidth: LEAF_SLIME_FRAME_SIZE,
        frameHeight: LEAF_SLIME_FRAME_SIZE
      });
      this.load.image(BOSS_KEY, BOSS_IMAGE);
      EQUIPMENT.forEach(item => {
        this.load.spritesheet(item.attackTexture, item.attackSheet, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE
        });
      });
      CHARACTERS.forEach(character => {
        this.load.spritesheet(character.id, character.sprite, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE
        });
        this.load.image(`${character.id}-portrait`, character.portrait);
      });
    }

    create() {
      app.scene = this;
      this.cameras.main.roundPixels = true;
      this.mapData = this.cache.json.get(MAP_DATA_KEY) || {};
      this.remotePlayers = new Map();
      this.selectedEquipment = EQUIPMENT[0];
      this.facing = DIRECTIONS[2];
      this.lastAimVector = directionVector(this.facing);
      this.isCasting = false;
      this.isDead = false;
      this.isCat = false;
      this.isActionLocked = false;
      this.networkAction = "idle";
      this.actorHitToken = 0;
      this.isShowingCatIdleFrame = false;

      this.renderTileMap();
      this.prepareMapPropFrames();
      this.renderMapProps();
      this.obstacleGroup = this.physics.add.staticGroup();
      this.drawObstacles();
      this.prepareCharacterAnimations();
      this.prepareProjectileAnimations();
      this.prepareLeafSlimeAnimations();
      this.ensureProjectileHitboxTexture();

      this.projectiles = this.physics.add.group({ allowGravity: false });
      this.leafSlimes = this.physics.add.group({ allowGravity: false });
      this.projectileGraphics = this.add.graphics().setDepth(40);
      this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,J,H,L,U,I,SPACE");

      this.createActor();
      this.createBoss();
      this.spawnLeafSlime();

      this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
      this.physics.add.collider(this.actor, this.obstacleGroup);
      this.physics.add.collider(this.leafSlimes, this.obstacleGroup);
      this.physics.add.collider(this.projectiles, this.obstacleGroup, projectile => this.destroyProjectile(projectile, true));
      this.physics.add.overlap(this.projectiles, this.leafSlimes, (projectile, enemy) => this.handleLeafSlimeProjectileHit(projectile, enemy));
      this.bindActorLeafSlimeCollision();

      this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
      this.cameras.main.startFollow(this.actor, true, 0.12, 0.12);
      this.cameras.main.centerOn(this.actor.x, this.actor.y);
      this.input.keyboard.on("keydown", event => this.handleHotkey(event));
      this.input.on("pointerdown", pointer => {
        if (pointer.leftButtonDown()) this.triggerPrimaryAction();
      });

      app.multiplayer.connect();
      renderHud();
      renderBossHud();
      showToast("WASD 移动，J 攻击，L 人形/猫形切换，H 护盾恢复");
    }

    renderTileMap() {
      const tileMap = this.make.tilemap({ key: MAP_TILEMAP_KEY });
      const tilesetName = this.mapData?.tilesets?.[0]?.name || "zhonghe-plaza-ground-tileset-v1";
      const tileset = tileMap.addTilesetImage(tilesetName, MAP_TILESET_KEY, MAP_TILE_SIZE, MAP_TILE_SIZE);
      this.tileMap = tileMap;
      this.mapLayers = [];
      tileMap.layers.forEach((layerData, index) => {
        const layer = tileMap.createLayer(layerData.name, tileset, 0, 0);
        if (!layer) return;
        layer.setDepth(index);
        layer.setCullPadding(4, 4);
        this.mapLayers.push(layer);
      });
      this.worldWidth = tileMap.widthInPixels || 6400;
      this.worldHeight = tileMap.heightInPixels || 6400;
    }

    prepareMapPropFrames() {
      [
        { key: MAP_PROP_ATLAS_KEY, frames: this.mapData?.propFrames || {} },
        { key: MAP_MACRO_PROP_ATLAS_KEY, frames: this.mapData?.macroPropFrames || {} }
      ].forEach(({ key, frames }) => {
        const texture = this.textures.get(key);
        if (!texture) return;
        Object.entries(frames).forEach(([name, frame]) => {
          if (!texture.has(name)) texture.add(name, 0, frame.x, frame.y, frame.w, frame.h);
        });
      });
    }

    getMapPropAtlasKey(item) {
      return item.atlas === "macro" ? MAP_MACRO_PROP_ATLAS_KEY : MAP_PROP_ATLAS_KEY;
    }

    renderMapProps() {
      this.mapProps = [];
      (this.mapData?.props || []).forEach(item => {
        const frame = item.frame;
        const atlasKey = this.getMapPropAtlasKey(item);
        if (!frame || !this.textures.get(atlasKey)?.has(frame)) return;
        const origin = item.origin || {};
        const prop = this.add.image(item.x, item.y, atlasKey, frame)
          .setOrigin(origin.x ?? 0.5, origin.y ?? 1)
          .setScale(item.scale ?? 1)
          .setDepth(item.y + (item.depthOffset || 0));
        this.mapProps.push(prop);
      });
    }

    drawObstacles() {
      (this.mapData.obstacles || []).forEach(item => {
        const zone = this.add.zone(item.x + item.w / 2, item.y + item.h / 2, item.w, item.h);
        this.physics.add.existing(zone, true);
        this.obstacleGroup.add(zone);
      });
    }

    makeActionFrames(textureKey, action) {
      return action.frames.map(column => ({ key: textureKey, frame: action.row * COLS + column }));
    }

    prepareCharacterAnimations() {
      CHARACTERS.forEach(character => {
        const texture = this.textures.get(character.id);
        texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
        ACTIONS.forEach(action => {
          const key = `${character.id}-${action.id}`;
          if (!this.anims.exists(key)) {
            this.anims.create({
              key,
              frames: this.makeActionFrames(character.id, action),
              frameRate: Math.max(1, action.fps * ANIMATION_SPEED_FACTOR),
              repeat: action.repeat
            });
          }
          const onceKey = `${character.id}-${action.id}-once`;
          if (!this.anims.exists(onceKey)) {
            this.anims.create({
              key: onceKey,
              frames: this.makeActionFrames(character.id, action),
              frameRate: Math.max(1, action.fps * ANIMATION_SPEED_FACTOR),
              repeat: 0
            });
          }
        });
      });

      const attackAction = getAction("attack");
      EQUIPMENT.forEach(item => {
        const texture = this.textures.get(item.attackTexture);
        texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
        const key = `lina-${item.id}-attack-once`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: this.makeActionFrames(item.attackTexture, attackAction),
            frameRate: Math.max(1, attackAction.fps * ANIMATION_SPEED_FACTOR),
            repeat: 0
          });
        }
      });
    }

    getProjectileAnimationKey(equipment, phase) {
      return `${equipment.id}-${phase}`;
    }

    prepareProjectileAnimations() {
      const texture = this.textures.get(PROJECTILE_TEXTURE_KEY);
      texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      EQUIPMENT.forEach(equipment => {
        const flightKey = this.getProjectileAnimationKey(equipment, "flight");
        if (!this.anims.exists(flightKey)) {
          this.anims.create({
            key: flightKey,
            frames: this.anims.generateFrameNumbers(PROJECTILE_TEXTURE_KEY, {
              frames: [equipment.projectileFrame, equipment.projectileFrame + 1]
            }),
            frameRate: 12,
            repeat: -1,
            yoyo: true
          });
        }
        const impactKey = this.getProjectileAnimationKey(equipment, "impact");
        if (!this.anims.exists(impactKey)) {
          this.anims.create({
            key: impactKey,
            frames: this.anims.generateFrameNumbers(PROJECTILE_TEXTURE_KEY, {
              frames: [equipment.projectileFrame + 2, equipment.impactFrame]
            }),
            frameRate: 18,
            repeat: 0
          });
        }
      });
    }

    getLeafSlimeFrames(row) {
      return Array.from({ length: LEAF_SLIME_COLS }, (_, index) => row * LEAF_SLIME_COLS + index);
    }

    prepareLeafSlimeAnimations() {
      const texture = this.textures.get(LEAF_SLIME_KEY);
      texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      [
        { key: "move", row: 0, frameRate: 12, repeat: 0 },
        { key: "attack", row: 1, frameRate: 13, repeat: 0 },
        { key: "hit", row: 2, frameRate: 15, repeat: 0 },
        { key: "dead", row: 3, frameRate: 9, repeat: 0 }
      ].forEach(config => {
        const key = `${LEAF_SLIME_KEY}-${config.key}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(LEAF_SLIME_KEY, { frames: this.getLeafSlimeFrames(config.row) }),
          frameRate: config.frameRate,
          repeat: config.repeat
        });
      });
    }

    ensureProjectileHitboxTexture() {
      if (this.textures.exists("play-projectile-hitbox")) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(16, 16, 16);
      g.generateTexture("play-projectile-hitbox", 32, 32);
      g.destroy();
    }

    createActor() {
      const spawn = this.mapData.spawn || { x: this.worldWidth / 2, y: this.worldHeight / 2 };
      const character = getCharacter(app.profile.characterId);
      this.actor = this.physics.add.sprite(spawn.x, spawn.y, character.id, 0)
        .setOrigin(0.5, character.baseline / FRAME_SIZE)
        .setScale(1)
        .setDepth(spawn.y + 8);
      this.actor.body.setSize(34, 42);
      this.actor.body.setOffset(56, 92);
      this.actor.setCollideWorldBounds(true);
      this.actor.play(`${character.id}-idle`, true);
      this.actorShadow = this.add.ellipse(this.actor.x, this.actor.y + 3, 34, 11, 0x182313, 0.16)
        .setDepth(this.actor.y - 24);
    }

    createBoss() {
      this.bossSprite = this.physics.add.image(0, 0, BOSS_KEY)
        .setOrigin(0.5, 0.72)
        .setScale(0.34)
        .setVisible(false)
        .setActive(false)
        .setDepth(0);
      this.bossSprite.body.setAllowGravity(false);
      this.bossSprite.body.setImmovable(true);
    }

    syncBoss() {
      if (!this.bossSprite) return;
      if (!app.boss.active || app.boss.hp <= 0) {
        this.bossSprite.setVisible(false).setActive(false);
        return;
      }
      this.bossSprite
        .setPosition(app.boss.x, app.boss.y)
        .setVisible(true)
        .setActive(true)
        .setDepth(app.boss.y + 18);
    }

    startBoss() {
      const x = clamp(this.actor.x + 420, 420, this.worldWidth - 420);
      const y = clamp(this.actor.y - 70, 640, this.worldHeight - 420);
      const boss = { ...BOSS, active: true, hp: BOSS.maxHp, x, y };
      app.bossRewardClaimed = false;
      if (app.connected) app.multiplayer.sendBossStart(boss);
      syncBossState(boss);
      app.audio.boss();
      showToast("AI 陆教授考核镜像已出现");
    }

    spawnLeafSlime() {
      if (!this.actor || !this.leafSlimes) return null;
      const count = this.leafSlimes.countActive(true);
      const offsets = [
        { x: 190, y: 18 },
        { x: -170, y: 42 },
        { x: 120, y: -150 },
        { x: -120, y: -142 }
      ];
      const offset = offsets[count % offsets.length];
      const x = clamp(this.actor.x + offset.x, 900, this.worldWidth - 160);
      const y = clamp(this.actor.y + offset.y, 900, this.worldHeight - 220);
      const slime = this.leafSlimes.create(x, y, LEAF_SLIME_KEY, 0)
        .setOrigin(0.5, 0.72)
        .setScale(0.9)
        .setDepth(y + 6);
      slime.body.setSize(54, 34);
      slime.body.setOffset(37, 70);
      slime.body.setAllowGravity(false);
      slime.body.setCollideWorldBounds(true);
      slime.state = "move";
      slime.nextHopAt = 0;
      slime.lastAttackAt = -LEAF_SLIME_ATTACK_COOLDOWN;
      slime.actionToken = 0;
      slime.play(`${LEAF_SLIME_KEY}-move`);
      slime.shadow = this.add.ellipse(slime.x, slime.y + 12, 58, 18, 0x182313, 0.18)
        .setDepth(slime.y - 24);
      return slime;
    }

    bindActorLeafSlimeCollision() {
      if (!this.actor || !this.leafSlimes) return;
      this.actorLeafSlimeCollider?.destroy?.();
      this.actorLeafSlimeCollider = this.physics.add.collider(this.actor, this.leafSlimes);
    }

    playLoop(actionId) {
      if (!this.actor || this.isCasting || this.isDead || this.isActionLocked) return;
      const character = getCharacter(app.profile.characterId);
      if (this.isCat && actionId === "idle") {
        this.actor.anims.stop();
        this.actor.setTexture(character.id);
        this.actor.setFrame(getAction("transform").row * COLS + 7);
        this.isShowingCatIdleFrame = true;
        this.networkAction = "transform";
        return;
      }
      const loopId = this.isCat && actionId === "walk" ? "catRun" : actionId;
      const key = `${character.id}-${loopId}`;
      if (this.isShowingCatIdleFrame || this.actor.anims?.currentAnim?.key !== key) {
        this.isShowingCatIdleFrame = false;
        this.actor.play(key, true);
      }
      this.networkAction = loopId;
    }

    returnToBaseLoop() {
      if (!this.isDead) this.playLoop("idle");
    }

    triggerPrimaryAction() {
      if (this.isCat) this.playCatJump();
      else this.castProjectile();
    }

    playCatJump() {
      if (!this.actor || this.isDead || this.isActionLocked) return;
      const character = getCharacter(app.profile.characterId);
      this.isCat = true;
      this.isActionLocked = true;
      this.networkAction = "catJump";
      this.actor.setTexture(character.id);
      this.actor.play(`${character.id}-catJump-once`, true);
      const vec = this.lastAimVector || directionVector(this.facing);
      this.actor.body.setVelocity(vec.x * 360, vec.y * 360);
      this.actor.once("animationcomplete", () => {
        this.actor.body.setVelocity(0, 0);
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    toggleTransformState() {
      if (!this.actor || this.isDead || this.isActionLocked) return;
      const character = getCharacter(app.profile.characterId);
      this.isActionLocked = true;
      this.isCasting = false;
      this.networkAction = "transform";
      this.actor.setTexture(character.id);
      if (this.isCat && this.actor.anims?.playReverse) this.actor.anims.playReverse(`${character.id}-transform-once`, true);
      else this.actor.play(`${character.id}-transform-once`, true);
      this.actor.once("animationcomplete", () => {
        this.isCat = !this.isCat;
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    getAttackAnimationKey() {
      if (app.profile.characterId === "lina") return `lina-${this.selectedEquipment.id}-attack-once`;
      return `${app.profile.characterId}-attack-once`;
    }

    castProjectile() {
      if (!this.actor || app.profile.hp <= 0 || this.isCat) {
        if (this.isCat) this.playCatJump();
        return;
      }
      const now = this.time.now;
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      if (now - this.lastShotAt < equipment.cooldown) return;
      this.lastShotAt = now;
      const character = getCharacter(app.profile.characterId);
      this.isCasting = true;
      this.networkAction = "attack";
      this.actor.play(this.getAttackAnimationKey(), true);
      this.time.delayedCall(95, () => this.fireProjectile());
      this.actor.once("animationcomplete", () => {
        this.isCasting = false;
        this.actor.setTexture(character.id);
        if (!this.isDead) this.playLoop("idle");
      });
    }

    fireProjectile() {
      if (!this.actor || this.isDead) return;
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const direction = this.facing || DIRECTIONS[2];
      const vec = directionVector(direction);
      this.lastAimVector = vec;
      const castOrigin = this.getCastOrigin(vec);
      const projectileSpeed = equipment.speed * PROJECTILE_SPEED_SCALE;
      const projectile = this.projectiles.create(castOrigin.x, castOrigin.y, "play-projectile-hitbox");
      projectile.setVisible(false);
      projectile.body.setCircle(equipment.size, 16 - equipment.size, 16 - equipment.size);
      projectile.body.setAllowGravity(false);
      projectile.body.setVelocity(vec.x * projectileSpeed, vec.y * projectileSpeed);
      projectile.spawnTime = this.time.now;
      projectile.color = equipment.color;
      projectile.radius = equipment.size;
      projectile.spawnX = castOrigin.x;
      projectile.spawnY = castOrigin.y;
      projectile.maxDistance = Math.min(equipment.range || PROJECTILE_MAX_RANGE, PROJECTILE_MAX_RANGE);
      projectile.maxLifetime = Math.ceil((projectile.maxDistance / projectileSpeed) * 1000) + 180;
      projectile.impactFrame = equipment.impactFrame;
      projectile.visualScale = equipment.projectileScale || 0.15;
      projectile.depthOffset = vec.y < -0.12 ? -8 : 12;
      projectile.visualBaseDepth = this.actor.y + 18;
      projectile.visualRotation = Math.atan2(vec.y, vec.x);
      projectile.impactAnimationKey = this.getProjectileAnimationKey(equipment, "impact");
      projectile.damage = app.profile.characterId === "lina" ? 22 : 18;
      projectile.trail = [];
      const projectileOrigin = equipment.projectileOrigin || PROJECTILE_HEAD_ORIGIN;
      projectile.visual = this.add.sprite(castOrigin.x, castOrigin.y, PROJECTILE_TEXTURE_KEY, equipment.projectileFrame)
        .setOrigin(projectileOrigin.x, projectileOrigin.y)
        .setScale(projectile.visualScale)
        .setRotation(projectile.visualRotation)
        .setDepth(Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth));
      projectile.visual.play(this.getProjectileAnimationKey(equipment, "flight"));
      this.flashCast(castOrigin.x, castOrigin.y, equipment.color, projectile.visualBaseDepth + 1);
      app.audio.cast();
    }

    getCastOrigin(vec) {
      if (app.profile.characterId === "lina") return this.getLinaStaffCastOrigin(vec);
      return {
        x: this.actor.x + vec.x * 54,
        y: this.actor.y - 58 + vec.y * 54
      };
    }

    getLinaStaffCastOrigin(vec) {
      const activeFrameIndex = this.actor?.anims?.currentFrame
        ? ((((this.actor.anims.currentFrame.index || 1) - 1) % COLS) + COLS) % COLS
        : 1;
      const frameIndex = clamp(activeFrameIndex, 0, LINA_STAFF_CAST_SOCKETS.length - 1);
      const socket = LINA_STAFF_CAST_SOCKETS[frameIndex] || LINA_DEFAULT_STAFF_SOCKET;
      const character = getCharacter(app.profile.characterId);
      const originX = (this.actor.originX ?? 0.5) * FRAME_SIZE;
      const originY = (this.actor.originY ?? (character.baseline / FRAME_SIZE)) * FRAME_SIZE;
      const localX = (socket.x - originX) * (this.actor.flipX ? -1 : 1);
      const localY = socket.y - originY;
      const rotation = this.actor.rotation || 0;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      return {
        x: this.actor.x + localX * cos - localY * sin + vec.x * CAST_SOCKET_FORWARD_OFFSET,
        y: this.actor.y + localX * sin + localY * cos + vec.y * CAST_SOCKET_FORWARD_OFFSET
      };
    }

    flashCast(x, y, color, depth = 45) {
      const ring = this.add.circle(x, y, 8, color, .44).setDepth(depth);
      this.tweens.add({
        targets: ring,
        radius: 28,
        alpha: 0,
        duration: 220,
        ease: "Sine.easeOut",
        onComplete: () => ring.destroy()
      });
    }

    destroyProjectile(projectile, burst = false) {
      if (!projectile?.active) return;
      projectile.visual?.destroy();
      if (burst) {
        const impact = this.add.sprite(projectile.x, projectile.y, PROJECTILE_TEXTURE_KEY, projectile.impactFrame)
          .setOrigin(0.5)
          .setScale((projectile.visualScale || 0.15) * 1.18)
          .setDepth(Math.max(projectile.y + 12, projectile.visualBaseDepth || 0));
        if (projectile.impactAnimationKey) impact.play(projectile.impactAnimationKey);
        this.tweens.add({
          targets: impact,
          scale: (projectile.visualScale || 0.15) * 1.45,
          alpha: 0,
          duration: 260,
          ease: "Sine.easeOut",
          onComplete: () => impact.destroy()
        });
      }
      projectile.destroy();
    }

    handleLeafSlimeProjectileHit(projectile, slime) {
      if (!slime?.active) return;
      this.destroyProjectile(projectile, true);
      if (slime.state === "dead" || slime.state === "vanish") return;
      this.playLeafSlimeHit(slime);
    }

    checkLeafSlimeProjectileHit(projectile) {
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || slime.state === "dead" || slime.state === "vanish") continue;
        const hitX = slime.x;
        const hitY = slime.y + LEAF_SLIME_HIT_OFFSET_Y;
        const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, hitX, hitY);
        if (distance > LEAF_SLIME_HIT_RADIUS + projectile.radius) continue;
        this.handleLeafSlimeProjectileHit(projectile, slime);
        return true;
      }
      return false;
    }

    playLeafSlimeHit(slime) {
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "hit";
      slime.body.setVelocity(0, 0);
      slime.setTint(0xfff0b0);
      slime.play(`${LEAF_SLIME_KEY}-hit`, true);
      slime.once("animationcomplete", () => {
        if (!slime.active || slime.actionToken !== token) return;
        this.killLeafSlime(slime);
      });
    }

    killLeafSlime(slime) {
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "dead";
      slime.body.setVelocity(0, 0);
      slime.body.enable = false;
      slime.clearTint();
      slime.play(`${LEAF_SLIME_KEY}-dead`, true);
      app.profile.exp += 12;
      renderHud();
      showToast("击败叶灵怪，EXP +12");
      slime.once("animationcomplete", () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.state = "vanish";
        this.tweens.add({
          targets: slime,
          alpha: 0.12,
          duration: LEAF_SLIME_VANISH_TIME / 8,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            if (!slime.active || slime.actionToken !== token) return;
            slime.shadow?.destroy();
            slime.destroy();
            this.time.delayedCall(1600, () => {
              if (this.leafSlimes.countActive(true) < 1) this.spawnLeafSlime();
            });
          }
        });
      });
    }

    damagePlayer(amount) {
      if (app.profile.hp <= 0) return;
      app.profile.hp = Math.max(0, app.profile.hp - amount);
      renderHud();
      app.audio.hit();
      this.playActorHitReaction();
      if (app.profile.hp <= 0) {
        this.isDead = true;
        this.actor.play(`${app.profile.characterId}-death-once`, true);
        showToast("考核失败，按 H 恢复后继续挑战");
      }
    }

    playActorHitReaction() {
      if (!this.actor?.active || this.isDead) return;
      const character = getCharacter(app.profile.characterId);
      this.actorHitToken = (this.actorHitToken || 0) + 1;
      const token = this.actorHitToken;
      this.isCasting = false;
      this.isActionLocked = true;
      this.networkAction = "hit";
      this.actor.body.setVelocity(0, 0);
      this.actor.setTexture(character.id);
      this.actor.setTint(0xffe6a0);
      this.actor.play(`${character.id}-hit-once`, true);
      this.cameras.main.shake(90, 0.002);
      this.time.delayedCall(180, () => {
        if (!this.actor?.active || this.actorHitToken !== token || this.isDead) return;
        this.actor.clearTint();
      });
      this.actor.once("animationcomplete", () => {
        if (!this.actor?.active || this.actorHitToken !== token || this.isDead) return;
        this.actor.clearTint();
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    triggerLeafSlimeAttack(slime, dx, dy) {
      const now = this.time.now;
      if (now - slime.lastAttackAt < LEAF_SLIME_ATTACK_COOLDOWN) return;
      slime.lastAttackAt = now;
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "attack";
      const vec = normalizeVector(dx, dy);
      slime.setFlipX(dx < 0);
      slime.play(`${LEAF_SLIME_KEY}-attack`, true);
      slime.body.setVelocity(
        vec.x * (LEAF_SLIME_ATTACK_DISTANCE / LEAF_SLIME_ATTACK_DURATION * 1000),
        vec.y * (LEAF_SLIME_ATTACK_DISTANCE / LEAF_SLIME_ATTACK_DURATION * 1000)
      );
      this.time.delayedCall(180, () => {
        if (!slime.active || slime.actionToken !== token || !this.actor?.active) return;
        const hitDistance = Phaser.Math.Distance.Between(slime.x, slime.y, this.actor.x, this.actor.y);
        if (hitDistance <= LEAF_SLIME_ATTACK_RANGE + 24) this.damagePlayer(8);
      });
      this.time.delayedCall(LEAF_SLIME_ATTACK_DURATION, () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.body.setVelocity(0, 0);
        slime.state = "move";
        slime.nextHopAt = this.time.now + LEAF_SLIME_HOP_REST;
      });
    }

    startLeafSlimeHop(slime, dx, dy, distance) {
      const now = this.time.now;
      if (now < (slime.nextHopAt || 0)) return;
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      const vec = normalizeVector(dx, dy);
      const hopDistance = Math.min(LEAF_SLIME_HOP_DISTANCE, Math.max(18, distance - LEAF_SLIME_ATTACK_RANGE + 12));
      slime.state = "hop";
      slime.setFlipX(dx < 0);
      slime.play(`${LEAF_SLIME_KEY}-move`, true);
      slime.body.setVelocity(vec.x * (hopDistance / LEAF_SLIME_HOP_DURATION * 1000), vec.y * (hopDistance / LEAF_SLIME_HOP_DURATION * 1000));
      this.time.delayedCall(LEAF_SLIME_HOP_DURATION, () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.body.setVelocity(0, 0);
        slime.state = "move";
        slime.nextHopAt = this.time.now + LEAF_SLIME_HOP_REST;
      });
    }

    updateLeafSlimes() {
      const slimes = this.leafSlimes?.getChildren?.() || [];
      slimes.forEach(slime => {
        if (!slime?.active || !this.actor?.active) return;
        slime.setDepth(slime.y + 6);
        if (["hit", "dead", "vanish", "attack", "hop"].includes(slime.state)) return;
        const dx = this.actor.x - slime.x;
        const dy = this.actor.y - slime.y;
        const distance = Math.hypot(dx, dy);
        if (distance > LEAF_SLIME_DETECT_RANGE) {
          slime.body.setVelocity(0, 0);
          return;
        }
        slime.setFlipX(dx < 0);
        if (distance <= LEAF_SLIME_ATTACK_RANGE) this.triggerLeafSlimeAttack(slime, dx, dy);
        else this.startLeafSlimeHop(slime, dx, dy, distance);
      });
    }

    healPlayer() {
      if (!app.profile) return;
      const now = performance.now();
      if (now - app.lastHealAt < 9000) {
        showToast("樱光护盾正在冷却");
        return;
      }
      app.lastHealAt = now;
      app.profile.hp = Math.min(app.profile.maxHp, app.profile.hp + 42);
      if (app.profile.hp > 0 && this.isDead) {
        this.isDead = false;
        this.actor.clearTint();
        this.returnToBaseLoop();
      }
      app.audio.heal();
      renderHud();
      const button = $("#healButton");
      button.classList.add("cooling");
      window.setTimeout(() => button.classList.remove("cooling"), 9000);
    }

    handleHotkey(event) {
      if (event.repeat) return;
      const key = String(event.key || "").toLowerCase();
      const keyDirections = {
        w: [0, -1],
        arrowup: [0, -1],
        s: [0, 1],
        arrowdown: [0, 1],
        a: [-1, 0],
        arrowleft: [-1, 0],
        d: [1, 0],
        arrowright: [1, 0]
      };
      if (keyDirections[key]) this.updateFacing(keyDirections[key][0], keyDirections[key][1]);
      if (key === "j" || key === " ") this.triggerPrimaryAction();
      if (key === "h") this.healPlayer();
      if (key === "l") this.toggleTransformState();
      if (key === "u") this.playActorHitReaction();
      if (key === "i") this.damagePlayer(999);
    }

    getMoveVector() {
      const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const left = this.keys.A.isDown || this.keys.LEFT.isDown;
      const down = this.keys.S.isDown || this.keys.DOWN.isDown;
      const up = this.keys.W.isDown || this.keys.UP.isDown;
      const dx = (right ? 1 : 0) - (left ? 1 : 0);
      const dy = (down ? 1 : 0) - (up ? 1 : 0);
      return { dx, dy, moving: !!(dx || dy) };
    }

    updateFacing(dx, dy) {
      if (!dx && !dy) return;
      this.facing = nearestDirection(dx, dy);
      const vec = directionVector(this.facing);
      this.lastAimVector = vec;
      this.actor?.setFlipX(vec.x < -0.1);
    }

    updateProjectiles() {
      this.projectileGraphics.clear();
      this.projectiles.children.each(projectile => {
        if (!projectile.active) return;
        const distance = Math.hypot(projectile.x - projectile.spawnX, projectile.y - projectile.spawnY);
        if (distance > projectile.maxDistance || this.time.now - projectile.spawnTime > projectile.maxLifetime) {
          this.destroyProjectile(projectile, true);
          return;
        }
        if (this.checkLeafSlimeProjectileHit(projectile)) return;
        if (app.boss.active && app.boss.hp > 0) {
          const bossDistance = Phaser.Math.Distance.Between(projectile.x, projectile.y, app.boss.x, app.boss.y - 60);
          if (bossDistance < 96) {
            this.hitBoss(projectile);
            return;
          }
        }
        const vx = projectile.body.velocity.x;
        const vy = projectile.body.velocity.y;
        projectile.visual
          ?.setPosition(projectile.x, projectile.y)
          .setRotation(Math.atan2(vy, vx))
          .setDepth(Math.max(projectile.y + (projectile.depthOffset || 10), projectile.visualBaseDepth || 0));
        projectile.trail.push({ x: projectile.x, y: projectile.y });
        if (projectile.trail.length > 7) projectile.trail.shift();
        projectile.trail.forEach((point, index) => {
          const alpha = (index + 1) / projectile.trail.length * .18;
          this.projectileGraphics.fillStyle(projectile.color, alpha);
          this.projectileGraphics.fillCircle(point.x, point.y, Math.max(2, projectile.radius * 0.7 * (index + 1) / projectile.trail.length));
        });
      });
    }

    hitBoss(projectile) {
      if (!app.boss.active || app.boss.hp <= 0) return;
      const damage = projectile.damage || 18;
      this.destroyProjectile(projectile, true);
      if (app.connected) app.multiplayer.sendBossHit(damage);
      else syncBossState({ ...app.boss, hp: Math.max(0, app.boss.hp - damage), active: app.boss.hp - damage > 0 });
      app.audio.hit();
      this.cameras.main.shake(80, 0.002);
      if (app.boss.hp - damage <= 0 && !app.connected) claimBossReward();
    }

    updateBoss(time) {
      if (!app.boss.active || app.boss.hp <= 0 || !this.bossSprite.visible) return;
      this.bossSprite.setDepth(this.bossSprite.y + 18);
      const distance = Phaser.Math.Distance.Between(this.actor.x, this.actor.y, app.boss.x, app.boss.y);
      if (distance < BOSS.touchRange && time - this.lastBossHitAt > BOSS.attackCooldown) {
        this.lastBossHitAt = time;
        this.damagePlayer(BOSS.damage);
      }
    }

    syncAllPeers(peers) {
      peers.forEach(peer => this.syncPeer(peer));
      Array.from(this.remotePlayers.keys()).forEach(id => {
        if (!peers.has(id)) this.removePeer(id);
      });
    }

    syncPeer(peer) {
      let remote = this.remotePlayers.get(peer.id);
      const character = getCharacter(peer.characterId);
      if (!remote) {
        const sprite = this.add.sprite(peer.x, peer.y, character.id, 0)
          .setOrigin(0.5, character.baseline / FRAME_SIZE)
          .setScale(0.96)
          .setAlpha(0.88)
          .setDepth(peer.y + 8);
        sprite.play(`${character.id}-idle`);
        const label = this.add.text(peer.x, peer.y - 128, peer.name, {
          fontFamily: "Microsoft YaHei, sans-serif",
          fontSize: "13px",
          color: "#ffffff",
          stroke: "#3c2e4c",
          strokeThickness: 4
        }).setOrigin(0.5).setDepth(peer.y + 30);
        remote = { sprite, label, target: { x: peer.x, y: peer.y }, characterId: peer.characterId };
        this.remotePlayers.set(peer.id, remote);
      }
      remote.target = { x: peer.x, y: peer.y };
      remote.sprite.setFlipX(!!peer.flipX);
      remote.label.setText(peer.name);
      const moving = Phaser.Math.Distance.Between(remote.sprite.x, remote.sprite.y, peer.x, peer.y) > 8;
      const requested = peer.action || (moving ? "walk" : "idle");
      const animKey = `${peer.characterId}-${requested === "catRun" ? "catRun" : requested === "attack" ? "attack" : moving ? "walk" : "idle"}`;
      if (this.anims.exists(animKey) && remote.sprite.anims.currentAnim?.key !== animKey) remote.sprite.play(animKey, true);
    }

    removePeer(id) {
      const remote = this.remotePlayers.get(id);
      remote?.sprite.destroy();
      remote?.label.destroy();
      this.remotePlayers.delete(id);
    }

    updateRemotePlayers() {
      this.remotePlayers.forEach(remote => {
        remote.sprite.x += (remote.target.x - remote.sprite.x) * 0.16;
        remote.sprite.y += (remote.target.y - remote.sprite.y) * 0.16;
        remote.sprite.setDepth(remote.sprite.y + 8);
        remote.label.setPosition(remote.sprite.x, remote.sprite.y - 128).setDepth(remote.sprite.y + 30);
      });
    }

    updateActorShadows() {
      if (this.actorShadow && this.actor?.active) {
        this.actorShadow
          .setPosition(this.actor.x, this.actor.y + 3)
          .setDepth(this.actor.y - 24)
          .setVisible(!this.isDead);
      }
      this.leafSlimes?.children.each(slime => {
        const visible = !!slime?.active && slime.state !== "dead" && slime.state !== "vanish";
        slime.shadow
          ?.setVisible(visible)
          .setAlpha(visible ? Math.max(0.06, 0.18 * (slime.alpha ?? 1)) : 0)
          .setPosition(slime?.x || 0, (slime?.y || 0) + 12)
          .setDepth((slime?.y || 0) - 24);
      });
    }

    update(time) {
      if (!this.actor) return;
      if (this.isActionLocked || this.isDead) {
        this.actor.body.setVelocity(0, 0);
      } else if (app.profile.hp > 0) {
        const { dx, dy, moving } = this.getMoveVector();
        const character = getCharacter(app.profile.characterId);
        if (moving) {
          const vec = normalizeVector(dx, dy);
          this.updateFacing(dx, dy);
          const speed = this.isCat ? 310 : character.speed;
          this.actor.body.setVelocity(vec.x * speed, vec.y * speed);
          if (!this.isCasting) this.playLoop("walk");
        } else {
          this.actor.body.setVelocity(0, 0);
          if (!this.isCasting) this.playLoop("idle");
        }
      }
      this.actor.setDepth(this.actor.y + 8);
      this.updateProjectiles();
      this.updateLeafSlimes();
      this.updateBoss(time);
      this.updateRemotePlayers();
      this.updateActorShadows();
      if (app.connected && time - this.lastNetworkSendAt > 90) {
        this.lastNetworkSendAt = time;
        app.multiplayer.sendState();
      }
    }
  }

  function healPlayer() {
    app.scene?.healPlayer();
  }

  function claimBossReward() {
    if (app.bossRewardClaimed) return;
    app.bossRewardClaimed = true;
    app.boss.active = false;
    app.boss.hp = 0;
    app.profile.credits += BOSS.rewardCredits;
    app.profile.exp += BOSS.rewardExp;
    if (app.profile.exp >= 100) {
      app.profile.level += 1;
      app.profile.exp -= 100;
      app.profile.maxHp += 18;
      app.profile.hp = app.profile.maxHp;
    }
    renderHud();
    renderBossHud();
    app.scene?.syncBoss();
    showToast("通过 AI 陆教授考核，第一章 Boss MVP 完成");
  }

  function startGame(profile) {
    app.profile = normalizeProfile(profile);
    saveProfile(app.profile);
    $("#startOverlay").classList.add("hidden");
    app.audio.switchMode("game");
    renderHud();
    if (!app.game) {
      app.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: "gameRoot",
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: "#dff3ff",
        pixelArt: false,
        antialias: true,
        roundPixels: false,
        physics: {
          default: "arcade",
          arcade: { gravity: { y: 0 }, debug: false }
        },
        scene: PlayScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.NO_CENTER
        }
      });
    }
  }

  function bindUi() {
    const saved = loadProfile();
    const autoStart = new URLSearchParams(location.search).get("autostart") === "1";
    if (saved?.account) $("#loginAccountInput").value = saved.account;
    if (app.authToken && saved?.name) {
      $("#profileHint").textContent = `已保存 ${saved.name} 的登录状态，请输入密码进入同一服务器。`;
    } else {
      $("#profileHint").textContent = "登录后会自动进入同一个服务器房间。";
    }
    if (autoStart && app.authToken) {
      const button = $("#loginButton");
      button.disabled = true;
      $("#profileHint").textContent = "正在读取服务器档案，准备进入衷和广场...";
      loadSessionProfile()
        .then(profile => {
          window.history.replaceState(null, "", "play.html");
          startGame(profile);
        })
        .catch(error => {
          setSession("");
          button.disabled = false;
          $("#profileHint").textContent = error.message || "登录已过期，请重新登录。";
        });
    }

    const startAudioOnGesture = () => app.audio.start("login");
    ["pointerdown", "keydown", "focusin", "input"].forEach(eventName => {
      $("#startOverlay").addEventListener(eventName, startAudioOnGesture, { once: true });
    });

    $("#profileForm").addEventListener("submit", async event => {
      event.preventDefault();
      const username = $("#loginAccountInput").value.trim();
      const password = $("#loginPasswordInput").value;
      const button = $("#loginButton");
      if (!username || !password) {
        $("#profileHint").textContent = "请先输入账号和密码。";
        return;
      }
      button.disabled = true;
      $("#profileHint").textContent = "正在登录服务器...";
      try {
        const profile = await loginWithPassword(username, password);
        $("#profileHint").textContent = "登录成功，正在进入衷和广场...";
        startGame(profile);
      } catch (error) {
        setSession("");
        button.disabled = false;
        $("#profileHint").textContent = error.message || "登录失败，请检查账号密码。";
      }
    });
    $("#musicToggle").addEventListener("click", () => app.audio.toggle());
    $("#attackButton").addEventListener("click", () => app.scene?.triggerPrimaryAction());
    $("#healButton").addEventListener("click", () => healPlayer());
    $("#bossButton").addEventListener("click", () => app.scene?.startBoss());
    $("#reconnectButton").addEventListener("click", () => app.multiplayer?.connect());
    $("#fullscreenButton").addEventListener("click", async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $(".game-stage").requestFullscreen();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    app.audio = new AudioEngine();
    app.multiplayer = new MultiplayerClient();
    bindUi();
    renderNetwork("未连接", false);
    renderBossHud();
  });
})();
