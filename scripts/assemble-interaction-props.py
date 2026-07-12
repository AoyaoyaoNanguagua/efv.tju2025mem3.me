from __future__ import annotations

from pathlib import Path
from collections import deque

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "m02": (
        "tmp/imagegen/m02-interaction-props-v1-alpha.png",
        "assets/chapter1/maps/ch1_m02_prompt_archive/props",
        (
            "ch1-m02-archive-index-v1.png",
            "ch1-m02-citation-check-v1.png",
            "ch1-m02-privacy-filter-v1.png",
            "ch1-m02-shadow-casket-v1.png",
        ),
    ),
    "m03": (
        "tmp/imagegen/m03-interaction-props-v1-alpha.png",
        "assets/chapter1/maps/ch1_m03_botanical_garden/props",
        (
            "ch1-m03-survey-lectern-v3.png",
            "ch1-m03-patrol-starter-v1.png",
            "ch1-m03-moon-orchid-seal-v1.png",
            "ch1-m03-abnormal-flowerbed-v1.png",
        ),
    ),
}


def crop_object(cell: Image.Image) -> Image.Image:
    rgba = np.asarray(cell).copy()
    alpha_mask = rgba[:, :, 3] >= 8
    visited = np.zeros_like(alpha_mask, dtype=bool)
    components: list[list[tuple[int, int]]] = []
    height, width = alpha_mask.shape
    for y, x in zip(*np.nonzero(alpha_mask)):
        if visited[y, x]:
            continue
        component: list[tuple[int, int]] = []
        queue = deque([(int(x), int(y))])
        visited[y, x] = True
        while queue:
            px, py = queue.popleft()
            component.append((px, py))
            for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                if 0 <= nx < width and 0 <= ny < height and alpha_mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((nx, ny))
        components.append(component)
    if not components:
        raise ValueError("Generated prop cell is empty")
    keep = np.zeros_like(alpha_mask, dtype=np.uint8)
    component = max(components, key=len)
    xs, ys = zip(*component)
    keep[list(ys), list(xs)] = 255
    rgba[:, :, 3] = np.minimum(rgba[:, :, 3], keep)
    cell = Image.fromarray(rgba, "RGBA")
    alpha = cell.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("Generated prop cell is empty")
    subject = cell.crop(bbox)
    target = 360
    scale = min(target / subject.width, target / subject.height, 1.0)
    if scale < 1:
        subject = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
            Image.Resampling.LANCZOS,
        )
    canvas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((384 - subject.width) // 2, 360 - subject.height))
    return canvas


def main() -> None:
    for _, (source_path, output_dir, names) in SOURCES.items():
        source = Image.open(ROOT / source_path).convert("RGBA")
        destination = ROOT / output_dir
        destination.mkdir(parents=True, exist_ok=True)
        for index, name in enumerate(names):
            left = round(index * source.width / len(names))
            right = round((index + 1) * source.width / len(names))
            prop = crop_object(source.crop((left, 0, right, source.height)))
            output = destination / name
            prop.save(output, optimize=True)
            print(output)


if __name__ == "__main__":
    main()
