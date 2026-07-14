from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140


def cell(sheet: Image.Image, row: int, column: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def alpha_bbox(image: Image.Image, cutoff: int = 12) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > cutoff else 0).getbbox()


def subject(image: Image.Image, cutoff: int = 12) -> Image.Image:
    box = alpha_bbox(image, cutoff)
    if box is None:
        raise ValueError("Sprite frame has no visible subject")
    return image.crop(box)


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    scale = min(max_width / image.width, max_height / image.height, 1.0)
    if scale >= 0.999:
        return image
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )


def add_fine_outline(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    binary = image.getchannel("A").point(lambda value: 255 if value >= 18 else 0)
    rim = ImageChops.subtract(binary.filter(ImageFilter.MaxFilter(3)), binary)
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    outline = Image.new("RGBA", image.size, (47, 46, 36, 77))
    result.alpha_composite(Image.composite(outline, Image.new("RGBA", image.size), rim))
    result.alpha_composite(image)
    return result


def place(
    sheet: Image.Image,
    image: Image.Image,
    row: int,
    column: int,
    *,
    baseline: int = BASELINE,
    center_x: int = FRAME // 2,
    outline: bool = True,
) -> None:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    left = max(2, min(FRAME - image.width - 2, round(center_x - image.width / 2)))
    top = max(1, min(FRAME - image.height - 1, baseline - image.height))
    frame.alpha_composite(image, (left, top))
    if outline:
        frame = add_fine_outline(frame)
    sheet.paste((0, 0, 0, 0), (column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))
    sheet.alpha_composite(frame, (column * FRAME, row * FRAME))


def repair_laodeng(root: Path) -> tuple[Path, Image.Image]:
    source_path = root / "assets/sprites/laodeng-sprites-v7-lina-edge.png"
    output_path = root / "assets/sprites/laodeng-sprites-v8-cat-run-safe.png"
    source = Image.open(source_path).convert("RGBA")
    output = source.copy()
    # The jump row contains complete heads and bodies. Recompose the run row
    # from those safe silhouettes so no source-level face crop survives.
    sequence = (0, 2, 4, 1, 0, 2, 4, 1)
    for column, source_column in enumerate(sequence):
        cat = fit(subject(cell(source, 7, source_column)), 124, 106)
        place(output, cat, 6, column, baseline=140)
    output.save(output_path, optimize=True)
    return output_path, output


def matte_spill(red: int, green: int, blue: int) -> bool:
    purple = red > green * 1.28 and blue > green * 1.28 and red + blue > 150
    green = green > red * 1.3 and green > blue * 1.16 and green > 65
    return purple or green


def nearest_clean_rgb(image: Image.Image, x: int, y: int) -> tuple[int, int, int] | None:
    pixels = image.load()
    for radius in range(1, 6):
        candidates: list[tuple[int, int, int, int]] = []
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if max(abs(dx), abs(dy)) != radius:
                    continue
                px, py = x + dx, y + dy
                if not (0 <= px < image.width and 0 <= py < image.height):
                    continue
                red, green, blue, alpha = pixels[px, py]
                if alpha < 220 or matte_spill(red, green, blue):
                    continue
                candidates.append((dx * dx + dy * dy, red, green, blue))
        if candidates:
            _, red, green, blue = min(candidates)
            return red, green, blue
    return None


def solidify_cat_frame(frame: Image.Image) -> Image.Image:
    frame = frame.convert("RGBA")
    original_alpha = frame.getchannel("A")
    silhouette = original_alpha.point(lambda value: 255 if value > 18 else 0)
    # Close tiny extraction holes, then make every pixel inside the fur
    # silhouette opaque. Only the one-pixel outer fringe remains antialiased.
    silhouette = silhouette.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    fringe = silhouette.filter(ImageFilter.GaussianBlur(0.55))
    solid_alpha = Image.new("L", frame.size, 0)
    solid_pixels = solid_alpha.load()
    silhouette_pixels = silhouette.load()
    fringe_pixels = fringe.load()
    for y in range(frame.height):
        for x in range(frame.width):
            solid_pixels[x, y] = 255 if silhouette_pixels[x, y] else fringe_pixels[x, y]

    repaired = frame.copy()
    pixels = repaired.load()
    for y in range(frame.height):
        for x in range(frame.width):
            red, green, blue, _ = pixels[x, y]
            alpha = solid_pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            if matte_spill(red, green, blue):
                replacement = nearest_clean_rgb(frame, x, y)
                if replacement:
                    red, green, blue = replacement
            pixels[x, y] = (red, green, blue, alpha)
    return repaired


def repair_zhixia(root: Path) -> tuple[Path, Image.Image]:
    source_path = root / "assets/sprites/zhixia/zhixia-sprites-final.png"
    output_path = source_path
    source = Image.open(source_path).convert("RGBA")
    output = source.copy()
    for column in range(COLS):
        repaired = solidify_cat_frame(cell(source, 6, column))
        output.paste((0, 0, 0, 0), (column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        output.alpha_composite(repaired, (column * FRAME, 6 * FRAME))
    output.save(output_path, optimize=True)
    return output_path, output


def repair_ayu(root: Path) -> tuple[Path, Image.Image]:
    current_path = root / "assets/sprites/ayu-sprites-v17-unarmed-walk-seat-lina-edge.png"
    walk_source_path = root / "assets/sprites/ayu-sprites-v13.png"
    output_path = root / "assets/sprites/ayu-sprites-v18-alternating-walk-cat-transition.png"
    current = Image.open(current_path).convert("RGBA")
    walk_source = Image.open(walk_source_path).convert("RGBA")
    output = current.copy()
    # v13 has the correct alternating planted paw sequence. Preserve that
    # anatomy, but align and outline it to the current Lina-compatible sheet.
    for column in range(COLS):
        walker = fit(subject(cell(walk_source, 1, column)), 139, 136)
        place(output, walker, 1, column, baseline=140)

    run_heights = []
    for column in range(4):
        box = alpha_bbox(cell(current, 6, column))
        if box:
            run_heights.append(box[3] - box[1])
    target_height = round(sum(run_heights) / len(run_heights)) if run_heights else 92
    seated = subject(cell(current, 5, 7))
    scale = min(118 / seated.width, target_height / seated.height)
    seated = seated.resize(
        (max(1, round(seated.width * scale)), max(1, round(seated.height * scale))),
        Image.Resampling.LANCZOS,
    )
    place(output, seated, 5, 7, baseline=140)
    output.save(output_path, optimize=True)
    return output_path, output


def repair_jiangxun(root: Path) -> tuple[Path, Image.Image]:
    current_path = root / "assets/sprites/jiangxun-sprites-v8-lina-edge.png"
    paw_source_path = root / "dict/legacy-assets-20260713-loading-audit/assets/sprites/jiangxun-sprites-v6.png"
    output_path = root / "assets/sprites/jiangxun-sprites-v9-cat-paw-walk.png"
    current = Image.open(current_path).convert("RGBA")
    paw_source = Image.open(paw_source_path).convert("RGBA")
    output = current.copy()
    # The v6 walking row is the established cat-paw design; the regenerated
    # row accidentally introduced boots.
    for column in range(COLS):
        walker = fit(subject(cell(paw_source, 1, column)), 139, 136)
        place(output, walker, 1, column, baseline=140)
    output.save(output_path, optimize=True)
    return output_path, output


def comparison_preview(outputs: list[tuple[str, Image.Image, int]], destination: Path) -> None:
    background = (34, 45, 50, 255)
    preview = Image.new("RGBA", (COLS * FRAME, len(outputs) * FRAME), background)
    draw = ImageDraw.Draw(preview)
    tile = 21
    for row_index, (_, sheet, source_row) in enumerate(outputs):
        for y in range(row_index * FRAME, (row_index + 1) * FRAME, tile):
            for x in range(0, preview.width, tile):
                shade = (42, 57, 62, 255) if (x // tile + y // tile) % 2 else background
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=shade)
        preview.alpha_composite(sheet.crop((0, source_row * FRAME, COLS * FRAME, (source_row + 1) * FRAME)), (0, row_index * FRAME))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    laodeng_path, laodeng = repair_laodeng(root)
    zhixia_path, zhixia = repair_zhixia(root)
    ayu_path, ayu = repair_ayu(root)
    jiangxun_path, jiangxun = repair_jiangxun(root)
    preview_path = root / "tmp/character-motion-repair-preview.png"
    comparison_preview(
        [
            ("laodeng", laodeng, 6),
            ("zhixia", zhixia, 6),
            ("ayu-walk", ayu, 1),
            ("ayu-cat", ayu, 5),
            ("jiangxun", jiangxun, 1),
        ],
        preview_path,
    )
    for path in (laodeng_path, zhixia_path, ayu_path, jiangxun_path, preview_path):
        print(path)


if __name__ == "__main__":
    main()
