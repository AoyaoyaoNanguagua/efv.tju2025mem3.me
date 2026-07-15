from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


FRAME = 147
COLS = 8
RUN_ROW = 6
ALPHA_CUTOFF = 18


def boosted_alpha(alpha: int) -> int:
    if alpha <= ALPHA_CUTOFF:
        return 0
    normalized = (alpha - ALPHA_CUTOFF) / (255 - ALPHA_CUTOFF)
    return round(255 * min(1.0, normalized * 1.52) ** 0.82)


def is_matte_spill(red: int, green: int, blue: int) -> bool:
    purple = red > green * 1.28 and blue > green * 1.28 and red + blue > 150
    green_spill = green > red * 1.3 and green > blue * 1.16 and green > 65
    return purple or green_spill


def nearest_clean_color(
    pixels: Image.PixelAccess,
    edge: Image.PixelAccess,
    x: int,
    y: int,
) -> tuple[int, int, int] | None:
    for radius in range(1, 6):
        candidates: list[tuple[int, int, int, int]] = []
        for offset_y in range(-radius, radius + 1):
            for offset_x in range(-radius, radius + 1):
                if max(abs(offset_x), abs(offset_y)) != radius:
                    continue
                sample_x = x + offset_x
                sample_y = y + offset_y
                if not (0 <= sample_x < COLS * FRAME and RUN_ROW * FRAME <= sample_y < (RUN_ROW + 1) * FRAME):
                    continue
                red, green, blue, alpha = pixels[sample_x, sample_y]
                if alpha < 150 or edge[sample_x, sample_y] > 0 or is_matte_spill(red, green, blue):
                    continue
                distance = offset_x * offset_x + offset_y * offset_y
                candidates.append((distance, red, green, blue))
        if candidates:
            _, red, green, blue = min(candidates)
            return red, green, blue
    return None


def repair(source: Image.Image) -> Image.Image:
    output = source.convert("RGBA").copy()
    row_box = (0, RUN_ROW * FRAME, COLS * FRAME, (RUN_ROW + 1) * FRAME)
    row_alpha = output.crop(row_box).getchannel("A")
    mask = row_alpha.point(lambda value: 255 if value > ALPHA_CUTOFF else 0)
    eroded = mask.filter(ImageFilter.MinFilter(5))
    edge_mask = Image.new("L", output.size, 0)
    edge_pixels = edge_mask.load()
    mask_pixels = mask.load()
    eroded_pixels = eroded.load()
    for local_y in range(FRAME):
        for x in range(COLS * FRAME):
            if mask_pixels[x, local_y] and not eroded_pixels[x, local_y]:
                edge_pixels[x, RUN_ROW * FRAME + local_y] = 255

    source_pixels = output.load()
    original_pixels = source.convert("RGBA").load()
    for y in range(RUN_ROW * FRAME, (RUN_ROW + 1) * FRAME):
        for x in range(COLS * FRAME):
            red, green, blue, alpha = original_pixels[x, y]
            alpha = boosted_alpha(alpha)
            if alpha == 0:
                source_pixels[x, y] = (0, 0, 0, 0)
                continue
            if edge_pixels[x, y] and is_matte_spill(red, green, blue):
                replacement = nearest_clean_color(original_pixels, edge_pixels, x, y)
                if replacement:
                    red, green, blue = replacement
                elif alpha < 96:
                    alpha = 0
            source_pixels[x, y] = (red, green, blue, alpha)
    return output


def write_comparison(before: Image.Image, after: Image.Image, destination: Path) -> None:
    width = COLS * FRAME
    height = FRAME * 2
    preview = Image.new("RGBA", (width, height), (24, 43, 34, 255))
    draw = ImageDraw.Draw(preview)
    block = 28
    colors = ((26, 54, 40, 255), (48, 77, 54, 255))
    for y in range(0, height, block):
        for x in range(0, width, block):
            draw.rectangle((x, y, x + block - 1, y + block - 1), fill=colors[(x // block + y // block) % 2])
    row_box = (0, RUN_ROW * FRAME, width, (RUN_ROW + 1) * FRAME)
    preview.alpha_composite(before.crop(row_box), (0, 0))
    preview.alpha_composite(after.crop(row_box), (0, FRAME))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    source_path = root / "assets" / "sprites" / "zhixia" / "zhixia-sprites-v5-prototype.png"
    destination_path = root / "assets" / "sprites" / "zhixia" / "zhixia-sprites-v6-cat-alpha.png"
    preview_path = root / "tmp" / "imagegen" / "zhixia-cat-run-alpha-comparison.png"
    source = Image.open(source_path).convert("RGBA")
    repaired = repair(source)
    repaired.save(destination_path, optimize=True)
    write_comparison(source, repaired, preview_path)
    print(destination_path)
    print(preview_path)


if __name__ == "__main__":
    main()
