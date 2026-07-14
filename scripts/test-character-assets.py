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


def test_m02a_idle_alignment(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    centers = []
    baselines = []
    top_margins = []
    for column in range(8):
        frame = image.crop((column * FRAME, 0, (column + 1) * FRAME, FRAME))
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        assert bbox, f"{path.name}: empty idle frame {column}"
        centers.append((bbox[0] + bbox[2]) / 2)
        baselines.append(bbox[3])
        top_margins.append(bbox[1])
    assert max(centers) - min(centers) <= 1, f"{path.name}: idle frames drift horizontally"
    assert max(baselines) - min(baselines) == 0, f"{path.name}: idle baselines drift"
    assert min(top_margins) >= 8, f"{path.name}: idle head touches the frame edge"


def test_runtime_enemy_grid(path: Path, frame_width: int, frame_height: int, columns: int, rows: int) -> None:
    image = Image.open(path).convert("RGBA")
    assert image.size == (frame_width * columns, frame_height * rows), f"{path.name}: invalid runtime grid"
    for row in range(rows):
        for column in range(columns):
            frame = image.crop((column * frame_width, row * frame_height, (column + 1) * frame_width, (row + 1) * frame_height))
            bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
            assert bbox, f"{path.name}: empty frame {row},{column}"
            assert bbox[0] >= 4 and bbox[1] >= 4, f"{path.name}: frame touches top/left edge {row},{column} {bbox}"
            assert bbox[2] <= frame_width - 4 and bbox[3] <= frame_height - 4, f"{path.name}: frame touches bottom/right edge {row},{column} {bbox}"


def main() -> None:
    for name in SHEETS:
        test_sheet(ROOT / "assets" / "sprites" / name)
    for name in PORTRAITS:
        test_portrait(ROOT / "assets" / "portraits" / name)
    test_regenerated_jiangxun(ROOT / "assets" / "sprites" / "jiangxun-sprites-v8-lina-edge.png")
    test_ayu_unarmed_walk_and_seated_transform(
        ROOT / "assets" / "sprites" / "ayu-sprites-v17-unarmed-walk-seat-lina-edge.png"
    )
    for name in (
        "ch1-m02a-mumu-sprites-v13-efv.png",
        "ch1-m02a-xiaozhu-sprites-v13-efv.png",
    ):
        test_m02a_idle_alignment(ROOT / "assets" / "game" / "characters" / "npcs" / name)
    enemy_dir = ROOT / "assets" / "game" / "enemies" / "animated"
    test_runtime_enemy_grid(enemy_dir / "ch1-m03-garden-patrol-atlas-v3.png", 147, 147, 8, 8)
    test_runtime_enemy_grid(enemy_dir / "ch1-m03-moon-orchid-rare-sheet-v3.png", 196, 147, 6, 8)
    test_runtime_enemy_grid(enemy_dir / "ch1-m03-carnivora-boss-sheet-v3.png", 196, 168, 6, 7)
    test_runtime_enemy_grid(enemy_dir / "ch1-m04-quantum-family-atlas-v2.png", 147, 147, 8, 8)
    test_runtime_enemy_grid(enemy_dir / "ch1-m04-blockchain-family-atlas-v3.png", 147, 147, 8, 8)
    test_runtime_enemy_grid(enemy_dir / "ch1-m04-aiagent-family-atlas-v3.png", 168, 147, 7, 8)
    test_runtime_enemy_grid(
        ROOT / "assets" / "game" / "bosses" / "m04-structural-instability-boss-sheet-v2.png",
        147,
        168,
        8,
        7,
    )
    print("Character asset protocol passed for five playable characters")


if __name__ == "__main__":
    main()
