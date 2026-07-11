from __future__ import annotations

from pathlib import Path

from PIL import Image


FRAME = 147
COLS = 8
ROWS = 8
BASELINE = 140
TARGETS = {
    "ayu": "ayu-sprites-v11-q-normalized.png",
    "zhixia": "zhixia-sprites-v3-q-normalized.png",
    "laodeng": "laodeng-sprites-v3-q-normalized.png",
    "jiangxun": "jiangxun-sprites-v4-q-normalized.png",
}
SOURCES = {
    "ayu": "dict/legacy-assets-20260711/sprites/ayu-sprites-v10-imagegen-anchored-clean.png",
    "zhixia": "dict/legacy-assets-20260711/sprites/zhixia-sprites-v2.png",
    "laodeng": "dict/legacy-assets-20260711/sprites/laodeng-sprites-v2.png",
    "jiangxun": "dict/legacy-assets-20260711/sprites/jiangxun-sprites-v3.png",
}


def alpha_bbox(frame: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0)
    return alpha.getbbox()


def normalize_sheet(source: Path, destination: Path) -> None:
    sheet = Image.open(source).convert("RGBA")
    if sheet.size != (FRAME * COLS, FRAME * ROWS):
        raise ValueError(f"{source.name}: expected 1176x1176, got {sheet.size}")

    output = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
    for row in range(ROWS):
        frames: list[tuple[Image.Image, tuple[int, int, int, int] | None]] = []
        max_width = 1
        max_height = 1
        for column in range(COLS):
            frame = sheet.crop((column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME))
            bbox = alpha_bbox(frame)
            frames.append((frame, bbox))
            if bbox:
                max_width = max(max_width, bbox[2] - bbox[0])
                max_height = max(max_height, bbox[3] - bbox[1])

        target_height = 136 if row < 6 else 104
        target_width = 141 if row < 6 else 118
        row_scale = min(1.0, target_width / max_width, target_height / max_height)
        for column, (frame, bbox) in enumerate(frames):
            if not bbox:
                continue
            subject = frame.crop(bbox)
            if row_scale < 0.999:
                size = (
                    max(1, round(subject.width * row_scale)),
                    max(1, round(subject.height * row_scale)),
                )
                subject = subject.resize(size, Image.Resampling.LANCZOS)
            left = column * FRAME + (FRAME - subject.width) // 2
            top = row * FRAME + BASELINE - subject.height
            output.alpha_composite(subject, (left, top))

    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    sprite_dir = root / "assets" / "sprites"
    for character_id, source_name in SOURCES.items():
        destination = sprite_dir / TARGETS[character_id]
        normalize_sheet(root / source_name, destination)
        print(f"{character_id}: {destination.name}")


if __name__ == "__main__":
    main()
