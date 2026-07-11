import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const m3 = registry.maps.ch1_m03_agent_lab;
const m4 = registry.maps.ch1_m04_library_lawn_boss;

assert.equal(m3.title, "樱庭生态园");
assert.equal(m3.background.chunks, undefined, "M3 must use one coherent background");
assert.match(m3.background.path, /botanical-garden/);
assert.match(m3.background.path, /-v2\.png$/, "M3 must use the Q-style garden background");
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

assert.equal(m4.background.chunks, undefined, "M4 must not use legacy stitched chunks");
assert.equal(m4.disableDefaultEnemies, true);
assert.ok(m4.foregroundOverlays.every(overlay => overlay.textureKey === m4.background.key));

console.log("M3/M4 map configuration passed");
