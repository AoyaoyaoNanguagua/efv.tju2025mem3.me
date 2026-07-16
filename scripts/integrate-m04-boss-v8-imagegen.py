from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHROMA_HELPER = Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
FRAME_WIDTH = 320
FRAME_HEIGHT = 360
FRAME_COUNT = 8

OUTPUTS = {
    "professor_transition": (
        ROOT / "assets/game/bosses/m04-professor-to-phase1-transition-v8.png",
        304,
        326,
        340,
    ),
    "phase1_transition": (
        ROOT / "assets/game/bosses/m04-phase1-to-phase2-transition-v8.png",
        308,
        326,
        340,
    ),
    "phase2_transition": (
        ROOT / "assets/game/bosses/m04-phase2-to-phase3-transition-v8.png",
        308,
        310,
        336,
    ),
    "phase1_walk": (
        ROOT / "assets/game/bosses/m04-phase1-walk-cycle-v8.png",
        300,
        326,
        340,
    ),
    "phase2_walk": (
        ROOT / "assets/game/bosses/m04-phase2-walk-cycle-v8.png",
        304,
        326,
        340,
    ),
    "phase3_walk": (
        ROOT / "assets/game/bosses/m04-phase3-walk-cycle-v8.png",
        308,
        286,
        334,
    ),
}


def alpha_bbox(image: Image.Image, cutoff: int = 12) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").point(lambda value: 255 if value >= cutoff else 0).getbbox()
    if bbox is None:
        raise ValueError("IMAGE-generated grid cell has no visible boss subject")
    return bbox


def grid_cell(image: Image.Image, index: int) -> Image.Image:
    column = index % 4
    row = index // 4
    left = round(column * image.width / 4)
    right = round((column + 1) * image.width / 4)
    top = round(row * image.height / 2)
    bottom = round((row + 1) * image.height / 2)
    cell = image.crop((left, top, right, bottom))
    # IMAGE sometimes paints a narrow white divider exactly on contact-sheet
    # boundaries. The generated subjects all keep much larger safe margins.
    inset = min(10, max(2, min(cell.size) // 42))
    return cell.crop((inset, inset, cell.width - inset, cell.height - inset))


def remove_chroma(source: Path, destination: Path) -> None:
    subprocess.run(
        [
            "python",
            str(CHROMA_HELPER),
            "--input",
            str(source),
            "--out",
            str(destination),
            "--key-color",
            "#00ff00",
            "--soft-matte",
            "--transparent-threshold",
            "10",
            "--opaque-threshold",
            "220",
            "--despill",
            "--edge-contract",
            "1",
            "--force",
        ],
        check=True,
    )


def build_strip(
    source: Path,
    destination: Path,
    max_width: int,
    max_height: int,
    baseline: int,
) -> None:
    with tempfile.TemporaryDirectory(prefix="efv-m04-v8-") as temp_dir:
        alpha_path = Path(temp_dir) / "alpha.png"
        remove_chroma(source, alpha_path)
        with Image.open(alpha_path) as opened:
            alpha_grid = opened.convert("RGBA")

    subjects = []
    for index in range(FRAME_COUNT):
        cell = grid_cell(alpha_grid, index)
        subjects.append(cell.crop(alpha_bbox(cell)))

    # One scale for the complete sequence preserves the intended growth during
    # transformations and prevents walk frames from breathing in size.
    scale = min(
        max_width / max(subject.width for subject in subjects),
        max_height / max(subject.height for subject in subjects),
    )
    strip = Image.new("RGBA", (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, subject in enumerate(subjects):
        resized = subject.resize(
            (
                max(1, round(subject.width * scale)),
                max(1, round(subject.height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
        x = round((FRAME_WIDTH - resized.width) / 2)
        y = baseline - resized.height
        if x < 4 or y < 4 or x + resized.width > FRAME_WIDTH - 4 or y + resized.height > FRAME_HEIGHT - 4:
            raise RuntimeError(f"Unsafe normalized frame {destination.name} #{index}: {(x, y, resized.size)}")
        frame.alpha_composite(resized, (x, y))
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))

    destination.parent.mkdir(parents=True, exist_ok=True)
    strip.save(destination, optimize=True)
    print(destination.relative_to(ROOT))


def main() -> None:
    parser = argparse.ArgumentParser(description="Integrate IMAGE-generated M04 boss transformations and walk cycles.")
    for key in OUTPUTS:
        parser.add_argument(f"--{key.replace('_', '-')}", dest=key, type=Path, required=True)
    args = parser.parse_args()

    for key, (destination, max_width, max_height, baseline) in OUTPUTS.items():
        source = getattr(args, key)
        if not source.exists():
            raise FileNotFoundError(source)
        build_strip(source, destination, max_width, max_height, baseline)


if __name__ == "__main__":
    main()
