from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
CHARACTER_FRAME = 147
CHARACTER_COLS = 8
CHARACTER_ROWS = 8
CHARACTER_BASELINE = 140
BOSS_FRAME_WIDTH = 224
BOSS_FRAME_HEIGHT = 256
BOSS_COLS = 8
BOSS_ROWS = 9
CHEST_FRAME_WIDTH = 192
CHEST_FRAME_HEIGHT = 144


def alpha_bbox(image: Image.Image, cutoff: int = 16) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(lambda value: 255 if value > cutoff else 0).getbbox()
    if bbox is None:
        raise ValueError("generated cell contains no visible subject")
    return bbox


def subject(image: Image.Image, cutoff: int = 16) -> Image.Image:
    return image.convert("RGBA").crop(alpha_bbox(image, cutoff))


def grid_cell(image: Image.Image, columns: int, rows: int, index: int) -> Image.Image:
    column = index % columns
    row = index // columns
    left = round(column * image.width / columns)
    right = round((column + 1) * image.width / columns)
    top = round(row * image.height / rows)
    bottom = round((row + 1) * image.height / rows)
    return image.crop((left, top, right, bottom))


def fit(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    scale = min(max_width / image.width, max_height / image.height)
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )


def solidify_cat(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    silhouette = alpha.point(lambda value: 255 if value > 18 else 0)
    silhouette = silhouette.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    fringe = silhouette.filter(ImageFilter.GaussianBlur(0.42))
    pixels = image.load()
    mask = silhouette.load()
    edge = fringe.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            next_alpha = 255 if mask[x, y] else edge[x, y]
            if next_alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
            else:
                # Final despill guard. Generated gray/orange fur must never retain
                # the chroma key as a translucent sticker-like rim.
                excess_green = max(0, green - max(red, blue))
                if excess_green > 18:
                    green = max(red, blue)
                pixels[x, y] = (red, green, blue, next_alpha)
    return image


def place_character(
    sheet: Image.Image,
    image: Image.Image,
    row: int,
    column: int,
    *,
    baseline: int = CHARACTER_BASELINE,
) -> None:
    frame = Image.new("RGBA", (CHARACTER_FRAME, CHARACTER_FRAME), (0, 0, 0, 0))
    left = max(2, min(CHARACTER_FRAME - image.width - 2, round((CHARACTER_FRAME - image.width) / 2)))
    top = max(2, min(CHARACTER_FRAME - image.height - 2, baseline - image.height))
    frame.alpha_composite(image, (left, top))
    box = (column * CHARACTER_FRAME, row * CHARACTER_FRAME, (column + 1) * CHARACTER_FRAME, (row + 1) * CHARACTER_FRAME)
    sheet.paste((0, 0, 0, 0), box)
    sheet.alpha_composite(frame, (column * CHARACTER_FRAME, row * CHARACTER_FRAME))


def integrate_laodeng() -> Path:
    source = Image.open(ROOT / "assets/sprites/laodeng-sprites-v8-cat-run-safe.png").convert("RGBA")
    generated = Image.open(ROOT / "tmp/imagegen/laodeng-cat-run-v9-alpha.png").convert("RGBA")
    output = source.copy()
    for column in range(CHARACTER_COLS):
        cat = solidify_cat(subject(grid_cell(generated, 4, 2, column)))
        cat = fit(cat, 132, 92)
        place_character(output, cat, 6, column)
    path = ROOT / "assets/sprites/laodeng-sprites-v9-redrawn-cat-run.png"
    output.save(path, optimize=True)
    return path


def integrate_jiangxun() -> Path:
    source = Image.open(ROOT / "assets/sprites/jiangxun-sprites-v9-cat-paw-walk.png").convert("RGBA")
    idle_generated = Image.open(ROOT / "tmp/imagegen/jiangxun-cat-idle-v10-alpha.png").convert("RGBA")
    run_generated = Image.open(ROOT / "tmp/imagegen/jiangxun-cat-run-v10-alpha.png").convert("RGBA")
    output = source.copy()

    # The transform endpoint and the running row share the same target height,
    # so the head and body no longer jump in scale when the loop begins.
    idle = solidify_cat(subject(grid_cell(idle_generated, 4, 2, 0)))
    idle = fit(idle, 118, 86)
    place_character(output, idle, 5, 7)
    for column in range(CHARACTER_COLS):
        cat = solidify_cat(subject(grid_cell(run_generated, 4, 2, column)))
        cat = fit(cat, 132, 86)
        place_character(output, cat, 6, column)

    path = ROOT / "assets/sprites/jiangxun-sprites-v10-redrawn-cat-motion.png"
    output.save(path, optimize=True)
    return path


def place_boss(sheet: Image.Image, image: Image.Image, row: int, column: int) -> None:
    frame = Image.new("RGBA", (BOSS_FRAME_WIDTH, BOSS_FRAME_HEIGHT), (0, 0, 0, 0))
    image = fit(subject(image, 10), BOSS_FRAME_WIDTH - 10, BOSS_FRAME_HEIGHT - 8)
    left = round((BOSS_FRAME_WIDTH - image.width) / 2)
    top = BOSS_FRAME_HEIGHT - image.height - 4
    frame.alpha_composite(image, (left, top))
    sheet.alpha_composite(frame, (column * BOSS_FRAME_WIDTH, row * BOSS_FRAME_HEIGHT))


def integrate_boss() -> Path:
    generated = Image.open(ROOT / "tmp/imagegen/m04-boss-v3-hd-alpha.png").convert("RGBA")
    cells = [grid_cell(generated, 4, 5, index) for index in range(20)]
    sheet = Image.new(
        "RGBA",
        (BOSS_FRAME_WIDTH * BOSS_COLS, BOSS_FRAME_HEIGHT * BOSS_ROWS),
        (0, 0, 0, 0),
    )
    sequences = {
        0: (0, 1, 2, 3, 2, 1, 0, 1),
        1: (0, 1, 2, 3, 2, 1, 0, 1),
        2: (4, 5, 6, 7, 6, 5, 4, 4),
        3: (8, 9, 10, 11, 11, 11, 11, 11),
        4: (8, 9, 10, 11, 10, 9, 8, 9),
        5: (12, 13, 14, 15, 14, 13, 12, 12),
        6: (13, 14, 15, 14, 15, 14, 13, 12),
        7: (16, 16, 17, 16, 16, 16, 16, 16),
        8: (16, 17, 18, 19, 19, 19, 19, 19),
    }
    for row, sequence in sequences.items():
        for column, source_index in enumerate(sequence):
            place_boss(sheet, cells[source_index], row, column)
    path = ROOT / "assets/game/bosses/m04-structural-instability-boss-sheet-v3-hd.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, optimize=True)
    return path


def integrate_boss_chest() -> Path:
    generated = Image.open(ROOT / "tmp/imagegen/boss-reward-chest-v1-alpha.png").convert("RGBA")
    sheet = Image.new("RGBA", (CHEST_FRAME_WIDTH * 4, CHEST_FRAME_HEIGHT * 2), (0, 0, 0, 0))
    for index in range(8):
        item = fit(subject(grid_cell(generated, 4, 2, index), 10), CHEST_FRAME_WIDTH - 8, CHEST_FRAME_HEIGHT - 8)
        frame = Image.new("RGBA", (CHEST_FRAME_WIDTH, CHEST_FRAME_HEIGHT), (0, 0, 0, 0))
        left = round((CHEST_FRAME_WIDTH - item.width) / 2)
        top = CHEST_FRAME_HEIGHT - item.height - 4
        frame.alpha_composite(item, (left, top))
        sheet.alpha_composite(frame, ((index % 4) * CHEST_FRAME_WIDTH, (index // 4) * CHEST_FRAME_HEIGHT))
    path = ROOT / "assets/game/items/ch1-boss-reward-chest-sheet-v1.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, optimize=True)
    return path


def stitch_sakura_map() -> tuple[Path, list[Path]]:
    source_paths = [
        ROOT / "tmp/imagegen/ch1-m05-sakura-north-v1.png",
        ROOT / "tmp/imagegen/ch1-m05-sakura-middle-v1.png",
        ROOT / "tmp/imagegen/ch1-m05-sakura-south-v2-safe-pedestrians.png",
    ]
    panels: list[Image.Image] = []
    for index, path in enumerate(source_paths):
        panel = Image.open(path).convert("RGB")
        scaled_height = max(1024, round(panel.height * 1536 / panel.width))
        panel = panel.resize((1536, scaled_height), Image.Resampling.LANCZOS)
        # Keep the lower gate and transfer array intact in the final/south panel.
        crop_top = max(0, scaled_height - 1024) if index == 2 else max(0, round((scaled_height - 1024) / 2))
        panel = panel.crop((0, crop_top, 1536, crop_top + 1024))
        panels.append(panel)
    overlap = 72
    destination_dir = ROOT / "assets/chapter1/maps/ch1_m05_sakura_tongji_avenue/background"
    destination_dir.mkdir(parents=True, exist_ok=True)
    segment_paths: list[Path] = []
    for name, panel in zip(("north", "middle", "south"), panels):
        path = destination_dir / f"ch1-m05-sakura-{name}-v2.webp"
        panel.save(path, "WEBP", quality=92, method=6)
        segment_paths.append(path)

    total_height = len(panels) * panels[0].height - overlap * (len(panels) - 1)
    stitched = Image.new("RGB", (panels[0].width, total_height))
    stitched.paste(panels[0], (0, 0))
    for index, panel in enumerate(panels[1:], start=1):
        y = index * (panel.height - overlap)
        previous = stitched.crop((0, y, panel.width, y + overlap))
        incoming = panel.crop((0, 0, panel.width, overlap))
        mask = Image.new("L", (panel.width, overlap))
        mask_pixels = mask.load()
        for blend_y in range(overlap):
            alpha = round(255 * blend_y / max(1, overlap - 1))
            for x in range(panel.width):
                mask_pixels[x, blend_y] = alpha
        stitched.paste(Image.composite(incoming, previous, mask), (0, y))
        stitched.paste(panel.crop((0, overlap, panel.width, panel.height)), (0, y + overlap))

    path = destination_dir / "ch1-m05-sakura-tongji-avenue-v2.webp"
    stitched.save(path, "WEBP", quality=92, method=6)
    return path, segment_paths


def create_preview(laodeng_path: Path, jiangxun_path: Path, boss_path: Path) -> Path:
    laodeng = Image.open(laodeng_path).convert("RGBA").crop((0, 6 * CHARACTER_FRAME, 8 * CHARACTER_FRAME, 7 * CHARACTER_FRAME))
    jiangxun = Image.open(jiangxun_path).convert("RGBA")
    jiang_idle = jiangxun.crop((7 * CHARACTER_FRAME, 5 * CHARACTER_FRAME, 8 * CHARACTER_FRAME, 6 * CHARACTER_FRAME))
    jiang_run = jiangxun.crop((0, 6 * CHARACTER_FRAME, 8 * CHARACTER_FRAME, 7 * CHARACTER_FRAME))
    boss = Image.open(boss_path).convert("RGBA")
    boss_preview = boss.crop((0, 0, 4 * BOSS_FRAME_WIDTH, 5 * BOSS_FRAME_HEIGHT)).resize((560, 800), Image.Resampling.LANCZOS)
    width = max(8 * CHARACTER_FRAME, 560)
    canvas = Image.new("RGBA", (width, CHARACTER_FRAME * 3 + 800), (38, 43, 48, 255))
    canvas.alpha_composite(laodeng, (0, 0))
    canvas.alpha_composite(jiang_idle, (0, CHARACTER_FRAME))
    canvas.alpha_composite(jiang_run, (0, CHARACTER_FRAME * 2))
    canvas.alpha_composite(boss_preview, (0, CHARACTER_FRAME * 3))
    path = ROOT / "tmp/imagegen/redrawn-cats-boss-preview.png"
    canvas.save(path, optimize=True)
    return path


def main() -> None:
    laodeng = integrate_laodeng()
    jiangxun = integrate_jiangxun()
    boss = integrate_boss()
    chest = integrate_boss_chest()
    sakura, segments = stitch_sakura_map()
    preview = create_preview(laodeng, jiangxun, boss)
    for path in (laodeng, jiangxun, boss, chest, sakura, *segments, preview):
        print(path)


if __name__ == "__main__":
    main()
