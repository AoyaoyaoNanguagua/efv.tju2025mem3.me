from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image, ImageDraw


FRAME = 147
COLS = 8


def load_motion_helpers(root: Path):
    helper_path = root / "scripts/repair-character-motion-frames.py"
    spec = importlib.util.spec_from_file_location("character_motion_helpers", helper_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {helper_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def split_grid(source: Image.Image, helpers) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for row in range(2):
        top = round(row * source.height / 2)
        bottom = round((row + 1) * source.height / 2)
        for column in range(4):
            left = round(column * source.width / 4)
            right = round((column + 1) * source.width / 4)
            frames.append(helpers.subject(source.crop((left, top, right, bottom))))
    return frames


def write_preview(sheet: Image.Image, destination: Path) -> None:
    preview = Image.new("RGBA", (FRAME * COLS, FRAME * 2), (31, 39, 45, 255))
    draw = ImageDraw.Draw(preview)
    tile = 21
    for y in range(0, preview.height, tile):
        for x in range(0, preview.width, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(47, 58, 64, 255))
    preview.alpha_composite(sheet.crop((0, FRAME, FRAME * COLS, FRAME * 2)), (0, 0))
    preview.alpha_composite(sheet.crop((0, FRAME * 5, FRAME * COLS, FRAME * 6)), (0, FRAME))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    helpers = load_motion_helpers(root)
    base_path = root / "assets/sprites/ayu-sprites-v18-alternating-walk-cat-transition.png"
    output = Image.open(base_path).convert("RGBA")

    walk_source = Image.open(root / "tmp/imagegen/ayu-walk-v19-alpha.png").convert("RGBA")
    walk_frames = split_grid(walk_source, helpers)
    for column, source in enumerate(walk_frames):
        walker = helpers.fit(source, 136, 134)
        helpers.place(output, walker, 1, column, baseline=140, outline=False)

    cat_source = Image.open(root / "tmp/imagegen/ayu-cat-idle-v19-alpha.png").convert("RGBA")
    cat_candidates = split_grid(cat_source, helpers)
    # Candidate 3 has the closest elongated body and head scale to the run row.
    cat_idle = helpers.fit(cat_candidates[2], 122, 82)
    cat_idle = helpers.solidify_cat_frame(cat_idle)
    helpers.place(output, cat_idle, 5, 7, baseline=140, outline=False)

    destination = root / "assets/sprites/ayu-sprites-v19-redrawn-walk-cat-end.png"
    preview = root / "tmp/imagegen/ayu-v19-redrawn-motion-preview.png"
    output.save(destination, optimize=True)
    write_preview(output, preview)
    print(destination)
    print(preview)


if __name__ == "__main__":
    main()
