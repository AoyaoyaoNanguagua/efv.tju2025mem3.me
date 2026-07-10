# Asset Directory Rules

`assets/` contains active runtime files and art directly used by repository pages. Generation sources, review exports and superseded versions do not belong here.

## Structure

```text
assets/
  chapter1/
    chapter1-maps-v1.json
    maps/<map_id>/
      background/
      chunks/
      foreground/
      props/
  game/
    bosses/
    characters/npcs/
    enemies/
      animated/
      concepts/
      cutouts/
      portraits/
    vfx/
  ui/hud/
  audio/
  effects/
  maps/
  portraits/
  sprites/
  weapons/
```

## Placement Rules

1. Map folders contain only map layers. Never put an enemy, NPC, boss, UI sheet or VFX file inside a chapter map package.
2. Reusable gameplay art belongs under `assets/game/`, regardless of the chapter where it first appears.
3. Keep one active version unless two versions are both referenced at runtime.
4. Do not store files named or categorized as `raw`, `source`, `qa` or `debug` under `assets/chapter*/` or `assets/game/`.
5. Use lowercase kebab-case names with a version suffix, for example `biting-magic-book-sprites-v1.png`.
6. Update all code, style, JSON and page references in the same change as a move or rename.

## Verification

Run:

```powershell
node scripts/audit-assets.mjs
```

The audit fails on missing runtime references, exact duplicate files and invalid chapter/game placement.

