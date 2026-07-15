from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHEET = ROOT / "assets/game/bosses/m04-structural-instability-boss-sheet-v4.png"
OUTPUT_SHEET = ROOT / "assets/game/bosses/m04-structural-instability-boss-sheet-v5.png"
FRAME_WIDTH = 320
FRAME_HEIGHT = 360
COLS = 4

PHASES = (
    {
        "phase": 1,
        "row": 1,
        "max_width": 298,
        "max_height": 330,
        "baseline": 338,
    },
    {
        "phase": 2,
        "row": 5,
        "max_width": 302,
        "max_height": 330,
        "baseline": 338,
    },
    {
        "phase": 3,
        "row": 9,
        "max_width": 306,
        "max_height": 306,
        "baseline": 326,
    },
)


def is_foreground(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return not (green > red * 1.28 and green > blue * 1.28 and green > 130)


def foreground_bbox(rgb: Image.Image) -> tuple[int, int, int, int]:
    mask = Image.new("L", rgb.size, 0)
    source = rgb.load()
    target = mask.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            if is_foreground(source[x, y]):
                target[x, y] = 255
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("No boss sprite foreground found in strip cell")
    left, top, right, bottom = bbox
    return max(0, left - 3), max(0, top - 3), min(rgb.width, right + 3), min(rgb.height, bottom + 3)


def render_phase_frames(sheet: Image.Image, config: dict[str, int]) -> None:
    phase = config["phase"]
    source_dir = ROOT / "tmp/imagegen/m04-v4"
    rgb_path = source_dir / f"ch1-m04-boss-phase{phase}-walk-grid-v5.png"
    rgba_path = source_dir / f"ch1-m04-boss-phase{phase}-walk-grid-v5-transparent.png"
    with Image.open(rgb_path) as original_image, Image.open(rgba_path) as transparent_image:
        rgb = original_image.convert("RGB")
        rgba = transparent_image.convert("RGBA")
        if rgb.size != rgba.size:
            raise RuntimeError(f"Strip size mismatch for phase {phase}: {rgb.size} vs {rgba.size}")
        for column in range(COLS):
            grid_column = column % 2
            grid_row = column // 2
            left = round(rgb.width * grid_column / 2)
            right = round(rgb.width * (grid_column + 1) / 2)
            top = round(rgb.height * grid_row / 2)
            bottom = round(rgb.height * (grid_row + 1) / 2)
            rgb_cell = rgb.crop((left, top, right, bottom))
            rgba_cell = rgba.crop((left, top, right, bottom))
            bbox = foreground_bbox(rgb_cell)
            sprite = rgba_cell.crop(bbox)
            scale = min(
                config["max_width"] / sprite.width,
                config["max_height"] / sprite.height,
                1.0,
            )
            if scale >= 1:
                raise RuntimeError(
                    f"Phase {phase} frame {column} would be enlarged; regenerate it at a larger native size"
                )
            sprite = sprite.resize(
                (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
                Image.Resampling.LANCZOS,
            )
            frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
            x = (FRAME_WIDTH - sprite.width) // 2
            y = config["baseline"] - sprite.height
            frame.alpha_composite(sprite, (x, y))
            sheet.alpha_composite(frame, (column * FRAME_WIDTH, config["row"] * FRAME_HEIGHT))


def main() -> None:
    with Image.open(SOURCE_SHEET) as source:
        sheet = source.convert("RGBA")
    if sheet.size != (FRAME_WIDTH * COLS, FRAME_HEIGHT * 12):
        raise RuntimeError(f"Unexpected source sheet size: {sheet.size}")
    for config in PHASES:
        render_phase_frames(sheet, config)
    OUTPUT_SHEET.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT_SHEET, optimize=True)
    print(OUTPUT_SHEET.relative_to(ROOT))


if __name__ == "__main__":
    main()
