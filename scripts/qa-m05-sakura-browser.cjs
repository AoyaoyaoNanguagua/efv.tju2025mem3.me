const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DEBUG_PORT = Number(process.env.EFV_EDGE_DEBUG_PORT || 9333);
const URL = "http://127.0.0.1:8787/play.html";
const ROOT = path.resolve(__dirname, "..");

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result || {});
        return;
      }
      if (message.method === "Runtime.exceptionThrown") this.errors.push(message.params?.exceptionDetails?.text || "Runtime exception");
      if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") this.errors.push(message.params.entry.text);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Evaluation failed");
    return result.result?.value;
  }

  async waitFor(expression, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(`Boolean(${expression})`)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${expression}`);
  }
}

(async () => {
  const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" }).then(response => response.json());
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Log.enable")]);
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem("efv-local-characters", JSON.stringify([{
      id:"browser-qa-m05-sakura",account:"local-guest",slot:0,characterId:"ayu",name:"M05 QA",
      level:28,exp:0,credits:200,maxHp:900,hp:900,energy:150,maxEnergy:150,attackPower:100,magicPower:100,
      chapterId:"chapter1",mapId:"ch1_m05_sakura_tongji_avenue",spawnId:"ch1_m05_spawn_south_transfer",
      flags:{ch1_complete:true,ch1_final_boss_defeated:true},quests:{},inventory:[],equipment:[],collections:{protocolCards:[]}
    }]));`
  });
  await cdp.send("Page.navigate", { url: URL });
  await cdp.waitFor('document.querySelector("#offlineButton") && !document.querySelector("#offlineButton").disabled');
  await cdp.evaluate('document.querySelector("#offlineButton").click()');
  await cdp.waitFor('!document.querySelector("#serverStage")?.hidden');
  await cdp.evaluate('document.querySelector("#enterServerButton").click()');
  await cdp.waitFor('!document.querySelector("#warehouseStage")?.hidden');
  await cdp.evaluate('document.querySelector("#warehousePlaza .plaza-slot.filled").click()');
  await cdp.evaluate('document.querySelector("#warehousePlaza .plaza-slot.filled").click()');
  await cdp.waitFor('window.__EFV_TEST_SCENE__?.mapData?.id === "ch1_m05_sakura_tongji_avenue"');
  await cdp.evaluate(`(() => {
    const scene = window.__EFV_TEST_SCENE__;
    document.querySelector("#startOverlay").hidden = true;
    scene.actor.setPosition(768, 960);
    scene.actor.body.reset(768, 960);
    scene.cameras.main.centerOn(768, 960);
  })()`);
  await new Promise(resolve => setTimeout(resolve, 1200));

  const result = await cdp.evaluate(`(async () => {
    const scene = window.__EFV_TEST_SCENE__;
    const video = document.querySelector("#chapterEndVideo");
    if (!video.duration) {
      video.preload = "metadata";
      video.load();
      await new Promise(resolve => {
        const done = () => resolve();
        video.addEventListener("loadedmetadata", done, { once: true });
        video.addEventListener("error", done, { once: true });
        setTimeout(done, 8000);
      });
    }
    const textureSize = key => {
      const source = scene.textures.get(key)?.source?.[0];
      return source ? [source.width, source.height] : null;
    };
    return {
      mapId: scene.mapData.id,
      viewport: [scene.cameras.main.width, scene.cameras.main.height],
      cameraZoom: scene.cameras.main.zoom,
      visibleWorld: [scene.cameras.main.worldView.width, scene.cameras.main.worldView.height],
      world: [scene.worldWidth, scene.worldHeight],
      chunks: scene.mapData.background.chunks.map(chunk => ({ key: chunk.key, y: chunk.y, width: chunk.width, height: chunk.height })),
      npcCount: scene.mapNpcs.length,
      npcKeys: scene.mapNpcs.map(entry => entry.item.textureKey),
      npcTextureSizes: [...new Set(scene.mapNpcs.map(entry => entry.item.textureKey))].map(key => [key, textureSize(key)]),
      northTexture: textureSize("ch1-m05-sakura-north-v8"),
      southTexture: textureSize("ch1-m05-sakura-south-v3"),
      video: { width: video.videoWidth, height: video.videoHeight, duration: video.duration, error: video.error?.code || 0 },
      canPlayH264: video.canPlayType('video/mp4; codecs="avc1.640032"')
    };
  })()`, true);

  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const screenshotPath = path.join(ROOT, "tmp", "browser-sakura-avenue-v4-qa.png");
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ ...result, screenshotPath }, null, 2));

  assert.equal(result.mapId, "ch1_m05_sakura_tongji_avenue");
  assert.deepEqual(result.viewport, [1920, 900]);
  assert.ok(Math.abs(result.cameraZoom - 1.25) < 0.01, `expected 1.25 camera zoom, got ${result.cameraZoom}`);
  assert.ok(result.visibleWorld[0] <= result.world[0] + 1, "M5 background must cover the full viewport width");
  assert.deepEqual(result.chunks.map(chunk => [chunk.y, chunk.width, chunk.height]), [[0, 1536, 1160], [960, 1536, 1024]]);
  assert.equal(result.npcCount, 8);
  assert.ok(result.npcKeys.every(key => /^ch1-m05-passerby-[a-d]-v1$/.test(key)));
  assert.ok(result.npcTextureSizes.every(([, size]) => size?.[0] === 256 && size?.[1] === 320));
  assert.deepEqual(result.northTexture, [1536, 1160]);
  assert.deepEqual(result.southTexture, [1536, 1024]);
  assert.deepEqual([result.video.width, result.video.height], [2560, 1440]);
  assert.ok(result.video.duration > 56 && result.video.duration < 57);
  assert.notEqual(result.canPlayH264, "");
  assert.deepEqual(cdp.errors.filter(message => !message.includes("favicon") && !message.includes("WebSocket")), []);
  cdp.socket.close();
})().catch(error => {
  console.error(error.stack || error);
  setTimeout(() => process.exit(1), 20);
});
