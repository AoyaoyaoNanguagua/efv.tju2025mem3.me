from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140
ROW_SOURCES = (
    "row0-idle-no-tail-transparent.png",
    "row1-walk-A-transparent.png",
    "row2-transparent.png",
    "row3-transparent.png",
    "row4-death-corrected-transparent.png",
    "row5-transparent.png",
    "row6-transparent.png",
    "row7-transparent.png",
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
    return alpha.getbbox()


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    alpha = np.asarray(image.getchannel("A")) >= 8
    height, width = alpha.shape
    visited = np.zeros_like(alpha, dtype=bool)
    largest: list[tuple[int, int]] = []

    for y, x in zip(*np.nonzero(alpha & ~visited)):
        if visited[y, x]:
            continue
        component: list[tuple[int, int]] = []
        queue = deque([(int(x), int(y))])
        visited[y, x] = True
        while queue:
            px, py = queue.popleft()
            component.append((px, py))
            for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                if 0 <= nx < width and 0 <= ny < height and alpha[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        if len(component) > len(largest):
            largest = component

    if not largest:
        return image
    keep = np.zeros_like(alpha, dtype=np.uint8)
    xs, ys = zip(*largest)
    keep[list(ys), list(xs)] = 255
    cleaned = np.asarray(image).copy()
    cleaned[:, :, 3] = np.minimum(cleaned[:, :, 3], keep)
    return Image.fromarray(cleaned, "RGBA")


def split_strip(strip: Image.Image) -> list[Image.Image]:
    alpha = np.asarray(strip.getchannel("A"))
    occupancy = (alpha >= 8).sum(axis=0).astype(float)
    centers = np.linspace(strip.width / (COLS * 2), strip.width - strip.width / (COLS * 2), COLS)

    for _ in range(20):
        rough = np.r_[0, (centers[:-1] + centers[1:]) / 2, strip.width]
        updated = []
        for column in range(COLS):
            left = int(rough[column])
            right = max(left + 1, int(rough[column + 1]))
            xs = np.arange(left, right)
            weights = occupancy[left:right]
            updated.append(float((xs * weights).sum() / weights.sum()) if weights.sum() else centers[column])
        centers = np.asarray(updated)

    boundaries = [0]
    for left_center, right_center in zip(centers, centers[1:]):
        distance = right_center - left_center
        search_left = max(boundaries[-1] + 1, round(left_center + distance * 0.28))
        search_right = min(strip.width - 1, round(right_center - distance * 0.28))
        midpoint = (left_center + right_center) / 2
        candidates = np.arange(search_left, max(search_left + 1, search_right))
        scores = occupancy[candidates]
        minimum = scores.min()
        quiet = candidates[scores == minimum]
        boundary = int(quiet[np.argmin(np.abs(quiet - midpoint))])
        boundaries.append(boundary)
    boundaries.append(strip.width)

    return [
        strip.crop((boundaries[column], 0, boundaries[column + 1], strip.height))
        for column in range(COLS)
    ]


def assemble(source_dir: Path, destination: Path) -> Image.Image:
    output = Image.new("RGBA", (FRAME * COLS, FRAME * ROWS), (0, 0, 0, 0))

    for row, source_name in enumerate(ROW_SOURCES):
        strip = Image.open(source_dir / source_name).convert("RGBA")
        subjects = []
        for frame in split_strip(strip):
            if row == 7:
                frame = keep_largest_alpha_component(frame)
            bbox = alpha_bbox(frame)
            if not bbox:
                raise ValueError(f"{source_name}: empty frame {len(subjects) + 1}")
            subjects.append(frame.crop(bbox))

        target_height = 136 if row < 6 else 105
        target_width = 141 if row < 6 else 118
        max_width = max(subject.width for subject in subjects)
        max_height = max(subject.height for subject in subjects)
        scale = min(target_width / max_width, target_height / max_height)

        for column, subject in enumerate(subjects):
            size = (
                max(1, round(subject.width * scale)),
                max(1, round(subject.height * scale)),
            )
            subject = subject.resize(size, Image.Resampling.LANCZOS)
            left = column * FRAME + (FRAME - subject.width) // 2
            top = row * FRAME + BASELINE - subject.height
            output.alpha_composite(subject, (left, top))

    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)
    return output


def write_preview(sheet: Image.Image, destination: Path) -> None:
    checker = Image.new("RGBA", sheet.size, (30, 35, 49, 255))
    draw = ImageDraw.Draw(checker)
    block = 21
    for y in range(0, checker.height, block):
        for x in range(0, checker.width, block):
            if (x // block + y // block) % 2:
                draw.rectangle((x, y, x + block - 1, y + block - 1), fill=(44, 51, 68, 255))
    checker.alpha_composite(sheet)
    checker.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST).save(destination)


def write_portrait(source_dir: Path, destination: Path) -> None:
    strip = Image.open(source_dir / ROW_SOURCES[0]).convert("RGBA")
    frame = split_strip(strip)[0]
    bbox = alpha_bbox(frame)
    if not bbox:
        raise ValueError("Zhixia portrait source frame is empty")
    subject = frame.crop(bbox)
    scale = min(450 / subject.width, 700 / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.LANCZOS,
    )
    portrait = Image.new("RGBA", (512, 768), (0, 0, 0, 0))
    portrait.alpha_composite(subject, ((portrait.width - subject.width) // 2, 738 - subject.height))
    destination.parent.mkdir(parents=True, exist_ok=True)
    portrait.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    source_dir = root / "tmp" / "imagegen" / "zhixia-v5-rows"
    destination = root / "assets" / "sprites" / "zhixia-sprites-v5-prototype.png"
    portrait = root / "assets" / "portraits" / "zhixia.png"
    preview = root / "tmp" / "imagegen" / "zhixia-sprites-v5-preview.png"
    sheet = assemble(source_dir, destination)
    write_portrait(source_dir, portrait)
    write_preview(sheet, preview)
    print(destination)
    print(portrait)
    print(preview)


if __name__ == "__main__":
    main()
