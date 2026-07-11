import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(root, "assets", "chapter1", "chapter1-maps-v1.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const map = registry.maps.ch1_m02_prompt_archive;

map.title = "提示词资料长廊";
map.background = {
  width: 3072,
  height: 1536,
  chunks: [
    {
      id: "ch1-m02-horizontal-left-v6",
      key: "ch1-m02-horizontal-left-v6",
      path: "assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-m02-horizontal-left-v6.png",
      x: 0,
      y: 0,
      width: 1536,
      height: 1536
    },
    {
      id: "ch1-m02-horizontal-right-v6",
      key: "ch1-m02-horizontal-right-v6",
      path: "assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-m02-horizontal-right-v6.png",
      x: 1536,
      y: 0,
      width: 1536,
      height: 1536
    }
  ]
};
map.spawn = {
  id: "ch1_m02_spawn_from_classroom",
  x: 220,
  y: 768,
  facing: "E"
};
map.spawnPoints = [
  { id: "ch1_m02_spawn_from_classroom", x: 220, y: 768, facing: "E" },
  { id: "ch1_m02_spawn_from_lab", x: 1536, y: 970, facing: "N" },
  { id: "ch1_m02_spawn_center_return", x: 1536, y: 768, facing: "S" }
];
map.camera = { startX: 500, startY: 768 };
map.props = [];
map.obstacles = [
  { id: "m02-north-archive-wall", x: 0, y: 0, w: 3072, h: 470 },
  { id: "m02-south-archive-wall-left", x: 0, y: 1140, w: 1420, h: 396 },
  { id: "m02-south-archive-wall-right", x: 1652, y: 1140, w: 1420, h: 396 },
  { id: "m02-center-south-gate-left", x: 1420, y: 1110, w: 55, h: 426 },
  { id: "m02-center-south-gate-right", x: 1597, y: 1110, w: 55, h: 426 }
];

const nodePositions = {
  ch1_m02_node_archive_npc: { x: 560, y: 690, hintY: 625, labelY: 600 },
  ch1_m02_node_citation_table: { x: 1270, y: 790, hintY: 720, labelY: 695 },
  ch1_m02_node_privacy_filter: { x: 1980, y: 690, hintY: 625, labelY: 600 },
  ch1_m02_node_copy_shadow: { x: 2450, y: 825, hintY: 825, labelY: 790 }
};
map.interactionNodes.forEach(node => {
  const position = nodePositions[node.id];
  if (!position) return;
  node.x = position.x;
  node.y = position.y;
  node.hintX = position.x;
  node.hintY = position.hintY;
  node.labelX = position.x;
  node.labelY = position.labelY;
});

const enemyPositions = {
  "ch1-m02-copy-shadow-a": { x: 2240, y: 650 },
  "ch1-m02-copy-shadow-b": { x: 2380, y: 965 },
  "ch1-m02-copy-shadow-c": { x: 2640, y: 680 },
  "ch1-m02-copy-shadow-d": { x: 2740, y: 960 }
};
map.enemySpawns.forEach(spawn => Object.assign(spawn, enemyPositions[spawn.id] || {}));

map.exitPoints = [
  {
    id: "ch1_m02_exit_back_m01",
    type: "teleport",
    label: "返回教室",
    x: 120,
    y: 768,
    radius: 92,
    targetMapId: "ch1_m01_classroom_spawn",
    targetSpawnId: "ch1_m01_spawn_from_archive"
  },
  {
    id: "ch1_m02_exit_to_m03",
    type: "teleport",
    label: "Agent 机房",
    x: 1536,
    y: 1080,
    radius: 92,
    visual: "portal",
    portalScale: 0.82,
    targetMapId: "ch1_m03_agent_lab",
    targetSpawnId: "ch1_m03_spawn_from_archive",
    requiresFlags: ["ch1_m02_copy_shadow_cleared"],
    setFlags: ["ch1_m03_unlocked"],
    lockedDialogueId: "ch1_m02_dialogue_exit_locked"
  }
];

const dialogues = Object.fromEntries(map.dialogues.map(dialogue => [dialogue.id, dialogue]));
dialogues.ch1_m02_dialogue_npc.lines = [
  "资料要能追溯，隐私要先过滤。沿长廊向右依次核验引用、检查过滤仪。"
];
dialogues.ch1_m02_dialogue_privacy_filter.lines = [
  "过滤阵列已经校准。继续向右清理复制阴影，完成后长廊中部下方的传送门会解锁。"
];
dialogues.ch1_m02_dialogue_exit_locked.lines = [
  "传送门仍被复制阴影污染。按索引台、引用核验、隐私过滤的顺序完成修复，再清理长廊右侧异常。"
];

map.foregroundOverlays = [];
map.minimapImage = {
  key: "ch1-m02-horizontal-minimap-v6",
  path: "assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-m02-horizontal-minimap-v6.jpg",
  width: 768,
  height: 384
};
map.version = "0.9.0-m1style-horizontal";
map.summary = "M1-style horizontal prompt archive with a restrained tiled floor, continuous library walls, left-to-right objectives, and a gated center-south route to M3.";

fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Updated ${map.id} to ${map.version}`);
