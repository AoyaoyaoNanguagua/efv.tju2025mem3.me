# ch1-m01 Layered Redraw v2 Production Plan

## Goal

Replace the temporary composite redraw with a production map package that stays sharp at actual gameplay scale and supports real depth layering.

The v2 map must be assembled from:

- a high-resolution clean base master;
- a downsampled runtime base;
- a high-resolution prop atlas / prop sheet;
- runtime prop frames placed by coordinates;
- foreground pieces generated as independent assets, not cropped from the full painted map;
- a QA composite checked with the 147 px Lina runtime sprite.

The next accepted pass must be orthographic and marker-first: no far-small/near-large room perspective, no baked desks or stairs in the background, and no runtime upscaling of prop frames.

## Target Resolution

The current game is usually viewed around a `1920 x 1024` desktop viewport. A `2048 x 2048` runtime background can be shown close to 100%, so it should not be generated natively at 2048 and shipped directly.

Use this v2 contract:

| item | value |
| --- | --- |
| runtime map target | `2048 x 2048` |
| source master target | `4096 x 4096` |
| source scale | `2x` |
| runtime Lina height | `147 px` |
| source prompt/reference Lina height | `368 px` proportion-calibration reference |
| target visual element scale | `80%` of the previous m01 v2 candidate |
| runtime chunk size | `1024 x 1024` |
| source chunk equivalent | `2048 x 2048` |

Downsample the final base and atlas from source to runtime with high-quality Lanczos filtering before cutting runtime chunks.

## Asset Package

| output | target path |
| --- | --- |
| source clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v2.png` |
| runtime clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v2-2048.png` |
| source prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v2.png` |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png` |
| source foreground atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-foreground-atlas-master-4096-v2.png` |
| runtime foreground atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v2.png` |
| assembled QA preview | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v2.png` |
| runtime chunks | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v2-*.png` |
| manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v2.json` |

## Generation Order

1. Use the accepted v1 image only as a scale and mood reference, not as a perspective reference.
2. Generate a 4096 marker base:
   - orthographic floor grid and outer walls/rail boundaries only;
   - open transfer gap instead of a detailed door;
   - numbered or color-coded anchor marks for desks, podium, lamps, bookshelves, planters, banners, exit portal, encounter space, and interaction nodes.
3. Generate a 4096 clean base from the marker base:
   - keep floor, outer walls/rail boundaries, open transfer gap, broad ground tone, and subtle empty prop footprints;
   - remove all markers;
   - exclude all placeable or raised objects such as desks, podiums, lamps, banners, books, signboards, plants, loose decor, stairs, platforms, railings, doors, characters, labels, UI, VFX, and monsters.
4. Generate a 4096 prop atlas:
   - use isolated objects on transparent/removable background;
   - match the clean base orthographic projection, light direction, palette, and scale;
   - include desk clusters, protocol podium, stairs or raised trims if needed, board frame if separate, lamps, planters, banners, bookshelves, railings, and corridor marker props;
   - make every prop final-runtime scale after downsampling; runtime `scale` should stay `<= 1.0`.
5. Generate foreground pieces separately:
   - desk front lips;
   - podium front;
   - planter tops;
   - railing fronts;
   - portal/opening trim only if the player can walk behind it.
6. Downsample source assets to runtime.
7. Define prop frames and positions in the manifest from the marker anchors.
8. Inspect every prop frame at 100%; no frame may include neighboring chairs, trims, floor patches, or other atlas objects.
9. Assemble a QA preview and paste 147 px Lina at spawn, aisle, desk, podium, right corridor, and one occlusion test point.
10. Promote the map only after browser QA at actual gameplay scale.

## Expansion Order

If the native image generator cannot create a single crisp 4096 source master, build the clean base as a `2 x 2` orthographic expansion:

1. Generate the upper-left block.
2. Generate the upper-right block from the locked right-edge overlap strip of the upper-left block.
3. Generate the lower-right block from the locked bottom overlap strip of the upper-right block.
4. Generate the lower-left block last, using the upper-left bottom strip, the lower-right left strip, and a small center-junction reference patch so floor lines and wall trims meet.
5. Merge only after dropping duplicate overlap bands; keep all prop markers outside seam bands.

## Clean Base Prompt

```text
Use case: stylized-concept
Asset type: EFV Chapter 1 2D game map clean base source master
Primary request: create a 4096 x 4096 high-resolution clean base layer for ch1_m01_classroom_spawn, later downsampled to a 2048 x 2048 runtime map.

Scene/backdrop:
Warm fantasy-academy protocol classroom, orthographic top-down 2.5D JRPG map style. South open transfer gap at lower center, north protocol-board wall area, central aisle, left and right classroom zones, right-side corridor hint. The image is a base layer only.

Scale:
Runtime Lina is 147 px tall. This 4096 source master is 2x runtime scale, but the previous m01 candidate reads oversized, so use a 368 px temporary Lina reference for proportion calibration only. Do not draw Lina in the final image. This makes floor tiles, wall modules, stairs, desks, lamps, planters, and corridors roughly 80% of the previous candidate while the runtime character remains 147 px.

