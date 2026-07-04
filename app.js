const COLS = 8;
const ROWS = 8;
const FRAME_SIZE = 147;
const ANIMATION_SPEED_FACTOR = 0.68;
const MAP_SCALE = 1;
const MAP_SOURCE_WIDTH = 6400;
const MAP_SOURCE_HEIGHT = 6400;
const WORLD_WIDTH = MAP_SOURCE_WIDTH * MAP_SCALE;
const WORLD_HEIGHT = MAP_SOURCE_HEIGHT * MAP_SCALE;
const VIEW_WIDTH = 960;
const VIEW_HEIGHT = 540;

const MAP_TILE_SIZE = 64;
const MAP_TILESET_KEY = "zhonghe-plaza-tileset";
const MAP_TILEMAP_KEY = "zhonghe-plaza-tilemap";
const MAP_TILESET_PATH = "assets/maps/tilesets/zhonghe-plaza-ground-tileset-v1.png";
const MAP_PROP_ATLAS_KEY = "zhonghe-plaza-props";
const MAP_PROP_ATLAS_PATH = "assets/maps/props/zhonghe-plaza-props-atlas-v1.png";
const MAP_MACRO_PROP_ATLAS_KEY = "zhonghe-plaza-macro-props";
const MAP_MACRO_PROP_ATLAS_PATH = "assets/maps/props/zhonghe-plaza-macro-props-v1.png";
const MAP_DATA_PATH = "assets/maps/playable/zhonghe-plaza-tilemap-playtest-v1.json";
const PROJECTILE_ATLAS = "assets/effects/lina-projectiles-atlas-v1.png";

const ALL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
const FOUR_FRAMES = [0, 1, 2, 3];
const FIVE_FRAMES = [0, 1, 2, 3, 4];
const SIX_FRAMES = [0, 1, 2, 3, 4, 5];

const ACTIONS = [
  { id: "idle", label: "待机", hint: "呼吸 / 站立", row: 0, fps: 7, repeat: -1, frames: [0, 1, 2, 3] },
  { id: "walk", label: "行走", hint: "八向移动复用", row: 1, fps: 12, repeat: -1, frames: SIX_FRAMES },
  { id: "attack", label: "施法 / 攻击", hint: "法杖飞射物", row: 2, fps: 18, repeat: 0, frames: FOUR_FRAMES },
  { id: "hit", label: "受击", hint: "短硬直", row: 3, fps: 11, repeat: 0, frames: [0, 1, 2, 3] },
  { id: "death", label: "倒地", hint: "倒地保留", row: 4, fps: 9, repeat: 0, frames: SIX_FRAMES },
  { id: "transform", label: "人猫互变", hint: "变身预留", row: 5, fps: 20, repeat: 0, frames: ALL_FRAMES },
  { id: "catRun", label: "猫形移动", hint: "探索移动", row: 6, fps: 16, repeat: -1, frames: FOUR_FRAMES },
  { id: "catJump", label: "猫形跳跃", hint: "穿越障碍预留", row: 7, fps: 16, repeat: 0, frames: SIX_FRAMES }
];

const CHARACTERS = [
  {
    id: "lina",
    name: "莉娜",
    role: "治疗 / 辅助",
    weapon: "紫晶治疗杖",
    combat: "后排治疗、护盾与智慧增益；当前实景测试重点验证八向移动、法杖飞射物与装备切换。",
    cat: "白色长毛猫，紫瞳，适合后续接入探索态动作。",
    portrait: "assets/portraits/lina.png",
    sprite: "assets/sprites/lina-sprites-v10-anchored-expanded.png",
    color: "#d98ad7",
    baseline: 140
  },
  {
    id: "ayu",
    name: "阿宇",
    role: "近战 / 输出",
    weapon: "均衡剑",
    combat: "前排剑士，适合后续测试近战切入和碰撞体判定。",
    cat: "狸花猫，条纹尾巴，蓝色项圈。",
    portrait: "assets/portraits/ayu.png",
    sprite: "assets/sprites/ayu-sprites-v10-imagegen-anchored-clean.png",
    color: "#d99a4a",
    baseline: 140
  }
];

