(function () {
  "use strict";

  const COLS = 8;
  const ROWS = 8;
  const FRAME_SIZE = 147;
  const ANIMATION_SPEED_FACTOR = 0.68;
  const MAP_TILE_SIZE = 64;
  const PROJECTILE_FRAME_SIZE = 362;
  const PROJECTILE_MAX_RANGE = MAP_TILE_SIZE * 6;
  const PROJECTILE_SPEED_SCALE = 0.94;
  const PLAYER_PROJECTILE_SPEED_MULTIPLIER = 1.2;
  const PROJECTILE_VISUAL_SCALE_MULTIPLIER = 2;
  const PROJECTILE_HITBOX_SCALE_MULTIPLIER = 2;
  const PROJECTILE_HEAD_ORIGIN = { x: 236 / PROJECTILE_FRAME_SIZE, y: 209 / PROJECTILE_FRAME_SIZE };
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
  const CHAPTER_ONE_MAPS_KEY = "play-ch1-map-registry";
  const CHAPTER_ONE_MAPS_PATH = "assets/chapter1/chapter1-maps-v1.json";
  const CHAPTER_ONE_MAPS_REQUEST_PATH = `${CHAPTER_ONE_MAPS_PATH}?v=20260710-m2-ui-v2`;
  const QUEUED_MAP_IMAGE_KEYS_BY_SCENE = new WeakMap();

  function getQueuedMapImageKeys(scene) {
    let keys = QUEUED_MAP_IMAGE_KEYS_BY_SCENE.get(scene);
    if (!keys) {
      keys = new Set([MAP_PROP_ATLAS_KEY, MAP_MACRO_PROP_ATLAS_KEY]);
      QUEUED_MAP_IMAGE_KEYS_BY_SCENE.set(scene, keys);
    }
    return keys;
  }

  function normalizeMapAssetAtlases(mapData, fieldName) {
    const raw = mapData?.[fieldName];
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw
        .filter(item => item && typeof item === "object")
        .map((item, index) => ({ id: item.id || item.key || item.textureKey || `${fieldName}-${index}`, ...item }));
    }
    if (typeof raw !== "object") return [];
    if (raw.path || raw.key || raw.textureKey) {
      return [{ id: raw.id || raw.key || raw.textureKey || fieldName, ...raw }];
    }
    return Object.entries(raw)
      .filter(([, item]) => item)
      .map(([id, item]) => {
        if (typeof item === "string") return { id, key: id, path: item };
        if (typeof item !== "object") return null;
        return { id, ...item };
      })
      .filter(Boolean);
  }

  function collectMapImageAssets(mapData) {
    const images = new Map();
    const addImage = item => {
      const key = item?.key || item?.textureKey || item?.id;
      if (!key || !item?.path || images.has(key)) return;
      images.set(key, { key, path: item.path });
    };
    addImage(mapData?.background);
    (mapData?.background?.chunks || []).forEach(addImage);
    (mapData?.props || []).forEach(addImage);
    addImage(mapData?.minimapImage);
    ["propAtlases", "foregroundAtlases"].forEach(fieldName => {
      normalizeMapAssetAtlases(mapData, fieldName).forEach(addImage);
    });
    (mapData?.foregroundOverlays || []).forEach(overlay => {
      addImage({
        ...overlay,
        key: overlay.textureKey || overlay.key || overlay.id
      });
    });
    (mapData?.interactionNodes || []).forEach(node => addImage(node.markerImage));
    return Array.from(images.values());
  }

  function queueChapterMapAssets(scene, registry, mapId) {
    const maps = registry?.maps || {};
    const selectedMapId = maps[mapId] ? mapId : registry?.defaultMapId;
    const queued = [];
    const queuedKeys = getQueuedMapImageKeys(scene);
    collectMapImageAssets(maps[selectedMapId]).forEach(item => {
      if (queuedKeys.has(item.key) || scene.textures.exists(item.key)) return;
      queuedKeys.add(item.key);
      scene.load.image(item.key, item.path);
      queued.push(item);
    });
    return queued;
  }

  const MAP_PORTAL_KEY = "ch1-map-teleport-portal";
  const MAP_PORTAL_IMAGE = "assets/game/vfx/ch1-map-teleport-portal-sheet-v1.png";
  const MAP_PORTAL_FRAME_WIDTH = 192;
  const MAP_PORTAL_FRAME_HEIGHT = 192;
  const MAP_TRANSFER_RING_KEY = "ch1-map-transfer-ring";
  const MAP_TRANSFER_RING_IMAGE = "assets/game/vfx/ch1-map-transfer-ring-sheet-v1.png";
  const MAP_TRANSFER_RING_FRAME_WIDTH = 128;
  const MAP_TRANSFER_RING_FRAME_HEIGHT = 128;
  const BOSS_VOID_PORTAL_KEY = "ch1-boss-void-portal";
  const BOSS_VOID_PORTAL_IMAGE = "assets/game/vfx/ch1-boss-void-portal-sheet-v1.png";
  const BOSS_VOID_PORTAL_FRAME_WIDTH = 256;
  const BOSS_VOID_PORTAL_FRAME_HEIGHT = 256;
  const PROJECTILE_ATLAS = "assets/effects/lina-projectiles-atlas-v2.png";
  const PROJECTILE_TEXTURE_KEY = "play-lina-projectiles";
  const ULTIMATE_BACK_ATLAS = "assets/effects/lina-ultimate-cyclone-back-v1.png";
  const ULTIMATE_FRONT_ATLAS = "assets/effects/lina-ultimate-cyclone-front-v1.png";
  const ULTIMATE_BACK_TEXTURE_KEY = "play-lina-ultimate-cyclone-back";
  const ULTIMATE_FRONT_TEXTURE_KEY = "play-lina-ultimate-cyclone-front";
  const ULTIMATE_FRAME_WIDTH = 768;
  const ULTIMATE_FRAME_HEIGHT = 512;
  const ULTIMATE_ORIGIN_Y = 300 / ULTIMATE_FRAME_HEIGHT;
  const CHARGE_HOLD_THRESHOLD = 280;
  const ENERGY_DEFAULT_MAX = 150;
  const ENERGY_REGEN_PER_SECOND = 4.5;
  const ENERGY_HIT_GAIN = 8;
  const ENERGY_CHARGED_HIT_GAIN = 18;
  const ENERGY_MELEE_HIT_GAIN = 6;
  const ULTIMATE_COST = 100;
  const HEAL_COST = 50;
  const ULTIMATE_DAMAGE = 48;
  const ULTIMATE_RADIUS_X = 430;
  const ULTIMATE_RADIUS_Y = 220;
  const LEAF_SLIME_SHEET = "assets/game/enemies/animated/leaf-poring-sprites-v2.png";
  const LEAF_SLIME_KEY = "play-leaf-slime";
  const LEAF_SLIME_FRAME_SIZE = 128;
  const LEAF_SLIME_COLS = 6;
  const MAGIC_BROOM_KEY = "ch1-runaway-magic-broom";
  const BITING_MAGIC_BOOK_KEY = "ch1-biting-magic-book";
  const M02_COPY_SHADOW_KEY = "ch1-m02-copy-paste-shadow";
  const M02_TONE_DRIFT_KEY = "ch1-m02-tone-drift-archivist";
  const CHAPTER_ONE_ENEMY_SPRITES = [
    { key: MAGIC_BROOM_KEY, path: "assets/game/enemies/animated/runaway-magic-broom-sprites-v1.png" },
    { key: BITING_MAGIC_BOOK_KEY, path: "assets/game/enemies/animated/biting-magic-book-sprites-v1.png" },
    { key: M02_COPY_SHADOW_KEY, path: "assets/game/enemies/animated/m02-copy-paste-shadow-sprites-v1.png" },
    { key: M02_TONE_DRIFT_KEY, path: "assets/game/enemies/animated/m02-tone-drift-archivist-sprites-v1.png" }
  ];
  const PROFESSOR_NPC_KEY = "ch1-ai-professor-npc";
  const PROFESSOR_NPC_IMAGE = "assets/game/characters/npcs/ai-professor-npc-idle-sheet-v2.png";
  const PROFESSOR_NPC_FRAME_WIDTH = 192;
  const PROFESSOR_NPC_FRAME_HEIGHT = 256;
  const PROFESSOR_NPC_IDLE_ANIMATION = "ch1-ai-professor-npc-idle";
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
  const BOSS_IMAGE = "assets/game/bosses/ai-professor-summoner-game-cutout-v1.png";
  const BOSS_VISUAL_SCALE = 0.42;
  const QUANTUM_SCHOLAR_KEY = "ch1-enemy-quantum-scholar-rare";
  const QUANTUM_FAMILIAR_KEY = "ch1-enemy-quantum-familiar-elite";
  const QUANTUM_PAPER_KEY = "ch1-enemy-quantum-paper-mob";
  const BLOCKCHAIN_CHAINBEAST_KEY = "ch1-enemy-blockchain-chainbeast-rare";
  const BLOCKCHAIN_LOCK_KEY = "ch1-enemy-blockchain-lock-elite";
  const BLOCKCHAIN_SPIDER_KEY = "ch1-enemy-blockchain-spider-mob";
  const AIAGENT_CYBERMAGE_KEY = "ch1-enemy-aiagent-cybermage-rare";
  const AIAGENT_DIGITAL_CAT_KEY = "ch1-enemy-aiagent-digital-cat-elite";
  const AIAGENT_BOTCAT_KEY = "ch1-enemy-aiagent-botcat-mob";
  const CHAPTER_ONE_ENEMY_IMAGES = [
    { key: QUANTUM_SCHOLAR_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-quantum-scholar-rare-cutout-v1.png" },
    { key: QUANTUM_FAMILIAR_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-quantum-familiar-elite-cutout-v1.png" },
    { key: QUANTUM_PAPER_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-quantum-paper-mob-cutout-v1.png" },
    { key: BLOCKCHAIN_CHAINBEAST_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-blockchain-chainbeast-rare-cutout-v2.png" },
    { key: BLOCKCHAIN_LOCK_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-blockchain-lock-elite-cutout-v1.png" },
    { key: BLOCKCHAIN_SPIDER_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-blockchain-spider-mob-cutout-v1.png" },
    { key: AIAGENT_CYBERMAGE_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-aiagent-cybermage-rare-cutout-v1.png" },
    { key: AIAGENT_DIGITAL_CAT_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-aiagent-digital-cat-elite-cutout-v2.png" },
    { key: AIAGENT_BOTCAT_KEY, path: "assets/game/enemies/cutouts/ch1-enemy-aiagent-botcat-mob-cutout-v1.png" }
  ];
  const BOSS_PORTAL_OPEN_MS = 520;
  const BOSS_PORTAL_EGRESS_MS = 820;
  const BOSS_PORTAL_CLOSE_MS = 420;
  const BOSS_PORTAL_STAGGER_MS = 110;
  const PLAYER_CRIT_CHANCE = 0.16;
  const PLAYER_MAGIC_CRIT_MULTIPLIER = 2;
  const PLAYER_PHYSICAL_CRIT_MULTIPLIER = 1.5;
  const CREDIT_DEFENSE_MIN = 0.3;
  const CREDIT_DEFENSE_MAX = 1.2;
  const SHIELD_BLOCK_COLOR = 0x8fd8ff;
  const SAVE_KEY = "efv-play-profile-v2";
  const SESSION_KEY = "efv-session-token";
  const CHAPTER_ONE_KEY = "efv-chapter-one-slice-v1";
  const CHAPTER_ONE_PROTOCOL_CARD_GOAL = 3;
  const BOSS_SUMMON_GROUP = "ch1_final_professor_summons";
  const BOSS_CHEST_FLAG = "ch1_boss_chest_opened";
  const CHAT_HISTORY_LIMIT = 40;
  const CHAT_TEXT_LIMIT = 80;
  const WORLD_DROP_TTL_MS = 5 * 60 * 1000;
  const WORLD_DROP_BLINK_MS = 20 * 1000;
  const WORLD_DROP_PICKUP_RADIUS = 92;
  const WORLD_DROP_MATERIAL_KEY = "play-world-drop-material";
  const WORLD_DROP_MATERIAL_IMAGE = "assets/ui/hud/ch1-drop-material-icon-v1.png";
  const WORLD_DROP_EQUIPMENT_KEY = "play-world-drop-equipment";
  const WORLD_DROP_EQUIPMENT_IMAGE = "assets/ui/hud/ch1-drop-equipment-icon-v1.png";
  const INVENTORY_CAPACITY = 30;
  const EQUIPMENT_CAPACITY = 10;
  const MINIMAP_UPDATE_INTERVAL_MS = 140;
  const INTERACTION_UPDATE_INTERVAL_MS = 90;
  const ENTRY_LOADING_MIN_MS = 5000;
  const MINIMAP_COLORS = {
    player: "#ffffff",
    task: "#5ed2df",
    battle: "#ef7fb0",
    exit: "#42c98a",
    boss: "#f3c75d",
    chest: "#8f72d6",
    locked: "#756b7d",
    done: "#8fa29d"
  };

  const CHAPTER_ONE_CARD_NAMES = {
    ch1_card_context_window: "上下文窗口",
    ch1_card_traceable_instruction: "可追踪指令",
    ch1_card_schema_lock: "结构锁定"
  };

  const LINA_STAFF_CAST_SOCKETS = [
    { x: 117, y: 64 },
    { x: 99, y: 46 },
    { x: 110, y: 58 },
    { x: 108, y: 51 }
  ];
  const LINA_DEFAULT_STAFF_SOCKET = LINA_STAFF_CAST_SOCKETS[1];

  const ALL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
  const FOUR_FRAMES = [0, 1, 2, 3];
  const CHARGE_LOOP_FRAMES = [1, 2, 3];
  const ULTIMATE_CAST_FRAMES = [0, 1, 2, 3, 1, 2, 3];
  const SIX_FRAMES = [0, 1, 2, 3, 4, 5];
  const LINA_ATTACK_VISUAL_SCALE = 1.1;
  const ACTOR_DEFAULT_VISUAL_SCALE = 1;
  const PEER_DEFAULT_VISUAL_SCALE = 0.96;

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
      projectileFrame: 0,
      impactFrame: 3,
      projectileOrigin: { x: 236 / PROJECTILE_FRAME_SIZE, y: 209 / PROJECTILE_FRAME_SIZE },
      chargedProjectileOrigin: { x: 262 / PROJECTILE_FRAME_SIZE, y: 203 / PROJECTILE_FRAME_SIZE },
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
      projectileFrame: 4,
      impactFrame: 7,
      projectileOrigin: { x: 232 / PROJECTILE_FRAME_SIZE, y: 191 / PROJECTILE_FRAME_SIZE },
      chargedProjectileOrigin: { x: 259 / PROJECTILE_FRAME_SIZE, y: 186 / PROJECTILE_FRAME_SIZE },
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
      projectileFrame: 8,
      impactFrame: 11,
      projectileOrigin: { x: 235 / PROJECTILE_FRAME_SIZE, y: 159 / PROJECTILE_FRAME_SIZE },
      chargedProjectileOrigin: { x: 257 / PROJECTILE_FRAME_SIZE, y: 155 / PROJECTILE_FRAME_SIZE },
      projectileScale: 0.15,
      speed: 760,
      size: 10,
      range: 980,
      cooldown: 240
    }
  ];

  const MELEE = {
    cooldown: 330,
    reach: 62,
    radius: 72,
    damage: 26,
    color: 0x8fd8ff
  };

  const BASE_STATS = {
    level: 1,
    exp: 0,
    credits: 0,
    maxHp: 160,
    hp: 160,
    maxEnergy: ENERGY_DEFAULT_MAX,
    energy: ENERGY_DEFAULT_MAX,
    shield: 0,
    attackPower: 26,
    magicPower: 22
  };

  const ITEM_CATALOG = {
    "ch1_material_margin_note": {
      id: "ch1_material_margin_note",
      name: "批注纸角",
      type: "material",
      quality: "common",
      description: "从错页与失控讲义上脱落的纸角，可出售或用于后续合成。"
    },
    "ch1_material_protocol_ink": {
      id: "ch1_material_protocol_ink",
      name: "协议墨滴",
      type: "material",
      quality: "excellent",
      description: "残留着微弱协议波动的墨滴，可用于任务或合成。"
    },
    "ch1_material_campus_token": {
      id: "ch1_material_campus_token",
      name: "旧饭卡芯片",
      type: "material",
      quality: "common",
      description: "校园旧设备中常见的芯片，可出售换取校园币。"
    },
    "ch1_boost_academic_bookmark": {
      id: "ch1_boost_academic_bookmark",
      name: "晨读书签",
      type: "equipment",
      quality: "excellent",
      damageBonus: 0.05,
      description: "增益装备。放入增益栏后，最终伤害提高 5%。"
    },
    "ch1_boost_focus_badge": {
      id: "ch1_boost_focus_badge",
      name: "专注校徽",
      type: "equipment",
      quality: "rare",
      damageBonus: 0.08,
      description: "增益装备。放入增益栏后，最终伤害提高 8%。"
    },
    "ch1_drop_citation_seal_fragment": {
      id: "ch1_drop_citation_seal_fragment",
      name: "引用封印碎片",
      type: "material",
      quality: "rare",
      description: "从资料长廊的复制阴影中剥离的封印碎片，记录着已修复的引用链。"
    }
  };

  const SKILL_DEFINITIONS = {
    lina: {
      attack: {
        name: "晶光飞弹",
        key: "J",
        description: "魔法伤害 = 魔力 × 100%；长按蓄力后为魔力 × 155%。魔法暴击造成 200% 伤害，命中回复 8 EN，蓄力命中回复 18 EN。"
      },
      ultimate: {
        name: "学风旋流",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，对身边椭圆范围内的目标造成 ${ULTIMATE_DAMAGE} 点魔法伤害。魔法暴击造成 200% 伤害。`
      },
      heal: {
        name: "樱光护盾",
        key: "H",
        description: `消耗 ${HEAL_COST} EN，恢复 42 HP，并获得 36 点护盾；护盾优先抵消受到的伤害。`
      },
      transform: {
        name: "学术猫形态",
        key: "L",
        description: "切换猫形态。移动速度 = 人形速度 × 200%，主要攻击变为向前跳跃。"
      }
    },
    ayu: {
      attack: {
        name: "光刃挥砍",
        key: "J",
        description: "物理伤害 = 攻击力 × 100%。物理暴击造成 150% 伤害，命中回复 6 EN。"
      },
      ultimate: {
        name: "星轨环斩",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，对周围目标造成攻击力 × 180% 的物理伤害。物理暴击造成 150% 伤害。`
      },
      heal: {
        name: "樱光护盾",
        key: "H",
        description: `消耗 ${HEAL_COST} EN，恢复 42 HP，并获得 36 点护盾；护盾优先抵消受到的伤害。`
      },
      transform: {
        name: "学术猫形态",
        key: "L",
        description: "切换猫形态。移动速度 = 人形速度 × 200%，主要攻击变为向前跳跃。"
      }
    }
  };

  const BOSS = {
    id: "boss_ai_prof",
    name: "陆教授的协议考核",
    maxHp: 5,
    hp: 0,
    active: false,
    x: 0,
    y: 0,
    phase: "idle",
    waveIndex: 0,
    waveTitle: "",
    wavesTotal: 3,
    summonsRemaining: 0,
    eliteRemaining: 0,
    chestReady: false,
    damage: 0,
    touchRange: 0,
    attackCooldown: 2200,
    rewardCredits: 8,
    rewardExp: 80
  };

  const BOSS_SUMMON_WAVES = [
    {
      id: "quantum",
      title: "量子系",
      color: 0x5ed2df,
      units: [
        { rank: "rare", label: "量子稀有精英", dx: 260, dy: 110, tint: 0x70e7ff, scale: 1.28, maxHp: 260, damage: 15, creditDefense: 4, rewardExp: 44, rewardCredits: 4, dropId: "ch1_drop_quantum_probability_core", dropName: "量子概率核心" },
        { rank: "elite", label: "量子精英", dx: -220, dy: 120, tint: 0x9b83ff, scale: 1.08, maxHp: 150, damage: 12, rewardExp: 24, rewardCredits: 2, dropId: "ch1_drop_quantum_shard", dropName: "量子相干碎片" },
        { rank: "mob", label: "量子小怪", dx: -70, dy: 265, tint: 0xbff7ff, scale: 0.86, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "量子小怪", dx: 100, dy: 275, tint: 0xbff7ff, scale: 0.86, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "量子小怪", dx: 0, dy: -170, tint: 0xd7c8ff, scale: 0.82, maxHp: 68, damage: 9, rewardExp: 12, rewardCredits: 1 }
      ]
    },
    {
      id: "blockchain",
      title: "区块链系",
      color: 0xf3c75d,
      units: [
        { rank: "rare", label: "链铸稀有精英", dx: -270, dy: 105, textureKey: BLOCKCHAIN_CHAINBEAST_KEY, staticImage: true, tint: 0xffffff, scale: 0.16, maxHp: 300, damage: 17, creditDefense: 5, rewardExp: 46, rewardCredits: 5, dropId: "ch1_drop_chain_forge_core", dropName: "链铸重核" },
        { rank: "elite", label: "重锁精英", dx: 235, dy: 130, tint: 0x8e8172, scale: 1.12, maxHp: 175, damage: 13, rewardExp: 26, rewardCredits: 3, dropId: "ch1_drop_blockchain_lock", dropName: "验证锁片" },
        { rank: "mob", label: "链条小怪", dx: -110, dy: 270, tint: 0x786b5e, scale: 0.9, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "链条小怪", dx: 65, dy: 285, tint: 0x786b5e, scale: 0.9, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "锁扣小怪", dx: 160, dy: -150, tint: 0xc9a44d, scale: 0.86, maxHp: 82, damage: 10, rewardExp: 13, rewardCredits: 1 }
      ]
    },
    {
      id: "aiagent",
      title: "AI Agent 系",
      color: 0x8f72d6,
      units: [
        { rank: "rare", label: "数字猫稀有精英", dx: 270, dy: 105, textureKey: AIAGENT_DIGITAL_CAT_KEY, staticImage: true, tint: 0xffffff, scale: 0.17, maxHp: 320, damage: 18, creditDefense: 6, rewardExp: 48, rewardCredits: 5, dropId: "ch1_drop_agent_memory_core", dropName: "Agent 记忆核心" },
        { rank: "elite", label: "任务路由精英", dx: -235, dy: 130, tint: 0xb889ff, scale: 1.1, maxHp: 190, damage: 14, rewardExp: 28, rewardCredits: 3, dropId: "ch1_drop_agent_tool_node", dropName: "工具节点" },
        { rank: "mob", label: "提示词小怪", dx: -135, dy: 275, tint: 0x9ff7ff, scale: 0.88, maxHp: 92, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "记忆碎片", dx: 45, dy: 285, tint: 0xd9c3ff, scale: 0.86, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "工具调用小怪", dx: -35, dy: -165, tint: 0x72e2d7, scale: 0.86, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 }
      ]
    }
  ];

  [
    {
      title: "量子系",
      color: 0x5ed2df,
      units: [
        { rank: "rare", label: "量子观测稀有精英", dx: 260, dy: 110, textureKey: QUANTUM_SCHOLAR_KEY, staticImage: true, tint: 0xffffff, scale: 0.68, maxHp: 260, damage: 15, creditDefense: 4, rewardExp: 44, rewardCredits: 4, dropId: "ch1_drop_quantum_probability_core", dropName: "量子概率核心" },
        { rank: "elite", label: "波函数精英", dx: -220, dy: 120, textureKey: QUANTUM_FAMILIAR_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 150, damage: 12, rewardExp: 24, rewardCredits: 2, dropId: "ch1_drop_quantum_shard", dropName: "量子相干碎片" },
        { rank: "mob", label: "量子纸灵", dx: -70, dy: 265, textureKey: QUANTUM_PAPER_KEY, staticImage: true, tint: 0xffffff, scale: 0.52, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "量子纸灵", dx: 100, dy: 275, textureKey: QUANTUM_PAPER_KEY, staticImage: true, tint: 0xffffff, scale: 0.52, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "纠缠火花", dx: 0, dy: -170, textureKey: QUANTUM_PAPER_KEY, staticImage: true, tint: 0xc7f7ff, scale: 0.5, maxHp: 68, damage: 9, rewardExp: 12, rewardCredits: 1 }
      ]
    },
    {
      title: "区块链系",
      color: 0xf3c75d,
      units: [
        { rank: "rare", label: "链铸重兽稀有精英", dx: -270, dy: 105, textureKey: BLOCKCHAIN_CHAINBEAST_KEY, staticImage: true, tint: 0xffffff, scale: 0.55, maxHp: 300, damage: 17, creditDefense: 5, rewardExp: 46, rewardCredits: 5, dropId: "ch1_drop_chain_forge_core", dropName: "链铸重核" },
        { rank: "elite", label: "重锁精英", dx: 235, dy: 130, textureKey: BLOCKCHAIN_LOCK_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 175, damage: 13, rewardExp: 26, rewardCredits: 3, dropId: "ch1_drop_blockchain_lock", dropName: "验证锁片" },
        { rank: "mob", label: "链爪小怪", dx: -110, dy: 270, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "链爪小怪", dx: 65, dy: 285, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "锁扣小怪", dx: 160, dy: -150, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: true, tint: 0xffe0a6, scale: 0.55, maxHp: 82, damage: 10, rewardExp: 13, rewardCredits: 1 }
      ]
    },
    {
      title: "AI Agent 系",
      color: 0x8f72d6,
      units: [
        { rank: "rare", label: "Agent 协调稀有精英", dx: 270, dy: 105, textureKey: AIAGENT_CYBERMAGE_KEY, staticImage: true, tint: 0xffffff, scale: 0.66, maxHp: 320, damage: 18, creditDefense: 6, rewardExp: 48, rewardCredits: 5, dropId: "ch1_drop_agent_memory_core", dropName: "Agent 记忆核心" },
        { rank: "elite", label: "数字猫精英", dx: -235, dy: 130, textureKey: AIAGENT_DIGITAL_CAT_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 190, damage: 14, rewardExp: 28, rewardCredits: 3, dropId: "ch1_drop_agent_tool_node", dropName: "工具节点" },
        { rank: "mob", label: "工具调用小怪", dx: -135, dy: 275, textureKey: AIAGENT_BOTCAT_KEY, staticImage: true, tint: 0xffffff, scale: 0.58, maxHp: 92, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "记忆碎片", dx: 45, dy: 285, textureKey: AIAGENT_BOTCAT_KEY, staticImage: true, tint: 0xcff7ff, scale: 0.56, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "子任务幽影", dx: -35, dy: -165, textureKey: AIAGENT_BOTCAT_KEY, staticImage: true, tint: 0xd9c3ff, scale: 0.55, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 }
      ]
    }
  ].forEach((wavePatch, index) => Object.assign(BOSS_SUMMON_WAVES[index], wavePatch));

  const app = {
    profile: null,
    authToken: localStorage.getItem(SESSION_KEY) || "",
    offlineMode: false,
    characters: [],
    serverRoom: "zhonghe-plaza",
    game: null,
    scene: null,
    multiplayer: null,
    audio: null,
    selectedCharacterId: "lina",
    boss: { ...BOSS },
    bossRewardClaimed: false,
    chapterOne: { protocolCards: 0, bossCleared: false },
    dialogue: null,
    chat: { messages: [] },
    selectedInventoryItem: null,
    lastHealAt: -Infinity,
    connected: false,
    touchMove: { active: false, dx: 0, dy: 0 }
  };

  const $ = selector => document.querySelector(selector);
  let serverSaveTimer = null;
  let textEntryGuardBound = false;

  function clearChildren(node) {
    while (node?.firstChild) node.removeChild(node.firstChild);
  }

  function isTextEntryTarget(target) {
    if (!target || target === document || target === window) return false;
    const tag = String(target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  function plainObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
  }

  function stringArray(value) {
    return Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [];
  }

  function normalizeInventoryItem(item = {}) {
    const definition = ITEM_CATALOG[String(item.id || "")] || {};
    return {
      ...definition,
      ...item,
      id: String(item.id || definition.id || "unknown_item"),
      name: String(item.name || definition.name || item.id || "未知物品").slice(0, 32),
      type: String(item.type || definition.type || "material"),
      quality: String(item.quality || definition.quality || "common"),
      description: String(item.description || definition.description || "校园探索中获得的物品。").slice(0, 180),
      qty: Math.max(1, Math.floor(Number(item.qty) || 1))
    };
  }

  function addInventoryItem(item = {}) {
    if (!app.profile) return false;
    app.profile.inventory = Array.isArray(app.profile.inventory)
      ? app.profile.inventory.map(normalizeInventoryItem)
      : [];
    const incoming = normalizeInventoryItem(item);
    const existing = app.profile.inventory.find(entry =>
      entry.id === incoming.id && entry.type === incoming.type && entry.quality === incoming.quality
    );
    if (existing) existing.qty += incoming.qty;
    else if (app.profile.inventory.length < INVENTORY_CAPACITY) app.profile.inventory.push(incoming);
    else {
      showToast("背包已满，先整理物品再拾取");
      return false;
    }
    saveProfile(app.profile);
    renderInventory();
    return true;
  }

  function equippedDamageMultiplier() {
    if (!app.profile) return 1;
    const bonus = (Array.isArray(app.profile.equipment) ? app.profile.equipment : [])
      .map(normalizeInventoryItem)
      .reduce((sum, item) => sum + Math.max(0, Number(item.damageBonus) || 0), 0);
    return 1 + bonus;
  }

  function ensureProfileProgress(profile) {
    const previousMaxEnergy = Math.max(1, Number(profile.maxEnergy || ENERGY_DEFAULT_MAX));
    const incomingEnergy = Number(profile.energy ?? previousMaxEnergy);
    profile.maxEnergy = Math.max(ENERGY_DEFAULT_MAX, previousMaxEnergy);
    profile.energy = clamp(incomingEnergy, 0, profile.maxEnergy);
    if (previousMaxEnergy < ENERGY_DEFAULT_MAX && incomingEnergy >= previousMaxEnergy) profile.energy = profile.maxEnergy;
    profile.shield = Math.max(0, Number(profile.shield || 0));
    profile.attackPower = Math.max(1, Number(profile.attackPower || BASE_STATS.attackPower));
    profile.magicPower = Math.max(1, Number(profile.magicPower || BASE_STATS.magicPower));
    profile.chapterId = String(profile.chapterId || "chapter1");
    profile.mapId = String(profile.mapId || "ch1_m01_classroom_spawn");
    profile.spawnId = String(profile.spawnId || "ch1_m01_spawn_player_start");
    profile.characterRecordId = String(profile.characterRecordId || "");
    profile.flags = plainObject(profile.flags);
    if (profile.flags.ch1_m01_cleared) {
      profile.flags.ch1_m01_task_accepted = true;
      profile.flags.ch1_m01_task_turned_in = true;
      profile.flags.ch1_intro_met_professor = true;
    } else if (profile.flags.ch1_intro_met_professor) {
      profile.flags.ch1_m01_task_accepted = true;
    }
    profile.quests = plainObject(profile.quests);
    profile.inventory = Array.isArray(profile.inventory) ? profile.inventory.map(normalizeInventoryItem) : [];
    profile.equipment = Array.isArray(profile.equipment) ? profile.equipment.map(normalizeInventoryItem).slice(0, EQUIPMENT_CAPACITY) : [];
    profile.collections = plainObject(profile.collections);
    profile.collections.protocolCards = stringArray(profile.collections.protocolCards);
    return profile;
  }

  function isTextEntryActive() {
    return isTextEntryTarget(document.activeElement);
  }

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
    if (app.offlineMode && Number(profile.slot) >= 0) {
      const roster = loadLocalRoster();
      const index = roster.findIndex(item => Number(item.slot) === Number(profile.slot));
      if (index >= 0) {
        roster[index] = {
          ...roster[index],
          id: profile.id,
          account: profile.account,
          name: profile.name,
          characterId: profile.characterId,
          slot: profile.slot,
          level: profile.level,
          exp: profile.exp,
          credits: profile.credits,
          maxHp: profile.maxHp,
          hp: profile.hp,
          maxEnergy: profile.maxEnergy,
          energy: profile.energy,
          shield: profile.shield,
          attackPower: profile.attackPower,
          magicPower: profile.magicPower,
          chapterId: profile.chapterId,
          mapId: profile.mapId,
          spawnId: profile.spawnId,
          characterRecordId: profile.characterRecordId,
          flags: plainObject(profile.flags),
          quests: plainObject(profile.quests),
          inventory: Array.isArray(profile.inventory) ? profile.inventory : [],
          equipment: Array.isArray(profile.equipment) ? profile.equipment : [],
          collections: plainObject(profile.collections)
        };
        saveLocalRoster(roster);
        app.characters = roster;
      }
    }
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
    return ensureProfileProgress({
      id: String(profile.id || makeId()),
      account: String(profile.account || profile.username || ""),
      name: String(profile.name || profile.nickname || "同济学术喵").trim().slice(0, 12) || "同济学术喵",
      characterId,
      slot: Number.isFinite(Number(profile.slot)) ? Number(profile.slot) : -1,
      level: Math.max(1, Number(profile.level || BASE_STATS.level)),
      exp: Math.max(0, Number(profile.exp || BASE_STATS.exp)),
      credits: Math.max(0, Number(profile.credits || BASE_STATS.credits)),
      maxHp: Math.max(1, Number(profile.maxHp || BASE_STATS.maxHp)),
      hp: clamp(Number(profile.hp ?? profile.maxHp ?? BASE_STATS.hp), 0, Math.max(1, Number(profile.maxHp || BASE_STATS.maxHp))),
      maxEnergy: profile.maxEnergy,
      energy: profile.energy,
      shield: profile.shield,
      attackPower: profile.attackPower,
      magicPower: profile.magicPower,
      chapterId: profile.chapterId,
      mapId: profile.mapId,
      spawnId: profile.spawnId,
      characterRecordId: profile.characterRecordId,
      flags: profile.flags,
      quests: profile.quests,
      inventory: profile.inventory,
      equipment: profile.equipment,
      collections: profile.collections
    });
  }

  async function apiRequest(path, options = {}) {
    const headers = {
      "content-type": "application/json",
      ...(options.headers || {})
    };
    if (app.authToken) headers.authorization = `Bearer ${app.authToken}`;
    let response;
    try {
      response = await fetch(path, {
        ...options,
        headers,
        body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
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

  const LOCAL_ROSTER_KEY = "efv-local-characters";

  function loadLocalRoster() {
    try {
      const raw = localStorage.getItem(LOCAL_ROSTER_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function saveLocalRoster(list) {
    localStorage.setItem(LOCAL_ROSTER_KEY, JSON.stringify(list));
  }

  async function loginWithPassword(username, password) {
    const data = await apiRequest("/api/login", {
      method: "POST",
      body: { username, password }
    });
    app.offlineMode = false;
    setSession(data.token);
    app.characters = Array.isArray(data.characters) ? data.characters : [];
    return normalizeProfile(data.profile);
  }

  async function registerAccount(username, nickname, password) {
    return apiRequest("/api/register", {
      method: "POST",
      body: { username, nickname, password }
    });
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

  const CHARACTER_SLOT_LIMIT = 5;

  // 以广场中央猫爪图案（约 35%, 77%）为中心环绕，收在广场地砖范围内，
  // 避开台阶（y<70）和左侧背景里的猫（x<24）
  const WAREHOUSE_SPOTS = [
    { x: 36, y: 70 },
    { x: 47, y: 77 },
    { x: 43, y: 89 },
    { x: 28, y: 89 },
    { x: 25, y: 77 }
  ];

  const CREATABLE_CHARACTERS = [
    {
      id: "lina",
      role: "召唤协同 · SUM-SPIRIT",
      desc: "校园风魔法少女，法杖书签随身、学风精灵伴飞。性格温柔善良还有点天然呆，猫形态是一只白色长毛猫，最擅长图鉴收集与地标互动。",
      quote: "「大家好喵~我是莉娜，请多指教哦~」"
    },
    {
      id: "ayu",
      role: "敏捷突击 · DPS-STRIKE",
      desc: "校园风光剑士，同济蓝护腕配光剑激光笔。勇敢热血、值得信赖，猫形态是一只狸花猫，擅长快速跑图与追击脱战。",
      quote: "「我是阿宇！立志成为同济最强的剑士喵！」"
    }
  ];

  const spriteAnimator = {
    timer: null,
    frame: 0,
    start() {
      if (this.timer) return;
      this.timer = window.setInterval(() => {
        this.frame = (this.frame + 1) % 4;
        document.querySelectorAll(".sprite-anim").forEach(el => {
          const size = Number(el.dataset.frame) || 128;
          el.style.backgroundPosition = `${-this.frame * size}px 0px`;
        });
      }, 190);
    }
  };

  function setupSpriteAnim(el, character, size) {
    el.dataset.frame = String(size);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.backgroundImage = `url("${character.sprite}")`;
    el.style.backgroundSize = `${size * 8}px ${size * 8}px`;
    el.style.backgroundPosition = "0px 0px";
    spriteAnimator.start();
  }

  function showStage(name) {
    ["auth", "server", "warehouse", "create", "entryLoading"].forEach(stage => {
      const node = $(`#${stage}Stage`);
      if (node) node.hidden = stage !== name;
    });
    $("#startOverlay").classList.remove("hidden");
  }

  function setActivePlazaSlot(target) {
    document.querySelectorAll(".plaza-slot.active").forEach(node => {
      if (node !== target) node.classList.remove("active");
    });
    target.classList.add("active");
  }

  function renderWarehouse() {
    const plaza = $("#warehousePlaza");
    if (!plaza) return;
    plaza.innerHTML = "";
    const bySlot = new Map((app.characters || []).map(item => [Number(item.slot), item]));
    for (let slot = 0; slot < CHARACTER_SLOT_LIMIT; slot += 1) {
      const spot = WAREHOUSE_SPOTS[slot];
      const entry = bySlot.get(slot);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `plaza-slot ${entry ? "filled" : "empty"}`;
      button.style.left = `${spot.x}%`;
      button.style.top = `${spot.y}%`;
      if (entry) {
        const stand = document.createElement("div");
        stand.className = "sprite-stand";
        const shadow = document.createElement("i");
        shadow.className = "sprite-shadow";
        const sprite = document.createElement("div");
        sprite.className = "sprite-anim";
        setupSpriteAnim(sprite, getCharacter(entry.characterId), 128);
        stand.append(shadow, sprite);
        const label = document.createElement("span");
        label.className = "slot-name";
        label.textContent = `${entry.name} · Lv.${entry.level || 1}`;
        const remove = document.createElement("span");
        remove.className = "slot-delete";
        remove.textContent = "\u00d7";
        remove.title = "删除角色";
        remove.setAttribute("role", "button");
        remove.addEventListener("click", event => {
          event.stopPropagation();
          openDeleteDialog(entry);
        });
        button.append(stand, label, remove);
        button.addEventListener("pointerenter", () => setActivePlazaSlot(button));
        button.addEventListener("click", () => {
          if (!button.classList.contains("active")) {
            setActivePlazaSlot(button);
            return;
          }
          enterWithSlot(slot);
        });
      } else {
        const plus = document.createElement("span");
        plus.className = "slot-plus";
        plus.textContent = "+";
        const label = document.createElement("span");
        label.className = "slot-name";
        label.textContent = "创建角色";
        button.append(plus, label);
        button.addEventListener("click", () => openCreateStage());
      }
      plaza.appendChild(button);
    }
    $("#warehouseHint").textContent = bySlot.size ? "" : "还没有角色，点击 + 创建第一个学术喵";
  }

  async function enterWithSlot(slot) {
    const hint = $("#warehouseHint");
    hint.textContent = "正在进入校园...";
    try {
      let profile;
      if (app.offlineMode) {
        const entry = (app.characters || []).find(item => Number(item.slot) === slot);
        if (!entry) throw new Error("角色不存在。");
        profile = normalizeProfile({ ...entry, account: "local-guest", slot });
        if (profile.hp <= 0) profile.hp = profile.maxHp;
      } else {
        const data = await apiRequest("/api/characters/select", {
          method: "POST",
          body: { slot }
        });
        profile = normalizeProfile(data.profile);
      }
      hint.textContent = "";
      startGame(profile);
    } catch (error) {
      hint.textContent = error.message || "进入失败，请重试。";
    }
  }

  let pendingDeleteSlot = -1;

  function openDeleteDialog(entry) {
    pendingDeleteSlot = Number(entry.slot);
    $("#deleteDialogText").textContent = `确定要删除「${entry.name} · Lv.${entry.level || 1}」吗？角色的等级和进度将无法找回。`;
    $("#deleteDialog").hidden = false;
  }

  function closeDeleteDialog() {
    pendingDeleteSlot = -1;
    $("#deleteDialog").hidden = true;
  }

  async function confirmDeleteCharacter() {
    if (pendingDeleteSlot < 0) return;
    const slot = pendingDeleteSlot;
    const button = $("#deleteConfirmButton");
    button.disabled = true;
    try {
      if (app.offlineMode) {
        const roster = loadLocalRoster().filter(item => Number(item.slot) !== slot);
        saveLocalRoster(roster);
        app.characters = roster;
      } else {
        const data = await apiRequest("/api/characters/delete", {
          method: "POST",
          body: { slot }
        });
        app.characters = Array.isArray(data.characters) ? data.characters : [];
      }
      closeDeleteDialog();
      renderWarehouse();
    } catch (error) {
      $("#warehouseHint").textContent = error.message || "删除失败，请重试。";
      closeDeleteDialog();
    } finally {
      button.disabled = false;
    }
  }

  let createIndex = 0;

  function renderCreateStage() {
    const meta = CREATABLE_CHARACTERS[createIndex];
    const character = getCharacter(meta.id);
    setupSpriteAnim($("#createSprite"), character, 200);
    $("#createName").textContent = character.name;
    $("#createRole").textContent = meta.role;
    $("#createDesc").textContent = meta.desc;
    $("#createQuote").textContent = meta.quote;
    $("#createHint").textContent = "";
    document.documentElement.style.setProperty("--character", character.color);
  }

  function openCreateStage() {
    renderCreateStage();
    showStage("create");
  }

  async function confirmCreateCharacter() {
    const meta = CREATABLE_CHARACTERS[createIndex];
    const button = $("#createConfirmButton");
    button.disabled = true;
    $("#createHint").textContent = "正在创建角色...";
    try {
      if (app.offlineMode) {
        const roster = loadLocalRoster();
        const used = new Set(roster.map(item => Number(item.slot)));
        if (used.size >= CHARACTER_SLOT_LIMIT) throw new Error(`角色仓库已满（最多 ${CHARACTER_SLOT_LIMIT} 个角色）。`);
        let slot = 0;
        while (used.has(slot)) slot += 1;
        roster.push({
          id: makeId(),
          account: "local-guest",
          slot,
          characterId: meta.id,
          name: getCharacter(meta.id).name,
          ...BASE_STATS,
          chapterId: "chapter1",
          mapId: "ch1_m01_classroom_spawn",
          spawnId: "ch1_m01_spawn_player_start",
          flags: {},
          quests: {},
          inventory: [],
          equipment: [],
          collections: { protocolCards: [] }
        });
        saveLocalRoster(roster);
        app.characters = roster;
      } else {
        const data = await apiRequest("/api/characters/create", {
          method: "POST",
          body: { characterId: meta.id }
        });
        app.characters = Array.isArray(data.characters) ? data.characters : [];
      }
      renderWarehouse();
      showStage("warehouse");
    } catch (error) {
      $("#createHint").textContent = error.message || "创建失败，请重试。";
    } finally {
      button.disabled = false;
    }
  }

  async function enterServer() {
    app.serverRoom = $("#serverSelect").value || "zhonghe-plaza";
    const hint = $("#serverHint");
    hint.textContent = "正在读取角色仓库...";
    try {
      if (app.offlineMode) {
        app.characters = loadLocalRoster();
      } else {
        const data = await apiRequest("/api/characters");
        app.characters = Array.isArray(data.characters) ? data.characters : [];
      }
      hint.textContent = "";
      renderWarehouse();
      showStage("warehouse");
    } catch (error) {
      hint.textContent = error.message || "读取失败，请重试。";
    }
  }

  function getSkillDefinition(skillId) {
    const characterId = app.profile?.characterId || "lina";
    return SKILL_DEFINITIONS[characterId]?.[skillId] || SKILL_DEFINITIONS.lina[skillId];
  }

  function renderSkillButtons() {
    document.querySelectorAll(".skill[data-skill-id]").forEach(button => {
      const definition = getSkillDefinition(button.dataset.skillId);
      if (!definition) return;
      const shortcut = button.querySelector("small");
      if (shortcut) shortcut.textContent = definition.key;
      button.setAttribute("aria-label", `${definition.name}，快捷键 ${definition.key}`);
    });
  }

  function hideSkillTooltip(force = false) {
    if (app.skillTooltipPinned && !force) return;
    app.skillTooltipPinned = false;
    const tooltip = $("#skillTooltip");
    if (!tooltip) return;
    tooltip.classList.remove("open");
    tooltip.setAttribute("aria-hidden", "true");
  }

  function showSkillTooltip(button, pinned = false) {
    const tooltip = $("#skillTooltip");
    const stage = $(".game-stage");
    const definition = getSkillDefinition(button?.dataset.skillId);
    if (!tooltip || !stage || !button || !definition) return;
    clearChildren(tooltip);
    const title = document.createElement("strong");
    title.textContent = `${definition.name} · ${definition.key}`;
    const description = document.createElement("p");
    description.textContent = definition.description;
    tooltip.append(title, description);
    tooltip.classList.add("open");
    tooltip.setAttribute("aria-hidden", "false");
    app.skillTooltipPinned = !!pinned;

    const stageRect = stage.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const left = clamp(buttonRect.left - stageRect.left, 8, Math.max(8, stageRect.width - tooltipRect.width - 8));
    const preferredTop = buttonRect.bottom - stageRect.top + 8;
    const top = preferredTop + tooltipRect.height <= stageRect.height - 8
      ? preferredTop
      : Math.max(8, buttonRect.top - stageRect.top - tooltipRect.height - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function itemIconPath(item) {
    return item?.type === "equipment"
      ? WORLD_DROP_EQUIPMENT_IMAGE
      : WORLD_DROP_MATERIAL_IMAGE;
  }

  function makeInventorySlot(item, source, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `inventory-slot${item ? "" : " empty"}`;
    if (!item) {
      button.disabled = true;
      button.setAttribute("aria-label", "空物品格");
      return button;
    }
    const normalized = normalizeInventoryItem(item);
    button.dataset.quality = normalized.quality;
    button.dataset.source = source;
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `${normalized.name}，数量 ${normalized.qty}`);
    const selected = app.selectedInventoryItem?.source === source && app.selectedInventoryItem?.index === index;
    button.setAttribute("aria-pressed", String(selected));
    const icon = document.createElement("img");
    icon.src = itemIconPath(normalized);
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    const quantity = document.createElement("b");
    quantity.textContent = normalized.qty > 1 ? String(normalized.qty) : "";
    button.append(icon, quantity);
    button.addEventListener("click", () => {
      app.selectedInventoryItem = { source, index };
      renderInventory();
    });
    return button;
  }

  function getSelectedInventoryItem() {
    if (!app.profile || !app.selectedInventoryItem) return null;
    const { source, index } = app.selectedInventoryItem;
    const list = source === "equipment" ? app.profile.equipment : app.profile.inventory;
    const item = Array.isArray(list) ? list[index] : null;
    return item ? { item: normalizeInventoryItem(item), source, index } : null;
  }

  function renderInventoryDetail() {
    const detail = $("#inventoryDetail");
    const selected = getSelectedInventoryItem();
    if (!detail) return;
    detail.hidden = !selected;
    if (!selected) return;
    $("#inventoryDetailName").textContent = selected.item.name;
    $("#inventoryDetailText").textContent = selected.item.description;
    const action = $("#inventoryActionButton");
    const canEquip = selected.source === "inventory" && selected.item.type === "equipment";
    const canUnequip = selected.source === "equipment";
    action.hidden = !(canEquip || canUnequip);
    action.textContent = canUnequip ? "卸下" : "装备";
  }

  function renderInventory() {
    if (!app.profile) return;
    app.profile.inventory = Array.isArray(app.profile.inventory) ? app.profile.inventory.map(normalizeInventoryItem) : [];
    app.profile.equipment = Array.isArray(app.profile.equipment) ? app.profile.equipment.map(normalizeInventoryItem).slice(0, EQUIPMENT_CAPACITY) : [];
    const inventoryGrid = $("#inventoryGrid");
    const equipmentGrid = $("#equipmentGrid");
    if (!inventoryGrid || !equipmentGrid) return;
    clearChildren(inventoryGrid);
    clearChildren(equipmentGrid);
    for (let index = 0; index < EQUIPMENT_CAPACITY; index += 1) {
      equipmentGrid.appendChild(makeInventorySlot(app.profile.equipment[index] || null, "equipment", index));
    }
    for (let index = 0; index < INVENTORY_CAPACITY; index += 1) {
      inventoryGrid.appendChild(makeInventorySlot(app.profile.inventory[index] || null, "inventory", index));
    }
    $("#equipmentCount").textContent = `${app.profile.equipment.length} / ${EQUIPMENT_CAPACITY}`;
    $("#inventoryCount").textContent = `${app.profile.inventory.length} / ${INVENTORY_CAPACITY}`;
    renderInventoryDetail();
  }

  function setInventoryOpen(open) {
    const panel = $("#inventoryPanel");
    const button = $("#inventoryToggleButton");
    if (!panel) return;
    panel.classList.toggle("collapsed", !open);
    panel.setAttribute("aria-hidden", String(!open));
    button?.setAttribute("aria-pressed", String(open));
    if (open) renderInventory();
    else app.selectedInventoryItem = null;
  }

  function toggleSelectedInventoryItem() {
    const selected = getSelectedInventoryItem();
    if (!selected || !app.profile) return;
    if (selected.source === "inventory") {
      if (selected.item.type !== "equipment") return;
      if (app.profile.equipment.length >= EQUIPMENT_CAPACITY) {
        showToast("增益栏已满");
        return;
      }
      const inventoryItem = app.profile.inventory[selected.index];
      app.profile.equipment.push({ ...selected.item, qty: 1, instanceId: makeId() });
      inventoryItem.qty -= 1;
      if (inventoryItem.qty <= 0) app.profile.inventory.splice(selected.index, 1);
      showToast(`已装备：${selected.item.name}`);
    } else {
      const [equipmentItem] = app.profile.equipment.splice(selected.index, 1);
      addInventoryItem({ ...equipmentItem, qty: 1 });
      showToast(`已卸下：${selected.item.name}`);
    }
    app.selectedInventoryItem = null;
    saveProfile(app.profile);
    renderInventory();
  }

  function renderHud() {
    if (!app.profile) return;
    $("#hudName").textContent = app.profile.name;
    renderSkillButtons();
    $("#levelText").textContent = `Lv.${app.profile.level}`;
    $("#creditText").textContent = `学分 ${app.profile.credits}`;
    $("#expText").textContent = `EXP ${app.profile.exp}`;
    const hpRatio = clamp(app.profile.hp / app.profile.maxHp, 0, 1);
    $("#hpBar").style.width = `${Math.round(hpRatio * 100)}%`;
    const shieldText = app.profile.shield > 0 ? ` +${Math.ceil(app.profile.shield)}盾` : "";
    $("#hpText").textContent = `${Math.max(0, Math.ceil(app.profile.hp))} / ${app.profile.maxHp}${shieldText}`;
    const maxEnergy = Math.max(1, Number(app.profile.maxEnergy || ENERGY_DEFAULT_MAX));
    const energy = clamp(Number(app.profile.energy ?? maxEnergy), 0, maxEnergy);
    const energyBar = $("#energyBar");
    const energyText = $("#energyText");
    if (energyBar) energyBar.style.width = `${Math.round(energy / maxEnergy * 100)}%`;
    if (energyText) energyText.textContent = `${Math.round(energy)} / ${Math.round(maxEnergy)}`;
    renderChapterHud();
    saveProfile(app.profile);
  }

  function renderNetwork(status, online = false) {
    const node = $("#networkStatus");
    node.textContent = status;
    node.classList.toggle("online", online);
    node.classList.toggle("offline", !online);
  }

  function chapterStateKey() {
    return `${CHAPTER_ONE_KEY}:${app.profile?.id || "guest"}`;
  }

  function profileFlags() {
    if (!app.profile) return {};
    app.profile.flags = plainObject(app.profile.flags);
    return app.profile.flags;
  }

  function hasFlag(flag) {
    return !!flag && !!profileFlags()[flag];
  }

  function setFlag(flag, value = true) {
    if (!flag || !app.profile) return;
    profileFlags()[flag] = !!value;
  }

  function getProtocolCardIds() {
    if (!app.profile) return [];
    app.profile.collections = plainObject(app.profile.collections);
    app.profile.collections.protocolCards = stringArray(app.profile.collections.protocolCards);
    return app.profile.collections.protocolCards;
  }

  function syncChapterStateFromProfile() {
    const cards = getProtocolCardIds();
    app.chapterOne = {
      protocolCards: cards.length,
      bossCleared: hasFlag("ch1_final_boss_defeated") || hasFlag("ch1_complete")
    };
  }

  function loadChapterState() {
    if (!app.profile) return { protocolCards: 0, bossCleared: false };
    try {
      const raw = localStorage.getItem(chapterStateKey());
      const data = raw ? JSON.parse(raw) : {};
      const cards = getProtocolCardIds();
      while (cards.length < clamp(Number(data.protocolCards || 0), 0, CHAPTER_ONE_PROTOCOL_CARD_GOAL)) {
        const fallbackId = Object.keys(CHAPTER_ONE_CARD_NAMES)[cards.length] || `ch1_card_legacy_${cards.length + 1}`;
        if (!cards.includes(fallbackId)) cards.push(fallbackId);
        else break;
      }
      if (data.bossCleared) setFlag("ch1_final_boss_defeated");
      syncChapterStateFromProfile();
      return app.chapterOne;
    } catch {
      syncChapterStateFromProfile();
      return app.chapterOne;
    }
  }

  function saveChapterState() {
    if (!app.profile) return;
    syncChapterStateFromProfile();
    localStorage.setItem(chapterStateKey(), JSON.stringify(app.chapterOne));
    saveProfile(app.profile);
  }

  function getChapterTasks() {
    if (!hasFlag("ch1_m01_task_accepted")) {
      return [{ label: "教室：与陆教授交谈并接受任务", done: false }];
    }
    const classroomTasks = [
      { label: "教室：接受陆教授的任务", done: true },
      { label: "教室：检查课程协议板", done: hasFlag("ch1_intro_read_syllabus") },
      { label: "教室：从讲台领取协议卡", done: hasFlag("ch1_intro_card_claimed") },
      { label: "教室：清理错乱笔记堆", done: hasFlag("ch1_m01_bug_notes_cleared") },
      { label: "教室：返回陆教授处交付任务", done: hasFlag("ch1_m01_task_turned_in") }
    ];
    if (!hasFlag("ch1_m01_task_turned_in")) return classroomTasks;
    return [
      ...classroomTasks,
      { label: "资料室：修复引用链", done: hasFlag("ch1_m02_copy_shadow_cleared") },
      { label: "机房：完成路演压力测试", done: hasFlag("ch1_m03_small_boss_cleared") },
      { label: `收集 ${CHAPTER_ONE_PROTOCOL_CARD_GOAL} 张协议卡`, done: getProtocolCardIds().length >= CHAPTER_ONE_PROTOCOL_CARD_GOAL },
      { label: "开启陆教授 Boss 宝箱", done: !!app.chapterOne.bossCleared }
    ];
  }

  function renderChapterHud() {
    const list = $("#chapterTaskList");
    if (!list) return;
    syncChapterStateFromProfile();
    clearChildren(list);
    getChapterTasks().forEach(task => {
      const item = document.createElement("div");
      item.className = `chapter-task${task.done ? " done" : ""}`;
      const dot = document.createElement("i");
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = task.label;
      item.append(dot, label);
      list.appendChild(item);
    });
    const count = clamp(Number(app.chapterOne.protocolCards || 0), 0, CHAPTER_ONE_PROTOCOL_CARD_GOAL);
    const ratio = CHAPTER_ONE_PROTOCOL_CARD_GOAL ? count / CHAPTER_ONE_PROTOCOL_CARD_GOAL : 0;
    const protocolRow = $(".protocol-card-row");
    if (protocolRow) protocolRow.hidden = !hasFlag("ch1_m01_task_accepted");
    $("#protocolCardText").textContent = `${count} / ${CHAPTER_ONE_PROTOCOL_CARD_GOAL}`;
    $("#protocolCardBar").style.width = `${Math.round(ratio * 100)}%`;
  }

  function collectProtocolCard(cardId = "") {
    const cards = getProtocolCardIds();
    const fallbackIds = Object.keys(CHAPTER_ONE_CARD_NAMES);
    const finalId = cardId || fallbackIds[cards.length] || `ch1_card_runtime_${cards.length + 1}`;
    if (cards.includes(finalId)) return false;
    if (cards.length >= CHAPTER_ONE_PROTOCOL_CARD_GOAL && !CHAPTER_ONE_CARD_NAMES[finalId]) return false;
    cards.push(finalId);
    setFlag(`${finalId}_collected`);
    saveChapterState();
    renderChapterHud();
    return true;
  }

  function grantExperience(amount = 0) {
    if (!app.profile) return 0;
    let gainedLevels = 0;
    app.profile.exp = Math.max(0, Number(app.profile.exp || 0) + Math.max(0, Number(amount) || 0));
    while (app.profile.exp >= 100) {
      app.profile.exp -= 100;
      app.profile.level += 1;
      app.profile.maxHp += 18;
      app.profile.hp = app.profile.maxHp;
      app.profile.attackPower = Math.max(1, Number(app.profile.attackPower || BASE_STATS.attackPower) + 3);
      app.profile.magicPower = Math.max(1, Number(app.profile.magicPower || BASE_STATS.magicPower) + 3);
      gainedLevels += 1;
    }
    return gainedLevels;
  }

  function markChapterBossCleared() {
    setFlag("ch1_final_boss_defeated");
    setFlag("ch1_complete");
    saveChapterState();
    renderChapterHud();
  }

  function normalizeChatText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, CHAT_TEXT_LIMIT);
  }

  function chatTime(value) {
    const date = new Date(Number(value) || Date.now());
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }

  function normalizeChatEntry(entry = {}, variant = "message") {
    const player = entry.player || {};
    const playerId = String(entry.playerId || entry.senderId || player.id || "");
    return {
      id: String(entry.id || makeId()),
      playerId,
      name: String(entry.name || entry.sender || player.name || (variant === "system" ? "系统" : "同学")).slice(0, 16),
      text: normalizeChatText(entry.text || entry.message || ""),
      createdAt: Number(entry.createdAt || entry.time || Date.now()),
      variant,
      self: !!playerId && !!app.profile?.id && playerId === app.profile.id
    };
  }

  function appendChatEntry(entry) {
    const list = $("#chatMessages");
    if (!list || !entry.text) return;
    if (entry.id && app.chat.messages.some(message => message.id === entry.id)) return;
    app.chat.messages.push(entry);
    if (app.chat.messages.length > CHAT_HISTORY_LIMIT) app.chat.messages.shift();

    const line = document.createElement("article");
    line.className = `chat-line ${entry.variant || "message"}${entry.self ? " self" : ""}`;

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    const name = document.createElement("span");
    name.className = "chat-name";
    name.textContent = entry.self ? "我" : entry.name;
    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = chatTime(entry.createdAt);
    meta.append(name, time);

    const text = document.createElement("p");
    text.className = "chat-text";
    text.textContent = entry.text;
    line.append(meta, text);
    list.appendChild(line);
    while (list.childElementCount > CHAT_HISTORY_LIMIT) list.removeChild(list.firstElementChild);
    list.scrollTop = list.scrollHeight;
  }

  function renderChatHistory(entries) {
    const list = $("#chatMessages");
    if (!list) return;
    app.chat.messages = [];
    clearChildren(list);
    (Array.isArray(entries) ? entries : []).slice(-CHAT_HISTORY_LIMIT).forEach(entry => {
      appendChatEntry(normalizeChatEntry(entry));
    });
  }

  function renderChatSystem(text) {
    appendChatEntry(normalizeChatEntry({ text, name: "系统" }, "system"));
  }

  function renderChatError(text) {
    appendChatEntry(normalizeChatEntry({ text: text || "公共频道暂时不可用", name: "系统" }, "error"));
  }

  function renderInteractionPrompt(text = "") {
    const node = $("#interactionPrompt");
    if (!node) return;
    if (node.dataset.text === text) return;
    node.dataset.text = text;
    node.textContent = text;
    node.classList.toggle("open", !!text);
    node.setAttribute("aria-hidden", String(!text));
  }

  function handleChatMessage(payload) {
    const entry = payload?.chat || payload?.message || payload;
    appendChatEntry(normalizeChatEntry(typeof entry === "string" ? { text: entry } : entry));
  }

  function updateChatControls() {
    const button = $("#chatSendButton");
    if (button) button.disabled = !app.profile;
  }

  function returnToGameFromChat() {
    const input = $("#chatInput");
    input?.blur();
    const root = $("#gameRoot");
    if (root) {
      root.tabIndex = -1;
      root.focus({ preventScroll: true });
    }
  }

  function submitChat() {
    const input = $("#chatInput");
    if (!input) return;
    const text = normalizeChatText(input.value);
    if (!text) {
      returnToGameFromChat();
      return;
    }
    if (!app.profile) {
      renderChatError("请先进入角色后再发送公共频道消息。");
      return;
    }
    const sent = app.connected ? app.multiplayer?.sendChat(text) : null;
    if (!sent) {
      renderChatError("公共频道未连接，消息未发送。");
      return;
    }
    input.value = "";
    returnToGameFromChat();
  }

  function resetChat() {
    app.chat.messages = [];
    clearChildren($("#chatMessages"));
    renderChatSystem("欢迎来到同舟星愿公共频道。");
    updateChatControls();
  }

  function renderPeers(peers) {
    const list = $("#peerList");
    const values = Array.from(peers.values());
    clearChildren(list);
    const entries = values.length
      ? values
      : [{ name: "等待同学加入同一房间", characterId: "", status: "0 online" }];
    entries.forEach(peer => {
      const row = document.createElement("div");
      row.className = "peer";
      const name = document.createElement("span");
      name.textContent = String(peer.name || "同学").slice(0, 16);
      const role = document.createElement("b");
      role.textContent = peer.status || getCharacter(peer.characterId).name;
      row.append(name, role);
      list.appendChild(row);
    });
  }

  function renderBossHud() {
    const panel = $("#bossPanel");
    panel.classList.toggle("open", !!app.boss.active);
    panel.setAttribute("aria-hidden", String(!app.boss.active));
    const ratio = clamp(app.boss.hp / app.boss.maxHp, 0, 1);
    $("#bossHpBar").style.width = `${Math.round(ratio * 100)}%`;
    const wave = Number(app.boss.waveIndex || 0) + 1;
    const total = Number(app.boss.wavesTotal || BOSS_SUMMON_WAVES.length);
    $("#bossHpText").textContent = app.boss.active
      ? `第 ${wave}/${total} 波 ${Math.max(0, Math.ceil(app.boss.hp))} / ${app.boss.maxHp}`
      : `${Math.max(0, Math.ceil(app.boss.hp))} / ${app.boss.maxHp}`;
  }

  function setPanelCollapsed(panelId, collapsed) {
    const panel = $(`#${panelId}`);
    const button = document.querySelector(`[data-panel-toggle="${panelId}"]`);
    if (!panel) return;
    panel.classList.toggle("collapsed", !!collapsed);
    panel.setAttribute("aria-expanded", String(!collapsed));
    if (button) button.setAttribute("aria-pressed", String(!collapsed));
  }

  function initializeHudPanels() {
    setPanelCollapsed("chapterHud", true);
    const compact = window.matchMedia("(max-width: 760px)").matches;
    setPanelCollapsed("publicChat", compact);
    setPanelCollapsed("minimapPanel", compact);
    setInventoryOpen(false);
  }

  function bindPanelToggles() {
    document.querySelectorAll("[data-panel-toggle]").forEach(button => {
      button.addEventListener("click", () => {
        const panelId = button.getAttribute("data-panel-toggle");
        const panel = panelId ? $(`#${panelId}`) : null;
        if (!panel) return;
        const opening = panel.classList.contains("collapsed");
        if (opening && window.matchMedia("(max-width: 760px)").matches) {
          ["chapterHud", "publicChat", "minimapPanel"]
            .filter(id => id !== panelId)
            .forEach(id => setPanelCollapsed(id, true));
        }
        setPanelCollapsed(panelId, !opening);
      });
    });
    const compactQuery = window.matchMedia("(max-width: 760px)");
    compactQuery.addEventListener?.("change", event => {
      if (event.matches) setPanelCollapsed("minimapPanel", true);
    });
  }

  function minimapFlagsMet(flags = []) {
    return (Array.isArray(flags) ? flags : []).every(flag => hasFlag(flag));
  }

  function minimapDoneByFlags(flags = []) {
    const list = Array.isArray(flags) ? flags : [];
    return list.length > 0 && list.every(flag => hasFlag(flag));
  }

  function minimapEncounterDone(scene, encounterId) {
    return !!scene?.getEncounter?.(encounterId)?.setFlagsOnClear?.some(flag => hasFlag(flag));
  }

  function collectMinimapMarkers(scene) {
    if (!scene?.mapData) return [];
    const markers = [];
    (scene.mapData.interactionNodes || []).forEach(node => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      if (node.hideUntilUnlocked && !minimapFlagsMet(node.requiresFlags)) return;
      if (node.type === "teleport") {
        markers.push({
          type: "exit",
          x: node.x,
          y: node.y,
          label: node.label || "出口",
          locked: !minimapFlagsMet(node.requiresFlags),
          done: minimapDoneByFlags(node.setFlags)
        });
        return;
      }
      if (node.type === "spawn") {
        const done = minimapEncounterDone(scene, node.spawnEncounterId);
        markers.push({
          type: "battle",
          x: node.x,
          y: node.y,
          label: node.label || "战斗",
          locked: !minimapFlagsMet(node.requiresFlags),
          done
        });
        return;
      }
      markers.push({
        type: "task",
        x: node.x,
        y: node.y,
        label: node.label || "任务",
        locked: !minimapFlagsMet(node.requiresFlags),
        done: hasFlag(`${node.id}_done`) || minimapDoneByFlags(node.setFlags)
      });
    });
    (scene.mapData.exitPoints || []).forEach(point => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      markers.push({
        type: "exit",
        x: point.x,
        y: point.y,
        label: "出口",
        locked: !minimapFlagsMet(point.requiresFlags),
        done: minimapDoneByFlags(point.setFlags)
      });
    });
    (scene.mapData.enemySpawns || []).forEach(point => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      if (point.activeAfter && !hasFlag(point.activeAfter)) return;
      if (point.group && minimapEncounterDone(scene, point.group)) return;
      markers.push({
        type: "battle",
        x: point.x,
        y: point.y,
        label: "小怪",
        locked: !!point.activeAfter && !hasFlag(point.activeAfter),
        done: false
      });
    });
    (scene.leafSlimes?.getChildren?.() || []).forEach(slime => {
      if (!slime?.active || slime.state === "dead" || slime.state === "vanish") return;
      markers.push({
        type: "battle",
        x: slime.x,
        y: slime.y,
        label: slime.displayLabel || "敌人",
        locked: false,
        done: false
      });
    });
    if (app.boss.active && app.boss.hp > 0) {
      markers.push({ type: "boss", x: app.boss.x, y: app.boss.y, label: "教授考核", locked: false, done: false });
    } else if (scene.mapData.chapterBossPoint && !hasFlag("ch1_final_boss_defeated")) {
      const point = scene.mapData.chapterBossPoint;
      markers.push({
        type: "boss",
        x: point.x,
        y: point.y,
        label: "教授考核",
        locked: !minimapFlagsMet(point.requiresFlags),
        done: false
      });
    }
    if (scene.bossChest?.visible) {
      markers.push({ type: "chest", x: scene.bossChest.x, y: scene.bossChest.y, label: "Boss宝箱", locked: false, done: false });
    }
    return markers;
  }

  function drawMinimapMarker(ctx, x, y, marker) {
    const color = marker.done ? MINIMAP_COLORS.done : (MINIMAP_COLORS[marker.type] || MINIMAP_COLORS.task);
    const radius = marker.type === "player" ? 5 : marker.type === "boss" ? 5 : 4;
    ctx.save();
    ctx.globalAlpha = marker.done ? 0.55 : marker.locked ? 0.72 : 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = marker.locked ? MINIMAP_COLORS.locked : "rgba(255,255,255,.9)";
    ctx.lineWidth = marker.type === "player" ? 2.2 : 1.6;
    ctx.beginPath();
    if (marker.type === "exit") {
      ctx.rect(x - radius, y - radius, radius * 2, radius * 2);
    } else if (marker.type === "chest") {
      ctx.roundRect?.(x - 5, y - 3.5, 10, 7, 2);
      if (!ctx.roundRect) ctx.rect(x - 5, y - 3.5, 10, 7);
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    if (marker.type === "boss" && !marker.done) {
      ctx.strokeStyle = "rgba(243,199,93,.42)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderMinimap(scene = app.scene) {
    const canvas = $("#minimapCanvas");
    if (!canvas || !scene?.worldWidth || !scene?.worldHeight) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const pad = 9;
    const scale = Math.min((width - pad * 2) / scene.worldWidth, (height - pad * 2) / scene.worldHeight);
    const offsetX = (width - scene.worldWidth * scale) / 2;
    const offsetY = (height - scene.worldHeight * scale) / 2;
    const mapX = value => offsetX + value * scale;
    const mapY = value => offsetY + value * scale;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(51, 67, 64, .16)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(244, 226, 196, .92)";
    ctx.fillRect(offsetX, offsetY, scene.worldWidth * scale, scene.worldHeight * scale);

    const minimapImageKey = scene.mapData?.minimapImage?.key || scene.mapData?.background?.key || "";
    if (minimapImageKey && scene.textures?.exists(minimapImageKey)) {
      const sourceImage = scene.textures.get(minimapImageKey)?.getSourceImage?.();
      if (sourceImage) {
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.drawImage(sourceImage, offsetX, offsetY, scene.worldWidth * scale, scene.worldHeight * scale);
        ctx.restore();
      }
    }

    ctx.fillStyle = "rgba(89, 121, 73, .22)";
    (scene.mapData?.props || []).forEach(prop => {
      if (!Number.isFinite(prop.x) || !Number.isFinite(prop.y)) return;
      const size = clamp((prop.scale || 1) * 6, 3, 10);
      ctx.fillRect(mapX(prop.x) - size / 2, mapY(prop.y) - size / 2, size, size);
    });

    ctx.fillStyle = "rgba(66, 51, 44, .24)";
    (scene.mapData?.obstacles || []).forEach(item => {
      ctx.fillRect(mapX(item.x), mapY(item.y), Math.max(1, item.w * scale), Math.max(1, item.h * scale));
    });

    const cam = scene.cameras?.main;
    if (cam) {
      ctx.strokeStyle = "rgba(45, 145, 166, .36)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mapX(cam.scrollX), mapY(cam.scrollY), cam.width * scale, cam.height * scale);
    }

    collectMinimapMarkers(scene).forEach(marker => drawMinimapMarker(ctx, mapX(marker.x), mapY(marker.y), marker));
    if (scene.actor) drawMinimapMarker(ctx, mapX(scene.actor.x), mapY(scene.actor.y), { type: "player" });

    const status = $("#minimapStatus");
    if (status) {
      status.textContent = hasFlag("ch1_complete")
        ? "章节完成"
        : app.boss.active
          ? "教授考核中"
          : "任务导航";
    }
  }

  let toastTimer = null;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function renderStoryDialogueLine() {
    const state = app.dialogue;
    if (!state) return;
    const index = clamp(Number(state.index) || 0, 0, state.lines.length - 1);
    $("#storyDialogueEyebrow").textContent = state.eyebrow;
    $("#storyDialogueSpeaker").textContent = state.speaker;
    $("#storyDialogueText").textContent = state.lines[index];
    $("#storyDialogueProgress").textContent = `${index + 1} / ${state.lines.length}`;
    $("#storyDialogueNextButton").textContent = index === state.lines.length - 1 ? state.finalLabel : "继续";
  }

  function closeStoryDialogue(completed = true) {
    const state = app.dialogue;
    if (!state) return;
    app.dialogue = null;
    const overlay = $("#storyDialogue");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    if (app.scene && !app.scene.isDead && !app.scene.mapTransitioning) {
      app.scene.isActionLocked = !!state.previousActionLocked;
    }
    if (completed) state.onComplete?.();
  }

  function advanceStoryDialogue() {
    const state = app.dialogue;
    if (!state) return;
    if (state.index < state.lines.length - 1) {
      state.index += 1;
      renderStoryDialogueLine();
      app.audio?.dialogueAdvance();
      return;
    }
    closeStoryDialogue(true);
  }

  function openStoryDialogue(dialogue = {}, options = {}) {
    const lines = (Array.isArray(dialogue.lines) ? dialogue.lines : [dialogue.line])
      .map(line => String(line || "").trim())
      .filter(Boolean);
    if (!lines.length) return false;
    if (app.dialogue) closeStoryDialogue(false);
    app.scene?.cancelPrimaryActionHold?.();
    app.dialogue = {
      speaker: String(dialogue.speaker || options.speaker || "提示"),
      eyebrow: String(options.eyebrow || dialogue.eyebrow || "ACADEMY STORY"),
      lines,
      index: 0,
      finalLabel: String(options.finalLabel || dialogue.finalLabel || "结束对话"),
      onComplete: options.onComplete,
      previousActionLocked: !!app.scene?.isActionLocked
    };
    if (app.scene) {
      app.scene.isActionLocked = true;
      app.scene.actor?.body?.setVelocity?.(0, 0);
    }
    const overlay = $("#storyDialogue");
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden", "false");
    renderStoryDialogueLine();
    app.audio?.dialogueOpen();
    window.setTimeout(() => $("#storyDialogueNextButton")?.focus({ preventScroll: true }), 60);
    return true;
  }

  let entryLoadingState = null;
  function setEntryLoadingDom(percent, label) {
    const bar = $("#entryLoadingBar");
    const text = $("#entryLoadingText");
    const value = $("#entryLoadingPercent");
    const progress = clamp(percent, 0, 100);
    if (bar) bar.style.width = `${progress.toFixed(0)}%`;
    if (text && label) text.textContent = label;
    if (value) value.textContent = `${progress.toFixed(0)}%`;
  }

  function beginEntryLoading() {
    window.clearInterval(entryLoadingState?.timer);
    window.clearTimeout(entryLoadingState?.finishTimer);
    entryLoadingState = {
      startedAt: performance.now(),
      realProgress: 0,
      timer: null,
      finishTimer: null
    };
    showStage("entryLoading");
    $("#startOverlay")?.classList.remove("hidden");
    setEntryLoadingDom(0, "正在开启学院传送协议");
    entryLoadingState.timer = window.setInterval(() => {
      const state = entryLoadingState;
      if (!state) return;
      const fakeProgress = Math.min(92, (performance.now() - state.startedAt) / ENTRY_LOADING_MIN_MS * 92);
      const realProgress = Math.min(96, state.realProgress * 96);
      const progress = Math.max(fakeProgress, realProgress);
      setEntryLoadingDom(progress, state.realProgress >= 1 ? "正在同步玩家出生点" : "正在加载地图、角色与怪物资产");
    }, 80);
  }

  function setEntryLoadingProgress(value) {
    if (!entryLoadingState) return;
    entryLoadingState.realProgress = clamp(Number(value) || 0, 0, 1);
  }

  function finishEntryLoadingWhenReady() {
    const state = entryLoadingState;
    if (!state) return;
    state.realProgress = 1;
    const wait = Math.max(0, ENTRY_LOADING_MIN_MS - (performance.now() - state.startedAt));
    window.clearTimeout(state.finishTimer);
    state.finishTimer = window.setTimeout(() => {
      if (entryLoadingState !== state) return;
      window.clearInterval(state.timer);
      setEntryLoadingDom(100, "加载完成");
      $("#startOverlay")?.classList.add("hidden");
      entryLoadingState = null;
      app.audio.switchMode("game");
    }, wait);
  }

  let mapLoadingTimer = null;
  function showMapLoading(title = "正在前往新区域") {
    const overlay = $("#mapLoadingOverlay");
    const label = $("#mapLoadingTitle");
    const bar = $("#mapLoadingBar");
    if (!overlay || !bar) return;
    window.clearTimeout(mapLoadingTimer);
    if (label) label.textContent = title;
    bar.style.transition = "none";
    bar.style.width = "0%";
    void bar.offsetWidth;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      bar.style.transition = "";
      bar.style.width = "78%";
    });
  }

  function hideMapLoading() {
    const overlay = $("#mapLoadingOverlay");
    const bar = $("#mapLoadingBar");
    if (!overlay || !bar) return;
    window.clearTimeout(mapLoadingTimer);
    bar.style.transition = "";
    bar.style.width = "100%";
    mapLoadingTimer = window.setTimeout(() => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
    }, 220);
  }

  function renderReviveDialog(open) {
    const dialog = $("#reviveDialog");
    if (!dialog) return;
    dialog.classList.toggle("open", !!open);
    dialog.setAttribute("aria-hidden", String(!open));
  }

  function renderChapterClearPanel(open) {
    const panel = $("#chapterClearPanel");
    if (!panel) return;
    const cards = $("#chapterClearCards");
    if (cards) cards.textContent = `${getProtocolCardIds().length} / ${CHAPTER_ONE_PROTOCOL_CARD_GOAL}`;
    panel.classList.toggle("open", !!open);
    panel.setAttribute("aria-hidden", String(!open));
  }

  function getDefaultWsUrl() {
    if (location.protocol === "file:") return "ws://127.0.0.1:8787/ws";
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  const LOGIN_BACKGROUND_URL = "assets/ui/start-screen-bg-v4.png";
  const LOGIN_BACKGROUND_VERSION = "20260710-login-asset-gate";
  const LOGIN_ASSET_WEIGHTS = { background: 0.78, audio: 0.22 };
  const loginAssetState = {
    progress: { background: 0, audio: 0 },
    ready: { background: false, audio: false },
    backgroundLoading: false,
    backgroundObjectUrl: "",
    retryTimer: null,
    error: ""
  };

  function setLoginControlsEnabled(enabled) {
    ["#loginButton", "#offlineButton", "#registerButton"].forEach(selector => {
      const button = $(selector);
      if (button) button.disabled = !enabled;
    });
  }

  function loginAssetsReady() {
    return loginAssetState.ready.background && loginAssetState.ready.audio;
  }

  function renderLoginAssetProgress() {
    const bar = $("#loginMusicBar");
    const text = $("#loginMusicText");
    const value = $("#loginMusicPercent");
    const wrap = $("#loginMusicProgress");
    const ready = loginAssetsReady();
    const weightedProgress = Object.entries(LOGIN_ASSET_WEIGHTS).reduce(
      (total, [key, weight]) => total + loginAssetState.progress[key] * weight,
      0
    );
    const progress = ready ? 100 : Math.min(99, Math.round(weightedProgress * 100));
    if (bar) bar.style.width = `${progress}%`;
    if (value) value.textContent = `${progress}%`;
    if (text) {
      text.textContent = loginAssetState.error
        || (ready
          ? "初始素材加载完成"
          : loginAssetState.ready.background
            ? "正在加载登录音乐"
            : "正在加载登录背景");
    }
    wrap?.classList.toggle("ready", ready);
    setLoginControlsEnabled(ready);
  }

  function setLoginAssetProgress(kind, progress, ready = false) {
    loginAssetState.progress[kind] = clamp(Number(progress) || 0, 0, 1);
    if (ready) loginAssetState.ready[kind] = true;
    renderLoginAssetProgress();
  }

  async function fetchLoginAsset(url, onProgress) {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Login asset unavailable: ${url}`);
    const total = Number(response.headers.get("content-length") || 0);
    if (!response.body || !total) {
      const blob = await response.blob();
      onProgress(1);
      return blob;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded / total);
    }
    return new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
  }

  async function decodeLoginBackground(src) {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = src;
    });
    if (typeof image.decode === "function") await image.decode();
  }

  async function loadLoginBackground() {
    window.clearTimeout(loginAssetState.retryTimer);
    if (loginAssetState.backgroundLoading || loginAssetState.ready.background) return;
    loginAssetState.backgroundLoading = true;
    loginAssetState.error = "";
    renderLoginAssetProgress();
    let objectUrl = "";
    try {
      const blob = await fetchLoginAsset(
        `${LOGIN_BACKGROUND_URL}?v=${LOGIN_BACKGROUND_VERSION}`,
        progress => setLoginAssetProgress("background", progress)
      );
      objectUrl = URL.createObjectURL(blob);
      await decodeLoginBackground(objectUrl);
      if (loginAssetState.backgroundObjectUrl) URL.revokeObjectURL(loginAssetState.backgroundObjectUrl);
      loginAssetState.backgroundObjectUrl = objectUrl;
      document.documentElement.style.setProperty("--login-background-image", `url("${objectUrl}")`);
      setLoginAssetProgress("background", 1, true);
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      console.error("Login background loading failed", error);
      loginAssetState.progress.background = 0;
      loginAssetState.error = "登录背景加载失败，正在重试";
      renderLoginAssetProgress();
      loginAssetState.retryTimer = window.setTimeout(loadLoginBackground, 1800);
    } finally {
      loginAssetState.backgroundLoading = false;
    }
  }

  class AudioEngine {
    constructor() {
      this.enabled = true;
      this.ctx = null;
      this.timer = null;
      this.mode = "login";
      this.step = 0;
      this.gameNotes = [261.63, 329.63, 392, 523.25, 493.88, 392, 349.23, 392];
      this.loginTrackUrl = "assets/audio/efv-login.mp3";
      this.gameTrackUrl = "assets/audio/efv-p1m0m3.mp3";
      this.loginTrack = null;
      this.gameTrack = new Audio(this.gameTrackUrl);
      this.gameTrack.loop = true;
      this.gameTrack.preload = "auto";
      this.gameTrack.volume = 0.46;
      this.loginObjectUrl = "";
      this.loginLoading = false;
      this.loginReady = false;
      this.loginAutoplayBlocked = false;
      this.loginTargetVolume = 0.56;
      this.setLoginProgress(0, "初始素材加载中");
      this.loadLoginTrack();
    }

    unlock() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!this.ctx) this.ctx = new AudioContextClass();
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    start(mode = this.mode, userGesture = false) {
      this.mode = mode;
      this.unlock();
      if (!this.enabled) {
        this.pauseLoginTrack();
        this.stopGamePulse();
        return;
      }
      if (this.mode === "login") {
        this.pauseGameTrack();
        this.stopGamePulse();
        this.playLoginTrack(userGesture);
        return;
      }
      this.pauseLoginTrack();
      if (this.shouldPlayChapterTrack()) {
        this.stopGamePulse();
        this.playGameTrack();
        return;
      }
      this.pauseGameTrack();
      if (!this.ctx) return;
      if (!this.timer) {
        this.timer = window.setInterval(() => this.playPulse(), 500);
      }
      this.playPulse();
    }

    stopGamePulse() {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    stop() {
      this.stopGamePulse();
      this.pauseLoginTrack();
      this.pauseGameTrack();
    }

    switchMode(mode) {
      if (this.mode === mode) {
        this.start(mode);
        return;
      }
      this.stop();
      this.step = 0;
      this.start(mode);
    }

    toggle(userGesture = false) {
      this.enabled = !this.enabled;
      const musicButton = $("#musicToggle");
      const musicLabel = musicButton?.querySelector("span");
      if (musicLabel) musicLabel.textContent = this.enabled ? "音乐开" : "音乐关";
      else if (musicButton) musicButton.textContent = this.enabled ? "音乐 开" : "音乐 关";
      if (this.enabled) this.start(this.mode, userGesture);
      else this.stop();
    }

    setLoginProgress(percent, label, ready = false) {
      setLoginAssetProgress("audio", Number(percent) / 100, ready);
    }

    setupLoginTrack(src, objectUrl = "") {
      if (this.loginObjectUrl) URL.revokeObjectURL(this.loginObjectUrl);
      this.loginObjectUrl = objectUrl;
      const track = new Audio(src);
      track.loop = true;
      track.preload = "auto";
      track.volume = this.loginTargetVolume;
      this.loginTrack = track;
      this.loginReady = true;
      this.setLoginProgress(100, "初始素材加载完成", true);
      if (this.enabled && this.mode === "login") this.playLoginTrack();
    }

    async loadLoginTrack() {
      if (this.loginLoading || this.loginReady) return;
      this.loginLoading = true;
      try {
        const response = await fetch(this.loginTrackUrl, { cache: "force-cache" });
        if (!response.ok) throw new Error("login music unavailable");
        const total = Number(response.headers.get("content-length") || 0);
        if (!response.body || !total) {
          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          this.setupLoginTrack(objectUrl, objectUrl);
          return;
        }
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          this.setLoginProgress(Math.max(4, loaded / total * 99), "初始素材加载中");
        }
        const blob = new Blob(chunks, { type: response.headers.get("content-type") || "audio/mpeg" });
        const objectUrl = URL.createObjectURL(blob);
        this.setupLoginTrack(objectUrl, objectUrl);
      } catch {
        this.setupLoginTrack(this.loginTrackUrl);
      } finally {
        this.loginLoading = false;
      }
    }

    async playLoginTrack(userGesture = false) {
      this.loadLoginTrack();
      if (!this.loginTrack || !this.enabled || this.mode !== "login") return;
      const track = this.loginTrack;
      track.volume = this.loginTargetVolume;
      if (userGesture) {
        track.muted = false;
        this.loginAutoplayBlocked = false;
      }
      try {
        await track.play();
        this.loginAutoplayBlocked = false;
        return;
      } catch {
        this.loginAutoplayBlocked = true;
      }
      if (userGesture) return;
      try {
        track.muted = true;
        await track.play();
        track.volume = this.loginTargetVolume;
        track.muted = false;
      } catch {
        track.muted = false;
      }
    }

    pauseLoginTrack() {
      this.loginTrack?.pause();
    }

    shouldPlayChapterTrack(mapId = app.profile?.mapId) {
      return /^ch1_m0[1-3]_/.test(String(mapId || ""));
    }

    async playGameTrack() {
      if (!this.enabled || this.mode !== "game" || !this.shouldPlayChapterTrack()) return;
      try {
        await this.gameTrack.play();
      } catch {
        // The next player gesture will retry through start().
      }
    }

    pauseGameTrack() {
      this.gameTrack?.pause();
    }

    syncMap(mapId = app.profile?.mapId) {
      if (this.mode !== "game") return;
      if (this.shouldPlayChapterTrack(mapId)) {
        this.stopGamePulse();
        this.playGameTrack();
        return;
      }
      this.pauseGameTrack();
      this.start("game");
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

    sweep(startFreq, endFreq, duration = 0.18, type = "sine", gain = 0.045) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.018);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    noise(duration = 0.25, gain = 0.035, filterType = "bandpass", frequency = 700) {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const amp = this.ctx.createGain();
      source.buffer = buffer;
      filter.type = filterType;
      filter.frequency.setValueAtTime(frequency, now);
      filter.Q.setValueAtTime(0.8, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.025);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(amp).connect(this.ctx.destination);
      source.start(now);
      source.stop(now + duration + 0.02);
    }

    playPulse() {
      const notes = this.gameNotes;
      const note = notes[this.step % notes.length];
      this.step += 1;
      this.tone(note, 0.34, "triangle", 0.038);
      this.tone(note / 2, 0.48, "sine", 0.024);
      if (this.mode === "game" && this.step % 4 === 0) this.tone(note * 1.5, 0.18, "sine", 0.018);
    }

    cast() { this.tone(740, 0.12, "triangle", 0.07); }
    projectileFly(charged = false) {
      if (charged) {
        this.sweep(520, 1960, 0.18, "triangle", 0.064);
        this.tone(220, 0.1, "sine", 0.028);
        window.setTimeout(() => this.tone(1560, 0.07, "sine", 0.035), 55);
        window.setTimeout(() => this.noise(0.12, 0.016, "highpass", 1800), 80);
        return;
      }
      this.sweep(820, 1840, 0.11, "triangle", 0.054);
      window.setTimeout(() => this.tone(1320, 0.045, "sine", 0.026), 42);
    }
    ultimateWind() {
      this.noise(0.62, 0.038, "bandpass", 620);
      this.sweep(180, 520, 0.52, "sine", 0.03);
      window.setTimeout(() => this.noise(0.32, 0.026, "highpass", 1100), 180);
    }
    ultimateBurst() {
      this.noise(0.18, 0.06, "lowpass", 520);
      this.tone(92, 0.22, "sawtooth", 0.05);
      window.setTimeout(() => this.tone(260, 0.08, "triangle", 0.045), 35);
    }
    hit() {
      this.noise(0.09, 0.035, "bandpass", 1320);
      this.tone(210, 0.1, "square", 0.045);
    }
    enemyAttack() {
      this.sweep(330, 92, 0.2, "sawtooth", 0.075);
      this.noise(0.15, 0.05, "lowpass", 620);
    }
    playerHit() {
      this.noise(0.14, 0.065, "lowpass", 440);
      this.tone(118, 0.16, "square", 0.065);
      window.setTimeout(() => this.tone(82, 0.11, "sawtooth", 0.038), 38);
    }
    dialogueOpen() {
      this.noise(0.34, 0.026, "bandpass", 1050);
      this.sweep(260, 620, 0.28, "triangle", 0.032);
      window.setTimeout(() => this.noise(0.18, 0.018, "highpass", 1800), 105);
    }
    dialogueAdvance() {
      this.noise(0.08, 0.012, "highpass", 2100);
      this.tone(680, 0.07, "triangle", 0.025);
    }
    questComplete() {
      this.tone(523.25, 0.18, "triangle", 0.05);
      window.setTimeout(() => this.tone(659.25, 0.2, "triangle", 0.046), 90);
      window.setTimeout(() => this.tone(783.99, 0.28, "sine", 0.04), 185);
    }
    boss() { this.tone(98, 0.42, "sawtooth", 0.055); }
    heal() {
      this.tone(523.25, 0.18, "sine", 0.06);
      window.setTimeout(() => this.tone(659.25, 0.18, "sine", 0.045), 80);
    }
    enterGame() {
      this.sweep(196, 880, 0.42, "triangle", 0.06);
      window.setTimeout(() => this.tone(523.25, 0.18, "sine", 0.052), 90);
      window.setTimeout(() => this.tone(783.99, 0.22, "triangle", 0.046), 180);
      window.setTimeout(() => this.noise(0.28, 0.028, "highpass", 1450), 260);
    }
  }

  class MultiplayerClient {
    constructor() {
      this.ws = null;
      this.peers = new Map();
      this.drops = new Map();
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
          room: app.serverRoom || "zhonghe-plaza",
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
      this.drops.clear();
      app.scene?.clearWorldDrops();
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
        maxHp: app.profile.maxHp,
        shield: app.profile.shield || 0
      };
    }

    sendState() {
      this.send({ type: "update", player: this.currentPlayerState() });
    }

    sendChat(text) {
      const cleaned = normalizeChatText(text);
      if (!cleaned || this.ws?.readyState !== WebSocket.OPEN) return null;
      const chat = {
        id: makeId(),
        playerId: app.profile.id,
        name: app.profile.name,
        text: cleaned,
        createdAt: Date.now()
      };
      this.send({ type: "chatSend", id: chat.id, text: cleaned });
      return chat;
    }

    sendBossStart(boss) {
      this.send({ type: "bossStart", boss });
    }

    sendBossHit(damage) {
      this.send({ type: "bossHit", damage });
    }

    sendSlimeSpawn(slime) {
      this.send({ type: "slimeSpawn", slime });
    }

    sendSlimeRemove(id) {
      this.send({ type: "slimeRemove", id });
    }

    sendDropSpawn(drop) {
      this.send({ type: "dropSpawn", drop });
    }

    sendDropCollect(id) {
      this.send({ type: "dropCollect", id });
    }

    syncDropsForCurrentMap() {
      app.scene?.syncWorldDrops(Array.from(this.drops.values()));
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
        this.drops.clear();
        (message.peers || []).forEach(peer => {
          if (peer.id !== app.profile.id) this.peers.set(peer.id, peer);
        });
        if (Array.isArray(message.chat)) renderChatHistory(message.chat);
        if (message.boss) syncBossState(message.boss);
        if (Array.isArray(message.slimes)) app.scene?.syncSlimes(message.slimes);
        (Array.isArray(message.drops) ? message.drops : []).forEach(drop => {
          if (drop?.id) this.drops.set(String(drop.id), drop);
        });
        renderPeers(this.peers);
        app.scene?.syncAllPeers(this.peers);
        this.syncDropsForCurrentMap();
      }
      if (message.type === "chatMessage") {
        handleChatMessage(message);
      }
      if (message.type === "chatError") {
        renderChatError(message.text || message.error);
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
      if (message.type === "slimeSpawn" && message.slime) {
        app.scene?.syncSlimeSpawn(message.slime);
      }
      if (message.type === "slimeRemove" && message.id) {
        app.scene?.syncSlimeRemove(message.id);
      }
      if (message.type === "dropSpawn" && message.drop?.id) {
        this.drops.set(String(message.drop.id), message.drop);
        app.scene?.syncWorldDrop(message.drop);
      }
      if (message.type === "dropRemove" && message.id) {
        this.drops.delete(String(message.id));
        app.scene?.removeWorldDrop(String(message.id));
      }
      if (message.type === "dropCollected" && message.drop) {
        if (addInventoryItem(message.drop.item || {})) {
          showToast(`拾取：${message.drop.item?.name || "掉落物"}`);
        }
      }
      if (message.type === "dropError") showToast(message.text || "无法拾取这个掉落物");
      if (message.type === "notice" && message.text) showToast(message.text);
    }
  }

  function syncBossState(boss) {
    const wasActive = app.boss.active;
    app.boss = { ...app.boss, ...boss };
    renderBossHud();
    app.scene?.syncBoss();
  }

  class PlayScene extends Phaser.Scene {
    constructor() {
      super("Play");
      this.lastNetworkSendAt = 0;
      this.lastBossHitAt = 0;
      this.lastShotAt = 0;
      this.remotePlayers = new Map();
      this.syncedSlimeIds = new Set();
      this.bossSummonIds = new Set();
      this.bossWavePending = false;
      this.ambientEnemyRefreshTimer = null;
      this.ambientEnemySequence = 0;
      this.worldDrops = new Map();
      this.lastMinimapUpdateAt = 0;
      this.lastInteractionUpdateAt = 0;
      this.lastWorldDropUpdateAt = 0;
    }

    preload() {
      this.load.on("progress", value => setEntryLoadingProgress(value));
      this.load.image(MAP_TILESET_KEY, MAP_TILESET_PATH);
      this.load.image(MAP_PROP_ATLAS_KEY, MAP_PROP_ATLAS_PATH);
      this.load.image(MAP_MACRO_PROP_ATLAS_KEY, MAP_MACRO_PROP_ATLAS_PATH);
      this.load.image(WORLD_DROP_MATERIAL_KEY, WORLD_DROP_MATERIAL_IMAGE);
      this.load.image(WORLD_DROP_EQUIPMENT_KEY, WORLD_DROP_EQUIPMENT_IMAGE);
      this.load.tilemapTiledJSON(MAP_TILEMAP_KEY, MAP_DATA_PATH);
      this.load.json(MAP_DATA_KEY, MAP_DATA_PATH);
      this.load.on("filecomplete", (key, type, data) => {
        if (key !== CHAPTER_ONE_MAPS_KEY) return;
        queueChapterMapAssets(
          this,
          data || this.cache.json.get(CHAPTER_ONE_MAPS_KEY) || {},
          app.profile?.mapId
        );
      });
      this.load.json(CHAPTER_ONE_MAPS_KEY, CHAPTER_ONE_MAPS_REQUEST_PATH);
      this.load.spritesheet(PROJECTILE_TEXTURE_KEY, PROJECTILE_ATLAS, {
        frameWidth: PROJECTILE_FRAME_SIZE,
        frameHeight: PROJECTILE_FRAME_SIZE
      });
      this.load.spritesheet(ULTIMATE_BACK_TEXTURE_KEY, ULTIMATE_BACK_ATLAS, {
        frameWidth: ULTIMATE_FRAME_WIDTH,
        frameHeight: ULTIMATE_FRAME_HEIGHT
      });
      this.load.spritesheet(ULTIMATE_FRONT_TEXTURE_KEY, ULTIMATE_FRONT_ATLAS, {
        frameWidth: ULTIMATE_FRAME_WIDTH,
        frameHeight: ULTIMATE_FRAME_HEIGHT
      });
      this.load.spritesheet(LEAF_SLIME_KEY, LEAF_SLIME_SHEET, {
        frameWidth: LEAF_SLIME_FRAME_SIZE,
        frameHeight: LEAF_SLIME_FRAME_SIZE
      });
      CHAPTER_ONE_ENEMY_SPRITES.forEach(item => {
        this.load.spritesheet(item.key, item.path, {
          frameWidth: LEAF_SLIME_FRAME_SIZE,
          frameHeight: LEAF_SLIME_FRAME_SIZE
        });
      });
      this.load.spritesheet(PROFESSOR_NPC_KEY, PROFESSOR_NPC_IMAGE, {
        frameWidth: PROFESSOR_NPC_FRAME_WIDTH,
        frameHeight: PROFESSOR_NPC_FRAME_HEIGHT
      });
      this.load.image(BOSS_KEY, BOSS_IMAGE);
      CHAPTER_ONE_ENEMY_IMAGES.forEach(item => this.load.image(item.key, item.path));
      this.load.spritesheet(MAP_PORTAL_KEY, MAP_PORTAL_IMAGE, {
        frameWidth: MAP_PORTAL_FRAME_WIDTH,
        frameHeight: MAP_PORTAL_FRAME_HEIGHT
      });
      this.load.spritesheet(MAP_TRANSFER_RING_KEY, MAP_TRANSFER_RING_IMAGE, {
        frameWidth: MAP_TRANSFER_RING_FRAME_WIDTH,
        frameHeight: MAP_TRANSFER_RING_FRAME_HEIGHT
      });
      this.load.spritesheet(BOSS_VOID_PORTAL_KEY, BOSS_VOID_PORTAL_IMAGE, {
        frameWidth: BOSS_VOID_PORTAL_FRAME_WIDTH,
        frameHeight: BOSS_VOID_PORTAL_FRAME_HEIGHT
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
      if (["localhost", "127.0.0.1"].includes(location.hostname)) window.__EFV_TEST_SCENE__ = this;
      this.cameras.main.roundPixels = true;
      this.baseMapData = this.cache.json.get(MAP_DATA_KEY) || {};
      this.chapterMapRegistry = this.cache.json.get(CHAPTER_ONE_MAPS_KEY) || {};
      this.mapData = this.composeRuntimeMapData();
      this.remotePlayers = new Map();
      this.worldDrops = new Map();
      this.syncedSlimeIds = new Set();
      this.bossSummonIds = new Set();
      this.bossWavePending = false;
      this.activeInteraction = null;
      this.encounterRewards = new Set();
      this.selectedEquipment = EQUIPMENT[0];
      this.facing = DIRECTIONS[2];
      this.lastAimVector = directionVector(this.facing);
      this.isCasting = false;
      this.isDead = false;
      this.isCat = false;
      this.isCatJumping = false;
      this.isTransforming = false;
      this.isActionLocked = false;
      this.networkAction = "idle";
      this.actorHitToken = 0;
      this.isShowingCatIdleFrame = false;
      this.primaryHold = null;
      this.chargeHoldTimer = null;
      this.lastUltimateAt = 0;
      this.collisionDebugVisible = false;
      this.collisionDebugGraphics = null;
      this.collisionDebugRects = [];

      this.renderTileMap();
      this.prepareMapPropFrames();
      this.renderMapProps();
      this.renderForegroundOverlays();
      this.obstacleGroup = this.physics.add.staticGroup();
      this.drawObstacles();
      this.prepareCharacterAnimations();
      this.prepareProjectileAnimations();
      this.prepareUltimateAnimations();
      this.prepareLeafSlimeAnimations();
      this.prepareNpcAnimations();
      this.preparePortalAnimations();
      this.ensureProjectileHitboxTexture();
      this.ensureBossChestTexture();

      this.projectiles = this.physics.add.group({ allowGravity: false });
      this.leafSlimes = this.physics.add.group({ allowGravity: false });
      this.projectileGraphics = this.add.graphics().setDepth(40);
      this.keys = this.input.keyboard.addKeys("W,A,S,D,E,UP,DOWN,LEFT,RIGHT,J,K,H,L,I,Q,SPACE");

      this.createActor();
      this.createBoss();
      this.createMapNpcs();
      this.createInteractionNodes();
      this.spawnMapLeafSlimes();
      this.scheduleAmbientEnemyRefresh();
      app.multiplayer?.syncDropsForCurrentMap();

      this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
      this.bindMapColliders();
      this.projectileObstacleCollider = this.physics.add.collider(this.projectiles, this.obstacleGroup, projectile => this.destroyProjectile(projectile, true));
      this.projectileSlimeOverlap = this.physics.add.overlap(this.projectiles, this.leafSlimes, (projectile, enemy) => this.handleLeafSlimeProjectileHit(projectile, enemy));
      this.bindActorLeafSlimeCollision();

      this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
      this.cameras.main.startFollow(this.actor, true, 0.12, 0.12);
      this.cameras.main.centerOn(this.actor.x, this.actor.y);
      this.input.keyboard.on("keydown", event => this.handleHotkey(event));
      this.input.keyboard.on("keyup", event => this.handleKeyUp(event));
      this.input.on("pointerdown", pointer => {
        if (pointer.leftButtonDown()) this.beginPrimaryActionHold();
      });
      this.input.on("pointerup", () => this.releasePrimaryActionHold());
      this.input.on("pointerupoutside", () => this.releasePrimaryActionHold());
      window.addEventListener("blur", () => this.cancelPrimaryActionHold());

      if (app.offlineMode) {
        renderNetwork("离线试玩", false);
      } else {
        app.multiplayer.connect();
      }
      renderHud();
      renderBossHud();
      renderMinimap(this);
      finishEntryLoadingWhenReady();
      showToast("WASD 移动，E 交互，J 攻击，L 变身；完成协议卡后挑战 Boss");
    }

    getChapterMapRegistry() {
      return this.chapterMapRegistry?.maps || {};
    }

    getCurrentMapId() {
      const maps = this.getChapterMapRegistry();
      const requested = app.profile?.mapId || this.chapterMapRegistry?.defaultMapId || "ch1_m01_classroom_spawn";
      return maps[requested] ? requested : (this.chapterMapRegistry?.defaultMapId || "ch1_m01_classroom_spawn");
    }

    composeRuntimeMapData(mapId = this.getCurrentMapId()) {
      const maps = this.getChapterMapRegistry();
      if (maps[mapId]) return { ...maps[mapId] };
      return { ...this.baseMapData };
    }

    renderTileMap() {
      if (Array.isArray(this.mapData?.background?.chunks) && this.mapData.background.chunks.length) {
        const chunks = this.mapData.background.chunks;
        this.mapBackgroundChunks = [];
        chunks.forEach(chunk => {
          const image = this.add.image(chunk.x || 0, chunk.y || 0, chunk.key)
            .setOrigin(0, 0)
            .setDepth(-20);
          image.setDisplaySize(Number(chunk.width) || image.width, Number(chunk.height) || image.height);
          this.mapBackgroundChunks.push(image);
        });
        this.mapLayers = [];
        this.tileMap = null;
        this.worldWidth = Number(this.mapData.background.width)
          || Math.max(...chunks.map(chunk => (Number(chunk.x) || 0) + (Number(chunk.width) || 0)));
        this.worldHeight = Number(this.mapData.background.height)
          || Math.max(...chunks.map(chunk => (Number(chunk.y) || 0) + (Number(chunk.height) || 0)));
        return;
      }
      if (this.mapData?.background?.key) {
        const bgKey = this.mapData.background.key;
        const bg = this.add.image(0, 0, bgKey)
          .setOrigin(0, 0)
          .setDepth(-20);
        const targetWidth = Number(this.mapData.background.width) || bg.width || 1024;
        const targetHeight = Number(this.mapData.background.height) || bg.height || 1024;
        bg.setDisplaySize(targetWidth, targetHeight);
        this.mapBackground = bg;
        this.mapLayers = [];
        this.tileMap = null;
        this.worldWidth = targetWidth;
        this.worldHeight = targetHeight;
        return;
      }
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
        { key: MAP_MACRO_PROP_ATLAS_KEY, frames: this.mapData?.macroPropFrames || {} },
        ...normalizeMapAssetAtlases(this.mapData, "propAtlases").map(atlas => ({
          key: atlas.key || atlas.textureKey || atlas.id,
          frames: atlas.frames || {}
        })),
        ...normalizeMapAssetAtlases(this.mapData, "foregroundAtlases").map(atlas => ({
          key: atlas.key || atlas.textureKey || atlas.id,
          frames: atlas.frames || {}
        }))
      ].forEach(({ key, frames }) => {
        const texture = this.textures.get(key);
        if (!texture) return;
        Object.entries(frames).forEach(([name, frame]) => {
          if (!texture.has(name)) texture.add(name, 0, frame.x, frame.y, frame.w, frame.h);
        });
      });
    }

    getMapPropAtlasKey(item) {
      if (item.atlas === "macro") return MAP_MACRO_PROP_ATLAS_KEY;
      if (!item.atlas || item.atlas === "default") return MAP_PROP_ATLAS_KEY;
      const localAtlas = normalizeMapAssetAtlases(this.mapData, "propAtlases")
        .find(atlas => item.atlas === atlas.id || item.atlas === atlas.key || item.atlas === atlas.textureKey);
      return localAtlas?.key || localAtlas?.textureKey || item.atlas;
    }

    renderMapProps() {
      this.mapProps = [];
      (this.mapData?.props || []).forEach(item => {
        const frame = item.frame;
        const atlasKey = this.getMapPropAtlasKey(item);
        const textureKey = item.textureKey || item.key || item.id || atlasKey;
        const hasStandaloneTexture = !frame && textureKey && this.textures.exists(textureKey);
        if (!hasStandaloneTexture && (!frame || !this.textures.get(atlasKey)?.has(frame))) return;
        const origin = item.origin || {};
        const visualScale = clamp(Number(item.scale ?? 1) || 1, 0.05, 1);
        const prop = this.add.image(item.x, item.y, hasStandaloneTexture ? textureKey : atlasKey, hasStandaloneTexture ? undefined : frame)
          .setOrigin(origin.x ?? 0.5, origin.y ?? 1)
          .setScale(visualScale)
          .setDepth(Number.isFinite(Number(item.depthY)) ? Number(item.depthY) : item.y + (item.depthOffset || 0));
        if (Number(item.displayWidth) > 0 && Number(item.displayHeight) > 0) {
          prop.setDisplaySize(Number(item.displayWidth), Number(item.displayHeight));
        }
        prop.mapPropId = item.id || frame;
        this.mapProps.push(prop);
      });
    }

    findBackgroundChunkForRect(item) {
      const chunks = this.mapData?.background?.chunks || [];
      return chunks.find(chunk => {
        const x = Number(chunk.x) || 0;
        const y = Number(chunk.y) || 0;
        const w = Number(chunk.width) || 0;
        const h = Number(chunk.height) || 0;
        return item.x >= x && item.y >= y && item.x + item.w <= x + w && item.y + item.h <= y + h;
      });
    }

    renderForegroundOverlays() {
      this.foregroundOverlays = [];
      (this.mapData?.foregroundOverlays || []).forEach(item => {
        if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.w) || !Number.isFinite(item.h)) return;
        const chunk = this.findBackgroundChunkForRect(item);
        const textureKey = item.textureKey || chunk?.key || this.mapData?.background?.key;
        if (!textureKey || !this.textures.exists(textureKey)) return;
        if (item.fullImage) {
          const overlay = this.add.image(item.x, item.y, textureKey)
            .setOrigin(0, 0)
            .setDisplaySize(item.w, item.h)
            .setDepth(Number(item.depth) || -10)
            .setAlpha(Number.isFinite(Number(item.alpha)) ? Number(item.alpha) : 1);
          this.foregroundOverlays.push(overlay);
          return;
        }
        const sourceX = Number.isFinite(item.sourceX) ? item.sourceX : item.x - (Number(chunk?.x) || 0);
        const sourceY = Number.isFinite(item.sourceY) ? item.sourceY : item.y - (Number(chunk?.y) || 0);
        const sourceWidth = Number(item.sourceWidth) || item.w;
        const sourceHeight = Number(item.sourceHeight) || item.h;
        const texture = this.textures.get(textureKey);
        const frameKey = item.frameKey || `${this.mapData?.id || "map"}-${item.id}-foreground`;
        if (texture && !texture.has(frameKey)) texture.add(frameKey, 0, sourceX, sourceY, sourceWidth, sourceHeight);
        const overlay = this.add.image(item.x, item.y, textureKey, frameKey)
          .setOrigin(0, 0)
          .setDisplaySize(item.w, item.h)
          .setDepth(Number(item.depth) || item.y + item.h + 40)
          .setAlpha(Number.isFinite(Number(item.alpha)) ? Number(item.alpha) : 1);
        this.foregroundOverlays.push(overlay);
      });
    }

    drawObstacles() {
      const propObstacles = (this.mapData?.props || [])
        .map(prop => {
          const collision = prop.collisionFootprint || prop.collision;
          return collision ? { id: `${prop.id || prop.frame || "prop"}_collision`, ...collision } : null;
        })
        .filter(Boolean);
      const obstacleRects = [
        ...(this.mapData.obstacles || []),
        ...propObstacles
      ];
      this.collisionDebugRects = obstacleRects;
      obstacleRects.forEach(item => {
        const zone = this.add.zone(item.x + item.w / 2, item.y + item.h / 2, item.w, item.h);
        this.physics.add.existing(zone, true);
        this.obstacleGroup.add(zone);
      });
      this.renderCollisionDebug();
    }

    renderCollisionDebug() {
      this.collisionDebugGraphics?.destroy();
      this.collisionDebugGraphics = this.add.graphics()
        .setDepth(100000)
        .setVisible(!!this.collisionDebugVisible);
      this.collisionDebugGraphics.lineStyle(3, 0xff405c, 0.95);
      this.collisionDebugGraphics.fillStyle(0xff405c, 0.18);
      (this.collisionDebugRects || []).forEach(item => {
        this.collisionDebugGraphics.fillRect(item.x, item.y, item.w, item.h);
        this.collisionDebugGraphics.strokeRect(item.x, item.y, item.w, item.h);
      });
    }

    toggleCollisionDebug() {
      this.collisionDebugVisible = !this.collisionDebugVisible;
      this.renderCollisionDebug();
      showToast(this.collisionDebugVisible ? "碰撞显示：开" : "碰撞显示：关");
    }

    bindMapColliders() {
      this.actorObstacleCollider?.destroy?.();
      this.slimeObstacleCollider?.destroy?.();
      if (this.actor && this.obstacleGroup) this.actorObstacleCollider = this.physics.add.collider(this.actor, this.obstacleGroup);
      if (this.leafSlimes && this.obstacleGroup) this.slimeObstacleCollider = this.physics.add.collider(this.leafSlimes, this.obstacleGroup);
    }

    getFootPoint(entity = this.actor) {
      return { x: entity?.x || 0, y: entity?.y || 0 };
    }

    flagRequirementsMet(required = []) {
      return (required || []).every(flag => hasFlag(flag));
    }

    getDialogue(id) {
      return (this.mapData.dialogues || []).find(item => item.id === id) || null;
    }

    showDialogue(id, fallback = "", options = {}) {
      const dialogue = this.getDialogue(id);
      const content = dialogue || (fallback ? { speaker: "提示", lines: [fallback] } : null);
      if (content) openStoryDialogue(content, options);
    }

    nodeDoneFlag(node) {
      return `${node.id}_done`;
    }

    createStaticInteractionHint(node) {
      if (node.npcId || node.visualType === "npc") return null;
      const x = Number.isFinite(Number(node.hintX)) ? Number(node.hintX) : node.x;
      const y = Number.isFinite(Number(node.hintY)) ? Number(node.hintY) : node.y;
      const width = Math.max(48, Number(node.hintWidth) || 112);
      const height = Math.max(18, Number(node.hintHeight) || 38);
      const colors = {
        spawn: 0xc89cff,
        boss: 0xffd47d,
        "chapter-clear": 0x9ee7b2
      };
      const color = colors[node.type] || 0x8bdff2;
      const markerKey = node.markerImage?.key || node.markerTextureKey;
      if (markerKey && this.textures.exists(markerKey)) {
        const shadow = this.add.ellipse(
          0,
          Number(node.markerShadowOffsetY) || 4,
          Number(node.markerShadowWidth) || width,
          Number(node.markerShadowHeight) || Math.max(18, height * 0.52),
          0x21182d,
          Number(node.markerShadowAlpha) || 0.22
        );
        const glow = this.add.ellipse(
          0,
          Number(node.markerGlowOffsetY) || 1,
          Number(node.markerGlowWidth) || width * 1.08,
          Number(node.markerGlowHeight) || height,
          color,
          Number(node.markerGlowAlpha) || 0.1
        ).setBlendMode(Phaser.BlendModes.ADD);
        const sprite = this.add.image(0, Number(node.markerOffsetY) || 0, markerKey)
          .setOrigin(Number(node.markerOriginX) || 0.5, Number(node.markerOriginY) || 0.86)
          .setScale(Number(node.markerScale) || 0.3);
        const marker = this.add.container(x, y, [glow, shadow, sprite])
          .setDepth(Number(node.hintDepth) || y + 2);
        this.tweens.add({
          targets: glow,
          alpha: Math.max(0.22, Number(node.markerGlowAlpha) || 0.1),
          scaleX: 1.14,
          scaleY: 1.18,
          duration: 1080,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        return marker;
      }
      return this.add.ellipse(x, y, width, height, color, 0.09)
        .setDepth(Number(node.hintDepth) || y - 2);
    }

    setInteractionMarkerCompleted(node) {
      if (!node) return;
      this.refreshInteractionMarkerVisibility();
    }

    refreshInteractionMarkerVisibility() {
      (this.interactionMarkers || []).forEach(entry => {
        const locked = !this.flagRequirementsMet(entry.node.requiresFlags);
        const completed = !!entry.node.once && hasFlag(this.nodeDoneFlag(entry.node));
        const visible = !completed && !(entry.node.hideUntilUnlocked && locked);
        entry.marker?.setVisible(visible);
        entry.label?.setVisible(visible);
      });
    }

    createInteractionNodes() {
      const seen = new Set();
      this.interactionNodes = [
        ...(Array.isArray(this.mapData.interactionNodes) ? this.mapData.interactionNodes : []),
        ...(Array.isArray(this.mapData.exitPoints) ? this.mapData.exitPoints : [])
      ].filter(node => {
        const id = String(node.id || `${node.type}:${node.x}:${node.y}`);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      this.interactionMarkers = [];
      this.interactionNodes.forEach(node => {
        const marker = node.type === "teleport" && node.visual === "portal"
          ? this.add.sprite(node.x, node.y + 5, MAP_PORTAL_KEY)
            .setOrigin(0.5, 0.62)
            .setScale(Number(node.portalScale) || 0.72)
            .setAlpha(0.88)
            .setDepth(node.y + 2)
            .play("ch1-map-portal-loop")
          : node.type === "teleport"
            ? this.add.sprite(node.x, node.y + 2, MAP_TRANSFER_RING_KEY)
              .setOrigin(0.5, 0.5)
              .setScale(Number(node.ringScale) || 0.92)
              .setAlpha(0.9)
              .setDepth(node.y - 2)
              .play("ch1-map-transfer-ring-loop")
            : this.createStaticInteractionHint(node);
        const labelX = Number.isFinite(Number(node.labelX)) ? Number(node.labelX) : (Number(node.hintX) || node.x);
        const labelY = Number.isFinite(Number(node.labelY)) ? Number(node.labelY) : (Number(node.hintY) || node.y) - 24;
        const label = node.showLabel === false
          ? null
          : this.add.text(labelX, labelY, node.label || "交互", {
            fontFamily: "Microsoft YaHei, sans-serif",
            fontSize: "12px",
            fontStyle: "700",
            color: "#30263d",
            backgroundColor: "rgba(255,255,255,.78)",
            padding: { x: 6, y: 3 }
          }).setOrigin(0.5, 1).setDepth(Number(node.labelDepth) || labelY + 8);
        this.interactionMarkers.push({ node, marker, label });
      });
      this.refreshInteractionMarkerVisibility();
      this.refreshNpcQuestMarkers();
    }

    getNearestInteraction() {
      if (!this.actor) return null;
      const foot = this.getFootPoint(this.actor);
      let nearest = null;
      let nearestDistance = Infinity;
      if (this.bossChest?.visible && !hasFlag(BOSS_CHEST_FLAG)) {
        const distance = Math.hypot(foot.x - this.bossChest.x, foot.y - this.bossChest.y);
        if (distance <= 120) {
          nearest = {
            id: "ch1_boss_chest",
            type: "bossChest",
            label: "开启 Boss 宝箱",
            x: this.bossChest.x,
            y: this.bossChest.y
          };
          nearestDistance = distance;
        }
      }
      this.worldDrops?.forEach(drop => {
        const distance = Math.hypot(foot.x - Number(drop.x || 0), foot.y - Number(drop.y || 0));
        if (distance > WORLD_DROP_PICKUP_RADIUS || distance >= nearestDistance) return;
        const owned = drop.ownerId === app.profile?.id;
        nearest = {
          id: drop.id,
          dropId: drop.id,
          type: "worldDrop",
          ownerId: drop.ownerId,
          label: owned ? `拾取 ${drop.item?.name || "掉落物"}` : `${drop.ownerName || "其他玩家"}的掉落物`,
          x: drop.x,
          y: drop.y
        };
        nearestDistance = distance;
      });
      (this.interactionNodes || []).forEach(node => {
        if (node.once && hasFlag(this.nodeDoneFlag(node))) return;
        if (node.hideUntilUnlocked && !this.flagRequirementsMet(node.requiresFlags)) return;
        const distance = Math.hypot(foot.x - node.x, foot.y - node.y);
        if (distance <= (node.radius || 96) && distance < nearestDistance) {
          nearest = node;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    updateInteractionPrompt() {
      if (app.dialogue) {
        this.activeInteraction = null;
        renderInteractionPrompt("");
        return;
      }
      const node = this.getNearestInteraction();
      this.activeInteraction = node;
      if (!node) {
        renderInteractionPrompt("");
        return;
      }
      const locked = !this.flagRequirementsMet(node.requiresFlags);
      renderInteractionPrompt(`${locked ? "条件未满足：" : ""}${node.label || "交互"}`);
    }

    applyNodeRewards(node) {
      (node.setFlags || []).forEach(flag => setFlag(flag));
      const cards = [...(node.unlockCards || []), ...(node.grantCards || [])];
      cards.forEach(cardId => {
        const collected = collectProtocolCard(cardId);
        if (collected) showToast(`获得协议卡：${CHAPTER_ONE_CARD_NAMES[cardId] || cardId}`);
      });
      if (node.rewardCredits) {
        app.profile.credits += Number(node.rewardCredits) || 0;
        showToast(`学分记录更新，校园币 +${node.rewardCredits}`);
      }
      if (node.once) setFlag(this.nodeDoneFlag(node));
      renderHud();
    }

    refreshQuestUi() {
      this.refreshNpcQuestMarkers();
      this.refreshInteractionMarkerVisibility();
      renderChapterHud();
      renderMinimap(this);
      saveProfile(app.profile);
    }

    triggerQuestGiver(node) {
      const quest = node.questGiver || {};
      const accepted = hasFlag(quest.acceptFlag);
      const completed = hasFlag(quest.completeFlag);
      const turnedIn = hasFlag(quest.turnInFlag);
      if (!accepted) {
        this.showDialogue(quest.acceptDialogueId || node.dialogueId, "", {
          eyebrow: quest.acceptEyebrow || "M01 · 任务委托",
          finalLabel: quest.acceptLabel || "接受任务",
          onComplete: () => {
            [quest.acceptFlag, ...(quest.acceptSetFlags || [])].filter(Boolean).forEach(flag => setFlag(flag));
            this.refreshQuestUi();
            app.audio?.questComplete();
            showToast(quest.acceptToast || "已接受任务：修复错乱的提示词协议");
          }
        });
        return;
      }
      if (completed && !turnedIn) {
        this.showDialogue(quest.turnInDialogueId, "任务目标已经完成。", {
          eyebrow: quest.turnInEyebrow || "M01 · 任务交付",
          finalLabel: quest.turnInLabel || "提交任务",
          onComplete: () => {
            [quest.turnInFlag, ...(quest.turnInSetFlags || [])].filter(Boolean).forEach(flag => setFlag(flag));
            const rewardExp = Math.max(0, Number(quest.rewardExp) || 0);
            const rewardCredits = Math.max(0, Number(quest.rewardCredits) || 0);
            const levels = rewardExp ? grantExperience(rewardExp) : 0;
            if (rewardCredits) app.profile.credits += rewardCredits;
            this.refreshQuestUi();
            renderHud();
            app.audio?.questComplete();
            const levelText = levels ? `，等级 +${levels}` : "";
            showToast(`M01 任务完成，EXP +${rewardExp}，学分 +${rewardCredits}${levelText}`);
          }
        });
        return;
      }
      this.showDialogue(
        turnedIn ? quest.completedDialogueId : quest.activeDialogueId,
        turnedIn ? "资料室入口已经开放。" : "先按任务顺序完成教室里的协议修复。",
        { eyebrow: turnedIn ? "M01 · 已完成" : "M01 · 任务进行中", finalLabel: "结束对话" }
      );
    }

    triggerInteraction(node = this.activeInteraction) {
      if (!node) return;
      if (node.type === "worldDrop") {
        this.collectWorldDrop(node.dropId);
        return;
      }
      if (node.type === "bossChest") {
        this.openBossChest();
        return;
      }
      if (node.questGiver) {
        this.triggerQuestGiver(node);
        return;
      }
      if (!this.flagRequirementsMet(node.requiresFlags)) {
        this.showDialogue(node.lockedDialogueId || "ch1_m01_dialogue_exit_locked", "先完成前置目标。");
        return;
      }
      if (node.once && hasFlag(this.nodeDoneFlag(node))) {
        showToast("这个节点已经完成");
        return;
      }
      if (node.type === "teleport") {
        this.transitionToMap(node);
        return;
      }
      this.applyNodeRewards(node);
      this.setInteractionMarkerCompleted(node);
      if (node.dialogueId) this.showDialogue(node.dialogueId);
      if (node.spawnEncounterId) this.spawnEncounter(node.spawnEncounterId);
      if (node.type === "boss") {
        this.startBoss({ x: node.x, y: node.y, force: true });
      }
      if (node.type === "chapter-clear") {
        (node.setFlags || []).forEach(flag => setFlag(flag));
        saveProfile(app.profile);
        renderChapterClearPanel(true);
      }
    }

    openBossChest() {
      if (!this.bossChest?.visible || hasFlag(BOSS_CHEST_FLAG)) return;
      setFlag(BOSS_CHEST_FLAG);
      addInventoryItem({
        id: "ch1_drop_professor_boss_chest",
        name: "教授考核宝箱",
        type: "material",
        quality: "epic",
        description: "完成第一章协议考核后获得的纪念宝箱。",
        qty: 1,
        source: "chapter_boss"
      });
      this.bossChest.setVisible(false).setActive(false);
      claimBossReward();
      renderInteractionPrompt("");
      renderMinimap(this);
    }

    getEncounter(id) {
      return (this.mapData.encounters || []).find(item => item.id === id) || null;
    }

    spawnEncounter(encounterId) {
      const encounter = this.getEncounter(encounterId);
      if (!encounter) return;
      const clearFlags = encounter.setFlagsOnClear || [];
      if (clearFlags.some(flag => hasFlag(flag))) {
        showToast("这组错乱笔记已经清理完毕");
        return;
      }
      let spawned = 0;
      (this.mapData.enemySpawns || [])
        .filter(point => point.group === encounterId)
        .forEach(point => {
          if (this.findLeafSlime(point.id)) return;
          if (this.spawnLeafSlime({ ...point, group: point.group })) spawned += 1;
        });
      showToast(spawned ? `${encounter.title || "遭遇"}：错乱笔记正在实体化` : "这组敌人已经在场上");
    }

    checkEncounterClear(groupId) {
      if (!groupId) return;
      const encounter = this.getEncounter(groupId);
      if (!encounter || this.encounterRewards.has(groupId)) return;
      const alive = (this.leafSlimes?.getChildren?.() || []).some(slime =>
        slime?.active && slime.groupId === groupId && slime.state !== "dead" && slime.state !== "vanish"
      );
      if (alive) return;
      this.encounterRewards.add(groupId);
      (encounter.setFlagsOnClear || []).forEach(flag => setFlag(flag));
      if (encounter.rewardCredits) app.profile.credits += Number(encounter.rewardCredits) || 0;
      if (encounter.rewardExp) grantExperience(Number(encounter.rewardExp) || 0);
      renderHud();
      this.refreshNpcQuestMarkers();
      this.refreshInteractionMarkerVisibility();
      renderMinimap(this);
      showToast(groupId === "ch1_m01_encounter_bug_notes"
        ? `${encounter.title || "遭遇"}完成，返回陆教授处交付任务`
        : `${encounter.title || "遭遇"}完成，区域协议已更新`);
    }

    enterChapterBossArena(node) {
      this.transitionToMap(node);
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
      [
        { key: "lina-attack-charge-start", frames: FOUR_FRAMES, repeat: 0 },
        { key: "lina-attack-charge-loop", frames: CHARGE_LOOP_FRAMES, repeat: -1 },
        { key: "lina-ultimate-cast", frames: ULTIMATE_CAST_FRAMES, repeat: 0 }
      ].forEach(config => {
        if (this.anims.exists(config.key)) return;
        this.anims.create({
          key: config.key,
          frames: this.makeActionFrames("lina", { ...attackAction, frames: config.frames }),
          frameRate: Math.max(1, attackAction.fps * ANIMATION_SPEED_FACTOR),
          repeat: config.repeat
        });
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

    prepareUltimateAnimations() {
      [
        { textureKey: ULTIMATE_BACK_TEXTURE_KEY, animationKey: "lina-ultimate-cyclone-back" },
        { textureKey: ULTIMATE_FRONT_TEXTURE_KEY, animationKey: "lina-ultimate-cyclone-front" }
      ].forEach(({ textureKey, animationKey }) => {
        const texture = this.textures.get(textureKey);
        texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
        if (this.anims.exists(animationKey)) return;
        this.anims.create({
          key: animationKey,
          frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: 7 }),
          frameRate: 13,
          repeat: 0
        });
      });
    }

    getLeafSlimeFrames(row) {
      return Array.from({ length: LEAF_SLIME_COLS }, (_, index) => row * LEAF_SLIME_COLS + index);
    }

    prepareLeafSlimeAnimations() {
      [LEAF_SLIME_KEY, ...CHAPTER_ONE_ENEMY_SPRITES.map(item => item.key)].forEach(textureKey => {
        const texture = this.textures.get(textureKey);
        texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
        [
          { key: "move", row: 0, frameRate: 10, repeat: -1 },
          { key: "attack", row: 1, frameRate: 13, repeat: 0 },
          { key: "hit", row: 2, frameRate: 15, repeat: 0 },
          { key: "dead", row: 3, frameRate: 9, repeat: 0 }
        ].forEach(config => {
          const key = `${textureKey}-${config.key}`;
          if (this.anims.exists(key)) return;
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(textureKey, { frames: this.getLeafSlimeFrames(config.row) }),
            frameRate: config.frameRate,
            repeat: config.repeat
          });
        });
      });
    }

    prepareNpcAnimations() {
      const texture = this.textures.get(PROFESSOR_NPC_KEY);
      texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
      if (this.anims.exists(PROFESSOR_NPC_IDLE_ANIMATION)) return;
      this.anims.create({
        key: PROFESSOR_NPC_IDLE_ANIMATION,
        frames: this.anims.generateFrameNumbers(PROFESSOR_NPC_KEY, { start: 0, end: 3 }),
        frameRate: 3,
        repeat: -1,
        yoyo: true
      });
    }

    preparePortalAnimations() {
      [
        { textureKey: MAP_PORTAL_KEY, animationKey: "ch1-map-portal-loop", frameRate: 9, end: 7 },
        { textureKey: MAP_TRANSFER_RING_KEY, animationKey: "ch1-map-transfer-ring-loop", frameRate: 7, end: 3 },
        { textureKey: BOSS_VOID_PORTAL_KEY, animationKey: "ch1-boss-void-portal-loop", frameRate: 12, end: 7 }
      ].forEach(({ textureKey, animationKey, frameRate, end }) => {
        const texture = this.textures.get(textureKey);
        texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
        if (this.anims.exists(animationKey)) return;
        this.anims.create({
          key: animationKey,
          frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end }),
          frameRate,
          repeat: -1
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

    ensureBossChestTexture() {
      if (this.textures.exists("play-boss-chest")) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x2f2542, 1);
      g.fillRoundedRect(10, 18, 76, 42, 8);
      g.fillStyle(0x7a4a35, 1);
      g.fillRoundedRect(14, 22, 68, 34, 6);
      g.fillStyle(0xf3c75d, 1);
      g.fillRect(13, 31, 70, 5);
      g.fillRect(44, 18, 8, 40);
      g.fillRoundedRect(38, 32, 20, 18, 4);
      g.fillStyle(0x8f72d6, 1);
      g.fillCircle(48, 41, 5);
      g.lineStyle(3, 0xfff2d0, 0.82);
      g.strokeRoundedRect(10, 18, 76, 42, 8);
      g.generateTexture("play-boss-chest", 96, 72);
      g.destroy();
    }

    qualityColor(quality = "common") {
      return {
        common: 0xf4ead5,
        excellent: 0x66cf8c,
        rare: 0x63aef0,
        epic: 0xa67aec,
        legendary: 0xf0a34f,
        mythic: 0xe45b66
      }[quality] || 0xf4ead5;
    }

    rollEnemyDrop(slime) {
      if (slime.dropId) {
        return normalizeInventoryItem({
          id: slime.dropId,
          name: slime.dropName || slime.dropId,
          type: "material",
          quality: slime.rank === "rare" ? "rare" : "excellent",
          source: slime.rank === "rare" ? "rare_elite" : "elite"
        });
      }
      const roll = Math.random();
      if (roll < 0.08) {
        const equipmentId = Math.random() < 0.22 ? "ch1_boost_focus_badge" : "ch1_boost_academic_bookmark";
        return normalizeInventoryItem({ ...ITEM_CATALOG[equipmentId], source: slime.isBossSummon ? "boss_summon" : "monster" });
      }
      if (roll < 0.56) {
        const materials = [
          ITEM_CATALOG.ch1_material_margin_note,
          ITEM_CATALOG.ch1_material_protocol_ink,
          ITEM_CATALOG.ch1_material_campus_token
        ];
        return normalizeInventoryItem({ ...Phaser.Utils.Array.GetRandom(materials), source: slime.isBossSummon ? "boss_summon" : "monster" });
      }
      return null;
    }

    createWorldDropFromEnemy(slime) {
      const item = this.rollEnemyDrop(slime);
      if (!item) return null;
      const now = Date.now();
      const drop = {
        id: `drop-${makeId()}`,
        ownerId: app.profile?.id || "",
        ownerName: app.profile?.name || "玩家",
        mapId: this.getCurrentMapId(),
        x: Math.round(slime.x + Phaser.Math.Between(-18, 18)),
        y: Math.round(slime.y + Phaser.Math.Between(-8, 12)),
        createdAt: now,
        expiresAt: now + WORLD_DROP_TTL_MS,
        item
      };
      if (app.connected) app.multiplayer?.sendDropSpawn(drop);
      else this.syncWorldDrop(drop);
      return item;
    }

    syncWorldDrop(drop) {
      if (!drop?.id || !this.actor) return;
      if (String(drop.mapId || "") !== this.getCurrentMapId()) return;
      if (Number(drop.expiresAt || 0) <= Date.now()) return;
      if (this.worldDrops.has(String(drop.id))) return;
      const item = normalizeInventoryItem(drop.item || {});
      const color = this.qualityColor(item.quality);
      const glow = this.add.circle(0, 0, 30, color, 0.13)
        .setStrokeStyle(2, color, 0.36)
        .setBlendMode(Phaser.BlendModes.ADD);
      const iconKey = item.type === "equipment" ? WORLD_DROP_EQUIPMENT_KEY : WORLD_DROP_MATERIAL_KEY;
      const icon = this.add.image(0, 0, iconKey).setDisplaySize(48, 48);
      const label = this.add.text(0, -31, item.name, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "11px",
        fontStyle: "700",
        color: "#fff7e6",
        stroke: "#21182e",
        strokeThickness: 4
      }).setOrigin(0.5, 1);
      const container = this.add.container(Number(drop.x) || 0, Number(drop.y) || 0, [glow, icon, label])
        .setDepth((Number(drop.y) || 0) + 28);
      this.worldDrops.set(String(drop.id), {
        ...drop,
        item,
        container,
        glow,
        baseY: Number(drop.y) || 0,
        collecting: false
      });
    }

    syncWorldDrops(drops = []) {
      this.clearWorldDrops();
      drops.forEach(drop => this.syncWorldDrop(drop));
    }

    removeWorldDrop(id) {
      const drop = this.worldDrops.get(String(id || ""));
      if (!drop) return;
      drop.container?.destroy(true);
      this.worldDrops.delete(String(id));
      if (this.activeInteraction?.type === "worldDrop" && this.activeInteraction.dropId === String(id)) {
        this.activeInteraction = null;
        renderInteractionPrompt("");
      }
    }

    clearWorldDrops() {
      this.worldDrops.forEach(drop => drop.container?.destroy(true));
      this.worldDrops.clear();
    }

    updateWorldDrops(time) {
      if (time - this.lastWorldDropUpdateAt < 90) return;
      this.lastWorldDropUpdateAt = time;
      const now = Date.now();
      this.worldDrops.forEach((drop, id) => {
        const remaining = Number(drop.expiresAt || 0) - now;
        if (remaining <= 0) {
          this.removeWorldDrop(id);
          return;
        }
        drop.container.y = drop.baseY + Math.sin((time + String(id).length * 97) / 310) * 4;
        drop.container.setDepth(drop.container.y + 28);
        const blinking = remaining <= WORLD_DROP_BLINK_MS;
        drop.container.setAlpha(blinking ? (Math.floor(time / 240) % 2 ? 0.28 : 1) : 1);
        drop.glow?.setScale(1 + Math.sin(time / 420) * 0.08);
      });
    }

    collectWorldDrop(dropId) {
      const drop = this.worldDrops.get(String(dropId || ""));
      if (!drop || drop.collecting) return;
      if (drop.ownerId !== app.profile?.id) {
        showToast("这是其他玩家的掉落物，无法拾取");
        return;
      }
      drop.collecting = true;
      if (app.connected) {
        app.multiplayer?.sendDropCollect(drop.id);
        this.time.delayedCall(1200, () => {
          const current = this.worldDrops.get(drop.id);
          if (current) current.collecting = false;
        });
        return;
      }
      if (addInventoryItem(drop.item)) {
        showToast(`拾取：${drop.item.name}`);
        this.removeWorldDrop(drop.id);
      } else {
        drop.collecting = false;
      }
    }

    ensureBossPortalTextures() {
      // Boss portals are now image-based VFX spritesheets loaded in preload().
    }

    resolveSpawnPoint(spawnId = app.profile?.spawnId) {
      const points = Array.isArray(this.mapData.spawnPoints) ? this.mapData.spawnPoints : [];
      return points.find(point => point.id === spawnId)
        || this.mapData.spawn
        || { id: "runtime-spawn", x: this.worldWidth / 2, y: this.worldHeight / 2 };
    }

    applyMapSpawnFlags(spawn) {
      app.profile.chapterId = this.mapData.chapterId || "chapter1";
      app.profile.mapId = this.mapData.id || "ch1_m01_classroom_spawn";
      app.profile.spawnId = spawn.id || "ch1_m01_spawn_player_start";
      (spawn.setFlags || []).forEach(flag => setFlag(flag));
    }

    createActor() {
      const spawn = this.resolveSpawnPoint();
      this.applyMapSpawnFlags(spawn);
      const character = getCharacter(app.profile.characterId);
      this.actor = this.physics.add.sprite(spawn.x, spawn.y, character.id, 0)
        .setOrigin(0.5, character.baseline / FRAME_SIZE)
        .setScale(ACTOR_DEFAULT_VISUAL_SCALE)
        .setDepth(spawn.y + 8);
      this.actor.body.setSize(34, 42);
      this.actor.body.setOffset(56, 92);
      this.actor.setCollideWorldBounds(true);
      this.actor.play(`${character.id}-idle`, true);
      this.actorShadow = this.add.ellipse(this.actor.x, this.actor.y + 3, 34, 11, 0x182313, 0.16)
        .setDepth(this.actor.y - 24);
    }

    setActorVisualScale(scale = ACTOR_DEFAULT_VISUAL_SCALE) {
      if (!this.actor) return;
      this.actor.setScale(scale);
      if (this.actor.body) {
        this.actor.body.setSize(34, 42);
        this.actor.body.setOffset(56, 92);
      }
    }

    setLinaAttackVisualScale() {
      if (app.profile.characterId === "lina" && !this.isCat) this.setActorVisualScale(LINA_ATTACK_VISUAL_SCALE);
    }

    resetActorVisualScale() {
      this.setActorVisualScale(ACTOR_DEFAULT_VISUAL_SCALE);
    }

    createMapNpcs() {
      this.mapNpcs = [];
      (this.mapData?.npcs || []).forEach(item => {
        const textureKey = item.textureKey || PROFESSOR_NPC_KEY;
        if (!this.textures.exists(textureKey)) return;
        const x = Number(item.x) || 0;
        const y = Number(item.y) || 0;
        const shadowOffsetY = Number.isFinite(Number(item.shadowOffsetY)) ? Number(item.shadowOffsetY) : 6;
        const shadow = this.add.ellipse(x, y + shadowOffsetY, Number(item.shadowWidth) || 84, Number(item.shadowHeight) || 24, 0x24425c, 0.18)
          .setDepth(y - 1);
        const sprite = this.add.sprite(x, y, textureKey, 0)
          .setOrigin(Number(item.originX) || 0.5, Number(item.originY) || 0.92)
          .setScale(Number(item.scale) || 0.6)
          .setDepth(Number(item.depth) || y + 4);
        const animationKey = item.animationKey || (textureKey === PROFESSOR_NPC_KEY ? PROFESSOR_NPC_IDLE_ANIMATION : "");
        if (item.animate !== false && animationKey && this.anims.exists(animationKey)) sprite.play(animationKey);
        if (item.breathe !== false) {
          const scale = Number(item.scale) || 0.6;
          sprite.breatheTween = this.tweens.add({
            targets: sprite,
            scaleY: scale * (Number(item.breatheScale) || 1.014),
            duration: Number(item.breatheDuration) || 1350,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        }
        const label = item.showLabel === false
          ? null
          : this.add.text(x, y + (Number(item.labelOffsetY) || -158), item.label || "NPC", {
            fontFamily: "Microsoft YaHei, sans-serif",
            fontSize: "13px",
            fontStyle: "700",
            color: "#2d2438",
            backgroundColor: "rgba(255,255,255,.82)",
            padding: { x: 7, y: 3 }
          }).setOrigin(0.5, 1).setDepth(Number(item.depth) || y + 6);
        this.mapNpcs.push({ item, shadow, sprite, label });
      });
    }

    refreshNpcQuestMarkers() {
      (this.mapNpcs || []).forEach(entry => {
        if (entry.questMarker) {
          this.tweens.killTweensOf(entry.questMarker);
          entry.questMarker.destroy(true);
          entry.questMarker = null;
        }
      });
      (this.interactionNodes || [])
        .filter(node => node.questGiver && node.npcId)
        .forEach(node => {
          const quest = node.questGiver;
          const accepted = hasFlag(quest.acceptFlag);
          const completed = hasFlag(quest.completeFlag);
          const turnedIn = hasFlag(quest.turnInFlag);
          const symbol = !accepted ? "!" : (completed && !turnedIn ? "?" : "");
          if (!symbol) return;
          const npc = (this.mapNpcs || []).find(entry => entry.item.id === node.npcId);
          if (!npc) return;
          const color = symbol === "!" ? 0xf3c75d : 0x5ed2df;
          const markerY = Number(npc.item.y) + (Number(node.questMarkerOffsetY) || -222);
          const glow = this.add.circle(0, 0, 29, color, 0.18)
            .setStrokeStyle(2, color, 0.42);
          const plate = this.add.circle(0, 0, 20, 0x21182e, 0.94)
            .setStrokeStyle(3, color, 0.96);
          const text = this.add.text(0, -1, symbol, {
            fontFamily: "Microsoft YaHei, sans-serif",
            fontSize: "28px",
            fontStyle: "900",
            color: symbol === "!" ? "#fff1a8" : "#c8fbff",
            stroke: "#21182e",
            strokeThickness: 3
          }).setOrigin(0.5);
          const marker = this.add.container(Number(npc.item.x), markerY, [glow, plate, text])
            .setDepth((Number(npc.sprite.depth) || Number(npc.item.y)) + 80);
          npc.questMarker = marker;
          this.tweens.add({
            targets: marker,
            y: markerY - 7,
            duration: 780,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        });
    }

    clearRuntimeMapObjects() {
      this.ambientEnemyRefreshTimer?.remove(false);
      this.ambientEnemyRefreshTimer = null;
      this.mapProps?.forEach(prop => prop.destroy());
      this.mapProps = [];
      this.foregroundOverlays?.forEach(item => item.destroy());
      this.foregroundOverlays = [];
      this.interactionMarkers?.forEach(item => {
        item.marker?.destroy();
        item.label?.destroy();
      });
      this.interactionMarkers = [];
      this.mapNpcs?.forEach(item => {
        if (item.questMarker) this.tweens.killTweensOf(item.questMarker);
        if (item.sprite) this.tweens.killTweensOf(item.sprite);
        item.questMarker?.destroy(true);
        item.shadow?.destroy();
        item.sprite?.destroy();
        item.label?.destroy();
      });
      this.mapNpcs = [];
      this.mapLayers?.forEach(layer => layer?.destroy?.());
      this.mapLayers = [];
      this.mapBackgroundChunks?.forEach(chunk => chunk.destroy());
      this.mapBackgroundChunks = [];
      this.mapBackground?.destroy();
      this.mapBackground = null;
      this.clearWorldDrops();
      this.collisionDebugGraphics?.destroy();
      this.collisionDebugGraphics = null;
      this.collisionDebugRects = [];
      this.obstacleGroup?.clear(true, true);
      this.projectiles?.children?.each(projectile => this.destroyProjectile(projectile, false));
      this.leafSlimes?.children?.each(slime => {
        slime.shadow?.destroy();
        slime.hpBg?.destroy();
        slime.hpFrame?.destroy();
        slime.hpFill?.destroy();
        slime.nameLabel?.destroy();
        slime.destroy();
      });
      this.syncedSlimeIds?.clear();
      this.bossSummonIds?.clear();
      this.bossChest?.setVisible(false).setActive(false);
      this.bossSprite?.setVisible(false).setActive(false);
      syncBossState({ ...BOSS });
    }

    ensureMapAssetsLoaded(mapId) {
      const queued = queueChapterMapAssets(this, this.chapterMapRegistry, mapId);
      if (!queued.length) return Promise.resolve();
      const queuedKeys = new Set(queued.map(item => item.key));
      const sceneQueuedKeys = getQueuedMapImageKeys(this);
      return new Promise((resolve, reject) => {
        const failedKeys = new Set();
        const onLoadError = file => {
          if (queuedKeys.has(file?.key)) failedKeys.add(file.key);
        };
        const onComplete = () => {
          this.load.off("loaderror", onLoadError);
          if (!failedKeys.size) {
            resolve();
            return;
          }
          failedKeys.forEach(key => sceneQueuedKeys.delete(key));
          reject(new Error(`Map assets failed: ${Array.from(failedKeys).join(", ")}`));
        };
        this.load.on("loaderror", onLoadError);
        this.load.once("complete", onComplete);
        this.load.start();
      });
    }

    transitionToMap(node) {
      const targetMapId = node.targetMapId || this.getCurrentMapId();
      const maps = this.getChapterMapRegistry();
      if (!maps[targetMapId]) {
        showToast("目标地图暂未接入");
        return;
      }
      if (this.mapTransitioning) return;
      this.mapTransitioning = true;
      this.isActionLocked = true;
      this.actor?.body?.setVelocity(0, 0);
      showMapLoading(`前往${maps[targetMapId].title || "新区域"}`);
      const transitionStartedAt = performance.now();
      this.ensureMapAssetsLoaded(targetMapId).then(() => {
        const wait = Math.max(0, 620 - (performance.now() - transitionStartedAt));
        this.time.delayedCall(wait, () => {
          (node.setFlags || []).forEach(flag => setFlag(flag));
          app.profile.mapId = targetMapId;
          app.profile.spawnId = node.targetSpawnId || maps[targetMapId].spawn?.id || "";
          app.audio?.syncMap(targetMapId);
          this.clearRuntimeMapObjects();
          this.mapData = this.composeRuntimeMapData(targetMapId);
          this.renderTileMap();
          this.prepareMapPropFrames();
          this.renderMapProps();
          this.renderForegroundOverlays();
          this.drawObstacles();
          const spawn = this.resolveSpawnPoint(app.profile.spawnId);
          this.applyMapSpawnFlags(spawn);
          this.actor.setPosition(spawn.x, spawn.y);
          this.actor.body.setVelocity(0, 0);
          this.actor.setCollideWorldBounds(true);
          this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
          this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
          this.cameras.main.pan(spawn.x, spawn.y, 320, "Sine.easeInOut");
          this.bindMapColliders();
          this.createMapNpcs();
          this.createInteractionNodes();
          this.spawnMapLeafSlimes();
          this.scheduleAmbientEnemyRefresh();
          app.multiplayer?.syncDropsForCurrentMap();
          saveProfile(app.profile);
          renderChapterHud();
          renderMinimap(this);
          this.mapTransitioning = false;
          this.isActionLocked = false;
          hideMapLoading();
          showToast(`进入${this.mapData.title || "新区域"}`);
        });
      }).catch(error => {
        console.error("Map asset loading failed", error);
        this.mapTransitioning = false;
        this.isActionLocked = false;
        hideMapLoading();
        showToast("地图资源加载失败，请检查网络后重试");
      });
    }

    createBoss() {
      this.bossSprite = this.physics.add.image(0, 0, BOSS_KEY)
        .setOrigin(0.5, 0.72)
        .setScale(BOSS_VISUAL_SCALE)
        .setVisible(false)
        .setActive(false)
        .setDepth(0);
      this.bossSprite.body.setAllowGravity(false);
      this.bossSprite.body.setImmovable(true);
      this.bossChest = this.physics.add.image(0, 0, "play-boss-chest")
        .setOrigin(0.5, 0.82)
        .setScale(1.05)
        .setVisible(false)
        .setActive(false)
        .setDepth(0);
      this.bossChest.body.setAllowGravity(false);
      this.bossChest.body.setImmovable(true);
      this.ensureBossPortalTextures();
    }

    syncBoss() {
      if (!this.bossSprite) return;
      const visiblePhases = new Set(["summoning", "between", "portalOpening", "portalClosing"]);
      if (!app.boss.active && !visiblePhases.has(app.boss.phase)) {
        this.bossSprite.setVisible(false).setActive(false);
        return;
      }
      this.bossSprite
        .setPosition(app.boss.x, app.boss.y)
        .setVisible(true)
        .setActive(true)
        .setDepth(app.boss.y + 18);
    }

    startBoss(options = {}) {
      if (!options.force && getProtocolCardIds().length < CHAPTER_ONE_PROTOCOL_CARD_GOAL) {
        showToast("协议卡不足也可挑战，但稀有精英会更难处理");
      }
      const x = Number.isFinite(options.x) ? options.x : clamp(this.actor.x + 420, 420, this.worldWidth - 420);
      const y = Number.isFinite(options.y) ? options.y : clamp(this.actor.y - 70, 640, this.worldHeight - 420);
      const firstWave = BOSS_SUMMON_WAVES[0];
      const boss = {
        ...BOSS,
        active: true,
        maxHp: firstWave.units.length,
        hp: firstWave.units.length,
        x,
        y,
        phase: "summoning",
        waveIndex: 0,
        waveTitle: firstWave.title,
        wavesTotal: BOSS_SUMMON_WAVES.length,
        summonsRemaining: firstWave.units.length,
        eliteRemaining: firstWave.units.filter(unit => unit.rank !== "mob").length,
        chestReady: false
      };
      app.bossRewardClaimed = false;
      setFlag(BOSS_CHEST_FLAG, false);
      this.bossWavePending = false;
      this.bossChest?.setVisible(false).setActive(false);
      if (app.connected) app.multiplayer.sendBossStart(boss);
      syncBossState(boss);
      this.beginBossWaveSequence(0);
      app.audio.boss();
      showToast("陆教授开启三系协议考核：量子、区块链、AI Agent");
      return boss;
    }

    playBossCastAnimation() {
      if (!this.bossSprite?.visible) return;
      this.tweens.killTweensOf(this.bossSprite);
      this.tweens.add({
        targets: this.bossSprite,
        y: app.boss.y - 10,
        scale: BOSS_VISUAL_SCALE * 1.08,
        angle: -2,
        yoyo: true,
        repeat: 1,
        duration: 260,
        ease: "Sine.easeInOut",
        onComplete: () => {
          this.bossSprite?.setPosition(app.boss.x, app.boss.y).setScale(BOSS_VISUAL_SCALE).setAngle(0);
        }
      });
      const aura = this.add.circle(app.boss.x, app.boss.y - 112, 22, 0x8f72d6, 0.22)
        .setStrokeStyle(3, 0x5ed2df, 0.68)
        .setDepth(app.boss.y + 26);
      this.tweens.add({
        targets: aura,
        radius: 86,
        alpha: 0,
        duration: 620,
        ease: "Sine.easeOut",
        onComplete: () => aura.destroy()
      });
    }

    createBossPortal(wave) {
      const x = clamp(app.boss.x, 150, this.worldWidth - 150);
      const y = clamp(app.boss.y + 130, 160, this.worldHeight - 130);
      const portal = this.add.sprite(x, y, BOSS_VOID_PORTAL_KEY)
        .setOrigin(0.5)
        .setScale(0.28)
        .setAlpha(0)
        .setDepth(y + 34)
        .play("ch1-boss-void-portal-loop");
      this.bossPortal = { portal, x, y };
      this.tweens.add({ targets: portal, alpha: 0.96, scale: 1.18, duration: BOSS_PORTAL_OPEN_MS, ease: "Sine.easeOut" });
      return this.bossPortal;
    }

    closeBossPortal() {
      const portal = this.bossPortal;
      if (!portal) return;
      this.tweens.add({ targets: portal.portal, alpha: 0, scale: 0.24, duration: BOSS_PORTAL_CLOSE_MS, ease: "Sine.easeIn", onComplete: () => portal.portal.destroy() });
      this.bossPortal = null;
    }

    beginBossWaveSequence(index) {
      const wave = BOSS_SUMMON_WAVES[index];
      if (!wave || !app.boss.active) return;
      this.bossWavePending = true;
      syncBossState({ ...app.boss, phase: "portalOpening", waveIndex: index, waveTitle: wave.title });
      this.playBossCastAnimation();
      const portal = this.createBossPortal(wave);
      showToast(`陆教授正在展开${wave.title}传送门`);
      this.time.delayedCall(BOSS_PORTAL_OPEN_MS, () => {
        if (!app.boss.active) return;
        this.spawnBossWave(index, { fromPortal: true, portal });
        this.time.delayedCall(BOSS_PORTAL_EGRESS_MS + wave.units.length * BOSS_PORTAL_STAGGER_MS + 120, () => {
          this.closeBossPortal();
          syncBossState({ ...app.boss, phase: "summoning" });
          this.bossWavePending = false;
          this.updateBossSummonState();
        });
      });
    }

    spawnBossWave(index, options = {}) {
      const wave = BOSS_SUMMON_WAVES[index];
      if (!wave || !app.boss.active) return;
      if (!options.fromPortal) this.bossWavePending = false;
      this.bossSummonIds.clear();
      syncBossState({
        ...app.boss,
        active: true,
        phase: "summoning",
        waveIndex: index,
        waveTitle: wave.title,
        maxHp: wave.units.length,
        hp: wave.units.length,
        summonsRemaining: wave.units.length,
        eliteRemaining: wave.units.filter(unit => unit.rank !== "mob").length,
        chestReady: false
      });
      wave.units.forEach((unit, unitIndex) => {
        const targetX = clamp(app.boss.x + unit.dx, 96, this.worldWidth - 96);
        const targetY = clamp(app.boss.y + unit.dy, 120, this.worldHeight - 96);
        const spawnX = options.fromPortal ? options.portal?.x || app.boss.x : targetX;
        const spawnY = options.fromPortal ? options.portal?.y || app.boss.y + 120 : targetY;
        const slime = this.spawnLeafSlime({
          id: `ch1-boss-${wave.id}-${unit.rank}-${unitIndex}`,
          x: spawnX,
          y: spawnY,
          targetX,
          targetY,
          emerging: !!options.fromPortal,
          emergeDelay: unitIndex * BOSS_PORTAL_STAGGER_MS,
          group: BOSS_SUMMON_GROUP,
          bossSummon: true,
          elite: unit.rank !== "mob",
          bossWaveId: wave.id,
          bossWaveTitle: wave.title,
          rank: unit.rank,
          label: unit.label,
          textureKey: unit.textureKey,
          staticImage: unit.staticImage,
          tint: unit.tint,
          scale: unit.scale,
          maxHp: unit.maxHp,
          damage: unit.damage,
          creditDefense: unit.creditDefense,
          rewardExp: unit.rewardExp,
          rewardCredits: unit.rewardCredits,
          dropId: unit.dropId,
          dropName: unit.dropName
        });
        if (slime) this.bossSummonIds.add(slime.slimeId);
      });
      showToast(`第 ${index + 1} 波：${wave.title}召唤物出现`);
      this.updateBossSummonState();
    }

    updateBossSummonState() {
      if (!app.boss.active || app.boss.phase !== "summoning") return;
      const alive = (this.leafSlimes?.getChildren?.() || []).filter(slime =>
        slime?.active && slime.groupId === BOSS_SUMMON_GROUP && slime.state !== "dead" && slime.state !== "vanish"
      );
      syncBossState({
        ...app.boss,
        hp: alive.length,
        summonsRemaining: alive.length,
        eliteRemaining: alive.filter(slime => slime.isElite).length
      });
      if (alive.length > 0 || this.bossWavePending) return;
      const nextIndex = Number(app.boss.waveIndex || 0) + 1;
      if (nextIndex < BOSS_SUMMON_WAVES.length) {
        this.bossWavePending = true;
        const nextWave = BOSS_SUMMON_WAVES[nextIndex];
        syncBossState({
          ...app.boss,
          phase: "between",
          waveIndex: nextIndex,
          waveTitle: nextWave.title,
          hp: 0,
          summonsRemaining: 0,
          eliteRemaining: 0
        });
        showToast(`${BOSS_SUMMON_WAVES[nextIndex - 1].title}已清除，下一波即将开始`);
        this.time.delayedCall(900, () => this.beginBossWaveSequence(nextIndex));
        return;
      }
      this.prepareBossChest();
    }

    prepareBossChest() {
      if (!app.boss.active || app.boss.phase === "chest") return;
      const chestX = clamp(app.boss.x + 18, 120, this.worldWidth - 120);
      const chestY = clamp(app.boss.y + 160, 120, this.worldHeight - 120);
      this.bossSprite?.setVisible(false).setActive(false);
      this.bossChest
        ?.setPosition(chestX, chestY)
        .setVisible(true)
        .setActive(true)
        .setDepth(chestY + 16);
      syncBossState({ ...app.boss, active: false, hp: 0, phase: "chest", chestReady: true });
      showToast("召唤物已清除，Boss 宝箱出现了");
      renderMinimap(this);
    }

    findLeafSlime(id) {
      if (!id || !this.leafSlimes) return null;
      return (this.leafSlimes.getChildren?.() || []).find(slime => slime?.active && slime.slimeId === id) || null;
    }

    getMapLeafSlimeSpawns() {
      const spawns = this.mapData?.enemySpawns || this.mapData?.slimeSpawns;
      if (Array.isArray(spawns) && spawns.length) {
        return spawns.filter(point => {
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
          if (point.activeAfter && !hasFlag(point.activeAfter)) return false;
          if (point.group && this.getEncounter(point.group)?.setFlagsOnClear?.some(flag => hasFlag(flag))) return false;
          return true;
        });
      }
      const spawn = this.mapData?.spawn || { x: this.worldWidth / 2, y: this.worldHeight / 2 };
      return [
        { id: "leaf-slime-west", x: spawn.x - 520, y: spawn.y + 12 },
        { id: "leaf-slime-east", x: spawn.x + 520, y: spawn.y + 12 },
        { id: "leaf-slime-north", x: spawn.x, y: spawn.y - 448 },
        { id: "leaf-slime-south", x: spawn.x, y: spawn.y + 512 }
      ];
    }

    spawnMapLeafSlimes() {
      this.getMapLeafSlimeSpawns().forEach(point => {
        this.spawnLeafSlime({
          ...point,
          id: point.id,
          x: point.x,
          y: point.y,
          group: point.group
        });
      });
    }

    getAmbientEnemyRefreshConfig() {
      const config = this.mapData?.ambientEnemyRefresh;
      return config && Array.isArray(config.enemies) && config.enemies.length ? config : null;
    }

    pointBlockedForAmbientEnemy(x, y, padding = 58) {
      if ((this.collisionDebugRects || []).some(rect =>
        x >= rect.x - padding
        && x <= rect.x + rect.w + padding
        && y >= rect.y - padding
        && y <= rect.y + rect.h + padding
      )) return true;
      if ((this.mapNpcs || []).some(npc => Math.hypot(x - npc.sprite.x, y - npc.sprite.y) < 150)) return true;
      return (this.interactionNodes || []).some(node => Math.hypot(x - node.x, y - node.y) < 125);
    }

    getRandomAmbientEnemyPoint(config) {
      const bounds = config.spawnBounds || {};
      const left = clamp(Number(bounds.x) || 96, 72, this.worldWidth - 72);
      const top = clamp(Number(bounds.y) || 96, 96, this.worldHeight - 96);
      const right = clamp(left + (Number(bounds.width) || this.worldWidth - left * 2), left, this.worldWidth - 72);
      const bottom = clamp(top + (Number(bounds.height) || this.worldHeight - top * 2), top, this.worldHeight - 96);
      const avoidPlayerRadius = Math.max(160, Number(config.avoidPlayerRadius) || 280);
      for (let attempt = 0; attempt < 28; attempt += 1) {
        const x = Phaser.Math.Between(Math.ceil(left), Math.floor(right));
        const y = Phaser.Math.Between(Math.ceil(top), Math.floor(bottom));
        if (this.actor && Math.hypot(x - this.actor.x, y - this.actor.y) < avoidPlayerRadius) continue;
        if (this.pointBlockedForAmbientEnemy(x, y)) continue;
        return { x, y };
      }
      return null;
    }

    spawnAmbientEnemyWave() {
      const config = this.getAmbientEnemyRefreshConfig();
      if (!config || this.mapTransitioning || !this.actor?.active) return 0;
      const alive = (this.leafSlimes?.getChildren?.() || []).filter(enemy =>
        enemy?.active && enemy.ambientWander && enemy.state !== "dead" && enemy.state !== "vanish"
      ).length;
      const available = Math.max(0, (Number(config.maxAlive) || 10) - alive);
      if (!available) return 0;
      const minimum = Math.max(1, Number(config.minCount) || 1);
      const maximum = Math.max(minimum, Number(config.maxCount) || 3);
      const count = Math.min(available, Phaser.Math.Between(minimum, maximum));
      let spawned = 0;
      for (let index = 0; index < count; index += 1) {
        const point = this.getRandomAmbientEnemyPoint(config);
        if (!point) continue;
        const enemy = Phaser.Utils.Array.GetRandom(config.enemies);
        this.ambientEnemySequence += 1;
        if (this.spawnLeafSlime({
          ...enemy,
          ...point,
          id: `ambient-${this.getCurrentMapId()}-${this.ambientEnemySequence}`,
          ambientWander: true,
          passiveWander: true,
          smoothMovement: true
        })) spawned += 1;
      }
      return spawned;
    }

    scheduleAmbientEnemyRefresh() {
      this.ambientEnemyRefreshTimer?.remove(false);
      this.ambientEnemyRefreshTimer = null;
      const config = this.getAmbientEnemyRefreshConfig();
      if (!config) return;
      this.ambientEnemyRefreshTimer = this.time.addEvent({
        delay: Math.max(10000, Number(config.intervalMs) || 60000),
        loop: true,
        callback: () => this.spawnAmbientEnemyWave()
      });
    }

    getNextLeafSlimePoint() {
      if (!this.leafSlimes) return null;
      const points = this.getMapLeafSlimeSpawns();
      if (!points.length) return null;
      const activeSlimes = this.leafSlimes.getChildren?.() || [];
      for (const point of points) {
        const occupied = activeSlimes.some(slime =>
          slime?.active
          && slime.state !== "dead"
          && slime.state !== "vanish"
          && Math.hypot(slime.x - point.x, slime.y - point.y) < 96
        );
        if (!occupied) return point;
      }
      return points[activeSlimes.length % points.length];
    }

    playEnemyAnimation(slime, action, restart = false) {
      if (!slime?.active || slime.staticImage) return;
      const key = `${slime.textureKey || LEAF_SLIME_KEY}-${action}`;
      if (this.anims.exists(key)) slime.play(key, restart);
    }

    getEnemyRankStyle(slime) {
      if (slime.rank === "rare") return { frame: 0xf3c75d, fill: 0xffcf5d, text: "#ffe9a8", width: 78, height: 9 };
      if (slime.rank === "elite") return { frame: 0x8f72d6, fill: 0xb889ff, text: "#dbcfff", width: 66, height: 8 };
      return { frame: 0x3f5368, fill: 0x42c98a, text: "#ffffff", width: 56, height: 6 };
    }

    createEnemyHud(slime) {
      const style = this.getEnemyRankStyle(slime);
      const y = slime.y + slime.hudOffsetY;
      slime.hpFrame = this.add.rectangle(slime.x, y, style.width + 6, style.height + 6, 0x241b2e, 0.72)
        .setStrokeStyle(slime.rank === "rare" ? 2 : 1, style.frame, 0.95)
        .setDepth(slime.y + 36);
      slime.hpBg = this.add.rectangle(slime.x, y, style.width, style.height, 0x1d1826, 0.72)
        .setDepth(slime.y + 37);
      slime.hpFill = this.add.rectangle(slime.x - style.width / 2, y, style.width, Math.max(3, style.height - 2), style.fill, 0.95)
        .setOrigin(0, 0.5)
        .setDepth(slime.y + 38);
      if (slime.rank !== "mob" || slime.displayLabel) {
        slime.nameLabel = this.add.text(slime.x, y - 12, slime.displayLabel || (slime.rank === "rare" ? "稀有精英" : "精英"), {
          fontFamily: "Microsoft YaHei, sans-serif",
          fontSize: slime.rank === "rare" ? "12px" : "11px",
          fontStyle: "700",
          color: style.text,
          stroke: "#241b2e",
          strokeThickness: 3
        }).setOrigin(0.5, 1).setDepth(slime.y + 39);
      }
    }

    refreshEnemyHpBar(slime) {
      if (!slime?.active || !slime.hpFill) return;
      const style = this.getEnemyRankStyle(slime);
      const ratio = clamp((slime.hp || 0) / Math.max(1, slime.maxHp || 1), 0, 1);
      const visible = slime.state !== "dead"
        && slime.state !== "vanish"
        && slime.state !== "emerging"
        && (!slime.hideHudUntilProvoked || this.time.now < slime.provokedUntil);
      const fingerprint = `${Math.round(ratio * 1000)}:${visible}`;
      if (slime.hudFingerprint === fingerprint) return;
      slime.hudFingerprint = fingerprint;
      slime.hpFill.setDisplaySize(Math.max(1, style.width * ratio), Math.max(3, style.height - 2));
      [slime.hpFrame, slime.hpBg, slime.hpFill, slime.nameLabel].forEach(item => item?.setVisible(visible));
    }

    updateEnemyHud(slime) {
      if (!slime?.active || !slime.hpFrame) return;
      const style = this.getEnemyRankStyle(slime);
      const y = slime.y + slime.hudOffsetY;
      if (slime.lastHudX === slime.x && slime.lastHudY === y) {
        this.refreshEnemyHpBar(slime);
        return;
      }
      slime.lastHudX = slime.x;
      slime.lastHudY = y;
      slime.hpFrame.setPosition(slime.x, y).setDepth(slime.y + 36);
      slime.hpBg.setPosition(slime.x, y).setDepth(slime.y + 37);
      slime.hpFill.setPosition(slime.x - style.width / 2, y).setDepth(slime.y + 38);
      slime.nameLabel?.setPosition(slime.x, y - 12).setDepth(slime.y + 39);
      this.refreshEnemyHpBar(slime);
    }

    spawnLeafSlime(options = {}) {
      if (!this.actor || !this.leafSlimes) return null;
      const slimeId = String(options.id || makeId());
      const existing = this.findLeafSlime(slimeId);
      if (existing) return existing;
      const point = Number.isFinite(options.x) && Number.isFinite(options.y)
        ? { x: options.x, y: options.y }
        : this.getNextLeafSlimePoint();
      if (!point) return null;
      const x = clamp(point.x, 72, Math.max(72, this.worldWidth - 72));
      const y = clamp(point.y, 96, Math.max(96, this.worldHeight - 96));
      const rank = options.rank || (options.elite ? "elite" : "mob");
      const elite = !!options.elite || rank === "elite" || rank === "rare";
      const visualScale = Number(options.scale) || (elite ? 1.18 : 0.9);
      const textureKey = options.textureKey || LEAF_SLIME_KEY;
      const slime = this.leafSlimes.create(x, y, textureKey, options.staticImage ? undefined : 0)
        .setOrigin(0.5, 0.72)
        .setScale(visualScale)
        .setDepth(y + 6);
      slime.slimeId = slimeId;
      slime.ownerId = options.ownerId || app.profile?.id || "";
      slime.groupId = options.group || "";
      slime.isBossSummon = !!options.bossSummon;
      slime.isElite = elite;
      slime.rank = rank;
      slime.bossWaveId = options.bossWaveId || "";
      slime.bossWaveTitle = options.bossWaveTitle || "";
      slime.displayLabel = options.label || "";
      slime.rewardExp = Number(options.rewardExp) || 0;
      slime.rewardCredits = Number(options.rewardCredits) || 0;
      slime.dropId = options.dropId || "";
      slime.dropName = options.dropName || "";
      slime.baseTint = Number(options.tint) || (elite ? 0xffd56b : 0xffffff);
      slime.textureKey = textureKey;
      slime.staticImage = !!options.staticImage;
      slime.smoothMovement = options.smoothMovement === true
        || textureKey === MAGIC_BROOM_KEY
        || textureKey === BITING_MAGIC_BOOK_KEY;
      slime.ambientWander = !!options.ambientWander;
      slime.passiveWander = !!options.passiveWander;
      slime.provokedUntil = 0;
      slime.hideHudUntilProvoked = slime.passiveWander;
      slime.wanderSpeed = Math.max(18, Number(options.wanderSpeed) || (textureKey === BITING_MAGIC_BOOK_KEY ? 30 : 34));
      slime.chaseSpeed = Math.max(slime.wanderSpeed, Number(options.chaseSpeed) || (textureKey === BITING_MAGIC_BOOK_KEY ? 44 : 48));
      slime.aggroRange = Math.max(120, Number(options.aggroRange) || 300);
      slime.wanderTargetX = x;
      slime.wanderTargetY = y;
      slime.wanderUntil = 0;
      const configuredMaxHp = Math.max(1, Number(options.maxHp) || Number(options.hp) || (rank === "rare" ? 260 : rank === "elite" ? 150 : 72));
      const mobHealthMultiplier = rank === "mob" ? 2 : 1;
      slime.maxHp = configuredMaxHp * mobHealthMultiplier;
      const incomingHp = Number(options.hp);
      const currentHp = Number.isFinite(incomingHp)
        ? incomingHp * (options.maxHp ? 1 : mobHealthMultiplier)
        : slime.maxHp;
      slime.hp = clamp(currentHp, 0, slime.maxHp);
      slime.damage = Math.max(1, Number(options.damage) || (rank === "rare" ? 16 : rank === "elite" ? 12 : 8));
      slime.creditDefense = Math.max(0, Number(options.creditDefense || 0));
      slime.hudOffsetY = options.staticImage ? Number(options.hudOffsetY || -Math.max(104, slime.displayHeight * 0.62)) : -104;
      if (options.staticImage) {
        const bodyWidth = Number(options.bodyWidth) || Math.max(38, Math.min(124, slime.width * 0.26));
        const bodyHeight = Number(options.bodyHeight) || Math.max(28, Math.min(82, slime.height * 0.15));
        const bodyOffsetX = Number.isFinite(options.bodyOffsetX) ? options.bodyOffsetX : (slime.width - bodyWidth) / 2;
        const bodyOffsetY = Number.isFinite(options.bodyOffsetY) ? options.bodyOffsetY : slime.height * 0.72 - bodyHeight / 2;
        slime.body.setSize(bodyWidth, bodyHeight);
        slime.body.setOffset(bodyOffsetX, bodyOffsetY);
      } else {
        slime.body.setSize(54, 34);
        slime.body.setOffset(37, 70);
      }
      slime.body.setAllowGravity(false);
      slime.body.setCollideWorldBounds(true);
      slime.state = "move";
      slime.nextHopAt = 0;
      slime.lastAttackAt = -LEAF_SLIME_ATTACK_COOLDOWN;
      slime.actionToken = 0;
      this.playEnemyAnimation(slime, "move", true);
      if (slime.staticImage) {
        this.tweens.add({
          targets: slime,
          angle: rank === "mob" ? 2.5 : 1.5,
          duration: 880 + Math.random() * 240,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1
        });
      }
      if (slime.baseTint !== 0xffffff) slime.setTint(slime.baseTint);
      slime.shadow = this.add.ellipse(slime.x, slime.y + 12, 58, 18, 0x182313, 0.18)
        .setDepth(slime.y - 24);
      this.createEnemyHud(slime);
      this.refreshEnemyHpBar(slime);
      if (options.emerging) {
        slime.state = "emerging";
        slime.body.enable = false;
        slime.setAlpha(0);
        slime.setScale(visualScale * 0.45);
        [slime.shadow, slime.hpBg, slime.hpFrame, slime.hpFill, slime.nameLabel].forEach(item => item?.setVisible(false));
        const targetX = Number.isFinite(options.targetX) ? options.targetX : x;
        const targetY = Number.isFinite(options.targetY) ? options.targetY : y;
        const delay = Math.max(0, Number(options.emergeDelay || 0));
        this.time.delayedCall(delay, () => {
          if (!slime.active || slime.state !== "emerging") return;
          slime.setAlpha(1);
          this.tweens.add({
            targets: slime,
            x: targetX,
            y: targetY,
            scale: visualScale,
            duration: BOSS_PORTAL_EGRESS_MS,
            ease: "Sine.easeOut",
            onUpdate: () => {
              slime.setDepth(slime.y + 6);
              slime.shadow?.setPosition(slime.x, slime.y + 12).setDepth(slime.y - 24);
              this.updateEnemyHud(slime);
            },
            onComplete: () => {
              if (!slime.active || slime.state !== "emerging") return;
              slime.body.enable = true;
              slime.body.reset(targetX, targetY);
              slime.state = "move";
              [slime.shadow, slime.hpBg, slime.hpFrame, slime.hpFill, slime.nameLabel].forEach(item => item?.setVisible(true));
              this.playEnemyAnimation(slime, "move", true);
              this.refreshEnemyHpBar(slime);
            }
          });
        });
      }
      this.syncedSlimeIds.add(slimeId);
      if (options.broadcast && app.connected) {
        app.multiplayer.sendSlimeSpawn({ id: slimeId, x, y });
      }
      return slime;
    }

    syncSlimeSpawn(slime) {
      if (!slime?.id) return;
      this.spawnLeafSlime({
        id: String(slime.id),
        x: Number(slime.x),
        y: Number(slime.y),
        ownerId: String(slime.ownerId || ""),
        broadcast: false
      });
    }

    syncSlimes(slimes) {
      slimes.forEach(slime => this.syncSlimeSpawn(slime));
    }

    syncSlimeRemove(id) {
      const slime = this.findLeafSlime(String(id || ""));
      if (!slime) return;
      this.syncedSlimeIds.delete(slime.slimeId);
      slime.shadow?.destroy();
      slime.hpBg?.destroy();
      slime.hpFrame?.destroy();
      slime.hpFill?.destroy();
      slime.nameLabel?.destroy();
      slime.destroy();
    }

    bindActorLeafSlimeCollision() {
      if (!this.actor || !this.leafSlimes) return;
      this.actorLeafSlimeCollider?.destroy?.();
      this.actorLeafSlimeCollider = this.physics.add.collider(this.actor, this.leafSlimes);
    }

    playLoop(actionId) {
      if (!this.actor || this.isCasting || this.isDead || this.isActionLocked) return;
      if (this.isCatJumping) return;
      this.resetActorVisualScale();
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
      this.beginPrimaryActionHold();
      this.releasePrimaryActionHold();
    }

    beginPrimaryActionHold() {
      if (this.primaryHold) return;
      if (this.isCat || app.profile.characterId !== "lina") {
        this.triggerPrimaryActionImmediate();
        return;
      }
      this.startLinaAttackHold();
    }

    releasePrimaryActionHold() {
      if (!this.primaryHold) return;
      const hold = this.primaryHold;
      hold.released = true;
      if (this.time.now - hold.startedAt >= CHARGE_HOLD_THRESHOLD) hold.charged = true;
      if (hold.startComplete || this.actor?.anims?.currentAnim?.key === "lina-attack-charge-loop") {
        this.finishLinaAttackHold();
      }
    }

    cancelPrimaryActionHold() {
      this.primaryHold = null;
      this.chargeHoldTimer?.remove?.(false);
      this.chargeHoldTimer = null;
      this.resetActorVisualScale();
    }

    triggerPrimaryActionImmediate() {
      if (this.isCat) this.playCatJump();
      else this.castProjectile();
    }

    startLinaAttackHold() {
      if (!this.actor || app.profile.hp <= 0 || this.isDead || this.isActionLocked || this.isCat) return;
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const now = this.time.now;
      if (now - this.lastShotAt < equipment.cooldown) return;
      this.lastShotAt = now;
      this.primaryHold = {
        startedAt: now,
        charged: false,
        released: false,
        startComplete: false
      };
      this.isCasting = true;
      this.networkAction = "attack";
      this.actor.setTexture("lina");
      this.setLinaAttackVisualScale();
      this.actor.play("lina-attack-charge-start", true);
      this.chargeHoldTimer?.remove?.(false);
      this.chargeHoldTimer = this.time.delayedCall(CHARGE_HOLD_THRESHOLD, () => {
        if (this.primaryHold && !this.primaryHold.released) this.primaryHold.charged = true;
      });
      this.actor.once("animationcomplete", () => {
        const hold = this.primaryHold;
        if (!hold || this.isDead) return;
        hold.startComplete = true;
        if (hold.released) {
          this.finishLinaAttackHold();
        } else {
          this.actor.play("lina-attack-charge-loop", true);
        }
      });
    }

    finishLinaAttackHold() {
      const hold = this.primaryHold;
      if (!hold || !this.actor || this.isDead) return;
      this.primaryHold = null;
      this.chargeHoldTimer?.remove?.(false);
      this.chargeHoldTimer = null;
      this.fireProjectile({ charged: hold.charged });
      this.isCasting = false;
      this.actor.setTexture(app.profile.characterId);
      this.resetActorVisualScale();
      if (!this.isDead) this.playLoop("idle");
    }

    playCatJump() {
      if (!this.actor || this.isDead || this.isActionLocked || this.isCatJumping) return;
      const character = getCharacter(app.profile.characterId);
      this.resetActorVisualScale();
      this.isCat = true;
      this.isCatJumping = true;
      this.networkAction = "catJump";
      this.actor.setTexture(character.id);
      this.actor.play(`${character.id}-catJump-once`, true);
      this.actor.once("animationcomplete", () => {
        this.isCatJumping = false;
        this.returnToBaseLoop();
      });
    }

    toggleTransformState() {
      if (!this.actor || this.isDead || this.isActionLocked || this.isCasting || this.primaryHold || this.isTransforming) return;
      const character = getCharacter(app.profile.characterId);
      this.resetActorVisualScale();
      this.isTransforming = true;
      this.networkAction = "transform";
      this.actor.setTexture(character.id);
      if (this.isCat && this.actor.anims?.playReverse) this.actor.anims.playReverse(`${character.id}-transform-once`, true);
      else this.actor.play(`${character.id}-transform-once`, true);
      this.actor.once("animationcomplete", () => {
        this.isCat = !this.isCat;
        this.isTransforming = false;
        this.returnToBaseLoop();
      });
    }

    getAttackAnimationKey() {
      return `${app.profile.characterId}-attack-once`;
    }

    castProjectile() {
      if (!this.actor || app.profile.hp <= 0 || this.isCat) {
        if (this.isCat) this.playCatJump();
        return;
      }
      const now = this.time.now;
      const isMelee = app.profile.characterId === "ayu";
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const cooldown = isMelee ? MELEE.cooldown : equipment.cooldown;
      if (now - this.lastShotAt < cooldown) return;
      this.lastShotAt = now;
      const character = getCharacter(app.profile.characterId);
      this.isCasting = true;
      this.networkAction = "attack";
      this.setLinaAttackVisualScale();
      this.actor.play(this.getAttackAnimationKey(), true);
      if (isMelee) this.time.delayedCall(110, () => this.dealMeleeDamage());
      else this.time.delayedCall(95, () => this.fireProjectile());
      this.actor.once("animationcomplete", () => {
        this.isCasting = false;
        this.actor.setTexture(character.id);
        this.resetActorVisualScale();
        if (!this.isDead) this.playLoop("idle");
      });
    }

    getActorFootCenter() {
      if (!this.actor) return { x: 0, y: 0 };
      const body = this.actor.body;
      if (!body) return { x: this.actor.x, y: this.actor.y };
      const bodyX = typeof body.x === "number" ? body.x : this.actor.x;
      const bodyY = typeof body.y === "number" ? body.y : this.actor.y;
      const bodyWidth = typeof body.width === "number" ? body.width : 0;
      const bodyHeight = typeof body.height === "number" ? body.height : 0;
      return {
        x: body.center?.x ?? (bodyX + bodyWidth / 2),
        y: body.bottom ?? (bodyY + bodyHeight)
      };
    }

    castUltimate() {
      if (!this.actor || app.profile.hp <= 0) return;
      if (app.profile.characterId === "ayu") {
        this.castAyuUltimate();
        return;
      }
      if (app.profile.characterId !== "lina") return;
      if (this.isCat || this.isDead || this.isActionLocked || this.isCasting || this.primaryHold) return;
      if (!this.spendEnergy(ULTIMATE_COST, "大招")) return;
      this.lastUltimateAt = this.time.now;
      this.isCasting = true;
      this.isActionLocked = true;
      this.networkAction = "attack";
      this.actor.body.setVelocity(0, 0);
      this.actor.setTexture("lina");
      this.setLinaAttackVisualScale();
      this.actor.play("lina-ultimate-cast", true);
      this.playUltimateCyclone();
    }

    castAyuUltimate() {
      if (this.isCat || this.isDead || this.isActionLocked || this.isCasting || this.primaryHold) return;
      if (!this.spendEnergy(ULTIMATE_COST, "大招")) return;
      this.isCasting = true;
      this.isActionLocked = true;
      this.networkAction = "attack";
      this.actor.body.setVelocity(0, 0);
      this.actor.play("ayu-attack-once", true);
      app.audio.ultimateWind();
      this.time.delayedCall(150, () => {
        if (!this.actor?.active || this.isDead) return;
        for (let index = 0; index < 8; index += 1) {
          const angle = index / 8 * Math.PI * 2;
          this.flashSlash(
            this.actor.x + Math.cos(angle) * 82,
            this.actor.y - 44 + Math.sin(angle) * 58,
            angle,
            this.actor.y + 48
          );
        }
        const baseDamage = Math.round(Number(app.profile.attackPower || MELEE.damage) * 1.8);
        (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
          if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) return;
          if (Phaser.Math.Distance.Between(this.actor.x, this.actor.y - 42, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y) <= 250) {
            this.playLeafSlimeHit(slime, baseDamage, { kind: "physical", noEnergyGain: true });
          }
        });
        if (app.boss.active && app.boss.hp > 0 && Phaser.Math.Distance.Between(this.actor.x, this.actor.y, app.boss.x, app.boss.y) <= 280) {
          this.applyBossDamage(baseDamage);
        }
        app.audio.ultimateBurst();
        this.cameras.main.shake(160, 0.003);
      });
      this.actor.once("animationcomplete", () => {
        if (!this.actor?.active || this.isDead) return;
        this.isCasting = false;
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    playUltimateCyclone() {
      const footCenter = this.getActorFootCenter();
      const x = footCenter.x;
      const y = footCenter.y;
      const back = this.add.sprite(x, y, ULTIMATE_BACK_TEXTURE_KEY, 0)
        .setOrigin(0.5, ULTIMATE_ORIGIN_Y)
        .setDepth(y - 34);
      const front = this.add.sprite(x, y, ULTIMATE_FRONT_TEXTURE_KEY, 0)
        .setOrigin(0.5, ULTIMATE_ORIGIN_Y)
        .setDepth(y + 42);

      back.play("lina-ultimate-cyclone-back", true);
      front.play("lina-ultimate-cyclone-front", true);
      app.audio.ultimateWind();
      this.time.delayedCall(430, () => {
        this.dealUltimateDamage(x, y);
        app.audio.ultimateBurst();
        this.cameras.main.shake(150, 0.0022);
      });
      front.once("animationcomplete", () => {
        back.destroy();
        front.destroy();
        if (!this.actor || this.isDead) return;
        this.isCasting = false;
        this.isActionLocked = false;
        this.actor.setTexture(app.profile.characterId);
        this.resetActorVisualScale();
        this.returnToBaseLoop();
      });
    }

    dealUltimateDamage(cx, cy) {
      if (!this.actor || this.isDead) return;
      let hitSomething = false;
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) continue;
        const dx = slime.x - cx;
        const dy = (slime.y + LEAF_SLIME_HIT_OFFSET_Y) - cy;
        if ((dx * dx) / (ULTIMATE_RADIUS_X * ULTIMATE_RADIUS_X) + (dy * dy) / (ULTIMATE_RADIUS_Y * ULTIMATE_RADIUS_Y) <= 1) {
          this.playLeafSlimeHit(slime, ULTIMATE_DAMAGE, { kind: "magic", noEnergyGain: true });
          hitSomething = true;
        }
      }
      if (app.boss.active && app.boss.hp > 0 && this.bossSprite?.visible) {
        const dx = app.boss.x - cx;
        const dy = (app.boss.y - 60) - cy;
        if ((dx * dx) / (ULTIMATE_RADIUS_X * ULTIMATE_RADIUS_X) + (dy * dy) / (ULTIMATE_RADIUS_Y * ULTIMATE_RADIUS_Y) <= 1) {
          this.applyBossDamage(ULTIMATE_DAMAGE);
          hitSomething = true;
        }
      }
      if (hitSomething) this.cameras.main.shake(140, 0.002);
    }

    dealMeleeDamage() {
      if (!this.actor || this.isDead) return;
      const direction = this.facing || DIRECTIONS[2];
      const vec = directionVector(direction);
      this.lastAimVector = vec;
      const hitX = this.actor.x + vec.x * MELEE.reach;
      const hitY = this.actor.y - 44 + vec.y * MELEE.reach;
      this.flashSlash(hitX, hitY, Math.atan2(vec.y, vec.x), this.actor.y + 20);
      app.audio.cast();
      let hitSomething = false;
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) continue;
        const distance = Phaser.Math.Distance.Between(hitX, hitY, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y);
        if (distance <= MELEE.radius + LEAF_SLIME_HIT_RADIUS) {
          this.playLeafSlimeHit(slime, Number(app.profile.attackPower || MELEE.damage), { kind: "physical", energyGain: ENERGY_MELEE_HIT_GAIN });
          hitSomething = true;
        }
      }
      if (app.boss.active && app.boss.hp > 0 && this.bossSprite?.visible) {
        const bossDistance = Phaser.Math.Distance.Between(hitX, hitY, app.boss.x, app.boss.y - 60);
        if (bossDistance < 96 + MELEE.radius) {
          this.applyBossDamage(MELEE.damage);
          hitSomething = true;
        }
      }
      if (hitSomething) this.cameras.main.shake(60, 0.0015);
    }

    flashSlash(x, y, angle, depth = 45) {
      const degrees = Phaser.Math.RadToDeg(angle);
      const arc = this.add.arc(x, y, 52, degrees - 62, degrees + 62, false, MELEE.color, 0.42)
        .setDepth(depth);
      this.tweens.add({
        targets: arc,
        alpha: 0,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 190,
        ease: "Sine.easeOut",
        onComplete: () => arc.destroy()
      });
    }

    fireProjectile(options = {}) {
      if (!this.actor || this.isDead) return;
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const charged = !!options.charged;
      const direction = this.facing || DIRECTIONS[2];
      const vec = directionVector(direction);
      this.lastAimVector = vec;
      const castOrigin = this.getCastOrigin(vec);
      const projectileSpeed = equipment.speed * PROJECTILE_SPEED_SCALE * PLAYER_PROJECTILE_SPEED_MULTIPLIER;
      const flightFrame = equipment.projectileFrame + (charged ? 1 : 0);
      const projectile = this.projectiles.create(castOrigin.x, castOrigin.y, "play-projectile-hitbox");
      projectile.setVisible(false);
      const projectileSize = Math.round(equipment.size * PROJECTILE_HITBOX_SCALE_MULTIPLIER);
      projectile.body.setCircle(projectileSize, 16 - projectileSize, 16 - projectileSize);
      projectile.body.setAllowGravity(false);
      projectile.body.setVelocity(vec.x * projectileSpeed, vec.y * projectileSpeed);
      projectile.spawnTime = this.time.now;
      projectile.color = equipment.color;
      projectile.radius = projectileSize;
      projectile.spawnX = castOrigin.x;
      projectile.spawnY = castOrigin.y;
      projectile.maxDistance = Math.min(equipment.range || PROJECTILE_MAX_RANGE, PROJECTILE_MAX_RANGE);
      projectile.maxLifetime = Math.ceil((projectile.maxDistance / projectileSpeed) * 1000) + 180;
      projectile.impactFrame = equipment.impactFrame;
      projectile.visualScale = (equipment.projectileScale || 0.15) * PROJECTILE_VISUAL_SCALE_MULTIPLIER;
      projectile.impactScale = charged ? 1.5 : 1;
      projectile.depthOffset = vec.y < -0.12 ? -8 : 12;
      projectile.visualBaseDepth = this.actor.y + 18;
      projectile.visualRotation = Math.atan2(vec.y, vec.x);
      projectile.impactAnimationKey = this.getProjectileAnimationKey(equipment, "impact");
      projectile.damage = app.profile.characterId === "lina"
        ? (charged ? Math.round(Number(app.profile.magicPower || 22) * 1.55) : Number(app.profile.magicPower || 22))
        : Number(app.profile.attackPower || 18);
      projectile.charged = charged;
      projectile.trail = [];
      const projectileOrigin = charged
        ? (equipment.chargedProjectileOrigin || equipment.projectileOrigin || PROJECTILE_HEAD_ORIGIN)
        : (equipment.projectileOrigin || PROJECTILE_HEAD_ORIGIN);
      projectile.visual = this.add.sprite(castOrigin.x, castOrigin.y, PROJECTILE_TEXTURE_KEY, flightFrame)
        .setOrigin(projectileOrigin.x, projectileOrigin.y)
        .setScale(projectile.visualScale)
        .setRotation(projectile.visualRotation)
        .setDepth(Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth));
      this.flashCast(castOrigin.x, castOrigin.y, equipment.color, projectile.visualBaseDepth + 1);
      app.audio.projectileFly(charged);
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
      const visualScaleX = Math.abs(this.actor.scaleX || ACTOR_DEFAULT_VISUAL_SCALE);
      const visualScaleY = Math.abs(this.actor.scaleY || ACTOR_DEFAULT_VISUAL_SCALE);
      const localX = (socket.x - originX) * visualScaleX * (this.actor.flipX ? -1 : 1);
      const localY = (socket.y - originY) * visualScaleY;
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
        const impactScale = projectile.impactScale || 1;
        const impact = this.add.sprite(projectile.x, projectile.y, PROJECTILE_TEXTURE_KEY, projectile.impactFrame)
          .setOrigin(0.5)
          .setScale((projectile.visualScale || 0.15) * 1.18 * impactScale)
          .setDepth(Math.max(projectile.y + 12, projectile.visualBaseDepth || 0));
        if (projectile.impactAnimationKey) impact.play(projectile.impactAnimationKey);
        this.tweens.add({
          targets: impact,
          scale: (projectile.visualScale || 0.15) * 1.45 * impactScale,
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
      this.playLeafSlimeHit(slime, projectile.damage || 18, { kind: "magic", charged: !!projectile.charged });
    }

    checkLeafSlimeProjectileHit(projectile) {
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) continue;
        const hitX = slime.x;
        const hitY = slime.y + LEAF_SLIME_HIT_OFFSET_Y;
        const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, hitX, hitY);
        if (distance > LEAF_SLIME_HIT_RADIUS + projectile.radius) continue;
        this.handleLeafSlimeProjectileHit(projectile, slime);
        return true;
      }
      return false;
    }

    rollPlayerDamage(baseDamage, target, kind = "magic") {
      const creditDefense = Number(target?.creditDefense || 0);
      const creditMultiplier = creditDefense
        ? clamp(Math.max(1, Number(app.profile?.credits || 0)) / creditDefense, CREDIT_DEFENSE_MIN, CREDIT_DEFENSE_MAX)
        : 1;
      const critical = Math.random() < PLAYER_CRIT_CHANCE;
      const critMultiplier = critical
        ? (kind === "physical" ? PLAYER_PHYSICAL_CRIT_MULTIPLIER : PLAYER_MAGIC_CRIT_MULTIPLIER)
        : 1;
      const amount = Math.max(1, Math.round(Number(baseDamage || 1) * creditMultiplier * critMultiplier * equippedDamageMultiplier()));
      return { amount, critical, creditMultiplier };
    }

    showFloatingText(x, y, text, options = {}) {
      const node = this.add.text(x, y, text, {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: options.size || "18px",
        fontStyle: "900",
        color: options.color || "#ffffff",
        stroke: options.stroke || "#241b2e",
        strokeThickness: options.strokeThickness ?? 5
      }).setOrigin(0.5).setDepth(options.depth ?? 100000);
      const rise = options.rise ?? 54;
      const targetScale = options.scale || 1.05;
      node.setAlpha(1).setScale(options.startScale || targetScale * 1.36);
      this.tweens.add({
        targets: node,
        scale: targetScale,
        duration: options.popDuration || 110,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: node,
            y: y - rise,
            x: x + (options.drift ?? Phaser.Math.Between(-12, 12)),
            delay: options.hold ?? 150,
            duration: options.duration || 980,
            ease: "Cubic.easeOut",
            onComplete: () => node.destroy()
          });
        }
      });
      return node;
    }

    playEnemyHitImpact(slime, critical = false) {
      const x = slime.x;
      const y = slime.y + (Number(slime.hudOffsetY) || -70) + 34;
      const color = critical ? 0xffd86b : 0xbff7ff;
      const ring = this.add.circle(x, y, critical ? 22 : 16, color, 0.18)
        .setStrokeStyle(critical ? 5 : 3, color, 0.94)
        .setDepth(slime.y + 74);
      const flash = this.add.star(x, y, 6, critical ? 12 : 8, critical ? 38 : 27, color, 0.82)
        .setDepth(slime.y + 76);
      this.tweens.add({
        targets: ring,
        radius: critical ? 58 : 44,
        alpha: 0,
        duration: critical ? 360 : 280,
        ease: "Sine.easeOut",
        onComplete: () => ring.destroy()
      });
      this.tweens.add({
        targets: flash,
        angle: critical ? 52 : 34,
        scale: critical ? 1.28 : 1.08,
        alpha: 0,
        duration: critical ? 300 : 230,
        ease: "Cubic.easeOut",
        onComplete: () => flash.destroy()
      });
      this.cameras.main.shake(critical ? 95 : 70, critical ? 0.0042 : 0.0024);
      app.audio?.hit();
    }

    playHealEffect(x, y) {
      const ring = this.add.circle(x, y - 40, 18, 0x42c98a, 0.22).setStrokeStyle(3, 0xd7fff0, 0.84).setDepth(y + 56);
      const sparkle = this.add.star(x, y - 74, 5, 6, 18, 0xd7fff0, 0.82).setDepth(y + 58);
      this.tweens.add({ targets: ring, radius: 54, alpha: 0, duration: 520, ease: "Sine.easeOut", onComplete: () => ring.destroy() });
      this.tweens.add({ targets: sparkle, y: y - 108, angle: 80, alpha: 0, duration: 620, ease: "Sine.easeOut", onComplete: () => sparkle.destroy() });
    }

    playShieldEffect(x, y, blocked = false) {
      const color = blocked ? 0xfff2a6 : SHIELD_BLOCK_COLOR;
      const shield = this.add.ellipse(x, y - 45, 70, 92, color, blocked ? 0.18 : 0.13)
        .setStrokeStyle(blocked ? 4 : 2, color, blocked ? 0.9 : 0.62)
        .setDepth(y + 62);
      this.tweens.add({
        targets: shield,
        scaleX: blocked ? 1.25 : 1.08,
        scaleY: blocked ? 1.18 : 1.08,
        alpha: 0,
        duration: blocked ? 340 : 620,
        ease: "Sine.easeOut",
        onComplete: () => shield.destroy()
      });
    }

    refreshEnergyHudOnly() {
      if (!app.profile) return;
      const maxEnergy = Math.max(1, Number(app.profile.maxEnergy || ENERGY_DEFAULT_MAX));
      const energy = clamp(Number(app.profile.energy || 0), 0, maxEnergy);
      const energyBar = $("#energyBar");
      const energyText = $("#energyText");
      const percentage = Math.round(energy / maxEnergy * 100);
      const roundedEnergy = Math.round(energy);
      const fingerprint = `${percentage}:${roundedEnergy}:${Math.round(maxEnergy)}`;
      if (energyBar?.dataset.value === fingerprint) return;
      if (energyBar) {
        energyBar.dataset.value = fingerprint;
        energyBar.style.width = `${percentage}%`;
      }
      if (energyText) energyText.textContent = `${roundedEnergy} / ${Math.round(maxEnergy)}`;
    }

    restoreEnergy(amount = 0, x = this.actor?.x, y = this.actor?.y, options = {}) {
      if (!app.profile) return 0;
      const maxEnergy = Math.max(1, Number(app.profile.maxEnergy || ENERGY_DEFAULT_MAX));
      const before = clamp(Number(app.profile.energy || 0), 0, maxEnergy);
      app.profile.energy = clamp(before + Math.max(0, Number(amount) || 0), 0, maxEnergy);
      const gained = app.profile.energy - before;
      if (gained > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        this.showFloatingText(x, y - 92, `+${Math.ceil(gained)} EN`, { color: "#9ff7ff", size: "14px", rise: 34, duration: 540 });
      }
      if (options.silent) this.refreshEnergyHudOnly();
      else renderHud();
      return gained;
    }

    spendEnergy(cost = 0, label = "技能") {
      if (!app.profile) return false;
      const maxEnergy = Math.max(1, Number(app.profile.maxEnergy || ENERGY_DEFAULT_MAX));
      app.profile.energy = clamp(Number(app.profile.energy || 0), 0, maxEnergy);
      if (app.profile.energy < cost) {
        showToast(`${label}需要 ${cost} 能量`);
        return false;
      }
      app.profile.energy -= cost;
      renderHud();
      return true;
    }

    playLeafSlimeHit(slime, baseDamage = MELEE.damage, options = {}) {
      if (slime.state === "hit" || slime.state === "dead" || slime.state === "vanish" || slime.state === "emerging") return;
      slime.provokedUntil = this.time.now + 12000;
      const result = this.rollPlayerDamage(baseDamage, slime, options.kind || "magic");
      slime.hp = Math.max(0, Number(slime.hp || 0) - result.amount);
      if (!options.noEnergyGain) {
        this.restoreEnergy(options.energyGain ?? (options.charged ? ENERGY_CHARGED_HIT_GAIN : ENERGY_HIT_GAIN), slime.x, slime.y);
      }
      this.refreshEnemyHpBar(slime);
      this.showFloatingText(
        slime.x,
        slime.y + slime.hudOffsetY - 18,
        `${result.critical ? "暴击 " : ""}-${result.amount}`,
        {
          color: result.critical ? "#ffd86b" : "#fff7e6",
          size: result.critical ? "34px" : "26px",
          scale: result.critical ? 1.25 : 1,
          startScale: result.critical ? 1.72 : 1.42,
          strokeThickness: result.critical ? 8 : 7,
          hold: result.critical ? 240 : 180,
          duration: result.critical ? 1250 : 1080,
          rise: result.critical ? 92 : 72
        }
      );
      this.playEnemyHitImpact(slime, result.critical);
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      const defeated = slime.hp <= 0;
      slime.state = "hit";
      slime.body.setVelocity(0, 0);
      slime.setTint(0xfff0b0);
      this.playEnemyAnimation(slime, "hit", true);
      const finishHit = () => {
        if (!slime.active || slime.actionToken !== token) return;
        if (defeated) {
          this.killLeafSlime(slime);
          return;
        }
        slime.state = "move";
        slime.clearTint();
        if (slime.baseTint && slime.baseTint !== 0xffffff) slime.setTint(slime.baseTint);
        this.playEnemyAnimation(slime, "move", true);
      };
      if (slime.staticImage) this.time.delayedCall(180, finishHit);
      else slime.once("animationcomplete", finishHit);
    }

    killLeafSlime(slime) {
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "dead";
      if (slime.slimeId && !slime.removeBroadcasted && app.connected) {
        slime.removeBroadcasted = true;
        app.multiplayer.sendSlimeRemove(slime.slimeId);
      }
      slime.body.setVelocity(0, 0);
      slime.body.enable = false;
      slime.clearTint();
      this.playEnemyAnimation(slime, "dead", true);
      const expGain = Number(slime.rewardExp) || (slime.isElite ? 34 : slime.isBossSummon ? 14 : 12);
      const levels = grantExperience(expGain);
      if (slime.rewardCredits) app.profile.credits += Number(slime.rewardCredits) || 0;
      let gotCard = false;
      if (!slime.isBossSummon) gotCard = collectProtocolCard("ch1_card_schema_lock");
      const droppedItem = this.createWorldDropFromEnemy(slime);
      renderHud();
      const levelText = levels ? `，等级 +${levels}` : "";
      if (droppedItem) showToast(`击败${slime.displayLabel || "怪物"}，EXP +${expGain}${levelText}，掉落 ${droppedItem.name}`);
      else showToast(gotCard ? `击败叶灵怪，EXP +${expGain}${levelText}，协议卡 +1` : `击败召唤小怪，EXP +${expGain}${levelText}`);
      if (slime.groupId === BOSS_SUMMON_GROUP) this.updateBossSummonState();
      else this.checkEncounterClear(slime.groupId);
      const beginVanish = () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.state = "vanish";
        [slime.hpBg, slime.hpFrame, slime.hpFill, slime.nameLabel].forEach(item => item?.destroy());
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
          }
        });
      };
      if (slime.staticImage) this.time.delayedCall(220, beginVanish);
      else slime.once("animationcomplete", beginVanish);
    }

    damagePlayer(amount) {
      if (app.profile.hp <= 0) return;
      let incoming = Math.max(0, Number(amount) || 0);
      const blocked = Math.min(Math.max(0, Number(app.profile.shield || 0)), incoming);
      if (blocked > 0) {
        app.profile.shield = Math.max(0, Number(app.profile.shield || 0) - blocked);
        incoming -= blocked;
        this.playShieldEffect(this.actor.x, this.actor.y, true);
        this.showFloatingText(this.actor.x, this.actor.y - 116, `格挡 ${Math.ceil(blocked)}`, { color: "#bff7ff", size: "17px", rise: 48 });
      }
      if (incoming > 0) {
        app.profile.hp = Math.max(0, app.profile.hp - incoming);
        this.showFloatingText(this.actor.x, this.actor.y - 124, `-${Math.ceil(incoming)}`, { color: "#ff9ab4", size: "20px", rise: 58 });
      }
      renderHud();
      app.audio.playerHit();
      if (incoming > 0) this.playActorHitReaction();
      if (app.profile.hp <= 0) {
        this.isDead = true;
        this.isCatJumping = false;
        this.isTransforming = false;
        this.cancelPrimaryActionHold();
        this.isActionLocked = false;
        this.isCasting = false;
        this.networkAction = "death";
        this.actor.body.setVelocity(0, 0);
        this.actor.play(`${app.profile.characterId}-death-once`, true);
        renderReviveDialog(true);
        showToast("角色倒下了，点击复活或按 I 继续");
      }
    }

    revivePlayer() {
      if (!app.profile || !this.actor) return;
      app.profile.hp = app.profile.maxHp;
      this.isDead = false;
      this.isActionLocked = false;
      this.isCasting = false;
      this.isCatJumping = false;
      this.isTransforming = false;
      this.cancelPrimaryActionHold();
      this.isCat = false;
      this.networkAction = "idle";
      this.actor.clearTint();
      this.actor.body.setVelocity(0, 0);
      this.actor.setTexture(app.profile.characterId);
      renderReviveDialog(false);
      renderHud();
      app.audio.heal();
      this.returnToBaseLoop();
      showToast("已复活，继续探索校园");
    }

    playActorHitReaction() {
      if (!this.actor?.active || this.isDead) return;
      const character = getCharacter(app.profile.characterId);
      this.actorHitToken = (this.actorHitToken || 0) + 1;
      const token = this.actorHitToken;
      this.isCasting = false;
      this.isTransforming = false;
      this.cancelPrimaryActionHold();
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
      this.playEnemyAnimation(slime, "attack", true);
      app.audio?.enemyAttack();
      slime.body.setVelocity(
        vec.x * (LEAF_SLIME_ATTACK_DISTANCE / LEAF_SLIME_ATTACK_DURATION * 1000),
        vec.y * (LEAF_SLIME_ATTACK_DISTANCE / LEAF_SLIME_ATTACK_DURATION * 1000)
      );
      this.time.delayedCall(180, () => {
        if (!slime.active || slime.actionToken !== token || !this.actor?.active) return;
        const hitDistance = Phaser.Math.Distance.Between(slime.x, slime.y, this.actor.x, this.actor.y);
        if (hitDistance <= LEAF_SLIME_ATTACK_RANGE + 24) this.damagePlayer(slime.damage || 8);
      });
      this.time.delayedCall(LEAF_SLIME_ATTACK_DURATION, () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.body.setVelocity(0, 0);
        slime.state = "move";
        slime.nextHopAt = this.time.now + LEAF_SLIME_HOP_REST;
        this.playEnemyAnimation(slime, "move", true);
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
      this.playEnemyAnimation(slime, "move", true);
      slime.body.setVelocity(vec.x * (hopDistance / LEAF_SLIME_HOP_DURATION * 1000), vec.y * (hopDistance / LEAF_SLIME_HOP_DURATION * 1000));
      this.time.delayedCall(LEAF_SLIME_HOP_DURATION, () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.body.setVelocity(0, 0);
        slime.state = "move";
        slime.nextHopAt = this.time.now + LEAF_SLIME_HOP_REST;
      });
    }

    chooseSmoothEnemyWanderTarget(slime) {
      const config = this.getAmbientEnemyRefreshConfig() || {};
      const bounds = config.spawnBounds || {};
      const left = clamp(Number(bounds.x) || 96, 72, this.worldWidth - 72);
      const top = clamp(Number(bounds.y) || 96, 96, this.worldHeight - 96);
      const right = clamp(left + (Number(bounds.width) || this.worldWidth - left * 2), left, this.worldWidth - 72);
      const bottom = clamp(top + (Number(bounds.height) || this.worldHeight - top * 2), top, this.worldHeight - 96);
      for (let attempt = 0; attempt < 18; attempt += 1) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const distance = Phaser.Math.Between(120, 310);
        const x = clamp(slime.x + Math.cos(angle) * distance, left, right);
        const y = clamp(slime.y + Math.sin(angle) * distance, top, bottom);
        if (this.pointBlockedForAmbientEnemy(x, y, 34)) continue;
        slime.wanderTargetX = x;
        slime.wanderTargetY = y;
        slime.wanderUntil = this.time.now + Phaser.Math.Between(2200, 4600);
        return;
      }
      slime.wanderTargetX = slime.x;
      slime.wanderTargetY = slime.y;
      slime.wanderUntil = this.time.now + 900;
    }

    updateSmoothEnemyMotion(slime, dx, dy, distance, delta = 16) {
      const provoked = !slime.passiveWander || this.time.now < slime.provokedUntil;
      if (provoked && distance <= LEAF_SLIME_ATTACK_RANGE) {
        this.triggerLeafSlimeAttack(slime, dx, dy);
        return;
      }
      let targetDx;
      let targetDy;
      let speed;
      if (provoked && distance <= slime.aggroRange) {
        targetDx = dx;
        targetDy = dy;
        speed = slime.chaseSpeed;
      } else {
        const wanderDistance = Math.hypot(slime.wanderTargetX - slime.x, slime.wanderTargetY - slime.y);
        if (this.time.now >= slime.wanderUntil || wanderDistance < 24) this.chooseSmoothEnemyWanderTarget(slime);
        targetDx = slime.wanderTargetX - slime.x;
        targetDy = slime.wanderTargetY - slime.y;
        speed = slime.wanderSpeed;
      }
      const vec = normalizeVector(targetDx, targetDy);
      const blend = 1 - Math.exp(-6 * Math.max(1, Number(delta) || 16) / 1000);
      const velocityX = Phaser.Math.Linear(slime.body.velocity.x, vec.x * speed, blend);
      const velocityY = Phaser.Math.Linear(slime.body.velocity.y, vec.y * speed, blend);
      slime.body.setVelocity(velocityX, velocityY);
      if (Math.abs(velocityX) > 2) slime.setFlipX(velocityX < 0);
      this.playEnemyAnimation(slime, "move");
    }

    updateLeafSlimes(time, delta = 16) {
      const slimes = this.leafSlimes?.getChildren?.() || [];
      slimes.forEach(slime => {
        if (!slime?.active || !this.actor?.active) return;
        slime.setDepth(slime.y + 6);
        this.updateEnemyHud(slime);
        if (["hit", "dead", "vanish", "attack", "hop", "emerging"].includes(slime.state)) return;
        const dx = this.actor.x - slime.x;
        const dy = this.actor.y - slime.y;
        const distance = Math.hypot(dx, dy);
        if (slime.smoothMovement) {
          this.updateSmoothEnemyMotion(slime, dx, dy, distance, delta);
          return;
        }
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
      if (!this.spendEnergy(HEAL_COST, "治疗")) return;
      const before = app.profile.hp;
      app.profile.hp = Math.min(app.profile.maxHp, app.profile.hp + 42);
      const healed = app.profile.hp - before;
      app.profile.shield = Math.min(Math.max(36, app.profile.maxHp * 0.28), Number(app.profile.shield || 0) + 36);
      if (app.profile.hp > 0 && this.isDead) {
        this.revivePlayer();
        return;
      }
      app.audio.heal();
      this.playHealEffect(this.actor?.x || 0, this.actor?.y || 0);
      this.playShieldEffect(this.actor?.x || 0, this.actor?.y || 0, false);
      if (healed > 0) this.showFloatingText(this.actor.x, this.actor.y - 122, `+${Math.ceil(healed)}`, { color: "#7dffbd", size: "20px", rise: 56 });
      this.showFloatingText(this.actor.x, this.actor.y - 96, `护盾 +36`, { color: "#bff7ff", size: "15px", rise: 42 });
      renderHud();
    }

    handleHotkey(event) {
      if (isTextEntryActive() || isTextEntryTarget(event.target)) return;
      if (app.dialogue) return;
      if (event.repeat) return;
      const key = String(event.key || "").toLowerCase();
      if (key === "escape" && !$("#inventoryPanel")?.classList.contains("collapsed")) {
        setInventoryOpen(false);
        return;
      }
      if (key === "enter") {
        setPanelCollapsed("publicChat", false);
        $("#chatInput")?.focus();
        return;
      }
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
      if (key === "j" || key === " ") this.beginPrimaryActionHold();
      if (key === "k") this.castUltimate();
      if (key === "h") this.healPlayer();
      if (key === "l") this.toggleTransformState();
      if (key === "i") setInventoryOpen($("#inventoryPanel")?.classList.contains("collapsed"));
      if (key === "q") this.toggleCollisionDebug();
      if (key === "e") this.triggerInteraction();
    }

    handleKeyUp(event) {
      if (isTextEntryActive() || isTextEntryTarget(event.target)) {
        this.releasePrimaryActionHold();
        return;
      }
      const key = String(event.key || "").toLowerCase();
      if (key === "j" || key === " ") this.releasePrimaryActionHold();
    }

    getMoveVector() {
      const keyboardLocked = isTextEntryActive();
      const right = !keyboardLocked && (this.keys.D.isDown || this.keys.RIGHT.isDown);
      const left = !keyboardLocked && (this.keys.A.isDown || this.keys.LEFT.isDown);
      const down = !keyboardLocked && (this.keys.S.isDown || this.keys.DOWN.isDown);
      const up = !keyboardLocked && (this.keys.W.isDown || this.keys.UP.isDown);
      const dx = (right ? 1 : 0) - (left ? 1 : 0);
      const dy = (down ? 1 : 0) - (up ? 1 : 0);
      const touch = app.touchMove || { dx: 0, dy: 0 };
      const touchMoving = Math.hypot(touch.dx || 0, touch.dy || 0) > 0.08;
      const moveDx = touchMoving ? touch.dx : dx;
      const moveDy = touchMoving ? touch.dy : dy;
      return { dx: moveDx, dy: moveDy, moving: !!(touchMoving || dx || dy) };
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
      this.applyBossDamage(damage);
    }

    applyBossDamage(damage) {
      if (!app.boss.active || app.boss.hp <= 0) return;
      showToast("教授本体不参与战斗，先清除他召唤出的精英与小怪");
      app.audio.hit();
    }

    updateBoss(time) {
      if (!app.boss.active || app.boss.hp <= 0 || !this.bossSprite.visible) return;
      this.bossSprite.setDepth(this.bossSprite.y + 18);
      if (time - this.lastBossHitAt > BOSS.attackCooldown) {
        this.lastBossHitAt = time;
        this.updateBossSummonState();
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
          .setScale(PEER_DEFAULT_VISUAL_SCALE)
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
        const hpBg = this.add.rectangle(peer.x, peer.y + 19, 50, 6, 0x1d1826, 0.48)
          .setOrigin(0.5)
          .setDepth(peer.y + 31);
        const hpFill = this.add.rectangle(peer.x - 24, peer.y + 19, 48, 4, 0x42c98a, 0.92)
          .setOrigin(0, 0.5)
          .setDepth(peer.y + 32);
        remote = {
          sprite,
          label,
          hpBg,
          hpFill,
          target: { x: peer.x, y: peer.y },
          characterId: peer.characterId,
          hp: Number(peer.hp ?? peer.maxHp ?? 1),
          maxHp: Math.max(1, Number(peer.maxHp || 1)),
          down: false,
          hitFlashToken: 0
        };
        this.remotePlayers.set(peer.id, remote);
      }
      remote.target = { x: peer.x, y: peer.y };
      remote.sprite.setFlipX(!!peer.flipX);
      remote.label.setText(peer.name);
      const nextMaxHp = Math.max(1, Number(peer.maxHp || remote.maxHp || 1));
      const nextHp = clamp(Number(peer.hp ?? nextMaxHp), 0, nextMaxHp);
      const tookDamage = nextHp < (remote.hp ?? nextHp) && nextHp > 0;
      remote.hp = nextHp;
      remote.maxHp = nextMaxHp;
      remote.down = nextHp <= 0;
      const ratio = clamp(nextHp / nextMaxHp, 0, 1);
      remote.hpFill.setDisplaySize(Math.max(1, 48 * ratio), 4);
      remote.hpFill.setFillStyle(ratio > 0.45 ? 0x42c98a : ratio > 0.2 ? 0xf3c75d : 0xef7fb0, 0.92);
      remote.hpBg.setVisible(true);
      remote.hpFill.setVisible(nextHp > 0);
      if (tookDamage) {
        remote.hitFlashToken += 1;
        const token = remote.hitFlashToken;
        remote.sprite.setTint(0xffe6a0);
        this.time.delayedCall(180, () => {
          if (remote.hitFlashToken === token && !remote.down) remote.sprite.clearTint();
        });
      }
      if (remote.down) {
        remote.sprite.clearTint();
        remote.sprite.setScale(PEER_DEFAULT_VISUAL_SCALE);
        const deathKey = `${peer.characterId}-death-once`;
        if (this.anims.exists(deathKey) && remote.sprite.anims.currentAnim?.key !== deathKey) remote.sprite.play(deathKey, true);
        return;
      }
      if (!tookDamage) remote.sprite.clearTint();
      const moving = Phaser.Math.Distance.Between(remote.sprite.x, remote.sprite.y, peer.x, peer.y) > 8;
      const requested = peer.action || (moving ? "walk" : "idle");
      const action = ["attack", "hit", "transform", "catRun", "catJump"].includes(requested)
        ? requested
        : moving ? "walk" : "idle";
      const peerScale = peer.characterId === "lina" && action === "attack"
        ? PEER_DEFAULT_VISUAL_SCALE * LINA_ATTACK_VISUAL_SCALE
        : PEER_DEFAULT_VISUAL_SCALE;
      remote.sprite.setScale(peerScale);
      const animKey = `${peer.characterId}-${["attack", "hit", "transform", "catJump"].includes(action) ? `${action}-once` : action}`;
      if (this.anims.exists(animKey) && remote.sprite.anims.currentAnim?.key !== animKey) remote.sprite.play(animKey, true);
    }

    removePeer(id) {
      const remote = this.remotePlayers.get(id);
      remote?.sprite.destroy();
      remote?.label.destroy();
      remote?.hpBg.destroy();
      remote?.hpFill.destroy();
      this.remotePlayers.delete(id);
    }

    updateRemotePlayers() {
      this.remotePlayers.forEach(remote => {
        remote.sprite.x += (remote.target.x - remote.sprite.x) * 0.16;
        remote.sprite.y += (remote.target.y - remote.sprite.y) * 0.16;
        remote.sprite.setDepth(remote.sprite.y + 8);
        remote.label.setPosition(remote.sprite.x, remote.sprite.y - 128).setDepth(remote.sprite.y + 30);
        remote.hpBg.setPosition(remote.sprite.x, remote.sprite.y + 19).setDepth(remote.sprite.y + 31);
        remote.hpFill.setPosition(remote.sprite.x - 24, remote.sprite.y + 19).setDepth(remote.sprite.y + 32);
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
        const visible = !!slime?.active && slime.state !== "dead" && slime.state !== "vanish" && slime.state !== "emerging";
        slime.shadow
          ?.setVisible(visible)
          .setAlpha(visible ? Math.max(0.06, 0.18 * (slime.alpha ?? 1)) : 0)
          .setPosition(slime?.x || 0, (slime?.y || 0) + 12)
          .setDepth((slime?.y || 0) - 24);
      });
    }

    update(time, delta = 16) {
      if (!this.actor) return;
      this.restoreEnergy((Number(delta) || 16) / 1000 * ENERGY_REGEN_PER_SECOND, NaN, NaN, { silent: true });
      if (this.isActionLocked || this.isDead) {
        this.actor.body.setVelocity(0, 0);
      } else if (app.profile.hp > 0) {
        const { dx, dy, moving } = this.getMoveVector();
        const character = getCharacter(app.profile.characterId);
        if (moving) {
          const vec = normalizeVector(dx, dy);
          this.updateFacing(dx, dy);
          const speed = this.isCat ? character.speed * 2 : character.speed;
          this.actor.body.setVelocity(vec.x * speed, vec.y * speed);
          if (!this.isCasting && !this.isTransforming) this.playLoop("walk");
        } else {
          this.actor.body.setVelocity(0, 0);
          if (!this.isCasting && !this.isTransforming) this.playLoop("idle");
        }
      }
      this.actor.setDepth(this.actor.y + 8);
      this.updateProjectiles();
      this.updateLeafSlimes(time, delta);
      this.updateBoss(time);
      this.updateWorldDrops(time);
      if (time - this.lastInteractionUpdateAt >= INTERACTION_UPDATE_INTERVAL_MS) {
        this.lastInteractionUpdateAt = time;
        this.updateInteractionPrompt();
      }
      if (time - this.lastMinimapUpdateAt >= MINIMAP_UPDATE_INTERVAL_MS) {
        this.lastMinimapUpdateAt = time;
        renderMinimap(this);
      }
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
    grantExperience(BOSS.rewardExp);
    renderHud();
    renderBossHud();
    markChapterBossCleared();
    app.scene?.syncBoss();
    renderChapterClearPanel(true);
    showToast("开启 Boss 宝箱，第一章陆教授考核完成");
  }

  function startGame(profile) {
    app.profile = normalizeProfile(profile);
    app.chapterOne = loadChapterState();
    saveProfile(app.profile);
    renderReviveDialog(false);
    renderChapterClearPanel(false);
    beginEntryLoading();
    app.audio.start("login", true);
    app.audio.enterGame();
    resetChat();
    renderHud();
    renderInventory();
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
    } else {
      finishEntryLoadingWhenReady();
    }
  }

  function exitGame() {
    if (app.dialogue) closeStoryDialogue(false);
    renderReviveDialog(false);
    renderChapterClearPanel(false);
    setInventoryOpen(false);
    app.touchMove = { active: false, dx: 0, dy: 0 };
    if (app.profile) saveProfile(app.profile);
    app.multiplayer?.close();
    if (app.game) {
      app.game.destroy(true);
      app.game = null;
      app.scene = null;
      delete window.__EFV_TEST_SCENE__;
    }
    app.connected = false;
    app.boss = { ...BOSS };
    app.bossRewardClaimed = false;
    app.chapterOne = { protocolCards: 0, bossCleared: false };
    renderNetwork("未连接", false);
    renderBossHud();
    renderChapterHud();
    resetChat();
    if (app.profile && Number(app.profile.slot) >= 0) {
      app.characters = (app.characters || []).map(item =>
        Number(item.slot) === Number(app.profile.slot)
          ? {
              ...item,
              name: app.profile.name,
              level: app.profile.level,
              exp: app.profile.exp,
              credits: app.profile.credits,
              maxHp: app.profile.maxHp,
              hp: app.profile.hp
            }
          : item
      );
    }
    $("#loginButton").disabled = false;
    if (app.authToken || app.offlineMode) {
      renderWarehouse();
      showStage("warehouse");
    } else {
      showStage("auth");
    }
    app.audio.switchMode("login");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function setAuthMode(mode, userGesture = false) {
    const isRegister = mode === "register";
    const overlay = $("#startOverlay");
    const loginForm = $("#profileForm");
    const registerForm = $("#registerForm");
    if (!overlay || !loginForm || !registerForm) return;

    loginForm.hidden = isRegister;
    registerForm.hidden = !isRegister;
    overlay.classList.toggle("auth-mode-register", isRegister);
    overlay.classList.toggle("auth-mode-login", !isRegister);
    if (userGesture) app.audio?.start("login", true);

    const focusTarget = isRegister ? $("#registerAccountInput") : $("#loginAccountInput");
    window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 0);
  }

  function resetTouchMove() {
    app.touchMove = { active: false, dx: 0, dy: 0 };
    const knob = $("#moveKnob");
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  }

  function bindTextEntryGuards() {
    if (textEntryGuardBound) return;
    textEntryGuardBound = true;
    ["keydown", "keyup"].forEach(eventName => {
      document.addEventListener(eventName, event => {
        if (!isTextEntryTarget(event.target) || !event.target.closest?.(".game-stage")) return;
        if (eventName === "keydown" && event.target.id === "chatInput") {
          if (event.key === "Enter") {
            event.preventDefault();
            submitChat();
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.target.value = "";
            returnToGameFromChat();
          }
        }
        event.stopPropagation();
      }, true);
    });
  }

  function bindSkillTooltips() {
    document.querySelectorAll(".skill[data-skill-id]").forEach(button => {
      button.addEventListener("pointerenter", event => {
        if (event.pointerType !== "touch") showSkillTooltip(button, false);
      });
      button.addEventListener("pointerleave", () => hideSkillTooltip(false));
      button.addEventListener("focus", () => showSkillTooltip(button, false));
      button.addEventListener("blur", () => hideSkillTooltip(false));
      button.addEventListener("pointerdown", event => {
        if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
        showSkillTooltip(button, true);
        window.clearTimeout(app.skillTooltipTimer);
        app.skillTooltipTimer = window.setTimeout(() => hideSkillTooltip(true), 3600);
      });
    });
    document.addEventListener("pointerdown", event => {
      if (event.target.closest?.(".skill[data-skill-id]")) return;
      hideSkillTooltip(true);
    });
  }

  function bindMobileControls() {
    const stick = $("#moveStick");
    const knob = $("#moveKnob");
    if (!stick || !knob) return;
    let activePointerId = null;

    const updateStick = event => {
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDistance = rect.width * 0.34;
      const rawX = event.clientX - centerX;
      const rawY = event.clientY - centerY;
      const distance = Math.hypot(rawX, rawY);
      const scale = distance > maxDistance ? maxDistance / distance : 1;
      const knobX = rawX * scale;
      const knobY = rawY * scale;
      const dx = Math.abs(knobX) < 5 ? 0 : knobX / maxDistance;
      const dy = Math.abs(knobY) < 5 ? 0 : knobY / maxDistance;
      app.touchMove = { active: true, dx, dy };
      knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    };

    stick.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      activePointerId = event.pointerId;
      stick.setPointerCapture?.(event.pointerId);
      updateStick(event);
    });
    stick.addEventListener("pointermove", event => {
      if (event.pointerId !== activePointerId) return;
      event.preventDefault();
      event.stopPropagation();
      updateStick(event);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
      stick.addEventListener(eventName, event => {
        if (event.pointerId !== activePointerId && eventName !== "lostpointercapture") return;
        activePointerId = null;
        resetTouchMove();
      });
    });
    window.addEventListener("blur", resetTouchMove);

    const bindAction = (selector, action) => {
      const button = $(selector);
      if (!button) return;
      let pointerHandledAt = 0;
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        pointerHandledAt = performance.now();
        action();
      });
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() - pointerHandledAt > 450) action();
      });
    };

    const bindHoldAction = (selector, begin, release) => {
      const button = $(selector);
      if (!button) return;
      let pointerDown = false;
      let pointerHandledAt = 0;
      button.addEventListener("pointerdown", event => {
        event.preventDefault();
        event.stopPropagation();
        pointerDown = true;
        pointerHandledAt = performance.now();
        button.setPointerCapture?.(event.pointerId);
        begin();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
        button.addEventListener(eventName, event => {
          if (!pointerDown && eventName !== "lostpointercapture") return;
          event.preventDefault?.();
          event.stopPropagation?.();
          pointerDown = false;
          release();
        });
      });
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        if (performance.now() - pointerHandledAt > 450) {
          begin();
          release();
        }
      });
    };

    bindHoldAction("#mobileAttackButton", () => app.scene?.beginPrimaryActionHold(), () => app.scene?.releasePrimaryActionHold());
    bindAction("#mobileUltimateButton", () => app.scene?.castUltimate());
    bindAction("#mobileTransformButton", () => app.scene?.toggleTransformState());
    bindAction("#mobileSpecialButton", () => healPlayer());
  }

  function bindUi() {
    const saved = loadProfile();
    setAuthMode("login");
    initializeHudPanels();
    bindPanelToggles();
    if (saved?.account) $("#loginAccountInput").value = saved.account;

    const startAudioOnGesture = () => app.audio.start("login", true);
    ["pointerdown", "keydown", "focusin", "input"].forEach(eventName => {
      $("#startOverlay").addEventListener(eventName, startAudioOnGesture, { once: true });
    });

    $("#offlineButton")?.addEventListener("click", () => {
      if (!loginAssetsReady()) return;
      app.audio?.start("login", true);
      app.offlineMode = true;
      setSession("");
      $("#profileHint").textContent = "";
      showStage("server");
    });

    $("#profileForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (!loginAssetsReady()) {
        $("#profileHint").textContent = "请等待初始素材加载完成。";
        return;
      }
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
        await loginWithPassword(username, password);
        button.disabled = false;
        $("#profileHint").textContent = "";
        showStage("server");
      } catch (error) {
        setSession("");
        button.disabled = false;
        $("#profileHint").textContent = error.message || "登录失败，请检查账号密码。";
      }
    });

    $("#showRegisterLink")?.addEventListener("click", event => {
      event.preventDefault();
      setAuthMode("register", true);
    });
    $("#backLoginButton")?.addEventListener("click", () => {
      setAuthMode("login", true);
    });
    $("#registerForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      if (!loginAssetsReady()) {
        $("#registerHint").textContent = "请等待初始素材加载完成。";
        return;
      }
      const username = $("#registerAccountInput").value.trim();
      const nickname = $("#registerNicknameInput").value.trim();
      const password = $("#registerPasswordInput").value;
      const confirm = $("#registerConfirmInput").value;
      const button = $("#registerButton");

      if (!/^[A-Za-z0-9_-]{3,18}$/.test(username)) {
        $("#registerHint").textContent = "账号请使用 3-18 位字母、数字、下划线或短横线。";
        return;
      }
      if (nickname.length < 1 || nickname.length > 12) {
        $("#registerHint").textContent = "昵称请控制在 1-12 个字。";
        return;
      }
      if (password.length < 6) {
        $("#registerHint").textContent = "密码至少需要 6 位。";
        return;
      }
      if (password !== confirm) {
        $("#registerHint").textContent = "两次输入的密码不一致。";
        return;
      }

      button.disabled = true;
      $("#registerHint").textContent = "正在创建账号...";
      try {
        await registerAccount(username, nickname, password);
        $("#registerHint").textContent = "注册成功，请用新账号登录。";
        $("#loginAccountInput").value = username;
        window.setTimeout(() => {
          button.disabled = false;
          setAuthMode("login");
        }, 900);
      } catch (error) {
        button.disabled = false;
        $("#registerHint").textContent = error.message || "注册失败，请稍后再试。";
      }
    });

    $("#enterServerButton")?.addEventListener("click", () => {
      app.audio?.start("login", true);
      enterServer();
    });
    $("#warehouseBackButton")?.addEventListener("click", () => {
      closeDeleteDialog();
      showStage("server");
    });
    $("#serverBackButton")?.addEventListener("click", () => {
      app.offlineMode = false;
      $("#serverHint").textContent = "";
      showStage("auth");
    });
    $("#createPrevButton")?.addEventListener("click", () => {
      createIndex = (createIndex - 1 + CREATABLE_CHARACTERS.length) % CREATABLE_CHARACTERS.length;
      renderCreateStage();
    });
    $("#createNextButton")?.addEventListener("click", () => {
      createIndex = (createIndex + 1) % CREATABLE_CHARACTERS.length;
      renderCreateStage();
    });
    $("#createConfirmButton")?.addEventListener("click", () => confirmCreateCharacter());
    $("#createBackButton")?.addEventListener("click", () => {
      renderWarehouse();
      showStage("warehouse");
    });
    $("#deleteConfirmButton")?.addEventListener("click", () => confirmDeleteCharacter());
    $("#deleteCancelButton")?.addEventListener("click", () => closeDeleteDialog());
    $("#deleteDialog")?.addEventListener("click", event => {
      if (event.target === event.currentTarget) closeDeleteDialog();
    });
    $("#musicToggle").addEventListener("click", () => app.audio.toggle(true));
    {
      const attackButton = $("#attackButton");
      let pointerDown = false;
      let pointerHandledAt = 0;
      attackButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        pointerDown = true;
        pointerHandledAt = performance.now();
        attackButton.setPointerCapture?.(event.pointerId);
        app.scene?.beginPrimaryActionHold();
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName => {
        attackButton.addEventListener(eventName, event => {
          if (!pointerDown && eventName !== "lostpointercapture") return;
          event.preventDefault?.();
          pointerDown = false;
          app.scene?.releasePrimaryActionHold();
        });
      });
      attackButton.addEventListener("click", event => {
        event.preventDefault();
        if (performance.now() - pointerHandledAt > 450) {
          app.scene?.beginPrimaryActionHold();
          app.scene?.releasePrimaryActionHold();
        }
      });
    }
    $("#healButton").addEventListener("click", () => healPlayer());
    $("#ultimateButton")?.addEventListener("click", () => app.scene?.castUltimate());
    $("#transformButton")?.addEventListener("click", () => app.scene?.toggleTransformState());
    $("#inventoryToggleButton")?.addEventListener("click", () => {
      setInventoryOpen($("#inventoryPanel")?.classList.contains("collapsed"));
    });
    $("#inventoryCloseButton")?.addEventListener("click", () => setInventoryOpen(false));
    $("#inventoryActionButton")?.addEventListener("click", () => toggleSelectedInventoryItem());
    $("#reconnectButton").addEventListener("click", () => app.multiplayer?.connect());
    $("#exitButton").addEventListener("click", () => exitGame());
    $("#reviveButton").addEventListener("click", () => app.scene?.revivePlayer());
    $("#stayDownButton").addEventListener("click", () => renderReviveDialog(false));
    $("#storyDialogueNextButton")?.addEventListener("click", () => advanceStoryDialogue());
    $("#chapterClearCloseButton")?.addEventListener("click", () => renderChapterClearPanel(false));
    $("#fullscreenButton").addEventListener("click", async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await $(".game-stage").requestFullscreen();
    });
    $("#chatForm")?.addEventListener("submit", event => {
      event.preventDefault();
      submitChat();
    });
    $("#chatInput")?.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.currentTarget.value = "";
      returnToGameFromChat();
    });
    bindTextEntryGuards();
    bindSkillTooltips();
    bindMobileControls();
  }

  document.addEventListener("DOMContentLoaded", () => {
    // iPadOS Safari 默认伪装成 MacIntel 桌面端，pointer:coarse 媒体查询可能不生效，
    // 用「Mac 平台 + 多触点」识别 iPad，加类名强制显示触屏操控
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isIPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
    if (isIOS || isIPadOS) {
      document.documentElement.classList.add("touch-ui");
    }
    renderLoginAssetProgress();
    loadLoginBackground();
    app.audio = new AudioEngine();
    app.multiplayer = new MultiplayerClient();
    bindUi();
    renderNetwork("未连接", false);
    renderBossHud();
  });
})();
