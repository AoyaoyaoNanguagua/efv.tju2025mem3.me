import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const assets = [
  ["assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png", 1176, 1176],
  ["assets/game/enemies/animated/ch1-m03-moon-orchid-rare-sheet-v3.png", 1176, 1176],
  ["assets/game/enemies/animated/ch1-m03-carnivora-boss-sheet-v3.png", 1176, 1176],
  ["assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png", 1176, 1176],
  ["assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png", 1176, 1176],
  ["assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png", 1176, 1176],
  ["assets/game/bosses/m04-structural-instability-boss-phase1-sheet-v7.png", 1280, 1440],
  ["assets/game/bosses/m04-structural-instability-boss-phase2-sheet-v7.png", 1280, 1440],
  ["assets/game/bosses/m04-structural-instability-boss-phase3-sheet-v7.png", 1280, 1440],
  ["assets/game/bosses/m04-professor-to-phase1-transition-v8.png", 2560, 360],
  ["assets/game/bosses/m04-phase1-to-phase2-transition-v8.png", 2560, 360],
  ["assets/game/bosses/m04-phase2-to-phase3-transition-v8.png", 2560, 360],
  ["assets/game/bosses/m04-phase1-walk-cycle-v8.png", 2560, 360],
  ["assets/game/bosses/m04-phase2-walk-cycle-v8.png", 2560, 360],
  ["assets/game/bosses/m04-phase3-walk-cycle-v8.png", 2560, 360],
  ["assets/game/enemies/animated/ch1-m04-charging-elites-atlas-v4.png", 1280, 1080],
  ["assets/game/vfx/m04-structural-charge-vfx-sheet-v1.png", 1280, 720]
];

