# Chapter 1 P0 Asset Index

## Scope

This index covers the first playable vertical slice from `ch1_m01_classroom_spawn` to the final Chapter 1 boss point. The current runtime uses generated Chapter 1 maps, UI, portals, professor, and boss-wave enemy cutouts.

## Data Files

| file | role | status |
| --- | --- | --- |
| `assets/chapter1/chapter1-maps-v1.json` | 4-map runtime registry, exits, NPC/task nodes, encounters | active runtime data |
| `assets/chapter1/ch1-m01-classroom-spawn.json` | playable/connectable start map data | usable data |
| `assets/chapter1/chapter1-p0-runtime.json` | chapter route, flags, protocol cards, boss, completion | usable data |
| `assets/chapter1/chapter1-p0-placeholder-index.json` | missing art placeholder registry and reuse mapping | placeholder index |
| `docs/asset-guides/ch1-m01-classroom-spawn-usage.md` | start map integration and QA guide | usable doc |
| `docs/asset-guides/chapter1-small-map-runtime-usage.md` | generated small-map, UI, boss-wave art integration guide | active doc |

## Chapter Route

| order | map id | role | current state | next gate |
| --- | --- | --- | --- | --- |
| 1 | `ch1_m01_classroom_spawn` | start classroom, protocol cards, first enemy wave | generated background + runtime data | `ch1_m01_exit_to_m02` |
| 2 | `ch1_m02_prompt_archive` | prompt archive, source/citation teaching, schema card | generated background + runtime data | `ch1_m02_exit_to_m03` |
| 3 | `ch1_m03_agent_lab` | agent lab combat pressure and small boss | generated background + runtime data | `ch1_m03_exit_to_m04` |
| 4 | `ch1_m04_library_lawn_boss` | final professor summoner boss and chapter clear | generated background + runtime data | boss chest clear |

## Reused Assets

| asset id | path | use |
| --- | --- | --- |
| `reuse-zhonghe-ground-tileset` | `assets/maps/tilesets/zhonghe-plaza-ground-tileset-v1.png` | P0 classroom floor and wall tile plan |
| `reuse-zhonghe-props-atlas` | `assets/maps/props/zhonghe-plaza-props-atlas-v1.png` | desks, boards, lamps, boundary props |
| `reuse-zhonghe-macro-props` | `assets/maps/props/zhonghe-plaza-macro-props-v1.png` | blackboard stand, protocol deck, front flower boundary |
| `reuse-leaf-poring-enemy` | `assets/enemies/leaf-poring-sprites-v2.png` | demand-bug and copy-paste-shadow fallback enemy |

## Generated Runtime Art

| asset id | path | use |
| --- | --- | --- |
| `ch1-ui-hud-skin-sheet-v1` | `assets/chapter1/ui/ch1-ui-hud-skin-sheet-v1.png` | HUD, chat, minimap, quickbar, prompt, boss panel skin texture |
| `ch1-quickbar-icons-sheet-v1` | `assets/chapter1/ui/ch1-quickbar-icons-sheet-v1.png` | bottom-center quickbar icon sheet with shortcut labels |
| `ch1-map-classroom-spawn-bg-v2-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-bg-v2-2048.png` | 2048 concept/minimap source for the spawn map |
| `ch1-map-prompt-archive-bg-v2-2048` | `assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-map-prompt-archive-bg-v2-2048.png` | 2048 concept/minimap source for the archive map |
| `ch1-map-agent-lab-bg-v2-2048` | `assets/chapter1/maps/ch1_m03_agent_lab/background/ch1-map-agent-lab-bg-v2-2048.png` | 2048 concept/minimap source for the agent lab |
| `ch1-map-library-lawn-boss-bg-v2-2048` | `assets/chapter1/maps/ch1_m04_library_lawn_boss/background/ch1-map-library-lawn-boss-bg-v2-2048.png` | 2048 concept/minimap source for the boss arena |
| `ch1-map-runtime-chunks` | `assets/chapter1/maps/*/chunks/*.png` | 1024 x 1024 real playable chunks stitched into 2048 maps |
| `ch1-map-teleport-portal-sheet-v1` | `assets/chapter1/vfx/ch1-map-teleport-portal-sheet-v1.png` | animated map transfer portal ring |
| `ch1-boss-void-portal-sheet-v1` | `assets/chapter1/vfx/ch1-boss-void-portal-sheet-v1.png` | ethereal borderless boss summon portal |
| `ch1-ai-professor-summoner-game-cutout-v1` | `assets/chapter1/boss/ai-professor-summoner-game-cutout-v1.png` | professor summoner runtime body from `docs/asset-guides/ai-professor-summoner-concept-v1.png` |
| `ch1-boss-wave-enemy-cutouts` | `assets/chapter1/enemies/ch1-enemy-*-cutout-v*.png` | quantum, blockchain, and AI Agent rare/elite/mob runtime images from `docs/asset-guides/boss-wave-*-concept-*.png` |

