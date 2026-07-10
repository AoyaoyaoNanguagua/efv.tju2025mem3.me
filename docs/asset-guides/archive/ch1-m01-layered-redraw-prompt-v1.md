# ch1-m01 Layered Redraw Prompt v1

## Intent

Generate a new composite preview for the first screen after the player spawns in `ch1_m01_classroom_spawn`. This is a test image for scale, composition, and future layering. It must not replace the current runtime background until it is split into base, props, foreground overlays, and a placement manifest.

Status after runtime review: v1 is useful as a scale proof, not as the final production route. The character-to-map proportion is much better, but the source resolution is too low for crisp 100% gameplay viewing and the attempted foreground crops expose visible map-patch artifacts. The next pass should follow the v2 workflow: high-resolution source master, downsampled clean base, prop atlas, and runtime placement.

## Input Image Roles

- Current spawn-map image: style reference and "what to improve" reference.
- Lina sprite sheet: scale reference only. Lina is `147 px` tall in the runtime and must not be drawn into the final map.
- User screenshots: problem references showing seam breaks, character-scale drift, and weak occlusion around fountains/desks.

## Prompt

```text
Use case: stylized-concept
Asset type: EFV Chapter 1 2D game map composite preview
Primary request: Completely redraw the first playable screen after the player spawns in ch1_m01_classroom_spawn as a square 2048 x 2048 fantasy-academy classroom map preview.

Scene/backdrop:
A warm fantasy-academy protocol classroom connected to a formal campus interior courtyard. The player starts at the south entrance and faces north. The view should immediately show a wide central aisle, a course protocol board at the north center, a protocol-card podium below it, large left/right desk zones, and a clear right-side corridor exit hint toward the next map.

Composition/framing:
Orthographic 2.5D top-down game map, readable from a 1920 x 900 horizontal viewport. Keep the first 5 seconds of play clear: south spawn entrance at lower center, central north-facing route, protocol board north center, protocol podium mid-center, left and right desk lanes, optional planters/railings near the lower edge for foreground occlusion tests. Do not use a dramatic camera perspective; keep it usable as a game map.

Scale:
Use the visible Lina sprite sheet only as scale reference. In-game Lina is 147 px tall. Furniture, doors, stairs, wall height, desks, and path widths must make her feel small enough for the academy space. The main aisle should fit 3-4 characters side by side. Side lanes should fit at least 2 characters. Desks should be large classroom furniture, not tiny toy props. Doors and archways must be clearly taller than Lina.

Layering intent:
This image is a composite preview for later splitting. Make the base floor/walls coherent, but clearly design objects that can later become separate layers: desk clusters, protocol podium, board frame, planters, lamps, railings, bookshelf tops, and door lintel. Include object silhouettes and contact shadows that imply future y-sorting and foreground overlays. Avoid baking important occluders so flatly that they cannot be separated later.

Visual style:
Match the existing EFV academy style: polished hand-painted fantasy JRPG map art, warm stone floors, dark blue and gold academy trim, soft top-left lighting, gentle shadows, clean readable walkable lanes, refined but not cluttered. Keep the map cohesive as one designed space, not four unrelated square images.

Constraints:
No UI, no labels, no Chinese text, no English text, no character, no monster, no NPC, no floating markers, no minimap, no watermark. Do not include the scale reference in the final image. Avoid visible seams, hard square chunk boundaries, mismatched floor grids, tiny furniture, over-dense clutter, and objects blocking the spawn lane.
```

## Expected Output Path

`assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-v1.png`

## QA Overlay Path

After generation, create a local QA overlay with the existing Lina sprite pasted near the spawn point:

`assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-with-lina-v1.png`

## Actual v1 Outputs

The built-in image generation output for v1 was `1254 x 1254`, so the project keeps both the native output and a `2048 x 2048` review version.

| output | path | note |
| --- | --- | --- |
| native generation | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-native-1254-v1.png` | original generated image |
| 2048 preview | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-v1.png` | resized review image; source for the active redraw copy |
| active background | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-bg-redraw-v1-2048.png` | current runtime background and minimap source for m01 |
| QA overlay | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-with-lina-v1.png` | runtime-scale 147 px Lina pasted at spawn, aisle, desk, and door test points |
| active chunks | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-spawn-redraw-*-v1.png` | current runtime 1024 x 1024 chunks |
| retained test chunks | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-spawn-redraw-*-test-v1.png` | inactive retained chunks kept for comparison |

Initial QA read:

- Character scale is improved: Lina no longer reads as a giant against the desks, board, or doorway.
- The central aisle is clear enough for first-screen movement and combat teaching.
- The south arch, planters, desk fronts, board frame, and right corridor are good candidates for later foreground overlays.
- This is now wired into the active m01 runtime as a composite redraw pass. It still needs a later clean-base/prop-cutout split before it becomes the final layered production map.
- Runtime QA note: the first south-arch crop overlay covered the spawn position too aggressively, so it was removed from active `foregroundOverlays` and kept only as a future standalone foreground cutout target.

Blocking issues for final acceptance:

- The native generation is smaller than the intended 2048 runtime asset and becomes visibly rough when inspected at actual gameplay scale.
- The 2048 image is an upscale, not a downsample from a higher-resolution source.
- Foreground crops taken directly from the full background carry floor/background pixels with them, causing visible rectangular patches and weak depth quality.
- The map should not keep solving occlusion by slicing the composite. Props need to be independently generated or cropped from a controlled prop sheet.

## Next Pass Direction

Use the v1 composition only as a reference for scale and route feel. For v2, generate and assemble these assets:

| output | target path | note |
| --- | --- | --- |
| 2x clean base master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v2.png` | floor, walls, boundary, stairs, broad shadows, empty prop footprints |
| runtime clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v2-2048.png` | downsampled from the 2x master |
| 2x prop atlas master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v2.png` | isolated classroom/courtyard props with matching perspective and lighting |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png` | downsampled/cropped for runtime placement |
| assembled QA preview | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v2.png` | base + placed props + 147 px Lina checks |
| placement manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v2.json` | anchors, collision boxes, depth thresholds, prop frame coordinates |

Scale rule for v2:

```text
runtime Lina = 147 px
source scale = 2x
prompt/reference Lina = 294 px
runtime target = 2048 x 2048
source master target = 4096 x 4096
```

If the generator cannot reliably produce a 4096 source, use the highest native output available as a concept only and keep it out of the final runtime path. The final runtime map should come from a source that is larger than the delivered 2048 asset.
