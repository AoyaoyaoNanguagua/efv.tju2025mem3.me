# ch1-m01 Formal v4 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-v4
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: 2026-07-09
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v4.json`
- `marker_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v4.json`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v4-2048.png` |
| marker base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-v4-2048.png` |
| assembled minimap / review | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-2048.png` |
| QA overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v4.png` |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4.png` |
| source clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v4.png` |
| source prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v4.png` |
| overlap quadrants | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v4-*-overlap-2304.png` |

## Prop Placement

The clean base contains no furniture. Every prop below is drawn from the atlas at `scale: 1`; collision uses `collisionFootprint`.

| marker | prop id | x | y | runtime size | scale policy |
| --- | --- | ---: | ---: | --- | --- |
| `P01` | `m01_syllabus_terminal_v4` | 1024 | 455 | 560 x 260 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `S01` | `m01_north_steps_v4` | 1024 | 640 | 720 x 126 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `P02` | `m01_protocol_podium_v4` | 1024 | 820 | 320 x 230 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D01` | `m01_west_desk_front_v4` | 610 | 940 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D02` | `m01_west_desk_mid_v4` | 610 | 1170 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D03` | `m01_west_desk_rear_v4` | 610 | 1400 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D04` | `m01_east_desk_front_v4` | 1438 | 940 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D05` | `m01_east_desk_mid_v4` | 1438 | 1170 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `D06` | `m01_east_desk_rear_v4` | 1438 | 1400 | 340 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `B01` | `m01_west_bookshelf_v4` | 370 | 570 | 220 x 260 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `B02` | `m01_east_bookshelf_v4` | 1650 | 570 | 220 x 260 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `L01` | `m01_west_lamp_v4` | 835 | 735 | 100 x 220 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `L02` | `m01_east_lamp_v4` | 1213 | 735 | 100 x 220 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `F01` | `m01_south_left_planter_v4` | 520 | 1688 | 380 x 150 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `F02` | `m01_south_right_planter_v4` | 1528 | 1688 | 380 x 150 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `E01` | `m01_east_exit_frame_v4` | 1810 | 850 | 220 x 360 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `N01` | `m01_bug_note_pile_v4` | 1530 | 1475 | 240 x 160 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `N02` | `m01_wall_banner_left_v4` | 790 | 410 | 110 x 210 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `N03` | `m01_wall_banner_right_v4` | 1258 | 410 | 110 x 210 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `R01` | `m01_west_low_rail_v4` | 335 | 1545 | 300 x 110 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |
| `R02` | `m01_east_low_rail_v4` | 1713 | 1545 | 300 x 110 | `no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1` |

## Image Generation Prompt Contract

```text
Use case: stylized-concept
Asset type: orthographic runtime game map and prop atlas
Primary request: generate an orthographic marker-first classroom board map for EFV chapter 1 m01.
Scene/backdrop: clean board only, floor tiles, outer walls or fences, two openings, basic light and shadow, colored numbered anchors.
Subject: no furniture in the base image; desks, stage steps, podium, shelves, railings, flower boxes, door frame, lamps, and note pile are separate props.
Style/medium: crisp top-down 2D game art, no perspective, horizontal and vertical alignment.
Composition/framing: square 2048 runtime / 4096 source, preserve 200-300 px overlap for four-grid expansion.
Scale reference: 147 px runtime Lina character, props generated larger than runtime then downsampled; runtime scale must be <= 1.
Constraints: final clean base removes marker labels; prop atlas has transparent background; collision uses only foot/base rectangles.
Avoid: baked furniture in background, perspective room painting, duplicate prop silhouettes, shadows that imply fixed collision, text-dependent readability.
```

## QA Notes

- `ch1-map-classroom-spawn-assembled-qa-v4.png` overlays 147 px Lina at spawn, desk lane, podium, combat space, and exit.
- Red rectangles are foot/base collisions; visual bounds are intentionally larger.
- Source quadrants keep 256 px overlap in the order UL -> UR -> LR -> LL.
