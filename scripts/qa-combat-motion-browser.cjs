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
      id: "browser-qa-zhixia",
      account: "local-guest",
      slot: 0,
      characterId: "zhixia",
      name: "江寻",
      level: 12,
      exp: 0,
      credits: 200,
      maxHp: 900,
      hp: 900,
      energy: 150,
      maxEnergy: 150,
      attackPower: 100,
      magicPower: 100,
      chapterId: "chapter1",
      mapId: "ch1_m01_classroom_spawn",
      spawnId: "ch1_m01_spawn_player_start",
      flags: {},
      quests: {},
      inventory: [],
      equipment: [],
      collections: { protocolCards: [] }
    }]));
  });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const button = document.querySelector("#offlineButton");
    return button && !button.disabled;
  }, null, { timeout: 45000 });
  await page.click("#offlineButton");
  await page.waitForFunction(() => !document.querySelector("#serverStage")?.hidden);
  await page.click("#enterServerButton");
  await page.waitForFunction(() => !document.querySelector("#warehouseStage")?.hidden);
  await page.click("#warehousePlaza .plaza-slot.filled");
  await page.waitForFunction(() => window.__EFV_TEST_SCENE__?.actor?.body?.enable, null, { timeout: 45000 });
  await page.evaluate(() => { document.querySelector("#startOverlay").hidden = true; });

  const textureSources = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    return ["ayu", "zhixia", "laodeng", "jiangxun"].map(key => ({
      key,
      src: scene.textures.get(key)?.source?.[0]?.image?.src || scene.textures.get(key)?.source?.[0]?.image?.currentSrc || "",
      width: scene.textures.get(key)?.source?.[0]?.width || 0,
      height: scene.textures.get(key)?.source?.[0]?.height || 0
    }));
  });
  const expectedNames = {
    ayu: "ayu-sprites-v20-transform-cat-scale-fixed.png",
    zhixia: "zhixia/zhixia-sprites-final.png",
    laodeng: "laodeng-sprites-v9-redrawn-cat-run.png",
    jiangxun: "jiangxun-sprites-v10-redrawn-cat-motion.png"
  };
  console.log("textureSources", textureSources);
  const resourceUrls = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name));
  for (const texture of textureSources) {
    assert.equal(texture.width, 1176, `${texture.key} width`);
    assert.equal(texture.height, 1176, `${texture.key} height`);
    assert.ok(resourceUrls.some(url => url.includes(expectedNames[texture.key])), `${texture.key} should load the repaired sheet`);
  }
  const quickbarProfile = await page.evaluate(() => {
    const bar = document.querySelector(".bottom-dock .quickbar");
    const buttons = [...bar.querySelectorAll("button")];
    const style = getComputedStyle(bar);
    return {
      count: buttons.length,
      columns: style.gridTemplateColumns.split(" ").length,
      rows: style.gridTemplateRows.split(" ").length,
      visibleLabels: buttons.filter(button => {
        const span = button.querySelector("span");
        return span && span.getBoundingClientRect().width > 2;
      }).length
    };
  });
  assert.deepEqual(quickbarProfile, { count: 6, columns: 3, rows: 2, visibleLabels: 0 });
  await page.hover("#chapterToggleButton");
  await page.waitForTimeout(80);
  const quickbarTooltip = await page.locator("#skillTooltip").textContent();
  assert.match(quickbarTooltip, /任务/);
  assert.match(quickbarTooltip, /打开或收起第一章任务进度/);
  const zhixiaWalkFrames = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    return scene.anims.get("zhixia-walk").frames.map(frame => Number(frame.textureFrame));
  });
  assert.deepEqual(zhixiaWalkFrames, [8, 9, 10, 12, 13, 14], "Zhixia should loop the selected walk cells without the removed fourth frame");
  const ayuWalkFrames = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    return scene.anims.get("ayu-walk").frames.map(frame => Number(frame.textureFrame));
  });
  assert.deepEqual(ayuWalkFrames, [8, 9, 10, 11, 12, 13, 14, 15], "Ayu should use all eight redrawn walk frames");
  const swordWaveProfile = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    const visual = scene.createSwordWaveVisual(scene.actor.x, scene.actor.y, 0, scene.actor.y + 20);
    const result = {
      childCount: visual.list.length,
      wakeScaleY: visual.list[0].scaleY,
      waveScaleY: visual.list[1].scaleY,
      edgeScaleY: visual.list[2].scaleY,
      tipX: visual.list[4].x
    };
    visual.destroy(true);
    return result;
  });
  assert.deepEqual(swordWaveProfile, { childCount: 5, wakeScaleY: 0.18, waveScaleY: 0.13, edgeScaleY: 0.045, tipX: 150 });
  const zhixiaProjectile = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    scene.fireProjectile({
      kind: "magic",
      color: 0x73d9ff,
      damage: 100,
      speed: 1080,
      maxDistance: 448,
      visualType: "lightningOrb",
      vec: { x: 1, y: 0 }
    });
    const projectile = scene.projectiles.getChildren().find(item => item?.active && item.visualType === "lightningOrb");
    return {
      originDx: projectile.spawnX - scene.actor.x,
      originDy: projectile.spawnY - scene.actor.y,
      speed: Math.hypot(projectile.body.velocity.x, projectile.body.velocity.y)
    };
  });
  assert.ok(Math.abs(zhixiaProjectile.originDx - 86) < 0.1, "Zhixia orb should start outside the character edge");
  assert.ok(Math.abs(zhixiaProjectile.originDy + 58) < 0.1, "Zhixia orb should stay aligned with her casting height");
  assert.ok(Math.abs(zhixiaProjectile.speed - 1080) < 0.1, "Zhixia orb should use the faster flight speed");

  const collision = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    scene.leafSlimes.clear(true, true);
    const slime = scene.spawnLeafSlime({
      id: "qa-contact-slime",
      x: scene.actor.x,
      y: scene.actor.y,
      hp: 500,
      maxHp: 500,
      stationary: true
    });
    return {
      colliderRemoved: scene.actorLeafSlimeCollider === null,
      sameX: Math.abs(scene.actor.x - slime.x) < 0.01,
      sameY: Math.abs(scene.actor.y - slime.y) < 0.01,
      slimeId: slime.slimeId
    };
  });
  assert.equal(collision.colliderRemoved, true);
  assert.equal(collision.sameX, true);
  assert.equal(collision.sameY, true);
  await page.waitForTimeout(120);
  const passThroughState = await page.evaluate(slimeId => {
    const scene = window.__EFV_TEST_SCENE__;
    const slime = scene.findLeafSlime(slimeId);
    return {
      distance: Math.hypot(scene.actor.x - slime.x, scene.actor.y - slime.y),
      colliderRemoved: scene.actorLeafSlimeCollider === null
    };
  }, collision.slimeId);
  assert.equal(passThroughState.colliderRemoved, true);
  assert.ok(passThroughState.distance < 1, "player and enemy should be allowed to occupy the same position");

  const combat = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    scene.leafSlimes.clear(true, true);
    const originX = scene.actor.x + 80;
    const originY = scene.actor.y - 12;
    const enemies = [
      scene.spawnLeafSlime({ id: "qa-aoe-0", x: originX, y: originY, hp: 900, maxHp: 900, stationary: true }),
      scene.spawnLeafSlime({ id: "qa-aoe-1", x: originX + 48, y: originY + 8, hp: 900, maxHp: 900, stationary: true }),
      scene.spawnLeafSlime({ id: "qa-aoe-2", x: originX - 42, y: originY + 14, hp: 900, maxHp: 900, stationary: true }),
      scene.spawnLeafSlime({ id: "qa-aoe-3", x: originX + 94, y: originY - 16, hp: 900, maxHp: 900, stationary: true })
    ];
    const aoeProjectile = {
      damage: 100,
      color: 0xf0bb62,
      impactAoeRadius: 90,
      impactAoeMultiplier: 0.4,
      impactAoeColor: 0xf0bb62,
      impactAoeComboIndex: 3
    };
    const beforeAoe = enemies.map(enemy => enemy.hp);
    const aoeHits = scene.triggerProjectileImpactAoe(aoeProjectile, enemies[0]);
    const afterAoe = enemies.map(enemy => enemy.hp);
    const beforeChain = enemies.map(enemy => enemy.hp);
    scene.triggerZhixiaUltimateAftershockPulse([{ x: originX, y: originY }], 2, { x: originX, y: originY });
    return { beforeAoe, afterAoe, aoeHits, beforeChain, ids: enemies.map(enemy => enemy.slimeId) };
  });
  assert.ok(combat.aoeHits >= 2, "impact explosion should damage multiple nearby enemies");
  assert.ok(combat.afterAoe.slice(1).filter((hp, index) => hp < combat.beforeAoe[index + 1]).length >= 2);
  await page.waitForTimeout(360);
  const chainHp = await page.evaluate(ids => {
    const scene = window.__EFV_TEST_SCENE__;
    return ids.map(id => scene.findLeafSlime(id)?.hp ?? 0);
  }, combat.ids);
  console.log("combat", combat, "chainHp", chainHp);
  assert.ok(chainHp.filter((hp, index) => hp < combat.beforeChain[index]).length >= 3, "secondary lightning should chain through the group");
  const screenshotPath = path.join(ROOT, "tmp", "browser-combat-motion-qa.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.evaluate(() => {
    window.__EFV_TEST_SCENE__.transitionToMap({
      targetMapId: "ch1_m05_sakura_tongji_avenue",
      targetSpawnId: "ch1_m05_spawn_south_transfer"
    });
  });
  await page.waitForFunction(() => window.__EFV_TEST_SCENE__?.mapData?.id === "ch1_m05_sakura_tongji_avenue", null, { timeout: 45000 });
  await page.waitForFunction(() => !document.querySelector("#mapLoadingOverlay")?.classList.contains("open"), null, { timeout: 45000 });
  await page.waitForTimeout(500);
  const sakuraMapProfile = await page.evaluate(() => {
    const scene = window.__EFV_TEST_SCENE__;
    return {
      title: scene.mapData.title,
      width: scene.worldWidth,
      height: scene.worldHeight,
      actorX: Math.round(scene.actor.x),
      actorY: Math.round(scene.actor.y),
      npcCount: scene.mapNpcs.length,
      backgroundCount: scene.mapBackgroundChunks.length + (scene.mapBackground ? 1 : 0)
    };
  });
  assert.deepEqual(sakuraMapProfile, {
    title: "樱花同济大道",
    width: 1536,
    height: 1984,
    actorX: 768,
    actorY: 1690,
    npcCount: 8,
    backgroundCount: 2
  });
  const sakuraResourceUrls = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name));
  assert.ok(sakuraResourceUrls.some(url => url.includes("ch1-m05-sakura-north-v8.webp")));
  assert.ok(sakuraResourceUrls.some(url => url.includes("ch1-m05-sakura-south-v3.webp")));
  const sakuraScreenshotPath = path.join(ROOT, "tmp", "browser-sakura-avenue-qa.png");
  await page.screenshot({ path: sakuraScreenshotPath, fullPage: false });

  const relevantErrors = errors.filter(message => !message.includes("favicon") && !message.includes("WebSocket"));
  assert.deepEqual(relevantErrors, [], `browser errors: ${relevantErrors.join(" | ")}`);
  console.log(JSON.stringify({ textureSources, quickbarProfile, quickbarTooltip, zhixiaWalkFrames, ayuWalkFrames, swordWaveProfile, zhixiaProjectile, collision, passThroughState, combat, chainHp, sakuraMapProfile, screenshotPath, sakuraScreenshotPath }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
