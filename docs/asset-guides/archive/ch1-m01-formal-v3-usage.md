# ch1-m01 Formal v3 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-v3
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: 2026-07-09
- `runtime_size`: 2048 x 2048
- `source_size`: 4096 x 4096
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v3.json`
- `marker_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v3.json`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v3-2048.png` |
| assembled minimap / review | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v3-2048.png` |
| QA overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v3.png` |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v3.png` |
| runtime foreground atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v3.png` |
| source clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v3.png` |
| source prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v3.png` |
| marker base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-4096-v3.png` |

## Prop Placement

Every v3 prop has its visual scale baked into the atlas frame. Runtime placement uses `scale: 1` and collision uses the foot/base rectangle only.

| marker | prop id | frame | x | y | runtime size | scale policy |
| --- | --- | --- | ---: | ---: | --- | --- |
| `P01` | `m01_protocol_podium_v3` | `m01_protocol_podium_v3` | 1024 | 709 | 228 x 241 | `no-upscale-scale-baked-into-v3-atlas` |
| `D01` | `m01_west_desk_top_v3` | `m01_west_desk_top_v3` | 605 | 837 | 253 x 200 | `no-upscale-scale-baked-into-v3-atlas` |
| `D02` | `m01_west_desk_lower_v3` | `m01_west_desk_lower_v3` | 605 | 1137 | 270 x 199 | `no-upscale-scale-baked-into-v3-atlas` |
| `D03` | `m01_east_desk_top_v3` | `m01_east_desk_top_v3` | 1443 | 837 | 264 x 199 | `no-upscale-scale-baked-into-v3-atlas` |
| `D04` | `m01_east_desk_lower_v3` | `m01_east_desk_lower_v3` | 1443 | 1137 | 253 x 200 | `no-upscale-scale-baked-into-v3-atlas` |
| `B01` | `m01_west_bookshelf_v3` | `m01_west_bookshelf_v3` | 417 | 621 | 168 x 202 | `no-upscale-scale-baked-into-v3-atlas` |
| `B02` | `m01_east_bookshelf_v3` | `m01_east_bookshelf_v3` | 1629 | 633 | 185 x 196 | `no-upscale-scale-baked-into-v3-atlas` |
| `L01` | `m01_west_podium_lamp_v3` | `m01_west_podium_lamp_v3` | 861 | 781 | 90 x 191 | `no-upscale-scale-baked-into-v3-atlas` |
| `L02` | `m01_east_podium_lamp_v3` | `m01_east_podium_lamp_v3` | 1187 | 781 | 90 x 191 | `no-upscale-scale-baked-into-v3-atlas` |
| `F01` | `m01_south_left_planter_v3` | `m01_south_left_planter_v3` | 541 | 1629 | 339 x 154 | `no-upscale-scale-baked-into-v3-atlas` |
| `F02` | `m01_south_right_planter_v3` | `m01_south_right_planter_v3` | 1507 | 1629 | 339 x 154 | `no-upscale-scale-baked-into-v3-atlas` |
| `N01` | `m01_notice_board_v3` | `m01_notice_board_v3` | 1635 | 1473 | 164 x 135 | `no-upscale-scale-baked-into-v3-atlas` |
| `G01` | `m01_west_globe_v3` | `m01_west_globe_v3` | 345 | 1093 | 115 x 146 | `no-upscale-scale-baked-into-v3-atlas` |
| `N02` | `m01_wall_banner_left_v3` | `m01_wall_banner_left_v3` | 793 | 513 | 74 x 187 | `no-upscale-scale-baked-into-v3-atlas` |
| `N03` | `m01_wall_banner_right_v3` | `m01_wall_banner_right_v3` | 1253 | 513 | 74 x 187 | `no-upscale-scale-baked-into-v3-atlas` |

## QA Notes

- The base is a clean runtime layer and props are placed from `ch1-m01-props-atlas-v3.png`.
- The 1024 x 1024 chunks are cut from `ch1-map-classroom-spawn-base-v3-2048.png`.
- `ch1-map-classroom-spawn-assembled-qa-v3.png` includes 147 px Lina references, seam guides, route dots, and collision rectangles.
- The v3 package keeps the active v2 composition and scale calibration but promotes it into a scale-1 atlas/manifest package.