for (const [asset, width, height] of assets) {
  assert.ok(existsSync(asset), `missing ${asset}`);
  const png = readFileSync(asset);
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${asset} must be PNG`);
  assert.equal(png.readUInt32BE(16), width, `${asset} width`);
  assert.equal(png.readUInt32BE(20), height, `${asset} height`);
  assert.equal(png[25], 6, `${asset} must be RGBA`);
}

const play = readFileSync("play.js", "utf8");
const server = readFileSync("play-server.py", "utf8");
const structuralFirePath = play.slice(play.indexOf("    createStructuralFirePath("), play.indexOf("    startStructuralBossDash("));
const maps = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const m3Garden = maps.maps.ch1_m03_agent_lab.enemySpawns.filter(enemy => /garden/.test(enemy.textureKey || ""));

assert.equal(m3Garden.length, 5);
assert.ok(m3Garden.every(enemy => enemy.staticImage === false));
assert.match(play, /const CHAPTER_ONE_ANIMATED_ENEMY_SPRITES = \[/);
assert.match(play, /archetype: "structuralBoss"/);
assert.match(play, /sourceFacing: "left"/);
assert.match(play, /setEnemyFacingFromMotion\(slime, motionX\)/);
assert.match(play, /sourceFacesLeft \? horizontal > 0 : horizontal < 0/);
assert.match(play, /professorTransform: \{ sheetIndex: 3, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /transform: \{ sheetIndex: 4, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /chargeLoop: \{ sheetIndex: 1, frames: enemyGridFrames\(1, 4\)/);
assert.match(play, /move: \{ sheetIndex: 6, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /phase2Move: \{ sheetIndex: 7, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /collapse: \{ sheetIndex: 5, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /phaseMove: \{ sheetIndex: 8, frames: enemyGridFrames\(0, 8\)/);
assert.match(play, /phaseAttack: \{ sheetIndex: 2, frames: enemyGridFrames\(2, 4\)/);
assert.match(play, /slime\.play\(key, !restart\)/);
assert.match(play, /playEnemyAnimationOnce/);
assert.match(play, /STRUCTURAL_BOSS_FORM_TRANSITION_WATCHDOG_MS/);
assert.ok(play.includes('frames: [0, 1, 3, 1].map(frame => ({ key: BOSS_REWARD_CHEST_KEY, frame }))'));
assert.doesNotMatch(play, /generateFrameNumbers\(BOSS_REWARD_CHEST_KEY, \{ start: 0, end: 3 \}\)/);
assert.match(play, /this\.bossChestShadow = this\.add\.ellipse/);
assert.doesNotMatch(play, /delayedCall\(1420, \(\) =>/);
assert.doesNotMatch(play, /delayedCall\(980, \(\) => this\.finishStructuralBossPhaseThree/);
assert.match(play, /phase: "awaitingProfessor"/);
assert.match(play, /phase: "professorTransforming"/);
assert.match(play, /beginProfessorBossTransformation/);
assert.match(play, /PROFESSOR_BOSS_TRANSFORM_WATCHDOG_MS/);
assert.match(play, /if \(this\.bossSprite\) this\.tweens\.killTweensOf\(this\.bossSprite\);/);
assert.match(play, /updateProfessorWaveProximity\(\)/);
assert.doesNotMatch(play, /delayedCall\(900, \(\) => this\.beginBossWaveSequence/);
assert.doesNotMatch(play, /existingFinalBoss \|\| hasFlag\("ch1_final_boss_defeated"\)/);
assert.match(play, /const replayingClearedBoss = structuralExam/);
assert.match(play, /this\.encounterRewards\.delete\("ch1_m04_final_boss"\)/);
assert.match(play, /finishM04BossReplay/);
assert.match(play, /this\.professorDeparted \|\| !visiblePhases\.has\(app\.boss\.phase\)/);
assert.match(play, /const finalBossMaxHp = Math\.round\(1800 \* 3 \* finalDifficulty\.health\)/);
assert.match(play, /baseHealthMultiplier: 3/);
assert.match(play, /const finalBoss = this\.spawnLeafSlime\(\{/);
assert.match(play, /终极大机器人已在陆教授所在位置完成加载/);
assert.match(play, /return finalBoss;/);
assert.match(play, /app\.boss\.phase === "final"[\s\S]+`终局 \$\{hpText\}`/);
assert.match(play, /slime\.textureKey === M04_STRUCTURAL_BOSS_KEY && slime\.hp <= 0 && slime\.bossPhase !== "phase3"/);
assert.match(play, /if \(slime\.bossPhase === "phase1"\)[\s\S]{0,220}triggerStructuralBossTransform/);
assert.match(play, /if \(slime\.bossPhase === "phase2Combat"\)[\s\S]{0,220}enterStructuralBossPhaseThree/);
assert.match(play, /triggerStructuralBossTransform/);
assert.match(play, /getEnemyDifficultyScale/);
assert.match(play, /health: 1 \+ extra \* 0\.75/);
assert.match(play, /damage: 1 \+ extra \* 0\.10/);
assert.match(play, /beginStructuralBossChargingPhase/);
assert.match(play, /spawnStructuralBossChargers/);
assert.match(play, /slime\.bossPhase = "transforming"/);
assert.match(play, /slime\.structuralTransformDeadline = this\.time\.now \+ 1560/);
assert.match(play, /slime\.textureKey === M04_STRUCTURAL_BOSS_KEY && slime\.transforming/);
assert.match(play, /STRUCTURAL_CHARGE_INTERVAL_MS = 10000/);
assert.match(play, /enterStructuralBossPhaseThree/);
assert.match(play, /finishStructuralBossPhaseThree/);
assert.match(play, /STRUCTURAL_FIRE_NODE_FUSE_MS = 1000/);
assert.match(play, /STRUCTURAL_FIRE_NODE_PLANT_STEP_MS = 120/);
assert.match(play, /STRUCTURAL_FIRE_NODE_MAX_PER_SEGMENT = 8/);
assert.doesNotMatch(structuralFirePath, /lineBetween\(/);
assert.doesNotMatch(play, /STRUCTURAL_FIRE_PATH_DELAY_MS/);
assert.match(play, /STRUCTURAL_PURSUIT_KNOCKBACK_DISTANCE = MAP_TILE_SIZE \* 5/);
assert.match(play, /STRUCTURAL_PURSUIT_KNOCKBACK_DURATION_MS = 220/);
assert.match(play, /STRUCTURAL_PURSUIT_BLAST_DELAY_MS = 2000/);
assert.match(play, /structuralKnockbackGhost/);
assert.match(play, /playLeafSlimeDeathSequence/);
assert.match(play, /STRUCTURAL_BOSS_DEATH_HOLD_MS = 1400/);
assert.match(play, /STRUCTURAL_BOSS_DEATH_FALLBACK_MS = 2100/);
assert.doesNotMatch(play, /STRUCTURAL_PURSUIT_STUN_MS/);
assert.match(play, /beginStructuralBossPhaseTwoCombat/);
assert.match(play, /STRUCTURAL_PHASE2_LIGHTNING_TELEGRAPH_MS = 3000/);
assert.match(play, /STRUCTURAL_PHASE2_LIGHTNING_RADIUS = MAP_TILE_SIZE \* 10/);
assert.match(play, /structuralPointInLightningHalf/);
assert.match(play, /STRUCTURAL_PHASE3_MARK_TELEGRAPH_MS = 2000/);
assert.match(play, /STRUCTURAL_PHASE3_MARK_RADIUS = MAP_TILE_SIZE \* 3/);
assert.match(play, /STRUCTURAL_PHASE3_CHAIN_MAX_JUMPS = 3/);
assert.match(play, /structuralMarkedLightning/);
assert.match(play, /STRUCTURAL_PHASE3_DASH_WATCHDOG_MS = 3600/);
assert.match(play, /recoverStructuralBossDash/);
assert.match(play, /STRUCTURAL_FIRE_PATH_MAX_ACTIVE = 6/);
assert.match(play, /sendEnemyBatch/);
assert.match(play, /serverClockOffsetMs/);
assert.match(play, /createPersistentPlayerShieldAura/);
assert.match(play, /updatePersistentPlayerShieldAura/);
assert.match(play, /updatePersistentPlayerShieldAura\(this\.actorShieldAura, this\.actor, app\.profile\?\.shield/);
assert.doesNotMatch(play, /groupId === STRUCTURAL_REINFORCEMENT_GROUP[\s\S]{0,180}enemy\.state = "vanish"/);
assert.match(play, /action === "enemySkill"/);
assert.match(server, /"enemySkill"/);
assert.match(server, /"structuralSideLightning"/);
assert.match(server, /"structuralMarkedLightning"/);
assert.match(server, /def handle_enemy_batch/);
assert.match(server, /"transform"/);
assert.match(server, /"bossForm"/);
assert.match(server, /"hazardBonus"/);

for (const archetype of ["structuralQuantumCharger", "structuralAnchorCharger", "structuralRelayCharger"]) {
  assert.match(play, new RegExp(`archetype: "${archetype}"`));
}

for (const key of [
  "QUANTUM_SCHOLAR_KEY", "QUANTUM_FAMILIAR_KEY", "QUANTUM_PAPER_KEY",
  "BLOCKCHAIN_CHAINBEAST_KEY", "BLOCKCHAIN_LOCK_KEY", "BLOCKCHAIN_SPIDER_KEY",
  "AIAGENT_CYBERMAGE_KEY", "AIAGENT_DIGITAL_CAT_KEY", "AIAGENT_BOTCAT_KEY"
]) {
  const animatedWaveEntry = new RegExp(`textureKey: ${key}, staticImage: false`);
  assert.match(play, animatedWaveEntry, `${key} must use animation in M4 waves`);
}

console.log("M3/M4 animated enemies, skills, professor gate and boss transform passed");
