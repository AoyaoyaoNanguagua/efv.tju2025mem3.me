(function (global) {
  "use strict";

  const VERSION = "2026.07.05";
  const PROJECT = {
    id: "efv-tju-cherry-blossom",
    title: "学术喵的奇幻之旅：樱花同济篇",
    shortTitle: "EFV TJU",
    defaultZone: "zhonghe-plaza"
  };

  const SPRITE_SPEC = {
    columns: 8,
    rows: 8,
    frameWidth: 147,
    frameHeight: 147,
    sheetWidth: 1176,
    sheetHeight: 1176,
    baseline: 140,
    animationSpeedFactor: 0.68
  };

  const ACTIONS = [
    { id: "idle", label: "待机", row: 0, fps: 7, repeat: -1, frames: [0, 1, 2, 3] },
    { id: "walk", label: "行走", row: 1, fps: 12, repeat: -1, frames: [0, 1, 2, 3, 4, 5] },
    { id: "attack", label: "施法 / 攻击", row: 2, fps: 18, repeat: 0, frames: [0, 1, 2, 3] },
    { id: "hit", label: "受击", row: 3, fps: 11, repeat: 0, frames: [0, 1, 2, 3] },
    { id: "death", label: "倒地", row: 4, fps: 9, repeat: 0, frames: [0, 1, 2, 3, 4, 5] },
    { id: "transform", label: "人猫互变", row: 5, fps: 20, repeat: 0, frames: [0, 1, 2, 3, 4, 5, 6, 7] },
    { id: "catRun", label: "猫形移动", row: 6, fps: 16, repeat: -1, frames: [0, 1, 2, 3] },
    { id: "catJump", label: "猫形跳跃", row: 7, fps: 16, repeat: 0, frames: [0, 1, 2, 3, 4, 5] }
  ];

  const MAIN_CHARACTER = {
    id: "lina",
    name: "莉娜",
    role: "治疗 / 辅助",
    weapon: "紫晶治疗杖",
    combat: "后排治疗、护盾与智慧增益；当前实景测试重点验证八向移动、法杖飞射物与装备切换。",
    cat: "白色长毛猫，紫瞳，适合后续接入探索态动作。",
    color: "#d98ad7",
    assets: {
      portrait: "assets/portraits/lina.png",
      sprite: "assets/sprites/lina-sprites-v10-anchored-expanded.png",
      attackAmethyst: "assets/sprites/lina-sprites-v15-attack-amethyst.png",
      attackSakura: "assets/sprites/lina-sprites-v15-attack-sakura.png",
      attackThesis: "assets/sprites/lina-sprites-v15-attack-thesis.png",
      projectiles: "assets/effects/lina-projectiles-atlas-v1.png"
    },
    spriteSpec: SPRITE_SPEC,
    actions: ACTIONS
  };

  const WEAPONS = [
    {
      id: "amethyst-staff",
      name: "紫晶治疗杖",
      css: "#d98ad7",
      asset: "assets/weapons/lina-amethyst-wand-sprite-v3.png",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-amethyst.png",
      projectileFrame: 0,
      impactFrame: 3,
      projectileOrigin: { x: 228 / 362, y: 201 / 362 },
      projectileScale: 0.15,
      speed: 620,
      size: 13,
      range: 900,
      cooldown: 310,
      description: "紫色星光弹，适合治疗与远程辅助表现。"
    },
    {
      id: "sakura-staff",
      name: "樱花短杖",
      css: "#f07aa3",
      asset: "assets/weapons/lina-sakura-wand-sprite-v3.png",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-sakura.png",
      projectileFrame: 4,
      impactFrame: 7,
      projectileOrigin: { x: 237 / 362, y: 178 / 362 },
      projectileScale: 0.15,
      speed: 540,
      size: 16,
      range: 820,
      cooldown: 360,
      description: "粉色扩散弹，适合校园樱花主题。"
    },
    {
      id: "thesis-staff",
      name: "开题星杖",
      css: "#54b5c8",
      asset: "assets/weapons/lina-thesis-wand-sprite-v3.png",
      attackSheet: "assets/sprites/lina-sprites-v15-attack-thesis.png",
      projectileFrame: 8,
      impactFrame: 11,
      projectileOrigin: { x: 227 / 362, y: 163 / 362 },
      projectileScale: 0.15,
      speed: 760,
      size: 10,
      range: 980,
      cooldown: 240,
      description: "青蓝高速弹，适合快速测试手感。"
    }
  ];

  const STYLE_GUIDE = {
    keywords: [
      "同济校园",
      "樱花季",
      "学术幻想",
      "轻量 JRPG",
      "干净线稿",
      "柔和高明度色彩",
      "透明背景精灵",
      "俯视 2D 瓦片地图"
    ],
    palette: ["#d98ad7", "#f07aa3", "#54b5c8", "#6fbf8f", "#f2d06b", "#3f5f7a"],
    references: [
      "assets/portraits/lina.png",
      "assets/sprites/lina-sprites-v10-anchored-expanded.png",
      "assets/maps/playable/previews/zhonghe-plaza-ground-style-imagegen-v1.png",
      "assets/maps/props/zhonghe-plaza-props-atlas-v1.png",
      "assets/enemies/leaf-poring-portrait-v2.png"
    ],
    artPrompt: "为《学术喵的奇幻之旅：樱花同济篇》生成可接入的 2D 游戏素材。风格为同济校园樱花季、学术幻想、轻量 JRPG；线稿清晰，色彩柔和但不要灰暗，边缘干净，角色和怪物使用透明背景，地图素材适合俯视 2D 瓦片。避免真实校徽、商业商标、照片质感、厚重暗黑风和难以切片的复杂透视。"
  };

  const CONTRIBUTION_RULES = {
    rootFolder: "contrib/<student-id>/",
    requiredFiles: ["<student-id>-level.js", "assets/", "data/"],
    reservedGlobals: ["window.EFVOfficial", "window.EFVContrib"],
    idPrefixRule: "所有 id、asset key、event key 建议使用 s<学号>_ 前缀。"
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeStudentId(value) {
    return String(value || "").trim().replace(/[^\dA-Za-z_-]/g, "");
  }

  function getAnimationFrames(action) {
    return action.frames.map(column => action.row * SPRITE_SPEC.columns + column);
  }

  function makeKeys(prefix = "official") {
    return {
      lina: `${prefix}-lina`,
      projectiles: `${prefix}-lina-projectiles`,
      attackAmethyst: `${prefix}-lina-attack-amethyst`,
      attackSakura: `${prefix}-lina-attack-sakura`,
      attackThesis: `${prefix}-lina-attack-thesis`,
      weapons: {
        "amethyst-staff": `${prefix}-weapon-amethyst-staff`,
        "sakura-staff": `${prefix}-weapon-sakura-staff`,
        "thesis-staff": `${prefix}-weapon-thesis-staff`
      }
    };
  }

  function preloadPhaserAssets(scene, options = {}) {
    if (!scene?.load) throw new Error("EFVOfficial.preloadPhaserAssets 需要在 Phaser scene.preload 中调用。");
    const keys = makeKeys(options.keyPrefix);
    scene.load.spritesheet(keys.lina, MAIN_CHARACTER.assets.sprite, {
      frameWidth: SPRITE_SPEC.frameWidth,
      frameHeight: SPRITE_SPEC.frameHeight
    });
    scene.load.spritesheet(keys.attackAmethyst, MAIN_CHARACTER.assets.attackAmethyst, {
      frameWidth: SPRITE_SPEC.frameWidth,
      frameHeight: SPRITE_SPEC.frameHeight
    });
    scene.load.spritesheet(keys.attackSakura, MAIN_CHARACTER.assets.attackSakura, {
      frameWidth: SPRITE_SPEC.frameWidth,
      frameHeight: SPRITE_SPEC.frameHeight
    });
    scene.load.spritesheet(keys.attackThesis, MAIN_CHARACTER.assets.attackThesis, {
      frameWidth: SPRITE_SPEC.frameWidth,
      frameHeight: SPRITE_SPEC.frameHeight
    });
    scene.load.spritesheet(keys.projectiles, MAIN_CHARACTER.assets.projectiles, {
      frameWidth: 362,
      frameHeight: 362
    });
    WEAPONS.forEach(weapon => scene.load.image(keys.weapons[weapon.id], weapon.asset));
    return keys;
  }

  function ensureLinaAnimations(scene, options = {}) {
    if (!scene?.anims) throw new Error("EFVOfficial.ensureLinaAnimations 需要在 Phaser scene.create 中调用。");
    const keys = makeKeys(options.keyPrefix);
    const animationPrefix = options.animationPrefix || keys.lina;
    const spriteKey = options.spriteKey || keys.lina;
    ACTIONS.forEach(action => {
      const animationKey = `${animationPrefix}-${action.id}`;
      if (scene.anims.exists(animationKey)) return;
      scene.anims.create({
        key: animationKey,
        frames: getAnimationFrames(action).map(frame => ({ key: spriteKey, frame })),
        frameRate: Math.max(1, action.fps * SPRITE_SPEC.animationSpeedFactor),
        repeat: action.repeat
      });
    });
    return {
      sprite: spriteKey,
      animations: ACTIONS.reduce((result, action) => {
        result[action.id] = `${animationPrefix}-${action.id}`;
        return result;
      }, {})
    };
  }

  function createLina(scene, x, y, options = {}) {
    const setup = ensureLinaAnimations(scene, options);
    if (!scene.textures.exists(setup.sprite)) {
      throw new Error("莉娜精灵表还没有加载。请先在 preload 中调用 EFVOfficial.preloadPhaserAssets(scene)。");
    }
    const sprite = scene.add.sprite(x, y, setup.sprite, 0)
      .setOrigin(0.5, SPRITE_SPEC.baseline / SPRITE_SPEC.frameHeight)
      .setScale(options.scale ?? 1);
    sprite.play(setup.animations[options.action || "idle"]);
    return { sprite, setup, character: clone(MAIN_CHARACTER) };
  }

  function createPackManifest(input = {}) {
    const studentId = normalizeStudentId(input.studentId || "2025000000");
    const slug = String(input.slug || "demo-pack").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return {
      studentId,
      id: `s${studentId}_${slug.replace(/-/g, "_")}`,
      title: input.title || "未命名关卡包",
      type: input.type || "level-pack",
      version: input.version || "0.1.0",
      entry: `${studentId}-level.js`,
      assets: {
        sprites: [],
        portraits: [],
        tilesets: [],
        props: []
      },
      data: {
        manifest: "data/manifest.json",
        points: "data/points.json",
        triggers: "data/triggers.json"
      }
    };
  }

  const registry = new Map();
  const EFVContrib = global.EFVContrib || {};

  EFVContrib.register = function register(pack) {
    if (!pack || typeof pack !== "object") throw new Error("EFVContrib.register 需要一个内容包对象。");
    const studentId = normalizeStudentId(pack.studentId);
    if (!studentId) throw new Error("内容包缺少 studentId。");
    const id = String(pack.id || `s${studentId}_pack`);
    if (!id.startsWith(`s${studentId}_`)) {
      console.warn(`建议将内容包 id 改为 s${studentId}_ 开头，方便合并时区分来源。`);
    }
    const normalized = { ...pack, id, studentId };
    registry.set(id, normalized);
    return normalized;
  };

  EFVContrib.list = function list() {
    return Array.from(registry.values()).map(clone);
  };

  EFVContrib.get = function get(id) {
    const pack = registry.get(id);
    return pack ? clone(pack) : null;
  };

  EFVContrib.clear = function clear() {
    registry.clear();
  };

  global.EFVOfficial = {
    version: VERSION,
    project: clone(PROJECT),
    getMainCharacter: () => clone(MAIN_CHARACTER),
    getSpriteSpec: () => clone(SPRITE_SPEC),
    getActions: () => clone(ACTIONS),
    getWeapons: () => clone(WEAPONS),
    getStyleGuide: () => clone(STYLE_GUIDE),
    getStylePrompt: () => STYLE_GUIDE.artPrompt,
    getContributionRules: () => clone(CONTRIBUTION_RULES),
    createPackManifest,
    normalizeStudentId,
    preloadPhaserAssets,
    ensureLinaAnimations,
    createLina
  };
  global.EFVContrib = EFVContrib;
})(window);
