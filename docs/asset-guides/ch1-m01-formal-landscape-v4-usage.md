# M01 Formal Landscape v4 Runtime Package

This document describes the compact runtime package kept after the 2026-07-10 asset cleanup. Production source images, QA composites, old atlases and previous versions are available only in the verified external backup.

## Package Contents

| layer | file | runtime use |
| --- | --- | --- |
| assembled | `background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png` | minimap and review image |
| floor | `chunks/ch1-m01-base-v4-floor-tile.png` | reused at all six 1024 x 1024 chunk positions |
| props | `props/ch1-m01-props-atlas-v4-4096x4096.png` | desks, boards and task props |
| back overlay | `foreground/ch1-m01-wall-overlay-v5-3072x2048.png` | wall and garden layer behind actors |
| front overlay | `foreground/ch1-m01-wall-overlay-front-v5-3072x2048.png` | foreground wall occlusion |

All paths are relative to `assets/chapter1/maps/ch1_m01_classroom_spawn/`. Frame definitions, placements, collisions and depths live in `assets/chapter1/chapter1-maps-v1.json`.

## Maintenance Rules

- Keep only the currently selected runtime version in this package.
- Do not add source masters, image-generation outputs, QA overlays or debug sheets here.
- Shared characters, enemies, bosses and VFX belong under `assets/game/`.
- Before replacing an atlas, update the registry and run `node scripts/audit-assets.mjs`.
