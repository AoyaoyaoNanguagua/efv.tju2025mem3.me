import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const play = readFileSync("play.js", "utf8");
const html = readFileSync("play.html", "utf8");
const overrides = readFileSync("play-overrides.css", "utf8");
const server = readFileSync("play-server.py", "utf8");
const apache = readFileSync(".htaccess", "utf8");
const gitignore = readFileSync(".gitignore", "utf8");
const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const preload = play.slice(play.indexOf("    preload() {"), play.indexOf("    create() {"));

assert.match(play, /const ENTRY_LOADING_MIN_MS = 900;/);
assert.match(play, /collectChapterMapRuntimeAssets/);
assert.match(play, /CHAPTER_ONE_ANIMATED_ENEMY_SHEETS/);
assert.match(play, /item\.sheetKeys = paths\.map/);
assert.match(play, /action\.sheetKey = item\.sheetKeys/);
assert.match(play, /const renderTextureKey = animatedDefinition\?\.sheetKey \|\| textureKey/);
assert.doesNotMatch(preload, /CHAPTER_ONE_ANIMATED_ENEMY_SPRITES\.forEach/);
assert.doesNotMatch(preload, /CHAPTER_ONE_ENEMY_SPRITES\.forEach/);
assert.doesNotMatch(preload, /M02A_MUMU_NPC_KEY/);
assert.doesNotMatch(preload, /M02A_XIAOZHU_PET_KEY/);
assert.doesNotMatch(preload, /PROFESSOR_FLY_KEY/);
assert.doesNotMatch(preload, /BOSS_VOID_PORTAL_KEY/);
assert.doesNotMatch(preload, /-portrait/);

const areaTitle = play.slice(play.indexOf("    showAreaTitle("), play.indexOf("    ensureMapAssetsLoaded("));
assert.match(areaTitle, /fontFamily: "Microsoft YaHei, PingFang SC, sans-serif"/);
assert.doesNotMatch(areaTitle, /STKaiti|KaiTi|fillRoundedRect|区域发现/);
assert.doesNotMatch(html, /id="chatToggleButton"/);
assert.doesNotMatch(html, /id="reconnectButton"/);
assert.match(overrides, /\.boss-panel\.m04-text-only/);
assert.match(overrides, /background: transparent;/);
assert.match(overrides, /grid-template-columns: repeat\(3, 40px\)/);
assert.match(overrides, /grid-template-rows: repeat\(2, 36px\)/);
assert.match(play, /prepareCinematicMapTransition\(node\)/);
assert.match(play, /ensureChapterEndCinematicReady\(\)/);
assert.match(play, /getChapterEndCinematicBufferedSeconds/);
assert.match(play, /setMapLoadingProgress\(100, "动画与新地图已就绪"\)/);
assert.match(html, /p1boss-end-1440p30-h264-v1\.mp4\?v=20260715-2k30-h264-v1/);

const mapAssetPaths = map => [
  map.background,
  ...(map.background?.chunks || []),
  map.minimapImage,
  ...(map.foregroundOverlays || []),
  ...(map.propAtlases || []),
  ...(map.npcs || []),
].filter(item => item?.path).map(item => item.path);

for (const map of Object.values(registry.maps)) {
  for (const assetPath of new Set(mapAssetPaths(map))) {
    assert.ok(existsSync(assetPath), `missing optimized map asset ${assetPath}`);
  }
}

const m1Paths = [...new Set(mapAssetPaths(registry.maps.ch1_m01_classroom_spawn))];
const m1Bytes = m1Paths.reduce((sum, assetPath) => sum + statSync(assetPath).size, 0);
assert.ok(m1Bytes < 4 * 1024 * 1024, `M1 map payload must stay below 4 MiB, got ${(m1Bytes / 1048576).toFixed(2)}`);
assert.ok(m1Paths.some(assetPath => /minimap-runtime-v1\.webp$/.test(assetPath)));
assert.ok(Object.values(registry.maps).flatMap(mapAssetPaths).filter(path => /background|foreground|chunks/.test(path)).every(path => /\.(webp|jpg)$/.test(path)));

const cinematicPath = "assets/cg/p1boss-end-1440p30-h264-v1.mp4";
assert.ok(statSync(cinematicPath).size > 20 * 1024 * 1024, "2K ending CG must retain a high-quality video payload");
assert.ok(statSync(cinematicPath).size < 140 * 1024 * 1024, "browser ending CG must stay below the original 4K60 payload");
const videoHeader = readFileSync(cinematicPath).subarray(0, 256 * 1024);
const moovOffset = videoHeader.indexOf(Buffer.from("moov"));
const mdatOffset = videoHeader.indexOf(Buffer.from("mdat"));
assert.ok(moovOffset >= 0 && mdatOffset >= 0 && moovOffset < mdatOffset, "ending CG must keep fast-start metadata before media data");
assert.equal(registry.maps.ch1_m04_library_lawn_boss.interactionNodes.find(node => node.id === "ch1_m04_node_completion").cinematicBeforeTransition, true);

assert.match(server, /max-age=2592000, immutable/);
assert.match(server, /if-none-match/);
assert.match(server, /content-range/);
assert.match(server, /status = 206/);
assert.match(server, /BrokenPipeError, ConnectionResetError, ConnectionAbortedError/);
assert.match(apache, /image\/webp/);
assert.match(apache, /max-age=2592000, immutable/);
assert.match(gitignore, /^dict\/$/m, "local legacy asset archives must stay outside release and Git checkouts");

console.log(`Loading optimization passed; M1 map payload ${(m1Bytes / 1048576).toFixed(2)} MiB`);
