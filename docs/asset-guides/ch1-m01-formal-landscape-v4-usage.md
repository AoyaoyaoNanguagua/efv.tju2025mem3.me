# ch1-m01 Formal Landscape v4 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-landscape-v4
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: 2026-07-09
- `runtime_size`: 3072 x 2048
- `source_size`: 6144 x 4096
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v4.json`
- `marker_manifest`: `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v4.json`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v4-3072x2048.png` |
| assembled minimap / review | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png` |
| QA overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v4-3072x2048.png` |
| dense wall / garden back overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-v5-3072x2048.png` |
| bottom wall foreground overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-front-v5-3072x2048.png` |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4-4096x4096.png` |
| source clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-6144-v4.png` |
| marker base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-6144-v4.png` |
| marked image layout reference | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-marked-layout-reference-v4.png` |
| raw floor tile | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-floor-tile-raw-v4.png` |
| raw dense wall overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-wall-overlay-dense-raw-v5.png` |
| raw window-wall 8dir sheet | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-window-wall-8dir-raw-v4.png` |
| raw plain-wall 8dir sheet | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-plain-wall-8dir-raw-v4.png` |

## Production Rules Applied

- Landscape map, 3072 x 2048 runtime, about 50% wider than the previous 2048 square map.
- Background base is a crisp image-generated floor tile repeated as a 3 x 2 map.
- Walls and the dense exterior garden are split into transparent overlays: top/side/back layer below the character, bottom wall foreground layer above the character.
- `window_wall` and `plain_wall` are retained as 8-direction source families, but they are not active hand-placed m01 props in this pass.
- Outer buffer is filled by the dense wall overlay: grass ground, grouped trees, flower beds, and an irregular stone transfer path.
- Prop atlas frames include baked soft contact shadows; the shadows are visual only.
- Runtime collision uses prop foot/base rectangles, not full texture rectangles.
- Active prop runtime scale is `1`; sizes are baked into atlas frames.

## Prop Placement

| marker | prop id | frame | x | y | runtime size |
| --- | --- | --- | ---: | ---: | --- |
| `B01` | `m01_blackboard_a_v4` | `m01_blackboard_a_v4` | 1536 | 370 | 490 x 300 |
| `P01` | `m01_protocol_podium_v4` | `m01_protocol_podium_v4` | 1536 | 700 | 211 x 240 |
| `L01` | `m01_lamp_a_v4` | `m01_lamp_a_v4` | 1350 | 765 | 91 x 210 |
| `L02` | `m01_lamp_b_v4` | `m01_lamp_b_v4` | 1725 | 765 | 92 x 210 |
| `G02` | `m01_crystal_pedestal_v4` | `m01_crystal_pedestal_v4` | 1260 | 520 | 110 x 174 |
| `G03` | `m01_statue_pedestal_v4` | `m01_statue_pedestal_v4` | 1810 | 520 | 108 x 190 |
| `D01` | `m01_desk_a_v4` | `m01_desk_a_v4` | 830 | 775 | 270 x 205 |
| `D02` | `m01_desk_b_v4` | `m01_desk_b_v4` | 1092 | 775 | 270 x 203 |
| `D03` | `m01_desk_c_v4` | `m01_desk_c_v4` | 830 | 1050 | 263 x 205 |
| `D04` | `m01_desk_d_v4` | `m01_desk_d_v4` | 1092 | 1050 | 263 x 205 |
| `D05` | `m01_desk_a_2_v4` | `m01_desk_a_v4` | 830 | 1330 | 270 x 205 |
| `D06` | `m01_desk_b_2_v4` | `m01_desk_b_v4` | 1092 | 1330 | 270 x 203 |
| `D07` | `m01_desk_c_2_v4` | `m01_desk_c_v4` | 1972 | 775 | 263 x 205 |
| `D08` | `m01_desk_d_2_v4` | `m01_desk_d_v4` | 2242 | 775 | 263 x 205 |
| `D09` | `m01_desk_a_3_v4` | `m01_desk_a_v4` | 1972 | 1050 | 270 x 205 |
| `D10` | `m01_desk_b_3_v4` | `m01_desk_b_v4` | 2242 | 1050 | 270 x 203 |
| `D11` | `m01_desk_c_3_v4` | `m01_desk_c_v4` | 1972 | 1330 | 263 x 205 |
| `D12` | `m01_desk_d_3_v4` | `m01_desk_d_v4` | 2242 | 1330 | 263 x 205 |
| `S01` | `m01_bookshelf_a_v4` | `m01_bookshelf_a_v4` | 640 | 555 | 208 x 230 |
| `S02` | `m01_bookshelf_b_v4` | `m01_bookshelf_b_v4` | 2435 | 555 | 209 x 230 |
| `N01` | `m01_notice_board_v4` | `m01_notice_board_v4` | 2480 | 1445 | 180 x 155 |
| `G01` | `m01_globe_v4` | `m01_globe_v4` | 565 | 1490 | 101 x 150 |
| `N02` | `m01_banner_a_v4` | `m01_banner_a_v4` | 1230 | 395 | 82 x 182 |
| `N03` | `m01_banner_b_v4` | `m01_banner_b_v4` | 1840 | 395 | 82 x 182 |
| `I01` | `m01_bookpile_a_v4` | `m01_bookpile_a_v4` | 1454 | 1310 | 119 x 115 |
| `I02` | `m01_bookpile_b_v4` | `m01_bookpile_b_v4` | 1626 | 1310 | 97 x 115 |
| `R01` | `m01_screen_a_v4` | `m01_screen_a_v4` | 600 | 1165 | 210 x 180 |
| `R02` | `m01_screen_b_v4` | `m01_screen_b_v4` | 2470 | 1165 | 165 x 180 |
| `C01` | `m01_bench_a_v4` | `m01_bench_a_v4` | 1025 | 1500 | 208 x 130 |
| `C02` | `m01_bench_b_v4` | `m01_bench_b_v4` | 2015 | 1500 | 207 x 130 |
