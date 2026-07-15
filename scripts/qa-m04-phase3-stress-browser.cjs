const assert = require("node:assert/strict");

const DEBUG_PORT = Number(process.env.EFV_EDGE_DEBUG_PORT || 9333);
const URL = "http://127.0.0.1:8787/play.html";
let activeCdp = null;

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    this.requestUrls = new Map();
    this.networkFailures = [];
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
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params?.exceptionDetails?.text || "Runtime exception");
      }
      if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
        const entry = message.params.entry;
        this.errors.push(`${entry.text}${entry.url ? ` (${entry.url})` : ""}`);
      }
      if (message.method === "Network.requestWillBeSent") {
        this.requestUrls.set(message.params.requestId, message.params.request?.url || "");
      }
      if (message.method === "Network.loadingFailed") {
        this.networkFailures.push({
          url: this.requestUrls.get(message.params.requestId) || "",
          errorText: message.params.errorText || "",
          canceled: !!message.params.canceled,
          type: message.params.type || ""
        });
      }
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
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
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

  close() {
    this.socket?.close();
  }
}

(async () => {
  const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: "PUT" }).then(response => response.json());
  const cdp = new CdpClient(target.webSocketDebuggerUrl);
  activeCdp = cdp;
  await cdp.connect();
  await Promise.all([
    cdp.send("Page.enable"),
    cdp.send("Runtime.enable"),
    cdp.send("Log.enable"),
    cdp.send("Network.enable")
  ]);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem("efv-local-characters", JSON.stringify([{
      id:"browser-qa-m04-phase3",account:"local-guest",slot:0,characterId:"ayu",name:"Phase3 Stress QA",
      level:28,exp:0,credits:200,maxHp:99999,hp:99999,energy:150,maxEnergy:150,attackPower:100,magicPower:100,
      chapterId:"chapter1",mapId:"ch1_m04_library_lawn_boss",spawnId:"ch1_m04_spawn_from_agent_lab",
      flags:{ch1_m03_small_boss_cleared:true},quests:{},inventory:[],equipment:[],collections:{protocolCards:[]}
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
  try {
    await cdp.waitFor('window.__EFV_TEST_SCENE__?.actor?.body?.enable');
  } catch (error) {
    const state = await cdp.evaluate(`({
      loginHidden: document.querySelector("#loginStage")?.hidden,
      serverHidden: document.querySelector("#serverStage")?.hidden,
      warehouseHidden: document.querySelector("#warehouseStage")?.hidden,
      gameHidden: document.querySelector("#gameStage")?.hidden,
      overlayHidden: document.querySelector("#startOverlay")?.hidden,
      scene: Boolean(window.__EFV_TEST_SCENE__),
      bodyText: document.querySelector("#warehouseStage")?.innerText?.slice(0, 500)
    })`);
    console.error("browser-state", JSON.stringify(state));
    console.error("browser-errors", JSON.stringify(cdp.errors));
    throw error;
  }
  await cdp.evaluate('document.querySelector("#startOverlay").hidden = true');

  const result = await cdp.evaluate(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const scene = window.__EFV_TEST_SCENE__;
    scene.leafSlimes.getChildren().slice().forEach(slime => scene.syncSlimeRemove(slime.slimeId));
    const boss = scene.spawnM04FinalBoss();
    scene.triggerStructuralBossTransform(boss, { network: true });
    await wait(1700);
    const chargingEnemies = scene.leafSlimes.getChildren().filter(enemy => enemy.active && !["dead", "vanish"].includes(enemy.state));
    const chargers = chargingEnemies.filter(enemy => enemy.bossCharger);
    const reinforcementsBefore = chargingEnemies.filter(enemy => enemy.groupId === "ch1_m04_structural_reinforcements").length;
    chargers.forEach(enemy => {
      enemy.state = "dead";
      enemy.body.enable = false;
    });
    scene.updateStructuralBossCharging(boss, scene.time.now + 16);
    const reinforcementsAfterUnlock = scene.leafSlimes.getChildren()
      .filter(enemy => enemy.active && enemy.groupId === "ch1_m04_structural_reinforcements" && !["dead", "vanish"].includes(enemy.state)).length;
    const lightningOrigin = { x: boss.x, y: boss.y };
    scene.playStructuralSideLightning(boss, "left", { network: true, synchronized: true });
    await wait(1000);
    const bossStoppedDuringTelegraph = Math.hypot(boss.x - lightningOrigin.x, boss.y - lightningOrigin.y) < 1
      && Math.hypot(boss.body.velocity.x, boss.body.velocity.y) < 1;
    await wait(2350);
    const phase2 = {
      phase: boss.bossPhase,
      chargers: chargers.length,
      reinforcementsBefore,
      reinforcementsAfterUnlock,
      bodyEnabled: !!boss.body?.enable,
      bossStoppedDuringTelegraph,
      lightningFinished: !boss.structuralSideLightningActive
    };
    boss.hp = 0;
    scene.updateLeafSlimes(scene.time.now, 16);
    await wait(1200);
    scene.actor.setPosition(boss.x + 330, boss.y + 40);
    scene.actor.body.reset(scene.actor.x, scene.actor.y);
    const baseline = {
      children: scene.children.list.length,
      timers: scene.time._active?.length || 0,
      tweens: scene.tweens.getTweens().length
    };
    const samples = [];
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const route = [0, 1, 2, 3, 4].map(index => ({
        x: boss.x + Math.cos((index + cycle) * 1.25) * (180 + index * 24),
        y: boss.y + Math.sin((index + cycle) * 1.25) * (130 + index * 18)
      }));
      scene.startStructuralBossDash(boss, route, { network: true, synchronized: true });
      await wait(2300);
      const plan = scene.buildStructuralMarkedLightningPlan();
      scene.playStructuralMarkedLightning(boss, plan, { network: true, synchronized: true });
      await wait(2450);
      samples.push({
        cycle,
        children: scene.children.list.length,
        timers: scene.time._active?.length || 0,
        tweens: scene.tweens.getTweens().length,
        bossPhase: boss.bossPhase,
        bodyEnabled: !!boss.body?.enable,
        dashing: !!boss.structuralDashing,
        marked: !!boss.structuralMarkedLightningActive
      });
    }
    boss.structuralPhase3DashAt = Number.POSITIVE_INFINITY;
    boss.structuralPhase3MarkedAt = Number.POSITIVE_INFINITY;
    boss.chaseSpeed = 0;
    boss.setPosition(scene.worldWidth - 160, 160);
    boss.body.reset(boss.x, boss.y);
    scene.actor.setPosition(120, scene.worldHeight - 120);
    scene.actor.body.reset(scene.actor.x, scene.actor.y);
    await wait(6200);
    let frames = 0;
    const start = performance.now();
    await new Promise(resolve => {
      const step = () => {
        frames += 1;
        if (performance.now() - start >= 1000) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const settled = {
      children: scene.children.list.length,
      timers: scene.time._active?.length || 0,
      tweens: scene.tweens.getTweens().length
    };
    boss.setPosition(scene.worldWidth / 2, scene.worldHeight / 2);
    boss.body.reset(boss.x, boss.y);
    scene.actor.setPosition(boss.x + 72, boss.y);
    scene.actor.body.reset(scene.actor.x, scene.actor.y);
    const knockbackStart = { x: scene.actor.x, y: scene.actor.y };
    scene.applyStructuralPursuitKnockback(boss);
    await wait(90);
    const knockbackMidDistance = Math.hypot(scene.actor.x - knockbackStart.x, scene.actor.y - knockbackStart.y);
    const knockbackGhosts = scene.children.list.filter(child => child.getData?.("structuralKnockbackGhost")).length;
    await wait(260);
    const knockback = {
      midDistance: knockbackMidDistance,
      finalDistance: Math.hypot(scene.actor.x - knockbackStart.x, scene.actor.y - knockbackStart.y),
      ghosts: knockbackGhosts,
      bodyEnabled: !!scene.actor.body?.enable
    };
    boss.hp = 0;
    scene.killLeafSlime(boss);
    await wait(320);
    const deathPose = { state: boss.state, active: !!boss.active, bodyEnabled: !!boss.body?.enable };
    await wait(3500);
    const death = { pose: deathPose, gone: !boss.active };
    return {
      baseline,
      phase2,
      samples,
      settled,
      frames,
      bossPhase: boss.bossPhase,
      bodyEnabled: !!boss.body?.enable,
      actorResponsive: !!scene.actor?.body?.enable,
      actionLocked: !!scene.isActionLocked,
      firePaths: scene.structuralFirePaths?.size || 0,
      knockback,
      death
    };
  })()`, true);

  console.log(JSON.stringify(result, null, 2));
  if (cdp.networkFailures.length) console.log("network-failures", JSON.stringify(cdp.networkFailures, null, 2));
  assert.equal(result.bossPhase, "phase3");
  assert.equal(result.phase2.phase, "phase2Combat");
  assert.equal(result.phase2.chargers, 3);
  assert.ok(result.phase2.reinforcementsBefore > 0);
  assert.equal(result.phase2.reinforcementsAfterUnlock, result.phase2.reinforcementsBefore);
  assert.equal(result.phase2.bodyEnabled, true);
  assert.equal(result.phase2.bossStoppedDuringTelegraph, true);
  assert.equal(result.phase2.lightningFinished, true);
  assert.equal(result.samples.at(-1).bodyEnabled, true);
  assert.equal(result.actorResponsive, true);
  assert.equal(result.actionLocked, false);
  assert.ok(result.knockback.midDistance > 24 && result.knockback.midDistance < result.knockback.finalDistance, `knockback did not travel visibly: ${JSON.stringify(result.knockback)}`);
  assert.ok(result.knockback.finalDistance >= 300, `knockback did not cover five tiles: ${JSON.stringify(result.knockback)}`);
  assert.ok(result.knockback.ghosts >= 3, `knockback trail missing: ${JSON.stringify(result.knockback)}`);
  assert.equal(result.knockback.bodyEnabled, true);
  assert.equal(result.death.pose.state, "dead");
  assert.equal(result.death.pose.active, true);
  assert.equal(result.death.pose.bodyEnabled, false);
  assert.equal(result.death.gone, true);
  assert.ok(result.frames >= 20, `event loop only rendered ${result.frames} frames in one second`);
  assert.ok(result.firePaths <= 6, `fire paths exceeded cap: ${result.firePaths}`);
  assert.ok(result.settled.children <= result.baseline.children + 48, `scene children leaked: ${JSON.stringify(result)}`);
  assert.ok(result.settled.timers <= result.baseline.timers + 10, `timers leaked: ${JSON.stringify(result)}`);
  assert.ok(result.settled.tweens <= result.baseline.tweens + 10, `tweens leaked: ${JSON.stringify(result)}`);
  const hardNetworkFailures = cdp.networkFailures.filter(failure => !failure.canceled && failure.errorText !== "net::ERR_ABORTED");
  const relevantErrors = cdp.errors.filter(message =>
    !message.includes("favicon")
    && !message.includes("WebSocket")
    && !message.includes("net::ERR_ABORTED")
    && !(message.includes("net::ERR_FAILED") && hardNetworkFailures.length === 0)
  );
  assert.deepEqual(hardNetworkFailures, [], `network failures: ${JSON.stringify(hardNetworkFailures)}`);
  assert.deepEqual(relevantErrors, [], `browser errors: ${relevantErrors.join(" | ")}`);
  cdp.close();
  activeCdp = null;
})().catch(error => {
  console.error(error.stack || error);
  activeCdp?.close();
  setTimeout(() => process.exit(1), 20);
});
