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
      flags: { ch1_m03_small_boss_cleared: true },
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
    scene.getEncounterPartySize = () => 5;
    scene.leafSlimes.getChildren().slice().forEach(slime => scene.syncSlimeRemove(slime.slimeId));
    const boss = scene.spawnM04FinalBoss();
    const definition = scene.getAnimatedEnemyDefinition("ch1-m04-structural-instability-boss");
    const source = scene.textures.get(definition.sheetKey)?.source?.[0];
    const initial = {
      maxHp: boss.maxHp,
      damage: boss.damage,
      frameWidth: source?.width || 0,
      frameHeight: source?.height || 0,
      assetLoaded: performance.getEntriesByType("resource").some(entry => entry.name.includes("m04-structural-instability-boss-sheet-v3-hd.png"))
    };
    scene.triggerStructuralBossTransform(boss);
    await new Promise(resolve => setTimeout(resolve, 1650));
    const chargingEnemies = scene.leafSlimes.getChildren().filter(enemy => enemy.active && !["dead", "vanish"].includes(enemy.state));
    const charging = {
      phase: boss.bossPhase,
      shield: !!boss.energyShield?.active,
      bodyEnabled: !!boss.body?.enable,
      chargers: chargingEnemies.filter(enemy => enemy.bossCharger).length,
      reinforcements: chargingEnemies.filter(enemy => enemy.groupId === "ch1_m04_structural_reinforcements").length,
      chargerHp: chargingEnemies.find(enemy => enemy.bossCharger)?.maxHp || 0,
      reinforcementHp: chargingEnemies.find(enemy => enemy.groupId === "ch1_m04_structural_reinforcements")?.maxHp || 0
    };
    chargingEnemies.filter(enemy => enemy.bossCharger).forEach(enemy => {
      enemy.state = "dead";
      enemy.body.enable = false;
    });
    scene.updateStructuralBossCharging(boss, scene.time.now + 16);
    await new Promise(resolve => setTimeout(resolve, 80));
    const phase3 = {
      phase: boss.bossPhase,
      shield: !!boss.energyShield?.active,
      bodyEnabled: !!boss.body?.enable,
      chaseSpeed: boss.chaseSpeed,
      damage: boss.damage
    };
    return { initial, charging, phase3 };
  });

  assert.deepEqual(result.initial, {
    maxHp: 21600,
    damage: 34,
    frameWidth: 1792,
    frameHeight: 2304,
    assetLoaded: true
  });
  assert.equal(result.charging.phase, "charging");
  assert.equal(result.charging.shield, true);
  assert.equal(result.charging.bodyEnabled, true);
  assert.equal(result.charging.chargers, 3);
  assert.equal(result.charging.reinforcements, 6);
  assert.equal(result.charging.chargerHp, 2720);
  assert.equal(result.charging.reinforcementHp, 1312);
  assert.equal(result.phase3.phase, "phase3");
  assert.equal(result.phase3.shield, false);
  assert.equal(result.phase3.bodyEnabled, true);
  assert.equal(result.phase3.chaseSpeed, 168);
  assert.equal(result.phase3.damage, 41);

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
