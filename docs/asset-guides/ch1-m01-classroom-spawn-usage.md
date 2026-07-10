# M01 Classroom Spawn Runtime Guide

## Runtime Source

- Map id: `ch1_m01_classroom_spawn`
- Registry: `assets/chapter1/chapter1-maps-v1.json`
- World size: `3072 x 2048`
- The old standalone M01 JSON and production manifests were removed on 2026-07-10. The chapter registry is the only runtime source.

## Active Assets

| purpose | path |
| --- | --- |
| minimap / assembled view | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png` |
| repeated floor chunk | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v4-floor-tile.png` |
| prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4-4096x4096.png` |
| wall back overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-v5-3072x2048.png` |
| wall front overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-front-v5-3072x2048.png` |

The six M01 floor positions intentionally reuse the same texture. Do not copy the file six times.

## Spawn Rules

| case | spawn id | position |
| --- | --- | --- |
| New character / normal entry | `ch1_m01_spawn_player_start` | `(1536, 1220)`, center of the classroom |
| Return from M02 | `ch1_m01_spawn_from_archive` | `(1536, 1885)`, lower transfer point |

The professor NPC uses `assets/game/characters/npcs/ai-professor-npc-idle-sheet-v2.png`: four 192x256 chibi idle frames in one horizontal row, aligned to a shared foot baseline. Reusable enemies, bosses and VFX must stay under `assets/game/`; they must not be copied into this map folder.

## Editing Checklist

1. Edit map data only in `assets/chapter1/chapter1-maps-v1.json`.
2. Keep interaction nodes on reachable walkable positions and outside obstacle rectangles.
3. Use a matching prop frame for every task label; do not use a generic quest marker as the task object.
4. Run `node scripts/audit-assets.mjs` after changing paths or files.
