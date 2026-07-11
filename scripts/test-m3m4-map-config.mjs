import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const m1 = registry.maps.ch1_m01_classroom_spawn;
const m2 = registry.maps.ch1_m02_prompt_archive;
const m3 = registry.maps.ch1_m03_agent_lab;
const m4 = registry.maps.ch1_m04_library_lawn_boss;

const classroomDesks = m1.props.filter(prop => /^m01_desk_/.test(prop.id));
assert.equal(classroomDesks.length, 12);
assert.ok(classroomDesks.every(prop => prop.scale === 0.9));
assert.ok(classroomDesks.every(prop => prop.collision.w === 225 && prop.collision.h === 93.6));

assert.equal(m2.background.width, 3072);
assert.equal(m2.background.height, 1024);
assert.equal(m2.background.chunks.length, 2);
assert.ok(m2.background.chunks.every(chunk => chunk.width === 1536 && chunk.height === 1024));
assert.ok(m2.background.chunks.every(chunk => /-v7\.png$/.test(chunk.path)));

assert.equal(m3.title, "樱庭生态园");
assert.equal(m3.background.chunks, undefined, "M3 must use one coherent background");
assert.match(m3.background.path, /botanical-garden/);
assert.match(m3.background.path, /-v3\.png$/, "M3 must use the academy botanical garden background");
assert.equal(m3.background.width, 3072, "M3 must provide a wide combat arena");
assert.equal(m3.background.height, 2048);

const gardenEnemies = m3.enemySpawns.filter(enemy => enemy.staticImage);
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "elite").length, 3);
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "rare").length, 1);
assert.equal(gardenEnemies.filter(enemy => enemy.rank === "boss").length, 1);
assert.ok(gardenEnemies.filter(enemy => enemy.rank === "elite").every(enemy => enemy.patrolBounds));
assert.ok(gardenEnemies.every(enemy => /garden/.test(enemy.textureKey)));

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

console.log("M3/M4 map configuration passed");
