# Chapter 1 Layered Map Production Workflow

## Purpose

This workflow turns Chapter 1 maps from single painted backgrounds into playable layered scenes. It is designed for the current EFV runtime, where the active Chapter 1 maps are loaded from `assets/chapter1/chapter1-maps-v1.json` and the first spawn map is `ch1_m01_classroom_spawn`.

The immediate target is to fix three visible problems in the current map pass:

- Seam breaks caused by separately generated large-map chunks.
- Character-to-environment scale drift, where Lina reads too large against desks, fountains, doors, and paths.
- Weak depth layering, where characters appear pasted on top of objects that should sometimes occlude them.
- Texture softness at 100% gameplay zoom when a generated 2048 image is used as the final 2048 runtime asset.
- Bad foreground artifacts when occluders are cropped from a fully painted background instead of generated as independent props.
- Perspective mismatch, where non-perspective prop sprites are placed onto a background with far-small/near-large camera perspective.
- Dirty atlas crops, where one prop frame includes neighboring objects from the generated sheet.

## Required Outputs Per Map

Each production-ready map should ship as a small package, not as a single image.

| output | required | purpose |
| --- | --- | --- |
| macro design image | yes | Orthographic composition, object placement, lighting, route readability, and placement markers. Not used directly as the runtime background. |
| high-resolution source master | yes | Production source at `1.5x-2x` runtime size. Downsample this into runtime art for sharper 100% gameplay texture. |
| scale reference image | yes | Shows the actual in-game character height and collision footprint against tile, door, table, and path dimensions. |
| clean base background | yes | Uniform floor, outer walls/rail boundaries, and open transfer gaps only. No desks, fountains, lamps, banners, stairs, raised platforms, doors, loose books, or other placeable props. |
| prop atlas / prop sheet | yes | A sheet of isolated map objects generated from the accepted concept: desks, fountains, signboards, lamps, planters, bookshelves, railings, columns, and similar objects. |
| prop cutouts | yes for occluding/interactive objects | Cropped from the prop sheet or regenerated as transparent PNGs. Do not crop production props out of the full painted map. |
| foreground overlays | yes for occluders | Object tops/front lips/tree canopies/portal or opening trims that can draw above the player. |
| placement manifest | yes | Coordinates, anchors, collision boxes, depth rules, and source paths. |
| QA preview | yes | A composite screenshot with the character placed at spawn and near key occluders. |

## Orthographic Game-Map Contract

Chapter maps are game boards, not poster illustrations. The map background and prop atlas must use the same orthographic 2.5D projection:

- Keep floor tiles, wall runs, railings, desks, and path widths grid-consistent across the whole map.
- Do not use camera perspective where far objects are smaller and near objects are larger.
- Do not place a non-perspective prop atlas onto a perspective-painted room.
- Treat doors as optional decorative props only. For map transfers, prefer open gaps plus runtime teleport portals.
- Keep all stairs, raised platforms, podiums, railings, gates, fountains, desks, bookshelves, planters, lamps, and signs as props unless the player can never visually overlap them.
- The base background blocks movement only around the outer boundary; interior movement is organized by prop collision boxes.
- Prop collision boxes represent the foot/base footprint, not the full texture rectangle.
- Runtime prop scale should be `<= 1.0`. If a prop needs to appear larger, regenerate a larger source prop and downsample into the atlas instead of upscaling in Phaser.

## Current Runtime Constraints

Use these values unless the runtime changes.

| item | value |
| --- | --- |
| active map registry | `assets/chapter1/chapter1-maps-v1.json` |
| first spawn map id | `ch1_m01_classroom_spawn` |
| current active runtime map size | `2048 x 2048` |
| current chunk size | `1024 x 1024` |
| current first spawn point | `x=1024, y=1716`, facing north |
| player sprite frame | `147 x 147` |
| player runtime scale | `1.0` |
| player collision body | `34 x 42`, offset near the feet |
| visual scale target for art prompts | treat Lina as roughly `147 px` tall in-map |

The older data file `assets/chapter1/ch1-m01-classroom-spawn.json` still describes a `3072 x 2048` horizontal classroom plan. Treat that as a useful future expansion target, but do not use it as the active runtime source unless `play.js` is routed back to it.

The current `ch1_m01_classroom_spawn` redraw is a temporary composite pass. It fixed the most obvious character scale problem, but it is not the final map-production form because its native generation was below 2048 and its foreground overlays were cropped from the painted background.

