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
| `docs/asset-guides/ch1-m01-formal-landscape-v4-usage.md` | formal M1 landscape v4 asset package, placement, 8-direction wall families, and QA guide | active m01 usage doc |
| `docs/asset-guides/chapter1-small-map-runtime-usage.md` | generated small-map, UI, boss-wave art integration guide | active doc |
| `docs/asset-guides/chapter1-layered-map-production-workflow.md` | seam-safe, scale-locked, orthographic marker-first layered map production workflow | active workflow doc |
| `docs/asset-guides/ch1-m01-formal-map-production-workflow.md` | formal M1 marker-base, four-block expansion, and asset-specific scale SOP | active production guide |
| `docs/asset-guides/ch1-m01-layered-redraw-prompt-v1.md` | prompt and QA notes for the first spawn-screen redraw test | v1 scale proof; not final art route |
| `docs/asset-guides/ch1-m01-layered-redraw-v2-production-plan.md` | 2x source master, orthographic clean base, marker anchors, prop atlas, and placement plan for the next m01 pass | active next-pass plan |

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
| `ch1-map-classroom-spawn-base-v4-3072x2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v4-3072x2048.png` | active m01 v4 tile-floor clean base |
| `ch1-map-classroom-spawn-assembled-v4-3072x2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png` | active m01 v4 minimap/assembled review |
| `ch1-m01-props-atlas-v4-4096x4096` | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4-4096x4096.png` | active m01 v4 prop atlas with baked contact shadows and 8-direction wall families |
| `ch1-m01-layered-map-manifest-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v4.json` | active m01 v4 marker, placement, scale, collision, and QA manifest |
| `ch1-map-prompt-archive-bg-v2-2048` | `assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-map-prompt-archive-bg-v2-2048.png` | 2048 concept/minimap source for the archive map |
| `ch1-map-agent-lab-bg-v2-2048` | `assets/chapter1/maps/ch1_m03_agent_lab/background/ch1-map-agent-lab-bg-v2-2048.png` | 2048 concept/minimap source for the agent lab |
| `ch1-map-library-lawn-boss-bg-v2-2048` | `assets/chapter1/maps/ch1_m04_library_lawn_boss/background/ch1-map-library-lawn-boss-bg-v2-2048.png` | 2048 concept/minimap source for the boss arena |
| `ch1-map-runtime-chunks` | `assets/chapter1/maps/*/chunks/*.png` | 1024 x 1024 real playable chunks stitched into 2048 maps |
| `ch1-map-teleport-portal-sheet-v1` | `assets/chapter1/vfx/ch1-map-teleport-portal-sheet-v1.png` | animated map transfer portal ring |
| `ch1-boss-void-portal-sheet-v1` | `assets/chapter1/vfx/ch1-boss-void-portal-sheet-v1.png` | ethereal borderless boss summon portal |
| `ch1-ai-professor-summoner-game-cutout-v1` | `assets/chapter1/boss/ai-professor-summoner-game-cutout-v1.png` | professor summoner runtime body from `docs/asset-guides/ai-professor-summoner-concept-v1.png` |
| `ch1-boss-wave-enemy-cutouts` | `assets/chapter1/enemies/ch1-enemy-*-cutout-v*.png` | quantum, blockchain, and AI Agent rare/elite/mob runtime images from `docs/asset-guides/boss-wave-*-concept-*.png` |

## Layered Redraw Test Assets

The redraw is retained as an earlier scale proof. It should not be treated as the active production form: the native generation is below runtime resolution, and crop-based foreground overlays are not acceptable final prop assets.

| asset id | path | use |
| --- | --- | --- |
| `ch1-map-classroom-spawn-layered-redraw-preview-native-1254-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-native-1254-v1.png` | native imagegen output for the first spawn-screen redraw test |
| `ch1-map-classroom-spawn-layered-redraw-preview-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-v1.png` | 2048 x 2048 preview version for map review and possible future slicing |
| `ch1-map-classroom-spawn-bg-redraw-v1-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-bg-redraw-v1-2048.png` | retained runtime background and minimap source for the old redraw test |
| `ch1-map-classroom-spawn-layered-redraw-preview-with-lina-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-with-lina-v1.png` | QA overlay with runtime-scale Lina at spawn, aisle, desk, and door positions |
| `ch1-m01-spawn-redraw-chunks-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-spawn-redraw-*-v1.png` | retained 1024 x 1024 runtime chunks cut from the redraw background |
| `ch1-m01-spawn-redraw-test-chunks-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-spawn-redraw-*-test-v1.png` | inactive retained test chunks kept for comparison |
| `ch1-m01-layered-map-manifest-v1` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v1.json` | production manifest for scale, active chunks, temporary overlay crops, and future prop cutouts |

## m01 v4 Board Runtime Package

The active `ch1_m01_classroom_spawn` runtime now uses the formal landscape v4 package. The clean runtime background is a repeated high-detail floor tile only. Walls, window walls, desks, blackboard, podium, shelves, plants, benches, screens, and book piles are independent props with baked contact shadows. `window_wall` and `plain_wall` are tracked as 8-direction asset families, and runtime collision uses foot/base rectangles.

| asset id | path | use |
| --- | --- | --- |
| `ch1-m01-imagegen-marked-layout-reference-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-marked-layout-reference-v4.png` | image-generated classroom layout reference with marker labels |
| `ch1-m01-imagegen-floor-tile-raw-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-floor-tile-raw-v4.png` | high-detail floor tile source repeated into the runtime base |
| `ch1-m01-imagegen-window-wall-8dir-raw-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-window-wall-8dir-raw-v4.png` | `window_wall` 8-direction family source sheet |
| `ch1-m01-imagegen-plain-wall-8dir-raw-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-plain-wall-8dir-raw-v4.png` | `plain_wall` 8-direction family source sheet |
| `ch1-m01-marker-base-master-6144-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-6144-v4.png` | 6144 x 4096 marker concept with prop anchors, route, and collision guides |
| `ch1-m01-marker-manifest-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v4.json` | marker ids, runtime coordinates, visual bounds, depth, and collision footprints |
| `ch1-m01-base-master-6144-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-6144-v4.png` | 6144 x 4096 source master for the tiled clean base |
| `ch1-m01-base-v4-source-blocks` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v4-r*-c*-2048.png` | 3 x 2 source blocks cut from the 6144 master |
| `ch1-map-classroom-spawn-base-v4-3072x2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v4-3072x2048.png` | active clean runtime base |
| `ch1-m01-base-v4-runtime-chunks` | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v4-r*-c*.png` | active 3 x 2 runtime chunks, 1024 x 1024 each |
| `ch1-m01-props-atlas-v4-4096x4096` | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4-4096x4096.png` | active transparent runtime prop atlas with contact shadows |
| `ch1-map-classroom-spawn-assembled-v4-3072x2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png` | active minimap and review composite |
| `ch1-map-classroom-spawn-assembled-qa-v4-3072x2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v4-3072x2048.png` | 147 px Lina checks, collision boxes, and chunk guides |
| `ch1-m01-layered-map-manifest-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v4.json` | active v4 placement manifest and QA checklist |

## m01 v3 Formal Runtime Package

The formal v3 package is retained as the previous runtime package. It kept the accepted v2 scale80 composition and category calibration, but v4 supersedes it with a board-first redraw.

| asset id | path | use |
| --- | --- | --- |
| `ch1-m01-marker-base-master-4096-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-4096-v3.png` | 4096 marker concept with route, marker ids, collision guides, and transfer points |
| `ch1-m01-marker-manifest-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v3.json` | marker ids, runtime coordinates, target sizes, depth, and collision footprints |
| `ch1-m01-base-master-4096-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v3.png` | 2x source master for the retained v3 clean base package |
| `ch1-m01-base-v3-quadrants` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v3-*-2048.png` | UL/UR/LR/LL source quadrants retained for seam review |
| `ch1-map-classroom-spawn-base-v3-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v3-2048.png` | retained v3 clean runtime base |
| `ch1-m01-base-v3-runtime-chunks` | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v3-*.png` | retained v3 1024 x 1024 runtime chunks |
| `ch1-m01-props-atlas-master-4096-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v3.png` | 2x prop atlas source with final sizes baked before downsample |
| `ch1-m01-props-atlas-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v3.png` | retained v3 transparent runtime prop atlas |
| `ch1-m01-foreground-atlas-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v3.png` | reserved foreground/occlusion atlas, currently mirroring the prop atlas |
| `ch1-map-classroom-spawn-assembled-v3-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v3-2048.png` | retained v3 minimap and review composite |
| `ch1-map-classroom-spawn-assembled-qa-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v3.png` | 147 px Lina checks, collision boxes, route dots, and seam guides |
| `ch1-m01-layered-map-manifest-v3` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v3.json` | final v3 placement manifest and QA checklist |

## m01 v2 Candidate And Planned Assets

The v2 runtime package is retained as the scale and composition candidate that fed the v3 pass: it validates clean-base plus prop-atlas placement, fixes the dirty desk-frame crop, and uses a scale80 visual pass so the background features and props read smaller against the 147 px character. Current m01 runtime tuning then makes desk props another `15%` smaller and podium lamps `10%` larger, showing why each prop category needs its own scale reference. The imagegen native output was `1254 x 1254`, so v2 remains below the final `4096 x 4096` source-master target. Do not reactivate v2 unless v3 has to be rolled back.

| asset id | path | use |
| --- | --- | --- |
| `ch1-m01-base-master-4096-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v2.png` | planned 2x clean base source; floor, wall, boundary, empty prop footprints |
| `ch1-m01-base-native-1254-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-native-1254-v2.png` | current candidate native clean-base source; not final-resolution production art |
| `ch1-map-classroom-spawn-base-v2-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v2-2048.png` | current runtime clean base for m01 layered candidate |
| `ch1-map-classroom-spawn-assembled-v2-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v2-2048.png` | current assembled minimap/preview, regenerated after desk-frame cleanup |
| `ch1-map-classroom-spawn-base-v2-scale80-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v2-scale80-2048.png` | active scale80 runtime clean base for m01 |
| `ch1-map-classroom-spawn-assembled-v2-scale80-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v2-scale80-2048.png` | active scale80 assembled minimap/preview |
| `ch1-m01-props-atlas-master-4096-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v2.png` | planned 2x isolated prop atlas source |
| `ch1-m01-props-atlas-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png` | current runtime prop atlas for coordinate placement; large desk frames cleaned so they do not include neighboring props |
| `ch1-m01-foreground-atlas-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v2.png` | current independent foreground/cutout atlas mirror for future occlusion |
| `ch1-map-classroom-spawn-assembled-qa-v2-scale80` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v2-scale80.png` | active QA overlay with 147 px Lina scale checks |
| `ch1-m01-layered-map-manifest-v2` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v2.json` | current candidate manifest for anchors, foot/base collisions, prop frame coordinates, and depth thresholds |

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
- Runtime maps are currently 2048 x 2048. M1 now uses the formal v4 board package with a 4096 source master, 2048 runtime base, 1024 chunks, scale-1 prop atlas placement, and QA overlay. If a later fully native 4096 redraw is commissioned, keep the v4 marker/prop manifest contract and replace the source/base/atlas images behind it.
- Collision with monsters is physical only. Damage is applied only from monster attacks or future explicit skill/passive hitboxes.
- Boss-wave enemies no longer use the leaf slime fallback. All three professor waves now use generated quantum, blockchain, and AI Agent cutouts with real HP bars and drops.
