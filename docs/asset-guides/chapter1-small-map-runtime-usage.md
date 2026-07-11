# Chapter 1 Map Runtime Guide

## Registry

`assets/chapter1/chapter1-maps-v1.json` is the only chapter map registry. It owns map dimensions, backgrounds, chunks, spawns, props, obstacles, task nodes, encounters and transfer points.

## Map Order

| order | map id | active package | primary function |
| --- | --- | --- | --- |
| 1 | `ch1_m01_classroom_spawn` | assembled v4 + one reused floor tile + prop/wall atlases | new-character spawn, professor NPC, first tasks |
| 2 | `ch1_m02_prompt_archive` | `ch1-map-prompt-archive-bg-v3-6144x2048.png` + 12 `ch1-m02-archive-v3-*` chunks | citation/schema tasks and archive encounters |
| 3 | `ch1_m03_agent_lab` | `ch1-map-agent-lab-bg-v2-2048.png` + 4 `ch1-m03-agent-lab-v2-*` chunks | console task and lab encounter |
| 4 | `ch1_m04_library_lawn_boss` | 4 `ch1-m04-lab-*-v1.png` chunks | L-shaped structural mechanics lab, three summon stages, final boss, and reward chest |

Each package lives under `assets/chapter1/maps/<map_id>/`. Allowed map subdirectories are `background`, `chunks`, `foreground` and `props`.

## Shared Runtime Art

- Animated enemies: `assets/game/enemies/animated/`
- Static enemy cutouts: `assets/game/enemies/cutouts/`
- Enemy portraits and concepts: `assets/game/enemies/portraits/`, `assets/game/enemies/concepts/`
- NPCs: `assets/game/characters/npcs/`
- Bosses: `assets/game/bosses/`
- VFX: `assets/game/vfx/`
- HUD: `assets/ui/hud/`

Map packages must reference these files rather than copy them into chapter or map folders.

## QA Checklist

1. Run `node scripts/audit-assets.mjs` and require zero missing references, duplicate files and placement violations.
2. Enter M01 with a new character and verify the center spawn.
3. Return from M02 and verify the lower M01 transfer spawn.
4. Walk to each task interaction point without crossing collision geometry.
5. Verify each task object uses a visually matching texture and a static light/shadow hint.
6. Traverse M01 -> M02 -> M03 -> M04 and back.