## Resolution Contract

Do not use a native 2048 image as the final source when the gameplay camera can show it near 100% scale. Produce a larger source and downsample it into the runtime asset.

Recommended source/runtime pairs:

| runtime target | source master | source scale | prompt Lina height | runtime Lina height |
| --- | --- | --- | --- | --- |
| `2048 x 2048` | `3072 x 3072` | `1.5x` | `220 px` | `147 px` |
| `2048 x 2048` | `4096 x 4096` | `2.0x` | `294 px` | `147 px` |
| `3072 x 2048` | `6144 x 4096` | `2.0x` | `294 px` | `147 px` |

Use the formula:

```text
prompt_character_height = runtime_character_height * source_scale
```

For the current 147 px Lina, a 2x art master should use a roughly 294 px Lina reference. A 1.5x art master should use a roughly 220 px reference. Do not guess this value in the prompt; write the exact pixel height.

If a generated map reads oversized against the runtime character, use a larger temporary prompt reference to force the environment smaller while keeping the real runtime character unchanged:

```text
prompt_character_height_for_scale_calibration = runtime_character_height * source_scale / target_visual_element_scale
```

For the current m01 target, `target_visual_element_scale = 0.8`, so a 2x source pass should use a `368 px` temporary Lina reference for proportion calibration. This reference is not drawn into the final map.

Downsample rule:

1. Generate or assemble the source master at `1.5x-2x`.
2. Downsample with high-quality Lanczos filtering into the runtime target.
3. Cut runtime chunks only after downsampling.
4. Review at actual gameplay scale in a `1920 x 1024` browser viewport, not only in a zoomed-out image preview.

## Coordinate And Scale Rules

The map must be drawn around the player, not the other way around.

| scene element | target scale against 147 px Lina |
| --- | --- |
| single floor tile | `40-52 px` readable grid module |
| narrow walk lane | at least `2` character widths |
| main aisle | `3-4` character widths |
| desk/table length | `1.2-1.9` character heights |
| classroom door or arch | clearly taller than character; never character-height |
| fountain diameter | `2.4-3.2` character heights if central landmark |
| planter/railing height | should cover feet/lower body only unless intentionally tall |
| bookshelf/wall facade | can occlude upper body when player walks behind it |

## Asset-Specific Scale Standards

Do not use one global prop ratio for every asset. Each prop category needs its own character reference and target runtime footprint before image generation.

For every prop batch, write a scale table with:

- `runtimeCharacterHeight`: usually `147 px`.
- `sourceCharacterReference`: strict source scale or calibrated source scale, such as `368 px` for the current m01 80% pass.
- `targetRuntimeSize`: expected visible width/height after downsampling.
- `anchor`: usually bottom center.
- `collisionFootprint`: base/standing footprint only.
- `runtimeScalePolicy`: normally `<= 1.0`; prefer regenerating the asset over upscaling.

Current m01 calibration notes:

| asset type | current adjustment | reason |
| --- | --- | --- |
| classroom desks | scale80 base, then `15%` smaller | desks still read oversized against Lina after the map-wide 80% pass |
| podium lamps | scale80 base, then `10%` larger | lamps already matched character scale better and became too small after the global pass |
| planters/bookshelves/signboard/globe | scale80 base only for now | acceptable pending browser QA |

Promote these notes into the next prop atlas prompt instead of applying them late in runtime data.

For generation, always include a temporary scale-reference layer:

- A 147 px standing Lina silhouette.
- A small foot collision ellipse of roughly `34 x 42`.
- A `64 px` tile ruler.
- Width guides for `2`, `3`, and `4` character lanes.

The scale-reference layer is only for image generation and review. It must not appear in the final clean map image.

## Macro-First Production Pass

Start with a low-cost macro design image before generating clean runtime art.

Macro design requirements:

- Show the full map or first playable screen composition.
- Include major route lines, spawn point, exits, interactable nodes, and combat space.
- Place large occluders early: fountains, desks, bookshelves, planters, railings, portal/opening trims, and tree canopies.
- Use the real character scale reference.
- Keep interactive objects away from planned seam bands.
- Avoid small decorative clutter in lanes where the player must dodge.

The macro design is accepted only when these questions are answerable:

