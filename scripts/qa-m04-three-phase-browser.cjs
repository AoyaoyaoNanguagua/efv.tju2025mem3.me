const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "http://127.0.0.1:8787/play.html";

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: class DisabledQaWebSocket {
        constructor() {
          throw new Error("WebSocket disabled for deterministic offline QA");
        }
      }
    });
    localStorage.setItem("efv-local-characters", JSON.stringify([{
      id: "browser-qa-m04",
      account: "local-guest",
      slot: 0,
      characterId: "ayu",
      name: "M04 QA",
      level: 18,
      exp: 0,
      credits: 200,
      maxHp: 9999,
      hp: 9999,
      energy: 150,
      maxEnergy: 150,
      attackPower: 100,
      magicPower: 100,
      chapterId: "chapter1",
      mapId: "ch1_m04_library_lawn_boss",
      spawnId: "ch1_m04_spawn_from_agent_lab",
      flags: {
        ch1_m03_small_boss_cleared: true,
        ch1_final_boss_defeated: true,
        ch1_complete: true,
        ch1_boss_chest_opened: true
      },
      quests: {},
      inventory: [],
      equipment: [],
      collections: { protocolCards: [] }
    }]));
  });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#offlineButton") && !document.querySelector("#offlineButton").disabled, null, { timeout: 45000 });
  await page.click("#offlineButton");
  await page.waitForFunction(() => !document.querySelector("#serverStage")?.hidden);
  await page.click("#enterServerButton");
  await page.waitForFunction(() => !document.querySelector("#warehouseStage")?.hidden);
  await page.click("#warehousePlaza .plaza-slot.filled");
  await page.waitForFunction(() => window.__EFV_TEST_SCENE__?.actor?.body?.enable, null, { timeout: 45000 });
  await page.evaluate(() => { document.querySelector("#startOverlay").hidden = true; });

  const result = await page.evaluate(async () => {
    const scene = window.__EFV_TEST_SCENE__;
    const sampleLoopFrames = async (slime, action) => {
      scene.playEnemyAnimation(slime, action, true);
      const frames = [];
      for (let index = 0; index < 6; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 170));
        frames.push(Number(slime.frame?.name));
      }
      return frames;
    };
    const sampleTransitionFrames = async (sprite, action) => {
      const expectedKey = `ch1-m04-structural-instability-boss-${action}`;
      const frames = [];
      for (let index = 0; index < 8; index += 1) {
        await new Promise(resolve => setTimeout(resolve, 110));
        if (sprite?.anims?.currentAnim?.key === expectedKey) frames.push(Number(sprite.frame?.name));
      }
      return frames;
    };
    scene.getEncounterPartySize = () => 5;
    scene.isEncounterCoordinator = () => true;
    scene.leafSlimes.getChildren().slice().forEach(slime => scene.syncSlimeRemove(slime.slimeId));
    const replayBossState = scene.startBoss({ force: true });
    const replayStart = {
      started: !!replayBossState?.active,
      replayMode: scene.m04BossReplay,
      wavePending: scene.bossWavePending
    };
    scene.time.removeAllEvents();
    scene.closeBossPortals();
    const originalSpawnM04FinalBoss = scene.spawnM04FinalBoss.bind(scene);
    let finalSpawnCalls = 0;
    scene.spawnM04FinalBoss = options => {
      finalSpawnCalls += 1;
      return originalSpawnM04FinalBoss(options);
    };
    const originalBeginProfessorBossTransformation = scene.beginProfessorBossTransformation.bind(scene);
    const beginProfessorCalls = [];
    scene.beginProfessorBossTransformation = () => {
      const before = scene.professorTransformToken;
      const started = originalBeginProfessorBossTransformation();
      beginProfessorCalls.push({ before, after: scene.professorTransformToken, started });
      return started;
    };
    scene.waitForProfessorApproach(3);
    scene.actor.setPosition(scene.bossSprite.x, scene.bossSprite.y);
    const tokenTimeline = [];
    for (let index = 0; index < 12; index += 1) {
      scene.updateProfessorWaveProximity();
      tokenTimeline.push(scene.professorTransformToken);
    }
    const professorTransitionFrames = await sampleTransitionFrames(scene.bossSprite, "professorTransform");
    await new Promise(resolve => setTimeout(resolve, 620));
    const boss = scene.findLeafSlime("ch1-m04-structural-final-boss");
    if (!boss) {
      throw new Error(`final boss did not spawn: ${JSON.stringify({
        finalSpawnCalls,
        beginProfessorCalls,
        tokenTimeline,
        bossWavePending: scene.bossWavePending,
        professorTransformToken: scene.professorTransformToken,
        transitionAnimation: scene.bossSprite?.anims?.currentAnim?.key || "",
        transitionFrame: scene.bossSprite?.frame?.name,
        professorVisible: !!scene.bossSprite?.visible,
        professorActive: !!scene.bossSprite?.active
      })}`);
    }
    const transition = {
      finalSpawnCalls,
      bossExists: !!boss?.active,
      bossPhase: boss?.bossPhase || "",
      professorVisible: !!scene.bossSprite?.visible
    };
    scene.spawnM04FinalBoss = originalSpawnM04FinalBoss;
    const definition = scene.getAnimatedEnemyDefinition("ch1-m04-structural-instability-boss");
    const source = scene.textures.get(definition.sheetKey)?.source?.[0];
    scene.setEnemyFacingFromMotion(boss, -100);
    const facesLeftWhenMovingLeft = boss.flipX;
    scene.setEnemyFacingFromMotion(boss, 100);
    const facesRightWhenMovingRight = boss.flipX;
    const facing = {
      sourceFacing: definition.sourceFacing,
      leftFlipX: facesLeftWhenMovingLeft,
      rightFlipX: facesRightWhenMovingRight
    };
    const initial = {
      maxHp: boss.maxHp,
      damage: boss.damage,
      frameWidth: source?.width || 0,
      frameHeight: source?.height || 0,
      visualScale: boss.baseVisualScale,
      assetLoaded: [
        "m04-structural-instability-boss-phase1-sheet-v7.png",
        "m04-structural-instability-boss-phase2-sheet-v7.png",
        "m04-structural-instability-boss-phase3-sheet-v7.png",
        "m04-professor-to-phase1-transition-v8.png",
        "m04-phase1-to-phase2-transition-v8.png",
        "m04-phase2-to-phase3-transition-v8.png",
        "m04-phase1-walk-cycle-v8.png",
        "m04-phase2-walk-cycle-v8.png",
        "m04-phase3-walk-cycle-v8.png"
      ].every(name => performance.getEntriesByType("resource").some(entry => entry.name.includes(name)))
    };
    scene.actor.setPosition(boss.x + 520, boss.y);
    const phase1MoveFrames = await sampleLoopFrames(boss, "move");
    scene.actor.setPosition(boss.x + 42, boss.y);
    boss.lastLightSkillAt = -999999;
    boss.hp = 1;
    scene.playLeafSlimeHit(boss, 99999, { noEnergyGain: true });
    const phase12TransitionFrames = await sampleTransitionFrames(boss, "transform");
    // The generated eight-frame transition lasts about one second. Sample the
    // freshly entered charging phase before its later reinforcement cadence.
    await new Promise(resolve => setTimeout(resolve, 320));
    const chargingEnemies = scene.leafSlimes.getChildren().filter(enemy => enemy.active && !["dead", "vanish"].includes(enemy.state));
    const charging = {
      phase: boss.bossPhase,
      shield: !!boss.energyShield?.active,
      shieldSprite: !!boss.energyShieldSprite?.active,
      bodyEnabled: !!boss.body?.enable,
      chargers: chargingEnemies.filter(enemy => enemy.bossCharger).length,
      reinforcements: chargingEnemies.filter(enemy => enemy.groupId === "ch1_m04_structural_reinforcements").length,
      chargerHp: chargingEnemies.find(enemy => enemy.bossCharger)?.maxHp || 0,
      reinforcementHp: chargingEnemies.find(enemy => enemy.groupId === "ch1_m04_structural_reinforcements")?.maxHp || 0,
      chargerArchetypes: chargingEnemies.filter(enemy => enemy.bossCharger).map(enemy => enemy.enemyArchetype).sort()
    };
    chargingEnemies.filter(enemy => enemy.bossCharger).forEach(enemy => {
      enemy.state = "dead";
      enemy.body.enable = false;
    });
    scene.updateStructuralBossCharging(boss, scene.time.now + 16);
    const phase2 = {
      phase: boss.bossPhase,
      bodyEnabled: !!boss.body?.enable,
      reinforcements: scene.leafSlimes.getChildren().filter(enemy => enemy.active && enemy.groupId === "ch1_m04_structural_reinforcements" && !["dead", "vanish"].includes(enemy.state)).length
    };
    scene.actor.setPosition(boss.x + 520, boss.y);
    const phase2MoveFrames = await sampleLoopFrames(boss, "move");
    boss.hp = 1;
    scene.playLeafSlimeHit(boss, 99999, { noEnergyGain: true });
    const phase3Transition = { phase: boss.bossPhase, bodyEnabled: !!boss.body?.enable };
    const phase23TransitionFrames = await sampleTransitionFrames(boss, "collapse");
    await new Promise(resolve => setTimeout(resolve, 920));
    const phase3 = {
      phase: boss.bossPhase,
      shield: !!boss.energyShield?.active,
      bodyEnabled: !!boss.body?.enable,
      chaseSpeed: boss.chaseSpeed,
      damage: boss.damage
    };
    scene.actor.setPosition(boss.x + 520, boss.y);
    const phase3MoveFrames = await sampleLoopFrames(boss, "phaseMove");
    scene.prepareBossChest();
    const chestFrames = [];
    const chestScales = [];
    for (let index = 0; index < 9; index += 1) {
      await new Promise(resolve => setTimeout(resolve, 180));
      chestFrames.push(Number(scene.bossChest?.frame?.name));
      chestScales.push(Number(scene.bossChest?.scaleX));
    }
    const chest = {
      visible: !!scene.bossChest?.visible,
      frames: chestFrames,
      scales: chestScales,
      shadowVisible: !!scene.bossChestShadow?.visible,
      shadowWidth: Number(scene.bossChestShadow?.displayWidth),
      shadowHeight: Number(scene.bossChestShadow?.displayHeight),
      shadowBelowChest: Number(scene.bossChestShadow?.y) > Number(scene.bossChest?.y),
      shadowBehindChest: Number(scene.bossChestShadow?.depth) < Number(scene.bossChest?.depth)
    };
    return {
      replayStart,
      transition,
      initial,
      facing,
      charging,
      phase2,
      phase3Transition,
      phase3,
      movementFrames: {
        phase1: phase1MoveFrames,
        phase2: phase2MoveFrames,
        phase3: phase3MoveFrames
      },
      transitionFrames: {
        professorToPhase1: professorTransitionFrames,
        phase1ToPhase2: phase12TransitionFrames,
        phase2ToPhase3: phase23TransitionFrames
      },
      chest
    };
  });

  assert.deepEqual(result.replayStart, { started: true, replayMode: true, wavePending: true });
  assert.deepEqual(result.transition, {
    finalSpawnCalls: 1,
    bossExists: true,
    bossPhase: "phase1",
    professorVisible: false
  });
  assert.deepEqual(result.initial, {
    maxHp: 21600,
    damage: 34,
    frameWidth: 1280,
    frameHeight: 1440,
    visualScale: 1,
    assetLoaded: true
  });
  assert.deepEqual(result.facing, {
    sourceFacing: "left",
    leftFlipX: false,
    rightFlipX: true
  });
  assert.equal(result.charging.phase, "charging");
  assert.equal(result.charging.shield, true);
  assert.equal(result.charging.shieldSprite, true);
  assert.equal(result.charging.bodyEnabled, true);
  assert.equal(result.charging.chargers, 3);
  assert.equal(result.charging.reinforcements, 6);
  assert.equal(result.charging.chargerHp, 2720);
  assert.equal(result.charging.reinforcementHp, 1312);
  assert.deepEqual(result.charging.chargerArchetypes, ["structuralAnchorCharger", "structuralQuantumCharger", "structuralRelayCharger"]);
  assert.deepEqual(result.phase2, { phase: "phase2Combat", bodyEnabled: true, reinforcements: 6 });
  assert.deepEqual(result.phase3Transition, { phase: "phase3Transition", bodyEnabled: false });
  assert.equal(result.phase3.phase, "phase3");
  assert.equal(result.phase3.shield, false);
  assert.equal(result.phase3.bodyEnabled, true);
  assert.equal(result.phase3.chaseSpeed, 168);
  assert.equal(result.phase3.damage, 41);
  for (const [phase, frames] of Object.entries(result.movementFrames)) {
    assert.ok(new Set(frames).size >= 3, `${phase} movement animation must advance across multiple frames: ${frames.join(",")}`);
    assert.ok(frames.every(frame => frame >= 0 && frame <= 7), `${phase} movement animation must stay on the generated eight-frame strip: ${frames.join(",")}`);
  }
  for (const [transition, frames] of Object.entries(result.transitionFrames)) {
    assert.ok(new Set(frames).size >= 5, `${transition} must visibly play the IMAGE-generated transition strip: ${frames.join(",")}`);
    assert.ok(frames.every(frame => frame >= 0 && frame <= 7), `${transition} must stay on its generated eight-frame strip: ${frames.join(",")}`);
  }
  assert.equal(result.chest.visible, true);
  assert.ok(new Set(result.chest.frames).size >= 3, `closed chest must keep a subtle idle loop: ${result.chest.frames.join(",")}`);
  assert.ok(result.chest.frames.every(frame => [0, 1, 3].includes(frame)), `closed chest must exclude the undersized frame 2: ${result.chest.frames.join(",")}`);
  assert.ok(result.chest.scales.every(scale => Math.abs(scale - 0.74) < 0.001), `closed chest scale must remain stable: ${result.chest.scales.join(",")}`);
  assert.equal(result.chest.shadowVisible, true);
  assert.equal(result.chest.shadowWidth, 126);
  assert.ok(Math.abs(result.chest.shadowHeight - 21.6) < 0.1);
  assert.equal(result.chest.shadowBelowChest, true);
  assert.equal(result.chest.shadowBehindChest, true);

  const screenshotPath = path.join(ROOT, "tmp", "browser-m04-three-phase-qa.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const relevantErrors = errors.filter(message => !message.includes("favicon") && !message.includes("WebSocket"));
  assert.deepEqual(relevantErrors, [], `browser errors: ${relevantErrors.join(" | ")}`);
  console.log(JSON.stringify({ result, screenshotPath }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
