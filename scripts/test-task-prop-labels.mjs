import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "play.js"), "utf8");

assert.match(source, /const isTaskPropLabel = node\.type !== "teleport" && !!markerKey;/);
assert.match(source, /const markerTopY = markerY[\s\S]*markerHeight \* markerScale \* markerOriginY;/);
assert.match(source, /labelY = Math\.min\(configuredLabelY, markerTopY - 10\);/);
assert.match(source, /color: "#111111",\s+stroke: "#ffffff",\s+strokeThickness: 4/);
assert.match(source, /Math\.max\(Number\(node\.labelDepth\)[\s\S]*Number\(marker\?\.depth\)[\s\S]*Number\(node\.y\) \+ 8\) \+ 160/);

const taskStyleStart = source.indexOf("const labelStyle = isTaskPropLabel");
const regularStyleStart = source.indexOf(": {", taskStyleStart + 40);
const taskStyleSource = source.slice(taskStyleStart, regularStyleStart);
assert.ok(taskStyleStart >= 0 && regularStyleStart > taskStyleStart);
assert.ok(!taskStyleSource.includes("backgroundColor"), "task prop labels must not have a background panel");

console.log("Task prop labels use above-prop placement, black text, white outline and no background");