- Where does the player spawn?
- Where does the player walk in the first 5 seconds?
- Which objects block movement?
- Which objects can appear in front of the player?
- Where are the interaction nodes?
- Where can the map be extended horizontally?

## Atlas-First Assembly Pass

After the macro concept is accepted, build the playable map from a clean base plus prop assets. This is the preferred production route for Chapter 1 maps.

Production order:

1. Generate a full composite concept to establish layout, mood, and route readability.
2. Generate a marker base from the concept:
   - use orthographic grid-locked floor and outer boundary only;
   - place simple numbered or color-coded prop anchors where desks, podiums, shelves, lamps, planters, exits, and combat blockers belong.
3. Generate the final clean base master from the marker base:
   - keep only floor texture, outer walls/rail boundaries, open transfer gaps, broad non-directional ambient shadows, and subtle reserved footprints;
   - remove all markers;
   - exclude desks, fountains, lamps, banners, signboards, books, stairs, platforms, railings, raised trim, monsters, NPCs, UI, and labels.
4. Generate a prop atlas / prop sheet in the same style and light direction:
   - each object is isolated with enough transparent or removable margin;
   - each object has a target runtime footprint and source-master footprint;
   - include contact shadow as a soft alpha layer or a separate shadow layer, not a hard rectangular patch.
5. Crop or mask individual prop cutouts from the sheet.
   - inspect each atlas frame at 100%;
   - no frame may include neighboring chairs, trims, floor patches, or background pixels;
   - if a crop is dirty, clean the alpha mask or regenerate that prop before integration.
6. Place props using the marker manifest with bottom anchors, foot/base collision boxes, and depth thresholds.
7. Create a QA composite from base + props + foreground overlays + 147 px Lina.
8. Only then promote the runtime background and chunk set.

This replaces the earlier "crop foreground pieces from the full map" bridge. Cropping from a painted map is allowed only for quick diagnosis; it is not accepted for production foreground or prop assets.

## Seam-Safe Horizontal Expansion

Use overlap outpainting for wide maps instead of four unrelated square generations.

Recommended pass:

1. Generate a base block at `2048 x 2048`.
2. Crop the rightmost overlap strip from the current block.
   - Default overlap: `256 px`.
   - Use `384 px` if the seam crosses stairs, walls, water, large shadows, or desks.
   - Use `200 px` only for simple floor/grass transitions.
3. Create a new expansion canvas of `(overlap + 2048) x 2048`.
4. Paste the overlap strip at the left edge and lock those pixels.
5. Generate only the blank area to the right.
6. Keep the left overlap identical to the source block.
7. Merge by dropping the duplicate overlap and appending the new `2048 px` effective area.
8. Apply color/brightness matching and a `64-128 px` feather only where needed.
9. Repeat from the new right edge for further horizontal expansion.

Do not place these items inside an expansion seam band:

- Player spawn points.
- Teleport exits.
- Boss points.
- Puzzle objects.
- Large fountains.
- Doorways or stairs that must align exactly.

For EFV's horizontal screen, vertical expansion is optional. Use the same method with a bottom overlap strip only if a future map needs more north-south movement.

## Four-Block High-Resolution Expansion

For a square or room-like map that still needs high texture detail, use a grid-locked four-block expansion instead of four unrelated generations.

Recommended `2 x 2` pass:

1. Generate the upper-left block first.
2. Crop the upper-left block's right overlap strip, usually `256 px`, and use it as the locked left edge to generate the upper-right block.
3. Crop the upper-right block's bottom overlap strip and use it as the locked top edge to generate the lower-right block.
4. Generate the lower-left block last, using:
   - the upper-left block's bottom overlap strip as the locked top edge;
   - the lower-right block's left overlap strip as the locked right edge;
   - a small center-corner reference patch around the four-block junction so the floor grid and wall trims meet cleanly.
5. Merge by dropping duplicate overlap bands, then run a `64-128 px` feather only on non-interactive floor texture if a seam remains.

All four blocks must share the same orthographic grid and marker coordinate plan. Do not put doors, stairs, large props, teleport exits, or quest nodes inside the overlap bands.

## Layer Model

The final scene should be assembled in layers.

