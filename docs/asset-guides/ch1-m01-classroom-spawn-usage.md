# ch1-m01-classroom-spawn Usage

## Batch Info

- `batch_id`: chapter1-p0-map-data
- `map_id`: `ch1_m01_classroom_spawn`
- `data_file`: `assets/chapter1/ch1-m01-classroom-spawn.json`
- `chapter_manifest`: `assets/chapter1/chapter1-p0-runtime.json`
- `current_status`: usable P0 data, existing-art fallback
- `tile_size`: 64 x 64
- `world_size`: 3072 x 2048 px
- `ground_scheme`: compact tile plan using existing Zhonghe tileset

## Runtime Asset Inputs

| purpose | path |
| --- | --- |
| ground tileset | `assets/maps/tilesets/zhonghe-plaza-ground-tileset-v1.png` |
| tile index reference | `assets/maps/tilesets/zhonghe-plaza-tilemap-v3.json` |
| prop atlas | `assets/maps/props/zhonghe-plaza-props-atlas-v1.png` |
| macro prop atlas | `assets/maps/props/zhonghe-plaza-macro-props-v1.png` |
| enemy fallback | `assets/enemies/leaf-poring-sprites-v2.png` |
| boss fallback, route reference only | `assets/enemies/autumn-ruin-portrait-v1.png` |

## Map Restore Notes

The map is a classroom-shaped layout built from a compact `tilePlan` plus direct runtime fields:

| layer | purpose |
| --- | --- |
| `ground` | floor bands, entry steps, center teaching medallion |
| `terrain_edges` | boundary trims and wall shadow |
| `building` | north wall and board/window band |

The first integration pass can skip materializing tile layers and still use the compatible fields for spawn, props, obstacles, and enemy points. A later pass can expand `tilePlan.layers[].rects` into flat Tiled `data` arrays.

## Coordinates

| point | id | x | y | note |
| --- | --- | ---: | ---: | --- |
| player spawn | `ch1_m01_spawn_player_start` | 1536 | 1696 | south door, facing north |
| syllabus terminal | `ch1_m01_node_syllabus_terminal` | 1536 | 560 | starts the chapter task |
| protocol deck | `ch1_m01_node_protocol_deck` | 1536 | 816 | grants first two cards |
| optional board | `ch1_m01_node_attendance_board` | 544 | 660 | small credit reward |
| bug notes | `ch1_m01_node_bug_notes` | 2020 | 1390 | starts first enemy wave |
| exit to m02 | `ch1_m01_exit_corridor_to_m02` | 2752 | 832 | requires cards and cleared wave |

## Quest Flags

| flag | set by |
| --- | --- |
| `ch1_intro_entered_classroom` | player spawn |
| `ch1_intro_read_syllabus` | syllabus terminal |
| `ch1_task_fix_prompt_chain_active` | syllabus terminal |
| `ch1_intro_card_claimed` | protocol deck |
| `ch1_m01_bug_notes_disturbed` | bug-note trigger |
| `ch1_m01_bug_notes_cleared` | all m01 enemy spawns defeated |
| `ch1_m01_cleared` | exit to m02 used |
| `ch1_m02_unlocked` | exit to m02 used |

## Protocol Cards

| card id | pickup | effect |
| --- | --- | --- |
| `ch1_card_context_window` | syllabus terminal / protocol deck | reveals hidden interaction notes |
| `ch1_card_traceable_instruction` | protocol deck | marks quest nodes and prevents duplicate collection |
| `ch1_card_schema_lock` | later m02 placeholder | gates the m03 lab |

## Combat Points

| enemy id | runtime type | x | y | active after |
| --- | --- | ---: | ---: | --- |
| `ch1-m01-demand-bug-west` | `leafSlime` | 1072 | 1376 | `ch1_m01_bug_notes_disturbed` |
| `ch1-m01-demand-bug-center` | `leafSlime` | 1536 | 1220 | `ch1_m01_bug_notes_disturbed` |
| `ch1-m01-demand-bug-east` | `leafSlime` | 2000 | 1376 | `ch1_m01_bug_notes_disturbed` |

The wave clears when all three are defeated, then sets `ch1_m01_bug_notes_cleared`. Until bespoke Chapter 1 enemy art exists, all three points reuse the current leaf-poring slime sheet.

## Exit And Boss Route

The m01 exit sends the player to `ch1_m02_prompt_archive` at `ch1_m02_spawn_south_gate`. The full P0 route is:

`ch1_m01_classroom_spawn` -> `ch1_m02_prompt_archive` -> `ch1_m03_agent_lab` -> `ch1_m04_library_lawn_boss`

The final boss point is `ch1_m04_boss_ai_professor_exam`, using runtime boss id `boss_ai_prof` and fallback image `assets/enemies/autumn-ruin-portrait-v1.png`. Defeating it sets `ch1_final_boss_defeated` and `ch1_complete`.

## QA Checklist

- JSON parses with Node.
- All reused asset paths exist.
- All m01 enemy spawn coordinates are inside `runtime.world`.
- `exitPoints[0].targetMapId` exists in `chapter1-p0-runtime.json`.
- No changes are required in `play.js` for this data-only patch.