const EQUIPMENT = [
  {
    id: "amethyst-staff",
    name: "紫晶治疗杖",
    type: "法杖",
    color: 0xd98ad7,
    accent: 0x8c5ad8,
    css: "#d98ad7",
    mark: "晶",
    shape: "crystal",
    asset: "assets/weapons/lina-amethyst-wand-sprite-v3.png",
    attackTexture: "lina-attack-amethyst",
    attackSheet: "assets/sprites/lina-sprites-v15-attack-amethyst.png",
    projectileFrame: 0,
    impactFrame: 3,
    projectileScale: 0.15,
    spriteScale: 0.72,
    length: 54,
    head: 11,
    speed: 620,
    size: 13,
    range: 900,
    cooldown: 310,
    description: "紫色星光弹，适合治疗与远程辅助表现。"
  },
  {
    id: "sakura-staff",
    name: "樱花短杖",
    type: "法杖",
    color: 0xf07aa3,
    accent: 0xffd1de,
    css: "#f07aa3",
    mark: "樱",
    shape: "petal",
    asset: "assets/weapons/lina-sakura-wand-sprite-v3.png",
    attackTexture: "lina-attack-sakura",
    attackSheet: "assets/sprites/lina-sprites-v15-attack-sakura.png",
    projectileFrame: 4,
    impactFrame: 7,
    projectileScale: 0.15,
    spriteScale: 0.72,
    length: 48,
    head: 13,
    speed: 540,
    size: 16,
    range: 820,
    cooldown: 360,
    description: "粉色扩散弹，适合校园樱花主题。"
  },
  {
    id: "thesis-staff",
    name: "开题星杖",
    type: "法杖",
    color: 0x54b5c8,
    accent: 0xfff2a8,
    css: "#54b5c8",
    mark: "星",
    shape: "star",
    asset: "assets/weapons/lina-thesis-wand-sprite-v3.png",
    attackTexture: "lina-attack-thesis",
    attackSheet: "assets/sprites/lina-sprites-v15-attack-thesis.png",
    projectileFrame: 8,
    impactFrame: 11,
    projectileScale: 0.15,
    spriteScale: 0.72,
    length: 60,
    head: 9,
    speed: 760,
    size: 10,
    range: 980,
    cooldown: 240,
    description: "青蓝高速弹，适合快速测试手感。"
  }
];

const DIRECTIONS = [
  { id: "E", label: "E", x: 1, y: 0, angle: 0 },
  { id: "SE", label: "SE", x: 1, y: 1, angle: 45 },
  { id: "S", label: "S", x: 0, y: 1, angle: 90 },
  { id: "SW", label: "SW", x: -1, y: 1, angle: 135 },
  { id: "W", label: "W", x: -1, y: 0, angle: 180 },
  { id: "NW", label: "NW", x: -1, y: -1, angle: 225 },
  { id: "N", label: "N", x: 0, y: -1, angle: 270 },
  { id: "NE", label: "NE", x: 1, y: -1, angle: 315 }
];

const OBSTACLES = [
  { type: "building", x: 0, y: 0, w: 10000, h: 1180 },
  { type: "edge", x: 0, y: 0, w: 760, h: 6000 },
  { type: "edge", x: 9240, y: 0, w: 760, h: 6000 },
  { type: "edge", x: 0, y: 5050, w: 10000, h: 950 },
  { type: "green", x: 760, y: 1180, w: 470, h: 3600 },
  { type: "green", x: 8770, y: 1180, w: 470, h: 3600 },
  { type: "green", x: 1240, y: 4380, w: 1680, h: 520 },
  { type: "green", x: 7080, y: 4380, w: 1680, h: 520 },
  { type: "water", x: 2840, y: 2470, w: 320, h: 1120 },
  { type: "water", x: 6840, y: 2470, w: 320, h: 1120 },
  { type: "water", x: 2920, y: 3830, w: 640, h: 460 },
  { type: "water", x: 6440, y: 3830, w: 640, h: 460 },
  { type: "planter", x: 3600, y: 2140, w: 210, h: 190 },
  { type: "planter", x: 6200, y: 2140, w: 210, h: 190 },
  { type: "planter", x: 4200, y: 2920, w: 170, h: 150 },
  { type: "planter", x: 5630, y: 2920, w: 170, h: 150 },
  { type: "planter", x: 4200, y: 3660, w: 170, h: 150 },
  { type: "planter", x: 5630, y: 3660, w: 170, h: 150 },
  { type: "planter", x: 3520, y: 4240, w: 280, h: 160 },
  { type: "planter", x: 6200, y: 4240, w: 280, h: 160 },
  { type: "lamp", x: 2470, y: 1950, w: 62, h: 92 },
  { type: "lamp", x: 7470, y: 1950, w: 62, h: 92 },
  { type: "lamp", x: 3420, y: 3350, w: 62, h: 92 },
  { type: "lamp", x: 6520, y: 3350, w: 62, h: 92 },
  { type: "lamp", x: 4980, y: 4540, w: 62, h: 92 }
];

let selected = CHARACTERS[0];
let selectedAction = ACTIONS[0];
let selectedEquipment = EQUIPMENT[0];
let sceneRef = null;
let currentFrameIndex = 0;
let isPaused = false;
let gameResizeObserver = null;
const sheetImages = new Map();

function getActionFrameRate(action) {
  return Math.max(1, action.fps * ANIMATION_SPEED_FACTOR);
}

function getActionColumns(action) {
  return action.frames || ALL_FRAMES;
}

