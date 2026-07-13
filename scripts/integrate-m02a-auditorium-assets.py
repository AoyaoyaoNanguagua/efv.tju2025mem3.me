from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP_ROOT = ROOT / "assets/chapter1/maps/ch1_m02a_auditorium_branch"
NPC_ROOT = ROOT / "assets/game/characters/npcs"
CHROMA_HELPER = Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"


def resize_image(source: Path, target: Path, size: tuple[int, int]) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        resized = image.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
        resized.save(target, optimize=True)


def prepare_sprite_sheet(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="efv-m02a-") as temp_dir:
        resized_path = Path(temp_dir) / "resized.png"
        resize_image(source, resized_path, (1176, 1176))
        subprocess.run(
            [
                "python",
                str(CHROMA_HELPER),
                "--input",
                str(resized_path),
                "--out",
                str(target),
                "--auto-key",
                "border",
                "--soft-matte",
                "--transparent-threshold",
                "12",
                "--opaque-threshold",
                "220",
                "--despill",
                "--edge-contract",
                "1",
                "--force",
            ],
            check=True,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare collaborator auditorium assets for EFV M02-A.")
    parser.add_argument("--background", type=Path, required=True)
    parser.add_argument("--mumu", type=Path, required=True)
    parser.add_argument("--xiaozhu", type=Path, required=True)
    parser.add_argument("--statue", type=Path, required=True)
    args = parser.parse_args()

    resize_image(
        args.background,
        MAP_ROOT / "background/ch1-m02a-auditorium-bg-v1-3072x2304.png",
        (3072, 2304),
    )
    prepare_sprite_sheet(
        args.mumu,
        NPC_ROOT / "ch1-m02a-mumu-sprites-v13-efv.png",
    )
    prepare_sprite_sheet(
        args.xiaozhu,
        NPC_ROOT / "ch1-m02a-xiaozhu-sprites-v13-efv.png",
    )
    statue_target = MAP_ROOT / "props/ch1-m02a-principal-bronze-statue-v1.png"
    statue_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.statue, statue_target)

    for path, expected in [
        (MAP_ROOT / "background/ch1-m02a-auditorium-bg-v1-3072x2304.png", (3072, 2304)),
        (NPC_ROOT / "ch1-m02a-mumu-sprites-v13-efv.png", (1176, 1176)),
        (NPC_ROOT / "ch1-m02a-xiaozhu-sprites-v13-efv.png", (1176, 1176)),
        (statue_target, (147, 147)),
    ]:
        with Image.open(path) as image:
            if image.size != expected:
                raise RuntimeError(f"Unexpected size for {path}: {image.size}, expected {expected}")
            if "sprites" in path.name and image.mode != "RGBA":
                raise RuntimeError(f"Sprite sheet must be RGBA: {path}")
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