Layer target:
Clean base only. Include uniform stone floor texture, outer walls or rail boundaries, wall facade, open transfer gap, broad baked ground tone, and subtle empty prop footprints. Exclude desks, podiums, lamps, banners, books, signboards, planters, railings, stairs, raised platforms, doors, characters, monsters, UI, labels, text, floating markers, and VFX.

Visual style:
Polished hand-painted fantasy academy, warm stone floor, dark blue and gold trim, soft top-left lighting, readable walk lanes, coherent orthographic game-board composition, no perspective scaling, no visible seams, no hard square chunk boundaries.
```

## Prop Atlas Prompt

```text
Use case: stylized-concept
Asset type: EFV Chapter 1 2D game prop atlas source master
Primary request: create a 4096 x 4096 high-resolution isolated prop atlas for ch1_m01_classroom_spawn, later downsampled to a runtime prop atlas.

Reference:
Use the accepted m01 composition, marker base, and clean base style. Match orthographic projection, palette, and top-left lighting.

Scale:
Runtime Lina is 147 px tall. This source sheet is 2x runtime scale, but use a 368 px temporary Lina reference for proportion calibration so props land at roughly 80% of the previous candidate after downsampling. Do not draw Lina. Each prop should be final-sized or slightly larger in the atlas, then placed at runtime with `scale <= 1.0`.

Asset-specific scale:

Do not apply the same scale to every prop. Before generating the atlas, set target runtime footprints per category:

| prop category | target note |
| --- | --- |
| classroom desks | smaller than the broad 80% map pass; current runtime candidate applies an extra `15%` reduction |
| podium lamps | larger than the broad 80% map pass; current runtime candidate applies a `10%` increase |
| planters | keep around the broad 80% map pass unless QA shows they block too much lane width |
| bookshelves and signboards | judge by wall height and readability, not by desk size |

Each atlas item should be checked against a 147 px runtime Lina reference and a foot collision ellipse before frame coordinates are accepted.

Objects:
Protocol podium, large classroom desk clusters, chair groups, stairs or raised trim pieces if needed, wall bookshelf modules, blue-gold banners, academic lamps, planters, railing segments, signboards, book stacks, corridor trim, and optional fountain/body-front pieces if needed for later maps.

Layout:
Arrange objects as separate isolated items with clear margins on a transparent or clean removable background. Keep each object complete and avoid overlapping props. Include soft contact shadows only; no hard rectangular shadows. No full map, no floor rectangles attached to props, no neighboring props inside a frame, no characters, no UI, no text, no labels, no watermark.
```

## Runtime Manifest Shape

Use the existing `props` / frame mechanism in `play.js`. A v2 map entry should move prop-like objects out of `foregroundOverlays` and into explicit prop frames. Map-local `propAtlases` and `foregroundAtlases` can be declared in the map registry; the runtime preloads those image paths after reading `chapter1-maps-v1.json`.

```json
{
  "propAtlases": [
    {
      "id": "m01-v2",
      "key": "ch1-m01-props-atlas-v2",
      "path": "assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png",
      "frames": {
        "m01_protocol_podium_v2": { "x": 0, "y": 0, "w": 420, "h": 300 }
      }
    }
  ],
  "foregroundAtlases": [
    {
      "id": "m01-foreground-v2",
      "key": "ch1-m01-foreground-atlas-v2",
      "path": "assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-foreground-atlas-v2.png",
      "frames": {
        "m01_protocol_podium_front_v2": { "x": 0, "y": 0, "w": 430, "h": 140 }
      }
    }
  ],
  "props": [
    {
      "id": "m01_protocol_podium_v2",
      "frame": "m01_protocol_podium_v2",
      "atlas": "m01-v2",
      "x": 1024,
      "y": 640,
      "origin": { "x": 0.5, "y": 1 },
      "scale": 1,
      "depthOffset": 0,
      "collision": { "x": 865, "y": 560, "w": 320, "h": 70 }
    }
  ],
  "foregroundOverlays": [
    {
      "id": "m01_protocol_podium_front_v2",
      "textureKey": "ch1-m01-foreground-atlas-v2",
      "frameKey": "m01_protocol_podium_front_v2",
      "x": 810,
      "y": 520,
      "w": 430,
      "h": 140,
      "depth": 650
    }
  ]
}
```

## Acceptance Checks

- 100% browser check in a `1920 x 1024` viewport.
- No prop contains a visible floor/background rectangle.
- 147 px Lina reads small enough against furniture, doors, and route width.
- Main route and side lanes remain playable after prop placement.
- Foreground occlusion works at one desk/podium/planter test point.
- Runtime chunks, minimap image, and map registry all reference existing files.
- Prop runtime scale is never above `1.0`; larger-looking props must be regenerated larger and downsampled into the atlas.
- For m01, the current accepted proportion target is `80%` of the previous v2 candidate for both clean base features and prop assets.
- Asset categories may override the broad target after QA; current m01 desks are an extra `15%` smaller and podium lamps are `10%` larger.
- Collision boxes use the prop foot/base footprint, not the full texture bounds.
- Atlas crops are clean at 100%; no desk frame includes another chair, trim, or adjacent object.
- `node --check play.js` and JSON parsing pass after integration.
