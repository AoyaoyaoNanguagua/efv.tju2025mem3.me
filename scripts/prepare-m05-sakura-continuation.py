from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parents[1]
SOUTH = ROOT / "assets" / "chapter1" / "maps" / "ch1_m05_sakura_tongji_avenue" / "background" / "ch1-m05-sakura-south-v3.webp"
STRIP = ROOT / "tmp" / "imagegen" / "ch1-m05-sakura-south-top-200-v4.png"
OUTPUT = ROOT / "assets" / "chapter1" / "maps" / "ch1_m05_sakura_tongji_avenue" / "background" / "ch1-m05-sakura-north-v8.webp"
WIDTH = 1536
GENERATED_HEIGHT = 1024
REFERENCE_HEIGHT = 200
VISIBLE_NORTH_HEIGHT = 960


def fit_bottom_boundary(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = width / image.width
    resized = image.resize((width, round(image.height * scale)), Image.Resampling.LANCZOS)
    if resized.height >= height:
        return resized.crop((0, resized.height - height, width, resized.height))
    canvas = Image.new("RGB", (width, height), resized.getpixel((width // 2, 0)))
    canvas.paste(resized, (0, height - resized.height))
    return canvas


def prepare_strip() -> None:
    south = Image.open(SOUTH).convert("RGB").resize((WIDTH, 1024), Image.Resampling.LANCZOS)
    STRIP.parent.mkdir(parents=True, exist_ok=True)
    south.crop((0, 0, WIDTH, REFERENCE_HEIGHT)).save(STRIP, optimize=True)
    print(STRIP)


def match_boundary(extension: Image.Image, strip: Image.Image) -> Image.Image:
    color_blend_height = 240
    source_sample = extension.crop((0, extension.height - 64, WIDTH, extension.height))
    target_sample = strip.crop((0, 0, WIDTH, 64))
    source_mean = ImageStat.Stat(source_sample).mean
    target_mean = ImageStat.Stat(target_sample).mean
    deltas = [round(target - source) for source, target in zip(source_mean, target_mean)]
    shifted = Image.merge("RGB", tuple(
        channel.point(lambda value, delta=delta: max(0, min(255, value + delta)))
        for channel, delta in zip(extension.split(), deltas)
    ))
    color_mask = Image.new("L", extension.size, 0)
    color_pixels = color_mask.load()
    color_start = extension.height - color_blend_height
    for y in range(color_start, extension.height):
        progress = (y - color_start) / max(1, color_blend_height - 1)
        alpha = round(255 * progress * progress * (3 - 2 * progress))
        for x in range(WIDTH):
            color_pixels[x, y] = alpha
    extension = Image.composite(shifted, extension, color_mask)

    blend_height = 32
    start_y = extension.height - blend_height
    generated_edge = extension.crop((0, start_y, WIDTH, extension.height))
    # Reverse the exact reference strip so its final row equals the south panel's
    # first row. A smoothstep mask keeps the generated continuation at the top of
    # the transition while guaranteeing a pixel-identical map boundary below.
    exact_prelude = strip.crop((0, 0, WIDTH, blend_height)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    mask = Image.new("L", (WIDTH, blend_height), 0)
    pixels = mask.load()
    for y in range(blend_height):
        progress = y / max(1, blend_height - 1)
        smooth = progress * progress * (3 - 2 * progress)
        alpha = round(255 * smooth)
        for x in range(WIDTH):
            pixels[x, y] = alpha
    transition = Image.composite(exact_prelude, generated_edge, mask)
    matched = extension.copy()
    matched.paste(transition, (0, start_y))
    return matched


def integrate(generated_path: Path) -> None:
    generated = fit_bottom_boundary(Image.open(generated_path).convert("RGB"), WIDTH, GENERATED_HEIGHT)
    strip = Image.open(STRIP).convert("RGB")
    # The generated image is instructed to reserve its lower 200 px for the supplied
    # reference. Stretch only the newly outpainted region to the visible 960 px, then
    # append the exact reference strip as a hidden overlap under the south panel.
    extension = generated.crop((0, 0, WIDTH, GENERATED_HEIGHT - REFERENCE_HEIGHT))
    extension = extension.resize((WIDTH, VISIBLE_NORTH_HEIGHT), Image.Resampling.LANCZOS)
    extension = match_boundary(extension, strip)
    north = Image.new("RGB", (WIDTH, VISIBLE_NORTH_HEIGHT + REFERENCE_HEIGHT))
    north.paste(extension, (0, 0))
    north.paste(strip, (0, VISIBLE_NORTH_HEIGHT))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    north.save(OUTPUT, "WEBP", quality=94, method=6)
    preview = Image.new("RGB", (WIDTH, 360))
    preview.paste(north.crop((0, VISIBLE_NORTH_HEIGHT - 160, WIDTH, VISIBLE_NORTH_HEIGHT)), (0, 0))
    preview.paste(Image.open(SOUTH).convert("RGB").resize((WIDTH, 1024), Image.Resampling.LANCZOS).crop((0, 0, WIDTH, 200)), (0, 160))
    preview_path = STRIP.with_name("ch1-m05-sakura-seam-preview-v8.png")
    preview.save(preview_path, optimize=True)
    print(OUTPUT)
    print(preview_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generated", type=Path)
    args = parser.parse_args()
    prepare_strip()
    if args.generated:
        integrate(args.generated)


if __name__ == "__main__":
    main()
