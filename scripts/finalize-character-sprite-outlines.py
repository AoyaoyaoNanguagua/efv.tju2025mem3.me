from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140
SOURCE_COLS = 7
SOURCE_ROWS = 7
FRAME_SEQUENCE = (0, 1, 2, 3, 4, 5, 6, 5)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()


def split_grid(sheet: Image.Image, rows: int, columns: int) -> list[list[Image.Image]]:
    frames: list[list[Image.Image]] = []
    for row in range(rows):
        row_frames: list[Image.Image] = []
        top = round(row * sheet.height / rows)
        bottom = round((row + 1) * sheet.height / rows)
        for column in range(columns):
            left = round(column * sheet.width / columns)
            right = round((column + 1) * sheet.width / columns)
            frame = sheet.crop((left, top, right, bottom))
            bbox = alpha_bbox(frame)
            if bbox is None:
                raise ValueError(f"Empty source frame: row={row}, column={column}")
            row_frames.append(frame.crop(bbox))
        frames.append(row_frames)
    return frames


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
        candidates = [component for component in components if len(component) >= max_size * 0.2]
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


def split_generated_grid(sheet: Image.Image) -> list[list[Image.Image]]:
    first_bottom = round(sheet.height / SOURCE_ROWS)
    centers = find_column_centers(sheet.crop((0, 0, sheet.width, first_bottom)))
    spacing = float(np.median(np.diff(centers)))
    half_width = min(spacing * 0.92, sheet.width / SOURCE_COLS * 1.05)
    row_spacing = sheet.height / SOURCE_ROWS
    half_height = row_spacing * 0.82
    frames: list[list[Image.Image]] = []
    for row in range(SOURCE_ROWS):
        row_frames: list[Image.Image] = []
        center_y = (row + 0.5) * row_spacing
        for column, center_x in enumerate(centers):
            left = max(0, round(center_x - half_width))
            right = min(sheet.width, round(center_x + half_width))
            top = max(0, round(center_y - half_height))
            bottom = min(sheet.height, round(center_y + half_height))
            frame = keep_nearest_component(
                sheet.crop((left, top, right, bottom)),
                center_x - left,
                center_y - top,
            )
            bbox = alpha_bbox(frame)
            if bbox is None:
                raise ValueError(f"Empty generated frame: row={row}, column={column}")
            row_frames.append(frame.crop(bbox))
        frames.append(row_frames)
    return frames


def fit_subject(subject: Image.Image, row: int) -> Image.Image:
    if row < 6:
        target_width = 141 if row != 2 else 143
        target_height = 136
    else:
        target_width = 124
        target_height = 108
    scale = min(target_width / subject.width, target_height / subject.height)
    return subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )


def add_fine_outline(frame: Image.Image) -> Image.Image:
    """Match Lina's measured one-pixel low-alpha neutral outline."""
    frame = frame.convert("RGBA")
    binary = frame.getchannel("A").point(lambda value: 255 if value >= 18 else 0)
    dilation = binary.filter(ImageFilter.MaxFilter(3))
    rim = ImageChops.subtract(dilation, binary)

    outlined = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    edge = Image.new("RGBA", frame.size, (47, 46, 36, 77))
    outlined.alpha_composite(Image.composite(edge, Image.new("RGBA", frame.size), rim))
    outlined.alpha_composite(frame)
    return outlined


def outline_sheet(source: Image.Image) -> Image.Image:
    source = source.convert("RGBA")
    if source.size != (FRAME * COLS, FRAME * ROWS):
        raise ValueError(f"Expected an 8x8 147px sheet, got {source.size}")
    output = Image.new("RGBA", source.size, (0, 0, 0, 0))
    for row in range(ROWS):
        for column in range(COLS):
            box = (
                column * FRAME,
                row * FRAME,
                (column + 1) * FRAME,
                (row + 1) * FRAME,
            )
            outlined = add_fine_outline(source.crop(box))
            baseline_locked = Image.new("RGBA", outlined.size, (0, 0, 0, 0))
            baseline_locked.alpha_composite(outlined.crop((0, 0, FRAME, BASELINE + 1)), (0, 0))
            output.alpha_composite(baseline_locked, box[:2])
    return output


