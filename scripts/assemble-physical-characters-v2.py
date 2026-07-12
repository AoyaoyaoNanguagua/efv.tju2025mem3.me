from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from collections import deque

import numpy as np
from PIL import Image, ImageDraw


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140
SOURCE_COLS = 7
FRAME_SEQUENCE = (0, 1, 2, 3, 4, 5, 6, 5)


@dataclass(frozen=True)
class CharacterSource:
    character_id: str
    source: str
    source_rows: int
    motion_source: str
    motion_rows: int
    destination: str


CHARACTERS = (
    CharacterSource(
        "ayu",
        "tmp/imagegen/ayu-sprites-v12-alpha.png",
        8,
        "tmp/imagegen/ayu-motion-v13-alpha.png",
        2,
        "assets/sprites/ayu-sprites-v13.png",
    ),
    CharacterSource(
        "jiangxun",
        "tmp/imagegen/jiangxun-sprites-v5-tailfree-alpha.png",
        8,
        "tmp/imagegen/jiangxun-motion-v6-alpha.png",
        3,
        "assets/sprites/jiangxun-sprites-v6.png",
    ),
    CharacterSource(
        "laodeng",
        "tmp/imagegen/laodeng-sprites-v4-tailfree-alpha.png",
        7,
        "tmp/imagegen/laodeng-motion-v5-alpha.png",
        3,
        "assets/sprites/laodeng-sprites-v5.png",
    ),
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
    return alpha.getbbox()


def find_column_centers(strip: Image.Image) -> np.ndarray:
    alpha = np.asarray(strip.getchannel("A"))
    occupancy = (alpha >= 8).sum(axis=0).astype(float)
    occupied = np.flatnonzero(occupancy)
    if not len(occupied):
        raise ValueError("Generated sprite row is empty")
    centers = np.linspace(float(occupied[0]), float(occupied[-1]), SOURCE_COLS)
    xs = np.arange(strip.width)
    for _ in range(24):
        assignments = np.abs(xs[:, None] - centers[None, :]).argmin(axis=1)
        updated = centers.copy()
        for column in range(SOURCE_COLS):
            mask = assignments == column
            weights = occupancy[mask]
            if weights.sum():
                updated[column] = float((xs[mask] * weights).sum() / weights.sum())
        if np.max(np.abs(updated - centers)) < 0.1:
            centers = updated
            break
        centers = updated

    return centers


def keep_nearest_component(frame: Image.Image, target_x: float, target_y: float) -> Image.Image:
    rgba = np.asarray(frame).copy()
    alpha = rgba[:, :, 3] >= 8
    height, width = alpha.shape
    visited = np.zeros_like(alpha, dtype=bool)
    components: list[list[tuple[int, int]]] = []
    for y, x in zip(*np.nonzero(alpha)):
        if visited[y, x]:
            continue
        component: list[tuple[int, int]] = []
        queue = deque([(int(x), int(y))])
        visited[y, x] = True
        while queue:
            px, py = queue.popleft()
            component.append((px, py))
            for nx, ny in (
                (px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1),
                (px - 1, py - 1), (px + 1, py - 1), (px - 1, py + 1), (px + 1, py + 1),
            ):
                if 0 <= nx < width and 0 <= ny < height and alpha[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        components.append(component)
    keep = np.zeros_like(alpha, dtype=np.uint8)
    if components:
        max_size = max(len(component) for component in components)
        candidates = [component for component in components if len(component) >= max_size * 0.25]
        selected = min(
            candidates,
            key=lambda component: (
                (sum(x for x, _ in component) / len(component) - target_x) ** 2
                + (sum(y for _, y in component) / len(component) - target_y) ** 2
            ),
        )
        xs, ys = zip(*selected)
        keep[list(ys), list(xs)] = 255
    rgba[:, :, 3] = np.minimum(rgba[:, :, 3], keep)
    return Image.fromarray(rgba, "RGBA")


def split_uniform_grid(sheet: Image.Image, rows: int) -> list[list[Image.Image]]:
    output: list[list[Image.Image]] = []
    first_bottom = round(sheet.height / rows)
    centers = find_column_centers(sheet.crop((0, 0, sheet.width, first_bottom)))
    spacing = float(np.median(np.diff(centers)))
    half_width = min(spacing * 0.92, sheet.width / SOURCE_COLS * 1.05)
    row_spacing = sheet.height / rows
    half_height = row_spacing * 0.78
    for row in range(rows):
        row_frames: list[Image.Image] = []
        center_y = (row + 0.5) * row_spacing
        for column, center in enumerate(centers):
            left = max(0, round(center - half_width))
            right = min(sheet.width, round(center + half_width))
            top = max(0, round(center_y - half_height))
            bottom = min(sheet.height, round(center_y + half_height))
            frame = keep_nearest_component(
                sheet.crop((left, top, right, bottom)),
                center - left,
                center_y - top,
            )
            bbox = alpha_bbox(frame)
            if not bbox:
                raise ValueError(f"Empty generated frame at row={row}, column={column}")
            row_frames.append(frame.crop(bbox))
        output.append(row_frames)
    return output


def split_equal_grid(sheet: Image.Image, rows: int, columns: int = COLS) -> list[list[Image.Image]]:
    output: list[list[Image.Image]] = []
    for row in range(rows):
        row_frames: list[Image.Image] = []
        top = round(row * sheet.height / rows)
        bottom = round((row + 1) * sheet.height / rows)
        for column in range(columns):
            left = round(column * sheet.width / columns)
            right = round((column + 1) * sheet.width / columns)
            cell = sheet.crop((left, top, right, bottom))
            frame = keep_nearest_component(cell, cell.width / 2, cell.height / 2)
            bbox = alpha_bbox(frame)
            if not bbox:
                raise ValueError(f"Empty motion frame at row={row}, column={column}")
            row_frames.append(frame.crop(bbox))
        output.append(row_frames)
    return output


def fit_subject(subject: Image.Image, row: int) -> Image.Image:
    target_width = 145 if row == 2 else (141 if row < 6 else 124)
    target_height = 136 if row < 6 else 108
    scale = min(target_width / subject.width, target_height / subject.height, 1.0)
    return subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )


def assemble(source: CharacterSource, root: Path) -> Image.Image:
    generated = Image.open(root / source.source).convert("RGBA")
    source_rows = split_uniform_grid(generated, source.source_rows)
    motion = Image.open(root / source.motion_source).convert("RGBA")
    motion_rows = split_equal_grid(motion, source.motion_rows)
    output = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))

    for row in range(ROWS):
        source_row = min(row, source.source_rows - 1)
        for column, source_column in enumerate(FRAME_SEQUENCE):
            if row == 1:
                subject = motion_rows[0][column].copy()
            elif row == 6:
                subject = motion_rows[1][column].copy()
            elif row == 5 and column == 7 and source.motion_rows >= 3:
                subject = motion_rows[2][0].copy()
            else:
                subject = source_rows[source_row][source_column].copy()
            fit_row = 6 if row == 5 and column == 7 and source.motion_rows >= 3 else row
            subject = fit_subject(subject, fit_row)
            jump_offset = 0
            if source.character_id == "laodeng" and row == 7:
                jump_offset = (0, 14, 30, 38, 28, 12, 0, 12)[column]
            left = column * FRAME + (FRAME - subject.width) // 2
            top = row * FRAME + BASELINE - subject.height - jump_offset
            output.alpha_composite(subject, (left, top))

    destination = root / source.destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)
    return output


def write_preview(sheet: Image.Image, destination: Path) -> None:
    checker = Image.new("RGBA", sheet.size, (27, 31, 43, 255))
    draw = ImageDraw.Draw(checker)
    block = 21
    for y in range(0, checker.height, block):
        for x in range(0, checker.width, block):
            if (x // block + y // block) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(43, 49, 64, 255))
    checker.alpha_composite(sheet)
    destination.parent.mkdir(parents=True, exist_ok=True)
    checker.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    for source in CHARACTERS:
        sheet = assemble(source, root)
        preview = root / "tmp" / "imagegen" / f"{source.character_id}-physical-v2-preview.png"
        write_preview(sheet, preview)
        print(root / source.destination)
        print(preview)


if __name__ == "__main__":
    main()
