from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "chapter1" / "vfx" / "source" / "ch1-map-transfer-ring-imagegen-raw-v2.png"
OUT = ROOT / "assets" / "chapter1" / "vfx" / "ch1-map-transfer-ring-sheet-v1.png"
FRAME = 128
FRAMES = 4
SCALES = [0.9, 1.05, 1.16, 1.0]
ROTATIONS = [-4, 2, 7, 0]


def remove_checker_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    rgba = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    src = rgb.load()
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b = src[x, y]
            spread = max(r, g, b) - min(r, g, b)
            white_distance = max(0, 255 - min(r, g, b))
            chroma_distance = max(0, spread - 10)
            alpha = min(230, max(0, white_distance * 5 + chroma_distance * 3 - 22))
            if alpha <= 6:
                px[x, y] = (0, 0, 0, 0)
                continue
            if b >= g >= r:
                px[x, y] = (82, 238, 255, alpha)
            elif r > 235 and g > 210:
                px[x, y] = (255, 226, 118, alpha)
            else:
                px[x, y] = (160, 246, 255, alpha)
    return rgba


def fit_frame(frame: Image.Image, scale: float, rotation: float) -> Image.Image:
    keyed = remove_checker_background(frame)
    bbox = keyed.getbbox()
    if bbox:
        keyed = keyed.crop(bbox)
    alpha = keyed.getchannel("A").filter(ImageFilter.GaussianBlur(0.4))
    keyed.putalpha(alpha)
    target_w = round(FRAME * 0.9 * scale)
    target_h = round(target_w * keyed.height / max(1, keyed.width))
    target_h = min(round(FRAME * 0.72), max(1, target_h))
    resized = keyed.resize((target_w, target_h), Image.Resampling.LANCZOS)
    rotated = resized.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    out.alpha_composite(rotated, ((FRAME - rotated.width) // 2, (FRAME - rotated.height) // 2))
    return out


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    raw = Image.open(RAW).convert("RGB")
    sheet = Image.new("RGBA", (FRAME * FRAMES, FRAME), (0, 0, 0, 0))
    segment_w = raw.width / FRAMES
    for index in range(FRAMES):
        x1 = round(index * segment_w)
        x2 = round((index + 1) * segment_w)
        frame = raw.crop((x1, 0, x2, raw.height))
        sheet.alpha_composite(fit_frame(frame, SCALES[index], ROTATIONS[index]), (index * FRAME, 0))
    sheet.save(OUT)
    print(OUT.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