## Protocol Cards

| card id | first map | purpose |
| --- | --- | --- |
| `ch1_card_context_window` | `ch1_m01_classroom_spawn` | reveals nearby hidden interaction notes |
| `ch1_card_traceable_instruction` | `ch1_m01_classroom_spawn` | marks quest-relevant nodes and teaches verifiable requests |
| `ch1_card_schema_lock` | `ch1_m02_prompt_archive` | gates the agent lab and teaches stable schemas |
| `ch1_card_handoff_note` | `ch1_m03_agent_lab` | prepares the final boss route handoff |

## Flag Spine

The core clear path is:

`ch1_intro_entered_classroom` -> `ch1_intro_read_syllabus` -> `ch1_intro_card_claimed` -> `ch1_m01_bug_notes_cleared` -> `ch1_m01_cleared` -> `ch1_card_schema_lock_collected` -> `ch1_m02_archive_cleared` -> `ch1_m03_small_boss_cleared` -> `ch1_final_boss_defeated` -> `ch1_complete`

## Placeholder Art Targets

| placeholder id | target path | substitute now | batch |
| --- | --- | --- | --- |
| `ch1-m01-classroom-concept` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-design-640-v1.png` | generated concept thumbnail | done |
| `ch1-m01-classroom-assembled-preview` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-bg-v1.png` | generated runtime background | done |
| `ch1-m02-prompt-archive-concept` | `assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-map-prompt-archive-design-640-v1.png` | generated concept thumbnail | done |
| `ch1-m03-agent-lab-concept` | `assets/chapter1/maps/ch1_m03_agent_lab/background/ch1-map-agent-lab-design-640-v1.png` | generated concept thumbnail | done |
| `ch1-m04-library-lawn-boss-concept` | `assets/chapter1/maps/ch1_m04_library_lawn_boss/background/ch1-map-library-lawn-boss-design-640-v1.png` | generated concept thumbnail | done |
| `ch1-enemy-demand-bug-sprites` | `assets/chapter1/enemies/ch1-demand-bug-sprites-v1.png` | `assets/enemies/leaf-poring-sprites-v2.png` | batch-06 |
| `ch1-boss-ai-professor-exam-sprites` | `assets/chapter1/boss/ch1-ai-professor-exam-sprites-v1.png` | `assets/enemies/autumn-ruin-portrait-v1.png` | batch-07 |

## Merge Notes

- `play.js` now reads `assets/chapter1/chapter1-maps-v1.json` first, then falls back to older Zhonghe map data if the registry fails to load.
- Runtime maps are 2048 x 2048. The 2048 concept image is also used as the minimap texture, while the in-world scene is stitched from 1024 x 1024 chunks so 147px characters read at a believable prop scale.
- Collision with monsters is physical only. Damage is applied only from monster attacks or future explicit skill/passive hitboxes.
- Boss-wave enemies no longer use the leaf slime fallback. All three professor waves now use generated quantum, blockchain, and AI Agent cutouts with real HP bars and drops.