| layer | contents | runtime behavior |
| --- | --- | --- |
| `base_background` | floor, outer walls/rail boundaries, open transfer gaps, broad baked ground tone, reserved prop footprints | Drawn behind everything. No interior collision or character occlusion by itself. |
| `ground_decals` | rugs, floor emblems, small cracks, painted floor marks | Drawn above floor but below characters. No collision. |
| `props_back` | objects always behind player, such as wall shelves or distant decorations | Static draw behind player. May have collision. |
| `y_sorted_props` | atlas/cutout props such as desks, fountains, signboards, lamps, planters, columns | Draw by anchor Y/depth rule. May appear behind or in front of player. |
| `foreground_overlays` | object tops/front lips/railings/tree canopy/portal or opening trim | Draw above player when player foot point is behind depth line. |
| `interaction_vfx` | portal rings, collectible glow, quest markers | Runtime effects. Not baked into background. |
| `debug_qa` | scale marker, collision rectangles, seam guides | QA only, never shipped as final visible art. |

## Prop Cutout Rules

Create separate transparent PNGs for objects that need depth or collision.

Good cutout targets:

- Fountain body and front lip.
- Desk and chair clusters.
- Tall bookshelf fronts and tops.
- Door lintels and arch caps.
- Planters, railings, lamps, columns, banners.
- Any object that can cover the player's feet, body, or head.

Keep baked into the base:

- Floor texture.
- Ground shadows under props.
- Wall mass and broad facade silhouettes.
- Water surfaces when the player never walks behind their edge.
- Tiny non-interactive floor decorations.

Each cutout should include enough soft shadow/contact darkening to sit in the scene, but the shadow should not become a hard rectangle.

Do not create final cutouts by cutting the same rectangle out of the finished map background. That keeps floor texture, background shadows, and neighboring pixels attached to the prop, which produces the visible patch problem in runtime. Use one of these instead:

- Generate the prop as part of a prop sheet, then crop and mask it.
- Regenerate the prop as an isolated transparent/background-removable asset using the composite concept only as reference.
- Keep only its soft contact shadow baked into the base if the prop never moves, while the visible object is a separate cutout.

## Placement Manifest

Every separated object needs a manifest entry. Use this shape even if the first implementation stores it inside existing map JSON.

```json
{
  "propAtlases": [
    {
      "id": "m01-v2",
      "key": "ch1-m01-props-atlas-v2",
      "path": "assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png",
      "frames": {
        "ch1_m01_prop_protocol_deck": { "x": 0, "y": 0, "w": 280, "h": 210 }
      }
    }
  ],
  "id": "ch1_m01_prop_protocol_deck",
  "type": "y_sorted_prop",
  "atlas": "m01-v2",
  "frame": "ch1_m01_prop_protocol_deck",
  "x": 1024,
  "y": 760,
  "anchor": { "x": 0.5, "y": 1.0 },
  "width": 280,
  "height": 210,
  "collision": { "x": 900, "y": 825, "w": 250, "h": 70 },
  "depth": 780,
  "occlusion": {
    "mode": "foot_y",
    "frontOverlay": "assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-protocol-deck-front-v1.png"
  },
  "notes": "Protocol-card stand; do not place directly on a seam."
}
```

Coordinate meanings:

- `x`, `y`: world coordinate of the prop anchor.
- `anchor.y=1.0`: bottom/foot anchor, best for Y sorting.
- `collision`: gameplay blocker box in world coordinates.
- `depth`: foot-Y threshold. If player foot `y` is greater than this value, player usually draws in front; if less, the foreground overlay can cover the player.
- `propAtlases`: map-local prop sheets that the runtime preloads from `chapter1-maps-v1.json`.

## Image Generation Prompt Pattern

Use this pattern for each map image pass.

```text
Use case: stylized-concept
Asset type: EFV 2D game map production art
Primary request: create a top-down/isometric fantasy-academy map layer for Chapter 1.
Input images: current EFV map style reference; Lina sprite sheet as scale reference only.
Scene/backdrop: indoor/outdoor academy space matching the map id.
Composition/framing: orthographic 2.5D game map, source master at 1.5x-2x runtime resolution, readable walk lanes, uniform floor grid, no camera perspective tilt, no far-small/near-large scaling.
Scale: the player character is 147 px tall at runtime. If the source master is 2x, use a 294 px character reference for strict scale or a 368 px temporary reference when targeting 80% environment/prop scale. If the source master is 1.5x, use a 220 px strict reference or 276 px for the 80% calibration. All desks, paths, fountains, and walls must be sized around that character scale.
Layer instruction: produce the requested layer only; do not bake separated props into the base layer.
Lighting/mood: warm academic fantasy, soft shadows, consistent top-left lighting.
Constraints: no UI, no labels, no text, no characters, no monsters, no watermark.
Avoid: tiny toy-scale furniture, impossible walk lanes, hard seams, mismatched floor grids, decorative clutter on combat paths, perspective room depth, and dirty atlas crops that include neighboring props.
```

