# ch1-m01 / M1 Formal Map Production Workflow

## Purpose

This document is the formal production SOP for the next `ch1_m01_classroom_spawn` / M1 map pass. The current v2 scale80 package is a useful proof, but it is still a temporary validation pass: it mechanically scales a lower-resolution candidate and uses atlas material derived from earlier composite art.

The next M1 production pass should be generated as a playable map asset package from the beginning:

- The background is a clean game board, not a complete poster image.
- Props are independent sprites with anchors, depth rules, and foot/base collision.
- The source art is generated larger than runtime and then downsampled for sharp 100% gameplay view.
- Each prop category has its own character reference, target runtime size, and runtime scale policy.

## Runtime Target

| item | target |
| --- | --- |
| map id | `ch1_m01_classroom_spawn` |
| runtime map size | `2048 x 2048` |
| source master size | `4096 x 4096` |
| source scale | `2x` |
| runtime Lina height | `147 px` |
| strict 2x Lina reference | `294 px` |
| calibrated M1 Lina reference | `368 px` |
| visual scale goal | environment and most props read at about `80%` of the previous oversized candidate |
| runtime review viewport | `1920 x 1024`, actual 100% gameplay scale |

Use the `368 px` temporary Lina reference only to force the generated map and props smaller relative to the real runtime character. Do not draw Lina into the final clean base or prop atlas.

## Output Package

