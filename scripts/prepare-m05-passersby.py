from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "tmp" / "imagegen" / "m05-passersby-v1"
OUTPUT_DIR = ROOT / "assets" / "chapter1" / "maps" / "ch1_m05_sakura_tongji_avenue" / "npcs"
CANVAS_SIZE = (256, 320)
MAX_SUBJECT_SIZE = (216, 286)
BASELINE_Y = 304


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 10 else 0)
    bbox = alpha.getbbox()
    if not bbox:
        raise ValueError("Generated NPC has no opaque subject pixels")
    return bbox


def normalize_npc(source: Path, destination: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    left, top, right, bottom = alpha_bbox(image)
    subject = image.crop((max(0, left - 3), max(0, top - 3), min(image.width, right + 3), min(image.height, bottom + 3)))
    scale = min(MAX_SUBJECT_SIZE[0] / subject.width, MAX_SUBJECT_SIZE[1] / subject.height)
    size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    x = (CANVAS_SIZE[0] - subject.width) // 2
    y = BASELINE_Y - subject.height
    canvas.alpha_composite(subject, (x, y))
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)
    return canvas


def checkerboard(size: tuple[int, int], cell: int = 16) -> Image.Image:
    image = Image.new("RGBA", size, (231, 214, 185, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=(211, 190, 162, 255))
    return image


def main() -> None:
    prepared: list[Image.Image] = []
    for key in "abcd":
        source = SOURCE_DIR / f"passerby-{key}-alpha.png"
        destination = OUTPUT_DIR / f"ch1-m05-passerby-{key}-v1.png"
        prepared.append(normalize_npc(source, destination))
        print(destination)

    preview = checkerboard((CANVAS_SIZE[0] * 4, CANVAS_SIZE[1]))
    for index, image in enumerate(prepared):
        preview.alpha_composite(image, (index * CANVAS_SIZE[0], 0))
    preview_path = SOURCE_DIR / "passersby-preview-v1.png"
    preview.save(preview_path, optimize=True)
    print(preview_path)


if __name__ == "__main__":
    main()