For a clean base background, add:

```text
Layer target: clean base background only. Include uniform floor texture, outer walls or rail boundaries, open transfer gaps, broad ground tone, and optional subtle placement footprints. Exclude desks, fountains, lamps, banners, signboards, loose books, stairs, raised platforms, railings, doors, characters, UI, labels, and floating VFX.
```

For a prop atlas / prop sheet, add:

```text
Layer target: isolated prop atlas for runtime placement. Use the accepted macro concept and marker base as layout/style reference, but do not draw a complete map. Create separate orthographic 2.5D fantasy-academy props on a clean removable/transparent background: desk clusters, protocol podium, stairs, lamps, planters, banners, bookshelves, railings, signboards, fountain body/front lip if needed. Keep consistent top-left lighting and target runtime footprints. Add soft contact shadows only, no hard rectangular shadows, no neighboring props inside a frame, no UI, no text, no characters.
```

For a full visual test image, add:

```text
Layer target: composite concept preview. Include props in their intended locations so the composition can be judged, but keep them clean enough to later split into prop cutouts.
```

## First Spawn Map Redraw Target

For `ch1_m01_classroom_spawn`, the first redraw test should target the screen after player birth.

Runtime priorities:

- South-side spawn entrance around `x=1024, y=1716`.
- Central north-facing aisle.
- Course protocol board near the north center.
- Protocol card podium below the board.
- Left and right desk lanes large enough to make Lina feel small but readable.
- A right-side corridor/exit hint.
- Foreground portal/opening trim, desks, planters, or railings that can test occlusion.

Suggested first test files:

| output | path |
| --- | --- |
| composite preview | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-layered-redraw-preview-v1.png` |
| clean base candidate | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-redraw-v1.png` |
| future prop folder | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/` |
| future foreground folder | `assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/` |
| future manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v1.json` |

The v1 generated test is a composite preview only. Do not treat it as the final art form. The v2 target should produce:

| output | path |
| --- | --- |
| 2x clean base master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v2.png` |
| runtime clean base | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v2-2048.png` |
| 2x prop atlas master | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-props-atlas-master-4096-v2.png` |
| runtime prop atlas | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v2.png` |
| QA composite | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v2.png` |
| placement manifest | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v2.json` |

The active runtime background should move from a composite image to the clean base once the prop atlas and manifest exist.

## QA Checklist

Before a map is accepted:

- Character scale: paste a 147 px Lina at spawn and near major props; she should not read as a giant.
- Texture quality: inspect the map at actual 100% gameplay scale in a `1920 x 1024` viewport. Do not accept a map only because it looks clean at 70% image preview.
- Walk lanes: main aisle supports `3-4` character widths; side lanes support at least `2`.
- Occlusion: at least one object correctly covers the player's lower/upper body when walking behind it.
- Collision: blocker boxes match visual footprints, not decorative shadows.
- Atlas crops: every prop frame is checked at 100%; no desk frame may include a chair, trim, or other unrelated object from the sheet.
- Seams: no interactive objects, transfer openings, or teleport exits sit inside an overlap band.
- Lighting: separated props match the base background light direction.
- Prop isolation: no foreground prop contains baked floor rectangles from the background.
- Minimap: the composition still reads when downscaled to minimap size.
- Runtime safety: new test files are versioned and do not overwrite active assets unless intentionally promoted.

## Promotion Rule

A redraw becomes active only after these steps are complete:

1. Save the preview and document the prompt.
2. Create or update the high-resolution clean base master.
3. Downsample the clean base into the runtime background.
4. Generate the prop atlas / prop sheet from the accepted concept.
5. Extract or regenerate required prop cutouts and foreground pieces.
6. Write the placement manifest with anchors, collisions, and depth thresholds.
7. Update `chapter1-maps-v1.json` paths only after all referenced assets exist.
8. Load `play.html` locally and verify first-screen scale, 100% texture quality, collision, minimap, and occlusion.
