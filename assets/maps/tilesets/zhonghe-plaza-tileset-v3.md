# Zhonghe Plaza Tileset v3

- Tile size: 64 x 64 px
- Sheet: `zhonghe-plaza-tileset-v3.png`
- Demo preview: `zhonghe-plaza-demo-preview-v3.png`
- Character scale preview: `zhonghe-plaza-demo-preview-with-lina-v3.png`
- Demo tilemap: `zhonghe-plaza-tilemap-v3.json`
- Style reference: `../references/zhonghe-plaza-tileset-style-reference-v2.png`
- Suggested spawn: `{ "x": 928, "y": 928 }`

This version uses the generated style reference as the art source, then reassembles the result into a strict 64 px tile grid. It is intended to better match Lina's high-detail chibi anime sprite style while staying usable as a real tilemap.

Included groups:

- Zhonghe-style glass facade, wall, entrance, and roof tiles
- Warm campus plaza paving, diamond paving, ornament paving, and stairs
- Grass, grass-detail, grass-to-plaza edges, hedges, planters, and flower beds
- Sakura and green tree tiles
- Water, water edges, and a small bridge tile
- Road, road edge, and crosswalk tiles
- Benches, lamps, bollards, banners, and Ji Wang Kai Lai style stone columns

Collision suggestions:

- Block building facade, water, tree trunks, planters, hedges, columns, lamps, benches, banners, and the road boundary.
- Keep plaza paving, stairs, bridge deck, grass walk paths, and crosswalk walkable for the demo route.
- Keep tile ids stable when polishing art further, so the map JSON does not need to be rebuilt.