function getAnimationFrameColumn(frame) {
  const frameName = frame?.frame?.name || frame?.textureFrame || "";
  const match = String(frameName).match(/-(\d+)$/);
  if (match) return Number(match[1]);
  return ((((frame?.index || 1) - 1) % COLS) + COLS) % COLS;
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

async function assetExists(path) {
  try {
    const response = await fetch(path, { method: "HEAD", cache: "no-store" });
    return response.ok && Number(response.headers.get("content-length") || 1) > 0;
  } catch {
    return false;
  }
}

async function discoverAssets() {
  await Promise.all(CHARACTERS.map(async character => {
    character.hasSprite = await assetExists(character.sprite);
  }));
}

function getSheetImage(character) {
  if (!character.hasSprite) return null;
  const sheetPath = selectedAction.id === "attack" && character.id === "lina"
    ? (selectedEquipment.attackSheet || character.sprite)
    : character.sprite;
  const cacheKey = `${character.id}:${sheetPath}`;
  if (sheetImages.has(cacheKey)) return sheetImages.get(cacheKey);
  const image = new Image();
  image.src = sheetPath;
  sheetImages.set(cacheKey, image);
  return image;
}

function updateFrameReadout(frameIndex = currentFrameIndex) {
  currentFrameIndex = ((frameIndex % COLS) + COLS) % COLS;
  const label = document.querySelector("#frameLabel");
  if (label) label.textContent = `${String(currentFrameIndex + 1).padStart(2, "0")} / 08`;
  renderFramePreview();
}

function renderFramePreview() {
  const canvas = document.querySelector("#framePreview");
  const label = document.querySelector("#sheetText");
  if (!canvas || !label) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!selected.hasSprite) {
    label.textContent = "缺少精灵表，暂无法裁切当前帧。";
    return;
  }

  const image = getSheetImage(selected);
  if (!image.complete || !image.naturalWidth) {
    image.onload = renderFramePreview;
    label.textContent = "精灵表加载中...";
    return;
  }

  const frameWidth = image.naturalWidth / COLS;
  const frameHeight = image.naturalHeight / ROWS;
  const sx = currentFrameIndex * frameWidth;
  const sy = selectedAction.row * frameHeight;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
  label.textContent = `${selected.id} · ${selectedAction.id} · ${image.naturalWidth}×${image.naturalHeight} · ${Math.round(frameWidth)}×${Math.round(frameHeight)}`;
}

function updatePlaybackControls() {
  const toggle = document.querySelector("#playToggle");
  if (toggle) toggle.textContent = isPaused ? "继续动画" : "暂停动画";
}

function buildUI() {
  const list = document.querySelector("#characterList");
  list.innerHTML = CHARACTERS.map(character => `
    <button class="character-card" data-character="${character.id}" style="--character:${character.color}">
      <img class="portrait" src="${character.portrait}" alt="${character.name}角色海报">
      <span><strong>${character.name}</strong><small><i class="asset-dot ${character.hasSprite ? "ready" : ""}"></i>${character.hasSprite ? "精灵已就绪" : "等待精灵"}</small></span>
    </button>`).join("");

  const actions = document.querySelector("#actionList");
  actions.innerHTML = ACTIONS.map(action => `
    <button class="action-button" data-action="${action.id}">${action.label}<span>${action.hint}</span></button>`).join("");

  const inventory = document.querySelector("#inventoryItems");
  inventory.innerHTML = EQUIPMENT.map(item => `
    <button class="inventory-item" data-equipment="${item.id}" style="--staff-color:${item.css}">
      <span class="staff-icon">${item.mark}</span>
      <span><strong>${item.name}</strong><span>${item.description}</span></span>
    </button>`).join("");

  list.addEventListener("click", event => {
    const card = event.target.closest("[data-character]");
    if (!card) return;
    selected = CHARACTERS.find(character => character.id === card.dataset.character) || CHARACTERS[0];
    selectedAction = ACTIONS[0];
    renderSelection();
    sceneRef?.showCharacter(selected);
  });

  actions.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    selectedAction = ACTIONS.find(action => action.id === button.dataset.action) || ACTIONS[0];
    renderSelection();
    sceneRef?.triggerAction(selectedAction.id);
  });

  inventory.addEventListener("click", event => {
    const item = event.target.closest("[data-equipment]");
    if (!item) return;
    setEquipment(item.dataset.equipment);
  });

  document.querySelector("#playToggle").addEventListener("click", () => sceneRef?.togglePlayback());
  document.querySelector("#prevFrame").addEventListener("click", () => sceneRef?.stepFrame(-1));
  document.querySelector("#nextFrame").addEventListener("click", () => sceneRef?.stepFrame(1));
  document.querySelector("#testModeToggle").addEventListener("click", () => sceneRef?.resetCameraToActor());
  document.querySelector("#bagToggle").addEventListener("click", () => toggleInventory());
  document.querySelector("#collisionToggle").addEventListener("click", () => sceneRef?.toggleCollisionOverlay());
  document.querySelector("#cameraReset").addEventListener("click", () => sceneRef?.resetCameraToActor());
  document.querySelector("#fullscreenToggle").addEventListener("click", () => toggleFullscreen());
  document.addEventListener("fullscreenchange", () => {
    updateFullscreenButton();
    window.setTimeout(resizeGameViewport, 80);
  });
  document.querySelector("#gridToggle").addEventListener("change", event => {
    document.querySelector("#framePreviewWrap").classList.toggle("grid-on", event.target.checked);
  });
  document.querySelector("#previewBg").addEventListener("change", event => {
    const wrap = document.querySelector("#framePreviewWrap");
    wrap.classList.remove("checker", "dark", "light", "pink");
    wrap.classList.add(event.target.value);
  });

  renderSelection();
}

function setEquipment(id) {
  selectedEquipment = EQUIPMENT.find(item => item.id === id) || EQUIPMENT[0];
  renderEquipment();
  sceneRef?.setEquipment(selectedEquipment);
}

