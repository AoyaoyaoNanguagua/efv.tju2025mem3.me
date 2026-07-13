import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const assets = [
  "assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png",
  "assets/game/enemies/animated/ch1-m03-moon-orchid-rare-sheet-v3.png",
  "assets/game/enemies/animated/ch1-m03-carnivora-boss-sheet-v3.png",
  "assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png",
  "assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png",
  "assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png",
  "assets/game/bosses/m04-structural-instability-boss-sheet-v2.png"
];

for (const asset of assets) {
  assert.ok(existsSync(asset), `missing ${asset}`);
  const png = readFileSync(asset);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${asset} must be PNG`);
  assert.equal(png.readUInt32BE(16), 1176, `${asset} width`);
  assert.equal(png.readUInt32BE(20), 1176, `${asset} height`);
  assert.equal(png[25], 6, `${asset} must be RGBA`);
}

const play = readFileSync("play.js", "utf8");
const server = readFileSync("play-server.py", "utf8");
const maps = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const m3Garden = maps.maps.ch1_m03_agent_lab.enemySpawns.filter(enemy => /garden/.test(enemy.textureKey || ""));

assert.equal(m3Garden.length, 5);
assert.ok(m3Garden.every(enemy => enemy.staticImage === false));
assert.match(play, /const CHAPTER_ONE_ANIMATED_ENEMY_SPRITES = \[/);
assert.match(play, /archetype: "structuralBoss"/);
assert.match(play, /transform: \{ frames: enemyGridFrames\(3, 8\)/);
assert.match(play, /phaseAttack: \{ frames: enemyGridFrames\(5, 8\)/);
assert.match(play, /phase: "awaitingProfessor"/);
assert.match(play, /updateProfessorWaveProximity\(\)/);
assert.doesNotMatch(play, /delayedCall\(900, \(\) => this\.beginBossWaveSequence/);
assert.match(play, /slime\.hp <= slime\.maxHp \* 0\.55/);
assert.match(play, /triggerStructuralBossTransform/);
assert.match(play, /getEnemyDifficultyScale/);
assert.match(play, /healthStep = rank === "boss" \? 0\.75/);
assert.match(play, /action === "enemySkill"/);
assert.match(server, /"enemySkill"/);
assert.match(server, /"transform"/);
assert.match(server, /"bossForm"/);
assert.match(server, /"hazardBonus"/);

for (const key of [
  "QUANTUM_SCHOLAR_KEY", "QUANTUM_FAMILIAR_KEY", "QUANTUM_PAPER_KEY",
  "BLOCKCHAIN_CHAINBEAST_KEY", "BLOCKCHAIN_LOCK_KEY", "BLOCKCHAIN_SPIDER_KEY",
  "AIAGENT_CYBERMAGE_KEY", "AIAGENT_DIGITAL_CAT_KEY", "AIAGENT_BOTCAT_KEY"
]) {
  const animatedWaveEntry = new RegExp(`textureKey: ${key}, staticImage: false`);
  assert.match(play, animatedWaveEntry, `${key} must use animation in M4 waves`);
}

console.log("M3/M4 animated enemies, skills, professor gate and boss transform passed");
