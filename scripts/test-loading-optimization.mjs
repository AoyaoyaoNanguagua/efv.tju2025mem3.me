import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const play = readFileSync("play.js", "utf8");
const server = readFileSync("play-server.py", "utf8");
const apache = readFileSync(".htaccess", "utf8");
const registry = JSON.parse(readFileSync("assets/chapter1/chapter1-maps-v1.json", "utf8"));
const preload = play.slice(play.indexOf("    preload() {"), play.indexOf("    create() {"));

assert.match(play, /const ENTRY_LOADING_MIN_MS = 900;/);
assert.match(play, /collectChapterMapRuntimeAssets/);
assert.match(play, /CHAPTER_ONE_ANIMATED_ENEMY_SHEETS/);
assert.match(play, /item\.sheetKey = sheet\.key/);
assert.match(play, /const renderTextureKey = animatedDefinition\?\.sheetKey \|\| textureKey/);
assert.doesNotMatch(preload, /CHAPTER_ONE_ANIMATED_ENEMY_SPRITES\.forEach/);
assert.doesNotMatch(preload, /CHAPTER_ONE_ENEMY_SPRITES\.forEach/);
assert.doesNotMatch(preload, /M02A_MUMU_NPC_KEY/);
assert.doesNotMatch(preload, /M02A_XIAOZHU_PET_KEY/);
assert.doesNotMatch(preload, /PROFESSOR_FLY_KEY/);
assert.doesNotMatch(preload, /BOSS_VOID_PORTAL_KEY/);
assert.doesNotMatch(preload, /-portrait/);

const mapAssetPaths = map => [
  map.background,
  ...(map.background?.chunks || []),
  map.minimapImage,
  ...(map.foregroundOverlays || []),
  ...(map.propAtlases || []),
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

assert.match(server, /max-age=2592000, immutable/);
assert.match(server, /if-none-match/);
assert.match(apache, /image\/webp/);
assert.match(apache, /max-age=2592000, immutable/);
assert.ok(existsSync("dict/legacy-assets-20260713-loading-audit/assets"));

console.log(`Loading optimization passed; M1 map payload ${(m1Bytes / 1048576).toFixed(2)} MiB`);
