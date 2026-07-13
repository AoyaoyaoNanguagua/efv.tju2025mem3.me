from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CHROMA_HELPER = Path.home() / ".codex/skills/.system/imagegen/scripts/remove_chroma_key.py"
OUTPUTS = {
    "garden_patrol": ROOT / "assets/game/enemies/animated/ch1-m03-garden-patrol-atlas-v3.png",
    "moon_orchid": ROOT / "assets/game/enemies/animated/ch1-m03-moon-orchid-rare-sheet-v3.png",
    "carnivora": ROOT / "assets/game/enemies/animated/ch1-m03-carnivora-boss-sheet-v3.png",
    "quantum": ROOT / "assets/game/enemies/animated/ch1-m04-quantum-family-atlas-v2.png",
    "blockchain": ROOT / "assets/game/enemies/animated/ch1-m04-blockchain-family-atlas-v3.png",
    "aiagent": ROOT / "assets/game/enemies/animated/ch1-m04-aiagent-family-atlas-v3.png",
    "structural": ROOT / "assets/game/bosses/m04-structural-instability-boss-sheet-v2.png",
}


def prepare_sheet(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="efv-m34-") as temp_dir:
        resized_path = Path(temp_dir) / "resized.png"
        with Image.open(source) as image:
            image.convert("RGB").resize((1176, 1176), Image.Resampling.LANCZOS).save(resized_path)
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
    parser = argparse.ArgumentParser(description="Prepare M3/M4 animated enemy atlases for EFV.")
    for key in OUTPUTS:
        parser.add_argument(f"--{key.replace('_', '-')}", dest=key, type=Path, required=True)
    args = parser.parse_args()

    for key, target in OUTPUTS.items():
        prepare_sheet(getattr(args, key), target)
        with Image.open(target) as image:
            if image.size != (1176, 1176) or image.mode != "RGBA":
                raise RuntimeError(f"Invalid processed sheet {target}: {image.size} {image.mode}")
            if image.getpixel((0, 0))[3] != 0:
                raise RuntimeError(f"Chroma removal failed at corner for {target}")
        print(target.relative_to(ROOT))


if __name__ == "__main__":
    main()