function renderEquipment() {
  document.querySelector("#weaponBadge").textContent = `武器：${selectedEquipment.name}`;
  document.documentElement.style.setProperty("--staff-color", selectedEquipment.css);
  document.querySelectorAll(".inventory-item").forEach(item => {
    item.classList.toggle("active", item.dataset.equipment === selectedEquipment.id);
  });
}

function toggleInventory(force) {
  const panel = document.querySelector("#inventoryPanel");
  const open = typeof force === "boolean" ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", open);
  panel.setAttribute("aria-hidden", String(!open));
}

function updateFullscreenButton() {
  const button = document.querySelector("#fullscreenToggle");
  if (!button) return;
  button.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
}

function getGameViewportSize() {
  const frame = document.querySelector("#game");
  const rect = frame?.getBoundingClientRect();
  return {
    width: Math.max(640, Math.round(rect?.width || VIEW_WIDTH)),
    height: Math.max(360, Math.round(rect?.height || VIEW_HEIGHT))
  };
}

function resizeGameViewport() {
  const game = window.efvGame;
  if (!game?.scale) return;
  const { width, height } = getGameViewportSize();
  if (game.scale.width !== width || game.scale.height !== height) {
    game.scale.resize(width, height);
  }
  const scene = game.scene?.getScene("EFV");
  if (scene?.cameras?.main) {
    scene.cameras.main.setSize(width, height);
    scene.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
}

async function toggleFullscreen() {
  const wrap = document.querySelector(".game-wrap");
  if (!wrap) return;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await wrap.requestFullscreen();
    }
  } catch (error) {
    console.warn("Fullscreen request failed", error);
  } finally {
    updateFullscreenButton();
    window.setTimeout(resizeGameViewport, 80);
  }
}

function renderSelection() {
  document.documentElement.style.setProperty("--character", selected.color);
  document.querySelectorAll(".character-card").forEach(card => card.classList.toggle("active", card.dataset.character === selected.id));
  document.querySelectorAll(".action-button").forEach(button => button.classList.toggle("active", button.dataset.action === selectedAction.id));
  document.querySelector("#roleTag").textContent = selected.role;
  document.querySelector("#characterName").textContent = selected.name;
  document.querySelector("#combatText").textContent = selected.combat;
  document.querySelector("#catText").textContent = selected.cat;
  document.querySelector("#actionLabel").textContent = selectedAction.label;
  renderEquipment();
  renderFramePreview();
}

function updateDirectionBadge(direction) {
  const badge = document.querySelector("#directionBadge");
  if (badge) badge.textContent = `朝向：${direction.label}`;
}

class EFVScene extends Phaser.Scene {
  constructor() {
    super("EFV");
  }

  preload() {
    this.load.image(MAP_TILESET_KEY, MAP_TILESET_PATH);
    this.load.image(MAP_PROP_ATLAS_KEY, MAP_PROP_ATLAS_PATH);
    this.load.image(MAP_MACRO_PROP_ATLAS_KEY, MAP_MACRO_PROP_ATLAS_PATH);
    this.load.tilemapTiledJSON(MAP_TILEMAP_KEY, MAP_DATA_PATH);
    this.load.json("zhonghe-map-data", MAP_DATA_PATH);
    this.load.spritesheet("lina-projectiles", PROJECTILE_ATLAS, { frameWidth: 362, frameHeight: 362 });
    EQUIPMENT.forEach(item => {
      this.load.image(item.id, item.asset);
      this.load.image(item.attackTexture, item.attackSheet);
    });
    CHARACTERS.forEach(character => {
      this.load.image(`${character.id}-portrait`, character.portrait);
      if (character.hasSprite) this.load.image(`${character.id}-sheet`, character.sprite);
    });
  }

  create() {
    sceneRef = this;
    this.cameras.main.roundPixels = true;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.mapData = this.cache.json.get("zhonghe-map-data");
    this.renderTileMap();
    this.prepareMapPropFrames();
    this.renderMapProps();

    this.obstacleGroup = this.physics.add.staticGroup();
    this.collisionGraphics = this.add.graphics().setDepth(20).setVisible(false);
    this.collisionVisible = false;
    this.drawObstacles();
    this.ensureProjectileTexture();

    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.projectileGraphics = this.add.graphics().setDepth(40);
    this.sparkles = this.add.group();
    this.facing = DIRECTIONS[2];
    this.lastShotAt = 0;
    this.selectedEquipment = selectedEquipment;
    this.isDead = false;
    this.isCasting = false;
    this.isCat = false;
    this.isActionLocked = false;
    this.isShowingCatIdleFrame = false;
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,J,B,C,R,L,U,I");
    this.input.keyboard.on("keydown", event => this.handleHotkey(event));
    this.input.on("pointerdown", pointer => {
      if (pointer.leftButtonDown()) this.triggerPrimaryAction();
    });

    CHARACTERS.filter(c => c.hasSprite).forEach(c => this.prepareFrames(c));
    this.showCharacter(selected);
    this.physics.add.collider(this.actor, this.obstacleGroup);
    this.physics.add.collider(this.projectiles, this.obstacleGroup, projectile => this.destroyProjectile(projectile, true));
    updateDirectionBadge(this.facing);
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
  }

