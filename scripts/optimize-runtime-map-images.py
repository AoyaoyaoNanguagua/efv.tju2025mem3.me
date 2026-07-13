from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_ROOT = ROOT / "dict/legacy-assets-20260713-loading-audit"

JOBS = [
    ("assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v4-floor-tile.png", None, 90),
    (
        "assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-3072x2048.png",
        (768, 512),
        82,
    ),
    ("assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-v5-3072x2048.png", None, 92),
    ("assets/chapter1/maps/ch1_m01_classroom_spawn/foreground/ch1-m01-wall-overlay-front-v5-3072x2048.png", None, 92),
    ("assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-m02-horizontal-left-v7.png", None, 89),
    ("assets/chapter1/maps/ch1_m02_prompt_archive/background/ch1-m02-horizontal-right-v7.png", None, 89),
    ("assets/chapter1/maps/ch1_m02a_auditorium_branch/background/ch1-m02a-auditorium-bg-v1-3072x2304.png", None, 89),
    ("assets/chapter1/maps/ch1_m03_botanical_garden/background/ch1-m03-botanical-garden-bg-v3.png", None, 89),
    ("assets/chapter1/maps/ch1_m04_structural_mechanics_lab/background/ch1-m04-lab-elbow-v1.png", None, 89),
    ("assets/chapter1/maps/ch1_m04_structural_mechanics_lab/background/ch1-m04-lab-middle-v1.png", None, 89),
    ("assets/chapter1/maps/ch1_m04_structural_mechanics_lab/background/ch1-m04-lab-final-v1.png", None, 89),
    ("assets/chapter1/maps/ch1_m04_structural_mechanics_lab/background/ch1-m04-lab-entrance-v1.png", None, 89),
]


def target_for(source: Path, resize: tuple[int, int] | None) -> Path:
    if resize:
        return source.with_name("ch1-m01-classroom-minimap-runtime-v1.webp")
    return source.with_suffix(".webp")


def main() -> None:
    before = 0
    after = 0
    for relative, resize, quality in JOBS:
        runtime_source = ROOT / relative
        source = runtime_source if runtime_source.exists() else ARCHIVE_ROOT / relative
        target = target_for(runtime_source, resize)
        with Image.open(source) as image:
            source_size = image.size
            converted = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            if resize:
                converted = converted.resize(resize, Image.Resampling.LANCZOS)
            target.parent.mkdir(parents=True, exist_ok=True)
            converted.save(target, "WEBP", quality=quality, method=6, exact=True)
        with Image.open(target) as check:
            expected_size = resize or source_size
            if check.size != expected_size:
                raise RuntimeError(f"Unexpected size for {target}: {check.size}, expected {expected_size}")
        before += source.stat().st_size
        after += target.stat().st_size
        print(f"{target.relative_to(ROOT)}: {source.stat().st_size / 1048576:.2f} -> {target.stat().st_size / 1048576:.2f} MiB")
    print(f"Runtime map images: {before / 1048576:.2f} -> {after / 1048576:.2f} MiB")


if __name__ == "__main__":
    main()
