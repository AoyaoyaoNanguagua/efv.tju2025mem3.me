import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
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
assert.ok(teleports.every(exit => exit.visual === "portal"), "Every map transfer must use the M01 portal visual");
assert.ok(teleports.every(exit => exit.portalScale === 0.82), "Every map transfer must use the shared portal scale");
for (const exit of teleports) {
  const targetMap = maps[exit.targetMapId];
  assert.ok(targetMap, `Missing target map for ${exit.id}`);
  assert.ok((targetMap.spawnPoints || [targetMap.spawn]).some(spawn => spawn.id === exit.targetSpawnId), `Missing target spawn for ${exit.id}`);
}

console.log("M02-A auditorium branch configuration passed");