  prepareMapPropFrames() {
    const frameSets = [
      { key: MAP_PROP_ATLAS_KEY, frames: this.mapData?.propFrames || {} },
      { key: MAP_MACRO_PROP_ATLAS_KEY, frames: this.mapData?.macroPropFrames || {} }
    ];
    frameSets.forEach(({ key, frames }) => {
      const texture = this.textures.get(key);
      if (!texture) return;
      Object.entries(frames).forEach(([name, frame]) => {
        if (!texture.has(name)) {
          texture.add(name, 0, frame.x, frame.y, frame.w, frame.h);
        }
      });
    });
  }

  getMapPropAtlasKey(item) {
    if (item.atlas === "macro") return MAP_MACRO_PROP_ATLAS_KEY;
    return MAP_PROP_ATLAS_KEY;
  }

  renderMapProps() {
    this.mapProps?.forEach?.(prop => prop.destroy());
    this.mapProps = [];
    (this.mapData?.props || []).forEach(item => {
      const frame = item.frame;
      const atlasKey = this.getMapPropAtlasKey(item);
      if (!frame || !this.textures.get(atlasKey)?.has(frame)) return;
      const origin = item.origin || {};
      const prop = this.add.image(item.x * MAP_SCALE, item.y * MAP_SCALE, atlasKey, frame)
        .setOrigin(origin.x ?? 0.5, origin.y ?? 1)
        .setScale(item.scale ?? 1)
        .setDepth((item.y * MAP_SCALE) + (item.depthOffset || 0));
      this.mapProps.push(prop);
    });
  }

  drawObstacles() {
    const colors = {
      building: 0x6f7f92,
      green: 0x2c9b61,
      water: 0x2f83d7,
      planter: 0x49a46f,
      tree: 0x1f7a48,
      lamp: 0xc18a21,
      edge: 0x313844
    };

    const obstacles = this.mapData?.obstacles || OBSTACLES;
    obstacles.forEach(item => {
      const x = item.x * MAP_SCALE;
      const y = item.y * MAP_SCALE;
      const w = item.w * MAP_SCALE;
      const h = item.h * MAP_SCALE;
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
      this.physics.add.existing(zone, true);
      this.obstacleGroup.add(zone);
      this.collisionGraphics.fillStyle(colors[item.type] || 0xff00ff, .24);
      this.collisionGraphics.fillRoundedRect(x, y, w, h, Math.min(18, w / 4, h / 4));
      this.collisionGraphics.lineStyle(2, colors[item.type] || 0xff00ff, .72);
      this.collisionGraphics.strokeRoundedRect(x, y, w, h, Math.min(18, w / 4, h / 4));
    });
  }

