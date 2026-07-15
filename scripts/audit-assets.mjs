import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = join(repoRoot, "assets");

function walk(directory, ignored = new Set()) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, ignored));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function repoPath(fullPath) {
  return relative(repoRoot, fullPath).split(sep).join("/");
}

const assetFiles = walk(assetRoot);
const totalBytes = assetFiles.reduce((sum, file) => sum + statSync(file).size, 0);
const issues = [];

const hashes = new Map();
for (const file of assetFiles) {
  if (repoPath(file) === "assets/README.md") continue;
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const matches = hashes.get(hash) || [];
  matches.push(repoPath(file));
  hashes.set(hash, matches);
}

for (const matches of hashes.values()) {
  if (matches.length > 1) issues.push(`Exact duplicate files: ${matches.join(", ")}`);
}

const allowedMapDirectories = new Set(["background", "chunks", "foreground", "npcs", "props", "tiles"]);
for (const file of assetFiles) {
  const rel = relative(assetRoot, file).split(sep).join("/");
  const parts = rel.split("/");
  if (/^chapter\d+$/.test(parts[0]) && ["boss", "enemies", "source", "ui", "vfx"].includes(parts[1])) {
    issues.push(`Shared asset stored in chapter root: assets/${rel}`);
  }
  if (/^chapter\d+$/.test(parts[0]) && parts[1] === "maps" && parts.length >= 4 && !allowedMapDirectories.has(parts[3])) {
    issues.push(`Invalid map package directory: assets/${rel}`);
  }
  if ((/^chapter\d+$/.test(parts[0]) || parts[0] === "game") && /(^|[-_])(raw|source|qa|debug)([-_.]|$)/i.test(rel)) {
    issues.push(`Development artifact in runtime assets: assets/${rel}`);
  }
}

for (const registryFile of assetFiles.filter(file => /chapter\d+-maps-v\d+\.json$/i.test(file))) {
  const registry = JSON.parse(readFileSync(registryFile, "utf8"));
  for (const [mapId, map] of Object.entries(registry.maps || {})) {
    const width = Number(map.background?.width || map.width || 0);
    const height = Number(map.background?.height || map.height || 0);
    const nodes = [...(map.interactionNodes || []), ...(map.exitPoints || [])];
    for (const node of nodes) {
      if (node.x < 0 || node.y < 0 || node.x > width || node.y > height) {
        issues.push(`Interaction outside map bounds: ${mapId}/${node.id}`);
      }
      for (const obstacle of map.obstacles || []) {
        const left = Number(obstacle.x || 0);
        const top = Number(obstacle.y || 0);
        const right = left + Number(obstacle.w || obstacle.width || 0);
        const bottom = top + Number(obstacle.h || obstacle.height || 0);
        if (node.x >= left && node.x <= right && node.y >= top && node.y <= bottom) {
          issues.push(`Interaction inside obstacle: ${mapId}/${node.id} -> ${obstacle.id || "unnamed"}`);
        }
      }
    }
  }
}

const ignoredSourceDirectories = new Set([
  ".agents",
  ".codex",
  ".git",
  "contrib",
  "deployment",
  "dict",
  "docs",
  "node_modules",
  "release",
  "scripts",
  "share",
  "tmp"
]);
const ignoredRootSourceFiles = new Set([
  "ai_context.html",
  "contribution_guide.html",
  "gdd_scope_review.html"
]);
const sourceFiles = walk(repoRoot, ignoredSourceDirectories).filter(file => {
  const rel = repoPath(file);
  const extension = extname(file).toLowerCase();
  if (rel.startsWith("assets/")) return extension === ".json";
  if (!rel.includes("/") && ignoredRootSourceFiles.has(rel)) return false;
  return [".css", ".html", ".js", ".json"].includes(extension);
});

const assetReferencePattern = /assets\/[A-Za-z0-9_./*\-]+\.(?:gif|jpe?g|json|m4a|mp3|mp4|ogg|png|wav|webm|webp)/gi;
const references = new Set();
for (const sourceFile of sourceFiles) {
  const contents = readFileSync(sourceFile, "utf8").replaceAll("\\", "/");
  for (const match of contents.matchAll(assetReferencePattern)) {
    const assetPath = match[0];
    if (assetPath.includes("*")) continue;
    references.add(assetPath);
    if (!statSafe(join(repoRoot, ...assetPath.split("/")))) {
      issues.push(`Missing asset reference in ${repoPath(sourceFile)}: ${assetPath}`);
    }
  }
}

function statSafe(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const unreferenced = assetFiles
  .map(repoPath)
  .filter(file => file !== "assets/README.md" && !references.has(file));

console.log(`Assets: ${assetFiles.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
console.log(`Direct references: ${references.size}`);
if (unreferenced.length) {
  console.log(`Unreferenced files (${unreferenced.length}):`);
  unreferenced.forEach(file => console.log(`  ${file}`));
}

if (issues.length) {
  console.error(`Asset audit failed with ${issues.length} issue(s):`);
  [...new Set(issues)].forEach(issue => console.error(`  - ${issue}`));
  process.exitCode = 1;
} else {
  console.log("Asset audit passed: no missing references, exact duplicates, placement violations or blocked interactions.");
}