| output | path pattern | purpose |
| --- | --- | --- |
| marker concept master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-4096-v3.png` | orthographic base with prop markers and route labels |
| marker manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v3.json` | marker ids, types, coordinates, target footprints, notes |
| upper-left source block | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v3-ul-2048.png` | first generated source quadrant |
| upper-right source block | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v3-ur-2048.png` | generated from right overlap of upper-left |
| lower-right source block | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v3-lr-2048.png` | generated from bottom overlap of upper-right |
| lower-left source block | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v3-ll-2048.png` | generated from upper-left bottom, upper-right lower-left corner, and lower-right left overlap references |
| clean base source master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v3.png` | final stitched source base, no markers |
| clean runtime base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v3-2048.png` | runtime background, downsampled from source master |
| runtime base chunks | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v3-*.png` | four `1024 x 1024` runtime chunks |
| prop atlas source | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v3.png` | high-resolution isolated props |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v3.png` | downsampled transparent prop atlas |
| runtime foreground atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v3.png` | occluding tops/front lips if separated from prop bodies |
| assembled preview | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v3-2048.png` | base plus props, for minimap and review |
| QA overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v3.png` | includes 147 px Lina checks, collision guides, and seam guides |
| placement manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v3.json` | final anchors, frames, scale policies, collisions, depth rules |

## Non-Negotiable Art Rules

1. Use orthographic game-map composition. Keep walls, aisles, desks, railings, tiles, and marker grids horizontal/vertical and projection-consistent.
2. Do not use far-small/near-large perspective. This is a game board, not a poster.
3. The clean background contains only floor, outer walls or rail boundaries, open transfer gaps, base shadows, lighting, and temporary markers.
4. Do not bake desks, stairs, podiums, railings, fountains, lamps, bookshelves, planters, signs, doors, or loose interactable objects into the final background.
5. Treat transfers as open gaps plus runtime portal logic. Avoid complex door art unless it is only a decorative prop.
6. Interior collision comes from prop foot/base footprints, not from the full texture rectangle.
7. Runtime prop scale should be `1.0` by default. Upscaling is not allowed. If a prop is too small, regenerate it larger and downsample again.
8. Atlas crops must be clean. A table frame must not include pieces of neighboring tables, floor patches, or marker leftovers.

## Marker System

Generate a marker version first, then derive both prop generation and placement from it.

| prefix | type | examples |
| --- | --- | --- |
| `D` | desk/table | student desk, protocol table, long desk |
| `P` | podium/platform | teaching platform, lecture stand, raised base |
| `L` | lamp/light | crystal lamp, pedestal lamp |
| `B` | bookshelf/wall shelf | bookcase, cabinet, archive shelf |
| `F` | flower/planter | flower bed, planter strip, potted plant |
| `R` | rail/boundary prop | low rail, fence, queue barrier |
| `S` | step/stair | small stairs, threshold step, raised edge |
| `G` | globe/decor | globe, instrument, large ornament |
| `N` | notice/sign | notice board, blackboard prop, instruction board |
| `E` | exit/portal | open transfer gap, portal marker |
| `I` | interaction node | task board, card pickup, talk trigger |
| `C` | combat space | encounter center, enemy spawn band |

Each marker entry must include:

| field | meaning |
| --- | --- |
| `markerId` | stable id such as `D01`, `L02`, `E01` |
| `type` | marker prefix category |
| `x`, `y` | runtime anchor after downsample, not source coordinate |
| `anchor` | normally `bottom-center`; exceptions must be explicit |
| `targetRuntimeSize` | expected visible prop width and height |
| `collisionFootprint` | foot/base collision only |
| `depthY` | y threshold for draw order against the character |
| `notes` | route, interaction, or occlusion remarks |

## Four-Block Source Expansion

Only expand the clean base board. Do not include props during this step.

The source master is `4096 x 4096`, assembled from four `2048 x 2048` source quadrants. The default source overlap is `256-384 px`; use `512 px` for complex wall or floor motifs. If the image tool accepts only a smaller reference strip, keep the strip at least `200 px`.

1. Generate `UL` first as the top-left source quadrant.
2. Crop the right reference strip from `UL`; generate `UR` with this strip locked as the left overlap.
3. Crop the bottom reference strip from `UR`; generate `LR` with this strip locked as the top overlap.
4. Generate `LL` using three references: bottom strip from `UL`, lower-left corner patch from `UR`, and left strip from `LR`.
5. Stitch by keeping one copy of each locked overlap. Feather only uniform floor texture. Do not feather walls, rails, tile grid lines, markers, or transfer openings.
6. Remove markers only after the stitched marker base passes alignment QA.

The key idea is that expansion follows the base-board geometry. Props are generated separately from the accepted marker layout, so a bad prop does not force the whole background to be regenerated.

## Asset-Specific Scale Table

Every asset batch must carry this table before generation. Do not reuse one table scale for desks, lamps, planters, and walls. The required fields for every asset type are `人物参照`, `目标运行尺寸`, and `是否允许运行时缩放`.

| asset type | marker prefix | 人物参照 / character reference | 目标运行尺寸 / target runtime size | 是否允许运行时缩放 / allow runtime scaling | collision target |
| --- | --- | --- | --- | --- | --- |
| classroom desk/table | `D` | runtime Lina `147 px`; M1 source reference `368 px` | `250-280 w x 195-215 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | `230-250 w x 55-65 h`, bottom foot strip |
| podium/platform | `P` | runtime Lina `147 px`; M1 source reference `368 px` | `220-250 w x 230-260 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | `190-230 w x 60-80 h`, base only |
| lamp/pedestal light | `L` | runtime Lina `147 px`; M1 source reference `368 px` | `88-105 w x 185-215 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | `55-70 w x 40-50 h`, pedestal foot |
| bookshelf/cabinet | `B` | runtime Lina `147 px`; M1 source reference `368 px` | `160-220 w x 190-260 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | `150-200 w x 50-70 h`, wall-side base |
| planter/flower strip | `F` | runtime Lina `147 px`; M1 source reference `368 px` | `320-360 w x 135-165 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | `300-350 w x 45-65 h`, soil/curb base |
| rail/boundary prop | `R` | runtime Lina `147 px`; M1 source reference `368 px` | match lane module; usually `160-420 w x 90-140 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | narrow base strip only |
| step/stair | `S` | runtime Lina `147 px`; M1 source reference `368 px` | match platform width; usually `220-420 w x 80-140 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | front edge or blocked step footprint |
| globe/decor | `G` | runtime Lina `147 px`; M1 source reference `368 px` | `110-130 w x 140-165 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | optional small base |
| notice/sign/board | `N` | runtime Lina `147 px`; M1 source reference `368 px` | `160-190 w x 130-160 h` | `scale=1.0` preferred; downscale allowed; upscale not allowed | base stand if walk-blocking |
| exit/portal opening | `E` | runtime Lina `147 px`; M1 source reference `368 px` | opening should fit at least `2` character widths | not a prop unless decorative trim is generated | transfer trigger, not prop collision |

Current M1 calibration:

- Background and most props should be generated to the 80% target, not scaled down late at runtime.
- Desk/table assets should start smaller than the global 80% rule by about another `15%`.
- Lamp assets should start larger than the global 80% rule by about `10%`.
- If QA changes one category, update only that category table and regenerate that category. Do not apply the same correction globally.

## Prop Atlas Requirements

Generate props from the accepted marker concept and clean base style, but isolate them as sprites.

- Use transparent or removable background.
- Keep one prop per frame with clear padding.
- Do not include neighboring props in a frame.
- Do not include baked floor shadows that look like copied square patches. Use local contact shadows only.
- Preserve the same orthographic projection as the base.
- Generate at source scale, then downsample into the runtime atlas.
- Prefer `scale=1.0` placement in runtime data. If a prop must be smaller, runtime downscale is acceptable. If it must be larger, regenerate.

## Placement Manifest Shape

Recommended prop entry:

```json
{
  "markerId": "D01",
  "textureKey": "ch1-m01-props-atlas-v3",
  "frame": { "x": 0, "y": 0, "w": 280, "h": 210 },
  "x": 512,
  "y": 760,
  "origin": { "x": 0.5, "y": 1 },
  "scale": 1,
  "maxScale": 1,
  "depthY": 760,
  "visualBounds": { "w": 280, "h": 210 },
  "collisionFootprint": { "x": 390, "y": 725, "w": 240, "h": 60 },
  "runtimeScalePolicy": "no-upscale",
  "qaStatus": "needs-browser-check"
}
```

Keep `collisionFootprint` in runtime world coordinates, not in atlas frame coordinates. The collision rectangle should describe where the player stands against the prop base.

## Prompt Templates

### Marker Base Prompt

```text
Create an orthographic 2.5D top-down game map board for an academy classroom spawn area.
Canvas source size: 4096 x 4096. Final runtime will downsample to 2048 x 2048.
Use a temporary 368 px tall player-character silhouette only as a scale reference; do not include the character in the final clean map.

