import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const play = readFileSync("play.js", "utf8");
const maps = registry.maps;
const m2 = maps.ch1_m02_prompt_archive;
const auditorium = maps.ch1_m02a_auditorium_branch;

assert.ok(auditorium, "M02-A auditorium branch must be registered");
assert.equal(auditorium.title, "学院大礼堂");
assert.equal(auditorium.background.width, 3072);
assert.equal(auditorium.background.height, 2304);
assert.ok(existsSync(auditorium.background.path), "Auditorium background must exist");

const readPngSize = path => {
  const png = readFileSync(path);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} must be a PNG`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

const auditoriumImage = readFileSync(auditorium.background.path);
assert.equal(auditoriumImage.toString("ascii", 0, 4), "RIFF", "Auditorium background must be a WebP container");
assert.equal(auditoriumImage.toString("ascii", 8, 12), "WEBP", "Auditorium background must be WebP encoded");
for (const npc of auditorium.npcs) {
  const path = npc.textureKey === "ch1-m02a-mumu-npc"
    ? "assets/game/characters/npcs/ch1-m02a-mumu-sprites-v13-efv.png"
    : "assets/game/characters/npcs/ch1-m02a-xiaozhu-sprites-v13-efv.png";
  assert.ok(existsSync(path), `${npc.label} sprite sheet must exist`);
  assert.deepEqual(readPngSize(path), [1176, 1176]);
}
assert.equal(auditorium.dialogues[0].speaker, "峹牧");
assert.equal(auditorium.npcs[0].label, "峹牧");

const mumu = auditorium.npcs.find(npc => npc.id === "ch1_m02a_npc_mumu");
const xiaozhu = auditorium.npcs.find(npc => npc.id === "ch1_m02a_pet_xiaozhu");
assert.equal(mumu.scale, 1.066, "The human NPC must be enlarged by exactly 30%");
assert.equal(mumu.shadowWidth, 68);
assert.equal(mumu.shadowHeight, 16);
assert.equal(xiaozhu.scale, 0.7, "Animal NPC scale must remain unchanged");
assert.equal(xiaozhu.shadowWidth, 58);
assert.equal(xiaozhu.shadowHeight, 14);
assert.match(play, /20260716-npc-scale-facing-chest-v14/, "Map JSON cache key must expose the NPC scale update");

const m2ToAuditorium = m2.exitPoints.find(exit => exit.targetMapId === auditorium.id);
const auditoriumToM2 = auditorium.exitPoints.find(exit => exit.targetMapId === m2.id);
assert.ok(m2ToAuditorium, "M02 must have an upward auditorium exit");
assert.ok(auditoriumToM2, "Auditorium must return to M02");
assert.equal(m2ToAuditorium.targetSpawnId, auditorium.spawn.id);
assert.ok(m2.spawnPoints.some(spawn => spawn.id === auditoriumToM2.targetSpawnId));

const pointInside = (point, rect) => point.x >= rect.x && point.x <= rect.x + rect.w
  && point.y >= rect.y && point.y <= rect.y + rect.h;
assert.ok(!(m2.obstacles || []).some(rect => pointInside(m2ToAuditorium, rect)), "M02 branch portal must be reachable");
assert.ok(!(auditorium.obstacles || []).some(rect => pointInside(auditorium.spawn, rect)), "Auditorium spawn must be walkable");
assert.ok(Math.hypot(
  auditorium.spawn.x - auditoriumToM2.x,
  auditorium.spawn.y - auditoriumToM2.y
) > auditoriumToM2.radius, "Auditorium spawn must not overlap its return portal");

const teleports = Object.values(maps).flatMap(map => (map.exitPoints || []).filter(exit => exit.type === "teleport"));
assert.ok(teleports.length >= 8);
assert.ok(teleports.every(exit => exit.visual === "transferArray"), "Every map transfer must use the blue transfer-array visual");
assert.ok(teleports.every(exit => exit.ringScale === 1.05), "Every map transfer must use the shared transfer-ring scale");
for (const exit of teleports) {
  const targetMap = maps[exit.targetMapId];
  assert.ok(targetMap, `Missing target map for ${exit.id}`);
  assert.ok((targetMap.spawnPoints || [targetMap.spawn]).some(spawn => spawn.id === exit.targetSpawnId), `Missing target spawn for ${exit.id}`);
}

const stageFront = auditorium.obstacles.filter(item => item.id.startsWith("m02a-stage-front-center"));
assert.equal(stageFront.length, 2, "The stage front must be split around the central approach");
assert.ok(stageFront.every(item => item.x + item.w <= 1320 || item.x >= 1752), "The central red-carpet approach must remain open");
const seatBanks = auditorium.obstacles.filter(item => item.id.startsWith("m02a-seat-bank"));
assert.equal(seatBanks.length, 2);
assert.ok(seatBanks.every(item => item.y === 1225 && item.h === 480), "Seat collision must start at the chair footprint, not in the front aisle");
assert.ok(!(auditorium.obstacles || []).some(rect => pointInside({ x: 720, y: 1150 }, rect)), "The west front-row aisle must be walkable");
assert.ok(!(auditorium.obstacles || []).some(rect => pointInside({ x: 2330, y: 1150 }, rect)), "The east front-row aisle must be walkable");
const lectern = auditorium.obstacles.find(item => item.id === "m02a-stage-lectern");
assert.deepEqual(lectern, { id: "m02a-stage-lectern", x: 1450, y: 785, w: 172, h: 150 });
assert.ok(pointInside({ x: 1536, y: 860 }, lectern), "The lectern itself must block walking");
const statue = auditorium.props.find(item => item.id === "ch1_m02a_principal_bronze_statue");
const statueNode = auditorium.interactionNodes.find(item => item.id === "ch1_m02a_node_principal_statue");
assert.equal(statue.x, 2100, "The principal statue must stand left of the right stairway");
assert.equal(statueNode.x, statue.x, "The statue interaction must follow the visual prop");
assert.equal(statueNode.hintY, 904, "The statue shadow must sit directly under its base");
assert.equal(statueNode.hintWidth, 78);
assert.equal(statueNode.hintHeight, 18);
const m2TaskProps = m2.interactionNodes.filter(node => node.markerImage);
assert.equal(m2TaskProps.length, 4);
assert.ok(m2TaskProps.every(node => node.markerShadowWidth <= 88 && node.markerShadowHeight === 14), "M02 task-prop shadows must stay compact");
assert.ok(m2TaskProps.every(node => node.markerGlowWidth <= 100 && node.markerGlowHeight === 24), "M02 task-prop glows must not read as oversized shadows");
assert.equal(auditorium.ambientEnemyRefresh.initialCount, 2);
assert.equal(auditorium.ambientEnemyRefresh.intervalMs, 30000);
assert.equal(auditorium.ambientEnemyRefresh.minCount, 1);
assert.equal(auditorium.ambientEnemyRefresh.maxCount, 1);
assert.equal(auditorium.ambientEnemyRefresh.maxAlive, 5);
assert.deepEqual(auditorium.ambientEnemyRefresh.enemies.map(item => item.textureKey), ["ch1-runaway-magic-broom"]);

console.log("M02-A auditorium branch configuration passed");
