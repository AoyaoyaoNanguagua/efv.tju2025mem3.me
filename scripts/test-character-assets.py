from pathlib import Path
from hashlib import sha256

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
FRAME = 147
BASELINE = 140
REQUIRED_COLUMNS = [4, 6, 4, 4, 6, 8, 4, 6]
SHEETS = [
    "lina-sprites-v10-anchored-expanded.png",
    "ayu-sprites-v17-unarmed-walk-seat-lina-edge.png",
    "zhixia-sprites-v6-cat-alpha.png",
    "laodeng-sprites-v7-lina-edge.png",
    "jiangxun-sprites-v8-lina-edge.png",
]
PORTRAITS = [
    "ayu-q-v2.png",
    "zhixia.png",
    "laodeng-q-v2.png",
    "jiangxun-q-v2.png",
]
TRANSPARENT_PORTRAITS = {"ayu-q-v2.png", "laodeng-q-v2.png", "jiangxun-q-v2.png"}
BASELINE_LOCKED = {
    "ayu-sprites-v17-unarmed-walk-seat-lina-edge.png",
    "zhixia-sprites-v6-cat-alpha.png",
    "laodeng-sprites-v7-lina-edge.png",
    "jiangxun-sprites-v8-lina-edge.png",
}


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
            if path.name in BASELINE_LOCKED:
                assert bbox[3] <= BASELINE + 1, f"{path.name}: frame exceeds baseline {row},{column}"
            assert bbox[0] >= 0 and bbox[2] <= FRAME, f"{path.name}: frame clipped {row},{column}"


def test_portrait(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    assert image.width >= 512 and image.height >= 512, f"{path.name}: portrait too small"
    corners = [image.getpixel((0, 0))[3], image.getpixel((image.width - 1, 0))[3]]
    if path.name in TRANSPARENT_PORTRAITS:
        assert max(corners) == 0, f"{path.name}: chroma background was not removed"


def test_regenerated_jiangxun(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    corners = [
        image.getpixel((0, 0))[3],
        image.getpixel((image.width - 1, 0))[3],
        image.getpixel((0, image.height - 1))[3],
        image.getpixel((image.width - 1, image.height - 1))[3],
    ]
    assert max(corners) == 0, "jiangxun: sheet corners must stay transparent"

    # The seven generated run phases must not collapse into a floating clone.
    run_hashes = set()
    for column in range(7):
        frame = image.crop((column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        run_hashes.add(sha256(frame.tobytes()).hexdigest())
    assert len(run_hashes) >= 6, "jiangxun: cat run needs distinct four-leg motion phases"

    opaque_pixels = [pixel for pixel in image.getdata() if pixel[3] >= 16]
    magenta_fringe = sum(1 for red, green, blue, _ in opaque_pixels if red > 180 and blue > 180 and green < 80)
    assert magenta_fringe < 24, f"jiangxun: chroma fringe remains ({magenta_fringe} pixels)"


def test_ayu_unarmed_walk_and_seated_transform(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    for column in range(8):
        frame = image.crop((column * FRAME, FRAME, (column + 1) * FRAME, 2 * FRAME))
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        assert bbox and bbox[0] >= 4 and bbox[2] <= FRAME - 4, (
            f"ayu: walk frame must keep both hands inside safe margins ({column}, {bbox})"
        )
    seated = image.crop((5 * FRAME, 5 * FRAME, 6 * FRAME, 6 * FRAME))
    final_transform = image.crop((7 * FRAME, 5 * FRAME, 8 * FRAME, 6 * FRAME))
    assert sha256(seated.tobytes()).digest() == sha256(final_transform.tobytes()).digest(), (
        "ayu: transform must end on the seated cat pose"
    )


def main() -> None:
    for name in SHEETS:
        test_sheet(ROOT / "assets" / "sprites" / name)
    for name in PORTRAITS:
        test_portrait(ROOT / "assets" / "portraits" / name)
    test_regenerated_jiangxun(ROOT / "assets" / "sprites" / "jiangxun-sprites-v8-lina-edge.png")
    test_ayu_unarmed_walk_and_seated_transform(
        ROOT / "assets" / "sprites" / "ayu-sprites-v17-unarmed-walk-seat-lina-edge.png"
    )
    print("Character asset protocol passed for five playable characters")


if __name__ == "__main__":
    main()