Draw only floor tiles, outer walls or rail boundaries, open transfer gaps, base lighting, and colored/numbered placement markers.
No perspective depth where far objects become smaller. Keep the layout horizontal, vertical, grid-consistent, and playable.
Do not draw desks, podiums, lamps, bookshelves, planters, stairs, railings, fountains, signs, doors, or loose props as final objects. Use markers such as D01, L01, P01, E01.
```

### Base Expansion Prompt

```text
Extend this clean orthographic game-map base block using the provided locked overlap strip.
The overlap pixels must match exactly. Continue only floor tiles, outer boundaries, open gaps, lighting, and marker layout.
Do not add final props. Keep all lines grid-consistent and avoid camera perspective.
```

### Clean Base Prompt

```text
Remove all temporary marker labels and colored marker shapes from the accepted orthographic base.
Keep the floor, outer boundaries, open transfer gaps, base light, and soft ground shadows.
Do not add props while cleaning the markers.
```

### Prop Atlas Prompt

```text
Create isolated transparent-background prop sprites for the accepted M1 academy classroom map.
Use the same orthographic projection, palette, and lighting as the clean base.
Use a temporary 368 px tall player reference for scale, but do not draw the character in the final atlas.
Follow the asset-specific table exactly: desks, lamps, podiums, bookshelves, planters, rails, steps, signs, and decor each have separate target runtime sizes.
Each prop must be isolated with padding and must not include neighboring objects or floor patches.
Runtime placement should use scale 1.0; do not rely on upscaling.
```

## QA Checklist

Before promoting M1:

- The browser is checked at actual `1920 x 1024` gameplay view, not only at 70% image preview.
- A 147 px Lina overlay is checked at spawn, beside desks, beside lamps, at exits, and behind occluders.
- No runtime prop has `scale > 1.0`.
- Desk/table frames contain only the table asset, with no neighboring objects.
- Lamp frames are not forced through the same scale correction as tables.
- Base background contains no baked interior props.
- Four quadrant seams are invisible at 100% view.
- Collisions use foot/base footprints and do not block the whole prop texture.
- Depth sorting lets Lina pass visually behind tall/foreground parts and in front of low bases.
- Minimap still reads after downsampling.
- Runtime checks pass:
  - `node --check play.js`
  - JSON parse for `assets/chapter1/chapter1-maps-v1.json`
  - JSON parse for the M1 manifest
  - HTTP `200` for the active base image, prop atlas, and map registry

## Promotion Rule

Do not replace the active M1 runtime package just because a generated image looks good as a standalone picture. Promote only after the full package exists: clean base, chunks, prop atlas, foreground atlas if needed, placement manifest, QA overlay, and browser-scale verification.
