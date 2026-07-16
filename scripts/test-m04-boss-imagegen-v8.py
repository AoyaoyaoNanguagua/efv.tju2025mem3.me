from __future__ import annotations

from hashlib import sha256
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
BOSS_DIR = ROOT / "assets/game/bosses"
FRAME_WIDTH = 320
FRAME_HEIGHT = 360
FRAME_COUNT = 8

TRANSITIONS = (
    "m04-professor-to-phase1-transition-v8.png",
    "m04-phase1-to-phase2-transition-v8.png",
    "m04-phase2-to-phase3-transition-v8.png",
)
WALKS = (
    "m04-phase1-walk-cycle-v8.png",
    "m04-phase2-walk-cycle-v8.png",
    "m04-phase3-walk-cycle-v8.png",
)


def frames(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    assert image.size == (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), f"{path.name}: invalid strip size"
    return [
        image.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
        for index in range(FRAME_COUNT)
    ]


def assert_safe_and_clean(path: Path, animation_frames: list[Image.Image]) -> None:
    hashes = set()
    for index, frame in enumerate(animation_frames):
        hashes.add(sha256(frame.tobytes()).hexdigest())
        bbox = frame.getchannel("A").point(lambda value: 255 if value >= 12 else 0).getbbox()
        assert bbox, f"{path.name}: empty frame {index}"
        assert bbox[0] >= 4 and bbox[1] >= 4, f"{path.name}: top/left clipping in frame {index}: {bbox}"
        assert bbox[2] <= FRAME_WIDTH - 4 and bbox[3] <= FRAME_HEIGHT - 4, (
            f"{path.name}: bottom/right clipping in frame {index}: {bbox}"
        )
        chroma_spill = sum(
            1
            for red, green, blue, alpha in frame.getdata()
            if alpha >= 24 and green >= 140 and green > red * 1.45 and green > blue * 1.45
        )
        assert chroma_spill <= 2, f"{path.name}: green-screen spill remains in frame {index}"
    assert len(hashes) == FRAME_COUNT, f"{path.name}: all eight IMAGE frames must be distinct"


def lower_body_difference(left: Image.Image, right: Image.Image) -> int:
    left_band = left.crop((0, 170, FRAME_WIDTH, FRAME_HEIGHT))
    right_band = right.crop((0, 170, FRAME_WIDTH, FRAME_HEIGHT))
    difference = ImageChops.difference(left_band, right_band)
    return sum(1 for pixel in difference.getdata() if any(pixel))


def main() -> None:
    for name in (*TRANSITIONS, *WALKS):
        path = BOSS_DIR / name
        assert path.exists(), f"missing {path}"
        animation_frames = frames(path)
        assert_safe_and_clean(path, animation_frames)

    professor = frames(BOSS_DIR / TRANSITIONS[0])
    professor_heights = [frame.getchannel("A").getbbox()[3] - frame.getchannel("A").getbbox()[1] for frame in professor]
    assert professor_heights[-1] - professor_heights[0] >= 55, "Professor-to-boss animation must visibly gain mass"

    collapse = frames(BOSS_DIR / TRANSITIONS[2])
    collapse_heights = [frame.getchannel("A").getbbox()[3] - frame.getchannel("A").getbbox()[1] for frame in collapse]
    assert collapse_heights[0] - collapse_heights[-1] >= 100, "Phase 2-to-3 animation must visibly collapse into the feral form"

    for name in WALKS:
        path = BOSS_DIR / name
        animation_frames = frames(path)
        differences = [
            lower_body_difference(animation_frames[index], animation_frames[(index + 1) % FRAME_COUNT])
            for index in range(FRAME_COUNT)
        ]
        assert min(differences) >= 15000, f"{name}: legs/claws do not change enough between adjacent walk frames"

    print("M04 IMAGE-generated transformations and three readable walk cycles passed")


if __name__ == "__main__":
    main()