  ensureProjectileTexture() {
    if (this.textures.exists("projectile-hitbox")) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 16);
    g.generateTexture("projectile-hitbox", 32, 32);
    g.destroy();
  }

  prepareFrames(character) {
    this.prepareSheetFrames(`${character.id}-sheet`, character.id, ACTIONS);
    if (character.id === "lina") {
      const attack = ACTIONS.find(action => action.id === "attack");
      EQUIPMENT.forEach(item => this.prepareSheetFrames(item.attackTexture, `${character.id}-${item.id}`, [attack]));
    }
  }

  prepareSheetFrames(textureKey, animationPrefix, actions) {
    const texture = this.textures.get(textureKey);
    texture.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
    const source = texture.getSourceImage();
    actions.filter(Boolean).forEach(action => {
      const names = [];
      const y0 = action.row * (source.height / ROWS);
      const frameHeight = source.height / ROWS;
      for (let col = 0; col < COLS; col++) {
        const x0 = col * (source.width / COLS);
        const frameWidth = source.width / COLS;
        const frameName = `${action.id}-${col}`;
        if (!texture.has(frameName)) texture.add(frameName, 0, x0, y0, frameWidth, frameHeight);
        names.push({ key: textureKey, frame: frameName });
      }
      const playbackFrames = getActionColumns(action).map(col => names[col]).filter(Boolean);
      const key = `${animationPrefix}-${action.id}`;
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frames: playbackFrames, frameRate: getActionFrameRate(action), repeat: action.repeat, yoyo: !!action.yoyo });
      }
      const onceKey = `${animationPrefix}-${action.id}-once`;
      if (!this.anims.exists(onceKey)) {
        this.anims.create({ key: onceKey, frames: playbackFrames, frameRate: getActionFrameRate(action), repeat: 0 });
      }
    });
  }

  showCharacter(character) {
    this.actor?.destroy();
    const mapSpawn = this.mapData?.spawn || {};
    const spawn = {
      x: (mapSpawn.x ?? MAP_SOURCE_WIDTH / 2) * MAP_SCALE,
      y: (mapSpawn.y ?? MAP_SOURCE_HEIGHT / 2) * MAP_SCALE
    };
    if (character.hasSprite) {
      this.actor = this.physics.add.sprite(spawn.x, spawn.y, `${character.id}-sheet`, "idle-0");
      this.actor.setScale(1);
      this.actor.setOrigin(0.5, (character.baseline || 146) / FRAME_SIZE);
      this.actor.body.setSize(34, 42);
      this.actor.body.setOffset(56, 92);
      this.actor.setCollideWorldBounds(true);
      this.actor.setDepth(spawn.y);
      this.bindAnimationFrameUpdates(ACTIONS[0]);
      this.actor.play(`${character.id}-idle`, true);
    } else {
      this.actor = this.physics.add.image(spawn.x, spawn.y, `${character.id}-portrait`);
      this.actor.setScale(Math.min(0.26, 315 / this.actor.height));
      this.actor.body.setSize(80, 120);
      this.actor.setCollideWorldBounds(true);
    }
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.actor, true, 0.12, 0.12);
    this.cameras.main.centerOn(spawn.x, spawn.y);
    this.physics.add.collider(this.actor, this.obstacleGroup);
    this.playLoop("idle");
  }

  bindAnimationFrameUpdates(action) {
    if (!this.actor?.on) return;
    this.actor.off("animationupdate");
    this.actor.on("animationupdate", (_anim, frame) => {
      currentFrameIndex = getAnimationFrameColumn(frame);
      selectedAction = action;
      updateFrameReadout(currentFrameIndex);
    });
  }

  getBaseTextureKey() {
    return `${selected.id}-sheet`;
  }

  getAttackAnimationKey() {
    if (selected.id === "lina") return `${selected.id}-${this.selectedEquipment.id}-attack-once`;
    return `${selected.id}-attack-once`;
  }

  showCatIdleFrame() {
    const action = ACTIONS.find(item => item.id === "transform") || ACTIONS[0];
    if (selectedAction.id !== action.id) {
      selectedAction = action;
      renderSelection();
    }
    this.actor.anims?.stop();
    this.actor.setTexture(this.getBaseTextureKey());
    this.actor.setFrame("transform-7");
    this.isShowingCatIdleFrame = true;
    currentFrameIndex = 7;
    updateFrameReadout(currentFrameIndex);
  }

  playLoop(actionId) {
    if (!selected.hasSprite || !this.actor || this.isCasting || this.isDead || this.isActionLocked) return;
    if (this.isCat && actionId === "idle") {
      this.showCatIdleFrame();
      return;
    }
    const loopId = this.isCat && actionId === "walk" ? "catRun" : actionId;
    const action = ACTIONS.find(item => item.id === loopId) || ACTIONS[0];
    if (selectedAction.id !== action.id) {
      selectedAction = action;
      renderSelection();
    }
    const key = `${selected.id}-${action.id}`;
    if (this.isShowingCatIdleFrame || this.actor.anims?.currentAnim?.key !== key) {
      this.isShowingCatIdleFrame = false;
      this.actor.play(key, true);
      this.bindAnimationFrameUpdates(action);
    }
  }

  returnToBaseLoop() {
    if (this.isDead) return;
    this.playLoop("idle");
  }

  triggerPrimaryAction() {
    if (this.isCat) this.playCatJump();
    else this.playPreviewAction("attack");
  }

  triggerAction(actionId) {
    if (actionId === "attack") return this.triggerPrimaryAction();
    if (actionId === "transform") return this.toggleTransformState();
    if (actionId === "catJump") return this.playCatJump();
    if (actionId === "catRun") {
      this.isCat = true;
      return this.returnToBaseLoop();
    }
    if (actionId === "death") return this.toggleDeathState();
    return this.playPreviewAction(actionId);
  }

  playPreviewAction(actionId) {
    if (!selected.hasSprite || !this.actor) return;
    if (this.isDead || this.isActionLocked) return;
    const action = ACTIONS.find(item => item.id === actionId) || ACTIONS[0];
    if (action.id === "catJump") return this.playCatJump();
    if (action.id === "transform") return this.toggleTransformState();
    selectedAction = action;
    renderSelection();
    this.isCasting = action.id === "attack";
    this.isActionLocked = action.repeat === 0;
    this.actor.body.setVelocity(0, 0);
    if (action.id !== "attack") this.actor.setTexture(this.getBaseTextureKey());
    this.isShowingCatIdleFrame = false;
    const key = action.id === "attack"
      ? this.getAttackAnimationKey()
      : `${selected.id}-${action.id}${action.repeat === 0 ? "-once" : ""}`;
    this.actor.play(key, true);
    this.bindAnimationFrameUpdates(action);
    if (action.id === "attack") {
      this.time.delayedCall(95, () => this.castProjectile(true));
    }
    this.actor.once("animationcomplete", () => {
      this.isCasting = false;
      this.isActionLocked = false;
      this.actor.setTexture(this.getBaseTextureKey());
      this.returnToBaseLoop();
    });
  }

  playCatJump() {
    if (!selected.hasSprite || !this.actor || this.isDead || this.isActionLocked) return;
    this.isCat = true;
    const action = ACTIONS.find(item => item.id === "catJump");
    selectedAction = action;
    renderSelection();
    this.isActionLocked = true;
    this.actor.setTexture(this.getBaseTextureKey());
    this.isShowingCatIdleFrame = false;
    this.actor.play(`${selected.id}-catJump-once`, true);
    this.bindAnimationFrameUpdates(action);
    const vec = this.lastAimVector || directionVector(this.facing);
    this.actor.body.setVelocity(vec.x * 360, vec.y * 360);
    this.actor.once("animationcomplete", () => {
      this.actor.body.setVelocity(0, 0);
      this.isActionLocked = false;
      this.returnToBaseLoop();
    });
  }

  toggleTransformState() {
    if (!selected.hasSprite || !this.actor || this.isDead || this.isActionLocked) return;
    const action = ACTIONS.find(item => item.id === "transform");
    selectedAction = action;
    renderSelection();
    this.isActionLocked = true;
    this.isCasting = false;
    this.actor.setTexture(this.getBaseTextureKey());
    this.isShowingCatIdleFrame = false;
    const key = `${selected.id}-transform-once`;
    if (this.isCat && this.actor.anims?.playReverse) this.actor.anims.playReverse(key, true);
    else this.actor.play(key, true);
    this.bindAnimationFrameUpdates(action);
    this.actor.once("animationcomplete", () => {
      this.isCat = !this.isCat;
      this.isActionLocked = false;
      this.returnToBaseLoop();
    });
  }

  togglePlayback() {
    if (!selected.hasSprite || !this.actor) return;
    isPaused = !isPaused;
    if (isPaused) this.actor.anims.pause();
    else this.actor.anims.resume();
    updatePlaybackControls();
  }

  stepFrame(delta) {
    if (!selected.hasSprite || !this.actor) return;
    this.actor.anims.stop();
    isPaused = true;
    updateFrameReadout(currentFrameIndex + delta);
    const textureKey = selectedAction.id === "attack" && selected.id === "lina"
      ? selectedEquipment.attackTexture
      : this.getBaseTextureKey();
    this.actor.setTexture(textureKey);
    this.actor.setFrame(`${selectedAction.id}-${currentFrameIndex}`);
    updatePlaybackControls();
  }

  setEquipment(equipment) {
    this.selectedEquipment = equipment;
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
    if (selected.hasSprite && this.actor) {
      this.actor.setFlipX(vec.x < -0.1);
      const diagonalTilt = Math.abs(vec.x) > 0.1 && Math.abs(vec.y) > 0.1 ? (vec.x > 0 ? 1.5 : -1.5) : 0;
      this.actor.setAngle(diagonalTilt);
    }
    updateDirectionBadge(this.facing);
  }

  castProjectile(fromPreview = false) {
    if (!this.actor || this.isDead) return;
    if (this.isCat && !fromPreview) return this.playCatJump();
    if (this.isActionLocked && !fromPreview) return;
    const now = this.time.now;
    const equipment = this.selectedEquipment || EQUIPMENT[0];
    if (!fromPreview && now - this.lastShotAt < equipment.cooldown) return;
    this.lastShotAt = now;

    if (selected.hasSprite && !this.isCasting) {
      this.isCasting = true;
      selectedAction = ACTIONS.find(action => action.id === "attack");
      renderSelection();
      this.isShowingCatIdleFrame = false;
      this.actor.play(this.getAttackAnimationKey(), true);
      this.bindAnimationFrameUpdates(selectedAction);
      this.actor.once("animationcomplete", () => {
        this.isCasting = false;
        this.actor.setTexture(this.getBaseTextureKey());
        if (!this.isDead) this.playLoop("idle");
      });
    }

    const vec = this.lastAimVector || directionVector(this.facing);
    const castOrigin = this.getCastOrigin(vec);
    const startX = castOrigin.x;
    const startY = castOrigin.y;
    const projectile = this.physics.add.image(startX, startY, "projectile-hitbox");
    projectile.setVisible(false);
    projectile.body.setCircle(equipment.size);
    projectile.body.setAllowGravity(false);
    projectile.body.setVelocity(vec.x * equipment.speed, vec.y * equipment.speed);
    projectile.body.setCollideWorldBounds(true);
    projectile.spawnTime = now;
    projectile.color = equipment.color;
    projectile.radius = equipment.size;
    projectile.spawnX = startX;
    projectile.spawnY = startY;
    projectile.maxDistance = equipment.range || 900;
    projectile.impactFrame = equipment.impactFrame;
    projectile.visualScale = equipment.projectileScale || 0.15;
    projectile.trail = [];
    projectile.visual = this.add.sprite(startX, startY, "lina-projectiles", equipment.projectileFrame)
      .setOrigin(0.5)
      .setScale(projectile.visualScale)
      .setRotation(Math.atan2(vec.y, vec.x))
      .setDepth(this.actor.y + 6);
    this.projectiles.add(projectile);
    this.flashCast(startX, startY, equipment.color);
  }

  getCastOrigin(vec) {
    const sign = vec.x < -0.12 ? -1 : 1;
    const horizontalReach = Math.abs(vec.x) > 0.12 ? 58 : 28;
    return {
      x: this.actor.x + sign * horizontalReach,
      y: this.actor.y - 74 + vec.y * 30
    };
  }

  drawEquippedStaff() {
    this.staffSprite?.setVisible(false);
  }

  flashCast(x, y, color) {
    const ring = this.add.circle(x, y, 8, color, .44).setDepth(45);
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
      const impact = this.add.sprite(projectile.x, projectile.y, "lina-projectiles", projectile.impactFrame)
        .setOrigin(0.5)
        .setScale((projectile.visualScale || 0.15) * 1.18)
        .setDepth(projectile.y + 12);
      this.tweens.add({
        targets: impact,
        scale: (projectile.visualScale || 0.15) * 1.45,
        alpha: 0,
        duration: 260,
        ease: "Sine.easeOut",
        onComplete: () => impact.destroy()
      });
      for (let i = 0; i < 8; i++) {
        const dot = this.add.circle(projectile.x, projectile.y, 3, projectile.color, .75).setDepth(46);
        const angle = i * Math.PI / 4;
        this.tweens.add({
          targets: dot,
          x: projectile.x + Math.cos(angle) * 26,
          y: projectile.y + Math.sin(angle) * 26,
          alpha: 0,
          duration: 260,
          ease: "Sine.easeOut",
          onComplete: () => dot.destroy()
        });
      }
    }
    projectile.destroy();
  }

  handleHotkey(event) {
    if (event.repeat) return;
    const key = String(event.key || "").toLowerCase();
    if (key === "b") toggleInventory();
    if (key === "c") this.toggleCollisionOverlay();
    if (key === "r") this.resetCameraToActor();
    if (key === "j") this.triggerPrimaryAction();
    if (key === "u") this.playPreviewAction("hit");
    if (key === "i") this.toggleDeathState();
    if (key === "l") this.toggleTransformState();
  }

  toggleDeathState() {
    if (!selected.hasSprite || !this.actor) return;
    if (this.isDead) {
      this.isDead = false;
      this.actor.clearTint();
      this.returnToBaseLoop();
      return;
    }
    this.isDead = true;
    this.isCasting = false;
    this.isActionLocked = false;
    this.actor.body.setVelocity(0, 0);
    this.staffSprite?.setVisible(false);
    selectedAction = ACTIONS.find(action => action.id === "death");
    renderSelection();
    this.isShowingCatIdleFrame = false;
    this.actor.play(`${selected.id}-death-once`, true);
    this.bindAnimationFrameUpdates(selectedAction);
  }

  toggleCollisionOverlay() {
    this.collisionVisible = !this.collisionVisible;
    this.collisionGraphics.setVisible(this.collisionVisible);
  }

  resetCameraToActor() {
    if (!this.actor) return;
    this.cameras.main.pan(this.actor.x, this.actor.y, 280, "Sine.easeInOut");
  }

  updateProjectiles() {
    this.projectileGraphics.clear();
    this.projectiles.children.each(projectile => {
      if (!projectile.active) return;
      const distance = Math.hypot(projectile.x - projectile.spawnX, projectile.y - projectile.spawnY);
      if (distance > projectile.maxDistance || this.time.now - projectile.spawnTime > 1600) {
        this.destroyProjectile(projectile, true);
        return;
      }
      const vx = projectile.body.velocity.x;
      const vy = projectile.body.velocity.y;
      projectile.visual
        ?.setPosition(projectile.x, projectile.y)
        .setRotation(Math.atan2(vy, vx))
        .setDepth(projectile.y + 10);
      projectile.trail.push({ x: projectile.x, y: projectile.y });
      if (projectile.trail.length > 7) projectile.trail.shift();
      projectile.trail.forEach((point, index) => {
        const alpha = (index + 1) / projectile.trail.length * .18;
        this.projectileGraphics.fillStyle(projectile.color, alpha);
        this.projectileGraphics.fillCircle(point.x, point.y, Math.max(2, projectile.radius * 0.7 * (index + 1) / projectile.trail.length));
      });
    });
  }

  update(_time, delta) {
    if (!this.actor || !this.keys || this.isDead) {
      this.updateProjectiles();
      return;
    }

    if (this.isActionLocked) {
      this.actor.setDepth(this.actor.y);
      this.drawEquippedStaff();
      this.updateProjectiles(delta);
      return;
    }

    const { dx, dy, moving } = this.getMoveVector();
    if (moving) {
      const vec = normalizeVector(dx, dy);
      this.updateFacing(dx, dy);
      const speed = this.isCat ? 310 : (selected.id === "lina" ? 245 : 270);
      this.actor.body.setVelocity(vec.x * speed, vec.y * speed);
      if (!this.isCasting) this.playLoop("walk");
    } else {
      this.actor.body.setVelocity(0, 0);
      if (!this.isCasting) this.playLoop("idle");
    }

    this.actor.setDepth(this.actor.y);
    this.drawEquippedStaff();
    this.updateProjectiles(delta);
  }
}

async function boot() {
  await discoverAssets();
  buildUI();
  const ready = CHARACTERS.filter(c => c.hasSprite).length;
  const status = document.querySelector("#assetStatus");
  status.textContent = ready
    ? "衷和广场实景测试已就绪：地图、角色、包裹和飞射攻击可测试"
    : "角色精灵表待生成；当前只能预览地图与 UI";
  status.classList.add(ready ? "ready" : "pending");

  window.efvGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: "#d4cff0",
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: EFVScene,
    scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER }
  });
  const frame = document.querySelector("#game");
  if (frame && "ResizeObserver" in window) {
    gameResizeObserver?.disconnect?.();
    gameResizeObserver = new ResizeObserver(() => resizeGameViewport());
    gameResizeObserver.observe(frame);
  }
  window.addEventListener("resize", resizeGameViewport);
  window.setTimeout(resizeGameViewport, 0);
}

boot();
