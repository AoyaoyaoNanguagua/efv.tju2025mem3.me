# Chapter 1 Active Asset Index

Updated: 2026-07-15

This index lists active runtime assets after the full cleanup. Historical source and review files are not part of the working asset tree.

## Map Registry

| id | path | status |
| --- | --- | --- |
| chapter map registry | `assets/chapter1/chapter1-maps-v1.json` | active, authoritative |

## Map Packages

| map | retained runtime files |
| --- | --- |
| M01 classroom | assembled background, one reusable floor tile, current prop atlas, two wall overlays |
| M02 prompt archive | v3 wide background and 12 v3 chunks |
| M03 agent lab | v2 background and 4 renamed v2 chunks |
| M04 structural mechanics lab | 4 native L-shaped structural-lab panels, three WebGL-safe structural boss phase sheets v7, charging elites v4 |
| M05 sakura Tongji avenue | 2 continuation panels; north v8 is outpainted from an exact 200px crop of south v3 and keeps that strip as overlap; four dedicated passerby sprites provide the stationary 2/1/1/4 NPC groups; camera width fitting covers 1920px and wider viewports without exposing the clear color |
| Chapter-end cinematic | `p1boss-end-1440p30-h264-v1.mp4`, 2560×1440 at 30fps, H.264/AAC with fast-start metadata for browser playback |

All map files live under `assets/chapter1/maps/<map_id>/`.

## Shared Characters And Enemies

| category | path |
| --- | --- |
| animated enemies | `assets/game/enemies/animated/` |
| boss-wave cutouts | `assets/game/enemies/cutouts/` |
| portraits | `assets/game/enemies/portraits/` |
| non-runtime concepts used by pages | `assets/game/enemies/concepts/` |
| NPC sprites | `assets/game/characters/npcs/` |
| bosses | `assets/game/bosses/` |

Animated enemy sheets currently include the leaf poring, runaway magic broom, biting magic book, M02 copy-paste shadow, M02 tone-drift archivist, the M03 enemy family, and the M04 three-stage structural boss with its three dedicated charging elites. Boss-wave cutouts for quantum, blockchain and AI Agent encounters share the same global cutout directory.

M04 art direction and v7 three-sheet runtime mapping is documented in `docs/asset-guides/ch1-m04-structural-boss-v4-usage.md`. Its active concept masters live under `assets/chapter1/concepts/m04/`.

## Shared VFX And UI

| category | path |
| --- | --- |
| transfer / boss portals | `assets/game/vfx/` |
| HUD skin and quickbar icons | `assets/ui/hud/` |
| start screen | `assets/ui/start-screen-bg-v4.png` |

## Removed From Active Assets

- Image-generation raw files and source masters
- QA/debug composites and process previews
- Superseded M01-M04 backgrounds, chunks and atlases
- Chapter-local copies of enemies, bosses, VFX and HUD sheets
- Exact duplicate files, including the six identical M01 floor chunks
- Stale standalone M01 and P0 placeholder/runtime JSON files

The pre-cleanup tree is preserved in the verified external backup named `efv260710-assets-backup-20260710-102216` beside the repository.

Run `node scripts/audit-assets.mjs` before merging asset changes.
