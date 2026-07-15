from pathlib import Path
from hashlib import sha256

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
FRAME = 147
BASELINE = 140
REQUIRED_COLUMNS = [4, 6, 4, 4, 6, 8, 4, 6]
SHEETS = [
    "lina-sprites-v10-anchored-expanded.png",
    "ayu-sprites-v19-redrawn-walk-cat-end.png",
    "zhixia/zhixia-sprites-final.png",
    "laodeng-sprites-v9-redrawn-cat-run.png",
    "jiangxun-sprites-v10-redrawn-cat-motion.png",
]
PORTRAITS = [
    "ayu-q-v2.png",
    "zhixia.png",
    "laodeng-q-v2.png",
    "jiangxun-q-v2.png",
]
TRANSPARENT_PORTRAITS = {"ayu-q-v2.png", "laodeng-q-v2.png", "jiangxun-q-v2.png"}
BASELINE_LOCKED = {
    "ayu-sprites-v19-redrawn-walk-cat-end.png",
    "zhixia-sprites-final.png",
    "laodeng-sprites-v9-redrawn-cat-run.png",
    "jiangxun-sprites-v10-redrawn-cat-motion.png",
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

    # The eight generated run phases must not collapse into a floating clone.
    run_hashes = set()
    run_heights = []
    for column in range(8):
        frame = image.crop((column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        run_hashes.add(sha256(frame.tobytes()).hexdigest())
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
        assert bbox
        run_heights.append(bbox[3] - bbox[1])
    assert len(run_hashes) == 8, "jiangxun: cat run needs eight distinct four-leg motion phases"
    idle = image.crop((7 * FRAME, 5 * FRAME, 8 * FRAME, 6 * FRAME))
    idle_bbox = idle.getchannel("A").point(lambda value: 255 if value >= 16 else 0).getbbox()
    assert idle_bbox
    idle_height = idle_bbox[3] - idle_bbox[1]
    assert abs(idle_height - sum(run_heights) / len(run_heights)) <= 14, (
        "jiangxun: standing transform endpoint and run cycle must keep matching cat scale"
    )

    opaque_pixels = [pixel for pixel in image.getdata() if pixel[3] >= 16]
    magenta_fringe = sum(1 for red, green, blue, _ in opaque_pixels if red > 180 and blue > 180 and green < 80)
    assert magenta_fringe < 24, f"jiangxun: chroma fringe remains ({magenta_fringe} pixels)"


def test_ayu_unarmed_walk_and_seated_transform(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    walk_hashes = set()
    for column in range(8):
        frame = image.crop((column * FRAME, FRAME, (column + 1) * FRAME, 2 * FRAME))
        walk_hashes.add(sha256(frame.tobytes()).hexdigest())
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        assert bbox and bbox[0] >= 4 and bbox[2] <= FRAME - 4, (
            f"ayu: walk frame must keep both hands inside safe margins ({column}, {bbox})"
        )
    assert len(walk_hashes) == 8, "ayu: redrawn walk row needs eight distinct alternating paw phases"
    final_transform = image.crop((7 * FRAME, 5 * FRAME, 8 * FRAME, 6 * FRAME))
    final_bbox = final_transform.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
    run_heights = []
    for column in range(4):
        run = image.crop((column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        bbox = run.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        assert bbox
        run_heights.append(bbox[3] - bbox[1])
    assert final_bbox
    assert final_bbox[3] - final_bbox[1] <= max(run_heights) * 1.12, (
        "ayu: transform final cat face/body is too large for the cat-run transition"
    )
    assert final_bbox[0] >= 4 and final_bbox[2] <= FRAME - 4, "ayu: final cat endpoint is clipped"


def test_cat_motion_repairs(sprite_dir: Path) -> None:
    laodeng = Image.open(sprite_dir / "laodeng-sprites-v9-redrawn-cat-run.png").convert("RGBA")
    run_hashes = set()
    for column in range(8):
        frame = laodeng.crop((column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        run_hashes.add(sha256(frame.tobytes()).hexdigest())
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 8 else 0).getbbox()
        assert bbox and bbox[0] >= 3 and bbox[1] >= 3 and bbox[2] <= FRAME - 3, (
            f"laodeng: cat-run face/body is clipped in frame {column}: {bbox}"
        )
    assert len(run_hashes) == 8, "laodeng: regenerated cat run needs eight distinct quadruped phases"

    zhixia = Image.open(sprite_dir / "zhixia/zhixia-sprites-final.png").convert("RGBA")
    walk_hashes = set()
    foot_centers = []
    for column in range(8):
        frame = zhixia.crop((column * FRAME, FRAME, (column + 1) * FRAME, 2 * FRAME))
        walk_hashes.add(sha256(frame.tobytes()).hexdigest())
        alpha = frame.getchannel("A")
        bbox = alpha.point(lambda value: 255 if value >= 18 else 0).getbbox()
        assert bbox
        pixels = alpha.load()
        occupied_x = [
            x
            for y in range(max(bbox[1], bbox[3] - 30), bbox[3])
            for x in range(FRAME)
            if pixels[x, y] >= 18
        ]
        foot_centers.append(sum(occupied_x) / len(occupied_x))
    assert len(walk_hashes) >= 7, "zhixia: regenerated walk needs distinct motion phases"
    assert max(foot_centers) - min(foot_centers) >= 5, "zhixia: walk feet still do not alternate visibly"
    for column in range(8):
        frame = zhixia.crop((column * FRAME, 6 * FRAME, (column + 1) * FRAME, 7 * FRAME))
        alpha = frame.getchannel("A")
        silhouette = alpha.point(lambda value: 255 if value > 18 else 0)
        core = silhouette.filter(ImageFilter.MinFilter(5))
        alpha_values = list(alpha.getdata())
        core_values = list(core.getdata())
        translucent_core = sum(1 for value, inside in zip(alpha_values, core_values) if inside and value < 248)
        assert translucent_core == 0, f"zhixia: translucent fur interior remains in run frame {column}"


def test_jiangxun_cat_paws(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    for column in range(6):
        frame = image.crop((column * FRAME, FRAME, (column + 1) * FRAME, 2 * FRAME))
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 18 else 0).getbbox()
        assert bbox
        foot_band = frame.crop((bbox[0], max(bbox[1], bbox[3] - 30), bbox[2], bbox[3]))
        pale_paw_pixels = sum(
            1 for red, green, blue, alpha in foot_band.getdata()
            if alpha >= 96 and min(red, green, blue) >= 145 and max(red, green, blue) - min(red, green, blue) <= 65
        )
        assert pale_paw_pixels >= 12, f"jiangxun: walk frame {column} lost the pale cat paws"


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


def test_zhixia_selected_walk_cycle() -> None:
    source = (ROOT / "play.js").read_text(encoding="utf-8")
    assert "const ZHIXIA_WALK_FRAMES = [0, 1, 2, 4, 5, 6]" in source
    assert 'character.id === "zhixia" && action.id === "walk"' in source
    assert "ZHIXIA_WALK_FRAMES.map" in source
    assert "const AYU_WALK_FRAMES = ALL_FRAMES" in source
    assert 'character.id === "ayu" && action.id === "walk"' in source
    assert "AYU_WALK_FRAMES.map" in source


def main() -> None:
    test_zhixia_selected_walk_cycle()
    for name in SHEETS:
        test_sheet(ROOT / "assets" / "sprites" / name)
    for name in PORTRAITS:
        test_portrait(ROOT / "assets" / "portraits" / name)
    test_regenerated_jiangxun(ROOT / "assets" / "sprites" / "jiangxun-sprites-v10-redrawn-cat-motion.png")
    test_jiangxun_cat_paws(ROOT / "assets" / "sprites" / "jiangxun-sprites-v10-redrawn-cat-motion.png")
    test_ayu_unarmed_walk_and_seated_transform(
        ROOT / "assets" / "sprites" / "ayu-sprites-v19-redrawn-walk-cat-end.png"
    )
    test_cat_motion_repairs(ROOT / "assets" / "sprites")
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
        ROOT / "assets" / "game" / "bosses" / "m04-structural-instability-boss-sheet-v3-hd.png",
        224,
        256,
        8,
        9,
    )
    test_runtime_enemy_grid(
        ROOT / "assets" / "game" / "items" / "ch1-boss-reward-chest-sheet-v1.png",
        192,
        144,
        4,
        2,
    )
    print("Character asset protocol passed for five playable characters")


if __name__ == "__main__":
    main()
