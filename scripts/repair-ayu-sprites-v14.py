from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140
IDLE_ROW = 0
WALK_ROW = 1
TRANSFORM_ROW = 5
CAT_RUN_ROW = 6
CAT_JUMP_ROW = 7


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()


def frame_at(sheet: Image.Image, row: int, column: int) -> Image.Image:
    return sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def extract_subject(frame: Image.Image) -> Image.Image:
    bbox = alpha_bbox(frame)
    if not bbox:
        raise ValueError("Empty sprite frame")
    return frame.crop(bbox)


def resize_to_height(subject: Image.Image, target_height: int) -> Image.Image:
    scale = target_height / max(1, subject.height)
    return subject.resize(
        (max(1, round(subject.width * scale)), target_height),
        Image.Resampling.LANCZOS,
    )


def upper_body_center(subject: Image.Image) -> float:
    pixels = subject.load()
    upper_limit = max(8, round(subject.height * 0.7))
    weighted_x = 0.0
    weight_sum = 0.0
    for y in range(3, upper_limit):
        for x in range(subject.width):
            alpha = pixels[x, y][3]
            if alpha < 24:
                continue
            weighted_x += x * alpha
            weight_sum += alpha
    return weighted_x / weight_sum if weight_sum else subject.width / 2


def clear_cell(sheet: Image.Image, row: int, column: int) -> None:
    sheet.paste((0, 0, 0, 0), (column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))


def place_subject(
    sheet: Image.Image,
    subject: Image.Image,
    row: int,
    column: int,
    *,
    center_x: float | None = None,
    upper_center_x: float | None = None,
    baseline: int = BASELINE,
) -> None:
    clear_cell(sheet, row, column)
    if upper_center_x is not None:
        local_left = round(upper_center_x - upper_body_center(subject))
    else:
        local_left = round((center_x if center_x is not None else FRAME / 2) - subject.width / 2)
    local_left = max(2, min(FRAME - subject.width - 2, local_left))
    local_top = baseline - subject.height
    local_top = max(2, min(FRAME - subject.height - 2, local_top))
    sheet.alpha_composite(subject, (column * FRAME + local_left, row * FRAME + local_top))


def repair_human_scale_and_anchor(source: Image.Image, output: Image.Image) -> None:
    for column in range(COLS):
        idle = resize_to_height(extract_subject(frame_at(source, IDLE_ROW, column)), 130)
        place_subject(output, idle, IDLE_ROW, column, upper_center_x=82, baseline=BASELINE)

        walk = resize_to_height(extract_subject(frame_at(source, WALK_ROW, column)), 138)
        place_subject(output, walk, WALK_ROW, column, upper_center_x=82, baseline=BASELINE)


def repair_cat_transition_and_run(source: Image.Image, output: Image.Image) -> None:
    crouch = extract_subject(frame_at(source, CAT_JUMP_ROW, 1))
    stand = extract_subject(frame_at(source, CAT_JUMP_ROW, 0))
    place_subject(output, crouch, TRANSFORM_ROW, 6, center_x=FRAME / 2, baseline=BASELINE)
    place_subject(output, stand, TRANSFORM_ROW, 7, center_x=FRAME / 2, baseline=BASELINE)

    gallop_sources = (0, 2, 4, 1)
    for column in range(COLS):
        source_column = gallop_sources[column % len(gallop_sources)]
        subject = extract_subject(frame_at(source, CAT_JUMP_ROW, source_column))
        place_subject(output, subject, CAT_RUN_ROW, column, center_x=FRAME / 2, baseline=BASELINE)


def write_comparison(before: Image.Image, after: Image.Image, destination: Path) -> None:
    rows = (IDLE_ROW, WALK_ROW, TRANSFORM_ROW, CAT_RUN_ROW)
    width = COLS * FRAME
    height = len(rows) * FRAME * 2
    preview = Image.new("RGBA", (width, height), (27, 31, 43, 255))
    draw = ImageDraw.Draw(preview)
    block = 21
    for y in range(0, height, block):
        for x in range(0, width, block):
            if (x // block + y // block) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(43, 49, 64, 255))
    for index, row in enumerate(rows):
        top = index * FRAME * 2
        box = (0, row * FRAME, width, (row + 1) * FRAME)
        preview.alpha_composite(before.crop(box), (0, top))
        preview.alpha_composite(after.crop(box), (0, top + FRAME))
    destination.parent.mkdir(parents=True, exist_ok=True)
    preview.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    source_path = root / "assets" / "sprites" / "ayu-sprites-v13.png"
    destination_path = root / "assets" / "sprites" / "ayu-sprites-v14-balanced.png"
    preview_path = root / "tmp" / "imagegen" / "ayu-sprites-v14-comparison.png"
    source = Image.open(source_path).convert("RGBA")
    if source.size != (FRAME * COLS, FRAME * ROWS):
        raise ValueError(f"Unexpected Ayu sheet size: {source.size}")
    repaired = source.copy()
    repair_human_scale_and_anchor(source, repaired)
    repair_cat_transition_and_run(source, repaired)
    repaired.save(destination_path, optimize=True)
    write_comparison(source, repaired, preview_path)
    print(destination_path)
    print(preview_path)


if __name__ == "__main__":
    main()
