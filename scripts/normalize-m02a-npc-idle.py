from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
NPC_DIR = ROOT / "assets" / "game" / "characters" / "npcs"
FRAME = 147
TARGET_CENTER_X = FRAME / 2
TARGET_BASELINE = 138


def normalize_idle_row(path: Path, row: int = 0) -> None:
    sheet = Image.open(path).convert("RGBA")
    normalized = sheet.copy()
    for column in range(8):
        box = (column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME)
        frame = sheet.crop(box)
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        if not bbox:
            raise RuntimeError(f"Empty idle frame: {path.name} row={row} column={column}")
        center_x = (bbox[0] + bbox[2]) / 2
        offset_x = round(TARGET_CENTER_X - center_x)
        offset_y = TARGET_BASELINE - bbox[3]
        canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        canvas.alpha_composite(frame, (offset_x, offset_y))
        normalized.paste(canvas, box)
    normalized.save(path, optimize=True)


def main() -> None:
    for filename in (
        "ch1-m02a-mumu-sprites-v13-efv.png",
        "ch1-m02a-xiaozhu-sprites-v13-efv.png",
    ):
        path = NPC_DIR / filename
        normalize_idle_row(path)
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
