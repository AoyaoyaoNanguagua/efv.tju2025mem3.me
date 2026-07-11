from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAME = 147
BASELINE = 140
REQUIRED_COLUMNS = [4, 6, 4, 4, 6, 8, 4, 6]
SHEETS = [
    "lina-sprites-v10-anchored-expanded.png",
    "ayu-sprites-v11-q-normalized.png",
    "zhixia-sprites-v5-prototype.png",
    "laodeng-sprites-v3-q-normalized.png",
    "jiangxun-sprites-v4-q-normalized.png",
]
PORTRAITS = [
    "ayu-q-v2.png",
    "zhixia.png",
    "laodeng-q-v2.png",
    "jiangxun-q-v2.png",
]


def test_sheet(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    assert image.size == (FRAME * 8, FRAME * 8), f"{path.name}: invalid sheet size"
    for row in range(8):
        for column in range(REQUIRED_COLUMNS[row]):
            frame = image.crop(
                (column * FRAME, row * FRAME, (column + 1) * FRAME, (row + 1) * FRAME)
            )
            bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
            assert bbox, f"{path.name}: empty frame {row},{column}"
            if "normalized" in path.name:
                assert bbox[3] <= BASELINE + 1, f"{path.name}: frame exceeds baseline {row},{column}"
            assert bbox[0] >= 0 and bbox[2] <= FRAME, f"{path.name}: frame clipped {row},{column}"


def test_portrait(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    assert image.width >= 512 and image.height >= 512, f"{path.name}: portrait too small"
    corners = [image.getpixel((0, 0))[3], image.getpixel((image.width - 1, 0))[3]]
    assert max(corners) == 0, f"{path.name}: chroma background was not removed"


def main() -> None:
    for name in SHEETS:
        test_sheet(ROOT / "assets" / "sprites" / name)
    for name in PORTRAITS:
        test_portrait(ROOT / "assets" / "portraits" / name)
    print("Character asset protocol passed for five playable characters")


if __name__ == "__main__":
    main()
