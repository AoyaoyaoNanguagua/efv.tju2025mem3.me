# Chapter 1 Small Map Runtime Usage

## Runtime Shape

Chapter 1 now uses `assets/chapter1/chapter1-maps-v1.json` as the active map registry. Each map owns its background, spawn points, obstacles, interaction nodes, exits, encounters, and enemy spawns.

The runtime maps are 2048 x 2048. Each generated 2048 concept image is treated as a layout/minimap source; the actual walkable scene is stitched from 1024 x 1024 chunks so the 147px player sprite keeps a believable scale against desks, gates, bookshelves, trees, and lab machinery. Foreground overlay rectangles in `chapter1-maps-v1.json` crop selected map objects back over the actor for door/tree/bookshelf occlusion.

## Map Order

| order | map id | runtime background | primary function |
| --- | --- | --- | --- |
| 1 | `ch1_m01_classroom_spawn` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-bg-v2-2048.png` + `chunks/ch1-m01-spawn-*-v1.png` | birth point, first protocol cards, first enemy cleanup |
| 2 | `ch1_m02_prompt_archive` | `assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-map-prompt-archive-bg-v2-2048.png` + `chunks/ch1-process-*-v1.png` | NPC guidance, citation/schema task, archive encounter |
| 3 | `ch1_m03_agent_lab` | `assets/chapter1/maps/ch1_m03_agent_lab/background/ch1-map-agent-lab-bg-v2-2048.png` + `chunks/ch1-process-*-v1.png` | console task, projection encounter, final route handoff |
| 4 | `ch1_m04_library_lawn_boss` | `assets/chapter1/maps/ch1_m04_library_lawn_boss/background/ch1-map-library-lawn-boss-bg-v2-2048.png` + `chunks/ch1-m04-boss-*-v1.png` | professor summoner boss, three summoned waves, boss chest |

## UI Skin

`assets/chapter1/ui/ch1-ui-hud-skin-sheet-v1.png` is referenced by `play.css` through `--ui-skin`. It is blended into the HUD, task panel, public chat, minimap, quickbar, boss panel, interaction prompt, and toast surfaces. Bottom quickbar commands additionally use `assets/chapter1/ui/ch1-quickbar-icons-sheet-v1.png`, while the role-entry loading screen uses `assets/opc/third-academy-hero-v1.png`.

The UI should remain collapsible where space matters. The default layout keeps player HP, energy, shield and currencies at the upper left; minimap at the upper right; system prompt at the top; quickbar at the bottom center; and touch controls at lower left/lower right on touch devices.

## Combat Rules

Monster collision is not damage. The `actor` and enemy group use a plain Arcade collider for physical separation only. Player HP changes only through `damagePlayer`, which is called by enemy attacks or future explicit skill hitboxes.

Every monster has real HP. Ordinary mobs, elites, rare elites, and boss summons use progressively stronger overhead HP bar styling. Boss-wave units use generated runtime cutouts from the `docs/asset-guides/` concept boards:

| enemy group | paths |
| --- | --- |
| quantum | `ch1-enemy-quantum-scholar-rare-cutout-v1.png`, `ch1-enemy-quantum-familiar-elite-cutout-v1.png`, `ch1-enemy-quantum-paper-mob-cutout-v1.png` |
| blockchain | `ch1-enemy-blockchain-chainbeast-rare-cutout-v2.png`, `ch1-enemy-blockchain-lock-elite-cutout-v1.png`, `ch1-enemy-blockchain-spider-mob-cutout-v1.png` |
| AI Agent | `ch1-enemy-aiagent-cybermage-rare-cutout-v1.png`, `ch1-enemy-aiagent-digital-cat-elite-cutout-v2.png`, `ch1-enemy-aiagent-botcat-mob-cutout-v1.png` |

Boss waves open through the borderless `ch1-boss-void-portal-sheet-v1` sequence before units emerge. The professor uses `assets/chapter1/boss/ai-professor-summoner-game-cutout-v1.png`, remains a non-direct-combat summoner, and clearing all summons reveals the boss chest.

## QA Notes

- Verify `Enter` opens/focuses public chat and submits when the input is active.
- Verify selecting a character shows the `third-academy-hero-v1.png` loading poster for at least 5 seconds while the login music continues.
- Verify map exits move the player between all four maps and update the minimap title/markers.
- Verify map exits show the portal read bar before the map rebuilds.
- Verify monster contact alone does not reduce HP.
- Verify monster attacks show damage numbers; healing and shield application show effects; shielded hits show block text.
- Verify energy defaults to 150, slowly regenerates, gains on hits, and spends 100 for ultimate or 50 for healing.
