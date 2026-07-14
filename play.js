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
  const CHAPTER_ONE_MAPS_REQUEST_PATH = `${CHAPTER_ONE_MAPS_PATH}?v=20260714-sakura-safe-pedestrians-v6`;
  const CHAPTER_END_CINEMATIC_PATH = "assets/cg/p1boss-end.mp4";
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
      images.set(key, { key, path: item.path, type: "image" });
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
    const mapData = maps[selectedMapId];
    [...collectMapImageAssets(mapData), ...collectChapterMapRuntimeAssets(mapData, selectedMapId)].forEach(item => {
      if (queuedKeys.has(item.key) || scene.textures.exists(item.key)) return;
      queuedKeys.add(item.key);
      if (item.type === "spritesheet") scene.load.spritesheet(item.key, item.path, item.frameConfig);
      else scene.load.image(item.key, item.path);
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
  const WIND_MOTE_TEXTURE_KEY = "play-lina-wind-mote";
  const WIND_LEAF_TEXTURE_KEY = "play-lina-wind-leaf";
  const WIND_RIBBON_TEXTURE_KEY = "play-lina-wind-ribbon";
  const SWORD_WAVE_TEXTURE_KEY = "play-ayu-sword-wave";
  const PHYSICAL_SPARK_TEXTURE_KEY = "play-physical-spark";
  const LAODENG_SMOKE_TEXTURE_KEY = "play-laodeng-smoke";
  const LAODENG_BERSERK_PETAL_TEXTURE_KEY = "play-laodeng-berserk-petals";
  const CHARGE_HOLD_THRESHOLD = 280;
  const CHARGED_ATTACK_COST = 25;
  const ENERGY_DEFAULT_MAX = 150;
  const ENERGY_REGEN_PER_SECOND = 4.5;
  const ENERGY_HIT_GAIN = 8;
  const ENERGY_MELEE_HIT_GAIN = 6;
  const ULTIMATE_COST = 100;
  const HEAL_COST = 50;
  const LINA_GALE_RADIUS = MAP_TILE_SIZE * 5;
  const LINA_GALE_PUSH_DISTANCE = MAP_TILE_SIZE;
  const LINA_GALE_DAMAGE_MULTIPLIER = 1.55;
  const LINA_HEAL_CHAIN_RANGE = MAP_TILE_SIZE * 10;
  const LINA_HEAL_CHAIN_JUMPS = 5;
  const LINA_HEAL_CHAIN_BASE = 28;
  const LINA_HEAL_CHAIN_MULTIPLIER = 1.25;
  const LINA_HEAL_CHAIN_SHIELD_BASE = 20;
  const LINA_HEAL_CHAIN_SHIELD_MULTIPLIER = 0.65;
  const LINA_HEAL_CHAIN_HOLD_MS = 250;
  const AYU_SWORD_WAVE_RANGE = MAP_TILE_SIZE * 5.6;
  const AYU_SWORD_WAVE_AOE_RADIUS = 112;
  const AYU_SWORD_WAVE_AOE_MULTIPLIER = 0.38;
  const ZHIXIA_LIGHTNING_RANGE = MAP_TILE_SIZE * 7;
  const ZHIXIA_LIGHTNING_REFRACT_RANGE = MAP_TILE_SIZE * 5;
  const ZHIXIA_PROJECTILE_CAST_OFFSET = 86;
  const ZHIXIA_PROJECTILE_SPEED = 1080;
  const ZHIXIA_ULTIMATE_CHAIN_DURATION = 1500;
  const ZHIXIA_ULTIMATE_CHAIN_INTERVAL = 250;
  const ZHIXIA_ULTIMATE_CHAIN_HOP_INTERVAL = 42;
  const ZHIXIA_ULTIMATE_CHAIN_REFRACTIONS = 3;
  const ZHIXIA_ULTIMATE_CHAIN_DAMAGE_MULTIPLIER = 0.36;
  const LIGHTNING_SPARK_TEXTURE_KEY = "play-lightning-spark";
  const LIGHTNING_MOTE_TEXTURE_KEY = "play-lightning-mote";
  const LIGHTNING_RIBBON_TEXTURE_KEY = "play-lightning-ribbon";
  const ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY = "play-zhixia-ultimate-bolt";
  const ZHIXIA_ULTIMATE_CROWN_TEXTURE_KEY = "play-zhixia-ultimate-crown";
  const LAODENG_BERSERK_DURATION = 8000;
  const LAODENG_BERSERK_SCALE = 1.25;
  const LAODENG_BERSERK_DAMAGE_MULTIPLIER = 1.5;
  const JIANGXUN_BARRAGE_ARROWS = 15;
  const JIANGXUN_BARRAGE_SPREAD = Phaser.Math.DegToRad(30);
  const JIANGXUN_BARRAGE_AOE_RADIUS = 84;
  const JIANGXUN_BARRAGE_AOE_MULTIPLIER = 0.32;
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
  const M02A_MUMU_NPC_KEY = "ch1-m02a-mumu-npc";
  const M02A_MUMU_NPC_IMAGE = "assets/game/characters/npcs/ch1-m02a-mumu-sprites-v13-efv.png";
  const M02A_MUMU_IDLE_ANIMATION = "ch1-m02a-mumu-idle";
  const M02A_XIAOZHU_PET_KEY = "ch1-m02a-xiaozhu-pet";
  const M02A_XIAOZHU_PET_IMAGE = "assets/game/characters/npcs/ch1-m02a-xiaozhu-sprites-v13-efv.png";
  const M02A_XIAOZHU_IDLE_ANIMATION = "ch1-m02a-xiaozhu-idle";
  const LEAF_SLIME_DETECT_RANGE = MAP_TILE_SIZE * 9;
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
  const ENEMY_SEED_PROJECTILE_KEY = "play-enemy-seed-projectile";
  const ENEMY_PROJECTILE_LIFETIME_MS = 4200;

  const BOSS_KEY = "play-ai-professor-boss";
  const BOSS_IMAGE = "assets/game/bosses/ai-professor-summoner-game-cutout-v1.png";
  const BOSS_VISUAL_SCALE = 0.42;
  const BOSS_REWARD_CHEST_KEY = "ch1-boss-reward-chest";
  const BOSS_REWARD_CHEST_IMAGE = "assets/game/items/ch1-boss-reward-chest-sheet-v1.png";
  const BOSS_REWARD_CHEST_FRAME_WIDTH = 192;
  const BOSS_REWARD_CHEST_FRAME_HEIGHT = 144;
  const PROFESSOR_FLY_KEY = "ch1-ai-professor-fly";
  const PROFESSOR_FLY_IMAGE = "assets/game/characters/npcs/ai-professor-fly-v1.png";
  const PROFESSOR_FLY_VISUAL_SCALE = 0.18;
  const QUANTUM_SCHOLAR_KEY = "ch1-enemy-quantum-scholar-rare";
  const QUANTUM_FAMILIAR_KEY = "ch1-enemy-quantum-familiar-elite";
  const QUANTUM_PAPER_KEY = "ch1-enemy-quantum-paper-mob";
  const BLOCKCHAIN_CHAINBEAST_KEY = "ch1-enemy-blockchain-chainbeast-rare";
  const BLOCKCHAIN_LOCK_KEY = "ch1-enemy-blockchain-lock-elite";
  const BLOCKCHAIN_SPIDER_KEY = "ch1-enemy-blockchain-spider-mob";
  const AIAGENT_CYBERMAGE_KEY = "ch1-enemy-aiagent-cybermage-rare";
  const AIAGENT_DIGITAL_CAT_KEY = "ch1-enemy-aiagent-digital-cat-elite";
  const AIAGENT_BOTCAT_KEY = "ch1-enemy-aiagent-botcat-mob";
  const GARDEN_THORN_HOUND_KEY = "ch1-enemy-garden-thorn-hound-elite";
  const GARDEN_POLLEN_MOTH_KEY = "ch1-enemy-garden-pollen-moth-elite";
  const GARDEN_VINE_GARDENER_KEY = "ch1-enemy-garden-vine-gardener-elite";
  const GARDEN_MOON_ORCHID_KEY = "ch1-enemy-garden-moon-orchid-rare";
  const GARDEN_CARNIVORA_BOSS_KEY = "ch1-enemy-garden-carnivora-boss";
  const M04_STRUCTURAL_BOSS_KEY = "ch1-m04-structural-instability-boss";
  const enemyGridFrames = (row, columns, start = 0, end = columns - 1) =>
    Array.from({ length: end - start + 1 }, (_, index) => row * columns + start + index);
  const CHAPTER_ONE_ANIMATED_ENEMY_SPRITES = [
    {
      key: GARDEN_THORN_HOUND_KEY,
      path: "assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "gardenHound",
      actions: {
        move: { frames: enemyGridFrames(0, 8), frameRate: 10, repeat: -1 },
        attack: { frames: enemyGridFrames(1, 8), frameRate: 15, repeat: 0 },
        hit: { frames: enemyGridFrames(2, 8, 0, 2), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(2, 8, 2, 7), frameRate: 9, repeat: 0 }
      }
    },
    {
      key: GARDEN_POLLEN_MOTH_KEY,
      path: "assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "gardenMoth",
      actions: {
        move: { frames: enemyGridFrames(3, 8), frameRate: 12, repeat: -1 },
        attack: { frames: enemyGridFrames(4, 8), frameRate: 13, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 8, 0, 2), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(5, 8, 2, 7), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: GARDEN_VINE_GARDENER_KEY,
      path: "assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "gardenGardener",
      actions: {
        move: { frames: enemyGridFrames(6, 8), frameRate: 9, repeat: -1 },
        attack: { frames: enemyGridFrames(7, 8, 0, 4), frameRate: 12, repeat: 0 },
        hit: { frames: enemyGridFrames(7, 8, 3, 5), frameRate: 12, repeat: 0 },
        dead: { frames: enemyGridFrames(7, 8, 4, 7), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: GARDEN_MOON_ORCHID_KEY,
      path: "assets/game/enemies/animated/ch1-m03-moon-orchid-rare-sheet-v3.png",
      frameWidth: 196,
      frameHeight: 147,
      archetype: "moonOrchid",
      actions: {
        move: { frames: enemyGridFrames(1, 6), frameRate: 11, repeat: -1 },
        attack: { frames: enemyGridFrames(2, 6), frameRate: 13, repeat: 0 },
        special: { frames: enemyGridFrames(4, 6), frameRate: 12, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 6), frameRate: 13, repeat: 0 },
        enrage: { frames: enemyGridFrames(6, 6), frameRate: 11, repeat: 0 },
        dead: { frames: enemyGridFrames(7, 6), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: GARDEN_CARNIVORA_BOSS_KEY,
      path: "assets/game/enemies/animated/ch1-m03-carnivora-boss-sheet-v3.png",
      frameWidth: 196,
      frameHeight: 168,
      archetype: "carnivora",
      actions: {
        move: { frames: enemyGridFrames(1, 6), frameRate: 8, repeat: -1 },
        attack: { frames: enemyGridFrames(2, 6), frameRate: 12, repeat: 0 },
        devour: { frames: enemyGridFrames(3, 6), frameRate: 12, repeat: 0 },
        special: { frames: enemyGridFrames(4, 6), frameRate: 11, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 6, 0, 2), frameRate: 12, repeat: 0 },
        enrage: { frames: enemyGridFrames(5, 6, 2, 5), frameRate: 10, repeat: 0 },
        dead: { frames: enemyGridFrames(6, 6), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: QUANTUM_SCHOLAR_KEY,
      path: "assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "quantumScholar",
      actions: {
        move: { frames: enemyGridFrames(0, 8), frameRate: 8, repeat: -1 },
        attack: { frames: enemyGridFrames(1, 8), frameRate: 13, repeat: 0 },
        hit: { frames: enemyGridFrames(2, 8, 0, 2), frameRate: 12, repeat: 0 },
        dead: { frames: enemyGridFrames(2, 8, 2, 7), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: QUANTUM_FAMILIAR_KEY,
      path: "assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "quantumFamiliar",
      actions: {
        move: { frames: enemyGridFrames(3, 8), frameRate: 13, repeat: -1 },
        attack: { frames: enemyGridFrames(4, 8), frameRate: 16, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 8, 0, 2), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(5, 8, 2, 7), frameRate: 9, repeat: 0 }
      }
    },
    {
      key: QUANTUM_PAPER_KEY,
      path: "assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "quantumPaper",
      actions: {
        move: { frames: enemyGridFrames(6, 8), frameRate: 12, repeat: -1 },
        attack: { frames: enemyGridFrames(7, 8, 0, 4), frameRate: 15, repeat: 0 },
        hit: { frames: enemyGridFrames(7, 8, 3, 5), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(7, 8, 4, 7), frameRate: 9, repeat: 0 }
      }
    },
    {
      key: BLOCKCHAIN_CHAINBEAST_KEY,
      path: "assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "chainBeast",
      actions: {
        move: { frames: enemyGridFrames(0, 8), frameRate: 9, repeat: -1 },
        attack: { frames: enemyGridFrames(1, 8), frameRate: 13, repeat: 0 },
        hit: { frames: enemyGridFrames(2, 8, 0, 2), frameRate: 12, repeat: 0 },
        dead: { frames: enemyGridFrames(2, 8, 2, 7), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: BLOCKCHAIN_LOCK_KEY,
      path: "assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "validationLock",
      actions: {
        move: { frames: enemyGridFrames(3, 8), frameRate: 9, repeat: -1 },
        attack: { frames: enemyGridFrames(4, 8), frameRate: 12, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 8, 0, 2), frameRate: 12, repeat: 0 },
        dead: { frames: enemyGridFrames(5, 8, 2, 7), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: BLOCKCHAIN_SPIDER_KEY,
      path: "assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png",
      frameWidth: 147,
      frameHeight: 147,
      archetype: "chainSpider",
      actions: {
        move: { frames: enemyGridFrames(6, 8), frameRate: 14, repeat: -1 },
        attack: { frames: enemyGridFrames(7, 8, 0, 4), frameRate: 15, repeat: 0 },
        hit: { frames: enemyGridFrames(7, 8, 3, 5), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(7, 8, 4, 7), frameRate: 9, repeat: 0 }
      }
    },
    {
      key: AIAGENT_CYBERMAGE_KEY,
      path: "assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png",
      frameWidth: 168,
      frameHeight: 147,
      archetype: "agentMage",
      actions: {
        move: { frames: enemyGridFrames(0, 7), frameRate: 8, repeat: -1 },
        attack: { frames: enemyGridFrames(1, 7), frameRate: 13, repeat: 0 },
        hit: { frames: enemyGridFrames(2, 7, 0, 2), frameRate: 12, repeat: 0 },
        dead: { frames: enemyGridFrames(2, 7, 2, 6), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: AIAGENT_DIGITAL_CAT_KEY,
      path: "assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png",
      frameWidth: 168,
      frameHeight: 147,
      archetype: "digitalCat",
      actions: {
        move: { frames: enemyGridFrames(3, 7), frameRate: 14, repeat: -1 },
        attack: { frames: enemyGridFrames(4, 7), frameRate: 17, repeat: 0 },
        hit: { frames: enemyGridFrames(5, 7, 0, 2), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(5, 7, 2, 6), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: AIAGENT_BOTCAT_KEY,
      path: "assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png",
      frameWidth: 168,
      frameHeight: 147,
      archetype: "botCat",
      actions: {
        move: { frames: enemyGridFrames(6, 7), frameRate: 13, repeat: -1 },
        attack: { frames: enemyGridFrames(7, 7, 0, 4), frameRate: 15, repeat: 0 },
        hit: { frames: enemyGridFrames(7, 7, 3, 5), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(7, 7, 4, 6), frameRate: 8, repeat: 0 }
      }
    },
    {
      key: M04_STRUCTURAL_BOSS_KEY,
      path: "assets/game/bosses/m04-structural-instability-boss-sheet-v3-hd.png",
      frameWidth: 224,
      frameHeight: 256,
      archetype: "structuralBoss",
      actions: {
        move: { frames: enemyGridFrames(1, 8), frameRate: 8, repeat: -1 },
        attack: { frames: enemyGridFrames(2, 8), frameRate: 12, repeat: 0 },
        transform: { frames: enemyGridFrames(3, 8), frameRate: 8, repeat: 0 },
        phaseMove: { frames: enemyGridFrames(4, 8), frameRate: 14, repeat: -1 },
        phaseAttack: { frames: enemyGridFrames(5, 8), frameRate: 16, repeat: 0 },
        phaseSpecial: { frames: enemyGridFrames(6, 8), frameRate: 15, repeat: 0 },
        hit: { frames: enemyGridFrames(7, 8, 0, 3), frameRate: 13, repeat: 0 },
        dead: { frames: enemyGridFrames(8, 8), frameRate: 8, repeat: 0 }
      }
    }
  ];
  const CHAPTER_ONE_ANIMATED_ENEMY_SHEETS = [];
  const animatedEnemySheetByPath = new Map();
  CHAPTER_ONE_ANIMATED_ENEMY_SPRITES.forEach(item => {
    let sheet = animatedEnemySheetByPath.get(item.path);
    if (!sheet) {
      sheet = {
        key: `ch1-animated-enemy-sheet-${CHAPTER_ONE_ANIMATED_ENEMY_SHEETS.length + 1}`,
        path: item.path,
        type: "spritesheet",
        frameConfig: { frameWidth: item.frameWidth, frameHeight: item.frameHeight }
      };
      animatedEnemySheetByPath.set(item.path, sheet);
      CHAPTER_ONE_ANIMATED_ENEMY_SHEETS.push(sheet);
    }
    item.sheetKey = sheet.key;
  });

  function collectChapterMapRuntimeAssets(mapData, mapId) {
    const logicalEnemyKeys = new Set((mapData?.enemySpawns || []).map(enemy => enemy.textureKey).filter(Boolean));
    (mapData?.ambientEnemyRefresh?.enemies || [])
      .map(enemy => enemy?.textureKey)
      .filter(Boolean)
      .forEach(key => logicalEnemyKeys.add(key));
    if (mapId === "ch1_m04_library_lawn_boss") {
      [
        QUANTUM_SCHOLAR_KEY,
        QUANTUM_FAMILIAR_KEY,
        QUANTUM_PAPER_KEY,
        BLOCKCHAIN_CHAINBEAST_KEY,
        BLOCKCHAIN_LOCK_KEY,
        BLOCKCHAIN_SPIDER_KEY,
        AIAGENT_CYBERMAGE_KEY,
        AIAGENT_DIGITAL_CAT_KEY,
        AIAGENT_BOTCAT_KEY,
        M04_STRUCTURAL_BOSS_KEY
      ].forEach(key => logicalEnemyKeys.add(key));
    }
    const runtimeAssets = [];
    CHAPTER_ONE_ENEMY_SPRITES
      .filter(item => logicalEnemyKeys.has(item.key))
      .forEach(item => runtimeAssets.push({
        ...item,
        type: "spritesheet",
        frameConfig: { frameWidth: LEAF_SLIME_FRAME_SIZE, frameHeight: LEAF_SLIME_FRAME_SIZE }
      }));
    const animatedSheetKeys = new Set();
    CHAPTER_ONE_ANIMATED_ENEMY_SPRITES
      .filter(item => logicalEnemyKeys.has(item.key))
      .forEach(item => animatedSheetKeys.add(item.sheetKey));
    CHAPTER_ONE_ANIMATED_ENEMY_SHEETS
      .filter(sheet => animatedSheetKeys.has(sheet.key))
      .forEach(sheet => runtimeAssets.push(sheet));
    if (mapId === "ch1_m02a_auditorium_branch") {
      runtimeAssets.push(
        {
          key: M02A_MUMU_NPC_KEY,
          path: M02A_MUMU_NPC_IMAGE,
          type: "spritesheet",
          frameConfig: { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE }
        },
        {
          key: M02A_XIAOZHU_PET_KEY,
          path: M02A_XIAOZHU_PET_IMAGE,
          type: "spritesheet",
          frameConfig: { frameWidth: FRAME_SIZE, frameHeight: FRAME_SIZE }
        }
      );
    }
    if (mapId === "ch1_m04_library_lawn_boss") {
      runtimeAssets.push(
        { key: PROFESSOR_FLY_KEY, path: PROFESSOR_FLY_IMAGE, type: "image" },
        {
          key: BOSS_VOID_PORTAL_KEY,
          path: BOSS_VOID_PORTAL_IMAGE,
          type: "spritesheet",
          frameConfig: { frameWidth: BOSS_VOID_PORTAL_FRAME_WIDTH, frameHeight: BOSS_VOID_PORTAL_FRAME_HEIGHT }
        }
      );
    }
    return runtimeAssets;
  }
  const CHAPTER_ONE_ENEMY_IMAGES = [];
  const BOSS_PORTAL_OPEN_MS = 360;
  const BOSS_PORTAL_EGRESS_MS = 520;
  const BOSS_PORTAL_CLOSE_MS = 260;
  const BOSS_PORTAL_STAGGER_MS = 55;
  const STRUCTURAL_CHARGE_INTERVAL_MS = 10000;
  const STRUCTURAL_REINFORCEMENT_INTERVAL_MS = 2200;
  const STRUCTURAL_FIRE_PATH_DELAY_MS = 5000;
  const STRUCTURAL_PURSUIT_STUN_MS = 3000;
  const STRUCTURAL_PHASE3_DASH_COOLDOWN_MS = 7600;
  const STRUCTURAL_CHARGER_GROUP = "ch1_m04_structural_chargers";
  const STRUCTURAL_REINFORCEMENT_GROUP = "ch1_m04_structural_reinforcements";
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
  const M04_MAP_ID = "ch1_m04_library_lawn_boss";
  const BOSS_CHEST_FLAG = "ch1_boss_chest_opened";
  const PLAYER_STATUS_SUPPRESS_MS = 260;
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
  const ENTRY_LOADING_MIN_MS = 900;
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
  const AYU_WALK_FRAMES = ALL_FRAMES;
  const FOUR_FRAMES = [0, 1, 2, 3];
  const CHARGE_LOOP_FRAMES = [1, 2, 3];
  const ULTIMATE_CAST_FRAMES = [0, 1, 2, 3, 1, 2, 3];
  const SIX_FRAMES = [0, 1, 2, 3, 4, 5];
  const ZHIXIA_WALK_FRAMES = [0, 1, 2, 4, 5, 6];
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
    { id: "catRun", row: 6, fps: 13, repeat: -1, frames: FOUR_FRAMES },
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
      portrait: "assets/portraits/ayu-q-v2.png",
      sprite: "assets/sprites/ayu-sprites-v19-redrawn-walk-cat-end.png",
      baseline: 140,
      speed: 270
    },
    {
      id: "zhixia",
      name: "知夏",
      color: "#66bfe8",
      portrait: "assets/portraits/zhixia.png",
      sprite: "assets/sprites/zhixia/zhixia-sprites-final.png",
      baseline: 140,
      speed: 250
    },
    {
      id: "laodeng",
      name: "老登",
      color: "#e18a52",
      portrait: "assets/portraits/laodeng-q-v2.png",
      sprite: "assets/sprites/laodeng-sprites-v9-redrawn-cat-run.png",
      baseline: 140,
      speed: 235
    },
    {
      id: "jiangxun",
      name: "江寻",
      color: "#68a977",
      portrait: "assets/portraits/jiangxun-q-v2.png",
      sprite: "assets/sprites/jiangxun-sprites-v10-redrawn-cat-motion.png",
      baseline: 140,
      speed: 255
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
    },
    "ch1_drop_thorn_seed": {
      id: "ch1_drop_thorn_seed",
      name: "荆棘种核",
      type: "material",
      quality: "excellent",
      description: "荆棘猎犬巡逻时凝成的硬质种核，可用于花园研究。"
    },
    "ch1_drop_pollen_lantern": {
      id: "ch1_drop_pollen_lantern",
      name: "花粉灯芯",
      type: "material",
      quality: "excellent",
      description: "花粉灯蛾留下的冷光灯芯，仍在缓慢释放稳定花粉。"
    },
    "ch1_drop_gardener_badge": {
      id: "ch1_drop_gardener_badge",
      name: "园艺校徽",
      type: "material",
      quality: "excellent",
      description: "藤蔓园丁胸前脱落的学院徽记，刻着生态园养护编号。"
    },
    "ch1_drop_moon_orchid": {
      id: "ch1_drop_moon_orchid",
      name: "月兰花冠",
      type: "material",
      quality: "rare",
      description: "月兰守卫净化后留下的银蓝花冠，蕴含稀有生态记录。"
    },
    "ch1_drop_carnivora_core": {
      id: "ch1_drop_carnivora_core",
      name: "食人花院核",
      type: "material",
      quality: "epic",
      description: "食人花院长的种荚核心，记录着中央花坛异常生长的完整参数。"
    }
  };

  const SKILL_DEFINITIONS = {
    lina: {
      attack: {
        name: "风飞弹 / 狂风重击",
        key: "J",
        description: "普攻发射风飞弹，伤害 = 魔力 × 100%。长按重击使脚下风压扩散 5 格，伤害 = 魔力 × 155%，仅将普通小怪弹飞 1 格，精英与 BOSS 免疫位移。"
      },
      ultimate: {
        name: "同心愈风链",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，在 10 格内友方之间弹射 5 次，优先命中血量比例最低者。每次治疗 28 + 魔力 × 125% HP；目标满血时改为增加 20 + 魔力 × 65% 护盾。`
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
        name: "光刃二连斩",
        key: "J",
        description: "短按造成攻击力 × 100% 物理伤害；长按重击发动二连斩，每段造成攻击力 × 85%，每次命中回复 6 EN。"
      },
      ultimate: {
        name: "三重剑气",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，同时向前发出 3 股剑气，每股造成攻击力 × 180% 物理伤害并飞行 7 格。`
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
    zhixia: {
      attack: {
        name: "雷弧术",
        key: "J",
        description: "短按发射高速雷光球，造成魔力 × 100% 魔法伤害；长按重击自动锁定 7 格内最近目标，并在目标周围 5 格内折射 2 次，三段伤害为 100% / 80% / 50%。"
      },
      ultimate: {
        name: "十格落雷",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，沿瞄准方向连续轰击 10 格，每格造成魔力 × 115% 范围魔法伤害，总射程 10 格。`
      },
      heal: {
        name: "樱光护盾",
        key: "H",
        description: `消耗 ${HEAL_COST} EN，恢复 42 HP 并获得 36 点护盾。`
      },
      transform: {
        name: "学术猫形态",
        key: "L",
        description: "切换猫形态。移动速度提升至 200%，主要攻击变为向前跳跃。"
      }
    },
    laodeng: {
      attack: {
        name: "奔雷拳",
        key: "J",
        description: "短按造成攻击力 × 100% 物理伤害；长按发动冲击拳，造成攻击力 × 175% 范围伤害并击退小怪与精英。BOSS 免疫击退，但会承受追加多段伤害。"
      },
      ultimate: {
        name: "狂暴",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，持续 30 秒：体型增大 30%，移动速度与攻击速度提升 50%，拳击范围扩大、伤害提升 50%，并获得 20% 吸血。`
      },
      heal: {
        name: "樱光护盾",
        key: "H",
        description: `消耗 ${HEAL_COST} EN，恢复 42 HP 并获得 36 点护盾。`
      },
      transform: {
        name: "学术猫形态",
        key: "L",
        description: "切换猫形态。移动速度提升至 200%，主要攻击变为向前跳跃。"
      }
    },
    jiangxun: {
      attack: {
        name: "穿云箭",
        key: "J",
        description: "短按射箭造成攻击力 × 100% 物理伤害；长按射出穿云箭，穿越沿途怪物和障碍。命中大型目标或 BOSS 时按穿体时间造成最多 3 段伤害。"
      },
      ultimate: {
        name: "乱射",
        key: "K",
        description: `消耗 ${ULTIMATE_COST} EN，在 30° 扇区内快速随机射出 15 支箭，每箭造成攻击力 × 52% 物理伤害。`
      },
      heal: {
        name: "樱光护盾",
        key: "H",
        description: `消耗 ${HEAL_COST} EN，恢复 42 HP 并获得 36 点护盾。`
      },
      transform: {
        name: "学术猫形态",
        key: "L",
        description: "切换猫形态。移动速度提升至 200%，主要攻击变为向前跳跃。"
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
        { rank: "rare", label: "链铸稀有精英", dx: -270, dy: 105, textureKey: BLOCKCHAIN_CHAINBEAST_KEY, staticImage: false, tint: 0xffffff, scale: 1.35, maxHp: 300, damage: 17, creditDefense: 5, rewardExp: 46, rewardCredits: 5, dropId: "ch1_drop_chain_forge_core", dropName: "链铸重核" },
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
        { rank: "rare", label: "数字猫稀有精英", dx: 270, dy: 105, textureKey: AIAGENT_DIGITAL_CAT_KEY, staticImage: false, tint: 0xffffff, scale: 1.2, maxHp: 320, damage: 18, creditDefense: 6, rewardExp: 48, rewardCredits: 5, dropId: "ch1_drop_agent_memory_core", dropName: "Agent 记忆核心" },
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
      mapX: 560,
      mapY: 620,
      units: [
        { rank: "rare", label: "量子观测稀有精英", dx: 260, dy: 110, textureKey: QUANTUM_SCHOLAR_KEY, staticImage: false, tint: 0xffffff, scale: 1.35, maxHp: 260, damage: 15, creditDefense: 4, rewardExp: 44, rewardCredits: 4, dropId: "ch1_drop_quantum_probability_core", dropName: "量子概率核心" },
        { rank: "elite", label: "波函数精英", dx: -220, dy: 120, textureKey: QUANTUM_FAMILIAR_KEY, staticImage: false, tint: 0xffffff, scale: 1.3, maxHp: 150, damage: 12, rewardExp: 24, rewardCredits: 2, dropId: "ch1_drop_quantum_shard", dropName: "量子相干碎片" },
        { rank: "mob", label: "量子纸灵", dx: -70, dy: 265, textureKey: QUANTUM_PAPER_KEY, staticImage: false, tint: 0xffffff, scale: 0.95, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "量子纸灵", dx: 100, dy: 275, textureKey: QUANTUM_PAPER_KEY, staticImage: false, tint: 0xffffff, scale: 0.95, maxHp: 72, damage: 9, rewardExp: 12, rewardCredits: 1 },
        { rank: "mob", label: "纠缠火花", dx: 0, dy: -170, textureKey: QUANTUM_PAPER_KEY, staticImage: false, tint: 0xc7f7ff, scale: 0.92, maxHp: 68, damage: 9, rewardExp: 12, rewardCredits: 1 }
      ]
    },
    {
      title: "区块链系",
      color: 0xf3c75d,
      mapX: 1880,
      mapY: 620,
      units: [
        { rank: "rare", label: "链铸重兽稀有精英", dx: -270, dy: 105, textureKey: BLOCKCHAIN_CHAINBEAST_KEY, staticImage: false, tint: 0xffffff, scale: 1.35, maxHp: 300, damage: 17, creditDefense: 5, rewardExp: 46, rewardCredits: 5, dropId: "ch1_drop_chain_forge_core", dropName: "链铸重核" },
        { rank: "elite", label: "重锁精英", dx: 235, dy: 130, textureKey: BLOCKCHAIN_LOCK_KEY, staticImage: false, tint: 0xffffff, scale: 1.25, maxHp: 175, damage: 13, rewardExp: 26, rewardCredits: 3, dropId: "ch1_drop_blockchain_lock", dropName: "验证锁片" },
        { rank: "mob", label: "链爪小怪", dx: -110, dy: 270, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: false, tint: 0xffffff, scale: 0.9, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "链爪小怪", dx: 65, dy: 285, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: false, tint: 0xffffff, scale: 0.9, maxHp: 86, damage: 10, rewardExp: 13, rewardCredits: 1 },
        { rank: "mob", label: "锁扣小怪", dx: 160, dy: -150, textureKey: BLOCKCHAIN_SPIDER_KEY, staticImage: false, tint: 0xffe0a6, scale: 0.88, maxHp: 82, damage: 10, rewardExp: 13, rewardCredits: 1 }
      ]
    },
    {
      title: "AI Agent 系",
      color: 0x8f72d6,
      mapX: 3135,
      mapY: 620,
      units: [
        { rank: "rare", label: "Agent 协调稀有精英", dx: 270, dy: 105, textureKey: AIAGENT_CYBERMAGE_KEY, staticImage: false, tint: 0xffffff, scale: 1.25, maxHp: 320, damage: 18, creditDefense: 6, rewardExp: 48, rewardCredits: 5, dropId: "ch1_drop_agent_memory_core", dropName: "Agent 记忆核心" },
        { rank: "elite", label: "数字猫精英", dx: -235, dy: 130, textureKey: AIAGENT_DIGITAL_CAT_KEY, staticImage: false, tint: 0xffffff, scale: 1.2, maxHp: 190, damage: 14, rewardExp: 28, rewardCredits: 3, dropId: "ch1_drop_agent_tool_node", dropName: "工具节点" },
        { rank: "mob", label: "工具调用小怪", dx: -135, dy: 275, textureKey: AIAGENT_BOTCAT_KEY, staticImage: false, tint: 0xffffff, scale: 0.95, maxHp: 92, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "记忆碎片", dx: 45, dy: 285, textureKey: AIAGENT_BOTCAT_KEY, staticImage: false, tint: 0xcff7ff, scale: 0.94, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 },
        { rank: "mob", label: "子任务幽影", dx: -35, dy: -165, textureKey: AIAGENT_BOTCAT_KEY, staticImage: false, tint: 0xd9c3ff, scale: 0.94, maxHp: 88, damage: 11, rewardExp: 14, rewardCredits: 1 }
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
    cinematicActive: false,
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

  function playerDisplayName(player = {}) {
    const name = String(player.name || player.nickname || "").trim();
    const characterNames = new Set(CHARACTERS.map(character => character.name));
    if (name && !characterNames.has(name)) return name.slice(0, 16);
    const account = String(player.account || player.username || "").trim();
    if (account && account !== "local-guest") return account.slice(0, 16);
    const id = String(player.id || "").trim();
    if (id && !id.startsWith("p-")) return id.slice(0, 16);
    return "离线玩家";
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
    },
    {
      id: "zhixia",
      role: "雷电法师 · ARC-MAGE",
      desc: "以雷电术式控制战场的校园法师，擅长连锁闪电与长距离落雷压制。",
      quote: "「把思路连起来，雷光自然会找到答案。」"
    },
    {
      id: "laodeng",
      role: "近战拳师 · BRAWLER",
      desc: "沉稳可靠的近战拳师，奔雷拳打散敌阵，狂暴后以范围拳风持续吸血。",
      quote: "「先站稳，再一拳把问题讲明白。」"
    },
    {
      id: "jiangxun",
      role: "穿透猎人 · RANGER",
      desc: "冷静敏锐的校园猎人，穿云箭贯穿目标，乱射可持续封锁大片区域。",
      quote: "「风向、距离、落点，都已经算好了。」"
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
        const character = getCharacter(entry.characterId);
        const stand = document.createElement("div");
        stand.className = "sprite-stand";
        const shadow = document.createElement("i");
        shadow.className = "sprite-shadow";
        const sprite = document.createElement("div");
        sprite.className = "sprite-anim";
        setupSpriteAnim(sprite, character, 128);
        stand.append(shadow, sprite);
        const label = document.createElement("span");
        label.className = "slot-name";
        label.textContent = `${character.name} · Lv.${entry.level || 1}`;
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
    const characterName = getCharacter(entry.characterId).name;
    $("#deleteDialogText").textContent = `确定要删除「${characterName} · Lv.${entry.level || 1}」吗？角色的等级和进度将无法找回。`;
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
        const characterName = getCharacter(meta.id).name;
        const data = await apiRequest("/api/characters/create", {
          method: "POST",
          body: { characterId: meta.id, name: characterName }
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
    const definition = button?.dataset.skillId
      ? getSkillDefinition(button.dataset.skillId)
      : button?.dataset.tooltipTitle
        ? {
            name: button.dataset.tooltipTitle,
            key: button.querySelector("small")?.textContent || "",
            description: button.dataset.tooltipDescription || ""
          }
        : null;
    if (!tooltip || !stage || !button || !definition) return;
    clearChildren(tooltip);
    const title = document.createElement("strong");
    title.textContent = definition.key ? `${definition.name} · ${definition.key}` : definition.name;
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
    $("#hudName").textContent = playerDisplayName(app.profile);
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

  function currentM04Session() {
    return app.multiplayer?.m04Session || null;
  }

  function isM04SessionActive() {
    const session = currentM04Session();
    return app.profile?.mapId === M04_MAP_ID && !!session?.active;
  }

  function isM04SessionLeader() {
    if (app.offlineMode) return true;
    const session = currentM04Session();
    return !!session?.active && String(session.leaderId || "") === String(app.profile?.id || "");
  }

  function isM04SharedFlag(flag) {
    return isM04SessionActive() && /^ch1_/.test(String(flag || ""));
  }

  function hasFlag(flag) {
    if (isM04SharedFlag(flag)) return currentM04Session().flagSet?.has(flag) || false;
    return !!flag && !!profileFlags()[flag];
  }

  function setFlag(flag, value = true, options = {}) {
    if (!flag || !app.profile) return;
    if (isM04SharedFlag(flag)) {
      const session = currentM04Session();
      if (!(session.flagSet instanceof Set)) session.flagSet = new Set(session.flags || []);
      if (value) session.flagSet.add(flag);
      else session.flagSet.delete(flag);
      session.flags = Array.from(session.flagSet);
      if (!isM04SessionLeader()) return;
    }
    const existed = !!profileFlags()[flag];
    profileFlags()[flag] = !!value;
    if (value && !existed && options.broadcast !== false && app.connected) {
      app.multiplayer?.sendProgressEvent({
        kind: "flag",
        eventId: flag,
        flags: [flag],
        mapId: app.profile.mapId || "",
        x: app.scene?.actor?.x || 0,
        y: app.scene?.actor?.y || 0
      });
    }
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
      { label: "花园：读取生态巡检记录", done: hasFlag("ch1_m03_garden_briefed") },
      { label: "花园：清理三名精英巡园者", done: hasFlag("ch1_m03_patrol_cleared") },
      { label: "花园：净化月兰守卫", done: hasFlag("ch1_m03_rare_cleared") },
      { label: "花园：击败中央食人花", done: hasFlag("ch1_m03_small_boss_cleared") },
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
    if (gainedLevels > 0) {
      app.scene?.playLevelUpEffect?.(gainedLevels, app.scene?.actor, app.profile.level);
      app.scene?.broadcastCombatEvent?.("levelUp", {
        x: app.scene?.actor?.x || 0,
        y: app.scene?.actor?.y || 0,
        level: app.profile.level,
        levels: gainedLevels
      });
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
    const touchButton = $("#mobileInteractButton");
    const available = !!text;
    if (touchButton) {
      touchButton.disabled = !available;
      touchButton.classList.toggle("available", available);
      touchButton.setAttribute("aria-hidden", String(!available));
    }
    if (!node || node.dataset.text === text) return;
    node.dataset.text = text;
    node.textContent = text;
    node.classList.toggle("open", available);
    node.setAttribute("aria-hidden", String(!available));
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
    renderChatSystem("欢迎来到同舟喵济公共频道。");
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
    const m04TextOnly = app.profile?.mapId === M04_MAP_ID;
    panel.classList.toggle("m04-text-only", m04TextOnly);
    panel.classList.toggle("open", !!app.boss.active);
    panel.setAttribute("aria-hidden", String(!app.boss.active));
    const ratio = clamp(app.boss.hp / app.boss.maxHp, 0, 1);
    $("#bossHpBar").style.width = `${Math.round(ratio * 100)}%`;
    const wave = Number(app.boss.waveIndex || 0) + 1;
    const total = Number(app.boss.wavesTotal || BOSS_SUMMON_WAVES.length);
    const hpText = `${Math.max(0, Math.ceil(app.boss.hp))} / ${app.boss.maxHp}`;
    const waveTitle = String(app.boss.waveTitle || "协议考核");
    const m04ProgressText = app.boss.phase === "final"
      ? `终局 · ${waveTitle} · ${hpText}`
      : app.boss.phase === "awaitingProfessor"
        ? wave > total
          ? "三波完成 · 靠近陆教授启动终局"
          : `第 ${Math.max(1, wave - 1)}/${total} 波完成 · 靠近陆教授继续`
        : app.boss.phase === "portalOpening"
          ? `第 ${wave}/${total} 波 · ${waveTitle} · 传送门开启`
          : `第 ${wave}/${total} 波 · ${waveTitle} · 剩余 ${Math.max(0, Math.ceil(app.boss.hp))}`;
    $("#bossHpText").textContent = !app.boss.active
      ? hpText
      : m04TextOnly
        ? m04ProgressText
        : app.boss.phase === "final"
          ? `终局 ${hpText}`
          : app.boss.phase === "awaitingProfessor" && wave > total
            ? "终局待启动"
            : `第 ${wave}/${total} 波 ${hpText}`;
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
    setPanelCollapsed("chapterHud", false);
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
      const fakeProgress = Math.min(78, (performance.now() - state.startedAt) / ENTRY_LOADING_MIN_MS * 78);
      const realProgress = Math.min(98, state.realProgress * 98);
      const progress = Math.max(fakeProgress, realProgress);
      const label = state.realProgress >= 1
        ? "正在同步玩家出生点"
        : progress >= 84
          ? "正在解码当前地图图像，首次进入会建立浏览器缓存"
          : "正在加载当前地图与必要角色资产";
      setEntryLoadingDom(progress, label);
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
      window.setTimeout(() => app.scene?.showAreaTitle?.(), 260);
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

  function setMapLoadingProgress(value, title = "") {
    const bar = $("#mapLoadingBar");
    const label = $("#mapLoadingTitle");
    const percent = clamp(Math.round(Number(value) || 0), 0, 100);
    if (bar) bar.style.width = `${percent}%`;
    if (label && title) label.textContent = title;
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

  const chapterEndCinematicState = {
    autoPreloadRequested: false,
    completion: null,
    previousActionLocked: false,
    resumeGameMusic: false
  };

  function initializeChapterEndCinematic() {
    const video = $("#chapterEndVideo");
    if (!video) return;
    video.preload = "metadata";
    video.dataset.assetPath = CHAPTER_END_CINEMATIC_PATH;
  }

  function hasConstrainedConnection() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return false;
    return !!connection.saveData || /(^|-)2g$/.test(String(connection.effectiveType || ""));
  }

  function scheduleChapterEndCinematicPreload(mapId = app.profile?.mapId) {
    const id = String(mapId || "");
    const inM3 = /^ch1_m03_/.test(id);
    const inM4 = /^ch1_m04_/.test(id);
    if ((!inM3 && !inM4) || chapterEndCinematicState.autoPreloadRequested) return;
    if (inM3 && hasConstrainedConnection()) return;
    const video = $("#chapterEndVideo");
    if (!video) return;
    chapterEndCinematicState.autoPreloadRequested = true;
    const begin = () => {
      if (app.cinematicActive || video.preload === "auto") return;
      video.preload = "auto";
      video.load();
    };
    if (inM4) {
      window.setTimeout(begin, 250);
    } else if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(begin, { timeout: 8000 });
    } else {
      window.setTimeout(begin, 5000);
    }
  }

  function finishChapterEndCinematic(complete = true) {
    const overlay = $("#chapterEndCinematic");
    const video = $("#chapterEndVideo");
    const replayButton = $("#chapterEndReplayButton");
    const completion = complete ? chapterEndCinematicState.completion : null;
    chapterEndCinematicState.completion = null;
    video?.pause();
    if (replayButton) replayButton.hidden = true;
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    app.cinematicActive = false;
    if (app.scene) app.scene.isActionLocked = chapterEndCinematicState.previousActionLocked;
    if (chapterEndCinematicState.resumeGameMusic) app.audio?.playGameTrack();
    chapterEndCinematicState.resumeGameMusic = false;
    completion?.();
  }

  function playChapterEndCinematic(onComplete) {
    const overlay = $("#chapterEndCinematic");
    const video = $("#chapterEndVideo");
    if (!overlay || !video) {
      onComplete?.();
      return;
    }
    if (app.cinematicActive) return;
    chapterEndCinematicState.completion = onComplete;
    chapterEndCinematicState.previousActionLocked = !!app.scene?.isActionLocked;
    chapterEndCinematicState.resumeGameMusic = !!app.audio?.enabled && !app.audio?.gameTrack?.paused;
    app.cinematicActive = true;
    if (app.scene) {
      app.scene.isActionLocked = true;
      app.scene.actor?.body?.setVelocity(0, 0);
      app.scene.cancelPrimaryActionHold?.();
    }
    app.touchMove = { active: false, dx: 0, dy: 0 };
    app.audio?.pauseGameTrack();
    renderChapterClearPanel(false);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    try {
      video.currentTime = 0;
    } catch {
      // Metadata may still be arriving; playback will begin from the start.
    }
    video.play().then(() => {
      const replayButton = $("#chapterEndReplayButton");
      if (replayButton) replayButton.hidden = true;
    }).catch(() => {
      if (video.error) {
        showToast("结章动画加载失败，已进入通关结算");
        finishChapterEndCinematic(true);
        return;
      }
      const replayButton = $("#chapterEndReplayButton");
      if (replayButton) replayButton.hidden = false;
    });
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
      this.finalMapTrackUrl = "assets/audio/efv-p1m4.mp3";
      this.activeGameTrackUrl = this.gameTrackUrl;
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
      return /^ch1_m0[1-5]_/.test(String(mapId || ""));
    }

    selectGameTrack(mapId = app.profile?.mapId) {
      const nextUrl = /^ch1_m04_/.test(String(mapId || "")) ? this.finalMapTrackUrl : this.gameTrackUrl;
      if (nextUrl === this.activeGameTrackUrl) return;
      this.gameTrack.pause();
      this.gameTrack.currentTime = 0;
      this.gameTrack.src = nextUrl;
      this.gameTrack.load();
      this.activeGameTrackUrl = nextUrl;
    }

    async playGameTrack() {
      if (!this.enabled || this.mode !== "game" || !this.shouldPlayChapterTrack()) return;
      this.selectGameTrack();
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
        this.selectGameTrack(mapId);
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
    swordSwing(charged = false) {
      this.noise(charged ? 0.2 : 0.13, charged ? 0.055 : 0.04, "highpass", charged ? 1500 : 1900);
      this.sweep(charged ? 1450 : 1900, charged ? 210 : 420, charged ? 0.2 : 0.13, "sawtooth", charged ? 0.06 : 0.045);
      window.setTimeout(() => this.tone(charged ? 118 : 164, 0.07, "triangle", charged ? 0.04 : 0.025), charged ? 78 : 46);
    }
    swordImpact(charged = false) {
      this.noise(charged ? 0.18 : 0.11, charged ? 0.075 : 0.055, "bandpass", charged ? 980 : 1380);
      this.tone(charged ? 82 : 124, charged ? 0.18 : 0.11, "square", charged ? 0.07 : 0.05);
      window.setTimeout(() => this.tone(charged ? 930 : 1180, 0.055, "triangle", 0.032), 24);
    }
    punchSwing(charged = false, berserk = false) {
      this.noise(charged ? 0.19 : 0.12, berserk ? 0.075 : charged ? 0.058 : 0.042, "lowpass", berserk ? 420 : 560);
      this.sweep(berserk ? 170 : 240, 62, charged ? 0.2 : 0.13, "sawtooth", berserk ? 0.07 : 0.05);
    }
    punchImpact(charged = false) {
      this.noise(charged ? 0.24 : 0.16, charged ? 0.1 : 0.075, "lowpass", charged ? 280 : 390);
      this.tone(charged ? 54 : 72, charged ? 0.25 : 0.17, "square", charged ? 0.095 : 0.072);
      window.setTimeout(() => this.noise(0.1, charged ? 0.05 : 0.035, "bandpass", 820), 30);
    }
    fireExplosion(comboIndex = 0) {
      const pitchLift = Math.min(4, Math.max(0, Number(comboIndex) || 0)) * 18;
      this.noise(0.24, 0.058, "lowpass", 330 + pitchLift);
      this.tone(48 + pitchLift * 0.35, 0.24, "sawtooth", 0.064);
      this.sweep(190 + pitchLift, 62, 0.19, "square", 0.046);
      window.setTimeout(() => this.noise(0.15, 0.04, "bandpass", 980 + pitchLift * 4), 24);
      window.setTimeout(() => this.noise(0.1, 0.026, "highpass", 2100 + pitchLift * 5), 62);
      window.setTimeout(() => this.tone(420 + pitchLift * 2, 0.07, "triangle", 0.028), 76);
    }
    bowRelease(charged = false) {
      this.noise(charged ? 0.16 : 0.1, charged ? 0.044 : 0.032, "highpass", charged ? 1700 : 2200);
      this.sweep(charged ? 880 : 1120, charged ? 1480 : 1760, charged ? 0.16 : 0.105, "triangle", charged ? 0.052 : 0.038);
      window.setTimeout(() => this.tone(charged ? 132 : 176, 0.055, "sine", 0.025), 20);
    }
    arrowImpact(charged = false) {
      this.noise(charged ? 0.15 : 0.09, charged ? 0.06 : 0.042, "bandpass", charged ? 760 : 1040);
      this.tone(charged ? 96 : 142, charged ? 0.13 : 0.085, "triangle", charged ? 0.052 : 0.035);
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
    lightningChainPulse(pulseIndex = 0) {
      const step = Math.max(0, Number(pulseIndex) || 0) % 6;
      const lift = step * 34;
      this.noise(0.16, 0.032, "highpass", 1850 + lift * 5);
      this.sweep(510 + lift, 1480 + lift * 2, 0.14, "sawtooth", 0.038);
      this.tone(118 + lift * 0.42, 0.16, "triangle", 0.035);
      window.setTimeout(() => this.tone(820 + lift * 1.7, 0.065, "sine", 0.03), 42);
      window.setTimeout(() => this.noise(0.09, 0.018, "bandpass", 2600 + lift * 4), 74);
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
      this.progressEvents = new Map();
      this.enemyStates = new Map();
      this.m04Session = { active: false, sessionId: "", leaderId: "", leaderName: "", flags: [], flagSet: new Set(), started: false, phase: "idle", waveIndex: 0, memberIds: [] };
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
      this.progressEvents.clear();
      this.enemyStates.clear();
      this.m04Session = { active: false, sessionId: "", leaderId: "", leaderName: "", flags: [], flagSet: new Set(), started: false, phase: "idle", waveIndex: 0, memberIds: [] };
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
        name: playerDisplayName(app.profile),
        characterId: app.profile.characterId,
        x: actor?.x || 3200,
        y: actor?.y || 3200,
        flipX: !!actor?.flipX,
        action: app.scene?.networkAction || "idle",
        hp: app.profile.hp,
        maxHp: app.profile.maxHp,
        shield: app.profile.shield || 0,
        level: app.profile.level || 1,
        mapId: app.profile.mapId || "",
        flags: Object.keys(profileFlags()).filter(flag => profileFlags()[flag]).slice(0, 240)
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
        name: playerDisplayName(app.profile),
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

    sendHealingChain(healing, shield, radius, jumps) {
      if (this.ws?.readyState !== WebSocket.OPEN) return false;
      this.send({ type: "healingChain", healing, shield, radius, jumps });
      return true;
    }

    sendCombatEvent(event) {
      if (this.ws?.readyState !== WebSocket.OPEN) return false;
      this.send({ type: "combatEvent", event });
      return true;
    }

    sendEnemyState(enemy) {
      if (this.ws?.readyState !== WebSocket.OPEN) return false;
      this.send({ type: "enemyState", enemy });
      return true;
    }

    sendProgressEvent(event) {
      if (this.ws?.readyState !== WebSocket.OPEN) return false;
      this.send({ type: "progressEvent", event });
      return true;
    }

    applyM04Session(session = {}) {
      const previousSessionId = this.m04Session?.sessionId || "";
      const flags = Array.isArray(session.flags) ? session.flags.map(String) : [];
      this.m04Session = {
        active: !!session.active,
        sessionId: String(session.sessionId || ""),
        leaderId: String(session.leaderId || ""),
        leaderName: String(session.leaderName || ""),
        flags,
        flagSet: new Set(flags),
        started: !!session.started,
        phase: String(session.phase || "idle"),
        waveIndex: Math.max(0, Number(session.waveIndex) || 0),
        memberIds: Array.isArray(session.memberIds) ? session.memberIds.map(String) : []
      };
      if (app.profile?.mapId === M04_MAP_ID) {
        app.scene?.refreshQuestUi?.();
        if (this.m04Session.active && this.m04Session.sessionId !== previousSessionId) {
          const leaderText = isM04SessionLeader() ? "你是本轮考核主控" : `${this.m04Session.leaderName || "首位玩家"}是本轮考核主控`;
          showToast(`${leaderText}，M04 进度将在全员离场后重置`);
        }
      }
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
        this.progressEvents.clear();
        this.enemyStates.clear();
        (message.peers || []).forEach(peer => {
          if (peer.id !== app.profile.id) this.peers.set(peer.id, peer);
        });
        if (Array.isArray(message.chat)) renderChatHistory(message.chat);
        if (message.boss) syncBossState(message.boss);
        (Array.isArray(message.slimes) ? message.slimes : []).forEach(enemy => {
          if (enemy?.id) this.enemyStates.set(String(enemy.id), enemy);
        });
        if (Array.isArray(message.slimes)) app.scene?.syncSlimes(message.slimes);
        (Array.isArray(message.drops) ? message.drops : []).forEach(drop => {
          if (drop?.id) this.drops.set(String(drop.id), drop);
        });
        (Array.isArray(message.progress) ? message.progress : []).forEach(event => {
          if (event?.id) this.progressEvents.set(String(event.id), event);
        });
        this.applyM04Session(message.m04Session || {});
        renderPeers(this.peers);
        app.scene?.syncAllPeers(this.peers);
        this.syncDropsForCurrentMap();
        app.scene?.syncProgressEvents(Array.from(this.progressEvents.values()));
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
        this.enemyStates.set(String(message.slime.id), message.slime);
        app.scene?.syncSlimeSpawn(message.slime);
      }
      if (message.type === "slimeRemove" && message.id) {
        this.enemyStates.delete(String(message.id));
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
      if (message.type === "healingChain") app.scene?.applyNetworkHealingChain(message);
      if (message.type === "combatEvent" && message.event) app.scene?.playRemoteCombatEvent(message);
      if (message.type === "enemyState" && message.enemy) {
        this.enemyStates.set(String(message.enemy.id), message.enemy);
        app.scene?.applyNetworkEnemyState(message.enemy);
      }
      if (message.type === "progressEvent" && message.event?.id) {
        this.progressEvents.set(String(message.event.id), message.event);
        app.scene?.applyNetworkProgressEvent(message.event);
      }
      if (message.type === "m04Session" && message.session) this.applyM04Session(message.session);
      if (message.type === "notice" && message.text) showToast(message.text);
    }
  }

  function syncBossState(boss) {
    const wasActive = app.boss.active;
    app.boss = { ...app.boss, ...boss };
    if (app.profile?.mapId === M04_MAP_ID && currentM04Session()?.active) {
      currentM04Session().phase = String(app.boss.phase || "idle");
      currentM04Session().waveIndex = Math.max(0, Number(app.boss.waveIndex) || 0);
      currentM04Session().started = app.boss.phase !== "idle" || !!app.boss.active;
    }
    if (boss?.phase === "awaitingProfessor" && app.scene) {
      app.scene.bossWavePending = true;
      app.scene.professorDeparted = false;
    }
    renderBossHud();
    app.scene?.syncBoss();
  }

  function ensureChapterEndCinematicReady() {
    const video = $("#chapterEndVideo");
    if (!video) return Promise.resolve();
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      setMapLoadingProgress(96, "4K 结章动画已就绪");
      return Promise.resolve();
    }
    video.preload = "auto";
    chapterEndCinematicState.autoPreloadRequested = true;
    return new Promise(resolve => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearInterval(progressTimer);
        window.clearTimeout(timeoutTimer);
        ["canplay", "canplaythrough", "loadeddata", "error"].forEach(eventName => video.removeEventListener(eventName, finish));
        setMapLoadingProgress(96, video.error ? "动画流已建立，将尝试播放" : "4K 结章动画已就绪");
        resolve();
      };
      const update = () => {
        let ratio = 0;
        if (Number.isFinite(video.duration) && video.duration > 0 && video.buffered.length) {
          try {
            ratio = clamp(video.buffered.end(video.buffered.length - 1) / video.duration, 0, 1);
          } catch {
            ratio = 0;
          }
        }
        const readyBonus = Math.max(0, Number(video.readyState) || 0) * 4;
        const percent = clamp(24 + ratio * 62 + readyBonus, 24, 94);
        setMapLoadingProgress(percent, `正在缓冲 4K 结章动画 · ${Math.round(percent)}%`);
        if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) finish();
      };
      const progressTimer = window.setInterval(update, 220);
      const timeoutTimer = window.setTimeout(finish, 20000);
      ["canplay", "canplaythrough", "loadeddata", "error"].forEach(eventName => video.addEventListener(eventName, finish, { once: true }));
      update();
      video.load();
    });
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
      this.ambientEnemyInitialTimer = null;
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
      this.load.spritesheet(LEAF_SLIME_KEY, LEAF_SLIME_SHEET, {
        frameWidth: LEAF_SLIME_FRAME_SIZE,
        frameHeight: LEAF_SLIME_FRAME_SIZE
      });
      this.load.spritesheet(BOSS_REWARD_CHEST_KEY, BOSS_REWARD_CHEST_IMAGE, {
        frameWidth: BOSS_REWARD_CHEST_FRAME_WIDTH,
        frameHeight: BOSS_REWARD_CHEST_FRAME_HEIGHT
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
      CHARACTERS.forEach(character => {
        this.load.spritesheet(character.id, character.sprite, {
          frameWidth: FRAME_SIZE,
          frameHeight: FRAME_SIZE
        });
      });
    }

    create() {
      app.scene = this;
      if (["localhost", "127.0.0.1"].includes(location.hostname)) window.__EFV_TEST_SCENE__ = this;
      this.cameras.main.roundPixels = true;
      this.baseMapData = this.cache.json.get(MAP_DATA_KEY) || {};
      this.chapterMapRegistry = this.cache.json.get(CHAPTER_ONE_MAPS_KEY) || {};
      this.mapData = this.composeRuntimeMapData();
      scheduleChapterEndCinematicPreload(this.mapData?.id || app.profile?.mapId);
      this.remotePlayers = new Map();
      this.appliedProgressEventIds = new Set();
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
      this.berserkUntil = 0;
      this.berserkEndingShown = false;
      this.isHeavyDashing = false;
      this.laodengHeavyToken = 0;
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
      this.prepareLeafSlimeAnimations();
      this.prepareNpcAnimations();
      this.preparePortalAnimations();
      this.prepareBossChestAnimations();
      this.ensureProjectileHitboxTexture();
      this.ensureBossChestTexture();
      this.ensureEnemySeedProjectileTexture();
      this.ensureLightningParticleTextures();
      this.ensureWindParticleTextures();
      this.ensurePhysicalParticleTextures();

      this.projectiles = this.physics.add.group({ allowGravity: false });
      this.enemyProjectiles = this.physics.add.group({ allowGravity: false });
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
      this.projectileObstacleCollider = this.physics.add.collider(this.projectiles, this.obstacleGroup, projectile => {
        if (!projectile?.ignoreObstacles) this.destroyProjectile(projectile, true);
      }, projectile => !projectile?.ignoreObstacles);
      this.projectileSlimeOverlap = this.physics.add.overlap(this.projectiles, this.leafSlimes, (projectile, enemy) => this.handleLeafSlimeProjectileHit(projectile, enemy));
      this.enemyProjectileObstacleCollider = this.physics.add.collider(this.enemyProjectiles, this.obstacleGroup, projectile => projectile.destroy());
      this.enemyProjectileActorOverlap = this.physics.add.overlap(this.actor, this.enemyProjectiles, (actor, projectile) => {
        if (!projectile?.active) return;
        const damage = Math.max(1, Number(projectile.damage) || 12);
        projectile.destroy();
        this.damagePlayer(damage);
      });
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

    scaleRuntimeMapDefinition(mapData) {
      const scale = Math.max(1, Number(mapData?.runtimeScale) || 1);
      if (scale === 1) return mapData;
      const scaled = JSON.parse(JSON.stringify(mapData));
      const scaleFields = (item, fields) => {
        if (!item) return;
        fields.forEach(field => {
          if (Number.isFinite(Number(item[field]))) item[field] = Number((Number(item[field]) * scale).toFixed(2));
        });
      };
      scaleFields(scaled.background, ["width", "height"]);
      (scaled.background?.chunks || []).forEach(item => scaleFields(item, ["x", "y", "width", "height"]));
      scaleFields(scaled.spawn, ["x", "y"]);
      (scaled.spawnPoints || []).forEach(item => scaleFields(item, ["x", "y"]));
      scaleFields(scaled.camera, ["startX", "startY"]);
      (scaled.obstacles || []).forEach(item => scaleFields(item, ["x", "y", "w", "h"]));
      (scaled.npcs || []).forEach(item => scaleFields(item, ["x", "y", "labelOffsetY", "shadowWidth", "shadowHeight"]));
      (scaled.interactionNodes || []).forEach(item => scaleFields(item, ["x", "y", "radius", "hintX", "hintY", "hintWidth", "hintHeight", "labelX", "labelY"]));
      (scaled.exitPoints || []).forEach(item => scaleFields(item, ["x", "y", "radius", "labelX", "labelY"]));
      (scaled.enemySpawns || []).forEach(item => scaleFields(item, ["x", "y", "targetX", "targetY"]));
      (scaled.props || []).forEach(item => scaleFields(item, ["x", "y", "w", "h", "width", "height"]));
      (scaled.foregroundOverlays || []).forEach(item => scaleFields(item, ["x", "y", "w", "h"]));
      scaleFields(scaled.ambientEnemyRefresh?.spawnBounds, ["x", "y", "width", "height"]);
      scaleFields(scaled.chapterBossPoint, ["x", "y"]);
      scaled.runtimeScaleApplied = scale;
      return scaled;
    }

    composeRuntimeMapData(mapId = this.getCurrentMapId()) {
      const maps = this.getChapterMapRegistry();
      if (maps[mapId]) return this.scaleRuntimeMapDefinition(maps[mapId]);
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
          const tint = Number(chunk.tint ?? this.mapData.background.tint);
          if (Number.isFinite(tint) && tint > 0) image.setTint(tint);
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
        const tint = Number(this.mapData.background.tint);
        if (Number.isFinite(tint) && tint > 0) bg.setTint(tint);
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

    createMapTransferArray(node) {
      const scale = Number(node.ringScale || node.portalScale) || 1.02;
      const glow = this.add.ellipse(0, 10, 148 * scale, 52 * scale, 0x2d8cff, 0.2)
        .setStrokeStyle(2, 0xa9e8ff, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
      const ring = this.add.sprite(0, 8, MAP_TRANSFER_RING_KEY)
        .setOrigin(0.5)
        .setScale(scale)
        .setAlpha(0.98)
        .play("ch1-map-transfer-ring-loop");
      const beams = [-42, -16, 18, 44].map((offsetX, index) => this.add.rectangle(
        offsetX * scale,
        8,
        (index % 2 ? 3 : 2) * scale,
        (118 + index * 20) * scale,
        index % 2 ? 0x2d8cff : 0x72d9ff,
        0.42
      ).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD));
      const core = this.add.ellipse(0, 7, 68 * scale, 21 * scale, 0xcaf7ff, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
      const motes = Array.from({ length: 7 }, (_, index) => this.add.circle(
        ((index * 37) % 94 - 47) * scale,
        (-10 - (index * 29) % 112) * scale,
        (1.5 + index % 3) * scale,
        index % 2 ? 0xffffff : 0x72d9ff,
        0.74
      ).setBlendMode(Phaser.BlendModes.ADD));
      const marker = this.add.container(node.x, node.y + 3, [glow, ...beams, ring, core, ...motes])
        .setDepth(node.y + 2);
      this.tweens.add({ targets: glow, scaleX: 1.12, scaleY: 1.18, alpha: 0.34, duration: 780, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: core, scaleX: 1.18, alpha: 0.82, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      beams.forEach((beam, index) => this.tweens.add({
        targets: beam,
        alpha: 0.12,
        scaleY: 0.68 + (index % 2) * 0.18,
        duration: 460 + index * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      }));
      motes.forEach((mote, index) => this.tweens.add({
        targets: mote,
        y: mote.y - (72 + index * 6) * scale,
        alpha: 0,
        duration: 920 + index * 80,
        delay: index * 90,
        repeat: -1,
        ease: "Sine.easeOut"
      }));
      return marker;
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
          alpha: Math.max(0.07, Number(node.markerGlowAlpha) || 0.1),
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
        const doneFlag = this.nodeDoneFlag(entry.node);
        const teammateNeedsHelp = !!entry.node.once && Array.from(this.remotePlayers?.values?.() || []).some(remote => !remote.flags?.has(doneFlag));
        const visible = (!completed || teammateNeedsHelp) && !(entry.node.hideUntilUnlocked && locked && !teammateNeedsHelp);
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
        const marker = node.type === "teleport"
          ? this.createMapTransferArray(node)
          : this.createStaticInteractionHint(node);
        const markerKey = node.markerImage?.key || node.markerTextureKey;
        const isTaskPropLabel = node.type !== "teleport" && !!markerKey;
        const labelX = Number.isFinite(Number(node.labelX)) ? Number(node.labelX) : (Number(node.hintX) || node.x);
        const configuredLabelY = Number.isFinite(Number(node.labelY)) ? Number(node.labelY) : (Number(node.hintY) || node.y) - 24;
        let labelY = configuredLabelY;
        if (isTaskPropLabel && this.textures.exists(markerKey)) {
          const source = this.textures.get(markerKey)?.getSourceImage?.();
          const markerHeight = Math.max(1, Number(source?.height) || Number(node.hintHeight) || 38);
          const markerScale = Math.max(0.01, Number(node.markerScale) || 0.3);
          const markerOriginY = clamp(Number(node.markerOriginY) || 0.86, 0, 1);
          const markerY = Number.isFinite(Number(node.hintY)) ? Number(node.hintY) : node.y;
          const markerTopY = markerY + (Number(node.markerOffsetY) || 0) - markerHeight * markerScale * markerOriginY;
          labelY = Math.min(configuredLabelY, markerTopY - 10);
        }
        const labelStyle = isTaskPropLabel
          ? {
              fontFamily: "Microsoft YaHei, sans-serif",
              fontSize: "13px",
              fontStyle: "700",
              color: "#111111",
              stroke: "#ffffff",
              strokeThickness: 4,
              padding: { x: 2, y: 1 }
            }
          : {
              fontFamily: "Microsoft YaHei, sans-serif",
              fontSize: "12px",
              fontStyle: "700",
              color: "#30263d",
              backgroundColor: "rgba(255,255,255,.78)",
              padding: { x: 6, y: 3 }
            };
        const labelDepth = isTaskPropLabel
          ? Math.max(Number(node.labelDepth) || 0, Number(marker?.depth) || 0, Number(node.y) + 8) + 160
          : Number(node.labelDepth) || labelY + 8;
        const label = node.showLabel === false
          ? null
          : this.add.text(labelX, labelY, node.label || "交互", labelStyle)
            .setOrigin(0.5, 1)
            .setDepth(labelDepth);
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
      if (this.getCurrentMapId() === M04_MAP_ID && node.type === "boss" && !isM04SessionLeader()) {
        renderInteractionPrompt(`等待主控 ${currentM04Session()?.leaderName || "首位玩家"} 与陆教授交互`);
        return;
      }
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
      if (app.connected && node.id) {
        app.multiplayer?.sendProgressEvent({
          kind: "node",
          eventId: node.id,
          flags: [...(node.setFlags || []), ...(node.once ? [this.nodeDoneFlag(node)] : [])],
          mapId: this.getCurrentMapId(),
          x: Number(node.x) || this.actor?.x || 0,
          y: Number(node.y) || this.actor?.y || 0
        });
      }
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
      if (this.getCurrentMapId() === M04_MAP_ID && node.type === "boss") {
        if (!isM04SessionLeader()) {
          showToast(`本轮由${currentM04Session()?.leaderName || "首位进入者"}推进，只有主控可与陆教授对话`);
          return;
        }
        if (app.boss.phase !== "idle" || currentM04Session()?.started) {
          showToast("本轮陆教授考核已经启动，请前往当前阶段继续战斗");
          return;
        }
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
        if (node.cinematicBeforeTransition) {
          this.prepareCinematicMapTransition(node);
          return;
        }
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
        playChapterEndCinematic(() => renderChapterClearPanel(true));
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
      this.bossChestOpened = true;
      this.bossChestExpiresAt = this.time.now + WORLD_DROP_TTL_MS;
      this.bossChest.body.enable = false;
      this.bossChest.play("ch1-boss-chest-open", true);
      claimBossReward();
      renderInteractionPrompt("");
      renderMinimap(this);
      showToast("Boss 宝箱已开启，将与普通掉落物一样在 5 分钟后消失");
    }

    updateBossChest(time) {
      if (!this.bossChest?.visible || !this.bossChestOpened || !this.bossChestExpiresAt) return;
      const remaining = this.bossChestExpiresAt - time;
      if (remaining <= 0) {
        this.tweens.add({
          targets: this.bossChest,
          alpha: 0,
          y: this.bossChest.y - 18,
          duration: 360,
          ease: "Cubic.easeIn",
          onComplete: () => this.bossChest?.setVisible(false).setActive(false)
        });
        this.bossChestExpiresAt = 0;
        return;
      }
      if (remaining <= WORLD_DROP_BLINK_MS) {
        this.bossChest.setAlpha(Math.floor(time / 180) % 2 ? 0.36 : 1);
      }
    }

    getEncounter(id) {
      return (this.mapData.encounters || []).find(item => item.id === id) || null;
    }

    spawnEncounter(encounterId, options = {}) {
      const encounter = this.getEncounter(encounterId);
      if (!encounter) return;
      const clearFlags = encounter.setFlagsOnClear || [];
      if (!options.network && app.connected) {
        app.multiplayer?.sendProgressEvent({
          kind: "encounter",
          eventId: encounterId,
          flags: [],
          mapId: this.getCurrentMapId(),
          x: this.actor?.x || 0,
          y: this.actor?.y || 0
        });
      }
      if (!options.network && clearFlags.some(flag => hasFlag(flag))) {
        showToast("这组错乱笔记已经清理完毕");
        return;
      }
      let spawned = 0;
      (this.mapData.enemySpawns || [])
        .filter(point => point.group === encounterId)
        .forEach(point => {
          if (app.multiplayer?.enemyStates?.get(String(point.id))?.state === "dead") return;
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
      if (groupId === "ch1_m04_final_boss") this.time.delayedCall(520, () => this.prepareBossChest());
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
          let actionFrames = this.makeActionFrames(character.id, action);
          if (character.id === "ayu" && action.id === "walk") {
            actionFrames = AYU_WALK_FRAMES.map(column => ({ key: character.id, frame: action.row * COLS + column }));
          } else if (character.id === "zhixia" && action.id === "walk") {
            actionFrames = ZHIXIA_WALK_FRAMES.map(column => ({ key: character.id, frame: action.row * COLS + column }));
          }
          if (!this.anims.exists(key)) {
            this.anims.create({
              key,
              frames: actionFrames,
              frameRate: Math.max(1, action.fps * ANIMATION_SPEED_FACTOR),
              repeat: action.repeat
            });
          }
          const onceKey = `${character.id}-${action.id}-once`;
          if (!this.anims.exists(onceKey)) {
            this.anims.create({
              key: onceKey,
              frames: actionFrames,
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
      if (!this.anims.exists("jiangxun-barrage-loop")) {
        this.anims.create({
          key: "jiangxun-barrage-loop",
          frames: this.makeActionFrames("jiangxun", { ...attackAction, frames: ALL_FRAMES }),
          frameRate: 30,
          repeat: -1
        });
      }
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
      [LEAF_SLIME_KEY, ...CHAPTER_ONE_ENEMY_SPRITES.map(item => item.key)].forEach(textureKey => {
        if (!this.textures.exists(textureKey)) return;
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
      if (!this.anims.exists(PROFESSOR_NPC_IDLE_ANIMATION)) {
        this.anims.create({
          key: PROFESSOR_NPC_IDLE_ANIMATION,
          frames: this.anims.generateFrameNumbers(PROFESSOR_NPC_KEY, { start: 0, end: 3 }),
          frameRate: 3,
          repeat: -1,
          yoyo: true
        });
      }
      [
        {
          textureKey: M02A_MUMU_NPC_KEY,
          animationKey: M02A_MUMU_IDLE_ANIMATION,
          start: 0,
          end: 7,
          frameRate: 4
        },
        {
          textureKey: M02A_XIAOZHU_PET_KEY,
          animationKey: M02A_XIAOZHU_IDLE_ANIMATION,
          start: 0,
          end: 7,
          frameRate: 3
        }
      ].forEach(config => {
        if (!this.textures.exists(config.textureKey)) return;
        this.textures.get(config.textureKey)?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
        if (this.anims.exists(config.animationKey)) return;
        this.anims.create({
          key: config.animationKey,
          frames: this.anims.generateFrameNumbers(config.textureKey, {
            start: config.start,
            end: config.end
          }),
          frameRate: config.frameRate,
          repeat: -1,
          yoyo: true
        });
      });
      CHAPTER_ONE_ANIMATED_ENEMY_SPRITES.forEach(item => {
        if (!this.textures.exists(item.sheetKey)) return;
        const texture = this.textures.get(item.sheetKey);
        texture?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
        Object.entries(item.actions).forEach(([action, config]) => {
          const key = `${item.key}-${action}`;
          if (this.anims.exists(key)) return;
          this.anims.create({
            key,
            frames: this.anims.generateFrameNumbers(item.sheetKey, { frames: config.frames }),
            frameRate: config.frameRate,
            repeat: config.repeat
          });
        });
      });
    }

    preparePortalAnimations() {
      [
        { textureKey: MAP_PORTAL_KEY, animationKey: "ch1-map-portal-loop", frameRate: 9, end: 7 },
        { textureKey: MAP_TRANSFER_RING_KEY, animationKey: "ch1-map-transfer-ring-loop", frameRate: 7, end: 3 },
        { textureKey: BOSS_VOID_PORTAL_KEY, animationKey: "ch1-boss-void-portal-loop", frameRate: 12, end: 7 }
      ].forEach(({ textureKey, animationKey, frameRate, end }) => {
        if (!this.textures.exists(textureKey)) return;
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

    prepareBossChestAnimations() {
      if (!this.textures.exists(BOSS_REWARD_CHEST_KEY)) return;
      this.textures.get(BOSS_REWARD_CHEST_KEY)?.setFilter?.(Phaser.Textures.FilterMode.LINEAR);
      if (!this.anims.exists("ch1-boss-chest-closed")) {
        this.anims.create({
          key: "ch1-boss-chest-closed",
          frames: this.anims.generateFrameNumbers(BOSS_REWARD_CHEST_KEY, { start: 0, end: 3 }),
          frameRate: 3,
          repeat: -1,
          yoyo: true
        });
      }
      if (!this.anims.exists("ch1-boss-chest-open")) {
        this.anims.create({
          key: "ch1-boss-chest-open",
          frames: this.anims.generateFrameNumbers(BOSS_REWARD_CHEST_KEY, { start: 4, end: 7 }),
          frameRate: 7,
          repeat: 0
        });
      }
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

    ensureEnemySeedProjectileTexture() {
      if (this.textures.exists(ENEMY_SEED_PROJECTILE_KEY)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0x173e34, 0.96);
      g.fillCircle(18, 18, 14);
      g.fillStyle(0x5ed2df, 0.94);
      g.fillCircle(18, 18, 9);
      g.lineStyle(3, 0xf3c75d, 0.94);
      g.strokeCircle(18, 18, 13);
      g.lineStyle(2, 0xd8fff4, 0.86);
      g.lineBetween(18, 3, 18, 33);
      g.lineBetween(3, 18, 33, 18);
      g.generateTexture(ENEMY_SEED_PROJECTILE_KEY, 36, 36);
      g.destroy();
    }

    ensureLightningParticleTextures() {
      if (!this.textures.exists(LIGHTNING_SPARK_TEXTURE_KEY)) {
        const spark = this.make.graphics({ x: 0, y: 0, add: false });
        spark.lineStyle(3, 0x168cff, 1);
        spark.lineBetween(8, 0, 8, 16);
        spark.lineBetween(0, 8, 16, 8);
        spark.lineStyle(2, 0x7548ff, 0.96);
        spark.lineBetween(3, 3, 13, 13);
        spark.lineBetween(13, 3, 3, 13);
        spark.fillStyle(0x45d8ff, 1);
        spark.fillCircle(8, 8, 3);
        spark.generateTexture(LIGHTNING_SPARK_TEXTURE_KEY, 16, 16);
        spark.destroy();
      }
      if (!this.textures.exists(LIGHTNING_MOTE_TEXTURE_KEY)) {
        const mote = this.make.graphics({ x: 0, y: 0, add: false });
        mote.fillStyle(0x315dff, 0.5);
        mote.fillCircle(8, 8, 8);
        mote.fillStyle(0x38c8ff, 0.96);
        mote.fillCircle(8, 8, 3);
        mote.fillStyle(0x9cecff, 0.96);
        mote.fillCircle(8, 8, 1.5);
        mote.generateTexture(LIGHTNING_MOTE_TEXTURE_KEY, 16, 16);
        mote.destroy();
      }
      if (!this.textures.exists(LIGHTNING_RIBBON_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(LIGHTNING_RIBBON_TEXTURE_KEY, 256, 80);
        const context = texture.getContext();
        context.clearRect(0, 0, 256, 80);
        const points = [[2, 42], [34, 32], [61, 48], [92, 25], [126, 44], [158, 29], [192, 51], [224, 34], [254, 40]];
        const stroke = (width, color, blur = 0) => {
          context.save();
          context.strokeStyle = color;
          context.lineWidth = width;
          context.lineCap = "round";
          context.lineJoin = "round";
          context.shadowColor = color;
          context.shadowBlur = blur;
          context.beginPath();
          points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
          context.stroke();
          context.restore();
        };
        stroke(18, "rgba(70,31,111,0.28)", 16);
        stroke(9, "rgba(164,73,210,0.84)", 10);
        stroke(4, "rgba(105,211,225,0.92)", 6);
        stroke(1.5, "rgba(246,238,255,0.98)", 2);
        [[83, 32, 72, 8], [159, 34, 174, 65], [201, 46, 214, 72]].forEach(([x1, y1, x2, y2]) => {
          context.strokeStyle = "rgba(207,146,239,0.82)";
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo((x1 + x2) / 2 + 4, (y1 + y2) / 2 - 3);
          context.lineTo(x2, y2);
          context.stroke();
        });
        texture.refresh();
      }
      if (!this.textures.exists(ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY, 220, 540);
        const context = texture.getContext();
        const traceBolt = () => {
          context.beginPath();
          context.moveTo(112, 3);
          context.lineTo(98, 38);
          context.quadraticCurveTo(96, 66, 79, 82);
          context.lineTo(107, 116);
          context.quadraticCurveTo(78, 145, 70, 174);
          context.lineTo(102, 207);
          context.lineTo(76, 247);
          context.quadraticCurveTo(66, 270, 58, 283);
          context.lineTo(94, 321);
          context.quadraticCurveTo(69, 359, 61, 386);
          context.lineTo(94, 420);
          context.quadraticCurveTo(84, 466, 105, 519);
          context.lineTo(116, 539);
          context.lineTo(131, 516);
          context.quadraticCurveTo(118, 472, 143, 436);
          context.lineTo(117, 401);
          context.lineTo(150, 357);
          context.lineTo(121, 321);
          context.lineTo(158, 275);
          context.lineTo(130, 237);
          context.lineTo(151, 198);
          context.lineTo(119, 164);
          context.quadraticCurveTo(148, 132, 125, 99);
          context.quadraticCurveTo(134, 67, 119, 36);
          context.lineTo(112, 3);
          context.closePath();
        };
        context.clearRect(0, 0, 220, 540);
        context.save();
        context.shadowColor = "rgba(18,67,255,0.92)";
        context.shadowBlur = 30;
        context.fillStyle = "rgba(5,31,177,0.82)";
        traceBolt();
        context.fill();
        context.restore();
        const boltFill = context.createLinearGradient(0, 0, 0, 540);
        boltFill.addColorStop(0, "rgba(18,55,230,0.96)");
        boltFill.addColorStop(0.35, "rgba(20,112,255,0.98)");
        boltFill.addColorStop(0.72, "rgba(28,167,255,0.98)");
        boltFill.addColorStop(1, "rgba(121,236,255,1)");
        context.fillStyle = boltFill;
        traceBolt();
        context.fill();
        const traceCore = () => {
          context.beginPath();
          context.moveTo(112, 5);
          context.lineTo(108, 49);
          context.quadraticCurveTo(91, 79, 112, 113);
          context.quadraticCurveTo(132, 139, 105, 169);
          context.lineTo(115, 204);
          context.quadraticCurveTo(93, 244, 103, 281);
          context.lineTo(113, 320);
          context.quadraticCurveTo(92, 360, 105, 400);
          context.quadraticCurveTo(112, 463, 116, 535);
        };
        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.shadowColor = "rgba(72,211,255,0.94)";
        context.shadowBlur = 15;
        context.strokeStyle = "rgba(74,222,255,0.96)";
        context.lineWidth = 13;
        traceCore();
        context.stroke();
        context.shadowBlur = 5;
        context.strokeStyle = "rgba(246,255,255,0.98)";
        context.lineWidth = 4;
        traceCore();
        context.stroke();
        [[86, 81, 45, 60], [133, 152, 174, 129], [83, 282, 42, 260], [138, 355, 180, 329]].forEach(([x1, y1, x2, y2], index) => {
          context.strokeStyle = index % 2 ? "rgba(184,249,255,0.96)" : "rgba(77,206,255,0.94)";
          context.lineWidth = index % 2 ? 3 : 4;
          context.beginPath();
          context.moveTo(x1, y1);
          context.quadraticCurveTo((x1 + x2) / 2 + (index % 2 ? 7 : -5), (y1 + y2) / 2, x2, y2);
          context.stroke();
        });
        context.restore();
        texture.refresh();
      }
      if (!this.textures.exists(ZHIXIA_ULTIMATE_CROWN_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(ZHIXIA_ULTIMATE_CROWN_TEXTURE_KEY, 320, 140);
        const context = texture.getContext();
        const traceCrown = () => {
          context.beginPath();
          context.moveTo(14, 86);
          context.quadraticCurveTo(34, 44, 70, 62);
          context.quadraticCurveTo(73, 29, 108, 59);
          context.quadraticCurveTo(135, 35, 158, 61);
          context.quadraticCurveTo(181, 31, 207, 60);
          context.quadraticCurveTo(247, 36, 304, 84);
          context.quadraticCurveTo(273, 101, 224, 102);
          context.quadraticCurveTo(184, 122, 157, 109);
          context.quadraticCurveTo(116, 121, 78, 104);
          context.quadraticCurveTo(39, 105, 14, 86);
          context.closePath();
        };
        context.clearRect(0, 0, 320, 140);
        context.save();
        context.shadowColor = "rgba(18,93,255,0.92)";
        context.shadowBlur = 26;
        context.fillStyle = "rgba(10,77,226,0.78)";
        traceCrown();
        context.fill();
        context.restore();
        const fill = context.createLinearGradient(0, 38, 0, 116);
        fill.addColorStop(0, "rgba(201,250,255,0.98)");
        fill.addColorStop(0.42, "rgba(65,198,255,0.98)");
        fill.addColorStop(1, "rgba(17,85,238,0.88)");
        context.fillStyle = fill;
        traceCrown();
        context.fill();
        context.strokeStyle = "rgba(217,252,255,0.98)";
        context.lineWidth = 3;
        traceCrown();
        context.stroke();
        context.fillStyle = "rgba(251,255,255,0.98)";
        context.beginPath();
        context.moveTo(17, 85);
        context.quadraticCurveTo(38, 48, 71, 63);
        context.quadraticCurveTo(76, 31, 104, 60);
        context.quadraticCurveTo(82, 83, 50, 91);
        context.quadraticCurveTo(31, 95, 17, 85);
        context.fill();
        context.beginPath();
        context.moveTo(303, 83);
        context.quadraticCurveTo(280, 44, 246, 61);
        context.quadraticCurveTo(240, 31, 210, 60);
        context.quadraticCurveTo(234, 83, 268, 91);
        context.quadraticCurveTo(290, 94, 303, 83);
        context.fill();
        context.fillStyle = "rgba(239,255,255,0.98)";
        context.beginPath();
        context.moveTo(84, 92);
        context.quadraticCurveTo(121, 68, 144, 79);
        context.lineTo(158, 52);
        context.lineTo(173, 79);
        context.quadraticCurveTo(203, 67, 235, 93);
        context.quadraticCurveTo(190, 108, 157, 101);
        context.quadraticCurveTo(120, 109, 84, 92);
        context.fill();
        texture.refresh();
      }
    }

    ensureWindParticleTextures() {
      if (!this.textures.exists(WIND_MOTE_TEXTURE_KEY)) {
        const mote = this.make.graphics({ x: 0, y: 0, add: false });
        mote.fillStyle(0x5be1cf, 0.22);
        mote.fillEllipse(12, 12, 24, 10);
        mote.fillStyle(0xb8fff2, 0.9);
        mote.fillEllipse(14, 12, 13, 4);
        mote.lineStyle(2, 0x4bc9d4, 0.9);
        mote.lineBetween(2, 12, 22, 12);
        mote.generateTexture(WIND_MOTE_TEXTURE_KEY, 24, 24);
        mote.destroy();
      }
      if (!this.textures.exists(WIND_LEAF_TEXTURE_KEY)) {
        const leaf = this.make.graphics({ x: 0, y: 0, add: false });
        leaf.fillStyle(0x48c99e, 0.96);
        leaf.fillTriangle(2, 8, 17, 3, 12, 13);
        leaf.lineStyle(2, 0xc6ffe7, 0.86);
        leaf.lineBetween(3, 8, 16, 5);
        leaf.generateTexture(WIND_LEAF_TEXTURE_KEY, 20, 16);
        leaf.destroy();
      }
      if (!this.textures.exists(WIND_RIBBON_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(WIND_RIBBON_TEXTURE_KEY, 256, 128);
        const context = texture.getContext();
        context.clearRect(0, 0, 256, 128);
        const fill = context.createLinearGradient(0, 0, 256, 0);
        fill.addColorStop(0, "rgba(124,190,196,0)");
        fill.addColorStop(0.18, "rgba(151,220,220,0.48)");
        fill.addColorStop(0.58, "rgba(202,241,237,0.92)");
        fill.addColorStop(0.86, "rgba(238,252,248,0.72)");
        fill.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = fill;
        context.shadowColor = "rgba(133,225,220,0.65)";
        context.shadowBlur = 14;
        context.beginPath();
        context.moveTo(5, 91);
        context.bezierCurveTo(66, 111, 139, 8, 251, 30);
        context.bezierCurveTo(156, 28, 82, 119, 5, 91);
        context.closePath();
        context.fill();
        context.shadowBlur = 5;
        context.strokeStyle = "rgba(247,255,252,0.82)";
        context.lineWidth = 2.4;
        context.beginPath();
        context.moveTo(16, 89);
        context.bezierCurveTo(84, 99, 150, 18, 240, 31);
        context.stroke();
        texture.refresh();
      }
    }

    ensurePhysicalParticleTextures() {
      if (!this.textures.exists(LAODENG_SMOKE_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(LAODENG_SMOKE_TEXTURE_KEY, 48, 48);
        const context = texture.getContext();
        context.clearRect(0, 0, 48, 48);
        const gradient = context.createRadialGradient(24, 24, 3, 24, 24, 23);
        gradient.addColorStop(0, "rgba(151,79,48,0.64)");
        gradient.addColorStop(0.42, "rgba(92,54,45,0.42)");
        gradient.addColorStop(1, "rgba(45,34,35,0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 48, 48);
        texture.refresh();
      }
      if (!this.textures.exists(LAODENG_BERSERK_PETAL_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(LAODENG_BERSERK_PETAL_TEXTURE_KEY, 280, 190);
        const context = texture.getContext();
        context.clearRect(0, 0, 280, 190);
        [
          [112, 91, 34], [150, 76, 40], [188, 93, 35], [132, 116, 38], [174, 119, 42], [92, 112, 30]
        ].forEach(([x, y, radius], index) => {
          const smoke = context.createRadialGradient(x, y, 3, x, y, radius);
          smoke.addColorStop(0, index % 2 ? "rgba(104,57,43,0.55)" : "rgba(132,68,42,0.48)");
          smoke.addColorStop(0.55, "rgba(74,47,43,0.3)");
          smoke.addColorStop(1, "rgba(42,34,37,0)");
          context.fillStyle = smoke;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        });
        for (let index = 0; index < 5; index += 1) {
          const angle = -Math.PI / 2 + index / 5 * Math.PI * 2;
          context.save();
          context.translate(140, 103);
          context.scale(1, 0.63);
          context.rotate(angle);
          const flame = context.createLinearGradient(20, 0, 118, 0);
          flame.addColorStop(0, "rgba(164,28,18,0.44)");
          flame.addColorStop(0.34, "rgba(235,57,21,0.86)");
          flame.addColorStop(0.72, "rgba(255,128,27,0.98)");
          flame.addColorStop(1, "rgba(255,235,104,0.98)");
          context.fillStyle = flame;
          context.shadowColor = "rgba(255,72,17,0.88)";
          context.shadowBlur = 15;
          context.beginPath();
          context.moveTo(22, -13);
          context.bezierCurveTo(56, -30, 94, -30, 122, -2);
          context.bezierCurveTo(92, -7, 57, 10, 25, 17);
          context.bezierCurveTo(14, 8, 14, -4, 22, -13);
          context.closePath();
          context.fill();
          context.shadowBlur = 5;
          context.strokeStyle = "rgba(255,245,146,0.96)";
          context.lineWidth = 3;
          context.beginPath();
          context.moveTo(30, -8);
          context.bezierCurveTo(61, -20, 94, -20, 117, -2);
          context.stroke();
          context.restore();
        }
        texture.refresh();
      }
      if (!this.textures.exists(PHYSICAL_SPARK_TEXTURE_KEY)) {
        const spark = this.make.graphics({ x: 0, y: 0, add: false });
        spark.fillStyle(0xfff2bd, 0.98);
        spark.fillTriangle(10, 0, 13, 8, 10, 20);
        spark.fillTriangle(10, 0, 7, 8, 10, 20);
        spark.fillStyle(0xf1b95a, 0.88);
        spark.fillTriangle(0, 10, 8, 7, 20, 10);
        spark.fillTriangle(0, 10, 8, 13, 20, 10);
        spark.generateTexture(PHYSICAL_SPARK_TEXTURE_KEY, 20, 20);
        spark.destroy();
      }
      if (!this.textures.exists(SWORD_WAVE_TEXTURE_KEY)) {
        const texture = this.textures.createCanvas(SWORD_WAVE_TEXTURE_KEY, 320, 180);
        const context = texture.getContext();
        context.clearRect(0, 0, 320, 180);
        const fill = context.createLinearGradient(14, 0, 310, 0);
        fill.addColorStop(0, "rgba(255,255,255,0.99)");
        fill.addColorStop(0.18, "rgba(250,254,255,0.98)");
        fill.addColorStop(0.52, "rgba(225,244,255,0.88)");
        fill.addColorStop(0.82, "rgba(166,215,242,0.34)");
        fill.addColorStop(1, "rgba(105,178,220,0)");
        context.fillStyle = fill;
        context.shadowColor = "rgba(104,188,230,0.46)";
        context.shadowBlur = 12;
        context.beginPath();
        context.moveTo(308, 111);
        context.bezierCurveTo(214, 151, 86, 158, 27, 111);
        context.bezierCurveTo(4, 92, 11, 53, 46, 29);
        context.bezierCurveTo(86, 2, 153, 8, 229, 27);
        context.bezierCurveTo(158, 22, 99, 28, 61, 49);
        context.bezierCurveTo(37, 63, 28, 82, 41, 96);
        context.bezierCurveTo(82, 132, 193, 133, 308, 111);
        context.closePath();
        context.fill();
        context.shadowBlur = 8;
        context.strokeStyle = "rgba(255,255,255,0.99)";
        context.lineWidth = 2.4;
        context.beginPath();
        context.moveTo(28, 108);
        context.bezierCurveTo(92, 153, 218, 139, 302, 113);
        context.stroke();
        context.strokeStyle = "rgba(235,249,255,0.9)";
        context.lineWidth = 1.7;
        context.beginPath();
        context.moveTo(43, 98);
        context.bezierCurveTo(101, 127, 190, 127, 277, 114);
        context.stroke();
        context.strokeStyle = "rgba(202,233,248,0.66)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(51, 54);
        context.bezierCurveTo(93, 24, 154, 19, 218, 29);
        context.stroke();
        texture.refresh();
      }
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
          quality: slime.rank === "boss" ? "epic" : slime.rank === "rare" ? "rare" : "excellent",
          source: slime.rank === "boss" ? "garden_boss" : slime.rank === "rare" ? "rare_elite" : "elite"
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
      const berserk = app.profile?.characterId === "laodeng" && this.time?.now < this.berserkUntil;
      this.setActorVisualScale(berserk ? LAODENG_BERSERK_SCALE : ACTOR_DEFAULT_VISUAL_SCALE);
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
      this.ambientEnemyInitialTimer?.remove(false);
      this.ambientEnemyInitialTimer = null;
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
      this.enemyProjectiles?.clear(true, true);
      this.leafSlimes?.children?.each(slime => {
        this.clearStructuralBossPhaseVisuals?.(slime);
        slime.shadow?.destroy();
        slime.hpBg?.destroy();
        slime.hpFrame?.destroy();
        slime.hpFill?.destroy();
        slime.nameLabel?.destroy();
        slime.destroy();
      });
      this.syncedSlimeIds?.clear();
      this.bossSummonIds?.clear();
      (this.bossPortals || []).forEach(item => item?.portal?.destroy());
      this.bossPortals = [];
      this.bossChest?.setVisible(false).setActive(false);
      this.bossChestOpened = false;
      this.bossChestExpiresAt = 0;
      this.bossSprite?.setVisible(false).setActive(false);
      syncBossState({ ...BOSS });
    }

    showAreaTitle(mapData = this.mapData) {
      const title = String(mapData?.title || "未知区域").trim() || "未知区域";
      this.areaTitleTimer?.remove(false);
      this.areaTitleTimer = null;
      if (this.areaTitleContainer) {
        this.tweens.killTweensOf(this.areaTitleContainer);
        this.areaTitleContainer.destroy(true);
        this.areaTitleContainer = null;
      }

      const camera = this.cameras.main;
      const targetY = Math.round(Math.max(104, Math.min(camera.height * 0.19, 168)));
      const titleText = this.add.text(0, 0, title, {
        fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
        fontSize: "50px",
        fontStyle: "bold",
        color: "#fff4cc",
        stroke: "#291a40",
        strokeThickness: 7,
        align: "center",
        shadow: { offsetX: 0, offsetY: 4, color: "#0c0715", blur: 8, stroke: true, fill: true }
      }).setOrigin(0.5);

      const container = this.add.container(Math.round(camera.width / 2), targetY - 16, [titleText])
        .setScrollFactor(0)
        .setDepth(100500)
        .setAlpha(0)
        .setScale(0.92);
      this.areaTitleContainer = container;
      this.tweens.add({
        targets: container,
        alpha: 1,
        y: targetY,
        scaleX: 1,
        scaleY: 1,
        duration: 280,
        ease: "Cubic.easeOut",
        onComplete: () => {
          if (this.areaTitleContainer !== container) return;
          this.areaTitleTimer = this.time.delayedCall(1220, () => {
            this.tweens.add({
              targets: container,
              alpha: 0,
              y: targetY - 12,
              scaleX: 1.035,
              scaleY: 1.035,
              duration: 420,
              ease: "Cubic.easeIn",
              onComplete: () => {
                if (this.areaTitleContainer === container) this.areaTitleContainer = null;
                container.destroy(true);
              }
            });
          });
        }
      });
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
            this.prepareLeafSlimeAnimations();
            this.prepareNpcAnimations();
            this.preparePortalAnimations();
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
          app.scene?.syncProgressEvents(Array.from(app.multiplayer?.progressEvents?.values?.() || []));
          saveProfile(app.profile);
          renderChapterHud();
          renderMinimap(this);
          this.mapTransitioning = false;
          this.isActionLocked = false;
          hideMapLoading();
          this.time.delayedCall(260, () => this.showAreaTitle(this.mapData));
          showToast(`进入${this.mapData.title || "新区域"}`);
          scheduleChapterEndCinematicPreload(targetMapId);
        });
      }).catch(error => {
        console.error("Map asset loading failed", error);
        this.mapTransitioning = false;
        this.isActionLocked = false;
        hideMapLoading();
        showToast("地图资源加载失败，请检查网络后重试");
      });
    }

    prepareCinematicMapTransition(node) {
      const targetMapId = node.targetMapId || this.getCurrentMapId();
      const maps = this.getChapterMapRegistry();
      if (!maps[targetMapId] || this.mapTransitioning || app.cinematicActive) return;
      this.mapTransitioning = true;
      this.isActionLocked = true;
      this.actor?.body?.setVelocity(0, 0);
      showMapLoading("正在准备 4K 结章动画与樱花同济大道");
      setMapLoadingProgress(12, "正在预载樱花同济大道 · 12%");
      Promise.all([
        this.ensureMapAssetsLoaded(targetMapId),
        ensureChapterEndCinematicReady()
      ]).then(() => {
        setMapLoadingProgress(100, "动画与新地图已就绪");
        hideMapLoading();
        this.mapTransitioning = false;
        window.setTimeout(() => {
          playChapterEndCinematic(() => this.transitionToMap({ ...node, cinematicBeforeTransition: false }));
        }, 230);
      }).catch(error => {
        console.error("Cinematic transition preload failed", error);
        this.mapTransitioning = false;
        this.isActionLocked = false;
        hideMapLoading();
        showToast("结章动画或樱花大道资源加载失败，请稍后重试传送阵");
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
      this.bossChest = this.physics.add.sprite(0, 0, BOSS_REWARD_CHEST_KEY, 0)
        .setOrigin(0.5, 0.82)
        .setScale(0.74)
        .setVisible(false)
        .setActive(false)
        .setDepth(0);
      this.bossChest.body.setAllowGravity(false);
      this.bossChest.body.setImmovable(true);
      this.bossChestOpened = false;
      this.bossChestExpiresAt = 0;
      this.ensureBossPortalTextures();
    }

    syncBoss() {
      if (!this.bossSprite) return;
      const visiblePhases = new Set(["summoning", "between", "awaitingProfessor", "portalOpening", "portalClosing"]);
      if (this.professorDeparted || (!app.boss.active && !visiblePhases.has(app.boss.phase))) {
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
      const firstWave = BOSS_SUMMON_WAVES[0];
      const structuralExam = this.getCurrentMapId() === M04_MAP_ID;
      if (structuralExam && !isM04SessionLeader()) {
        showToast("只有本轮首位进入 M04 的玩家可启动陆教授考核");
        return null;
      }
      if (structuralExam && (app.boss.phase !== "idle" || currentM04Session()?.started)) {
        showToast("本轮考核已经启动，不能从第一个交互点重复召唤");
        return null;
      }
      const runtimeScale = structuralExam ? this.getM04RuntimeScale() : 1;
      const x = structuralExam ? firstWave.mapX * runtimeScale : (Number.isFinite(options.x) ? options.x : clamp(this.actor.x + 420, 420, this.worldWidth - 420));
      const y = structuralExam ? firstWave.mapY * runtimeScale : (Number.isFinite(options.y) ? options.y : clamp(this.actor.y - 70, 640, this.worldHeight - 420));
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
      if (structuralExam && currentM04Session()) currentM04Session().started = true;
      setFlag(BOSS_CHEST_FLAG, false);
      this.bossWavePending = false;
      this.professorDeparted = false;
      (this.mapNpcs || []).filter(entry => entry.item?.id === "ch1_m04_npc_professor").forEach(entry => {
        entry.sprite?.setVisible(false);
        entry.shadow?.setVisible(false);
        entry.label?.setVisible(false);
      });
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

    getM04RuntimeScale() {
      return this.getCurrentMapId() === M04_MAP_ID
        ? Math.max(1, Number(this.mapData?.runtimeScaleApplied || this.mapData?.runtimeScale) || 1)
        : 1;
    }

    getBossWaveUnitTarget(unit) {
      const scale = this.getM04RuntimeScale();
      return {
        x: clamp(app.boss.x + Number(unit.dx || 0) * scale, 96, this.worldWidth - 96),
        y: clamp(app.boss.y + Number(unit.dy || 0) * scale, 120, this.worldHeight - 96)
      };
    }

    createBossPortals(wave) {
      (this.bossPortals || []).forEach(item => item?.portal?.destroy());
      const scale = this.getM04RuntimeScale();
      this.bossPortals = (wave.units || []).map((unit, unitIndex) => {
        const target = this.getBossWaveUnitTarget(unit);
        const targetScale = unit.rank === "rare" ? 1.28 : unit.rank === "elite" ? 0.98 : 0.64;
        const x = target.x;
        const y = clamp(target.y + (unit.rank === "mob" ? 58 : 82) * scale, 150, this.worldHeight - 100);
        const portal = this.add.sprite(x, y, BOSS_VOID_PORTAL_KEY)
          .setOrigin(0.5)
          .setScale(0.16)
          .setAlpha(0)
          .setDepth(y + 34)
          .play("ch1-boss-void-portal-loop");
        this.tweens.add({
          targets: portal,
          alpha: 0.96,
          scale: targetScale,
          duration: BOSS_PORTAL_OPEN_MS + unitIndex * 24,
          ease: "Back.easeOut"
        });
        return { portal, x, y, target, targetScale, rank: unit.rank };
      });
      return this.bossPortals;
    }

    closeBossPortals() {
      const portals = this.bossPortals || [];
      this.bossPortals = [];
      portals.forEach((item, index) => this.tweens.add({
        targets: item.portal,
        alpha: 0,
        scale: 0.12,
        duration: BOSS_PORTAL_CLOSE_MS + index * 18,
        ease: "Sine.easeIn",
        onComplete: () => item.portal.destroy()
      }));
    }

    beginBossWaveSequence(index) {
      const wave = BOSS_SUMMON_WAVES[index];
      if (!wave || !app.boss.active) return;
      this.bossWavePending = true;
      this.professorDeparted = false;
      const runtimeScale = this.getM04RuntimeScale();
      const nextX = this.getCurrentMapId() === M04_MAP_ID ? Number(wave.mapX || app.boss.x) * runtimeScale : app.boss.x;
      const nextY = this.getCurrentMapId() === M04_MAP_ID ? Number(wave.mapY || app.boss.y) * runtimeScale : app.boss.y;
      const portalState = { ...app.boss, x: nextX, y: nextY, phase: "portalOpening", waveIndex: index, waveTitle: wave.title };
      syncBossState(portalState);
      if (app.connected) app.multiplayer?.sendBossStart(portalState);
      this.bossSprite?.setAlpha(1).setVisible(true).setActive(true);
      this.bossSprite?.setTexture(BOSS_KEY).setScale(BOSS_VISUAL_SCALE).setAngle(0);
      this.playBossCastAnimation();
      const portals = this.createBossPortals(wave);
      showToast(`陆教授同时展开 ${portals.length} 座${wave.title}传送门：大门对应精英，小门对应小怪`);
      this.time.delayedCall(BOSS_PORTAL_OPEN_MS, () => {
        if (!app.boss.active) return;
        this.spawnBossWave(index, { fromPortal: true, portals });
        this.time.delayedCall(BOSS_PORTAL_EGRESS_MS + Math.max(0, wave.units.length - 1) * BOSS_PORTAL_STAGGER_MS + 80, () => {
          this.closeBossPortals();
          syncBossState({ ...app.boss, phase: "summoning" });
          this.bossWavePending = false;
          this.playProfessorFlyAway();
          this.updateBossSummonState();
        });
      });
    }

    spawnBossWave(index, options = {}) {
      const wave = BOSS_SUMMON_WAVES[index];
      if (!wave || !app.boss.active) return;
      if (!options.fromPortal) this.bossWavePending = false;
      this.bossSummonIds.clear();
      const waveState = {
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
      };
      syncBossState(waveState);
      if (app.connected) app.multiplayer?.sendBossStart(waveState);
      wave.units.forEach((unit, unitIndex) => {
        const target = this.getBossWaveUnitTarget(unit);
        const unitPortal = options.portals?.[unitIndex];
        const targetX = target.x;
        const targetY = target.y;
        const spawnX = options.fromPortal ? unitPortal?.x || targetX : targetX;
        const spawnY = options.fromPortal ? unitPortal?.y || targetY : targetY;
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
          baseHealthMultiplier: this.getCurrentMapId() === M04_MAP_ID ? 2 : 1,
          damage: unit.damage,
          creditDefense: unit.creditDefense,
          rewardExp: unit.rewardExp,
          rewardCredits: unit.rewardCredits,
          dropId: unit.dropId,
          dropName: unit.dropName,
          broadcast: app.connected
        });
        if (slime) this.bossSummonIds.add(slime.slimeId);
      });
      showToast(`第 ${index + 1} 波：${wave.title}召唤物出现`);
      this.updateBossSummonState();
    }

    playProfessorFlyAway() {
      if (!this.bossSprite?.visible) return;
      const sprite = this.bossSprite;
      sprite.setTexture(PROFESSOR_FLY_KEY).setScale(PROFESSOR_FLY_VISUAL_SCALE).setOrigin(0.5, 0.78);
      this.spawnHealingMotes(sprite.x, sprite.y - 90, 28, 82, 520);
      this.tweens.killTweensOf(sprite);
      this.tweens.add({
        targets: sprite,
        y: sprite.y - 180,
        x: sprite.x + 70,
        alpha: 0,
        angle: 8,
        duration: 620,
        ease: "Cubic.easeIn",
        onComplete: () => {
          this.professorDeparted = true;
          sprite.setVisible(false).setActive(false).setTexture(BOSS_KEY).setOrigin(0.5, 0.72).setScale(BOSS_VISUAL_SCALE).setAngle(0).setAlpha(1);
        }
      });
    }

    spawnM04FinalBoss() {
      const existingFinalBoss = this.findLeafSlime("ch1-m04-structural-final-boss");
      if (existingFinalBoss || hasFlag("ch1_final_boss_defeated")) return existingFinalBoss;
      const scale = this.getM04RuntimeScale();
      const x = 3135 * scale;
      const y = 650 * scale;
      this.professorDeparted = true;
      const finalDifficulty = this.getEnemyDifficultyScale("boss");
      const finalBossMaxHp = Math.round(1800 * 3 * finalDifficulty.health);
      const finalState = { ...app.boss, active: true, x, y, phase: "final", waveTitle: "结构失稳聚合体", maxHp: finalBossMaxHp, hp: finalBossMaxHp, summonsRemaining: 1 };
      syncBossState(finalState);
      if (app.connected) app.multiplayer?.sendBossStart(finalState);
      const finalBoss = this.spawnLeafSlime({
        id: "ch1-m04-structural-final-boss",
        x,
        y,
        group: "ch1_m04_final_boss",
        textureKey: M04_STRUCTURAL_BOSS_KEY,
        staticImage: false,
        rank: "boss",
        label: "结构失稳聚合体",
        scale: 1.35,
        maxHp: 1800,
        baseHealthMultiplier: 3,
        damage: 24,
        creditDefense: 10,
        rewardExp: 160,
        rewardCredits: 12,
        dropId: "ch1_drop_structural_core",
        dropName: "结构稳定核心",
        smoothMovement: true,
        wanderSpeed: 24,
        chaseSpeed: 42,
        aggroRange: 820,
        bodyWidth: 126,
        bodyHeight: 82,
        hudOffsetY: -330,
        broadcast: app.connected
      });
      if (!finalBoss) {
        showToast("终极大机器人加载失败，正在重新构建");
        this.time.delayedCall(260, () => this.spawnM04FinalBoss());
        return null;
      }
      this.bossSprite?.setVisible(false).setActive(false);
      app.audio.ultimateBurst();
      this.cameras.main.flash(420, 76, 196, 255, false);
      this.cameras.main.shake(360, 0.006);
      this.spawnHealingMotes(x, y - 80, 58, 132, 820);
      this.showFloatingText(x, y - 238, "终极大机器人 · 结构失稳聚合体", {
        color: "#bff7ff",
        size: "25px",
        rise: 72,
        duration: 1300
      });
      showToast("三阶段考核完成：终极大机器人已在陆教授所在位置完成加载");
      renderMinimap(this);
      return finalBoss;
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
      if (this.getCurrentMapId() === M04_MAP_ID && !this.isEncounterCoordinator()) return;
      const nextIndex = Number(app.boss.waveIndex || 0) + 1;
      if (this.getCurrentMapId() === "ch1_m04_library_lawn_boss") {
        this.waitForProfessorApproach(nextIndex);
        return;
      }
      else this.prepareBossChest();
    }

    waitForProfessorApproach(nextIndex) {
      const isFinal = nextIndex >= BOSS_SUMMON_WAVES.length;
      const nextWave = isFinal
        ? { title: "结构失稳终局", mapX: 3135, mapY: 650 }
        : BOSS_SUMMON_WAVES[nextIndex];
      const runtimeScale = this.getM04RuntimeScale();
      this.bossWavePending = true;
      this.professorDeparted = false;
      if (this.bossSprite) this.tweens.killTweensOf(this.bossSprite);
      this.bossSprite
        ?.setTexture(BOSS_KEY)
        .setOrigin(0.5, 0.72)
        .setScale(BOSS_VISUAL_SCALE)
        .setAngle(0)
        .setAlpha(1)
        .setVisible(true)
        .setActive(true);
      const waitingState = {
        ...app.boss,
        active: true,
        phase: "awaitingProfessor",
        x: Number.isFinite(Number(nextWave.mapX)) ? Number(nextWave.mapX) * runtimeScale : app.boss.x,
        y: Number.isFinite(Number(nextWave.mapY)) ? Number(nextWave.mapY) * runtimeScale : app.boss.y,
        waveIndex: nextIndex,
        waveTitle: nextWave.title,
        maxHp: 1,
        hp: 0,
        summonsRemaining: 0,
        eliteRemaining: 0
      };
      syncBossState(waitingState);
      if (app.connected) app.multiplayer?.sendBossStart(waitingState);
      showToast(isFinal
        ? `${BOSS_SUMMON_WAVES[Math.max(0, nextIndex - 1)].title}已清除，前往地图右上方陆教授身边启动终极大机器人`
        : `${BOSS_SUMMON_WAVES[Math.max(0, nextIndex - 1)].title}已清除，前往陆教授身边确认下一阶段`);
    }

    isEncounterCoordinator() {
      if (!app.connected) return true;
      if (this.getCurrentMapId() === M04_MAP_ID) return isM04SessionLeader();
      const ids = [String(app.profile?.id || ""), ...Array.from(this.remotePlayers?.keys?.() || []).map(String)]
        .filter(Boolean)
        .sort();
      return !ids.length || ids[0] === String(app.profile?.id || "");
    }

    updateProfessorWaveProximity() {
      if (app.boss.phase !== "awaitingProfessor" || !this.bossWavePending || !this.bossSprite?.visible) return;
      const professor = { x: Number(app.boss.x) || 0, y: Number(app.boss.y) || 0 };
      const approached = !!this.actor?.active
        && Phaser.Math.Distance.Between(this.actor.x, this.actor.y, professor.x, professor.y) <= 190 * this.getM04RuntimeScale();
      if (!approached || !this.isEncounterCoordinator()) return;
      const nextIndex = Number(app.boss.waveIndex || 0);
      this.bossWavePending = false;
      if (nextIndex < BOSS_SUMMON_WAVES.length) {
        this.beginBossWaveSequence(nextIndex);
        return;
      }
      this.bossWavePending = true;
      this.playProfessorFlyAway();
      this.time.delayedCall(520, () => {
        this.bossWavePending = false;
        this.spawnM04FinalBoss();
      });
    }

    prepareBossChest() {
      if (!app.boss.active || app.boss.phase === "chest") return;
      const chestX = clamp(app.boss.x + 18, 120, this.worldWidth - 120);
      const chestY = clamp(app.boss.y + 160, 120, this.worldHeight - 120);
      this.bossSprite?.setVisible(false).setActive(false);
      this.bossChest
        ?.setPosition(chestX, chestY)
        .setTexture(BOSS_REWARD_CHEST_KEY, 0)
        .setScale(0.74)
        .setAlpha(1)
        .setVisible(true)
        .setActive(true)
        .setDepth(chestY + 16);
      if (this.bossChest?.body) this.bossChest.body.enable = true;
      this.bossChestOpened = false;
      this.bossChestExpiresAt = 0;
      this.bossChest?.play("ch1-boss-chest-closed", true);
      syncBossState({ ...app.boss, active: false, hp: 0, phase: "chest", chestReady: true });
      showToast("召唤物已清除，Boss 宝箱出现了");
      renderMinimap(this);
    }

    findLeafSlime(id) {
      if (!id || !this.leafSlimes) return null;
      return (this.leafSlimes.getChildren?.() || []).find(slime => slime?.active && slime.slimeId === id) || null;
    }

    getMapLeafSlimeSpawns() {
      if (this.mapData?.disableDefaultEnemies) return [];
      const spawns = this.mapData?.enemySpawns || this.mapData?.slimeSpawns;
      if (Array.isArray(spawns) && spawns.length) {
        return spawns.filter(point => {
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
          if (app.multiplayer?.enemyStates?.get(String(point.id))?.state === "dead") return false;
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

    spawnAmbientEnemyWave(requestedCount = null) {
      const config = this.getAmbientEnemyRefreshConfig();
      if (!config || this.mapTransitioning || !this.actor?.active) return 0;
      if (app.connected && !this.isEncounterCoordinator()) return 0;
      const alive = (this.leafSlimes?.getChildren?.() || []).filter(enemy =>
        enemy?.active && enemy.ambientWander && enemy.state !== "dead" && enemy.state !== "vanish"
      ).length;
      const available = Math.max(0, (Number(config.maxAlive) || 10) - alive);
      if (!available) return 0;
      const minimum = Math.max(1, Number(config.minCount) || 1);
      const maximum = Math.max(minimum, Number(config.maxCount) || 3);
      const configuredCount = Number.isFinite(Number(requestedCount))
        ? Math.max(0, Math.floor(Number(requestedCount)))
        : Phaser.Math.Between(minimum, maximum);
      const count = Math.min(available, configuredCount);
      let spawned = 0;
      for (let index = 0; index < count; index += 1) {
        const point = this.getRandomAmbientEnemyPoint(config);
        if (!point) continue;
        const enemy = Phaser.Utils.Array.GetRandom(config.enemies);
        this.ambientEnemySequence += 1;
        if (this.spawnLeafSlime({
          ...enemy,
          ...point,
          id: `ambient-${this.getCurrentMapId()}-${Date.now().toString(36)}-${this.ambientEnemySequence}`,
          ambientWander: true,
          passiveWander: true,
          smoothMovement: true,
          broadcast: app.connected
        })) spawned += 1;
      }
      return spawned;
    }

    scheduleAmbientEnemyRefresh() {
      this.ambientEnemyRefreshTimer?.remove(false);
      this.ambientEnemyRefreshTimer = null;
      this.ambientEnemyInitialTimer?.remove(false);
      this.ambientEnemyInitialTimer = null;
      const config = this.getAmbientEnemyRefreshConfig();
      if (!config) return;
      const initialCount = Math.max(0, Math.floor(Number(config.initialCount) || 0));
      if (initialCount) {
        const initialDelay = app.offlineMode ? 1 : Math.max(500, Number(config.initialDelayMs) || 1200);
        this.ambientEnemyInitialTimer = this.time.delayedCall(initialDelay, () => {
          this.ambientEnemyInitialTimer = null;
          this.spawnAmbientEnemyWave(initialCount);
        });
      }
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
      if (!slime?.active) return;
      if (slime.staticImage) {
        this.playStaticEnemyAnimation(slime, action, restart);
        return;
      }
      let resolvedAction = action;
      if (slime.textureKey === M04_STRUCTURAL_BOSS_KEY && Number(slime.bossForm || 1) >= 2) {
        if (action === "move") resolvedAction = "phaseMove";
        if (action === "attack") resolvedAction = "phaseAttack";
        if (action === "special") resolvedAction = "phaseSpecial";
      }
      const key = `${slime.textureKey || LEAF_SLIME_KEY}-${resolvedAction}`;
      if (this.anims.exists(key)) slime.play(key, restart);
    }

    playStaticEnemyAnimation(slime, action, restart = false) {
      if (!restart && slime.staticAction === action) return;
      slime.staticAction = action;
      const scale = Number(slime.baseVisualScale || slime.scaleX || 1);
      if (action === "move") {
        slime.setAngle(0).setScale(scale);
        slime.staticMoveTween?.resume?.();
        return;
      }
      slime.staticMoveTween?.pause?.();
      if (action === "attack") {
        this.tweens.add({
          targets: slime,
          scaleX: scale * 1.12,
          scaleY: scale * 0.9,
          angle: slime.flipX ? -5 : 5,
          duration: 115,
          yoyo: true,
          ease: "Cubic.easeOut",
          onComplete: () => slime.active && slime.setAngle(0).setScale(scale)
        });
      } else if (action === "hit") {
        this.tweens.add({
          targets: slime,
          x: slime.x + (slime.flipX ? 10 : -10),
          angle: slime.flipX ? 8 : -8,
          scaleX: scale * 0.92,
          scaleY: scale * 1.08,
          duration: 75,
          yoyo: true,
          repeat: 1,
          onComplete: () => slime.active && slime.setAngle(0).setScale(scale)
        });
      } else if (action === "dead") {
        this.tweens.add({
          targets: slime,
          angle: slime.flipX ? 82 : -82,
          scaleX: scale * 1.05,
          scaleY: scale * 0.55,
          y: slime.y + 20,
          duration: 210,
          ease: "Cubic.easeIn"
        });
      }
    }

    getEnemyRankStyle(slime) {
      if (slime.rank === "boss") return { frame: 0xe45b66, fill: 0xef7fb0, text: "#ffd9e3", width: 108, height: 11 };
      if (slime.rank === "rare") return { frame: 0xf3c75d, fill: 0xffcf5d, text: "#ffe9a8", width: 78, height: 9 };
      if (slime.rank === "elite") return { frame: 0x8f72d6, fill: 0xb889ff, text: "#dbcfff", width: 66, height: 8 };
      return { frame: 0x3f5368, fill: 0x42c98a, text: "#ffffff", width: 56, height: 6 };
    }

    createEnemyHud(slime) {
      const style = this.getEnemyRankStyle(slime);
      const y = slime.y + slime.hudOffsetY;
      slime.hpFrame = this.add.rectangle(slime.x, y, style.width + 6, style.height + 6, 0x241b2e, 0.72)
        .setStrokeStyle(["rare", "boss"].includes(slime.rank) ? 2 : 1, style.frame, 0.95)
        .setDepth(slime.y + 36);
      slime.hpBg = this.add.rectangle(slime.x, y, style.width, style.height, 0x1d1826, 0.72)
        .setDepth(slime.y + 37);
      slime.hpFill = this.add.rectangle(slime.x - style.width / 2, y, style.width, Math.max(3, style.height - 2), style.fill, 0.95)
        .setOrigin(0, 0.5)
        .setDepth(slime.y + 38);
      if (slime.rank !== "mob" || slime.displayLabel) {
        slime.nameLabel = this.add.text(slime.x, y - 12, slime.displayLabel || (slime.rank === "boss" ? "花园 Boss" : slime.rank === "rare" ? "稀有精英" : "精英"), {
          fontFamily: "Microsoft YaHei, sans-serif",
          fontSize: slime.rank === "boss" ? "13px" : slime.rank === "rare" ? "12px" : "11px",
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

    getAnimatedEnemyDefinition(textureKey) {
      return CHAPTER_ONE_ANIMATED_ENEMY_SPRITES.find(item => item.key === textureKey) || null;
    }

    getEncounterPartySize() {
      if (!app.connected) return 1;
      if (this.getCurrentMapId() === M04_MAP_ID && currentM04Session()?.active) {
        const ids = new Set((currentM04Session().memberIds || []).map(String).filter(Boolean));
        if (app.profile?.id) ids.add(String(app.profile.id));
        return clamp(ids.size || 1, 1, 5);
      }
      const activeRemoteCount = Array.from(this.remotePlayers?.values?.() || [])
        .filter(remote => remote?.sprite?.active && !remote.down).length;
      return clamp(1 + activeRemoteCount, 1, 6);
    }

    getEnemyDifficultyScale(rank, networkSynced = false) {
      if (networkSynced) return { partySize: 1, health: 1, damage: 1, hazards: 0 };
      const partySize = this.getEncounterPartySize();
      const extra = partySize - 1;
      if (this.getCurrentMapId() === M04_MAP_ID) {
        return {
          partySize,
          health: 1 + extra * 0.75,
          damage: 1 + extra * 0.10,
          hazards: Math.min(3, extra)
        };
      }
      const healthStep = rank === "boss" ? 0.75 : ["rare", "elite"].includes(rank) ? 0.6 : 0.35;
      return {
        partySize,
        health: 1 + extra * healthStep,
        damage: 1 + extra * 0.16,
        hazards: Math.min(3, extra)
      };
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
      const elite = !!options.elite || rank === "elite" || rank === "rare" || rank === "boss";
      const visualScale = Number(options.scale) || (elite ? 1.18 : 0.9);
      const textureKey = options.textureKey || LEAF_SLIME_KEY;
      const animatedDefinition = this.getAnimatedEnemyDefinition(textureKey);
      const renderTextureKey = animatedDefinition?.sheetKey || textureKey;
      const difficulty = this.getEnemyDifficultyScale(rank, !!options.networkSynced);
      const slime = this.leafSlimes.create(x, y, renderTextureKey, options.staticImage ? undefined : 0)
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
      slime.enemyArchetype = options.enemyArchetype || animatedDefinition?.archetype || "";
      slime.networkReplica = !!options.networkSynced;
      slime.partySizeAtSpawn = difficulty.partySize;
      slime.hazardBonus = difficulty.hazards;
      slime.bossForm = Math.max(1, Number(options.bossForm) || 1);
      slime.bossPhase = String(options.bossPhase || (textureKey === M04_STRUCTURAL_BOSS_KEY ? "phase1" : ""));
      slime.bossCharger = !!options.bossCharger;
      slime.transforming = false;
      slime.baseVisualScale = visualScale;
      slime.stationary = !!options.stationary;
      slime.rangedAttack = !!options.rangedAttack;
      slime.rangedRange = Math.max(180, Number(options.rangedRange) || 760);
      slime.rangedCooldown = Math.max(650, Number(options.rangedCooldown) || 1850);
      slime.projectileSpeed = Math.max(120, Number(options.projectileSpeed) || 330);
      slime.projectileColor = Number(options.projectileColor) || 0x78f0d2;
      slime.lastRangedAttackAt = -slime.rangedCooldown;
      slime.homeX = x;
      slime.homeY = y;
      slime.patrolBounds = options.patrolBounds || null;
      slime.smoothMovement = options.smoothMovement === true
        || textureKey === MAGIC_BROOM_KEY
        || textureKey === BITING_MAGIC_BOOK_KEY;
      slime.ambientWander = !!options.ambientWander;
      slime.passiveWander = !!options.passiveWander;
      slime.provokedUntil = 0;
      slime.hideHudUntilProvoked = slime.passiveWander;
      slime.wanderSpeed = Math.max(18, Number(options.wanderSpeed) || (textureKey === BITING_MAGIC_BOOK_KEY ? 30 : 34));
      slime.chaseSpeed = Math.max(slime.wanderSpeed, Number(options.chaseSpeed) || (textureKey === BITING_MAGIC_BOOK_KEY ? 44 : 48));
      slime.aggroRange = Math.max(LEAF_SLIME_DETECT_RANGE, Number(options.aggroRange) || LEAF_SLIME_DETECT_RANGE);
      slime.wanderTargetX = x;
      slime.wanderTargetY = y;
      slime.wanderUntil = 0;
      const configuredMaxHp = Math.max(1, Number(options.maxHp) || Number(options.hp) || (rank === "boss" ? 1200 : rank === "rare" ? 260 : rank === "elite" ? 150 : 72));
      const mobHealthMultiplier = rank === "mob" ? 2 : 1;
      const baseHealthMultiplier = Math.max(0.1, Number(options.baseHealthMultiplier) || 1);
      slime.maxHp = Math.round(configuredMaxHp * mobHealthMultiplier * baseHealthMultiplier * difficulty.health);
      const incomingHp = Number(options.hp);
      const currentHp = Number.isFinite(incomingHp)
        ? incomingHp * (options.maxHp ? 1 : mobHealthMultiplier * baseHealthMultiplier) * (options.networkSynced ? 1 : difficulty.health)
        : slime.maxHp;
      slime.hp = clamp(currentHp, 0, slime.maxHp);
      slime.damage = Math.max(1, Math.round((Number(options.damage) || (rank === "rare" ? 16 : rank === "elite" ? 12 : 8)) * difficulty.damage));
      slime.creditDefense = Math.max(0, Number(options.creditDefense || 0));
      slime.hudOffsetY = Number.isFinite(options.hudOffsetY)
        ? Number(options.hudOffsetY)
        : options.staticImage
          ? -Math.max(104, slime.displayHeight * 0.62)
          : animatedDefinition
            ? -Math.max(104, slime.displayHeight * 0.58)
            : -104;
      if (options.staticImage) {
        const bodyWidth = Number(options.bodyWidth) || Math.max(38, Math.min(124, slime.width * 0.26));
        const bodyHeight = Number(options.bodyHeight) || Math.max(28, Math.min(82, slime.height * 0.15));
        const bodyOffsetX = Number.isFinite(options.bodyOffsetX) ? options.bodyOffsetX : (slime.width - bodyWidth) / 2;
        const bodyOffsetY = Number.isFinite(options.bodyOffsetY) ? options.bodyOffsetY : slime.height * 0.72 - bodyHeight / 2;
        slime.body.setSize(bodyWidth, bodyHeight);
        slime.body.setOffset(bodyOffsetX, bodyOffsetY);
      } else if (animatedDefinition) {
        const bodyWidth = Number(options.bodyWidth) || Math.max(44, animatedDefinition.frameWidth * 0.42);
        const bodyHeight = Number(options.bodyHeight) || Math.max(30, animatedDefinition.frameHeight * 0.24);
        const bodyOffsetX = Number.isFinite(options.bodyOffsetX) ? options.bodyOffsetX : (animatedDefinition.frameWidth - bodyWidth) / 2;
        const bodyOffsetY = Number.isFinite(options.bodyOffsetY) ? options.bodyOffsetY : animatedDefinition.frameHeight * 0.72 - bodyHeight / 2;
        slime.body.setSize(bodyWidth, bodyHeight);
        slime.body.setOffset(bodyOffsetX, bodyOffsetY);
      } else {
        slime.body.setSize(54, 34);
        slime.body.setOffset(37, 70);
      }
      slime.body.setAllowGravity(false);
      slime.body.setCollideWorldBounds(true);
      slime.body.setImmovable(slime.stationary);
      // Contact is resolved by our symmetric overlap guard below. Keep the
      // flag disabled as a second line of defence against accidental Arcade
      // separation if another collider is introduced later.
      slime.body.pushable = false;
      slime.state = "move";
      slime.nextHopAt = 0;
      slime.lastAttackAt = -LEAF_SLIME_ATTACK_COOLDOWN;
      slime.actionToken = 0;
      this.playEnemyAnimation(slime, "move", true);
      if (slime.staticImage && !slime.stationary) {
        slime.staticMoveTween = this.tweens.add({
          targets: slime,
          angle: rank === "mob" ? 2.5 : 1.5,
          duration: 880 + Math.random() * 240,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1
        });
      } else if (slime.staticImage && slime.stationary) {
        slime.staticMoveTween = this.tweens.add({
          targets: slime,
          scaleX: visualScale * 1.025,
          scaleY: visualScale * 0.985,
          duration: 1150,
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
        app.multiplayer.sendSlimeSpawn({
          id: slimeId,
          mapId: this.getCurrentMapId(),
          x,
          y,
          hp: slime.hp,
          maxHp: slime.maxHp,
          damage: slime.damage,
          textureKey,
          rank,
          label: slime.displayLabel,
          staticImage: slime.staticImage,
          stationary: slime.stationary,
          scale: visualScale,
          enemyArchetype: slime.enemyArchetype,
          bossForm: slime.bossForm,
          bossPhase: slime.bossPhase,
          bossCharger: slime.bossCharger,
          hazardBonus: slime.hazardBonus,
          groupId: slime.groupId,
          bossSummon: slime.isBossSummon,
          bossWaveId: slime.bossWaveId,
          bossWaveTitle: slime.bossWaveTitle,
          ambientWander: !!slime.ambientWander,
          passiveWander: !!slime.passiveWander,
          smoothMovement: !!slime.smoothMovement,
          wanderSpeed: Number(slime.wanderSpeed) || 0,
          chaseSpeed: Number(slime.chaseSpeed) || 0
        });
      }
      return slime;
    }

    syncSlimeSpawn(slime) {
      if (!slime?.id) return;
      if (slime.mapId && slime.mapId !== this.getCurrentMapId()) return;
      if (slime.state === "dead") {
        this.syncSlimeRemove(slime.id);
        return;
      }
      const syncedEnemy = this.spawnLeafSlime({
        id: String(slime.id),
        x: Number(slime.x),
        y: Number(slime.y),
        ownerId: String(slime.ownerId || ""),
        hp: Number(slime.hp),
        maxHp: Number(slime.maxHp),
        damage: Number(slime.damage) || undefined,
        textureKey: slime.textureKey || LEAF_SLIME_KEY,
        rank: slime.rank || "mob",
        label: slime.label || "",
        staticImage: !!slime.staticImage,
        stationary: !!slime.stationary,
        scale: Number(slime.scale) || undefined,
        enemyArchetype: slime.enemyArchetype || "",
        bossForm: Number(slime.bossForm) || 1,
        bossPhase: slime.bossPhase || "",
        bossCharger: !!slime.bossCharger,
        hazardBonus: Number(slime.hazardBonus) || 0,
        group: slime.groupId || "",
        bossSummon: !!slime.bossSummon,
        bossWaveId: slime.bossWaveId || "",
        bossWaveTitle: slime.bossWaveTitle || "",
        ambientWander: !!slime.ambientWander,
        passiveWander: !!slime.passiveWander,
        smoothMovement: !!slime.smoothMovement,
        wanderSpeed: Number(slime.wanderSpeed) || undefined,
        chaseSpeed: Number(slime.chaseSpeed) || undefined,
        networkSynced: true,
        broadcast: false
      });
      if (syncedEnemy?.isBossSummon && app.boss.phase === "summoning") this.bossWavePending = false;
    }

    enemyNetworkSnapshot(slime, state = slime?.state || "move", effect = {}) {
      if (!slime?.slimeId) return null;
      return {
        id: slime.slimeId,
        mapId: this.getCurrentMapId(),
        x: slime.x,
        y: slime.y,
        hp: Math.max(0, Number(slime.hp || 0)),
        maxHp: Math.max(1, Number(slime.maxHp || 1)),
        damage: Math.max(1, Number(slime.damage || 1)),
        state,
        textureKey: slime.textureKey || LEAF_SLIME_KEY,
        rank: slime.rank || "mob",
        label: slime.displayLabel || "",
        staticImage: !!slime.staticImage,
        stationary: !!slime.stationary,
        scale: Number(slime.baseVisualScale || slime.scaleX || 0.9),
        enemyArchetype: slime.enemyArchetype || "",
        bossForm: Math.max(1, Number(slime.bossForm) || 1),
        bossPhase: slime.bossPhase || "",
        bossCharger: !!slime.bossCharger,
        hazardBonus: Math.max(0, Number(slime.hazardBonus) || 0),
        groupId: slime.groupId || "",
        bossSummon: !!slime.isBossSummon,
        bossWaveId: slime.bossWaveId || "",
        bossWaveTitle: slime.bossWaveTitle || "",
        damageAmount: Math.max(0, Number(effect.damageAmount || 0)),
        critical: !!effect.critical,
        hitKind: effect.hitKind === "physical" ? "physical" : "magic",
        energyGained: Math.max(0, Number(effect.energyGained || 0))
      };
    }

    broadcastEnemyState(slime, state, effect = {}) {
      if (!app.connected) return;
      const snapshot = this.enemyNetworkSnapshot(slime, state, effect);
      if (snapshot) app.multiplayer?.sendEnemyState(snapshot);
    }

    applyNetworkEnemyState(enemy) {
      if (!enemy?.id || enemy.mapId !== this.getCurrentMapId()) return;
      let slime = this.findLeafSlime(String(enemy.id));
      if (!slime && enemy.state !== "dead") {
        this.syncSlimeSpawn(enemy);
        slime = this.findLeafSlime(String(enemy.id));
      }
      if (!slime) return;
      const previousHp = Math.max(0, Number(slime.hp || 0));
      const previousBossPhase = String(slime.bossPhase || "");
      slime.setPosition(Number(enemy.x) || slime.x, Number(enemy.y) || slime.y);
      slime.maxHp = Math.max(1, Number(enemy.maxHp || slime.maxHp || 1));
      slime.hp = clamp(Number(enemy.hp ?? slime.hp), 0, slime.maxHp);
      slime.damage = Math.max(1, Number(enemy.damage ?? slime.damage) || 1);
      slime.groupId = enemy.groupId || slime.groupId || "";
      slime.isBossSummon = !!(enemy.bossSummon ?? slime.isBossSummon);
      slime.enemyArchetype = enemy.enemyArchetype || slime.enemyArchetype || "";
      slime.bossPhase = String(enemy.bossPhase || slime.bossPhase || "");
      slime.bossCharger = !!(enemy.bossCharger ?? slime.bossCharger);
      slime.hazardBonus = Math.max(0, Number(enemy.hazardBonus ?? slime.hazardBonus) || 0);
      if (enemy.state !== "transform") slime.bossForm = Math.max(1, Number(enemy.bossForm ?? slime.bossForm) || 1);
      this.refreshEnemyHpBar(slime);
      const damageAmount = Math.max(0, Number(enemy.damageAmount || previousHp - slime.hp));
      if (damageAmount > 0) {
        const critical = !!enemy.critical;
        this.showFloatingText(
          slime.x,
          slime.y + slime.hudOffsetY - 18,
          `${critical ? "暴击 " : ""}-${Math.round(damageAmount)}`,
          {
            color: critical ? "#ffd86b" : "#fff7e6",
            size: critical ? "34px" : "26px",
            scale: critical ? 1.25 : 1,
            startScale: critical ? 1.72 : 1.42,
            strokeThickness: critical ? 8 : 7,
            hold: critical ? 240 : 180,
            duration: critical ? 1250 : 1080,
            rise: critical ? 92 : 72
          }
        );
        this.playEnemyHitImpact(slime, critical, enemy.sourceCharacterId);
      }
      const energyGained = Math.max(0, Number(enemy.energyGained || 0));
      if (energyGained > 0) {
        this.showFloatingText(slime.x, slime.y - 92, `+${Math.ceil(energyGained)} EN`, {
          color: "#9ff7ff",
          size: "14px",
          rise: 34,
          duration: 540
        });
      }
      if (enemy.state === "transform") {
        this.triggerStructuralBossTransform(slime, { network: true });
        return;
      }
      if (enemy.state === "charging") {
        if (previousBossPhase !== "charging" || !slime.energyShield?.active) {
          slime.bossPhase = previousBossPhase;
          this.beginStructuralBossChargingPhase(slime, { network: true });
        }
        return;
      }
      if (enemy.state === "phase3") {
        if (previousBossPhase !== "phase3" || !slime.body?.enable) {
          slime.bossPhase = previousBossPhase;
          this.enterStructuralBossPhaseThree(slime, { network: true });
        }
        return;
      }
      if (enemy.state === "attack") {
        slime.state = "attack";
        slime.body?.setVelocity(0, 0);
        this.playEnemyAnimation(slime, this.getAnimatedEnemySkillAction(String(enemy.skillId || "")), true);
        return;
      }
      if (enemy.state === "dead" || slime.hp <= 0) {
        slime.state = "dead";
        slime.body.setVelocity(0, 0);
        slime.body.enable = false;
        this.playEnemyAnimation(slime, "dead", true);
        if (this.isEncounterCoordinator()) {
          this.time.delayedCall(40, () => {
            if (slime.groupId === BOSS_SUMMON_GROUP) this.updateBossSummonState();
            else this.checkEncounterClear(slime.groupId);
          });
        }
        this.time.delayedCall(360, () => this.syncSlimeRemove(slime.slimeId));
        return;
      }
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "hit";
      slime.body.setVelocity(0, 0);
      slime.setTint(0xffe1a8);
      this.playEnemyAnimation(slime, "hit", true);
      this.time.delayedCall(190, () => {
        if (!slime.active || slime.actionToken !== token) return;
        slime.state = "move";
        slime.clearTint();
        if (slime.baseTint && slime.baseTint !== 0xffffff) slime.setTint(slime.baseTint);
        this.playEnemyAnimation(slime, "move", true);
      });
    }

    syncSlimes(slimes) {
      slimes.forEach(slime => this.syncSlimeSpawn(slime));
    }

    syncProgressEvents(events = []) {
      events.forEach(event => this.applyNetworkProgressEvent(event));
    }

    applyNetworkProgressEvent(event) {
      if (!event?.id || !app.profile) return;
      (event.flags || []).forEach(flag => setFlag(flag, true, { broadcast: false }));
      saveProfile(app.profile);
      this.refreshQuestUi?.();
      if (event.mapId !== this.getCurrentMapId() || this.appliedProgressEventIds?.has(event.id)) return;
      this.appliedProgressEventIds?.add(event.id);
      if (event.kind === "encounter") this.spawnEncounter(event.eventId, { network: true });
      if (event.kind === "node") {
        const node = (this.interactionNodes || []).find(item => item.id === event.eventId);
        if (node) this.setInteractionMarkerCompleted(node);
      }
      const sourceName = event.sourceName || "队友";
      showToast(`${sourceName}同步了区域进度，可共同协助完成目标`);
    }

    broadcastCombatEvent(action, payload = {}) {
      if (!app.connected || !action) return false;
      return !!app.multiplayer?.sendCombatEvent({
        action,
        mapId: this.getCurrentMapId(),
        ...payload
      });
    }

    playRemoteCombatEvent(message) {
      const event = message?.event;
      if (!event || event.sourceId === app.profile?.id || event.mapId !== this.getCurrentMapId()) return;
      const remote = this.remotePlayers.get(event.sourceId);
      if (event.action === "playerStatus") {
        const target = remote?.sprite?.active ? remote.sprite : { x: Number(event.x) || 0, y: Number(event.y) || 0 };
        if (remote) remote.explicitStatusUntil = this.time.now + PLAYER_STATUS_SUPPRESS_MS;
        const shieldSpent = Math.max(0, Number(event.shieldSpent) || 0);
        const damageAmount = Math.max(0, Number(event.damageAmount) || 0);
        const healAmount = Math.max(0, Number(event.healAmount) || 0);
        const shieldGain = Math.max(0, Number(event.shieldGain) || 0);
        if (shieldSpent > 0) {
          this.playShieldEffect(target.x, target.y, true);
          this.showFloatingText(target.x, target.y - 116, `格挡 ${Math.ceil(shieldSpent)}`, { color: "#bff7ff", size: "17px", rise: 48 });
        }
        if (damageAmount > 0) {
          this.showFloatingText(target.x, target.y - 124, `-${Math.ceil(damageAmount)}`, { color: "#ff9ab4", size: "20px", rise: 58 });
          this.emitPhysicalSparks(target.x, target.y - 48, 12, 0xff9ab4, target.y + 220);
          if (remote?.sprite?.active) {
            remote.hitFlashToken += 1;
            const token = remote.hitFlashToken;
            remote.sprite.setTint(0xffe6a0);
            this.time.delayedCall(180, () => {
              if (remote.hitFlashToken === token && !remote.down) remote.sprite.clearTint();
            });
          }
          app.audio.playerHit();
        }
        if (healAmount > 0) this.playFriendlyHealEffect(target.x, target.y, Math.ceil(healAmount));
        if (shieldGain > 0) {
          this.playShieldEffect(target.x, target.y, false);
          this.showFloatingText(target.x, target.y - 96, `护盾 +${Math.ceil(shieldGain)}`, { color: "#bff7ff", size: "15px", rise: 42 });
        }
        return;
      }
      if (event.action === "levelUp") {
        this.playLevelUpEffect(
          Math.max(1, Number(event.levels) || 1),
          remote?.sprite?.active ? remote.sprite : { x: Number(event.x) || 0, y: Number(event.y) || 0 },
          Math.max(1, Number(event.level) || remote?.level || 1)
        );
        return;
      }
      if (event.action === "enemySkill") {
        const slime = this.findLeafSlime(String(event.enemyId || ""));
        if (!slime?.active) return;
        const points = (Array.isArray(event.points) ? event.points : [])
          .map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
        slime.state = "attack";
        slime.body?.setVelocity(0, 0);
        this.playEnemyAnimation(slime, "attack", true);
        const duration = this.playAnimatedEnemySkillPlan(
          slime,
          String(event.skillId || "probabilityCut"),
          points,
          Math.max(24, Number(event.radius) || 72),
          { damage: true }
        );
        this.time.delayedCall(duration, () => {
          if (!slime.active || ["dead", "vanish", "transform"].includes(slime.state)) return;
          slime.state = "move";
          this.playEnemyAnimation(slime, "move", true);
        });
        return;
      }
      if (event.action === "structuralChargeAoe") {
        const slime = this.findLeafSlime(String(event.enemyId || ""));
        if (slime?.active) this.triggerStructuralFullMapAoe(slime, { damage: Math.max(1, Number(event.damage) || 1) });
        return;
      }
      if (event.action === "structuralBossDash") {
        const slime = this.findLeafSlime(String(event.enemyId || ""));
        const points = (Array.isArray(event.points) ? event.points : [])
          .slice(0, 5)
          .map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 }));
        if (slime?.active && points.length) this.startStructuralBossDash(slime, points);
        return;
      }
      if (remote?.sprite?.active && !remote.down) {
        const key = `${event.characterId || remote.characterId}-attack-once`;
        if (this.anims.exists(key)) remote.sprite.play(key, true);
      }
      if (event.action === "projectile") {
        this.playRemoteProjectileEvent(event);
        return;
      }
      if (event.action === "linaGale") {
        this.playLinaGaleVisual(event.x, event.y);
        app.audio.ultimateWind();
        return;
      }
      if (event.action === "melee") {
        const angle = Math.atan2(event.aimY || 0, event.aimX || 1);
        if (event.characterId === "laodeng") {
          this.playImpactPunchVisual(event.x, event.y, angle, !!event.charged, !!event.berserk);
          app.audio.punchSwing(!!event.charged, !!event.berserk);
        } else {
          this.flashSlash(event.x, event.y, angle, event.y + 70, !!event.charged);
          app.audio.swordSwing(!!event.charged);
        }
        return;
      }
      if (event.action === "laodengFireExplosion") {
        this.playLaodengBerserkExplosionVisual(Number(event.x) || 0, Number(event.y) || 0, 2);
        app.audio.fireExplosion(2);
        return;
      }
      if (event.action === "laodengShockwave") {
        this.launchLaodengSixWayShockwaves(Number(event.x) || 0, Number(event.y) || 0, false, false);
        return;
      }
      if (event.action === "physicalImpactBurst") {
        this.renderPhysicalImpactBurst(
          Number(event.x) || 0,
          Number(event.y) || 0,
          Math.max(32, Number(event.radius) || 72),
          Number(event.color) || 0xf0bb62
        );
        app.audio.fireExplosion(Math.max(0, Number(event.comboIndex) || 0));
        return;
      }
      if (event.action === "berserk") {
        if (remote?.sprite?.active) {
          remote.sprite.setScale(PEER_DEFAULT_VISUAL_SCALE * LAODENG_BERSERK_SCALE);
          this.playBerserkActivationVisual(remote.sprite);
          this.time.delayedCall(LAODENG_BERSERK_DURATION, () => {
            if (remote?.sprite?.active && !remote.down) remote.sprite.setScale(PEER_DEFAULT_VISUAL_SCALE);
          });
        }
        app.audio.ultimateBurst();
        return;
      }
      if (event.action === "chainLightning") {
        if (event.secondary) app.audio.lightningChainPulse(Number(event.pulse) || 0);
        else app.audio.ultimateBurst();
        const points = Array.isArray(event.points) ? event.points : [];
        points.slice(1).forEach((target, index) => {
          const source = points[index];
          this.time.delayedCall(index * 90, () => {
            this.drawLightningArc(source.x, source.y, target.x, target.y, { intensity: 1.06 - index * 0.12, style: "chain" });
            this.renderChainLightningHit(target.x, target.y, 48 - index * 4);
          });
        });
        return;
      }
      if (event.action === "zhixiaUltimate") {
        app.audio.ultimateWind();
        const aim = normalizeVector(Number(event.aimX) || 0, Number(event.aimY) || 1);
        for (let index = 1; index <= 10; index += 1) {
          this.time.delayedCall(index * 105, () => this.playLightningStrikeVisual(
            event.x + aim.x * MAP_TILE_SIZE * index,
            event.y + aim.y * MAP_TILE_SIZE * index,
            Number(event.radius) || 92
          ));
        }
      }
    }

    playRemoteProjectileEvent(event) {
      const startX = Number(event.x) || 0;
      const startY = Number(event.y) || 0;
      const targetX = Number(event.targetX) || startX;
      const targetY = Number(event.targetY) || startY;
      const rotation = Math.atan2(targetY - startY, targetX - startX);
      const depth = startY + 42;
      let visual;
      if (event.visualType === "windBolt") visual = this.createWindBoltVisual(startX, startY, rotation, depth);
      else if (event.visualType === "lightningOrb") visual = this.createLightningOrbVisual(startX, startY, rotation, depth);
      else if (["arrow", "arrowHeavy", "arrowBarrage"].includes(event.visualType)) {
        const variant = event.visualType === "arrowHeavy" ? "heavy" : event.visualType === "arrowBarrage" ? "barrage" : "normal";
        visual = this.createArrowVisual(startX, startY, rotation, depth, !!event.charged, variant);
      }
      else if (event.visualType === "swordWave") visual = this.createSwordWaveVisual(startX, startY, rotation, depth);
      else visual = this.add.circle(startX, startY, event.charged ? 12 : 8, event.color || 0xffffff, 0.88).setDepth(depth);
      if (event.visualType === "windBolt") this.playWindCastBurst(startX, startY, rotation, depth + 1);
      else this.flashCast(startX, startY, event.color || 0xffffff, depth + 1);
      if (event.characterId === "jiangxun") app.audio.bowRelease(!!event.charged);
      else if (event.visualType === "swordWave") app.audio.swordSwing(true);
      else app.audio.projectileFly(!!event.charged);
      const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
      const duration = clamp(distance / Math.max(80, Number(event.speed) || 700) * 1000, 120, 1200);
      this.tweens.add({
        targets: visual,
        x: targetX,
        y: targetY,
        duration,
        ease: "Linear",
        onUpdate: () => visual.setDepth(visual.y + 42),
        onComplete: () => {
          visual.destroy();
          if (event.visualType === "windBolt") this.renderWindBoltImpact(targetX, targetY);
          else if (event.visualType === "lightningOrb") this.renderLightningOrbImpact(targetX, targetY);
          else this.flashCast(targetX, targetY, event.color || 0xffffff, targetY + 44);
        }
      });
    }

    syncSlimeRemove(id) {
      const slime = this.findLeafSlime(String(id || ""));
      if (!slime) return;
      this.syncedSlimeIds.delete(slime.slimeId);
      this.clearStructuralBossPhaseVisuals(slime);
      slime.shadow?.destroy();
      slime.hpBg?.destroy();
      slime.hpFrame?.destroy();
      slime.hpFill?.destroy();
      slime.nameLabel?.destroy();
      slime.destroy();
    }

    bindActorLeafSlimeCollision() {
      this.actorLeafSlimeCollider?.destroy?.();
      // Players and enemies intentionally have no mutual physics contact.
      // Combat continues to use explicit range/hit tests, so both sides can
      // pass through one another without pushing or creating a soft lock.
      this.actorLeafSlimeCollider = null;
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
      if (this.isCat) {
        this.triggerPrimaryActionImmediate();
        return;
      }
      if (app.profile.characterId === "lina") this.startLinaAttackHold();
      else this.startCharacterAttackHold();
    }

    releasePrimaryActionHold() {
      if (!this.primaryHold) return;
      const hold = this.primaryHold;
      hold.released = true;
      if (this.time.now - hold.startedAt >= CHARGE_HOLD_THRESHOLD) hold.charged = true;
      if (app.profile.characterId !== "lina") {
        this.finishCharacterAttackHold();
      } else if (hold.startComplete || this.actor?.anims?.currentAnim?.key === "lina-attack-charge-loop") {
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
      else this.castProjectile({ charged: false });
    }

    startCharacterAttackHold() {
      if (!this.actor || app.profile.hp <= 0 || this.isDead || this.isActionLocked || this.isCasting) return;
      this.primaryHold = {
        startedAt: this.time.now,
        charged: false,
        released: false,
        startComplete: true
      };
      this.chargeHoldTimer?.remove?.(false);
      this.chargeHoldTimer = this.time.delayedCall(CHARGE_HOLD_THRESHOLD, () => {
        if (this.primaryHold && !this.primaryHold.released) this.primaryHold.charged = true;
      });
    }

    finishCharacterAttackHold() {
      const hold = this.primaryHold;
      if (!hold) return;
      this.primaryHold = null;
      this.chargeHoldTimer?.remove?.(false);
      this.chargeHoldTimer = null;
      this.castProjectile({ charged: !!hold.charged });
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
      const canCastCharged = !hold.charged || this.spendEnergy(CHARGED_ATTACK_COST, "重击");
      if (hold.charged && canCastCharged) this.castLinaGale();
      else if (!hold.charged) this.fireLinaWindBolt();
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

    castProjectile(options = {}) {
      if (!this.actor || app.profile.hp <= 0 || this.isCat) {
        if (this.isCat) this.playCatJump();
        return;
      }
      const charged = !!options.charged;
      const now = this.time.now;
      const characterId = app.profile.characterId;
      const isMelee = ["ayu", "laodeng"].includes(characterId);
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const berserk = characterId === "laodeng" && now < this.berserkUntil;
      const baseCooldown = isMelee ? MELEE.cooldown : equipment.cooldown;
      const cooldown = berserk ? baseCooldown / 1.5 : baseCooldown;
      if (now - this.lastShotAt < cooldown) return;
      const freeBerserkHeavy = charged && characterId === "laodeng" && berserk;
      if (charged && !freeBerserkHeavy && !this.spendEnergy(CHARGED_ATTACK_COST, "重击")) {
        this.returnToBaseLoop();
        return;
      }
      this.lastShotAt = now;
      const character = getCharacter(characterId);
      this.isCasting = true;
      this.networkAction = "attack";
      this.setLinaAttackVisualScale();
      this.actor.play(this.getAttackAnimationKey(), true);
      if (characterId === "ayu") {
        this.time.delayedCall(95, () => this.dealMeleeDamage({
          damageMultiplier: charged ? 0.85 : 1,
          charged,
          angleOffset: charged ? -0.12 : 0,
          reach: 70,
          radius: 72
        }));
        if (charged) this.time.delayedCall(245, () => this.dealMeleeDamage({
          damageMultiplier: 0.85,
          charged: true,
          angleOffset: 0.14,
          reach: 74,
          radius: 75
        }));
      } else if (characterId === "laodeng") {
        this.time.delayedCall(105, () => this.castLaodengImpactPunch(charged, berserk));
      } else if (characterId === "zhixia" && charged) {
        this.time.delayedCall(105, () => this.castChainLightning());
      } else if (characterId === "zhixia") {
        this.time.delayedCall(95, () => this.fireProjectile({
          kind: "magic",
          color: 0x73d9ff,
          damage: Number(app.profile.magicPower || 22),
          speed: ZHIXIA_PROJECTILE_SPEED,
          maxDistance: MAP_TILE_SIZE * 7,
          visualType: "lightningOrb"
        }));
      } else if (characterId === "lina" && charged) {
        this.time.delayedCall(105, () => this.castLinaGale());
      } else if (characterId === "lina") {
        this.time.delayedCall(95, () => this.fireLinaWindBolt());
      } else if (characterId === "jiangxun") {
        this.time.delayedCall(95, () => this.fireProjectile({
          charged,
          kind: "physical",
          color: 0xb7e58a,
          damage: Math.round(Number(app.profile.attackPower || 26) * (charged ? 1.65 : 1)),
          piercing: charged,
          ignoreObstacles: charged,
          maxLargeTargetHits: charged ? 3 : 1,
          largeTargetDamage: charged ? Math.round(Number(app.profile.attackPower || 26) * 0.72) : 0,
          maxDistance: MAP_TILE_SIZE * (charged ? 9 : 7),
          visualType: charged ? "arrowHeavy" : "arrow",
          audioType: "bow"
        }));
      } else {
        this.time.delayedCall(95, () => this.fireProjectile({ charged }));
      }
      this.actor.once("animationcomplete", () => {
        if (this.isHeavyDashing) return;
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
      if (app.profile.characterId === "ayu") return this.castAyuUltimate();
      if (app.profile.characterId === "zhixia") return this.castZhixiaUltimate();
      if (app.profile.characterId === "laodeng") return this.castLaodengUltimate();
      if (app.profile.characterId === "jiangxun") return this.castJiangxunUltimate();
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
      this.playLinaHealingChainUltimate();
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
      [0, 170, 340].forEach((roundDelay, roundIndex) => this.time.delayedCall(120 + roundDelay, () => {
        if (!this.actor?.active || this.isDead) return;
        this.actor.play("ayu-attack-once", true);
        const aim = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
        const baseAngle = Math.atan2(aim.y, aim.x);
        [-0.2, 0, 0.2].forEach(offset => this.fireProjectile({
          vec: { x: Math.cos(baseAngle + offset), y: Math.sin(baseAngle + offset) },
          kind: "physical",
          color: 0x8fd8ff,
          damage: Math.round(Number(app.profile.attackPower || MELEE.damage) * 0.82),
          maxDistance: AYU_SWORD_WAVE_RANGE,
          speed: 760,
          piercing: true,
          noEnergyGain: true,
          allowComboHit: true,
          knockbackForce: 185,
          impactAoeRadius: AYU_SWORD_WAVE_AOE_RADIUS,
          impactAoeMultiplier: AYU_SWORD_WAVE_AOE_MULTIPLIER,
          impactAoeColor: 0x8fd8ff,
          impactAoeComboIndex: roundIndex,
          visualType: "swordWave",
          audioType: "sword"
        }));
        if (roundIndex === 2) app.audio.ultimateBurst();
        this.cameras.main.shake(90, 0.002 + roundIndex * 0.0005);
      }));
      this.time.delayedCall(780, () => {
        if (!this.actor?.active || this.isDead) return;
        this.isCasting = false;
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    castZhixiaUltimate() {
      if (this.isCat || this.isDead || this.isActionLocked || this.isCasting || this.primaryHold) return;
      if (!this.spendEnergy(ULTIMATE_COST, "大招")) return;
      this.isCasting = true;
      this.isActionLocked = true;
      this.networkAction = "attack";
      this.actor.body.setVelocity(0, 0);
      this.actor.play("zhixia-attack-once", true);
      const aim = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
      const aftershockSeeds = [];
      this.broadcastCombatEvent("zhixiaUltimate", {
        x: this.actor.x,
        y: this.actor.y - 42,
        aimX: aim.x,
        aimY: aim.y,
        radius: 92
      });
      for (let index = 1; index <= 10; index += 1) {
        this.time.delayedCall(index * 105, () => {
          if (!this.actor?.active || this.isDead) return;
          const x = this.actor.x + aim.x * MAP_TILE_SIZE * index;
          const y = this.actor.y - 42 + aim.y * MAP_TILE_SIZE * index;
          const hits = this.strikeLightning(x, y, Math.round(Number(app.profile.magicPower || 22) * 1.15), 92);
          if (hits.length) aftershockSeeds.push({ x, y });
        });
      }
      app.audio.ultimateWind();
      this.time.delayedCall(1180, () => {
        if (!this.actor?.active || this.isDead) return;
        this.startZhixiaUltimateAftershock(aftershockSeeds, {
          x: this.actor.x + aim.x * MAP_TILE_SIZE * 5,
          y: this.actor.y - 42 + aim.y * MAP_TILE_SIZE * 5
        });
      });
      this.time.delayedCall(1220, () => {
        this.isCasting = false;
        this.isActionLocked = false;
        this.returnToBaseLoop();
      });
    }

    startZhixiaUltimateAftershock(seedPoints, fallbackPoint) {
      const seeds = (Array.isArray(seedPoints) ? seedPoints : [])
        .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
      if (!seeds.length) return;
      const pulseCount = Math.max(1, Math.floor(ZHIXIA_ULTIMATE_CHAIN_DURATION / ZHIXIA_ULTIMATE_CHAIN_INTERVAL));
      for (let pulse = 0; pulse < pulseCount; pulse += 1) {
        this.time.delayedCall(pulse * ZHIXIA_ULTIMATE_CHAIN_INTERVAL, () => {
          if (!this.actor?.active || this.isDead) return;
          this.triggerZhixiaUltimateAftershockPulse(seeds, pulse, fallbackPoint);
        });
      }
    }

    triggerZhixiaUltimateAftershockPulse(seedPoints, pulse, fallbackPoint) {
      const activeEnemies = (this.leafSlimes?.getChildren?.() || [])
        .filter(slime => slime?.active && !["dead", "vanish", "emerging", "transform"].includes(slime.state));
      if (!activeEnemies.length) return;
      const seed = seedPoints[pulse % seedPoints.length] || fallbackPoint;
      const first = activeEnemies
        .map(slime => ({
          slime,
          distance: Phaser.Math.Distance.Between(seed.x, seed.y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y)
        }))
        .filter(item => item.distance <= ZHIXIA_LIGHTNING_REFRACT_RANGE)
        .sort((a, b) => a.distance - b.distance)[0]?.slime;
      if (!first) return;

      const chain = [first];
      const visited = new Set(chain);
      while (chain.length < ZHIXIA_ULTIMATE_CHAIN_REFRACTIONS + 1) {
        const current = chain[chain.length - 1];
        const next = activeEnemies
          .filter(slime => !visited.has(slime))
          .map(slime => ({
            slime,
            distance: Phaser.Math.Distance.Between(
              current.x,
              current.y + LEAF_SLIME_HIT_OFFSET_Y,
              slime.x,
              slime.y + LEAF_SLIME_HIT_OFFSET_Y
            )
          }))
          .filter(item => item.distance <= ZHIXIA_LIGHTNING_REFRACT_RANGE)
          .sort((a, b) => a.distance - b.distance)[0]?.slime;
        if (!next) break;
        visited.add(next);
        chain.push(next);
      }

      const points = [seed, ...chain.map(slime => ({ x: slime.x, y: slime.y + LEAF_SLIME_HIT_OFFSET_Y }))];
      // Keep the promised three visible refractions even when fewer than four
      // enemies remain. Empty bounces arc into the floor and deal no damage.
      while (points.length < ZHIXIA_ULTIMATE_CHAIN_REFRACTIONS + 2) {
        const previous = points[points.length - 1];
        const angle = pulse * 0.83 + points.length * 1.71;
        const distance = 72 + points.length * 9;
        points.push({
          x: clamp(previous.x + Math.cos(angle) * distance, 36, this.worldWidth - 36),
          y: clamp(previous.y + Math.sin(angle) * distance * 0.56, 48, this.worldHeight - 48)
        });
      }
      this.broadcastCombatEvent("chainLightning", {
        x: seed.x,
        y: seed.y,
        points,
        secondary: true,
        pulse
      });
      points.slice(1).forEach((target, index) => {
        const source = points[index];
        this.time.delayedCall(index * ZHIXIA_ULTIMATE_CHAIN_HOP_INTERVAL, () => {
          this.drawLightningArc(source.x, source.y, target.x, target.y, {
            intensity: Math.max(0.68, 1.04 - index * 0.08),
            style: "chain"
          });
          this.renderChainLightningHit(target.x, target.y, Math.max(30, 46 - index * 4));
          const slime = chain[index];
          if (!slime?.active) return;
          const damage = Math.max(1, Math.round(
            Number(app.profile.magicPower || 22)
            * ZHIXIA_ULTIMATE_CHAIN_DAMAGE_MULTIPLIER
            * Math.max(0.72, 1 - index * 0.08)
          ));
          this.playLeafSlimeHit(slime, damage, {
            kind: "magic",
            charged: true,
            noEnergyGain: true,
            allowComboHit: true
          });
        });
      });
      app.audio.lightningChainPulse(pulse);
    }

    castLaodengUltimate() {
      if (this.isCat || this.isDead || this.isActionLocked || this.primaryHold) return;
      if (!this.spendEnergy(ULTIMATE_COST, "大招")) return;
      this.berserkUntil = this.time.now + LAODENG_BERSERK_DURATION;
      this.berserkEndingShown = false;
      this.setActorVisualScale(LAODENG_BERSERK_SCALE);
      this.playBerserkActivationVisual();
      this.broadcastCombatEvent("berserk", { x: this.actor.x, y: this.actor.y, radius: 128 });
      this.showFloatingText(this.actor.x, this.actor.y - 128, "嗜血狂暴 8秒", { color: "#ffbd72", size: "22px", rise: 64 });
      app.audio.ultimateBurst();
      showToast("嗜血狂暴：8 秒内免硬直，体型 +25%，移速、攻速与伤害 +50%，结束恢复 40% 最大生命");
    }

    castJiangxunUltimate() {
      if (this.isCat || this.isDead || this.isActionLocked || this.isCasting || this.primaryHold) return;
      if (!this.spendEnergy(ULTIMATE_COST, "大招")) return;
      this.isCasting = true;
      this.isActionLocked = true;
      this.networkAction = "attack";
      this.actor.body.setVelocity(0, 0);
      this.actor.play("jiangxun-barrage-loop", true);
      const aim = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
      const baseAngle = Math.atan2(aim.y, aim.x);
      const barrageDamageRamp = new Map();
      for (let index = 0; index < JIANGXUN_BARRAGE_ARROWS; index += 1) {
        this.time.delayedCall(index * 58, () => {
          if (!this.actor?.active || this.isDead) return;
          const spread = Phaser.Math.FloatBetween(-JIANGXUN_BARRAGE_SPREAD / 2, JIANGXUN_BARRAGE_SPREAD / 2);
          this.fireProjectile({
            vec: { x: Math.cos(baseAngle + spread), y: Math.sin(baseAngle + spread) },
            kind: "physical",
            color: 0xc5eb92,
            damage: Math.max(1, Math.round(Number(app.profile.attackPower || 26) * 0.62)),
            maxDistance: MAP_TILE_SIZE * 9,
            speed: Phaser.Math.Between(850, 980),
            noEnergyGain: true,
            allowComboHit: true,
            impactAoeRadius: JIANGXUN_BARRAGE_AOE_RADIUS,
            impactAoeMultiplier: JIANGXUN_BARRAGE_AOE_MULTIPLIER,
            impactAoeColor: 0xf0bb62,
            impactAoeComboIndex: index % 5,
            barrageDamageRamp,
            visualType: "arrowBarrage",
            audioType: "bow"
          });
        });
      }
      app.audio.ultimateWind();
      this.time.delayedCall(JIANGXUN_BARRAGE_ARROWS * 58 + 180, () => {
        this.isCasting = false;
        this.isActionLocked = false;
        this.actor?.setTexture("jiangxun");
        this.returnToBaseLoop();
      });
    }

    fireLinaWindBolt() {
      this.fireProjectile({
        kind: "magic",
        color: 0x6eea8e,
        damage: Number(app.profile.magicPower || 22),
        speed: 760,
        maxDistance: MAP_TILE_SIZE * 7,
        visualType: "windBolt"
      });
    }

    castLinaGale() {
      if (!this.actor?.active || this.isDead) return;
      const center = this.getActorFootCenter();
      const damage = Math.round(Number(app.profile.magicPower || 22) * LINA_GALE_DAMAGE_MULTIPLIER);
      let hitSomething = false;
      this.playLinaGaleVisual(center.x, center.y);
      this.broadcastCombatEvent("linaGale", { x: center.x, y: center.y, radius: LINA_GALE_RADIUS });
      (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) return;
        const dx = slime.x - center.x;
        const dy = slime.y + LEAF_SLIME_HIT_OFFSET_Y - center.y;
        const distance = Math.hypot(dx, dy);
        if (distance > LINA_GALE_RADIUS + LEAF_SLIME_HIT_RADIUS) return;
        this.playLeafSlimeHit(slime, damage, { kind: "magic", charged: true });
        if (slime.rank === "mob" && slime.active && slime.body?.enable) {
          const fallback = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
          const unit = distance > 1 ? { x: dx / distance, y: dy / distance } : fallback;
          const pushToken = (slime.galePushToken || 0) + 1;
          slime.galePushToken = pushToken;
          const pushDuration = 165;
          const pushSpeed = LINA_GALE_PUSH_DISTANCE / (pushDuration / 1000);
          slime.skillKnockbackUntil = this.time.now + pushDuration + 12;
          slime.body.setVelocity(unit.x * pushSpeed, unit.y * pushSpeed);
          this.time.delayedCall(pushDuration, () => {
            if (slime.active && slime.body?.enable && slime.galePushToken === pushToken) slime.body.setVelocity(0, 0);
          });
        }
        hitSomething = true;
      });
      app.audio.ultimateWind();
      if (hitSomething) this.cameras.main.shake(120, 0.0022);
    }

    playLinaGaleVisual(x, y) {
      const vortexRadius = Math.min(176, LINA_GALE_RADIUS * 0.58);
      const centerY = y - 26;
      const groundDepth = Math.max(2, y - 18);
      for (let wave = 0; wave < 3; wave += 1) {
        this.time.delayedCall(wave * 58, () => {
          const underlay = this.add.graphics().setPosition(x, centerY + 20).setScale(1, 0.48).setDepth(groundDepth + wave);
          const current = this.add.graphics().setPosition(x, centerY + 20).setScale(1, 0.48).setDepth(y + 78 + wave);
          const highlight = this.add.graphics().setPosition(x, centerY + 20).setScale(1, 0.48).setDepth(y + 82 + wave).setBlendMode(Phaser.BlendModes.ADD);
          const segmentCount = 18 + wave * 3;
          for (let index = 0; index < segmentCount; index += 1) {
            const ratio = index / segmentCount;
            const radius = 38 + ratio * (vortexRadius - 22) + Phaser.Math.Between(-10, 10);
            const start = Math.PI * 2 * ratio + wave * 0.7 + Phaser.Math.FloatBetween(-0.12, 0.12);
            const sweep = Phaser.Math.FloatBetween(0.42, 0.92);
            underlay.lineStyle(index % 5 === 0 ? 19 : 11, 0x083c2b, index % 4 === 0 ? 0.26 : 0.16);
            underlay.beginPath();
            underlay.arc(0, 0, radius, start, start + sweep, false);
            underlay.strokePath();
            current.lineStyle(index % 4 === 0 ? 8 : 4.5, index % 3 ? 0x2fcf77 : 0x65eea2, index % 4 === 0 ? 0.62 : 0.48);
            current.beginPath();
            current.arc(0, 0, radius, start + 0.035, start + sweep - 0.035, false);
            current.strokePath();
            if (index % 2 === 0) {
              highlight.lineStyle(index % 4 === 0 ? 2.4 : 1.3, index % 5 ? 0xbaffd7 : 0xf4fff3, 0.8);
              highlight.beginPath();
              highlight.arc(0, 0, radius + 2, start + 0.08, start + sweep * 0.72, false);
              highlight.strokePath();
            }
          }
          const rotation = wave % 2 ? -26 : 30;
          [underlay, current, highlight].forEach((layer, index) => this.tweens.add({
            targets: layer,
            angle: (index ? rotation : -rotation * 0.55),
            scaleX: 1.08 + wave * 0.05,
            scaleY: 0.54 + wave * 0.025,
            alpha: 0,
            duration: 430 + wave * 95,
            ease: "Cubic.easeOut",
            onComplete: () => layer.destroy()
          }));
          for (let ribbonIndex = 0; ribbonIndex < 6; ribbonIndex += 1) {
            const angle = Math.PI * 2 * ribbonIndex / 6 + wave * 0.5 + Phaser.Math.FloatBetween(-0.16, 0.16);
            const bandRadius = 42 + ribbonIndex * 14 + wave * 9;
            const ribbon = this.add.image(
              x + Math.cos(angle) * bandRadius,
              centerY + Math.sin(angle) * bandRadius * 0.42,
              WIND_RIBBON_TEXTURE_KEY
            )
              .setOrigin(0.08, 0.5)
              .setRotation(angle + Math.PI * 0.46)
              .setScale(0.42 + ribbonIndex * 0.055, 0.26 + (ribbonIndex % 3) * 0.04)
              .setTint(ribbonIndex % 3 ? 0x49dc83 : 0xc4ffda)
              .setAlpha(0.68)
              .setBlendMode(ribbonIndex % 2 ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
              .setDepth(ribbonIndex < 3 ? groundDepth + 5 : y + 86 + ribbonIndex);
            this.tweens.add({
              targets: ribbon,
              x: x + Math.cos(angle + 0.58) * (bandRadius + 34),
              y: centerY + Math.sin(angle + 0.58) * (bandRadius + 34) * 0.46 - 18,
              rotation: angle + Math.PI * 0.72,
              scaleX: ribbon.scaleX * 1.5,
              alpha: 0,
              duration: 390 + wave * 80 + ribbonIndex * 18,
              ease: "Cubic.easeOut",
              onComplete: () => ribbon.destroy()
            });
          }
        });
      }
      for (let burst = 0; burst < 5; burst += 1) {
        this.time.delayedCall(burst * 36, () => this.spawnWindBurst(x, centerY, 14 + burst * 4, 62 + burst * 22, 310 + burst * 45));
      }
    }

    spawnWindBurst(x, y, count = 12, radius = 120, duration = 340) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.PI * 2 * index / count + Math.random() * 0.34;
        const distance = radius * (0.72 + Math.random() * 0.42);
        const texture = index % 4 === 0 ? WIND_LEAF_TEXTURE_KEY : WIND_MOTE_TEXTURE_KEY;
        const mote = this.add.image(x, y, texture)
          .setScale(texture === WIND_LEAF_TEXTURE_KEY ? 0.55 : 0.5 + Math.random() * 0.32)
          .setRotation(angle)
          .setBlendMode(texture === WIND_LEAF_TEXTURE_KEY ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD)
          .setTint(texture === WIND_LEAF_TEXTURE_KEY ? 0x60c59b : (index % 3 ? 0x8cf2df : 0xe6fff8))
          .setDepth(y + 86);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance * 0.56,
          angle: Phaser.Math.RadToDeg(angle) + 140 + Math.random() * 100,
          alpha: 0,
          scale: 0.16,
          duration: duration * (0.8 + Math.random() * 0.35),
          ease: "Cubic.easeOut",
          onComplete: () => mote.destroy()
        });
      }
    }

    applyLocalFriendlyHeal(amount) {
      if (!app.profile || amount <= 0) return;
      const before = Number(app.profile.hp || 0);
      app.profile.hp = Math.min(Number(app.profile.maxHp || before), before + amount);
      const healed = app.profile.hp - before;
      if (healed <= 0) return;
      this.playFriendlyHealEffect(this.actor.x, this.actor.y, healed);
      renderHud();
      saveProfile(app.profile);
    }

    playFriendlyHealEffect(x, y, amount = 0) {
      this.playHealEffect(x, y);
      for (let index = 0; index < 7; index += 1) {
        const angle = Math.PI * 2 * index / 7;
        const mote = this.add.image(x + Math.cos(angle) * 25, y - 36 + Math.sin(angle) * 13, WIND_MOTE_TEXTURE_KEY)
          .setScale(0.42)
          .setRotation(angle)
          .setDepth(y + 76);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(angle + 0.9) * 45,
          y: y - 86 + Math.sin(angle + 0.9) * 18,
          alpha: 0,
          angle: Phaser.Math.RadToDeg(angle) + 90,
          duration: 620,
          ease: "Sine.easeOut",
          onComplete: () => mote.destroy()
        });
      }
      if (amount > 0) this.showFloatingText(x, y - 122, `群体治疗 +${amount}`, { color: "#83ffd1", size: "18px", rise: 58 });
    }

    applyNetworkAreaHeal(message) {
      const targets = Array.isArray(message?.targets) ? message.targets : [];
      targets.forEach(target => {
        if (!target?.id) return;
        if (target.id === app.profile.id) {
          const before = Number(app.profile.hp || 0);
          app.profile.hp = clamp(Number(target.hp ?? before), 0, Number(target.maxHp || app.profile.maxHp || 1));
          const healed = Math.max(0, app.profile.hp - before);
          if (healed > 0) this.playFriendlyHealEffect(this.actor.x, this.actor.y, healed);
          renderHud();
          saveProfile(app.profile);
          return;
        }
        const remote = this.remotePlayers.get(target.id);
        if (!remote) return;
        const before = Number(remote.hp || 0);
        remote.maxHp = Math.max(1, Number(target.maxHp || remote.maxHp || 1));
        remote.hp = clamp(Number(target.hp ?? before), 0, remote.maxHp);
        const ratio = remote.hp / remote.maxHp;
        remote.hpFill?.setDisplaySize(Math.max(1, 48 * ratio), 4).setVisible(remote.hp > 0);
        if (remote.hp > before) this.playFriendlyHealEffect(remote.sprite.x, remote.sprite.y, remote.hp - before);
      });
    }

    playLinaHealingChainUltimate() {
      if (!this.actor?.active || this.isDead) return;
      const magic = Number(app.profile.magicPower || 22);
      const healing = Math.round(LINA_HEAL_CHAIN_BASE + magic * LINA_HEAL_CHAIN_MULTIPLIER);
      const shield = Math.round(LINA_HEAL_CHAIN_SHIELD_BASE + magic * LINA_HEAL_CHAIN_SHIELD_MULTIPLIER);
      this.playHealingChainCastBurst(this.actor.x, this.actor.y);
      app.audio.ultimateWind();
      if (!app.connected || !app.multiplayer?.sendHealingChain(healing, shield, LINA_HEAL_CHAIN_RANGE, LINA_HEAL_CHAIN_JUMPS)) {
        const bounces = [];
        let hp = Number(app.profile.hp || 0);
        const maxHp = Math.max(1, Number(app.profile.maxHp || 1));
        let currentShield = Number(app.profile.shield || 0);
        const maxShield = Math.round(maxHp * 0.5);
        for (let index = 0; index < LINA_HEAL_CHAIN_JUMPS; index += 1) {
          const beforeHp = hp;
          const beforeShield = currentShield;
          if (hp < maxHp) hp = Math.min(maxHp, hp + healing);
          else currentShield = Math.min(maxShield, currentShield + shield);
          bounces.push({
            targetId: app.profile.id,
            hp,
            maxHp,
            shield: currentShield,
            healed: hp - beforeHp,
            shieldGain: currentShield - beforeShield,
            x: this.actor.x,
            y: this.actor.y
          });
        }
        this.applyNetworkHealingChain({
          sourceId: app.profile.id,
          source: { x: this.actor.x, y: this.actor.y },
          bounces
        });
      }
      this.time.delayedCall(860, () => {
        if (!this.actor?.active || this.isDead) return;
        this.isCasting = false;
        this.isActionLocked = false;
        this.actor.setTexture(app.profile.characterId);
        this.resetActorVisualScale();
        this.returnToBaseLoop();
      });
    }

    applyNetworkHealingChain(message) {
      const bounces = Array.isArray(message?.bounces) ? message.bounces.slice(0, LINA_HEAL_CHAIN_JUMPS) : [];
      if (!bounces.length) return;
      const chainSegments = [];
      let previous = message?.source || this.getFriendlyEffectPosition(message?.sourceId);
      if (message?.sourceId !== app.profile?.id && previous) {
        this.playHealingChainCastBurst(previous.x, previous.y);
        app.audio.ultimateWind();
      }
      bounces.forEach((bounce, index) => {
        this.time.delayedCall(index * 125, () => {
          const targetPosition = this.getFriendlyEffectPosition(bounce.targetId) || { x: bounce.x, y: bounce.y };
          const target = targetPosition || previous || { x: this.actor.x, y: this.actor.y };
          const segment = this.playHealingChainArc(previous || target, target, index);
          if (segment) chainSegments.push(segment);
          this.applyHealingChainTargetState(bounce, target);
          previous = target;
          if (index === bounces.length - 1) {
            app.audio.heal();
            this.time.delayedCall(LINA_HEAL_CHAIN_HOLD_MS, () => chainSegments.forEach(activeSegment => activeSegment.fade()));
          }
        });
      });
    }

    getFriendlyEffectPosition(playerId) {
      if (playerId === app.profile.id) return this.actor?.active ? { x: this.actor.x, y: this.actor.y } : null;
      const remote = this.remotePlayers.get(playerId);
      return remote?.sprite?.active ? { x: remote.sprite.x, y: remote.sprite.y } : null;
    }

    applyHealingChainTargetState(bounce, position) {
      const healed = Math.max(0, Number(bounce.healed || 0));
      const shieldGain = Math.max(0, Number(bounce.shieldGain || 0));
      if (bounce.targetId === app.profile.id) {
        app.profile.hp = clamp(Number(bounce.hp ?? app.profile.hp), 0, Number(bounce.maxHp || app.profile.maxHp || 1));
        app.profile.shield = Math.max(0, Number(bounce.shield ?? app.profile.shield ?? 0));
        renderHud();
        saveProfile(app.profile);
      } else {
        const remote = this.remotePlayers.get(bounce.targetId);
        if (remote) {
          remote.maxHp = Math.max(1, Number(bounce.maxHp || remote.maxHp || 1));
          remote.hp = clamp(Number(bounce.hp ?? remote.hp), 0, remote.maxHp);
          remote.shield = Math.max(0, Number(bounce.shield ?? remote.shield ?? 0));
          const ratio = remote.hp / remote.maxHp;
          remote.hpFill?.setDisplaySize(Math.max(1, 48 * ratio), 4).setVisible(remote.hp > 0);
        }
      }
      this.playHealingChainImpact(position.x, position.y, healed, shieldGain);
    }

    playHealingChainCastBurst(x, y) {
      const rays = this.add.graphics().setPosition(x, y - 42).setDepth(y + 82).setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 28; index += 1) {
        const angle = Math.PI * 2 * index / 28;
        const inner = 12 + (index % 3) * 5;
        const outer = 44 + (index % 5) * 9;
        rays.lineStyle(index % 4 === 0 ? 4 : 2, index % 3 ? 0x7dedd5 : 0xfff1b8, 0.72);
        rays.lineBetween(Math.cos(angle) * inner, Math.sin(angle) * inner, Math.cos(angle) * outer, Math.sin(angle) * outer);
      }
      for (let index = 0; index < 7; index += 1) {
        const angle = Math.PI * 2 * index / 7;
        const ribbon = this.add.image(x, y - 42, WIND_RIBBON_TEXTURE_KEY)
          .setOrigin(0.08, 0.5)
          .setRotation(angle - 0.55)
          .setScale(0.24, 0.14)
          .setTint(index % 3 ? 0x9cf2d8 : 0xffe5a6)
          .setAlpha(0.76)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(y + 83 + index);
        this.tweens.add({
          targets: ribbon,
          x: x + Math.cos(angle) * 76,
          y: y - 42 + Math.sin(angle) * 42,
          scaleX: 0.5,
          scaleY: 0.2,
          alpha: 0,
          duration: 430 + index * 18,
          ease: "Cubic.easeOut",
          onComplete: () => ribbon.destroy()
        });
      }
      this.tweens.add({ targets: rays, scale: 1.55, alpha: 0, angle: 24, duration: 420, ease: "Cubic.easeOut", onComplete: () => rays.destroy() });
      this.spawnHealingMotes(x, y - 42, 38, 76, 520);
    }

    playHealingChainArc(from, to, bounceIndex = 0) {
      const sameTarget = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) < 8;
      const points = [];
      const steps = 24;
      const dx = sameTarget ? 70 : to.x - from.x;
      const dy = sameTarget ? -8 : to.y - from.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const wave = Math.sin(t * Math.PI * 2.75 + bounceIndex * 1.3) * (sameTarget ? 20 : 8 + bounceIndex * 1.5);
        const loop = sameTarget ? Math.sin(t * Math.PI) * 55 : 0;
        points.push({
          x: from.x + dx * t + nx * wave + (sameTarget ? Math.cos(t * Math.PI * 2) * loop : 0),
          y: from.y - 52 + dy * t + ny * wave - (sameTarget ? Math.sin(t * Math.PI) * 36 : 0)
        });
      }
      const depth = Math.max(from.y, to.y) + 94;
      const container = this.add.container(0, 0).setDepth(depth);
      const activeTweens = [];
      if (!sameTarget) {
        const rotation = Math.atan2(dy, dx);
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 52 };
        [
          { tint: 0x1a6d38, alpha: 0.25, scaleY: 0.36, offset: 8 },
          { tint: 0x75ed62, alpha: 0.6, scaleY: 0.22, offset: 0 },
          { tint: 0xffef76, alpha: 0.8, scaleY: 0.09, offset: -5 }
        ].forEach((style, index) => {
          const ribbon = this.add.image(midpoint.x + nx * style.offset, midpoint.y + ny * style.offset, WIND_RIBBON_TEXTURE_KEY)
            .setOrigin(0.5)
            .setRotation(rotation - 0.54)
            .setScale(Math.max(0.22, length / 228), style.scaleY)
            .setTint(style.tint)
            .setAlpha(style.alpha)
            .setBlendMode(index ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
            .setDepth(index);
          container.add(ribbon);
          activeTweens.push(this.tweens.add({
            targets: ribbon,
            alpha: { from: style.alpha, to: style.alpha * 0.55 },
            scaleY: style.scaleY * 1.2,
            duration: 180 + index * 35,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          }));
        });
      }
      const lineLayers = [
        { width: 18, color: 0x123b23, alpha: 0.34, blend: Phaser.BlendModes.NORMAL },
        { width: 10, color: 0x31bd55, alpha: 0.72, blend: Phaser.BlendModes.NORMAL },
        { width: 5, color: 0x9cff67, alpha: 0.96, blend: Phaser.BlendModes.ADD },
        { width: 1.6, color: 0xfffac0, alpha: 0.96, blend: Phaser.BlendModes.ADD }
      ].map((style, layerIndex) => {
        const graphics = this.add.graphics().setDepth(layerIndex + 4).setBlendMode(style.blend);
        graphics.lineStyle(style.width, style.color, style.alpha);
        graphics.beginPath();
        points.forEach((point, index) => index ? graphics.lineTo(point.x, point.y) : graphics.moveTo(point.x, point.y));
        graphics.strokePath();
        container.add(graphics);
        return graphics;
      });
      activeTweens.push(this.tweens.add({
        targets: lineLayers.slice(1),
        alpha: { from: 1, to: 0.58 },
        duration: 135,
        delay: bounceIndex * 24,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      }));
      const samplePath = progress => {
        const scaled = clamp(progress, 0, 1) * (points.length - 1);
        const index = Math.min(points.length - 2, Math.floor(scaled));
        const ratio = scaled - index;
        return {
          x: Phaser.Math.Linear(points[index].x, points[index + 1].x, ratio),
          y: Phaser.Math.Linear(points[index].y, points[index + 1].y, ratio)
        };
      };
      for (let pulseIndex = 0; pulseIndex < 7; pulseIndex += 1) {
        const pulse = this.add.image(points[0].x, points[0].y, WIND_MOTE_TEXTURE_KEY)
          .setScale(0.42 + pulseIndex % 3 * 0.08)
          .setTint(pulseIndex % 3 ? 0xb6ff67 : 0xfff59a)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(10 + pulseIndex);
        container.add(pulse);
        const travel = { value: 0 };
        activeTweens.push(this.tweens.add({
          targets: travel,
          value: 1,
          delay: pulseIndex * 82,
          duration: 430 + bounceIndex * 28,
          repeat: -1,
          repeatDelay: 70,
          ease: "Sine.easeInOut",
          onUpdate: () => {
            const point = samplePath(travel.value);
            pulse.setPosition(point.x, point.y).setScale(0.38 + Math.sin(travel.value * Math.PI) * 0.22);
          }
        }));
      }
      points.slice(2, -1).forEach((point, index) => {
        if (index % 3) return;
        const mote = this.add.image(point.x, point.y, WIND_MOTE_TEXTURE_KEY)
          .setScale(0.18 + Math.random() * 0.18)
          .setTint(index % 2 ? 0x88ee5d : 0xffef8a)
          .setAlpha(0.66)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(8);
        container.add(mote);
        activeTweens.push(this.tweens.add({
          targets: mote,
          y: point.y - 10 - Math.random() * 8,
          alpha: { from: 0.66, to: 0.18 },
          scale: 0.08,
          duration: 260 + index * 9,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        }));
      });
      let fading = false;
      return {
        fade: () => {
          if (fading || !container.active) return;
          fading = true;
          activeTweens.forEach(tween => tween?.stop?.());
          this.tweens.add({
            targets: container,
            alpha: 0,
            duration: 220,
            ease: "Sine.easeOut",
            onComplete: () => container.destroy(true)
          });
        }
      };
    }

    playHealingChainImpact(x, y, healed, shieldGain) {
      const accent = shieldGain > 0 ? 0xb7fff4 : 0xb7ff75;
      const field = this.add.graphics().setPosition(x, y + 2).setDepth(Math.max(2, y - 22));
      field.fillStyle(0x1b8d42, 0.2);
      field.fillEllipse(0, 0, 196, 74);
      field.lineStyle(12, 0x176d35, 0.18);
      field.strokeEllipse(0, 0, 196, 74);
      field.lineStyle(4, 0x5fe76f, 0.68);
      field.strokeEllipse(0, 0, 184, 66);
      field.lineStyle(1.5, 0xe9ffab, 0.92);
      field.strokeEllipse(0, 0, 164, 56);
      const orbit = this.add.graphics().setPosition(x, y + 2).setScale(1, 0.4).setDepth(y + 88).setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 13; index += 1) {
        const start = Math.PI * 2 * index / 13 + Phaser.Math.FloatBetween(-0.08, 0.08);
        const radius = 72 + index % 4 * 7;
        orbit.lineStyle(index % 4 === 0 ? 4.5 : 2, index % 3 ? 0x8cff73 : 0xffef8a, index % 4 === 0 ? 0.86 : 0.62);
        orbit.beginPath();
        orbit.arc(0, 0, radius, start, start + 0.38 + index % 3 * 0.14, false);
        orbit.strokePath();
      }
      const dome = this.add.graphics().setPosition(x, y - 38).setDepth(y + 101).setBlendMode(Phaser.BlendModes.ADD);
      dome.fillStyle(0x2abf55, 0.055);
      dome.fillCircle(0, 0, 70);
      [64, 56, 46].forEach((radius, index) => {
        dome.lineStyle(index === 0 ? 3.2 : 1.4, index === 1 ? 0xffef91 : 0x86ff78, index === 0 ? 0.82 : 0.58);
        dome.beginPath();
        dome.arc(0, 0, radius, -2.86 + index * 0.22, -0.42 - index * 0.14, false);
        dome.strokePath();
        dome.beginPath();
        dome.arc(0, 0, radius, 0.22 + index * 0.16, 2.72 - index * 0.2, false);
        dome.strokePath();
      });
      const pillars = this.add.graphics().setPosition(x, y - 16).setDepth(y + 106).setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 15; index += 1) {
        const angle = Math.PI * 2 * index / 15 + Phaser.Math.FloatBetween(-0.12, 0.12);
        const radius = 26 + index % 5 * 13;
        const baseX = Math.cos(angle) * radius;
        const baseY = Math.sin(angle) * radius * 0.34 + 22;
        const height = 34 + index % 6 * 13;
        pillars.lineStyle(index % 5 === 0 ? 5 : 2, index % 3 ? 0x7af36d : accent, index % 4 === 0 ? 0.82 : 0.58);
        pillars.beginPath();
        pillars.moveTo(baseX, baseY);
        pillars.lineTo(baseX + Phaser.Math.Between(-7, 7), baseY - height * 0.55);
        pillars.lineTo(baseX + Phaser.Math.Between(-5, 5), baseY - height);
        pillars.strokePath();
      }
      for (let index = 0; index < 10; index += 1) {
        const angle = Math.PI * 2 * index / 10 + 0.24;
        const ribbon = this.add.image(x + Math.cos(angle) * 76, y - 18 + Math.sin(angle) * 28, WIND_RIBBON_TEXTURE_KEY)
          .setOrigin(0.08, 0.5)
          .setRotation(angle + Math.PI * 0.52)
          .setScale(0.2 + index % 3 * 0.045, 0.1 + index % 2 * 0.035)
          .setTint(index % 3 ? 0x79ef6a : 0xffefa0)
          .setAlpha(0.82)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(index < 5 ? Math.max(2, y - 18) : y + 108 + index);
        this.tweens.add({
          targets: ribbon,
          x: x + Math.cos(angle + 0.38) * 108,
          y: y - 52 + Math.sin(angle + 0.38) * 42,
          rotation: angle + Math.PI * 0.82,
          scaleX: ribbon.scaleX * 1.55,
          alpha: 0,
          duration: 640 + index * 20,
          ease: "Cubic.easeOut",
          onComplete: () => ribbon.destroy()
        });
      }
      this.tweens.add({ targets: field, scaleX: 1.16, scaleY: 1.12, alpha: 0, duration: 720, ease: "Cubic.easeOut", onComplete: () => field.destroy() });
      this.tweens.add({ targets: orbit, angle: 58, scaleX: 1.2, scaleY: 0.48, alpha: 0, duration: 740, ease: "Cubic.easeOut", onComplete: () => orbit.destroy() });
      this.tweens.add({ targets: dome, scale: 1.14, angle: -18, alpha: 0, duration: 760, ease: "Cubic.easeOut", onComplete: () => dome.destroy() });
      this.tweens.add({ targets: pillars, y: y - 46, scaleY: 1.16, alpha: 0, duration: 680, ease: "Cubic.easeOut", onComplete: () => pillars.destroy() });
      this.spawnHealingMotes(x, y - 20, 68, 116, 780);
      if (healed > 0) this.showFloatingText(x, y - 130, `治疗 +${Math.round(healed)}`, { color: "#82ffd4", size: "22px", rise: 68 });
      else if (shieldGain > 0) this.showFloatingText(x, y - 130, `护盾 +${Math.round(shieldGain)}`, { color: "#aeeaff", size: "22px", rise: 68 });
    }

    spawnHealingMotes(x, y, count, spread, duration) {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.PI * 2 * index / count + Math.random() * 0.3;
        const distance = spread * (0.35 + Math.random() * 0.65);
        const texture = index % 7 === 0 ? WIND_LEAF_TEXTURE_KEY : WIND_MOTE_TEXTURE_KEY;
        const mote = this.add.image(x + Math.cos(angle) * 8, y + Math.sin(angle) * 5, texture)
          .setScale(texture === WIND_LEAF_TEXTURE_KEY ? 0.46 : 0.28 + Math.random() * 0.28)
          .setRotation(angle)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(y + 150);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance * 0.62 - 30 - Math.random() * 34,
          alpha: 0,
          angle: Phaser.Math.RadToDeg(angle) + 170,
          scale: 0.08,
          duration: duration * (0.75 + Math.random() * 0.4),
          ease: "Cubic.easeOut",
          onComplete: () => mote.destroy()
        });
      }
    }

    playLinaTornadoUltimate() {
      if (!this.actor?.active || this.isDead) return;
      const aim = normalizeVector((this.lastAimVector || directionVector(this.facing || DIRECTIONS[2])).x, (this.lastAimVector || directionVector(this.facing || DIRECTIONS[2])).y);
      const start = this.getActorFootCenter();
      const origin = { x: start.x + aim.x * 74, y: start.y + aim.y * 74 };
      const end = {
        x: clamp(origin.x + aim.x * LINA_TORNADO_RANGE, 80, this.worldWidth - 80),
        y: clamp(origin.y + aim.y * LINA_TORNADO_RANGE, 96, this.worldHeight - 80)
      };
      const tornado = this.createLinaTornadoVisual(origin.x, origin.y);
      const startedAt = this.time.now;
      let lastDamageAt = startedAt - LINA_TORNADO_TICK_MS;
      app.audio.ultimateWind();
      const timer = this.time.addEvent({
        delay: 32,
        loop: true,
        callback: () => {
          if (!tornado.active) return;
          const elapsed = this.time.now - startedAt;
          const progress = clamp(elapsed / LINA_TORNADO_DURATION, 0, 1);
          const eased = Phaser.Math.Easing.Sine.InOut(progress);
          const x = Phaser.Math.Linear(origin.x, end.x, eased);
          const y = Phaser.Math.Linear(origin.y, end.y, eased);
          tornado.setPosition(x, y).setDepth(y + 82);
          tornado.windBands.forEach((band, index) => band.setRotation(band.rotation + (index % 2 ? -0.2 : 0.24)));
          if (elapsed - tornado.lastMoteAt > 64) {
            tornado.lastMoteAt = elapsed;
            this.spawnTornadoMote(x, y);
          }
          const dealDamage = this.time.now - lastDamageAt >= LINA_TORNADO_TICK_MS;
          if (dealDamage) lastDamageAt = this.time.now;
          this.pullEnemiesIntoLinaTornado(x, y, dealDamage);
          if (progress >= 1) {
            timer.remove(false);
            this.tweens.add({
              targets: tornado,
              alpha: 0,
              scaleX: 0.55,
              scaleY: 1.16,
              duration: 260,
              ease: "Sine.easeIn",
              onComplete: () => tornado.destroy()
            });
            this.isCasting = false;
            this.isActionLocked = false;
            this.actor?.setTexture(app.profile.characterId);
            this.resetActorVisualScale();
            if (!this.isDead) this.returnToBaseLoop();
          }
        }
      });
      this.time.delayedCall(180, () => app.audio.ultimateBurst());
    }

    castLaodengImpactPunch(charged, berserk) {
      if (charged) {
        const token = ++this.laodengHeavyToken;
        const aim = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
        const dashVector = normalizeVector(aim.x, aim.y);
        const dashDuration = 340;
        const dashDistance = MAP_TILE_SIZE * 3;
        this.isHeavyDashing = true;
        this.isActionLocked = true;
        this.actor.body.setVelocity(
          dashVector.x * dashDistance / (dashDuration / 1000),
          dashVector.y * dashDistance / (dashDuration / 1000)
        );
        [0, 72, 144, 216, 288].forEach((delay, index) => this.time.delayedCall(delay, () => {
          if (!this.actor?.active || this.isDead || this.laodengHeavyToken !== token) return;
          this.actor.play("laodeng-attack-once", true);
          const spread = Phaser.Math.FloatBetween(-0.12, 0.12);
          const punchResult = this.dealMeleeDamage({
            damageMultiplier: 0.5,
            charged: true,
            berserk,
            angleOffset: spread,
            reach: 64,
            visualLead: berserk ? 54 : 38,
            radius: 58,
            allowComboHit: true,
            knockback: index === 4
          });
          if (berserk && punchResult?.hitSomething) {
            this.triggerLaodengBerserkExplosion(punchResult.hitX, punchResult.hitY, index);
          }
          if (index === 4) this.cameras.main.shake(72, 0.0022);
        }));
        this.time.delayedCall(dashDuration, () => {
          if (this.laodengHeavyToken !== token) return;
          if (this.actor?.body) this.actor.body.setVelocity(0, 0);
          this.isHeavyDashing = false;
          this.isActionLocked = false;
          this.isCasting = false;
          this.actor?.setTexture("laodeng");
          this.resetActorVisualScale();
          if (!this.isDead) this.returnToBaseLoop();
        });
        return;
      }
      this.dealMeleeDamage({
        damageMultiplier: 1,
        charged: false,
        berserk,
        reach: 70,
        radius: 58,
        knockback: false
      });
    }

    launchLaodengSixWayShockwaves(originX, originY, dealDamage = true, berserk = false) {
      const range = MAP_TILE_SIZE * 5;
      const hitTargets = new Set();
      const baseDamage = Math.round(
        Number(app.profile?.attackPower || MELEE.damage)
        * 1.55
        * (berserk ? LAODENG_BERSERK_DAMAGE_MULTIPLIER : 1)
      );
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        const direction = { x: Math.cos(angle), y: Math.sin(angle) };
        const wave = this.createLaodengShockwaveVisual(originX, originY, angle, berserk);
        const hitAlongPath = () => {
          if (!dealDamage) return;
          (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
            if (!slime?.active || hitTargets.has(slime) || ["dead", "vanish", "emerging"].includes(slime.state)) return;
            const distance = Phaser.Math.Distance.Between(wave.x, wave.y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y);
            if (distance > 52 + LEAF_SLIME_HIT_RADIUS) return;
            hitTargets.add(slime);
            this.playLeafSlimeHit(slime, baseDamage, {
              kind: "physical",
              charged: true,
              energyGain: ENERGY_MELEE_HIT_GAIN
            });
            if (slime.rank === "boss" || !slime.active || !slime.body?.enable) return;
            const token = (slime.impactPunchToken || 0) + 1;
            slime.impactPunchToken = token;
            slime.skillKnockbackUntil = this.time.now + 202;
            slime.body.setVelocity(direction.x * 520, direction.y * 520);
            this.time.delayedCall(190, () => {
              if (slime.active && slime.body?.enable && slime.impactPunchToken === token) slime.body.setVelocity(0, 0);
            });
          });
        };
        this.tweens.add({
          targets: wave,
          x: originX + direction.x * range,
          y: originY + direction.y * range,
          scale: { from: 0.48, to: berserk ? 1.22 : 1.08 },
          duration: 560,
          ease: "Cubic.easeOut",
          onUpdate: () => {
            wave.setDepth(wave.y + 74);
            hitAlongPath();
          },
          onComplete: () => wave.destroy()
        });
      }
      this.emitPhysicalSparks(originX, originY, 30, 0xff6a28);
      this.cameras.main.shake(92, 0.003);
      app.audio.punchSwing(true, berserk);
    }

    playBerserkActivationVisual(position = this.actor) {
      if (!position) return;
      const x = Number(position.x) || 0;
      const y = Number(position.y) || 0;
      if (position === this.actor) this.berserkAura?.destroy();
      const aura = this.add.container(x, y - 48).setDepth(y - 14);
      const outerGlow = this.add.ellipse(0, 48, 204, 66, 0x8f1f25, 0.3)
        .setStrokeStyle(3, 0xff5b28, 0.54)
        .setBlendMode(Phaser.BlendModes.ADD);
      const innerGlow = this.add.ellipse(0, 48, 108, 34, 0xff7a28, 0.38)
        .setStrokeStyle(2, 0xfff0a0, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
      const flameBlades = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 5; index += 1) {
        const angle = -Math.PI / 2 + index / 5 * Math.PI * 2;
        const tangent = angle + Math.PI / 2;
        const baseRadius = 24;
        const tipRadius = 92 + (index % 2) * 18;
        const baseX = Math.cos(angle) * baseRadius;
        const baseY = 48 + Math.sin(angle) * baseRadius * 0.38;
        const tipX = Math.cos(angle) * tipRadius;
        const tipY = 48 + Math.sin(angle) * tipRadius * 0.54;
        const width = 17 + (index % 2) * 5;
        flameBlades.fillStyle(index % 2 ? 0xff4a20 : 0xff8a28, 0.72);
        flameBlades.fillPoints([
          { x: baseX + Math.cos(tangent) * width, y: baseY + Math.sin(tangent) * width * 0.45 },
          { x: tipX, y: tipY },
          { x: baseX - Math.cos(tangent) * width, y: baseY - Math.sin(tangent) * width * 0.45 },
          { x: baseX - Math.cos(angle) * 8, y: baseY - Math.sin(angle) * 4 }
        ], true);
        flameBlades.lineStyle(3, 0xffe06b, 0.88);
        flameBlades.lineBetween(baseX, baseY, tipX, tipY);
      }
      const smoke = this.add.particles(0, 48, LAODENG_SMOKE_TEXTURE_KEY, {
        lifespan: { min: 420, max: 760 },
        frequency: 68,
        quantity: 2,
        speed: { min: 18, max: 76 },
        angle: { min: 0, max: 360 },
        gravityY: -26,
        scale: { start: 0.34, end: 1.1 },
        alpha: { start: 0.46, end: 0 },
        tint: [0x8d4e3a, 0x6e4139, 0x49363a],
        blendMode: "NORMAL"
      });
      aura.add([outerGlow, smoke, flameBlades, innerGlow]);
      this.emitPhysicalSparks(x, y - 42, 46, 0xff6038);
      this.tweens.add({ targets: outerGlow, scale: { from: 0.72, to: 1.18 }, alpha: { from: 0.34, to: 0.08 }, duration: 390, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: innerGlow, scale: { from: 0.8, to: 1.3 }, alpha: { from: 0.68, to: 0.14 }, duration: 250, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: flameBlades, angle: 26, scale: { from: 0.72, to: 1.04 }, alpha: { from: 0.9, to: 0.46 }, duration: 480, yoyo: true, repeat: -1 });
      aura.pulseTimer = this.time.addEvent({ delay: 96, loop: true, callback: () => this.spawnBerserkGroundPulse(aura) });
      aura.once("destroy", () => aura.pulseTimer?.remove(false));
      for (let index = 0; index < 3; index += 1) this.time.delayedCall(index * 90, () => this.spawnBerserkGroundPulse(aura));
      if (position === this.actor) this.berserkAura = aura;
      else this.time.delayedCall(LAODENG_BERSERK_DURATION, () => aura.destroy());
    }

    spawnBerserkGroundPulse(aura) {
      if (!aura?.active) return;
      const pulse = this.add.container(0, 48);
      const ring = this.add.ellipse(0, 0, 164, 52, 0xb91b16, 0.18)
        .setStrokeStyle(4, 0xff8a2d, 0.82)
        .setBlendMode(Phaser.BlendModes.ADD);
      const petalImage = this.textures.exists(LAODENG_BERSERK_PETAL_TEXTURE_KEY)
        ? this.add.image(0, 0, LAODENG_BERSERK_PETAL_TEXTURE_KEY).setOrigin(0.5, 0.54).setAlpha(0.92)
        : null;
      const petals = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2 + (index % 2 ? 0.12 : -0.08);
        const inner = 35 + (index % 3) * 5;
        const outer = 104 + (index % 4) * 10;
        const flatten = 0.42;
        const tangent = angle + Math.PI / 2;
        const width = 7 + (index % 3) * 2;
        const baseX = Math.cos(angle) * inner;
        const baseY = Math.sin(angle) * inner * flatten;
        const tipX = Math.cos(angle) * outer;
        const tipY = Math.sin(angle) * outer * flatten;
        petals.fillStyle(index % 3 ? 0xff4f1e : 0xffc04b, index % 3 ? 0.58 : 0.84);
        petals.fillTriangle(
          baseX + Math.cos(tangent) * width,
          baseY + Math.sin(tangent) * width * flatten,
          tipX,
          tipY,
          baseX - Math.cos(tangent) * width,
          baseY - Math.sin(tangent) * width * flatten
        );
      }
      if (petalImage) petals.setVisible(false);
      pulse.add([ring, ...(petalImage ? [petalImage] : []), petals]);
      aura.add(pulse);
      pulse.setScale(0.26).setAlpha(0.96).setAngle(Phaser.Math.Between(-12, 12));
      this.tweens.add({
        targets: pulse,
        scaleX: 1.42,
        scaleY: 1.22,
        angle: pulse.angle + 20,
        alpha: 0,
        duration: 620,
        ease: "Cubic.easeOut",
        onComplete: () => pulse.destroy()
      });
    }

    createLinaTornadoVisual(x, y) {
      const container = this.add.container(x, y).setDepth(y + 82);
      container.windBands = [];
      container.lastMoteAt = 0;
      const glow = this.add.ellipse(0, 0, 112, 34, 0x63dfcb, 0.18)
        .setStrokeStyle(3, 0xc8fff1, 0.5)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      for (let bandIndex = 0; bandIndex < 5; bandIndex += 1) {
        const band = this.add.graphics();
        const baseY = -bandIndex * 28;
        const width = 84 - bandIndex * 10;
        band.lineStyle(bandIndex < 2 ? 6 : 4, bandIndex % 2 ? 0x54d7c4 : 0xc7fff3, 0.78 - bandIndex * 0.08);
        band.beginPath();
        for (let step = 0; step <= 18; step += 1) {
          const angle = step / 18 * Math.PI * 2;
          const px = Math.cos(angle) * width * (0.42 + bandIndex * 0.025);
          const py = baseY + Math.sin(angle) * (12 + bandIndex * 1.5) - Math.cos(angle * 2) * 3;
          if (step === 0) band.moveTo(px, py);
          else band.lineTo(px, py);
        }
        band.strokePath();
        container.windBands.push(band);
        container.add(band);
      }
      const core = this.add.graphics();
      core.fillStyle(0x9effed, 0.17);
      core.fillTriangle(-42, 4, 42, 4, 8, -142);
      core.lineStyle(3, 0x72e8d6, 0.35);
      core.lineBetween(-34, 0, 2, -142);
      core.lineBetween(34, 0, 8, -142);
      container.addAt(core, 0);
      this.tweens.add({ targets: glow, scaleX: 1.24, scaleY: 0.72, alpha: 0.06, duration: 150, yoyo: true, repeat: -1 });
      return container;
    }

    spawnTornadoMote(x, y) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 32 + Math.random() * 48;
      const texture = Math.random() < 0.24 ? WIND_LEAF_TEXTURE_KEY : WIND_MOTE_TEXTURE_KEY;
      const mote = this.add.image(x + Math.cos(angle) * radius, y - Math.random() * 130, texture)
        .setScale(texture === WIND_LEAF_TEXTURE_KEY ? 0.48 : 0.38 + Math.random() * 0.26)
        .setRotation(angle)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(y + 90);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle + Math.PI * 1.2) * radius * 0.35,
        y: mote.y - 34 - Math.random() * 28,
        angle: Phaser.Math.RadToDeg(angle) + 230,
        alpha: 0,
        duration: 300,
        ease: "Sine.easeIn",
        onComplete: () => mote.destroy()
      });
    }

    pullEnemiesIntoLinaTornado(x, y, dealDamage) {
      const damage = Math.round(Number(app.profile.magicPower || 22) * LINA_TORNADO_DAMAGE_MULTIPLIER);
      (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) return;
        const dx = x - slime.x;
        const dy = y - (slime.y + LEAF_SLIME_HIT_OFFSET_Y);
        const distance = Math.hypot(dx, dy);
        if (distance > LINA_TORNADO_PULL_RADIUS + LEAF_SLIME_HIT_RADIUS) return;
        if (dealDamage && this.time.now - Number(slime.lastLinaTornadoHitAt || 0) >= LINA_TORNADO_TICK_MS - 24) {
          slime.lastLinaTornadoHitAt = this.time.now;
          this.playLeafSlimeHit(slime, damage, { kind: "magic", noEnergyGain: true });
        }
        if (!slime.active || !slime.body?.enable) return;
        const unit = distance > 1 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
        const pull = 230 + (1 - clamp(distance / LINA_TORNADO_PULL_RADIUS, 0, 1)) * 390;
        const tangent = distance > 34 ? 115 : 0;
        slime.tornadoPullUntil = this.time.now + 72;
        slime.skillKnockbackUntil = this.time.now + 84;
        slime.body.setVelocity(unit.x * pull - unit.y * tangent, unit.y * pull + unit.x * tangent);
      });
    }

    dealMeleeDamage(options = {}) {
      if (!this.actor || this.isDead) return;
      const direction = this.facing || DIRECTIONS[2];
      const vec = directionVector(direction);
      const angleOffset = Number(options.angleOffset) || 0;
      const baseAngle = Math.atan2(vec.y, vec.x) + angleOffset;
      const attackVec = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) };
      this.lastAimVector = attackVec;
      const reach = Number(options.reach) || MELEE.reach;
      const hitX = this.actor.x + attackVec.x * reach;
      const hitY = this.actor.y - 44 + attackVec.y * reach;
      const visualLead = Math.max(0, Number(options.visualLead) || 0);
      const visualX = hitX + attackVec.x * visualLead;
      const visualY = hitY + attackVec.y * visualLead;
      const angle = baseAngle + (options.reverseSlash ? Math.PI : 0);
      const isLaodeng = app.profile.characterId === "laodeng";
      if (!options.silentVisual) {
        if (isLaodeng) this.playImpactPunchVisual(visualX, visualY, angle, !!options.charged, !!options.berserk);
        else this.flashSlash(hitX, hitY, angle, this.actor.y + 20, !!options.charged);
      }
      this.broadcastCombatEvent("melee", { x: isLaodeng ? visualX : hitX, y: isLaodeng ? visualY : hitY, aimX: Math.cos(angle), aimY: Math.sin(angle), charged: !!options.charged, berserk: !!options.berserk, radius: Number(options.radius) || MELEE.radius });
      if (isLaodeng) app.audio.punchSwing(!!options.charged, !!options.berserk);
      else app.audio.swordSwing(!!options.charged);
      let hitSomething = false;
      let dealtDamage = 0;
      const berserk = !!options.berserk || (app.profile.characterId === "laodeng" && this.time.now < this.berserkUntil);
      const radius = Number(options.radius) || (berserk ? 104 : MELEE.radius);
      const baseDamage = Math.round(
        Number(app.profile.attackPower || MELEE.damage)
        * (Number(options.damageMultiplier) || 1)
        * (berserk ? LAODENG_BERSERK_DAMAGE_MULTIPLIER : 1)
      );
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) continue;
        if (options.bossOnly && slime.rank !== "boss") continue;
        const distance = Phaser.Math.Distance.Between(hitX, hitY, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y);
        if (distance <= radius + LEAF_SLIME_HIT_RADIUS) {
          dealtDamage += this.playLeafSlimeHit(slime, baseDamage, {
            kind: "physical",
            charged: !!options.charged,
            energyGain: options.noEnergyGain ? 0 : ENERGY_MELEE_HIT_GAIN,
            noEnergyGain: !!options.noEnergyGain,
            allowComboHit: !!options.allowComboHit
          }) || 0;
          if (options.knockback && slime.rank !== "boss" && slime.active && slime.body?.enable) {
            const dx = slime.x - this.actor.x;
            const dy = slime.y + LEAF_SLIME_HIT_OFFSET_Y - (this.actor.y - 44);
            const unit = normalizeVector(dx || vec.x, dy || vec.y);
            const token = (slime.impactPunchToken || 0) + 1;
            slime.impactPunchToken = token;
            slime.skillKnockbackUntil = this.time.now + 180;
            slime.body.setVelocity(unit.x * 460, unit.y * 460);
            this.time.delayedCall(170, () => {
              if (slime.active && slime.body?.enable && slime.impactPunchToken === token) slime.body.setVelocity(0, 0);
            });
          }
          hitSomething = true;
        }
      }
      if (!options.bossOnly && app.boss.active && app.boss.hp > 0 && this.bossSprite?.visible) {
        const bossDistance = Phaser.Math.Distance.Between(hitX, hitY, app.boss.x, app.boss.y - 60);
        if (bossDistance < 96 + radius) {
          this.applyBossDamage(baseDamage);
          hitSomething = true;
        }
      }
      if (berserk && dealtDamage > 0) this.applyLifesteal(dealtDamage * 0.2);
      if (hitSomething) this.cameras.main.shake(60, 0.0015);
      return { hitSomething, hitX, hitY, angle, dealtDamage };
    }

    applyLifesteal(amount) {
      if (!app.profile || amount <= 0) return;
      const before = Number(app.profile.hp || 0);
      app.profile.hp = Math.min(Number(app.profile.maxHp || before), before + Math.max(1, Math.round(amount)));
      const healed = app.profile.hp - before;
      if (healed <= 0) return;
      this.showFloatingText(this.actor.x, this.actor.y - 116, `吸血 +${healed}`, { color: "#85f2b1", size: "16px", rise: 42 });
      renderHud();
    }

    castChainLightning() {
      if (!this.actor || this.isDead) return;
      const start = { x: this.actor.x, y: this.actor.y - 52 };
      const activeEnemies = (this.leafSlimes?.getChildren?.() || [])
        .filter(slime => slime?.active && !["dead", "vanish", "emerging"].includes(slime.state));
      const primary = activeEnemies
        .map(slime => ({ slime, distance: Phaser.Math.Distance.Between(start.x, start.y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y) }))
        .filter(item => item.distance <= ZHIXIA_LIGHTNING_RANGE)
        .sort((a, b) => a.distance - b.distance)
        .at(0)?.slime;
      if (!primary) {
        const aim = this.lastAimVector || directionVector(this.facing || DIRECTIONS[2]);
        const length = Math.hypot(aim.x, aim.y) || 1;
        const end = {
          x: start.x + aim.x / length * MAP_TILE_SIZE * 2.2,
          y: start.y + aim.y / length * MAP_TILE_SIZE * 2.2
        };
        this.drawLightningArc(start.x, start.y, end.x, end.y, { intensity: 1.08, style: "chain" });
        this.renderChainLightningHit(end.x, end.y, 42);
        this.broadcastCombatEvent("chainLightning", { x: start.x, y: start.y, points: [start, end] });
        app.audio.ultimateBurst();
        return;
      }

      const chain = [primary];
      const visited = new Set([primary]);
      while (chain.length < 3) {
        const current = chain[chain.length - 1];
        const next = activeEnemies
          .filter(slime => !visited.has(slime) && slime?.active)
          .map(slime => ({
            slime,
            distance: Phaser.Math.Distance.Between(
              current.x,
              current.y + LEAF_SLIME_HIT_OFFSET_Y,
              slime.x,
              slime.y + LEAF_SLIME_HIT_OFFSET_Y
            )
          }))
          .filter(item => item.distance <= ZHIXIA_LIGHTNING_REFRACT_RANGE)
          .sort((a, b) => a.distance - b.distance)[0]?.slime;
        if (!next) break;
        visited.add(next);
        chain.push(next);
      }

      const multipliers = [1, 0.8, 0.5];
      this.broadcastCombatEvent("chainLightning", {
        x: start.x,
        y: start.y,
        points: [start, ...chain.map(slime => ({ x: slime.x, y: slime.y + LEAF_SLIME_HIT_OFFSET_Y }))]
      });
      let previous = null;
      chain.forEach((slime, index) => {
        const target = { x: slime.x, y: slime.y + LEAF_SLIME_HIT_OFFSET_Y };
        const source = previous || start;
        previous = target;
        this.time.delayedCall(index * 105, () => {
          if (!slime?.active) return;
          this.drawLightningArc(source.x, source.y, target.x, target.y, { intensity: 1.12 - index * 0.12, style: "chain" });
          if (!index) {
            this.time.delayedCall(38, () => this.drawLightningArc(source.x, source.y, target.x, target.y, { intensity: 0.62, style: "chain" }));
          }
          this.renderChainLightningHit(target.x, target.y, 54 - index * 5);
          const damage = Math.round(Number(app.profile.magicPower || 22) * multipliers[index]);
          this.playLeafSlimeHit(slime, damage, { kind: "magic", charged: true });
        });
      });
      app.audio.ultimateBurst();
    }

    drawLightningArc(x1, y1, x2, y2, options = {}) {
      const intensity = Number(options.intensity) || 1;
      const chainStyle = options.style === "chain";
      const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
      const segments = Math.max(6, Math.ceil(distance / (chainStyle ? 22 : 28)));
      const points = [{ x: x1, y: y1 }];
      for (let index = 1; index < segments; index += 1) {
        const t = index / segments;
        const taper = Math.sin(Math.PI * t);
        const jitter = chainStyle ? 8 : 14;
        points.push({
          x: Phaser.Math.Linear(x1, x2, t) + Phaser.Math.Between(-jitter, jitter) * taper * intensity,
          y: Phaser.Math.Linear(y1, y2, t) + Phaser.Math.Between(-jitter, jitter) * taper * intensity
        });
      }
      points.push({ x: x2, y: y2 });
      const depth = Math.max(y1, y2) + 70;
      const ribbon = chainStyle ? null : this.add.image((x1 + x2) / 2, (y1 + y2) / 2, LIGHTNING_RIBBON_TEXTURE_KEY)
          .setRotation(Math.atan2(y2 - y1, x2 - x1))
          .setScale(Math.max(0.12, distance / 256), 0.66 * intensity)
          .setAlpha(0.9)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(depth + 2);
      const underlay = this.add.graphics().setDepth(depth);
      const body = this.add.graphics().setDepth(depth + 1);
      const bloom = this.add.graphics().setDepth(depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.graphics().setDepth(depth + 3).setBlendMode(Phaser.BlendModes.ADD);
      const filament = chainStyle ? this.add.graphics().setDepth(depth + 3).setBlendMode(Phaser.BlendModes.ADD) : null;
      const strokePath = (graphics, path, width, color, alpha) => {
        graphics.lineStyle(width * intensity, color, alpha);
        graphics.beginPath();
        graphics.moveTo(path[0].x, path[0].y);
        path.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      strokePath(underlay, points, chainStyle ? 11 : 27, chainStyle ? 0x06133f : 0x2a124f, chainStyle ? 0.5 : 0.4);
      strokePath(body, points, chainStyle ? 4.5 : 14, chainStyle ? 0x145dff : 0x7138c7, chainStyle ? 0.98 : 0.96);
      strokePath(bloom, points, chainStyle ? 3.2 : 8, chainStyle ? 0x42cfff : 0xc14fe2, chainStyle ? 0.86 : 0.72);
      strokePath(core, points, chainStyle ? 1.1 : 2.6, chainStyle ? 0xf2fdff : 0xe8d7ff, 0.98);
      if (filament) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy) || 1;
        const normal = { x: -dy / length, y: dx / length };
        [-1, 1].forEach((side, strandIndex) => {
          const offset = (7 + strandIndex * 5) * side * intensity;
          const strand = points.map((point, index) => {
            const taper = Math.sin(Math.PI * index / (points.length - 1));
            return {
              x: point.x + normal.x * offset * taper + Phaser.Math.Between(-2, 2),
              y: point.y + normal.y * offset * taper + Phaser.Math.Between(-2, 2)
            };
          });
          strokePath(filament, strand, strandIndex ? 0.9 : 1.15, strandIndex ? 0x63dfff : 0xb7f3ff, strandIndex ? 0.68 : 0.82);
        });
      }
      const branchRatios = chainStyle ? [0.28, 0.58, 0.8] : [0.22, 0.4, 0.6, 0.78];
      branchRatios.map(ratio => Math.floor(segments * ratio)).forEach((pointIndex, branchIndex) => {
        const point = points[pointIndex];
        const direction = branchIndex % 2 ? -1 : 1;
        const branch = [
          point,
          { x: point.x + Phaser.Math.Between(chainStyle ? 10 : 16, chainStyle ? 20 : 28) * direction, y: point.y + Phaser.Math.Between(chainStyle ? -16 : -24, chainStyle ? 16 : 24) },
          { x: point.x + Phaser.Math.Between(chainStyle ? 22 : 30, chainStyle ? 36 : 48) * direction, y: point.y + Phaser.Math.Between(chainStyle ? -28 : -38, chainStyle ? 28 : 38) }
        ];
        [
          { graphics: underlay, width: chainStyle ? 3.5 : 7, color: chainStyle ? 0x06133f : 0x2a124f, alpha: 0.4 },
          { graphics: body, width: chainStyle ? 1.7 : 3.6, color: chainStyle ? 0x278cff : 0x8c3ed0, alpha: 0.92 },
          { graphics: core, width: chainStyle ? 0.65 : 1.1, color: chainStyle ? 0xdffbff : 0xd7baff, alpha: 0.9 }
        ].forEach(style => {
          strokePath(style.graphics, branch, style.width, style.color, style.alpha);
        });
      });
      if (options.emit !== false) this.emitLightningBurst(x2, y2, Math.round((chainStyle ? 7 : 14) * intensity), chainStyle ? "electricBlue" : "arcane");
      [underlay, body, bloom, core, filament].filter(Boolean).forEach((layer, index) => this.tweens.add({
        targets: layer,
        alpha: 0,
        delay: index === 0 ? 70 : 0,
        duration: 150 + index * 18,
        ease: "Quad.easeOut",
        onComplete: () => layer.destroy()
      }));
      if (ribbon) this.tweens.add({ targets: ribbon, alpha: 0, scaleY: ribbon.scaleY * 0.28, duration: 165, ease: "Quad.easeOut", onComplete: () => ribbon.destroy() });
      if (options.echo !== false) {
        this.time.delayedCall(34, () => this.drawLightningArc(x1, y1, x2, y2, {
          intensity: intensity * 0.7,
          style: options.style,
          echo: false,
          emit: false
        }));
      }
    }

    emitLightningBurst(x, y, quantity = 18, palette = "arcane") {
      if (!this.textures.exists(LIGHTNING_SPARK_TEXTURE_KEY)) return;
      const electricBlue = palette === "electricBlue";
      const sparks = this.add.particles(x, y, LIGHTNING_SPARK_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 190, max: 460 },
        speed: { min: 110, max: 340 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 180 },
        scale: { start: 0.72, end: 0 },
        alpha: { start: 0.96, end: 0 },
        tint: electricBlue ? [0xffffff, 0xbfefff, 0x43c8ff, 0x1767ff] : [0x6a32bd, 0xc246dc, 0x62d8d1, 0xffc95d],
        blendMode: electricBlue ? "ADD" : "NORMAL"
      }).setDepth(y + 118);
      sparks.explode(quantity, 0, 0);
      const motes = this.add.particles(x, y, LIGHTNING_MOTE_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 260, max: 620 },
        speed: { min: 45, max: 170 },
        angle: { min: 0, max: 360 },
        gravityY: -55,
        scale: { start: 0.52, end: 0 },
        alpha: { start: 0.78, end: 0 },
        tint: electricBlue ? [0xe9fbff, 0x7edfff, 0x287dff, 0x0b35b7] : [0x6e35b8, 0xb84bd0, 0x63cfc9, 0xf4b95d],
        blendMode: electricBlue ? "ADD" : "NORMAL"
      }).setDepth(y + 116);
      motes.explode(Math.max(8, Math.round(quantity * 0.65)), 0, 0);
      this.time.delayedCall(720, () => {
        sparks.destroy();
        motes.destroy();
      });
    }

    renderLightningImpact(x, y, radius, options = {}) {
      const quantity = Number(options.quantity) || 24;
      const crackCount = Math.max(3, Number(options.crackCount) || 10);
      const splashCount = Math.max(3, Number(options.splashCount) || 9);
      const electricBlue = options.palette === "electricBlue";
      const showGround = options.ground !== false;
      const groundY = Number.isFinite(options.groundY) ? Number(options.groundY) : y + 56;
      const groundDepth = groundY - 76;
      const groundShadow = showGround ? this.add.graphics().setPosition(x, groundY).setDepth(groundDepth) : null;
      const groundCharge = showGround
        ? this.add.graphics().setPosition(x, groundY).setDepth(groundDepth + 1).setBlendMode(Phaser.BlendModes.ADD)
        : null;
      const splashArcs = this.add.graphics().setDepth(showGround ? groundDepth + 5 : y + 126);
      const drawPath = (graphics, points, width, color, alpha) => {
        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      if (showGround) {
        for (let index = 0; index < crackCount; index += 1) {
          let angle = index / crackCount * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
          const steps = Phaser.Math.Between(5, 8);
          const targetLength = radius * Phaser.Math.FloatBetween(0.95, 1.8);
          const points = [{ x: Phaser.Math.Between(-4, 4), y: Phaser.Math.Between(-2, 2) }];
          for (let step = 1; step <= steps; step += 1) {
            angle += Phaser.Math.FloatBetween(-0.28, 0.28);
            const previous = points[points.length - 1];
            const stride = targetLength / steps * Phaser.Math.FloatBetween(0.72, 1.2);
            points.push({
              x: previous.x + Math.cos(angle) * stride,
              y: previous.y + Math.sin(angle) * stride * 0.42
            });
          }
          drawPath(groundShadow, points, index % 3 === 0 ? 9 : 6, electricBlue ? 0x071a52 : 0x251a2d, 0.58);
          drawPath(groundShadow, points, index % 3 === 0 ? 4 : 3, electricBlue ? 0x123b8f : 0x4a315f, 0.76);
          drawPath(groundCharge, points, index % 3 === 0 ? 2.2 : 1.4, electricBlue ? (index % 2 ? 0xe4fbff : 0x52cfff) : (index % 2 ? 0xa746d1 : 0x7d5be0), 0.94);
          [2, Math.floor(steps * 0.62)].forEach((branchStep, branchIndex) => {
            if (!points[branchStep] || (index + branchIndex) % 2) return;
            const root = points[branchStep];
            const side = (index + branchIndex) % 4 < 2 ? -1 : 1;
            const branchAngle = angle + side * Phaser.Math.FloatBetween(0.65, 1.05);
            const branch = [
              root,
              { x: root.x + Math.cos(branchAngle) * radius * 0.28, y: root.y + Math.sin(branchAngle) * radius * 0.12 },
              { x: root.x + Math.cos(branchAngle + side * 0.18) * radius * 0.52, y: root.y + Math.sin(branchAngle + side * 0.18) * radius * 0.23 }
            ];
            drawPath(groundShadow, branch, 4, electricBlue ? 0x071b4f : 0x261a30, 0.52);
            drawPath(groundCharge, branch, 1.1, electricBlue ? 0x9cecff : 0xba5be0, 0.78);
          });
        }
      }
      for (let index = 0; index < splashCount; index += 1) {
        const angle = index / splashCount * Math.PI * 2 + Phaser.Math.FloatBetween(-0.24, 0.24);
        const first = {
          x: x + Math.cos(angle + 0.2) * radius * 0.45,
          y: y + Math.sin(angle + 0.2) * radius * 0.45
        };
        const end = {
          x: x + Math.cos(angle) * radius * Phaser.Math.FloatBetween(1.2, 2.1),
          y: y + Math.sin(angle) * radius * Phaser.Math.FloatBetween(0.8, 1.45)
        };
        const arc = [{ x, y }, first, end];
        drawPath(splashArcs, arc, 7, electricBlue ? 0x062e91 : 0x34165f, 0.28);
        drawPath(splashArcs, arc, 2.2, electricBlue ? (index % 3 ? 0xf1fdff : 0x43cfff) : (index % 3 ? 0xb84bd4 : 0x65d6d1), 0.94);
      }
      const impactGlow = this.add.star(x, y, 8, radius * 0.12, radius * 0.5, electricBlue ? 0x1a7dff : 0x6d2bb0, electricBlue ? 0.78 : 0.58)
        .setDepth(y + 128);
      const impactCore = this.add.star(x, y, 6, radius * 0.08, radius * 0.28, electricBlue ? 0xf7feff : 0xd16ce8, 0.94)
        .setDepth(y + 130)
        .setBlendMode(Phaser.BlendModes.ADD);
      const impactPool = electricBlue && showGround
        ? this.add.ellipse(x, groundY, radius * 2.7, radius * 0.78, 0x2faaff, 0.3)
          .setStrokeStyle(4, 0xbef5ff, 0.92)
          .setDepth(groundDepth + 2)
          .setBlendMode(Phaser.BlendModes.ADD)
        : null;
      const impactInnerRing = electricBlue && showGround
        ? this.add.ellipse(x, groundY, radius * 1.72, radius * 0.42, 0x67dcff, 0.18)
          .setStrokeStyle(2.4, 0xf4feff, 0.96)
          .setDepth(groundDepth + 3)
          .setBlendMode(Phaser.BlendModes.ADD)
        : null;
      const impactSplash = electricBlue && showGround
        ? this.add.graphics().setPosition(x, groundY).setDepth(groundDepth + 4).setBlendMode(Phaser.BlendModes.ADD)
        : null;
      if (impactSplash) {
        impactSplash.fillStyle(0xf5feff, 0.96);
        impactSplash.lineStyle(2, 0x58d7ff, 0.9);
        for (let index = 0; index < 9; index += 1) {
          const side = index < 4 ? -1 : 1;
          const distance = radius * (0.18 + Math.abs(index - 4) * 0.18);
          const height = radius * Phaser.Math.FloatBetween(0.18, index === 4 ? 0.5 : 0.38);
          const width = radius * Phaser.Math.FloatBetween(0.14, 0.28);
          impactSplash.fillTriangle(side * distance, 3, side * (distance + width * 0.45), -height, side * (distance + width), 5);
          impactSplash.beginPath();
          impactSplash.moveTo(side * distance, 3);
          impactSplash.lineTo(side * (distance + width * 0.45), -height);
          impactSplash.lineTo(side * (distance + width), 5);
          impactSplash.strokePath();
        }
      }
      this.emitLightningBurst(x, y, Math.round(quantity * 1.45), electricBlue ? "electricBlue" : "arcane");
      const spray = this.add.particles(x, y, LIGHTNING_SPARK_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 260, max: 640 },
        speed: { min: 150, max: 430 },
        angle: { min: 0, max: 360 },
        gravityY: 150,
        rotate: { min: 0, max: 240 },
        scale: { start: 0.66, end: 0 },
        alpha: { start: 0.96, end: 0 },
        tint: electricBlue ? [0xffffff, 0xb8efff, 0x3ccaff, 0x185dff] : [0x6f32bc, 0xc14bd7, 0x62d3cd, 0xffc65c],
        blendMode: electricBlue ? "ADD" : "NORMAL"
      }).setDepth(y + 122);
      spray.explode(Math.max(16, Math.round(quantity * 0.85)), 0, 0);
      this.time.delayedCall(760, () => spray.destroy());
      this.tweens.add({
        targets: [impactGlow, impactCore],
        scale: 1.75,
        alpha: 0,
        duration: 230,
        ease: "Quad.easeOut",
        onComplete: () => {
          impactGlow.destroy();
          impactCore.destroy();
        }
      });
      if (impactPool) {
        this.tweens.add({ targets: impactPool, scaleX: 1.28, scaleY: 0.62, alpha: 0, duration: 220, ease: "Quad.easeOut", onComplete: () => impactPool.destroy() });
      }
      if (impactInnerRing) {
        this.tweens.add({ targets: impactInnerRing, scaleX: 1.62, scaleY: 0.5, alpha: 0, duration: 190, ease: "Quad.easeOut", onComplete: () => impactInnerRing.destroy() });
      }
      if (impactSplash) {
        this.tweens.add({ targets: impactSplash, scaleX: 1.18, scaleY: 0.66, alpha: 0, duration: 180, ease: "Quad.easeOut", onComplete: () => impactSplash.destroy() });
      }
      this.tweens.add({
        targets: splashArcs,
        alpha: 0,
        duration: showGround ? 240 : 360,
        ease: "Quad.easeOut",
        onComplete: () => splashArcs.destroy()
      });
      if (showGround) {
        this.tweens.add({ targets: groundCharge, alpha: 0, duration: 240, ease: "Quad.easeOut", onComplete: () => groundCharge.destroy() });
        this.tweens.add({ targets: groundShadow, alpha: 0, duration: 340, ease: "Quad.easeOut", onComplete: () => groundShadow.destroy() });
      }
      const shake = Number(options.shake) || 0;
      if (shake > 0) this.cameras.main.shake(70, shake);
    }

    renderChainLightningHit(x, y, radius = 52) {
      const container = this.add.container(x, y).setDepth(y + 148);
      const aura = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const ring = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const shards = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const segmentAngles = [
        [-2.88, -2.18],
        [-1.8, -1.08],
        [-0.72, -0.1],
        [0.26, 1.0],
        [1.35, 2.18],
        [2.48, 2.92]
      ];
      segmentAngles.forEach(([start, end], index) => {
        const segmentRadius = radius * (index % 2 ? 0.94 : 1.04);
        aura.lineStyle(9, 0x095cff, 0.24);
        aura.beginPath();
        aura.arc(0, 0, segmentRadius, start, end, false);
        aura.strokePath();
        ring.lineStyle(index % 3 === 0 ? 3.2 : 2.2, index % 2 ? 0xe9fdff : 0x54d9ff, 0.96);
        ring.beginPath();
        ring.arc(0, 0, segmentRadius, start, end, false);
        ring.strokePath();
      });
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2 + Phaser.Math.FloatBetween(-0.13, 0.13);
        const inner = radius * Phaser.Math.FloatBetween(0.36, 0.52);
        const shoulder = radius * Phaser.Math.FloatBetween(0.68, 0.86);
        const outer = radius * Phaser.Math.FloatBetween(1.0, 1.36);
        const width = Phaser.Math.FloatBetween(0.06, 0.13);
        const point = (distance, offset = 0) => ({
          x: Math.cos(angle + offset) * distance,
          y: Math.sin(angle + offset) * distance
        });
        const left = point(inner, -width);
        const tip = point(outer);
        const right = point(shoulder, width);
        shards.fillStyle(index % 3 === 0 ? 0xf4feff : 0x43cfff, index % 3 === 0 ? 0.98 : 0.86);
        shards.fillTriangle(left.x, left.y, tip.x, tip.y, right.x, right.y);
        if (index % 2 === 0) {
          const sparkStart = point(radius * 1.12, width * 0.4);
          const sparkEnd = point(radius * Phaser.Math.FloatBetween(1.42, 1.7), -width * 0.3);
          aura.lineStyle(5, 0x0a67ff, 0.22);
          aura.lineBetween(sparkStart.x, sparkStart.y, sparkEnd.x, sparkEnd.y);
          ring.lineStyle(1.2, 0xcdf9ff, 0.88);
          ring.lineBetween(sparkStart.x, sparkStart.y, sparkEnd.x, sparkEnd.y);
        }
      }
      container.add([aura, ring, shards]);
      this.emitLightningBurst(x, y, 8, "electricBlue");
      this.tweens.add({
        targets: container,
        scale: 1.16,
        alpha: 0,
        angle: Phaser.Math.Between(-8, 8),
        duration: 230,
        ease: "Quad.easeOut",
        onComplete: () => container.destroy()
      });
      this.cameras.main.shake(42, 0.0008);
    }

    renderLightningOrbImpact(x, y) {
      const glow = this.add.star(x, y, 8, 3, 16, 0x176bff, 0.4)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(y + 88);
      const core = this.add.star(x, y, 6, 2, 8, 0xf1fdff, 0.98)
        .setDepth(y + 90)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.emitLightningBurst(x, y, 6, "electricBlue");
      this.tweens.add({
        targets: [glow, core],
        scale: 1.42,
        alpha: 0,
        duration: 180,
        ease: "Quad.easeOut",
        onComplete: () => {
          glow.destroy();
          core.destroy();
        }
      });
      this.cameras.main.shake(38, 0.00045);
    }

    drawLightningStrikeBolt(x, y, options = {}) {
      const topY = Math.max(0, y - 460);
      if (this.textures.exists(ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY)) {
        const scaleX = Phaser.Math.FloatBetween(0.3, 0.335);
        const scaleY = Math.max(0.4, (y - topY) / 540);
        const glow = this.add.image(x, y, ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY)
          .setOrigin(0.5, 1)
          .setScale(scaleX * 1.34, scaleY)
          .setTint(0x226dff)
          .setAlpha(0.3)
          .setDepth(y + 148)
          .setBlendMode(Phaser.BlendModes.ADD);
        const bolt = this.add.image(x, y, ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY)
          .setOrigin(0.5, 1)
          .setScale(scaleX, scaleY)
          .setAlpha(0.9)
          .setDepth(y + 149);
        const core = this.add.image(x, y, ZHIXIA_ULTIMATE_BOLT_TEXTURE_KEY)
          .setOrigin(0.5, 1)
          .setScale(scaleX * 0.46, scaleY)
          .setTint(0xe8fdff)
          .setAlpha(0.62)
          .setDepth(y + 150)
          .setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: [glow, core],
          alpha: { from: 0.24, to: 0.72 },
          x: { from: x - 1.5, to: x + 1.5 },
          duration: 32,
          yoyo: true,
          repeat: 1,
          ease: "Stepped"
        });
        this.tweens.add({
          targets: [glow, bolt, core],
          alpha: 0,
          delay: 130,
          duration: 130,
          ease: "Quad.easeOut",
          onComplete: () => {
            glow.destroy();
            bolt.destroy();
            core.destroy();
          }
        });
        return;
      }
      const offsets = [-5, 12, -17, -8, 19, 7, -24, -9, 15, 5, 0];
      const widths = [3, 7, 13, 8, 17, 10, 20, 13, 24, 17, 26];
      const points = offsets.map((offset, index) => ({
        x: x + offset + Phaser.Math.Between(-4, 4),
        y: Phaser.Math.Linear(topY, y, index / (offsets.length - 1))
      }));
      points[points.length - 1] = { x, y };
      const depth = y + 146;
      const underlay = this.add.graphics().setDepth(depth);
      const aura = this.add.graphics().setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      const body = this.add.graphics().setDepth(depth + 2).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.graphics().setDepth(depth + 3).setBlendMode(Phaser.BlendModes.ADD);
      const strokePath = (graphics, path, width, color, alpha) => {
        graphics.lineStyle(width, color, alpha);
        graphics.beginPath();
        graphics.moveTo(path[0].x, path[0].y);
        path.slice(1).forEach(point => graphics.lineTo(point.x, point.y));
        graphics.strokePath();
      };
      const makeRibbon = scale => {
        const left = [];
        const right = [];
        points.forEach((point, index) => {
          const previous = points[Math.max(0, index - 1)];
          const next = points[Math.min(points.length - 1, index + 1)];
          const dx = next.x - previous.x;
          const dy = next.y - previous.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const nx = -dy / length;
          const ny = dx / length;
          const width = widths[index] * scale;
          const leftScale = index % 3 === 0 ? 1.38 : index % 3 === 1 ? 0.72 : 1.04;
          const rightScale = index % 2 === 0 ? 0.78 : 1.24;
          left.push({ x: point.x + nx * width * leftScale, y: point.y + ny * width * leftScale });
          right.push({ x: point.x - nx * width * rightScale, y: point.y - ny * width * rightScale });
        });
        return [...left, ...right.reverse()];
      };
      underlay.fillStyle(0x02164f, 0.46);
      underlay.fillPoints(makeRibbon(1.78), true);
      aura.fillStyle(0x073dff, 0.38);
      aura.fillPoints(makeRibbon(1.38), true);
      body.fillStyle(0x0b83ff, 0.94);
      body.fillPoints(makeRibbon(1), true);
      core.fillStyle(0x61e8ff, 0.9);
      core.fillPoints(makeRibbon(0.42), true);
      strokePath(core, points, 2.6, 0xf8ffff, 1);
      points.slice(0, -1).forEach((point, index) => {
        if (index % 2 === 0) {
          const next = points[index + 1];
          underlay.lineStyle(widths[index] * 2.5, 0x052eaa, 0.22);
          underlay.lineBetween(point.x, point.y, next.x, next.y);
        }
      });
      [2, 4, 6, 8].forEach((pointIndex, branchIndex) => {
        const root = points[pointIndex];
        const side = branchIndex % 2 ? 1 : -1;
        const branch = [
          root,
          { x: root.x + side * Phaser.Math.Between(18, 31), y: root.y + Phaser.Math.Between(10, 28) },
          { x: root.x + side * Phaser.Math.Between(34, 58), y: root.y + Phaser.Math.Between(26, 56) }
        ];
        strokePath(underlay, branch, 10, 0x052678, 0.34);
        strokePath(aura, branch, 6, 0x0b68ff, 0.52);
        strokePath(body, branch, 3.2, 0x4cdbff, 0.92);
        strokePath(core, branch, 1.15, 0xf5ffff, 0.96);
      });
      [underlay, aura, body, core].forEach((layer, index) => this.tweens.add({
        targets: layer,
        alpha: 0,
        delay: index === 0 ? 70 : 18,
        duration: 210 + index * 15,
        ease: "Quad.easeOut",
        onComplete: () => layer.destroy()
      }));
    }

    renderZhixiaLightningCrown(x, groundY, radius) {
      const scale = radius / 92;
      const depth = groundY + 76;
      const scorch = this.add.graphics().setPosition(x, groundY).setDepth(depth - 2);
      const ring = this.add.graphics().setPosition(x, groundY).setDepth(depth - 1).setBlendMode(Phaser.BlendModes.ADD);
      const cracks = this.add.graphics().setPosition(x, groundY).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
      const spray = this.add.graphics().setPosition(x, groundY).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      scorch.fillStyle(0x031535, 0.2);
      scorch.fillEllipse(0, 8 * scale, 126 * scale, 26 * scale);
      ring.lineStyle(3 * scale, 0x2baeff, 0.76);
      ring.strokeEllipse(0, 5 * scale, 116 * scale, 24 * scale);
      ring.lineStyle(1.2 * scale, 0xe9ffff, 0.94);
      ring.strokeEllipse(0, 5 * scale, 82 * scale, 16 * scale);
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2 + Phaser.Math.FloatBetween(-0.14, 0.14);
        const squash = 0.42;
        const middle = Phaser.Math.Between(32, 50) * scale;
        const reach = Phaser.Math.Between(70, 118) * scale;
        const bend = Phaser.Math.Between(-12, 12) * scale;
        cracks.lineStyle(index % 3 === 0 ? 3.2 * scale : 1.7 * scale, index % 2 ? 0x4cd8ff : 0xf2ffff, 0.88);
        cracks.beginPath();
        cracks.moveTo(Math.cos(angle) * 17 * scale, Math.sin(angle) * 17 * scale * squash);
        cracks.lineTo(Math.cos(angle) * middle - Math.sin(angle) * bend, Math.sin(angle) * middle * squash + Math.cos(angle) * bend * 0.28);
        cracks.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach * squash);
        cracks.strokePath();
      }
      for (let index = 0; index < 18; index += 1) {
        const angle = Phaser.Math.FloatBetween(Math.PI * 1.06, Math.PI * 1.94);
        const start = Phaser.Math.Between(5, 24) * scale;
        const length = Phaser.Math.Between(32, 92) * scale;
        spray.lineStyle(index % 4 === 0 ? 3.4 * scale : 1.5 * scale, index % 3 ? 0x6feaff : 0xffffff, 0.9);
        spray.lineBetween(
          Math.cos(angle) * start,
          Math.sin(angle) * start * 0.54,
          Math.cos(angle) * length,
          Math.sin(angle) * length
        );
      }
      const sparks = this.add.particles(x, groundY - 4 * scale, LIGHTNING_SPARK_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 190, max: 420 },
        speed: { min: 110, max: 250 },
        angle: { min: 198, max: 342 },
        gravityY: 310,
        rotate: { min: -180, max: 180 },
        scale: { start: 0.54, end: 0 },
        alpha: { start: 0.94, end: 0 },
        tint: [0xffffff, 0xa7f3ff, 0x38bcff, 0x1257ee],
        blendMode: "ADD"
      }).setDepth(depth + 2);
      sparks.explode(68, 0, 0);
      const motes = this.add.particles(x, groundY - 4 * scale, LIGHTNING_MOTE_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 240, max: 520 },
        speed: { min: 46, max: 148 },
        angle: { min: 0, max: 360 },
        gravityY: 80,
        scale: { start: 0.36, end: 0 },
        alpha: { start: 0.86, end: 0 },
        tint: [0xffffff, 0xbff7ff, 0x47c8ff, 0x175cff],
        blendMode: "ADD"
      }).setDepth(depth + 2);
      motes.explode(42, 0, 0);
      [ring, cracks, spray].forEach((layer, index) => this.tweens.add({
        targets: layer,
        scaleX: 1.12 + index * 0.05,
        scaleY: 0.78 + index * 0.08,
        alpha: 0,
        duration: 260 + index * 40,
        ease: "Quad.easeOut",
        onComplete: () => layer.destroy()
      }));
      this.tweens.add({ targets: scorch, scaleX: 1.1, scaleY: 0.82, alpha: 0, duration: 420, ease: "Quad.easeOut", onComplete: () => scorch.destroy() });
      this.time.delayedCall(560, () => {
        sparks.destroy();
        motes.destroy();
      });
      this.cameras.main.shake(72, 0.0021);
    }

    playLightningStrikeVisual(x, y, radius) {
      const groundY = y + 58;
      this.drawLightningStrikeBolt(x, groundY);
      this.renderZhixiaLightningCrown(x, groundY, radius);
    }

    strikeLightning(x, y, damage, radius) {
      this.playLightningStrikeVisual(x, y, radius);
      const hits = [];
      (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) return;
        if (Phaser.Math.Distance.Between(x, y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y) <= radius + LEAF_SLIME_HIT_RADIUS) {
          const dealt = this.playLeafSlimeHit(slime, damage, {
            kind: "magic",
            noEnergyGain: true,
            allowComboHit: true
          });
          if (dealt > 0) hits.push(slime);
        }
      });
      app.audio.hit();
      return hits;
    }

    flashSlash(x, y, angle, depth = 45, charged = false) {
      const container = this.add.container(x, y).setRotation(angle).setDepth(depth);
      const scaleX = charged ? 0.92 : 0.72;
      const scaleY = charged ? 0.54 : 0.42;
      const shadow = this.add.image(-62, -3, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.1, 0.5)
        .setFlipX(true)
        .setScale(scaleX * 1.05, scaleY * 1.14)
        .setTint(0xc7e4f2)
        .setAlpha(charged ? 0.22 : 0.14)
        .setBlendMode(Phaser.BlendModes.ADD);
      const body = this.add.image(-58, -4, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.1, 0.5)
        .setFlipX(true)
        .setScale(scaleX, scaleY)
        .setTint(0xffffff)
        .setAlpha(1)
        .setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.image(-53, -2, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.1, 0.5)
        .setFlipX(true)
        .setScale(scaleX * 0.86, scaleY * 0.66)
        .setTint(0xffffff)
        .setAlpha(1)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add([shadow, body, core]);
      if (charged) {
        const echo = this.add.image(-68, 2, SWORD_WAVE_TEXTURE_KEY)
          .setOrigin(0.1, 0.5)
          .setFlipX(true)
          .setScale(scaleX * 1.12, scaleY * 0.92)
          .setRotation(0.13)
          .setTint(0xeefaff)
          .setAlpha(0.38)
          .setBlendMode(Phaser.BlendModes.ADD);
        container.addAt(echo, 1);
        this.tweens.add({ targets: echo, rotation: -0.08, scaleX: echo.scaleX * 1.12, alpha: 0, duration: 280, ease: "Cubic.easeOut" });
      }
      this.emitPhysicalSparks(x, y, charged ? 22 : 12, 0xf8fdff);
      this.tweens.add({
        targets: container,
        alpha: 0,
        scaleX: charged ? 1.22 : 1.16,
        scaleY: charged ? 1.15 : 1.08,
        duration: charged ? 300 : 225,
        ease: "Cubic.easeOut",
        onComplete: () => container.destroy()
      });
      if (charged) this.cameras.main.shake(70, 0.0022);
    }

    emitPhysicalSparks(x, y, quantity = 10, tint = 0xffd27a, depth = y + 96) {
      if (!this.textures.exists(PHYSICAL_SPARK_TEXTURE_KEY)) return;
      const red = (tint >> 16) & 0xff;
      const green = (tint >> 8) & 0xff;
      const blue = tint & 0xff;
      const nearWhite = red > 220 && green > 220 && blue > 220;
      const blueTint = blue > red;
      const sparks = this.add.particles(x, y, PHYSICAL_SPARK_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 150, max: 380 },
        speed: { min: 90, max: 300 },
        angle: { min: 0, max: 360 },
        rotate: { min: -120, max: 180 },
        scale: { start: 0.46, end: 0 },
        alpha: { start: 0.96, end: 0 },
        tint: nearWhite ? [tint, 0xffffff, 0xdceff7] : blueTint ? [tint, 0xdff3ff, 0x2d7dff] : [tint, 0xffffff, 0xf4b85e],
        blendMode: "ADD"
      }).setDepth(depth);
      sparks.explode(quantity, 0, 0);
      this.time.delayedCall(440, () => sparks.destroy());
      return sparks;
    }

    playImpactPunchVisual(x, y, angle, charged = false, berserk = false) {
      const effectScale = berserk && charged ? 1.52 : berserk ? 1.24 : 1;
      const effectDepth = y + 260;
      const container = this.add.container(x, y).setRotation(angle).setDepth(effectDepth).setScale(effectScale);
      const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const body = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      glow.fillStyle(berserk ? 0xff3923 : 0x175cff, 0.26);
      glow.fillTriangle(-30, -29, -30, 29, 62, 0);
      body.fillStyle(berserk ? 0xff6a2d : 0x39a4ff, 0.82);
      body.fillTriangle(-22, -18, -22, 18, 58, 0);
      core.fillStyle(0xf8ffff, 0.96);
      core.fillTriangle(-12, -7, -12, 7, 64, 0);
      const spreadArrows = [];
      if (charged) {
        [-1, 1].forEach(side => {
          const echo = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
          echo.fillStyle(berserk ? 0xff8a3a : 0x79c9ff, 0.34);
          echo.fillTriangle(-18, -10, -18, 10, 52, 0);
          echo.setRotation(side * Phaser.Math.FloatBetween(0.055, 0.135));
          echo.setScale(0.94, 0.72);
          spreadArrows.push(echo);
        });
      }
      const rings = [];
      [-20, 2, 23].forEach((offset, index) => {
        const ring = this.add.ellipse(offset, 0, 16 + index * 5, 58 - index * 9, 0x2e8dff, 0.08)
          .setStrokeStyle(3 - index * 0.45, index === 2 ? 0xd9f7ff : 0x55b8ff, 0.92 - index * 0.1)
          .setBlendMode(Phaser.BlendModes.ADD);
        rings.push(ring);
        this.tweens.add({ targets: ring, scaleY: { from: 0.72, to: 1.22 }, alpha: { from: 0.94, to: 0.16 }, duration: 150 + index * 35, yoyo: true, repeat: 1 });
      });
      const streaks = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 7; index += 1) {
        const offset = (index - 3) * 7;
        streaks.lineStyle(index % 2 ? 2 : 3, index % 2 ? 0xff8a2c : 0xffd16c, 0.72);
        streaks.lineBetween(-42 - Math.abs(index - 3) * 4, offset, -18, offset * 0.42);
      }
      container.add([glow, streaks, ...spreadArrows, body, ...rings, core]);
      this.emitPhysicalSparks(
        x + Math.cos(angle) * 42 * effectScale,
        y + Math.sin(angle) * 42 * effectScale,
        berserk ? 28 : 16,
        berserk ? 0xff7040 : 0x7cc8ff,
        effectDepth + 2
      );
      this.tweens.add({ targets: container, scaleX: effectScale * 1.28, scaleY: effectScale * 0.82, alpha: 0, duration: 230, ease: "Cubic.easeOut", onComplete: () => container.destroy() });
      this.cameras.main.shake(52, 0.0016);
    }

    triggerLaodengBerserkExplosion(x, y, comboIndex = 0) {
      const radius = 82;
      const baseDamage = Math.max(1, Math.round(Number(app.profile.attackPower || MELEE.damage) * (0.1 + comboIndex * 0.006)));
      this.playLaodengBerserkExplosionVisual(x, y, comboIndex);
      app.audio.fireExplosion(comboIndex);
      this.broadcastCombatEvent("laodengFireExplosion", { x, y, radius, charged: true, color: 0xff6a24 });

      [24, 78].forEach((delay, tickIndex) => this.time.delayedCall(delay, () => {
        (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
          if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) return;
          const distance = Phaser.Math.Distance.Between(x, y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y);
          if (distance > radius + LEAF_SLIME_HIT_RADIUS) return;
          this.playLeafSlimeHit(slime, Math.max(1, Math.round(baseDamage * (tickIndex ? 0.82 : 1))), {
            kind: "physical",
            charged: true,
            noEnergyGain: true,
            allowComboHit: true
          });
        });
      }));
    }

    playLaodengBerserkExplosionVisual(x, y, comboIndex = 0) {
      const comboScale = 1 + Math.min(4, Math.max(0, comboIndex)) * 0.055;
      const depth = y + 108;
      const blast = this.add.container(x, y).setDepth(depth).setScale(0.48 * comboScale);
      const outer = this.add.circle(0, 0, 54, 0xa91a12, 0.38)
        .setStrokeStyle(7, 0xff5a1f, 0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
      const middle = this.add.circle(0, 0, 34, 0xff4b17, 0.76)
        .setStrokeStyle(5, 0xffb33e, 0.98)
        .setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.circle(0, 0, 15, 0xfff2a1, 0.98)
        .setBlendMode(Phaser.BlendModes.ADD);
      const shockwave = this.add.ellipse(0, 18, 116, 42, 0xff3518, 0.16)
        .setStrokeStyle(6, 0xffa735, 0.92)
        .setBlendMode(Phaser.BlendModes.ADD);
      const rays = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 18; index += 1) {
        const angle = index / 18 * Math.PI * 2 + Phaser.Math.FloatBetween(-0.08, 0.08);
        const inner = 18 + (index % 3) * 4;
        const outerRadius = 52 + (index % 5) * 8 + comboIndex * 2;
        rays.lineStyle(index % 3 ? 3 : 6, index % 3 ? 0xff7a24 : 0xffeb82, index % 3 ? 0.76 : 0.96);
        rays.lineBetween(
          Math.cos(angle) * inner,
          Math.sin(angle) * inner,
          Math.cos(angle) * outerRadius,
          Math.sin(angle) * outerRadius
        );
      }
      blast.add([outer, shockwave, rays, middle, core]);
      this.tweens.add({
        targets: blast,
        scale: 1.24 * comboScale,
        alpha: 0,
        angle: Phaser.Math.Between(-8, 8),
        duration: 330,
        ease: "Cubic.easeOut",
        onComplete: () => blast.destroy()
      });

      const fire = this.add.particles(x, y, PHYSICAL_SPARK_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 260, max: 610 },
        speed: { min: 150, max: 470 },
        angle: { min: 0, max: 360 },
        gravityY: 170,
        rotate: { min: -220, max: 240 },
        scale: { start: 0.86 * comboScale, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xfff09b, 0xffb22f, 0xff5b1d, 0xe52c18],
        blendMode: "ADD"
      }).setDepth(depth + 2);
      const flameCloud = this.add.particles(x, y, LAODENG_SMOKE_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 330, max: 720 },
        speed: { min: 48, max: 190 },
        angle: { min: 205, max: 335 },
        gravityY: -58,
        scale: { start: 0.36 * comboScale, end: 1.18 * comboScale },
        alpha: { start: 0.72, end: 0 },
        tint: [0xff9b2e, 0xff4b1b, 0x8f2b21],
        blendMode: "ADD"
      }).setDepth(depth + 1);
      const smoke = this.add.particles(x, y + 10, LAODENG_SMOKE_TEXTURE_KEY, {
        emitting: false,
        lifespan: { min: 440, max: 820 },
        speed: { min: 28, max: 112 },
        angle: { min: 210, max: 330 },
        gravityY: -34,
        scale: { start: 0.28, end: 1.08 },
        alpha: { start: 0.42, end: 0 },
        tint: [0x6c3a31, 0x493238, 0x2d2932],
        blendMode: "NORMAL"
      }).setDepth(depth);
      fire.explode(30 + comboIndex * 3, 0, 0);
      flameCloud.explode(18 + comboIndex * 2, 0, 0);
      smoke.explode(11 + comboIndex, 0, 0);
      this.time.delayedCall(900, () => {
        fire.destroy();
        flameCloud.destroy();
        smoke.destroy();
      });
      this.cameras.main.shake(82, 0.0027 + comboIndex * 0.00018);
    }

    createLaodengShockwaveVisual(x, y, angle, berserk = false) {
      const container = this.add.container(x, y).setRotation(angle).setDepth(y + 74);
      const flare = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 26; index += 1) {
        const theta = index / 26 * Math.PI * 2;
        const innerX = Math.cos(theta) * 31;
        const innerY = Math.sin(theta) * 10;
        const outerX = Math.cos(theta) * (47 + (index % 4) * 5);
        const outerY = Math.sin(theta) * (17 + (index % 3) * 3);
        flare.lineStyle(index % 3 ? 2 : 4, index % 3 ? 0xff5b20 : 0xffc04a, index % 3 ? 0.68 : 0.9);
        flare.lineBetween(innerX, innerY, outerX, outerY);
      }
      const outer = this.add.ellipse(0, 0, 100, 36, berserk ? 0xa31416 : 0xc71b14, 0.24)
        .setStrokeStyle(7, 0xff4a1f, 0.82);
      const ring = this.add.ellipse(0, 0, 78, 24, 0x3c0909, 0.36)
        .setStrokeStyle(3, 0xffa43a, 0.98);
      const leading = this.add.triangle(52, 0, -9, -12, 18, 0, -9, 12, 0xff7a24, 0.86)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add([flare, outer, ring, leading]);
      this.tweens.add({ targets: [outer, ring], scaleX: { from: 0.78, to: 1.12 }, scaleY: { from: 0.7, to: 1.18 }, alpha: { from: 0.96, to: 0.48 }, duration: 110, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: flare, angle: 18, alpha: { from: 0.92, to: 0.42 }, duration: 150, yoyo: true, repeat: -1 });
      return container;
    }

    createSwordWaveVisual(x, y, rotation, depth) {
      const container = this.add.container(x, y).setRotation(rotation).setDepth(depth);
      const wake = this.add.image(-38, 0, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.08, 0.5).setFlipX(true).setScale(0.72, 0.18).setTint(0x7ccdf7).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
      const wave = this.add.image(-34, 0, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.08, 0.5).setFlipX(true).setScale(0.66, 0.13).setTint(0xe9faff).setAlpha(1).setBlendMode(Phaser.BlendModes.ADD);
      const edge = this.add.image(-27, 0, SWORD_WAVE_TEXTURE_KEY)
        .setOrigin(0.08, 0.5).setFlipX(true).setScale(0.58, 0.045).setTint(0xffffff).setAlpha(1).setBlendMode(Phaser.BlendModes.ADD);
      const spine = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      spine.lineStyle(2.2, 0xf8feff, 0.98);
      spine.beginPath();
      spine.moveTo(-18, 0);
      spine.lineTo(146, 0);
      spine.strokePath();
      spine.lineStyle(1, 0x83d9ff, 0.84);
      spine.lineBetween(12, -4, 132, -1);
      const tip = this.add.triangle(150, 0, -18, -6, 34, 0, -18, 6, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD);
      container.add([wake, wave, edge, spine, tip]);
      this.tweens.add({ targets: [wake, wave, edge], scaleX: "+=0.07", alpha: "-=0.14", duration: 90, yoyo: true, repeat: -1 });
      return container;
    }

    createArrowVisual(x, y, rotation, depth, charged = false, variant = "normal") {
      const container = this.add.container(x, y).setRotation(rotation).setDepth(depth);
      const wake = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const shaft = this.add.graphics();
      const isHeavy = variant === "heavy" || charged;
      const isBarrage = variant === "barrage";
      const length = isHeavy ? 82 : isBarrage ? 44 : 58;
      const shaftColor = isHeavy ? 0x9db8c9 : isBarrage ? 0xc68a48 : 0xcab57b;
      const headColor = isHeavy ? 0xe8f6ff : isBarrage ? 0xf0bb62 : 0xe8dfbd;
      const trailColor = isHeavy ? 0xb9ecff : isBarrage ? 0xf6b963 : 0xe9d6a0;
      const trailCount = isHeavy ? 5 : isBarrage ? 2 : 3;
      for (let index = 0; index < trailCount; index += 1) {
        const side = index - (trailCount - 1) / 2;
        wake.lineStyle(isHeavy && !side ? 5 : 1.8, trailColor, isHeavy && !side ? 0.54 : 0.28);
        wake.lineBetween(-length - 18 - Math.abs(side) * 7, side * 3.4, -4, side * 0.7);
      }
      const tailX = -length * 0.62;
      const neckX = length * 0.34;
      const tipX = length * 0.62;
      shaft.lineStyle(isHeavy ? 6 : isBarrage ? 3.5 : 4.5, 0x3b342c, 0.92);
      shaft.lineBetween(tailX, 0, neckX, 0);
      shaft.lineStyle(isHeavy ? 3.2 : isBarrage ? 1.7 : 2.4, shaftColor, 1);
      shaft.lineBetween(tailX, 0, neckX, 0);
      shaft.lineStyle(1, 0xf8f4df, 0.82);
      shaft.lineBetween(tailX + 4, -1, neckX - 3, -1);
      shaft.fillStyle(0x3a3f48, 0.96);
      shaft.fillTriangle(tipX + 3, 0, neckX - 3, -(isHeavy ? 9 : 7), neckX - 3, isHeavy ? 9 : 7);
      shaft.fillStyle(headColor, 1);
      shaft.fillTriangle(tipX, 0, neckX, -(isHeavy ? 6.5 : 5), neckX, isHeavy ? 6.5 : 5);
      shaft.fillStyle(isBarrage ? 0x7a3d2d : 0x9d6044, 0.98);
      shaft.fillTriangle(tailX + 3, 0, tailX - 15, -7, tailX - 9, 0);
      shaft.fillTriangle(tailX + 3, 0, tailX - 15, 7, tailX - 9, 0);
      container.add([wake, shaft]);
      this.tweens.add({
        targets: wake,
        alpha: { from: isHeavy ? 0.86 : 0.58, to: isHeavy ? 0.28 : 0.18 },
        scaleX: { from: 0.9, to: isHeavy ? 1.14 : 1.06 },
        duration: isBarrage ? 54 : 72,
        yoyo: true,
        repeat: -1
      });
      return container;
    }

    fireProjectile(options = {}) {
      if (!this.actor || this.isDead) return;
      const equipment = this.selectedEquipment || EQUIPMENT[0];
      const charged = !!options.charged;
      const direction = this.facing || DIRECTIONS[2];
      const vec = options.vec ? normalizeVector(options.vec.x, options.vec.y) : directionVector(direction);
      this.lastAimVector = vec;
      const castOrigin = this.getCastOrigin(vec);
      const projectileSpeed = Number(options.speed) || equipment.speed * PROJECTILE_SPEED_SCALE * PLAYER_PROJECTILE_SPEED_MULTIPLIER;
      const flightFrame = equipment.projectileFrame + (charged ? 1 : 0);
      const projectile = this.projectiles.create(castOrigin.x, castOrigin.y, "play-projectile-hitbox");
      projectile.setVisible(false);
      const projectileSize = Math.round(equipment.size * PROJECTILE_HITBOX_SCALE_MULTIPLIER);
      projectile.body.setCircle(projectileSize, 16 - projectileSize, 16 - projectileSize);
      projectile.body.setAllowGravity(false);
      projectile.body.setVelocity(vec.x * projectileSpeed, vec.y * projectileSpeed);
      projectile.spawnTime = this.time.now;
      projectile.color = Number(options.color) || equipment.color;
      projectile.radius = projectileSize;
      projectile.spawnX = castOrigin.x;
      projectile.spawnY = castOrigin.y;
      projectile.maxDistance = Number(options.maxDistance) || Math.min(equipment.range || PROJECTILE_MAX_RANGE, PROJECTILE_MAX_RANGE);
      projectile.maxLifetime = Math.ceil((projectile.maxDistance / projectileSpeed) * 1000) + 180;
      projectile.impactFrame = equipment.impactFrame;
      projectile.visualScale = (equipment.projectileScale || 0.15) * PROJECTILE_VISUAL_SCALE_MULTIPLIER;
      projectile.impactScale = charged ? 1.5 : 1;
      projectile.depthOffset = vec.y < -0.12 ? -8 : 12;
      projectile.visualBaseDepth = this.actor.y + 18;
      projectile.visualRotation = Math.atan2(vec.y, vec.x);
      projectile.impactAnimationKey = options.visualType ? "" : this.getProjectileAnimationKey(equipment, "impact");
      projectile.damage = Number(options.damage) || (app.profile.characterId === "lina"
        ? (charged ? Math.round(Number(app.profile.magicPower || 22) * 1.55) : Number(app.profile.magicPower || 22))
        : Number(app.profile.attackPower || 18));
      projectile.charged = charged;
      projectile.kind = options.kind || (app.profile.characterId === "lina" ? "magic" : "physical");
      projectile.piercing = !!options.piercing;
      projectile.ignoreObstacles = !!options.ignoreObstacles;
      projectile.maxLargeTargetHits = Math.max(1, Number(options.maxLargeTargetHits) || 1);
      projectile.largeTargetDamage = Math.max(0, Number(options.largeTargetDamage) || 0);
      projectile.knockbackForce = Math.max(0, Number(options.knockbackForce) || 0);
      projectile.largeTargetHits = new Map();
      projectile.noEnergyGain = !!options.noEnergyGain;
      projectile.allowComboHit = !!options.allowComboHit;
      projectile.impactAoeRadius = Math.max(0, Number(options.impactAoeRadius) || 0);
      projectile.impactAoeMultiplier = Math.max(0, Number(options.impactAoeMultiplier) || 0);
      projectile.impactAoeColor = Number(options.impactAoeColor) || projectile.color;
      projectile.impactAoeComboIndex = Math.max(0, Number(options.impactAoeComboIndex) || 0);
      projectile.barrageDamageRamp = options.barrageDamageRamp instanceof Map ? options.barrageDamageRamp : null;
      projectile.visualType = options.visualType || "";
      projectile.hitTargets = new Set();
      projectile.trail = [];
      projectile.lastTrailSparkAt = 0;
      const projectileOrigin = charged
        ? (equipment.chargedProjectileOrigin || equipment.projectileOrigin || PROJECTILE_HEAD_ORIGIN)
        : (equipment.projectileOrigin || PROJECTILE_HEAD_ORIGIN);
      if (["arrow", "arrowHeavy", "arrowBarrage"].includes(options.visualType)) {
        const arrowVariant = options.visualType === "arrowHeavy" ? "heavy" : options.visualType === "arrowBarrage" ? "barrage" : "normal";
        projectile.visual = this.createArrowVisual(
          castOrigin.x,
          castOrigin.y,
          projectile.visualRotation,
          Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth),
          charged,
          arrowVariant
        );
      } else if (options.visualType === "swordWave") {
        projectile.visual = this.createSwordWaveVisual(
          castOrigin.x,
          castOrigin.y,
          projectile.visualRotation,
          Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth)
        );
      } else if (options.visualType === "lightningOrb") {
        projectile.visual = this.createLightningOrbVisual(
          castOrigin.x,
          castOrigin.y,
          projectile.visualRotation,
          Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth)
        );
      } else if (options.visualType === "windBolt") {
        projectile.visual = this.createWindBoltVisual(
          castOrigin.x,
          castOrigin.y,
          projectile.visualRotation,
          Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth)
        );
      } else {
        projectile.visual = this.add.sprite(castOrigin.x, castOrigin.y, PROJECTILE_TEXTURE_KEY, flightFrame)
          .setOrigin(projectileOrigin.x, projectileOrigin.y)
          .setScale(projectile.visualScale)
          .setRotation(projectile.visualRotation)
          .setDepth(Math.max(castOrigin.y + projectile.depthOffset, projectile.visualBaseDepth));
      }
      if (projectile.visualType === "windBolt") this.playWindCastBurst(castOrigin.x, castOrigin.y, projectile.visualRotation, projectile.visualBaseDepth + 1);
      else this.flashCast(castOrigin.x, castOrigin.y, projectile.color, projectile.visualBaseDepth + 1);
      this.broadcastCombatEvent("projectile", {
        x: castOrigin.x,
        y: castOrigin.y,
        targetX: castOrigin.x + vec.x * projectile.maxDistance,
        targetY: castOrigin.y + vec.y * projectile.maxDistance,
        aimX: vec.x,
        aimY: vec.y,
        speed: projectileSpeed,
        color: projectile.color,
        charged,
        visualType: projectile.visualType
      });
      if (options.audioType === "bow") app.audio.bowRelease(charged);
      else if (options.audioType === "sword") app.audio.swordSwing(true);
      else app.audio.projectileFly(charged);
    }

    createLightningOrbVisual(x, y, rotation, depth) {
      const container = this.add.container(x, y).setRotation(rotation).setDepth(depth).setScale(2);
      const tail = this.add.image(-28, 0, LIGHTNING_RIBBON_TEXTURE_KEY)
        .setOrigin(0.88, 0.5)
        .setScale(0.16, 0.14)
        .setTint(0x2d79ff)
        .setAlpha(0.56)
        .setBlendMode(Phaser.BlendModes.ADD);
      const tailCore = this.add.image(-24, 0, LIGHTNING_RIBBON_TEXTURE_KEY)
        .setOrigin(0.88, 0.5)
        .setScale(0.13, 0.045)
        .setTint(0xeefeff)
        .setAlpha(0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
      const glow = this.add.ellipse(-3, 0, 28, 12, 0x1766ff, 0.34)
        .setBlendMode(Phaser.BlendModes.ADD);
      const shell = this.add.circle(5, 0, 6, 0x1378ed, 0.96)
        .setStrokeStyle(1.4, 0x6de7ff, 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.circle(6, 0, 2.4, 0xf4feff, 1).setBlendMode(Phaser.BlendModes.ADD);
      const spark = this.add.star(6, 0, 4, 1.2, 4.2, 0xa7f3ff, 0.96).setBlendMode(Phaser.BlendModes.ADD);
      const orbitA = this.add.arc(5, 0, 9, -72, 72, false, 0x59d7ff, 0.08)
        .setStrokeStyle(1.1, 0xbaf6ff, 0.72)
        .setBlendMode(Phaser.BlendModes.ADD);
      const orbitB = this.add.arc(5, 0, 8, 108, 252, false, 0x277dff, 0.06)
        .setStrokeStyle(0.8, 0x63bfff, 0.58)
        .setRotation(Math.PI / 2.7)
        .setBlendMode(Phaser.BlendModes.ADD);
      container.add([tail, tailCore, glow, shell, orbitA, orbitB, core, spark]);
      this.tweens.add({
        targets: [glow, shell],
        alpha: { from: 0.96, to: 0.62 },
        scaleX: { from: 0.94, to: 1.08 },
        scaleY: { from: 0.94, to: 1.08 },
        duration: 72,
        yoyo: true,
        repeat: -1
      });
      this.tweens.add({ targets: spark, angle: 90, duration: 160, repeat: -1 });
      this.tweens.add({ targets: [orbitA, orbitB], angle: "+=28", duration: 190, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: [tail, tailCore], scaleX: "+=0.04", alpha: "-=0.18", duration: 74, yoyo: true, repeat: -1 });
      return container;
    }

    createWindBoltVisual(x, y, rotation, depth) {
      const container = this.add.container(x, y).setRotation(rotation).setDepth(depth).setScale(2);
      const tailGlow = this.add.image(-27, 0, WIND_RIBBON_TEXTURE_KEY)
        .setOrigin(0.88, 0.5)
        .setScale(0.17, 0.13)
        .setTint(0x25c768)
        .setAlpha(0.48)
        .setBlendMode(Phaser.BlendModes.ADD);
      const tailCore = this.add.image(-23, 0, WIND_RIBBON_TEXTURE_KEY)
        .setOrigin(0.88, 0.5)
        .setScale(0.13, 0.05)
        .setTint(0xc9ffb7)
        .setAlpha(0.88)
        .setBlendMode(Phaser.BlendModes.ADD);
      const glow = this.add.ellipse(-2, 0, 30, 15, 0x27c66a, 0.34).setBlendMode(Phaser.BlendModes.ADD);
      const shell = this.add.circle(5, 0, 7, 0x23b963, 0.95)
        .setStrokeStyle(1.6, 0xa6ffbb, 1);
      const inner = this.add.circle(6, 0, 3.6, 0x57e67d, 0.88).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.circle(7, -0.5, 1.35, 0xf7fff1, 0.96).setBlendMode(Phaser.BlendModes.ADD);
      const spark = this.add.star(7, 0, 5, 1, 4.4, 0xe7ffd6, 0.9).setBlendMode(Phaser.BlendModes.ADD);
      const curlA = this.add.arc(4, 0, 10, -82, 72, false, 0x67ef8c, 0.07)
        .setStrokeStyle(1.2, 0xd1ffc4, 0.76)
        .setBlendMode(Phaser.BlendModes.ADD);
      const curlB = this.add.arc(4, 0, 8, 102, 254, false, 0x2cc76d, 0.05)
        .setStrokeStyle(1, 0x7af09a, 0.62)
        .setRotation(Math.PI / 2.8)
        .setBlendMode(Phaser.BlendModes.ADD);
      const leaf = this.add.triangle(-5, -5, -3, 2, 5, 0, -1, -4, 0x70df83, 0.9).setAngle(-22);
      container.add([tailGlow, tailCore, glow, shell, curlA, curlB, inner, core, spark, leaf]);
      this.tweens.add({
        targets: [glow, shell, inner],
        alpha: { from: 0.96, to: 0.62 },
        scaleX: { from: 0.94, to: 1.1 },
        scaleY: { from: 0.94, to: 1.1 },
        duration: 78,
        yoyo: true,
        repeat: -1
      });
      this.tweens.add({ targets: spark, angle: 100, duration: 170, repeat: -1 });
      this.tweens.add({ targets: [curlA, curlB], angle: "+=32", duration: 210, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: [tailGlow, tailCore], scaleX: "+=0.045", alpha: "-=0.18", duration: 82, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: leaf, x: -11, y: 5, angle: 112, duration: 190, yoyo: true, repeat: -1 });
      return container;
    }

    playWindCastBurst(x, y, rotation, depth) {
      const gust = this.add.graphics().setPosition(x, y).setRotation(rotation).setDepth(depth);
      for (let index = 0; index < 8; index += 1) {
        const offset = (index - 3.5) * 5;
        gust.lineStyle(index % 3 === 0 ? 5 : 2.5, index % 2 ? 0x6be286 : 0xd9ffbf, 0.62);
        gust.beginPath();
        gust.moveTo(-6, offset * 0.25);
        gust.lineTo(-22, offset + (index % 2 ? 5 : -5));
        gust.lineTo(-46 - index * 2, offset * 1.18);
        gust.strokePath();
      }
      this.tweens.add({ targets: gust, x: x - Math.cos(rotation) * 24, y: y - Math.sin(rotation) * 24, scaleX: 1.25, alpha: 0, duration: 240, ease: "Cubic.easeOut", onComplete: () => gust.destroy() });
    }

    renderWindBoltImpact(x, y) {
      const slash = this.add.graphics().setPosition(x, y).setDepth(y + 72);
      [0, 1, 2].forEach(index => {
        slash.lineStyle(4 - index, index === 1 ? 0xe7ffc9 : 0x4cde7c, 0.82 - index * 0.18);
        slash.beginPath();
        slash.arc(0, 0, 22 + index * 11, -0.85 + index * 1.7, 1.45 + index * 1.4, false);
        slash.strokePath();
      });
      this.tweens.add({ targets: slash, angle: 36, scale: 1.35, alpha: 0, duration: 260, ease: "Cubic.easeOut", onComplete: () => slash.destroy() });
      this.spawnWindBurst(x, y, 9, 58, 240);
    }

    renderPhysicalImpactBurst(x, y, radius, color = 0xf0bb62) {
      const visualRadius = clamp(Number(radius) || 72, 32, 132);
      const ring = this.add.graphics().setPosition(x, y).setDepth(y + 96).setBlendMode(Phaser.BlendModes.ADD);
      ring.lineStyle(4, color, 0.9);
      ring.strokeCircle(0, 0, visualRadius * 0.24);
      ring.lineStyle(1.5, 0xffffff, 0.76);
      ring.strokeCircle(0, 0, visualRadius * 0.14);
      const shards = this.add.graphics().setPosition(x, y).setDepth(y + 98).setBlendMode(Phaser.BlendModes.ADD);
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2 + Phaser.Math.FloatBetween(-0.16, 0.16);
        const inner = Phaser.Math.Between(7, 17);
        const outer = Phaser.Math.Between(Math.round(visualRadius * 0.45), Math.round(visualRadius * 0.9));
        shards.lineStyle(index % 3 === 0 ? 3.4 : 1.8, index % 4 === 0 ? 0xffffff : color, 0.86);
        shards.lineBetween(
          Math.cos(angle) * inner,
          Math.sin(angle) * inner * 0.72,
          Math.cos(angle) * outer,
          Math.sin(angle) * outer * 0.72
        );
      }
      this.emitPhysicalSparks(x, y, 14, color);
      this.tweens.add({
        targets: ring,
        scale: 2.8,
        alpha: 0,
        duration: 310,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy()
      });
      this.tweens.add({
        targets: shards,
        scale: 1.22,
        alpha: 0,
        duration: 360,
        ease: "Cubic.easeOut",
        onComplete: () => shards.destroy()
      });
    }

    triggerProjectileImpactAoe(projectile, primaryTarget) {
      const radius = Math.max(0, Number(projectile?.impactAoeRadius) || 0);
      const multiplier = Math.max(0, Number(projectile?.impactAoeMultiplier) || 0);
      if (!radius || !multiplier || !primaryTarget?.active) return 0;
      const x = primaryTarget.x;
      const y = primaryTarget.y + LEAF_SLIME_HIT_OFFSET_Y;
      const color = Number(projectile.impactAoeColor) || projectile.color || 0xf0bb62;
      this.renderPhysicalImpactBurst(x, y, radius, color);
      this.broadcastCombatEvent("physicalImpactBurst", {
        x,
        y,
        radius,
        color,
        comboIndex: Math.min(4, Number(projectile.impactAoeComboIndex) || 0)
      });
      if (this.time.now - Number(this.lastPhysicalImpactAudioAt || 0) >= 92) {
        this.lastPhysicalImpactAudioAt = this.time.now;
        app.audio.fireExplosion(Math.min(4, Number(projectile.impactAoeComboIndex) || 0));
      }
      let hitCount = 0;
      const aoeDamage = Math.max(1, Math.round(Number(projectile.damage || 1) * multiplier));
      (this.leafSlimes?.getChildren?.() || []).forEach(slime => {
        if (!slime?.active || slime === primaryTarget || ["dead", "vanish", "emerging", "transform"].includes(slime.state)) return;
        const distance = Phaser.Math.Distance.Between(x, y, slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y);
        if (distance > radius + LEAF_SLIME_HIT_RADIUS) return;
        const dealt = this.playLeafSlimeHit(slime, aoeDamage, {
          kind: "physical",
          charged: true,
          noEnergyGain: true,
          allowComboHit: true
        });
        if (dealt > 0) hitCount += 1;
      });
      return hitCount;
    }

    getCastOrigin(vec) {
      if (app.profile.characterId === "lina") return this.getLinaStaffCastOrigin(vec);
      if (app.profile.characterId === "zhixia") {
        return {
          x: this.actor.x + vec.x * ZHIXIA_PROJECTILE_CAST_OFFSET,
          y: this.actor.y - 58 + vec.y * ZHIXIA_PROJECTILE_CAST_OFFSET
        };
      }
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
      if (projectile.visualType === "lightningOrb") {
        if (burst) this.renderLightningOrbImpact(projectile.x, projectile.y);
        projectile.destroy();
        return;
      }
      if (projectile.visualType === "windBolt") {
        if (burst) this.renderWindBoltImpact(projectile.x, projectile.y);
        projectile.destroy();
        return;
      }
      if (projectile.visualType?.startsWith("arrow")) {
        if (burst) {
          const heavyArrow = projectile.visualType === "arrowHeavy";
          const barrageArrow = projectile.visualType === "arrowBarrage";
          this.emitPhysicalSparks(projectile.x, projectile.y, heavyArrow ? 13 : barrageArrow ? 5 : 7, heavyArrow ? 0xb9ecff : barrageArrow ? 0xf0bb62 : 0xffd38a);
          this.flashCast(projectile.x, projectile.y, heavyArrow ? 0xd8f6ff : barrageArrow ? 0xe0a04f : 0xe5cf8d, projectile.y + 88);
        }
        projectile.destroy();
        return;
      }
      if (projectile.visualType === "swordWave") {
        if (burst) {
          this.emitPhysicalSparks(projectile.x, projectile.y, 16, 0x9de2ff);
          this.flashSlash(projectile.x, projectile.y, projectile.visualRotation || 0, projectile.y + 92);
        }
        projectile.destroy();
        return;
      }
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

    applyJiangxunBarrageDamageRamp(projectile, targetKey, baseDamage) {
      if (projectile?.visualType !== "arrowBarrage" || !(projectile.barrageDamageRamp instanceof Map)) return baseDamage;
      const priorHits = Math.max(0, Number(projectile.barrageDamageRamp.get(targetKey)) || 0);
      const bonus = Math.min(1, priorHits * 0.1);
      projectile.barrageDamageRamp.set(targetKey, priorHits + 1);
      return Math.max(1, Math.round(baseDamage * (1 + bonus)));
    }

    handleLeafSlimeProjectileHit(projectile, slime) {
      if (!slime?.active) return false;
      const targetKey = slime.slimeId || slime;
      const largeTarget = slime.rank === "boss" || Number(slime.scale || slime.scaleX || 1) >= 1.3;
      const canMultiHit = largeTarget && projectile.maxLargeTargetHits > 1;
      let hitDamage = projectile.damage || 18;
      if (canMultiHit) {
        const state = projectile.largeTargetHits.get(targetKey) || { count: 0, at: -Infinity };
        if (state.count >= projectile.maxLargeTargetHits || this.time.now - state.at < 58) return false;
        state.count += 1;
        state.at = this.time.now;
        projectile.largeTargetHits.set(targetKey, state);
        hitDamage = projectile.largeTargetDamage || hitDamage;
      } else {
        if (projectile.hitTargets?.has(targetKey)) return false;
        projectile.hitTargets?.add(targetKey);
      }
      hitDamage = this.applyJiangxunBarrageDamageRamp(projectile, targetKey, hitDamage);
      if (!projectile.piercing) this.destroyProjectile(projectile, true);
      if (slime.state === "dead" || slime.state === "vanish") return !projectile.piercing;
      const dealtDamage = this.playLeafSlimeHit(slime, hitDamage, {
        kind: projectile.kind || "magic",
        charged: !!projectile.charged,
        noEnergyGain: !!projectile.noEnergyGain,
        allowComboHit: !!projectile.allowComboHit
      });
      if (dealtDamage > 0) this.triggerProjectileImpactAoe(projectile, slime);
      if (projectile.knockbackForce > 0 && ["mob", "elite"].includes(slime.rank) && slime.active && slime.body?.enable) {
        const aim = normalizeVector(slime.x - projectile.spawnX, slime.y - projectile.spawnY);
        const token = (slime.projectileKnockbackToken || 0) + 1;
        slime.projectileKnockbackToken = token;
        slime.skillKnockbackUntil = this.time.now + 140;
        slime.body.setVelocity(aim.x * projectile.knockbackForce, aim.y * projectile.knockbackForce);
        this.time.delayedCall(130, () => {
          if (slime.active && slime.body?.enable && slime.projectileKnockbackToken === token) slime.body.setVelocity(0, 0);
        });
      }
      if (canMultiHit) this.emitPhysicalSparks(slime.x, slime.y + LEAF_SLIME_HIT_OFFSET_Y, 8, 0xc9f5a4);
      return !projectile.piercing;
    }

    checkLeafSlimeProjectileHit(projectile) {
      const slimes = this.leafSlimes?.getChildren?.() || [];
      for (const slime of slimes) {
        if (!slime?.active || ["dead", "vanish", "emerging"].includes(slime.state)) continue;
        const hitX = slime.x;
        const hitY = slime.y + LEAF_SLIME_HIT_OFFSET_Y;
        const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, hitX, hitY);
        if (distance > LEAF_SLIME_HIT_RADIUS + projectile.radius) continue;
        if (this.handleLeafSlimeProjectileHit(projectile, slime)) return true;
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

    playLevelUpEffect(levels = 1, target = this.actor, level = app.profile?.level || 1) {
      if (!target || target.active === false) return;
      const x = Number(target.x) || 0;
      const y = (Number(target.y) || 0) - 126;
      const label = this.add.text(x, y, levels > 1 ? `LEVEL UP! x${levels}` : "LEVEL UP!", {
        fontFamily: "Arial Black, Microsoft YaHei, sans-serif",
        fontSize: "30px",
        fontStyle: "900",
        color: "#fff4a8",
        stroke: "#56318f",
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 5, color: "#2a1749", blur: 5, fill: true }
      }).setOrigin(0.5).setDepth(100200).setScale(0.35).setAngle(-9);
      const levelText = this.add.text(x, y + 34, `Lv.${Math.max(1, Number(level) || 1)}`, {
        fontFamily: "Arial Black, Microsoft YaHei, sans-serif",
        fontSize: "17px",
        fontStyle: "900",
        color: "#ffffff",
        stroke: "#7551a8",
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(100201).setAlpha(0).setScale(0.7);
      for (let index = 0; index < 20; index += 1) {
        const angle = Math.PI * 2 * index / 20 + Phaser.Math.FloatBetween(-0.15, 0.15);
        const spark = this.add.image(x, y + 34, PHYSICAL_SPARK_TEXTURE_KEY)
          .setScale(0.34 + Math.random() * 0.34)
          .setRotation(angle)
          .setTint([0xffd45f, 0xff87c8, 0x85eaff][index % 3])
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(100199);
        const distance = 62 + Math.random() * 66;
        this.tweens.add({
          targets: spark,
          x: x + Math.cos(angle) * distance,
          y: y + 34 + Math.sin(angle) * distance * 0.58,
          angle: Phaser.Math.RadToDeg(angle) + 150,
          scale: 0.05,
          alpha: 0,
          duration: 620 + Math.random() * 220,
          ease: "Cubic.easeOut",
          onComplete: () => spark.destroy()
        });
      }
      this.tweens.add({
        targets: label,
        y: y - 42,
        scale: 1.18,
        angle: 2,
        duration: 360,
        ease: "Back.easeOut",
        onComplete: () => this.tweens.add({
          targets: label,
          y: label.y - 28,
          scale: 0.94,
          alpha: 0,
          delay: 520,
          duration: 430,
          ease: "Cubic.easeIn",
          onComplete: () => label.destroy()
        })
      });
      this.tweens.add({
        targets: levelText,
        y: y - 4,
        alpha: 1,
        scale: 1,
        delay: 170,
        duration: 260,
        ease: "Back.easeOut",
        onComplete: () => this.tweens.add({ targets: levelText, y: levelText.y - 20, alpha: 0, delay: 520, duration: 380, onComplete: () => levelText.destroy() })
      });
      this.cameras.main.shake(90, 0.0014);
      app.audio?.questComplete?.();
    }

    playEnemyHitImpact(slime, critical = false, sourceCharacterId = app.profile?.characterId) {
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
      if (sourceCharacterId === "ayu") app.audio?.swordImpact?.(critical);
      else if (sourceCharacterId === "laodeng") app.audio?.punchImpact?.(critical);
      else if (sourceCharacterId === "jiangxun") app.audio?.arrowImpact?.(critical);
      else app.audio?.hit();
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

    playStructuralBreakBurst(x, y) {
      const profile = {
        kind: "structural",
        primary: 0x24bad8,
        secondary: 0xffb74f,
        core: 0xf2ffff,
        shadow: 0x173747,
        warning: 0x74edff,
        particles: [0x173747, 0x24bad8, 0xffb74f, 0xe8fbff]
      };
      this.renderEnemyAreaBurst(x, y + 18, profile);
      this.time.delayedCall(170, () => this.renderEnemyAreaBurst(x, y + 10, profile));
      const shards = this.add.graphics().setPosition(x, y - 56).setDepth(y + 160);
      for (let index = 0; index < 34; index += 1) {
        const angle = Math.PI * 2 * index / 34 + Phaser.Math.FloatBetween(-0.16, 0.16);
        const length = Phaser.Math.Between(34, 138);
        const width = Phaser.Math.Between(3, 9);
        shards.lineStyle(width + 5, 0x132f3c, 0.58);
        shards.lineBetween(0, 0, Math.cos(angle) * length, Math.sin(angle) * length * 0.7);
        shards.lineStyle(Math.max(1, width * 0.34), index % 3 ? 0x63dded : 0xffc562, 0.94);
        shards.lineBetween(0, 0, Math.cos(angle) * length, Math.sin(angle) * length * 0.7);
      }
      this.tweens.add({ targets: shards, scale: 1.24, alpha: 0, duration: 720, ease: "Cubic.easeOut", onComplete: () => shards.destroy() });
      for (let index = 0; index < 56; index += 1) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const mote = this.add.image(x, y - 42, index % 3 ? LIGHTNING_SPARK_TEXTURE_KEY : LIGHTNING_MOTE_TEXTURE_KEY)
          .setTint(index % 4 === 0 ? 0xffbd56 : index % 2 ? 0x5ee8f5 : 0x1d5268)
          .setScale(0.22 + Math.random() * 0.52)
          .setDepth(y + 164)
          .setBlendMode(index % 4 ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(angle) * Phaser.Math.Between(65, 220),
          y: y - 42 + Math.sin(angle) * Phaser.Math.Between(48, 150) + Phaser.Math.Between(0, 72),
          angle: Phaser.Math.Between(-240, 240),
          alpha: 0,
          scale: 0.04,
          duration: Phaser.Math.Between(520, 980),
          ease: "Cubic.easeOut",
          onComplete: () => mote.destroy()
        });
      }
      this.cameras.main.shake(360, 0.0085);
    }

    triggerStructuralBossTransform(slime, options = {}) {
      if (!slime?.active || slime.transforming || Number(slime.bossForm || 1) >= 2) return false;
      slime.transforming = true;
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "transform";
      slime.body?.setVelocity(0, 0);
      if (slime.body) slime.body.enable = false;
      slime.clearTint();
      this.playEnemyAnimation(slime, "transform", true);
      this.playStructuralBreakBurst(slime.x, slime.y);
      app.audio?.ultimateBurst();
      this.time.delayedCall(230, () => app.audio?.hit());
      this.time.delayedCall(470, () => app.audio?.fireExplosion?.(1));
      if (!options.network) this.broadcastEnemyState(slime, "transform", options.effect || {});
      this.tweens.add({
        targets: slime,
        scaleX: slime.baseVisualScale * 1.14,
        scaleY: slime.baseVisualScale * 0.9,
        duration: 720,
        yoyo: true,
        ease: "Sine.easeInOut"
      });
      this.time.delayedCall(1420, () => {
        if (!slime.active || slime.actionToken !== token) return;
        this.beginStructuralBossChargingPhase(slime, options);
      });
      return true;
    }

    beginStructuralBossChargingPhase(slime, options = {}) {
      if (!slime?.active) return;
      slime.bossForm = 2;
      slime.bossPhase = "charging";
      slime.transforming = false;
      slime.state = "charging";
      slime.stationary = true;
      slime.smoothMovement = false;
      slime.structuralChargeStartedAt = this.time.now;
      slime.structuralNextAoeAt = this.time.now + STRUCTURAL_CHARGE_INTERVAL_MS;
      slime.structuralNextReinforcementAt = this.time.now + 420;
      slime.structuralPhase3DashAt = 0;
      slime.setScale(slime.baseVisualScale * 1.06).setOrigin(0.5, 0.72);
      if (slime.body) {
        slime.body.enable = true;
        slime.body.setVelocity(0, 0);
        slime.body.setImmovable(true);
        slime.body.reset(slime.x, slime.y);
      }
      slime.energyShield?.destroy?.();
      slime.energyShield = this.add.ellipse(slime.x, slime.y - 88, 320, 390, 0x4fe8ff, 0.13)
        .setStrokeStyle(7, 0x9af8ff, 0.88)
        .setDepth(slime.y + 33)
        .setBlendMode(Phaser.BlendModes.ADD);
      slime.chargeTrack?.destroy?.();
      slime.chargeFill?.destroy?.();
      slime.chargeLabel?.destroy?.();
      slime.chargeTrack = this.add.rectangle(slime.x, slime.y + slime.hudOffsetY - 48, 250, 17, 0x142735, 0.92)
        .setStrokeStyle(2, 0xd9fbff, 0.9)
        .setDepth(slime.y + 45);
      slime.chargeFill = this.add.rectangle(slime.x - 122, slime.y + slime.hudOffsetY - 48, 244, 11, 0x54dff2, 0.96)
        .setOrigin(0, 0.5)
        .setDepth(slime.y + 46);
      slime.chargeLabel = this.add.text(slime.x, slime.y + slime.hudOffsetY - 69, "能量罩充能 · 10.0 秒", {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#e8feff",
        stroke: "#173747",
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(slime.y + 47);
      this.playEnemyAnimation(slime, "phaseMove", true);
      this.refreshEnemyHpBar(slime);
      if (this.isEncounterCoordinator()) {
        this.spawnStructuralBossChargers(slime);
        this.spawnStructuralReinforcements(slime, 6);
      }
      if (!options.network) this.broadcastEnemyState(slime, "charging");
      showToast("第二阶段：击杀 3 名稀有充能精英，阻止每 10 秒一次的全图燃爆");
    }

    spawnStructuralBossChargers(slime) {
      const definitions = [
        { textureKey: QUANTUM_SCHOLAR_KEY, label: "量子充能稀有精英", dx: -310, dy: 170, scale: 1.28 },
        { textureKey: BLOCKCHAIN_CHAINBEAST_KEY, label: "链铸充能稀有精英", dx: 310, dy: 170, scale: 1.32 },
        { textureKey: AIAGENT_CYBERMAGE_KEY, label: "Agent 充能稀有精英", dx: 0, dy: -250, scale: 1.24 }
      ];
      definitions.forEach((definition, index) => {
        const id = `ch1-m04-boss-charger-${index}`;
        if (this.findLeafSlime(id)) return;
        const charger = this.spawnLeafSlime({
          id,
          x: clamp(slime.x + definition.dx, 120, this.worldWidth - 120),
          y: clamp(slime.y + definition.dy, 140, this.worldHeight - 140),
          group: STRUCTURAL_CHARGER_GROUP,
          textureKey: definition.textureKey,
          rank: "rare",
          label: definition.label,
          scale: definition.scale,
          maxHp: 340,
          baseHealthMultiplier: 2,
          damage: 18,
          creditDefense: 7,
          rewardExp: 52,
          rewardCredits: 5,
          bossCharger: true,
          bossSummon: true,
          smoothMovement: true,
          wanderSpeed: 25,
          chaseSpeed: 54,
          aggroRange: 980,
          broadcast: app.connected
        });
        if (charger) {
          charger.provokedUntil = Number.POSITIVE_INFINITY;
          this.showFloatingText(charger.x, charger.y - 150, "正在给 BOSS 充能", { color: "#9af8ff", size: "18px", rise: 34, duration: 900 });
        }
      });
    }

    spawnStructuralReinforcements(slime, count = 2) {
      const alive = (this.leafSlimes?.getChildren?.() || []).filter(enemy =>
        enemy?.active && enemy.groupId === STRUCTURAL_REINFORCEMENT_GROUP && !["dead", "vanish"].includes(enemy.state)
      );
      const room = Math.max(0, 12 - alive.length);
      const textures = [QUANTUM_PAPER_KEY, BLOCKCHAIN_SPIDER_KEY, AIAGENT_BOTCAT_KEY];
      for (let index = 0; index < Math.min(room, count); index += 1) {
        const angle = Math.PI * 2 * (index + Math.random()) / Math.max(1, count);
        const radius = Phaser.Math.Between(310, 470);
        const textureKey = textures[(alive.length + index) % textures.length];
        this.spawnLeafSlime({
          id: `ch1-m04-reinforcement-${Date.now()}-${index}-${Math.floor(Math.random() * 9999)}`,
          x: clamp(slime.x + Math.cos(angle) * radius, 100, this.worldWidth - 100),
          y: clamp(slime.y + Math.sin(angle) * radius, 120, this.worldHeight - 120),
          group: STRUCTURAL_REINFORCEMENT_GROUP,
          textureKey,
          rank: "mob",
          label: "失稳增援小怪",
          scale: 0.94,
          maxHp: 82,
          baseHealthMultiplier: 2,
          damage: 11,
          rewardExp: 14,
          rewardCredits: 1,
          bossSummon: true,
          smoothMovement: true,
          wanderSpeed: 32,
          chaseSpeed: 58,
          aggroRange: 980,
          broadcast: app.connected
        });
      }
    }

    updateStructuralBossCharging(slime, time) {
      slime.body?.setVelocity(0, 0);
      const elapsed = Math.max(0, time - Number(slime.structuralChargeStartedAt || time));
      const progress = clamp((elapsed % STRUCTURAL_CHARGE_INTERVAL_MS) / STRUCTURAL_CHARGE_INTERVAL_MS, 0, 1);
      const seconds = Math.max(0, (STRUCTURAL_CHARGE_INTERVAL_MS - (elapsed % STRUCTURAL_CHARGE_INTERVAL_MS)) / 1000);
      slime.energyShield?.setPosition(slime.x, slime.y - 88).setDepth(slime.y + 33);
      slime.chargeTrack?.setPosition(slime.x, slime.y + slime.hudOffsetY - 48).setDepth(slime.y + 45);
      slime.chargeFill?.setPosition(slime.x - 122, slime.y + slime.hudOffsetY - 48).setDisplaySize(Math.max(2, 244 * progress), 11).setDepth(slime.y + 46);
      slime.chargeLabel?.setPosition(slime.x, slime.y + slime.hudOffsetY - 69).setText(`能量罩充能 · ${seconds.toFixed(1)} 秒`).setDepth(slime.y + 47);
      if (!this.isEncounterCoordinator()) return;
      const chargers = (this.leafSlimes?.getChildren?.() || []).filter(enemy =>
        enemy?.active && enemy.bossCharger && !["dead", "vanish"].includes(enemy.state)
      );
      if (!chargers.length) {
        this.enterStructuralBossPhaseThree(slime);
        return;
      }
      if (time >= Number(slime.structuralNextReinforcementAt || 0)) {
        slime.structuralNextReinforcementAt = time + STRUCTURAL_REINFORCEMENT_INTERVAL_MS;
        this.spawnStructuralReinforcements(slime, 2);
      }
      if (time >= Number(slime.structuralNextAoeAt || 0)) {
        slime.structuralChargeStartedAt = time;
        slime.structuralNextAoeAt = time + STRUCTURAL_CHARGE_INTERVAL_MS;
        this.triggerStructuralFullMapAoe(slime);
        this.broadcastCombatEvent("structuralChargeAoe", { enemyId: slime.slimeId, damage: Math.round(slime.damage * 1.25) });
      }
    }

    triggerStructuralFullMapAoe(slime, options = {}) {
      if (!slime?.active || this.getCurrentMapId() !== M04_MAP_ID) return;
      const width = this.scale.width;
      const height = this.scale.height;
      const warning = this.add.rectangle(width / 2, height / 2, width, height, 0xff5a28, 0.12)
        .setScrollFactor(0)
        .setDepth(100000);
      const label = this.add.text(width / 2, height * 0.42, "全图燃爆 · 立即防御", {
        fontFamily: "Microsoft YaHei, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#fff2c7",
        stroke: "#6b170f",
        strokeThickness: 8
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100001);
      this.tweens.add({ targets: warning, alpha: 0.35, duration: 180, yoyo: true, repeat: 3 });
      this.time.delayedCall(860, () => {
        warning.destroy();
        label.destroy();
        if (!slime.active || this.getCurrentMapId() !== M04_MAP_ID) return;
        this.cameras.main.flash(300, 255, 84, 35, false);
        this.cameras.main.shake(520, 0.011);
        for (let index = 0; index < 14; index += 1) {
          const x = this.cameras.main.worldView.x + Math.random() * this.cameras.main.worldView.width;
          const y = this.cameras.main.worldView.y + Math.random() * this.cameras.main.worldView.height;
          this.renderPhysicalImpactBurst(x, y, Phaser.Math.Between(62, 112), 0xff673b);
        }
        this.damagePlayer(Math.max(1, Number(options.damage) || Math.round(slime.damage * 1.25)));
        app.audio?.fireExplosion?.(3);
      });
    }

    clearStructuralBossPhaseVisuals(slime) {
      ["energyShield", "chargeTrack", "chargeFill", "chargeLabel"].forEach(key => {
        slime?.[key]?.destroy?.();
        if (slime) slime[key] = null;
      });
    }

    enterStructuralBossPhaseThree(slime, options = {}) {
      if (!slime?.active || slime.bossPhase === "phase3") return;
      slime.bossForm = 3;
      slime.bossPhase = "phase3";
      slime.state = "move";
      slime.stationary = false;
      slime.smoothMovement = false;
      slime.wanderSpeed = 72;
      slime.chaseSpeed = 168;
      slime.damage = Math.round(Math.max(1, slime.damage) * 1.22);
      slime.structuralCloseStartedAt = 0;
      slime.structuralStunCooldownAt = 0;
      slime.structuralPhase3DashAt = this.time.now + 2200;
      this.clearStructuralBossPhaseVisuals(slime);
      if (slime.body) {
        slime.body.enable = true;
        slime.body.setImmovable(false);
        slime.body.reset(slime.x, slime.y);
      }
      (this.leafSlimes?.getChildren?.() || [])
        .filter(enemy => enemy?.active && enemy.groupId === STRUCTURAL_REINFORCEMENT_GROUP && !["dead", "vanish"].includes(enemy.state))
        .forEach(enemy => {
          enemy.state = "vanish";
          enemy.body.enable = false;
          this.tweens.add({ targets: [enemy, enemy.shadow, enemy.hpBg, enemy.hpFrame, enemy.hpFill, enemy.nameLabel].filter(Boolean), alpha: 0, duration: 260, onComplete: () => this.syncSlimeRemove(enemy.slimeId) });
        });
      this.playEnemyAnimation(slime, "phaseMove", true);
      this.refreshEnemyHpBar(slime);
      if (!options.network) this.broadcastEnemyState(slime, "phase3");
      showToast("第三阶段：能量罩解除，BOSS 将高速追打并在玩家之间穿梭");
    }

    applyStructuralPursuitStun() {
      if (this.isDead || !this.actor?.active) return;
      this.structuralStunToken = (this.structuralStunToken || 0) + 1;
      const token = this.structuralStunToken;
      this.isActionLocked = true;
      this.actor.body?.setVelocity(0, 0);
      this.showFloatingText(this.actor.x, this.actor.y - 132, "结构压制 · 硬直 3 秒", { color: "#ffb09c", size: "21px", rise: 54, duration: 1050 });
      this.cameras.main.shake(180, 0.006);
      this.time.delayedCall(STRUCTURAL_PURSUIT_STUN_MS, () => {
        if (this.structuralStunToken !== token || this.isDead || app.dialogue || app.cinematicActive) return;
        this.isActionLocked = false;
      });
    }

    updateStructuralBossPhaseThree(slime, time, delta) {
      if (!slime.body?.enable || slime.structuralDashing) return;
      const dx = this.actor.x - slime.x;
      const dy = this.actor.y - slime.y;
      const distance = Math.hypot(dx, dy);
      const direction = normalizeVector(dx, dy);
      const blend = 1 - Math.exp(-9 * Math.max(1, Number(delta) || 16) / 1000);
      slime.body.setVelocity(
        Phaser.Math.Linear(slime.body.velocity.x, direction.x * slime.chaseSpeed, blend),
        Phaser.Math.Linear(slime.body.velocity.y, direction.y * slime.chaseSpeed, blend)
      );
      if (Math.abs(slime.body.velocity.x) > 2) slime.setFlipX(slime.body.velocity.x < 0);
      this.playEnemyAnimation(slime, "phaseMove");
      if (distance < 112) {
        slime.structuralCloseStartedAt ||= time;
        if (time - slime.structuralCloseStartedAt >= 780 && time >= Number(slime.structuralStunCooldownAt || 0)) {
          slime.structuralStunCooldownAt = time + STRUCTURAL_PURSUIT_STUN_MS + 2400;
          slime.structuralCloseStartedAt = time;
          this.damagePlayer(Math.round(slime.damage * 0.72));
          this.applyStructuralPursuitStun();
        }
      } else slime.structuralCloseStartedAt = 0;
      if (this.isEncounterCoordinator() && time >= Number(slime.structuralPhase3DashAt || 0)) {
        slime.structuralPhase3DashAt = time + STRUCTURAL_PHASE3_DASH_COOLDOWN_MS;
        const targets = [this.actor, ...Array.from(this.remotePlayers?.values?.() || []).map(remote => remote?.sprite)]
          .filter(target => target?.active)
          .slice(0, 5)
          .map(target => ({ x: Math.round(target.x), y: Math.round(target.y) }));
        this.startStructuralBossDash(slime, targets);
        this.broadcastCombatEvent("structuralBossDash", { enemyId: slime.slimeId, points: targets });
      }
    }

    distanceToSegment(point, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
      const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
    }

    createStructuralFirePath(slime, start, end) {
      const graphics = this.add.graphics().setDepth(Math.max(start.y, end.y) + 24);
      graphics.lineStyle(26, 0xff512b, 0.28).lineBetween(start.x, start.y, end.x, end.y);
      graphics.lineStyle(7, 0xffd06b, 0.82).lineBetween(start.x, start.y, end.x, end.y);
      this.tweens.add({ targets: graphics, alpha: 0.52, duration: 320, yoyo: true, repeat: -1 });
      this.time.delayedCall(STRUCTURAL_FIRE_PATH_DELAY_MS, () => {
        if (!graphics.active) return;
        this.tweens.killTweensOf(graphics);
        this.renderPhysicalImpactBurst((start.x + end.x) / 2, (start.y + end.y) / 2, 96, 0xff6a36);
        if (this.actor?.active && this.distanceToSegment(this.actor, start, end) <= 72) this.damagePlayer(Math.round(slime.damage * 1.05));
        app.audio?.fireExplosion?.(2);
        graphics.destroy();
      });
    }

    startStructuralBossDash(slime, points = []) {
      if (!slime?.active || slime.structuralDashing || !points.length) return;
      slime.structuralDashing = true;
      slime.state = "attack";
      slime.body?.setVelocity(0, 0);
      if (slime.body) slime.body.enable = false;
      this.playEnemyAnimation(slime, "phaseSpecial", true);
      const route = points.slice(0, 5);
      const moveNext = index => {
        if (!slime.active) return;
        if (index >= route.length) {
          slime.structuralDashing = false;
          slime.state = "move";
          if (slime.body) {
            slime.body.enable = true;
            slime.body.reset(slime.x, slime.y);
          }
          this.playEnemyAnimation(slime, "phaseMove", true);
          return;
        }
        const start = { x: slime.x, y: slime.y };
        const end = route[index];
        const duration = clamp(Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) / 1.65, 120, 360);
        this.tweens.add({
          targets: slime,
          x: end.x,
          y: end.y,
          duration,
          ease: "Cubic.easeInOut",
          onUpdate: () => slime.setDepth(slime.y + 30),
          onComplete: () => {
            this.createStructuralFirePath(slime, start, end);
            this.renderPhysicalImpactBurst(end.x, end.y, 62, 0x67eaff);
            moveNext(index + 1);
          }
        });
      };
      moveNext(0);
    }

    playLeafSlimeHit(slime, baseDamage = MELEE.damage, options = {}) {
      if (slime.transforming || (slime.state === "hit" && !options.allowComboHit) || slime.state === "dead" || slime.state === "vanish" || slime.state === "emerging") return 0;
      if (slime.textureKey === M04_STRUCTURAL_BOSS_KEY && slime.bossPhase === "charging") {
        this.showFloatingText(slime.x, slime.y + slime.hudOffsetY - 18, "能量罩吸收", {
          color: "#bff7ff",
          size: "22px",
          rise: 44,
          duration: 620
        });
        slime.energyShield?.setAlpha(0.58);
        this.time.delayedCall(90, () => slime.energyShield?.setAlpha(0.22));
        app.audio?.shield?.();
        return 0;
      }
      slime.provokedUntil = this.time.now + 12000;
      const result = this.rollPlayerDamage(baseDamage, slime, options.kind || "magic");
      slime.hp = Math.max(0, Number(slime.hp || 0) - result.amount);
      let energyGained = 0;
      if (!options.noEnergyGain && !options.charged) {
        energyGained = this.restoreEnergy(options.energyGain ?? ENERGY_HIT_GAIN, slime.x, slime.y);
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
      if (slime.textureKey === M04_STRUCTURAL_BOSS_KEY && Number(slime.bossForm || 1) < 2 && slime.hp <= slime.maxHp * 0.55) {
        slime.hp = Math.max(1, Math.ceil(slime.maxHp * 0.55));
        this.refreshEnemyHpBar(slime);
        this.triggerStructuralBossTransform(slime, {
          effect: {
            damageAmount: result.amount,
            critical: result.critical,
            hitKind: options.kind || "magic",
            energyGained
          }
        });
        return result.amount;
      }
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      const defeated = slime.hp <= 0;
      slime.state = "hit";
      this.broadcastEnemyState(slime, defeated ? "dead" : "hit", {
        damageAmount: result.amount,
        critical: result.critical,
        hitKind: options.kind || "magic",
        energyGained
      });
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
      return result.amount;
    }

    killLeafSlime(slime) {
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "dead";
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
      const canAdvanceEncounter = this.getCurrentMapId() !== M04_MAP_ID || this.isEncounterCoordinator();
      if (canAdvanceEncounter) {
        if (slime.groupId === BOSS_SUMMON_GROUP) this.updateBossSummonState();
        else this.checkEncounterClear(slime.groupId);
      }
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
      if (incoming > 0 || blocked > 0) {
        this.broadcastCombatEvent("playerStatus", {
          x: this.actor.x,
          y: this.actor.y,
          damageAmount: Math.ceil(incoming),
          shieldSpent: Math.ceil(blocked),
          down: app.profile.hp <= 0
        });
      }
      renderHud();
      app.audio.playerHit();
      const berserkActive = app.profile?.characterId === "laodeng" && this.time.now < this.berserkUntil;
      if (incoming > 0 && berserkActive) {
        const token = (this.actorBerserkHitToken || 0) + 1;
        this.actorBerserkHitToken = token;
        this.actor.setTint(0xff7a45);
        this.cameras.main.shake(55, 0.0018);
        this.time.delayedCall(90, () => {
          if (this.actor?.active && this.actorBerserkHitToken === token) this.actor.clearTint();
        });
      } else if (incoming > 0) this.playActorHitReaction();
      if (app.profile.hp <= 0) {
        this.isDead = true;
        this.isCatJumping = false;
        this.isTransforming = false;
        this.cancelPrimaryActionHold();
        this.isActionLocked = false;
        this.isCasting = false;
        this.networkAction = "death";
        this.actor.body.setVelocity(0, 0);
        this.enemyProjectiles?.clear(true, true);
        this.actor.play(`${app.profile.characterId}-death-once`, true);
        renderReviveDialog(true);
        showToast("角色倒下了，点击复活后继续探索");
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
      this.enemyProjectiles?.clear(true, true);
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

    tryTriggerEnemyLightSkill(slime, time) {
      if (!slime?.active || !this.actor?.active || this.isDead) return false;
      if (slime.enemyArchetype) {
        if (slime.networkReplica || (app.connected && !slime.isBossSummon && !this.isEncounterCoordinator())) return false;
        const cooldown = slime.rank === "boss"
          ? (Number(slime.bossForm || 1) >= 2 ? 2250 : 2850)
          : slime.rank === "rare"
            ? 3600
            : slime.rank === "elite"
              ? 4300
              : 5500;
        if (time - Number(slime.lastLightSkillAt || -cooldown) < cooldown) return false;
        slime.lastLightSkillAt = time;
        this.triggerAnimatedEnemySkill(slime);
        return true;
      }
      if (slime.rank === "rare" || slime.rank === "elite") {
        const cooldown = slime.rank === "rare" ? 4200 : 5200;
        if (time - Number(slime.lastLightSkillAt || -cooldown) < cooldown) return false;
        slime.lastLightSkillAt = time;
        this.triggerRareLightSkill(slime);
        return true;
      }
      if (slime.rank !== "boss") return false;
      const cooldown = 3000;
      if (time - Number(slime.lastLightSkillAt || -cooldown) < cooldown) return false;
      slime.lastLightSkillAt = time;
      slime.specialSkillIndex = Number(slime.specialSkillIndex || 0) + 1;
      if (slime.specialSkillIndex % 2) this.triggerBossMultiLineSkill(slime);
      else this.triggerBossRandomAreaSkill(slime);
      return true;
    }

    getAnimatedEnemySkillId(slime) {
      const cycle = Number(slime.specialSkillIndex || 0);
      const skills = {
        gardenHound: ["thornPounce"],
        gardenMoth: ["pollenFan"],
        gardenGardener: ["rootPrison"],
        moonOrchid: ["moonCrescent", "moonMirror"],
        carnivora: ["thornMaze", "devourRing"],
        quantumScholar: ["quantumInterference"],
        quantumFamiliar: ["phasePounce"],
        quantumPaper: ["probabilityCut"],
        chainBeast: ["chainRush"],
        validationLock: ["validationBurst"],
        chainSpider: ["chainMine"],
        agentMage: ["promptLance"],
        digitalCat: ["agentBlink"],
        botCat: ["toolCall"],
        structuralBoss: Number(slime.bossForm || 1) >= 2
          ? ["shearCross", "torsionField"]
          : ["loadCollapse", "trussFan"]
      };
      const options = skills[slime.enemyArchetype] || ["probabilityCut"];
      return options[cycle % options.length];
    }

    getAnimatedEnemySkillKind(skillId) {
      if (["thornPounce", "phasePounce", "chainRush", "agentBlink"].includes(skillId)) return "dash";
      if (["rootPrison", "thornMaze", "devourRing", "validationBurst", "chainMine", "toolCall", "loadCollapse", "torsionField", "moonMirror"].includes(skillId)) return "zone";
      return "beam";
    }

    getAnimatedEnemySkillAction(skillId) {
      if (skillId === "devourRing") return "devour";
      if (["thornMaze", "moonMirror", "torsionField"].includes(skillId)) return "special";
      return "attack";
    }

    getAnimatedEnemySkillMultiplier(skillId) {
      if (["loadCollapse", "shearCross", "torsionField", "trussFan"].includes(skillId)) return 1.72;
      if (["thornMaze", "devourRing", "moonMirror"].includes(skillId)) return 1.48;
      if (["thornPounce", "chainRush", "agentBlink"].includes(skillId)) return 1.34;
      return 1.24;
    }

    createAnimatedEnemySkillPlan(slime, skillId) {
      const kind = this.getAnimatedEnemySkillKind(skillId);
      const origin = { x: slime.x, y: slime.y - Math.min(86, Math.max(28, slime.displayHeight * 0.2)) };
      const target = { x: this.actor.x, y: this.actor.y - 34 };
      const hazardBonus = Math.max(0, Number(slime.hazardBonus) || 0);
      const points = [];
      if (kind === "zone") {
        const count = Math.min(8, (skillId === "loadCollapse" ? 5 : skillId === "torsionField" ? 7 : 3) + hazardBonus);
        for (let index = 0; index < count; index += 1) {
          const angle = Math.PI * 2 * index / Math.max(1, count) + (skillId === "thornMaze" ? 0.32 : 0);
          const distance = index === 0 ? 0 : 74 + (index % 3) * 54;
          points.push({
            x: clamp(target.x + Math.cos(angle) * distance, 70, this.worldWidth - 70),
            y: clamp(target.y + 34 + Math.sin(angle) * distance * 0.72, 90, this.worldHeight - 70)
          });
        }
        return { kind, points, radius: skillId === "torsionField" ? 104 : 82 };
      }
      const aim = Math.atan2(target.y - origin.y, target.x - origin.x);
      if (kind === "dash") {
        const distance = skillId === "agentBlink" ? 440 : 360;
        points.push(origin, {
          x: clamp(origin.x + Math.cos(aim) * distance, 70, this.worldWidth - 70),
          y: clamp(origin.y + Math.sin(aim) * distance, 90, this.worldHeight - 70)
        });
        return { kind, points, radius: 50 };
      }
      const lineCount = Math.min(6, (skillId === "shearCross" ? 4 : skillId === "trussFan" ? 5 : 3) + Math.min(2, hazardBonus));
      const offsets = lineCount === 4 && skillId === "shearCross"
        ? [-Math.PI / 2, 0, Math.PI / 2, Math.PI]
        : Array.from({ length: lineCount }, (_, index) => (index - (lineCount - 1) / 2) * (skillId === "pollenFan" ? 0.22 : 0.14));
      offsets.forEach(offset => {
        const angle = skillId === "shearCross" ? aim + offset + Math.PI / 4 : aim + offset;
        points.push(origin, {
          x: clamp(origin.x + Math.cos(angle) * 790, 40, this.worldWidth - 40),
          y: clamp(origin.y + Math.sin(angle) * 790, 60, this.worldHeight - 40)
        });
      });
      return { kind, points, radius: skillId === "shearCross" ? 42 : 34 };
    }

    playAnimatedEnemySkillPlan(slime, skillId, points, radius, options = {}) {
      const kind = this.getAnimatedEnemySkillKind(skillId);
      const profile = this.getEnemyMagicProfile(slime);
      const impactDelay = kind === "dash" ? 430 : kind === "zone" ? 680 : 570;
      const warning = this.add.graphics().setDepth(Math.max(slime?.y || 0, ...points.map(point => point.y)) + 96);
      if (kind === "zone") {
        points.forEach((point, index) => {
          warning.lineStyle(index === 0 ? 5 : 3, profile.warning, index === 0 ? 0.8 : 0.58);
          warning.strokeEllipse(point.x, point.y, radius * 2, radius * 1.16);
          warning.lineStyle(1, profile.core, 0.66);
          warning.lineBetween(point.x - radius * 0.52, point.y, point.x + radius * 0.52, point.y);
          warning.lineBetween(point.x, point.y - radius * 0.34, point.x, point.y + radius * 0.34);
        });
      } else {
        for (let index = 0; index < points.length; index += 2) {
          const start = points[index];
          const end = points[index + 1];
          if (!start || !end) continue;
          warning.lineStyle(kind === "dash" ? 10 : 4, profile.shadow, 0.25);
          warning.lineBetween(start.x, start.y, end.x, end.y);
          warning.lineStyle(kind === "dash" ? 3 : 1.5, profile.warning, 0.82);
          warning.lineBetween(start.x, start.y, end.x, end.y);
        }
      }
      this.tweens.add({ targets: warning, alpha: 0.18, duration: 150, yoyo: true, repeat: 2 });
      this.time.delayedCall(impactDelay, () => {
        warning.destroy();
        if (options.token && (!slime?.active || slime.actionToken !== options.token)) return;
        let hit = false;
        if (kind === "zone") {
          points.forEach(point => {
            this.renderEnemyAreaBurst(point.x, point.y, profile);
            if (this.actor?.active && Phaser.Math.Distance.Between(this.actor.x, this.actor.y, point.x, point.y) <= radius) hit = true;
          });
        } else {
          for (let index = 0; index < points.length; index += 2) {
            const start = points[index];
            const end = points[index + 1];
            if (!start || !end) continue;
            this.renderEnemyEnergyBeam(start, end, profile, kind === "dash" ? 230 : 340);
            if (this.actor?.active && this.distanceToSegment(this.actor.x, this.actor.y - 30, start, end) <= radius) hit = true;
          }
          if (kind === "dash" && slime?.active && options.token && points[1]) {
            const end = points[1];
            slime.body?.reset(end.x, end.y + 30);
            slime.setPosition(end.x, end.y + 30).setDepth(end.y + 36);
          }
        }
        if (hit && options.damage) this.damagePlayer(Math.round(Math.max(1, Number(slime?.damage) || 12) * this.getAnimatedEnemySkillMultiplier(skillId)));
        app.audio?.enemyAttack();
        if (["loadCollapse", "shearCross", "torsionField", "trussFan"].includes(skillId)) {
          app.audio?.fireExplosion?.(1);
          this.cameras.main.shake(190, 0.0048);
        } else this.cameras.main.shake(95, 0.0024);
      });
      return impactDelay + 420;
    }

    triggerAnimatedEnemySkill(slime) {
      slime.specialSkillIndex = Number(slime.specialSkillIndex || 0) + 1;
      const skillId = this.getAnimatedEnemySkillId(slime);
      const token = this.beginEnemySpecialSkill(slime);
      this.playEnemyAnimation(slime, this.getAnimatedEnemySkillAction(skillId), true);
      const plan = this.createAnimatedEnemySkillPlan(slime, skillId);
      this.broadcastCombatEvent("enemySkill", {
        enemyId: slime.slimeId,
        skillId,
        x: slime.x,
        y: slime.y,
        targetX: this.actor.x,
        targetY: this.actor.y,
        radius: plan.radius,
        points: plan.points
      });
      const duration = this.playAnimatedEnemySkillPlan(slime, skillId, plan.points, plan.radius, { damage: true, token });
      this.finishEnemySpecialSkill(slime, token, duration);
    }

    beginEnemySpecialSkill(slime) {
      slime.actionToken = (slime.actionToken || 0) + 1;
      slime.state = "attack";
      slime.body?.setVelocity(0, 0);
      this.playEnemyAnimation(slime, "attack", true);
      this.broadcastEnemyState(slime, "attack");
      app.audio?.enemyAttack();
      return slime.actionToken;
    }

    finishEnemySpecialSkill(slime, token, delay = 760) {
      this.time.delayedCall(delay, () => {
        if (!slime?.active || slime.actionToken !== token || ["dead", "vanish"].includes(slime.state)) return;
        slime.state = "move";
        slime.body?.setVelocity(0, 0);
        this.playEnemyAnimation(slime, "move", true);
        this.broadcastEnemyState(slime, "move");
      });
    }

    getEnemyMagicProfile(slime) {
      const key = String(slime?.textureKey || "");
      const archetype = String(slime?.enemyArchetype || "");
      if (archetype === "structuralBoss") {
        const secondForm = Number(slime?.bossForm || 1) >= 2;
        return {
          kind: secondForm ? "fire" : "structural",
          primary: secondForm ? 0xff6a2c : 0x28bdd9,
          secondary: secondForm ? 0x4ce5f4 : 0xffb64d,
          core: 0xf4ffff,
          shadow: secondForm ? 0x572318 : 0x183b4c,
          warning: secondForm ? 0xff8b3d : 0x67eafa,
          particles: secondForm ? [0xff5524, 0xffb342, 0x59eafa] : [0x24bad8, 0xffb74f, 0xe8fbff]
        };
      }
      if (key.includes("garden") || key === GARDEN_CARNIVORA_BOSS_KEY) {
        return {
          kind: "poison",
          primary: 0x48b83e,
          secondary: 0x9ee64f,
          core: 0xdfff91,
          shadow: 0x173f22,
          warning: 0x8ad84c,
          particles: [0x37a83d, 0x79d947, 0xc7f36b]
        };
      }
      if (key.includes("quantum")) {
        return {
          kind: "quantum",
          primary: 0x43dff2,
          secondary: 0x8978ff,
          core: 0xf0ffff,
          shadow: 0x182f61,
          warning: 0x77efff,
          particles: [0x3bd9ea, 0x8874ff, 0xe8feff]
        };
      }
      if (key.includes("blockchain")) {
        return {
          kind: "fire",
          primary: 0xe96d28,
          secondary: 0xffc044,
          core: 0xffdf78,
          shadow: 0x55321a,
          warning: 0xffae3c,
          particles: [0xc95b24, 0xff982f, 0xffd76a]
        };
      }
      if (key.includes("aiagent")) {
        return {
          kind: "agent",
          primary: 0x8b65ef,
          secondary: 0x4ce3cf,
          core: 0xf0edff,
          shadow: 0x29204b,
          warning: 0xa78aff,
          particles: [0x7655d9, 0x55dbc7, 0xe9e3ff]
        };
      }
      return {
        kind: "shadow",
        primary: 0x69259e,
        secondary: 0xb942d0,
        core: 0xe59aff,
        shadow: 0x211039,
        warning: 0xa84dcc,
        particles: [0x542080, 0x9e36c2, 0xdd72ee]
      };
    }

    triggerRareLightSkill(slime) {
      const token = this.beginEnemySpecialSkill(slime);
      const profile = this.getEnemyMagicProfile(slime);
      const start = { x: slime.x, y: slime.y - Math.min(90, slime.displayHeight * 0.24) };
      const aim = normalizeVector(this.actor.x - start.x, this.actor.y - 44 - start.y);
      const end = { x: start.x + aim.x * 700, y: start.y + aim.y * 700 };
      const warning = this.add.graphics().setDepth(slime.y + 92);
      warning.lineStyle(7, profile.shadow, 0.2);
      warning.lineBetween(start.x, start.y, end.x, end.y);
      warning.lineStyle(2, profile.warning, 0.82);
      warning.lineBetween(start.x, start.y, end.x, end.y);
      this.tweens.add({ targets: warning, alpha: 0.35, duration: 180, yoyo: true, repeat: 1 });
      this.time.delayedCall(430, () => {
        warning.destroy();
        if (!slime.active || slime.actionToken !== token) return;
        this.renderEnemyEnergyBeam(start, end, profile, 280);
        if (this.distanceToSegment(this.actor.x, this.actor.y - 36, start, end) <= 34) {
          this.damagePlayer(Math.round(slime.damage * (slime.rank === "rare" ? 1.35 : 1.22)));
        }
        this.cameras.main.shake(90, 0.0022);
      });
      this.finishEnemySpecialSkill(slime, token, 720);
    }

    triggerBossMultiLineSkill(slime) {
      const token = this.beginEnemySpecialSkill(slime);
      const profile = this.getEnemyMagicProfile(slime);
      const start = { x: slime.x, y: slime.y - Math.min(110, slime.displayHeight * 0.24) };
      const base = Math.atan2(this.actor.y - 44 - start.y, this.actor.x - start.x);
      const lines = [-0.34, -0.17, 0, 0.17, 0.34].map(offset => ({
        start,
        end: { x: start.x + Math.cos(base + offset) * 860, y: start.y + Math.sin(base + offset) * 860 }
      }));
      const warning = this.add.graphics().setDepth(slime.y + 96);
      lines.forEach((line, index) => {
        warning.lineStyle(index === 2 ? 5 : 2, profile.warning, index === 2 ? 0.58 : 0.34);
        warning.lineBetween(line.start.x, line.start.y, line.end.x, line.end.y);
      });
      this.tweens.add({ targets: warning, alpha: 0.12, duration: 170, yoyo: true, repeat: 2 });
      this.time.delayedCall(620, () => {
        warning.destroy();
        if (!slime.active || slime.actionToken !== token) return;
        let hit = false;
        lines.forEach((line, index) => {
          this.renderEnemyEnergyBeam(line.start, line.end, profile, index === 2 ? 390 : 330);
          if (this.distanceToSegment(this.actor.x, this.actor.y - 36, line.start, line.end) <= 30) hit = true;
        });
        if (hit) this.damagePlayer(Math.round(slime.damage * 1.5));
        this.cameras.main.shake(180, 0.0035);
      });
      this.finishEnemySpecialSkill(slime, token, 980);
    }

    triggerBossRandomAreaSkill(slime) {
      const token = this.beginEnemySpecialSkill(slime);
      const profile = this.getEnemyMagicProfile(slime);
      const pointCount = slime.textureKey === GARDEN_CARNIVORA_BOSS_KEY ? 10 : 6;
      const points = Array.from({ length: pointCount }, (_, index) => {
        const angle = Math.PI * 2 * index / pointCount + Math.random() * 0.5;
        const distance = index === 0 ? 35 : 85 + Math.random() * 190;
        return {
          x: clamp(this.actor.x + Math.cos(angle) * distance, 80, this.worldWidth - 80),
          y: clamp(this.actor.y + Math.sin(angle) * distance, 100, this.worldHeight - 80)
        };
      });
      const warnings = points.map(point => {
        const cross = this.add.graphics().setPosition(point.x, point.y).setDepth(point.y + 96);
        cross.lineStyle(6, profile.shadow, 0.28);
        cross.lineBetween(-42, 0, 42, 0);
        cross.lineBetween(0, -24, 0, 24);
        cross.lineStyle(2, profile.warning, 0.82);
        cross.lineBetween(-24, -16, 24, 16);
        cross.lineBetween(-24, 16, 24, -16);
        this.tweens.add({ targets: cross, scale: 1.28, alpha: 0.18, duration: 230, yoyo: true, repeat: 1 });
        return cross;
      });
      this.time.delayedCall(720, () => {
        warnings.forEach(item => item.destroy());
        if (!slime.active || slime.actionToken !== token) return;
        let hit = false;
        points.forEach(point => {
          this.renderEnemyAreaBurst(point.x, point.y, profile);
          if (Phaser.Math.Distance.Between(this.actor.x, this.actor.y, point.x, point.y) <= 82) hit = true;
        });
        if (hit) this.damagePlayer(Math.round(slime.damage * 1.65));
        this.cameras.main.shake(210, 0.004);
      });
      this.finishEnemySpecialSkill(slime, token, 1080);
    }

    renderEnemyEnergyBeam(start, end, profile, duration) {
      const depth = Math.max(start.y, end.y) + 104;
      const length = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
      const segments = Math.max(8, Math.ceil(length / 56));
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const normal = normalizeVector(-dy, dx);
      const points = [{ x: start.x, y: start.y }];
      for (let index = 1; index < segments; index += 1) {
        const t = index / segments;
        const jitter = Phaser.Math.FloatBetween(-1, 1) * (profile.kind === "shadow" ? 12 : 7) * Math.sin(Math.PI * t);
        points.push({
          x: Phaser.Math.Linear(start.x, end.x, t) + normal.x * jitter,
          y: Phaser.Math.Linear(start.y, end.y, t) + normal.y * jitter
        });
      }
      points.push({ x: end.x, y: end.y });
      const layers = [
        { width: 24, color: profile.shadow, alpha: 0.3, blend: Phaser.BlendModes.NORMAL },
        { width: 11, color: profile.primary, alpha: 0.92, blend: Phaser.BlendModes.NORMAL },
        { width: 6, color: profile.secondary, alpha: 0.78, blend: Phaser.BlendModes.ADD },
        { width: 2, color: profile.core, alpha: 0.96, blend: Phaser.BlendModes.ADD }
      ];
      layers.forEach((style, layerIndex) => {
        const beam = this.add.graphics().setDepth(depth + layerIndex).setBlendMode(style.blend);
        beam.lineStyle(style.width, style.color, style.alpha);
        beam.beginPath();
        points.forEach((point, index) => index ? beam.lineTo(point.x, point.y) : beam.moveTo(point.x, point.y));
        beam.strokePath();
        this.tweens.add({ targets: beam, alpha: 0, delay: layerIndex ? 0 : 70, duration, ease: "Cubic.easeOut", onComplete: () => beam.destroy() });
      });
      for (let index = 0; index < 28; index += 1) {
        const t = index / 27;
        const texture = profile.kind === "fire" && index % 2 === 0 ? LIGHTNING_SPARK_TEXTURE_KEY : LIGHTNING_MOTE_TEXTURE_KEY;
        const mote = this.add.image(Phaser.Math.Linear(start.x, end.x, t), Phaser.Math.Linear(start.y, end.y, t), texture)
          .setTint(profile.particles[index % profile.particles.length])
          .setScale(0.2 + Math.random() * 0.28)
          .setDepth(depth + 5)
          .setBlendMode(index % 3 ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: mote,
          x: mote.x + normal.x * Phaser.Math.Between(-28, 28),
          y: mote.y + normal.y * Phaser.Math.Between(-28, 28) - (profile.kind === "fire" ? Phaser.Math.Between(8, 26) : 0),
          angle: Phaser.Math.Between(-120, 120),
          alpha: 0,
          scale: 0.05,
          duration: duration + Math.random() * 180,
          onComplete: () => mote.destroy()
        });
      }
      return length;
    }

    renderEnemyAreaBurst(x, y, profile) {
      const residue = this.add.graphics().setPosition(x, y).setDepth(y + 104);
      const highlights = this.add.graphics().setPosition(x, y).setDepth(y + 106).setBlendMode(Phaser.BlendModes.ADD);
      const pathCount = profile.kind === "poison" ? 20 : 16;
      for (let index = 0; index < pathCount; index += 1) {
        const angle = Math.PI * 2 * index / pathCount + Phaser.Math.FloatBetween(-0.2, 0.2);
        const length = 44 + Math.random() * 72;
        const points = [
          { x: 0, y: 0 },
          { x: Math.cos(angle + 0.14) * length * 0.42, y: Math.sin(angle + 0.14) * length * 0.24 },
          { x: Math.cos(angle - 0.1) * length * 0.72, y: Math.sin(angle - 0.1) * length * 0.46 },
          { x: Math.cos(angle) * length, y: Math.sin(angle) * length * 0.68 }
        ];
        const stroke = (graphics, width, color, alpha) => {
          graphics.lineStyle(width, color, alpha);
          graphics.beginPath();
          points.forEach((point, pointIndex) => pointIndex ? graphics.lineTo(point.x, point.y) : graphics.moveTo(point.x, point.y));
          graphics.strokePath();
        };
        stroke(residue, index % 3 === 0 ? 9 : 6, profile.shadow, 0.36);
        stroke(residue, index % 3 === 0 ? 4 : 2.5, profile.primary, 0.9);
        stroke(highlights, index % 4 === 0 ? 2 : 1, profile.core, 0.78);
      }
      for (let plume = 0; plume < 9; plume += 1) {
        const offsetX = (plume - 4) * 9 + Phaser.Math.Between(-5, 5);
        residue.lineStyle(7, profile.primary, 0.38);
        residue.lineBetween(offsetX, 8, offsetX + Phaser.Math.Between(-22, 22), -48 - plume % 3 * 20);
        highlights.lineStyle(2, profile.secondary, 0.8);
        highlights.lineBetween(offsetX, 8, offsetX + Phaser.Math.Between(-22, 22), -48 - plume % 3 * 20);
      }
      this.tweens.add({ targets: highlights, scale: 1.28, alpha: 0, duration: 420, ease: "Cubic.easeOut", onComplete: () => highlights.destroy() });
      this.tweens.add({ targets: residue, scale: 1.2, alpha: 0, delay: profile.kind === "poison" ? 520 : 180, duration: 620, ease: "Cubic.easeOut", onComplete: () => residue.destroy() });
      for (let index = 0; index < 34; index += 1) {
        const angle = Math.PI * 2 * index / 34 + Math.random() * 0.2;
        const texture = profile.kind === "fire" && index % 2 === 0 ? LIGHTNING_SPARK_TEXTURE_KEY : LIGHTNING_MOTE_TEXTURE_KEY;
        const mote = this.add.image(x, y, texture)
          .setTint(profile.particles[index % profile.particles.length])
          .setScale(0.25 + Math.random() * 0.28)
          .setDepth(y + 108)
          .setBlendMode(index % 4 ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(angle) * (54 + Math.random() * 72),
          y: y + Math.sin(angle) * (34 + Math.random() * 48) - (profile.kind === "fire" ? 34 : profile.kind === "poison" ? 16 : 0),
          angle: Phaser.Math.Between(-160, 160),
          alpha: 0,
          scale: 0.04,
          duration: 420 + Math.random() * 260,
          ease: "Cubic.easeOut",
          onComplete: () => mote.destroy()
        });
      }
    }

    distanceToSegment(px, py, start, end) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const t = clamp(((px - start.x) * dx + (py - start.y) * dy) / lengthSquared, 0, 1);
      return Math.hypot(px - (start.x + dx * t), py - (start.y + dy * t));
    }

    triggerRangedEnemyAttack(slime, dx, dy) {
      const now = this.time.now;
      if (!slime.rangedAttack || now - slime.lastRangedAttackAt < slime.rangedCooldown) return;
      slime.lastRangedAttackAt = now;
      slime.actionToken = (slime.actionToken || 0) + 1;
      const token = slime.actionToken;
      slime.state = "attack";
      slime.body.setVelocity(0, 0);
      app.audio?.enemyAttack();
      const originY = slime.y - Math.min(92, Math.max(38, slime.displayHeight * 0.24));
      const warning = this.add.circle(slime.x, originY, 18, slime.projectileColor, 0.22)
        .setStrokeStyle(3, slime.projectileColor, 0.88)
        .setDepth(slime.y + 82);
      this.tweens.add({
        targets: warning,
        radius: 42,
        alpha: 0.05,
        duration: 260,
        ease: "Sine.easeOut",
        onComplete: () => {
          warning.destroy();
          if (!slime.active || slime.actionToken !== token || !this.actor?.active || this.isDead) {
            if (slime?.active) slime.state = "move";
            return;
          }
          const aim = normalizeVector(this.actor.x - slime.x, this.actor.y - originY);
          const projectile = this.enemyProjectiles.create(slime.x, originY, ENEMY_SEED_PROJECTILE_KEY)
            .setDepth(slime.y + 84)
            .setTint(slime.projectileColor);
          projectile.body.setAllowGravity(false);
          projectile.body.setCircle(12, 6, 6);
          projectile.body.setVelocity(aim.x * slime.projectileSpeed, aim.y * slime.projectileSpeed);
          projectile.damage = slime.damage;
          projectile.spawnedAt = this.time.now;
          projectile.setAngularVelocity(220);
          slime.state = "move";
        }
      });
    }

    updateEnemyProjectiles(time) {
      if (this.isDead) {
        this.enemyProjectiles?.clear(true, true);
        return;
      }
      this.enemyProjectiles?.children?.each(projectile => {
        if (!projectile?.active) return;
        projectile.setDepth(projectile.y + 36);
        const expired = time - Number(projectile.spawnedAt || time) > ENEMY_PROJECTILE_LIFETIME_MS;
        const outside = projectile.x < -48 || projectile.y < -48
          || projectile.x > this.worldWidth + 48 || projectile.y > this.worldHeight + 48;
        if (expired || outside) projectile.destroy();
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
      const bounds = slime.patrolBounds || config.spawnBounds || {};
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
      if (slime.passiveWander && distance <= slime.aggroRange) {
        slime.provokedUntil = Math.max(Number(slime.provokedUntil || 0), this.time.now + 3200);
      }
      const provoked = !slime.passiveWander || distance <= slime.aggroRange || this.time.now < slime.provokedUntil;
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
      if (this.isDead) {
        slimes.forEach(slime => slime?.body?.setVelocity(0, 0));
        return;
      }
      slimes.forEach(slime => {
        if (!slime?.active || !this.actor?.active) return;
        slime.setDepth(slime.y + 6);
        this.updateEnemyHud(slime);
        if (slime.textureKey === M04_STRUCTURAL_BOSS_KEY && slime.bossPhase === "charging") {
          this.updateStructuralBossCharging(slime, time);
          return;
        }
        if (slime.textureKey === M04_STRUCTURAL_BOSS_KEY && slime.bossPhase === "phase3") {
          this.updateStructuralBossPhaseThree(slime, time, delta);
          return;
        }
        if (time < Number(slime.tornadoPullUntil || 0)) return;
        if (["hit", "dead", "vanish", "attack", "hop", "emerging"].includes(slime.state)) return;
        const dx = this.actor.x - slime.x;
        const dy = this.actor.y - slime.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= slime.aggroRange && this.tryTriggerEnemyLightSkill(slime, time)) return;
        if (slime.stationary) {
          slime.body.setVelocity(0, 0);
          if (slime.rangedAttack && distance <= Math.min(slime.rangedRange, slime.aggroRange)) this.triggerRangedEnemyAttack(slime, dx, dy);
          return;
        }
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
      const beforeShield = Number(app.profile.shield || 0);
      app.profile.hp = Math.min(app.profile.maxHp, app.profile.hp + 42);
      const healed = app.profile.hp - before;
      app.profile.shield = Math.min(Math.max(36, app.profile.maxHp * 0.28), Number(app.profile.shield || 0) + 36);
      const shieldGain = Math.max(0, Number(app.profile.shield || 0) - beforeShield);
      if (app.profile.hp > 0 && this.isDead) {
        this.revivePlayer();
        return;
      }
      app.audio.heal();
      this.playHealEffect(this.actor?.x || 0, this.actor?.y || 0);
      this.playShieldEffect(this.actor?.x || 0, this.actor?.y || 0, false);
      if (healed > 0) this.showFloatingText(this.actor.x, this.actor.y - 122, `+${Math.ceil(healed)}`, { color: "#7dffbd", size: "20px", rise: 56 });
      if (shieldGain > 0) this.showFloatingText(this.actor.x, this.actor.y - 96, `护盾 +${Math.ceil(shieldGain)}`, { color: "#bff7ff", size: "15px", rise: 42 });
      this.broadcastCombatEvent("playerStatus", {
        x: this.actor.x,
        y: this.actor.y,
        healAmount: Math.ceil(healed),
        shieldGain: Math.ceil(shieldGain)
      });
      renderHud();
    }

    handleHotkey(event) {
      if (app.cinematicActive) {
        if (String(event.key || "").toLowerCase() === "escape") finishChapterEndCinematic(true);
        return;
      }
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
        if (projectile.trail.length > (projectile.visualType === "lightningOrb" ? 7 : projectile.visualType === "windBolt" ? 9 : 7)) projectile.trail.shift();
        if (projectile.visualType === "lightningOrb") {
          projectile.trail.forEach((point, index) => {
            const progress = (index + 1) / projectile.trail.length;
            this.projectileGraphics.fillStyle(index % 2 ? 0x195fff : 0x46d6ff, progress * 0.2);
            this.projectileGraphics.fillCircle(point.x, point.y, 0.8 + progress * 2.8);
          });
        } else if (projectile.visualType === "windBolt") {
          const windDirection = normalizeVector(vx, vy);
          const windNormal = { x: -windDirection.y, y: windDirection.x };
          projectile.trail.forEach((point, index) => {
            const progress = (index + 1) / projectile.trail.length;
            const length = 8 + progress * 18;
            this.projectileGraphics.lineStyle(1 + progress * 2.4, index % 3 ? 0x5fda7f : 0xdcffc0, progress * 0.34);
            this.projectileGraphics.lineBetween(point.x - windDirection.x * length, point.y - windDirection.y * length, point.x, point.y);
          });
          if (this.time.now - projectile.lastTrailSparkAt > 55) {
            projectile.lastTrailSparkAt = this.time.now;
            const isLeaf = Math.random() < 0.24;
            const mote = this.add.image(projectile.x, projectile.y, isLeaf ? WIND_LEAF_TEXTURE_KEY : WIND_MOTE_TEXTURE_KEY)
              .setScale(0.28 + Math.random() * 0.22)
              .setRotation(projectile.visualRotation + Math.random() - 0.5)
              .setTint(isLeaf ? 0x4bb96b : 0xb8ffa1)
              .setDepth(projectile.y + 8);
            const side = Phaser.Math.FloatBetween(-1, 1) * 22;
              this.tweens.add({ targets: mote, x: mote.x + windNormal.x * side - windDirection.x * 18, y: mote.y + windNormal.y * side - windDirection.y * 18, alpha: 0, angle: mote.angle + 110, duration: 250, onComplete: () => mote.destroy() });
            }
        } else if (projectile.visualType?.startsWith("arrow")) {
          const direction = normalizeVector(vx, vy);
          const heavyArrow = projectile.visualType === "arrowHeavy";
          const barrageArrow = projectile.visualType === "arrowBarrage";
          projectile.trail.forEach((point, index) => {
            const progress = (index + 1) / projectile.trail.length;
            const length = (heavyArrow ? 32 : barrageArrow ? 10 : 17) * progress;
            this.projectileGraphics.lineStyle(heavyArrow ? 3.2 : barrageArrow ? 1.1 : 1.7, heavyArrow ? 0xb9ecff : barrageArrow ? 0xd99a50 : 0xe8d49a, progress * (barrageArrow ? 0.24 : 0.34));
            this.projectileGraphics.lineBetween(point.x - direction.x * length, point.y - direction.y * length, point.x, point.y);
          });
          if (heavyArrow && this.time.now - projectile.lastTrailSparkAt > 72) {
            projectile.lastTrailSparkAt = this.time.now;
            this.emitPhysicalSparks(projectile.x, projectile.y, 3, 0xb9ecff);
          }
        } else if (projectile.visualType === "swordWave") {
          const direction = normalizeVector(vx, vy);
          projectile.trail.forEach((point, index) => {
            const progress = (index + 1) / projectile.trail.length;
            this.projectileGraphics.lineStyle(2 + progress * 3.4, index % 2 ? 0x75c9f3 : 0xe6f8ff, progress * 0.24);
            this.projectileGraphics.lineBetween(point.x - direction.x * (22 + progress * 34), point.y - direction.y * (22 + progress * 34), point.x, point.y);
          });
        } else {
          projectile.trail.forEach((point, index) => {
            const alpha = (index + 1) / projectile.trail.length * .18;
            this.projectileGraphics.fillStyle(projectile.color, alpha);
            this.projectileGraphics.fillCircle(point.x, point.y, Math.max(2, projectile.radius * 0.7 * (index + 1) / projectile.trail.length));
          });
        }
      });
    }

    hitBoss(projectile) {
      if (!app.boss.active || app.boss.hp <= 0) return;
      if (projectile.hitTargets?.has("boss")) return;
      projectile.hitTargets?.add("boss");
      const damage = this.applyJiangxunBarrageDamageRamp(projectile, "boss", projectile.damage || 18);
      if (!projectile.piercing) this.destroyProjectile(projectile, true);
      this.applyBossDamage(damage);
    }

    applyBossDamage(damage) {
      if (!app.boss.active || app.boss.hp <= 0) return;
      showToast("教授本体不参与战斗，先清除他召唤出的精英与小怪");
      app.audio.hit();
    }

    updateBoss(time) {
      if (app.boss.phase === "awaitingProfessor") {
        if (this.bossSprite?.visible) this.bossSprite.setDepth(this.bossSprite.y + 18);
        this.updateProfessorWaveProximity();
        return;
      }
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
      if (peer?.mapId && peer.mapId !== this.getCurrentMapId()) {
        this.removePeer(peer.id);
        return;
      }
      let remote = this.remotePlayers.get(peer.id);
      const character = getCharacter(peer.characterId);
      if (!remote) {
        const sprite = this.add.sprite(peer.x, peer.y, character.id, 0)
          .setOrigin(0.5, character.baseline / FRAME_SIZE)
          .setScale(PEER_DEFAULT_VISUAL_SCALE)
          .setAlpha(0.88)
          .setDepth(peer.y + 8);
        sprite.play(`${character.id}-idle`);
        const label = this.add.text(peer.x, peer.y - 128, playerDisplayName(peer), {
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
          shield: Math.max(0, Number(peer.shield || 0)),
          level: Math.max(1, Number(peer.level || 1)),
          down: false,
          hitFlashToken: 0,
          explicitStatusUntil: 0,
          flags: new Set(peer.flags || [])
        };
        this.remotePlayers.set(peer.id, remote);
      }
      remote.target = { x: peer.x, y: peer.y };
      remote.sprite.setFlipX(!!peer.flipX);
      remote.label.setText(playerDisplayName(peer));
      const previousHp = Math.max(0, Number(remote.hp || 0));
      const previousShield = Math.max(0, Number(remote.shield || 0));
      const nextMaxHp = Math.max(1, Number(peer.maxHp || remote.maxHp || 1));
      const nextHp = clamp(Number(peer.hp ?? nextMaxHp), 0, nextMaxHp);
      const nextShield = Math.max(0, Number(peer.shield ?? previousShield));
      const damageTaken = Math.max(0, previousHp - nextHp);
      const healedAmount = Math.max(0, nextHp - previousHp);
      const shieldSpent = Math.max(0, previousShield - nextShield);
      const tookDamage = damageTaken > 0;
      const statusVisualSuppressed = this.time.now < Number(remote.explicitStatusUntil || 0);
      remote.hp = nextHp;
      remote.maxHp = nextMaxHp;
      remote.shield = nextShield;
      remote.level = Math.max(1, Number(peer.level || remote.level || 1));
      remote.flags = new Set(peer.flags || []);
      remote.down = nextHp <= 0;
      const ratio = clamp(nextHp / nextMaxHp, 0, 1);
      remote.hpFill.setDisplaySize(Math.max(1, 48 * ratio), 4);
      remote.hpFill.setFillStyle(ratio > 0.45 ? 0x42c98a : ratio > 0.2 ? 0xf3c75d : 0xef7fb0, 0.92);
      remote.hpBg.setVisible(true);
      remote.hpFill.setVisible(nextHp > 0);
      if (shieldSpent > 0 && !statusVisualSuppressed) {
        this.playShieldEffect(remote.sprite.x, remote.sprite.y, true);
        this.showFloatingText(remote.sprite.x, remote.sprite.y - 116, `格挡 ${Math.ceil(shieldSpent)}`, {
          color: "#bff7ff",
          size: "17px",
          rise: 48
        });
      }
      if (damageTaken > 0 && !statusVisualSuppressed) {
        this.showFloatingText(remote.sprite.x, remote.sprite.y - 124, `-${Math.ceil(damageTaken)}`, {
          color: "#ff9ab4",
          size: "20px",
          rise: 58
        });
        this.emitPhysicalSparks(remote.sprite.x, remote.sprite.y - 48, 12, 0xff9ab4, remote.sprite.y + 220);
        app.audio.playerHit();
      } else if (healedAmount > 0 && !statusVisualSuppressed) {
        this.playFriendlyHealEffect(remote.sprite.x, remote.sprite.y, Math.ceil(healedAmount));
      }
      if (tookDamage && !statusVisualSuppressed) {
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
      this.refreshInteractionMarkerVisibility();
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
      if (app.profile?.characterId === "laodeng" && this.berserkUntil > 0 && time >= this.berserkUntil) {
        this.berserkUntil = 0;
        this.berserkAura?.destroy();
        this.berserkAura = null;
        this.resetActorVisualScale();
        const maxHp = Math.max(1, Number(app.profile.maxHp || 1));
        const before = Number(app.profile.hp || 0);
        app.profile.hp = Math.min(maxHp, before + Math.round(maxHp * 0.4));
        const healed = app.profile.hp - before;
        if (healed > 0) {
          this.showFloatingText(this.actor.x, this.actor.y - 126, `嗜血恢复 +${healed}`, { color: "#ffcf82", size: "20px", rise: 58 });
          this.playHealEffect(this.actor.x, this.actor.y);
          app.audio.heal();
          renderHud();
        }
        if (!this.berserkEndingShown) {
          this.berserkEndingShown = true;
          showToast("嗜血狂暴结束，恢复 40% 最大生命");
        }
      }
      this.restoreEnergy((Number(delta) || 16) / 1000 * ENERGY_REGEN_PER_SECOND, NaN, NaN, { silent: true });
      if (this.isHeavyDashing && !this.isDead) {
        // The physics body keeps its dash velocity so obstacle collisions can
        // stop the rush naturally without regular movement input overriding it.
      } else if (this.isActionLocked || this.isDead) {
        this.actor.body.setVelocity(0, 0);
      } else if (app.profile.hp > 0) {
        const { dx, dy, moving } = this.getMoveVector();
        const character = getCharacter(app.profile.characterId);
        if (moving) {
          const vec = normalizeVector(dx, dy);
          this.updateFacing(dx, dy);
          const berserkSpeed = app.profile.characterId === "laodeng" && time < this.berserkUntil ? 1.5 : 1;
          const speed = (this.isCat ? character.speed * 2 : character.speed) * berserkSpeed;
          this.actor.body.setVelocity(vec.x * speed, vec.y * speed);
          if (!this.isCasting && !this.isTransforming) this.playLoop("walk");
        } else {
          this.actor.body.setVelocity(0, 0);
          if (!this.isCasting && !this.isTransforming) this.playLoop("idle");
        }
      }
      this.actor.setDepth(this.actor.y + 8);
      if (this.berserkAura?.active) this.berserkAura.setPosition(this.actor.x, this.actor.y - 48).setDepth(this.actor.y - 14);
      this.updateProjectiles();
      this.updateEnemyProjectiles(time);
      this.updateLeafSlimes(time, delta);
      this.updateBoss(time);
      this.updateWorldDrops(time);
      this.updateBossChest(time);
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
        backgroundColor: "#101726",
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
    if (app.cinematicActive) finishChapterEndCinematic(false);
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
    const selector = ".skill[data-skill-id], .quickbar button[data-tooltip-title]";
    document.querySelectorAll(selector).forEach(button => {
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
      if (event.target.closest?.(selector)) return;
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
    bindAction("#mobileInteractButton", () => app.scene?.triggerInteraction());
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
    $("#reconnectButton")?.addEventListener("click", () => app.multiplayer?.connect());
    $("#exitButton").addEventListener("click", () => exitGame());
    $("#reviveButton").addEventListener("click", () => app.scene?.revivePlayer());
    $("#stayDownButton").addEventListener("click", () => renderReviveDialog(false));
    $("#storyDialogueNextButton")?.addEventListener("click", () => advanceStoryDialogue());
    $("#chapterClearCloseButton")?.addEventListener("click", () => renderChapterClearPanel(false));
    $("#chapterEndSkipButton")?.addEventListener("click", () => finishChapterEndCinematic(true));
    $("#chapterEndReplayButton")?.addEventListener("click", async event => {
      event.currentTarget.hidden = true;
      try {
        await $("#chapterEndVideo")?.play();
      } catch {
        event.currentTarget.hidden = false;
      }
    });
    $("#chapterEndVideo")?.addEventListener("ended", () => finishChapterEndCinematic(true));
    $("#chapterEndVideo")?.addEventListener("error", () => {
      if (!app.cinematicActive) return;
      showToast("结章动画加载失败，已进入通关结算");
      finishChapterEndCinematic(true);
    });
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
    initializeChapterEndCinematic();
    app.audio = new AudioEngine();
    app.multiplayer = new MultiplayerClient();
    bindUi();
    renderNetwork("未连接", false);
    renderBossHud();
  });
})();
