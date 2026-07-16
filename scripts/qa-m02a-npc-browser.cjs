const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = "http://127.0.0.1:8787/play.html";

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
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
        id: "browser-qa-m02a",
        account: "local-guest",
        slot: 0,
        characterId: "ayu",
        name: "M02A QA",
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
        mapId: "ch1_m02a_auditorium_branch",
        spawnId: "ch1_m02a_spawn_from_archive",
        flags: {},
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
    await page.waitForFunction(() => document.querySelector("#startOverlay")?.classList.contains("hidden"), null, { timeout: 45000 });
    await page.waitForFunction(() => document.querySelector("#mapLoadingOverlay")?.getAttribute("aria-hidden") === "true", null, { timeout: 45000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.querySelector("#startOverlay").hidden = true; });

    const result = await page.evaluate(() => {
      const scene = window.__EFV_TEST_SCENE__;
      const human = scene.mapNpcs.find(entry => entry.item?.id === "ch1_m02a_npc_mumu");
      const dog = scene.mapNpcs.find(entry => entry.item?.id === "ch1_m02a_pet_xiaozhu");
      scene.actor.setPosition(human.sprite.x, human.sprite.y + 170);
      scene.cameras.main.centerOn(human.sprite.x, human.sprite.y);
      return {
        mapId: scene.getCurrentMapId(),
        human: {
          scale: human.sprite.scaleX,
          configuredScale: human.item.scale,
          shadowWidth: human.shadow.width,
          shadowHeight: human.shadow.height
        },
        dog: {
          scale: dog.sprite.scaleX,
          shadowWidth: dog.shadow.width,
          shadowHeight: dog.shadow.height
        },
        cacheVersionLoaded: performance.getEntriesByType("resource")
          .some(entry => entry.name.includes("20260716-npc-scale-facing-chest-v14"))
      };
    });

    assert.equal(result.mapId, "ch1_m02a_auditorium_branch");
    assert.equal(result.human.scale, 1.066);
    assert.equal(result.human.configuredScale, 1.066);
    assert.equal(result.human.shadowWidth, 68);
    assert.equal(result.human.shadowHeight, 16);
    assert.equal(result.dog.scale, 0.7);
    assert.equal(result.dog.shadowWidth, 58);
    assert.equal(result.dog.shadowHeight, 14);
    assert.equal(result.cacheVersionLoaded, true);
    const screenshotPath = path.join(ROOT, "tmp", "browser-m02a-npc-scale-qa.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const relevantErrors = errors.filter(message => !message.includes("favicon") && !message.includes("WebSocket"));
    assert.deepEqual(relevantErrors, [], `browser errors: ${relevantErrors.join(" | ")}`);
    console.log(JSON.stringify({ result, screenshotPath }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
