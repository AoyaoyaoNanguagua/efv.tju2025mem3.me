from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/game/bosses/m04-structural-instability-boss-sheet-v5.png"
OUTPUTS = tuple(
    ROOT / f"assets/game/bosses/m04-structural-instability-boss-phase{phase}-sheet-v7.png"
    for phase in range(1, 4)
)
FRAME_WIDTH = 320
FRAME_HEIGHT = 360
SOURCE_COLS = 4
SOURCE_ROWS = 12
PHASE_ROWS = 4

# Every operation is downscale-only. Baselines are phase-specific so an action
# change never makes the boss jump vertically or appear to be a different size.
ROW_LAYOUT = {
    0: (276, 300, 340),
    1: (276, 300, 340),
    2: (288, 300, 340),
    3: (276, 300, 340),
    4: (282, 290, 340),
    5: (282, 290, 340),
    6: (296, 296, 340),
    7: (282, 290, 340),
    8: (296, 276, 332),
    9: (296, 276, 332),
    10: (308, 260, 332),
    11: (304, 260, 332),
}


def remove_tiny_alpha_islands(frame: Image.Image, minimum_area: int = 72) -> Image.Image:
    rgba = frame.copy()
    alpha = rgba.getchannel("A")
    width, height = alpha.size
    pixels = alpha.load()
    visited = bytearray(width * height)
    remove = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] <= 12:
                continue
            queue = deque([(x, y)])
            visited[index] = 1
            component = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if visited[nindex] or pixels[nx, ny] <= 12:
                        continue
                    visited[nindex] = 1
                    queue.append((nx, ny))
            min_y = min(point[1] for point in component)
            max_y = max(point[1] for point in component)
            if len(component) < minimum_area or (min_y > 300 and max_y - min_y <= 5):
                remove.extend(component)
    if remove:
        alpha_pixels = alpha.load()
        for x, y in remove:
            alpha_pixels[x, y] = 0
        rgba.putalpha(alpha)
    return rgba


def normalize_frame(frame: Image.Image, row: int) -> Image.Image:
    cleaned = remove_tiny_alpha_islands(frame)
    bbox = cleaned.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    sprite = cleaned.crop(bbox)
    max_width, max_height, baseline = ROW_LAYOUT[row]
    scale = min(max_width / sprite.width, max_height / sprite.height, 1.0)
    if scale < 1.0:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
    output = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
    x = (FRAME_WIDTH - sprite.width) // 2
    y = baseline - sprite.height
    output.alpha_composite(sprite, (x, y))
    return output


def main() -> None:
    with Image.open(SOURCE) as image:
        source = image.convert("RGBA")
    if source.size != (FRAME_WIDTH * SOURCE_COLS, FRAME_HEIGHT * SOURCE_ROWS):
        raise RuntimeError(f"Unexpected source sheet size: {source.size}")
    outputs = [
        Image.new("RGBA", (FRAME_WIDTH * SOURCE_COLS, FRAME_HEIGHT * PHASE_ROWS), (0, 0, 0, 0))
        for _ in OUTPUTS
    ]
    for row in range(SOURCE_ROWS):
        for column in range(SOURCE_COLS):
            frame = source.crop((
                column * FRAME_WIDTH,
                row * FRAME_HEIGHT,
                (column + 1) * FRAME_WIDTH,
                (row + 1) * FRAME_HEIGHT,
            ))
            normalized = normalize_frame(frame, row)
            phase_index = row // PHASE_ROWS
            phase_row = row % PHASE_ROWS
            outputs[phase_index].alpha_composite(normalized, (column * FRAME_WIDTH, phase_row * FRAME_HEIGHT))
    for output_path, output in zip(OUTPUTS, outputs):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output.save(output_path, optimize=True)
        print(output_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
