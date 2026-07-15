import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const m1 = registry.maps.ch1_m01_classroom_spawn;
const m2 = registry.maps.ch1_m02_prompt_archive;
const m3 = registry.maps.ch1_m03_agent_lab;
const m4 = registry.maps.ch1_m04_library_lawn_boss;
const m5 = registry.maps.ch1_m05_sakura_tongji_avenue;

const classroomDesks = m1.props.filter(prop => /^m01_desk_/.test(prop.id));
assert.equal(classroomDesks.length, 12);
assert.ok(classroomDesks.every(prop => prop.scale === 0.9));
assert.ok(classroomDesks.every(prop => prop.collision.w === 225 && prop.collision.h === 93.6));

assert.equal(m2.background.width, 3072);
assert.equal(m2.background.height, 1024);
assert.equal(m2.background.chunks.length, 2);
assert.ok(m2.background.chunks.every(chunk => chunk.width === 1536 && chunk.height === 1024));
assert.ok(m2.background.chunks.every(chunk => /-v7\.webp$/.test(chunk.path)));

assert.equal(m3.title, "樱庭生态园");
assert.equal(m3.background.chunks, undefined, "M3 must use one coherent background");
assert.match(m3.background.path, /botanical-garden/);
assert.match(m3.background.path, /-v3\.webp$/, "M3 must use the optimized academy botanical garden background");
assert.equal(m3.background.width, 3072, "M3 must provide a wide combat arena");
assert.equal(m3.background.height, 2048);
const gardenPointBlocked = (x, y) => (m3.obstacles || []).some(obstacle =>
  x >= obstacle.x && x <= obstacle.x + obstacle.w && y >= obstacle.y && y <= obstacle.y + obstacle.h
);
assert.equal(gardenPointBlocked(800, 1500), false, "M3 west lawn and curved path must remain walkable");
assert.equal(gardenPointBlocked(2270, 1500), false, "M3 east lawn and curved path must remain walkable");
assert.equal(gardenPointBlocked(1536, 1880), false, "M3 south entrance must have a generous opening");
assert.ok(!(m3.obstacles || []).some(obstacle => /flowerbed/.test(obstacle.id)), "Decorative flowerbeds must not block broad lawn movement");

const gardenEnemies = m3.enemySpawns.filter(enemy => /garden/.test(enemy.textureKey || ""));
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "elite").length, 3);
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "rare").length, 1);
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "boss").length, 1);
assert.ok(gardenEnemies.filter(enemy => enemy.rank === "elite").every(enemy => enemy.patrolBounds));
assert.ok(gardenEnemies.every(enemy => /garden/.test(enemy.textureKey)));
assert.ok(gardenEnemies.every(enemy => enemy.staticImage === false), "M3 unique monsters must use animated sprite sheets");

const carnivora = gardenEnemies.find(enemy => enemy.rank === "boss");
assert.equal(carnivora.stationary, true);
assert.equal(carnivora.rangedAttack, true);
assert.ok(carnivora.rangedRange >= 700);
assert.ok(Math.abs(carnivora.x - m3.background.width / 2) < 8);
assert.ok((m3.obstacles || []).every(obstacle => {
  const centerX = m3.background.width / 2;
  const centerY = carnivora.y;
  return !(centerX >= obstacle.x && centerX <= obstacle.x + obstacle.w
    && centerY >= obstacle.y && centerY <= obstacle.y + obstacle.h);
}), "M3 boss center must remain unobstructed");

const m3ToM4 = m3.exitPoints.find(exit => exit.targetMapId === "ch1_m04_library_lawn_boss");
assert.ok(m3ToM4.requiresFlags.includes("ch1_m03_small_boss_cleared"));

assert.equal(m4.title, "结构力学实验室终期考核");
assert.equal(m4.background.width, 3762);
assert.equal(m4.background.height, 2508);
assert.equal(m4.background.chunks.length, 4, "M4 must use four native L-shaped lab panels");
assert.deepEqual(
  m4.background.chunks.map(chunk => [chunk.x, chunk.y]),
  [[0, 0], [1254, 0], [2508, 0], [0, 1254]],
  "M4 panels must form a three-wide, two-tall L"
);
assert.ok(m4.background.chunks.every(chunk => /structural_mechanics_lab/.test(chunk.path)));
assert.equal(m4.disableDefaultEnemies, true);
assert.equal(m4.foregroundOverlays.length, 0);
assert.ok(m4.encounters.some(encounter => encounter.id === "ch1_m04_final_boss"));
assert.match(m4.minimapImage.path, /structural-lab-minimap-v1\.jpg$/);

const m4ToM5 = m4.interactionNodes.find(node => node.id === "ch1_m04_node_completion");
assert.equal(m4ToM5.type, "teleport");
assert.equal(m4ToM5.visual, "transferArray");
assert.equal(m4ToM5.cinematicBeforeTransition, true);
assert.equal(m4ToM5.targetMapId, m5.id);
assert.equal(m4ToM5.x, 3255);
assert.equal(m4ToM5.y, 390);
assert.deepEqual(m4.spawnPoints.find(spawn => spawn.id === "ch1_m04_spawn_from_sakura"), {
  id: "ch1_m04_spawn_from_sakura", x: 3255, y: 630, facing: "N"
});
assert.equal(m5.title, "樱花同济大道");
assert.equal(m5.background.width, 1536);
assert.equal(m5.background.height, 1984);
assert.equal(m5.background.chunks.length, 2);
assert.deepEqual(m5.background.chunks.map(chunk => [chunk.y, chunk.width, chunk.height]), [
  [0, 1536, 1160],
  [960, 1536, 1024]
]);
assert.match(m5.background.chunks[0].path, /sakura-north-v8\.webp$/);
assert.match(m5.background.chunks[1].path, /sakura-south-v3\.webp$/);
assert.equal(m5.camera.fitViewportWidth, true, "M5 must fill wide browser viewports without exposing the clear color");
assert.equal(m5.spawn.y, 1690, "M5 player must enter from the south transfer array");
assert.equal(m5.disableDefaultEnemies, true);
assert.equal(m5.npcs.length, 8, "M5 uses eight stationary NPC sprites instead of baked pedestrians");
assert.ok(m5.npcs.every(npc => npc.animate === false && npc.breathe === false && npc.showLabel === false));
assert.ok(m5.npcs.every(npc => /^ch1-m05-passerby-[a-d]-v1$/.test(npc.textureKey)), "M5 must not reuse playable characters as pedestrians");
assert.ok(m5.npcs.every(npc => /\/npcs\/ch1-m05-passerby-[a-d]-v1\.png$/.test(npc.path)));
const npcGroupSizes = Object.values(m5.npcs.reduce((groups, npc) => {
  groups[npc.groupId] = (groups[npc.groupId] || 0) + 1;
  return groups;
}, {})).sort((a, b) => a - b);
assert.deepEqual(npcGroupSizes, [1, 1, 2, 4]);
const m5Back = m5.exitPoints.find(exit => exit.id === "ch1_m05_exit_back_m04");
assert.equal(m5Back.targetMapId, m4.id);
assert.equal(m5Back.targetSpawnId, "ch1_m04_spawn_from_sakura");

console.log("M3/M4/M5 map configuration passed");