def upper_body_center(subject: Image.Image) -> float:
    pixels = np.asarray(subject)
    alpha = pixels[:, :, 3].astype(float)
    upper_limit = max(8, round(subject.height * 0.72))
    weights = alpha[:upper_limit]
    xs = np.arange(subject.width, dtype=float)[None, :]
    total = weights.sum()
    return float((weights * xs).sum() / total) if total else subject.width / 2


def fit_to_box(subject: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / subject.width, height / subject.height)
    return subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )


def assemble_ayu(root: Path) -> Image.Image:
    generated_walk = root / "tmp/imagegen/ayu-walk-v17-alpha.png"
    finalized_sheet = root / "assets/sprites/ayu-sprites-v17-unarmed-walk-seat-lina-edge.png"
    # The AI generation source is intentionally kept out of release packages.
    # A clean Git checkout can still rerun the finalizer idempotently from the
    # checked-in finalized sheet; local art iteration uses the generated source.
    if not generated_walk.exists():
        if finalized_sheet.exists():
            return Image.open(finalized_sheet).convert("RGBA")
        raise FileNotFoundError(f"Missing Ayu walk source and finalized sheet: {generated_walk}")

    output = Image.open(root / "assets/sprites/ayu-sprites-v14-balanced.png").convert("RGBA")
    walk_source = Image.open(generated_walk).convert("RGBA")
    walk_rows = split_grid(walk_source, 2, 4)

    for index in range(COLS):
        subject = fit_to_box(walk_rows[index // 4][index % 4], 139, 133)
        local_left = round(82 - upper_body_center(subject))
        local_left = max(4, min(FRAME - subject.width - 4, local_left))
        local_top = BASELINE - subject.height
        cell_box = (index * FRAME, FRAME, (index + 1) * FRAME, FRAME * 2)
        output.paste((0, 0, 0, 0), cell_box)
        output.alpha_composite(subject, (index * FRAME + local_left, FRAME + local_top))

    # The transformation must resolve into a calm seated cat before cat-run begins.
    seated_cat = output.crop((5 * FRAME, 5 * FRAME, 6 * FRAME, 6 * FRAME))
    output.paste((0, 0, 0, 0), (7 * FRAME, 5 * FRAME, 8 * FRAME, 6 * FRAME))
    output.alpha_composite(seated_cat, (7 * FRAME, 5 * FRAME))
    return outline_sheet(output)


def assemble_jiangxun(root: Path) -> Image.Image:
    generated = Image.open(root / "assets/sprites/jiangxun-sprites-v7-alpha-native.png").convert("RGBA")
    generated_rows = split_generated_grid(generated)
    previous = Image.open(root / "assets/sprites/jiangxun-sprites-v6.png").convert("RGBA")
    output = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))

    for row in range(7):
        for column, source_column in enumerate(FRAME_SEQUENCE):
            subject = fit_subject(generated_rows[row][source_column], row)
            left = column * FRAME + (FRAME - subject.width) // 2
            top = row * FRAME + BASELINE - subject.height
            output.alpha_composite(subject, (left, top))

    # The generated batch replaces the requested idle/walk/attack/run rows. Keep
    # the established cat-jump row so the gameplay protocol stays complete.
    cat_jump = previous.crop((0, 7 * FRAME, FRAME * COLS, FRAME * ROWS))
    output.alpha_composite(cat_jump, (0, 7 * FRAME))
    return outline_sheet(output)


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print(f"saved {path} size={image.size} mode={image.mode}")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    save(
        assemble_jiangxun(root),
        root / "assets/sprites/jiangxun-sprites-v8-lina-edge.png",
    )
    save(assemble_ayu(root), root / "assets/sprites/ayu-sprites-v17-unarmed-walk-seat-lina-edge.png")
    for source_name, destination_name in (("laodeng-sprites-v5.png", "laodeng-sprites-v7-lina-edge.png"),):
        source = Image.open(root / "assets/sprites" / source_name).convert("RGBA")
        save(outline_sheet(source), root / "assets/sprites" / destination_name)


if __name__ == "__main__":
    main()
