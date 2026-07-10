from __future__ import annotations

import json
from copy import deepcopy
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "assets" / "chapter1" / "maps" / "ch1_m01_classroom_spawn"
SOURCE_DIR = MAP_DIR / "source"
BACKGROUND_DIR = MAP_DIR / "background"
CHUNKS_DIR = MAP_DIR / "chunks"
PROPS_DIR = MAP_DIR / "props"
FOREGROUND_DIR = MAP_DIR / "foreground"

RAW_BASE = SOURCE_DIR / "ch1-m01-imagegen-landscape-clean-base-raw-v4.png"
RAW_FLOOR_TILE = SOURCE_DIR / "ch1-m01-imagegen-floor-tile-raw-v4.png"
RAW_PRIMARY_PROPS = SOURCE_DIR / "ch1-m01-imagegen-landscape-props-raw-v4.png"
RAW_OUTER_PROPS = SOURCE_DIR / "ch1-m01-imagegen-landscape-outer-props-raw-v4.png"
RAW_STRUCTURE_PROPS = SOURCE_DIR / "ch1-m01-imagegen-structure-props-raw-v4.png"
RAW_WINDOW_WALL_8DIR = SOURCE_DIR / "ch1-m01-imagegen-window-wall-8dir-raw-v4.png"
RAW_SIDE_WINDOW_WALL = SOURCE_DIR / "ch1-m01-imagegen-side-window-wall-reference-v4.png"
RAW_PLAIN_WALL_8DIR = SOURCE_DIR / "ch1-m01-imagegen-plain-wall-8dir-raw-v4.png"
RAW_WALL_OVERLAY = SOURCE_DIR / "ch1-m01-imagegen-wall-overlay-dense-raw-v5.png"
REGISTRY_PATH = ROOT / "assets" / "chapter1" / "chapter1-maps-v1.json"
LINA_SPRITE_PATH = ROOT / "assets" / "sprites" / "lina-sprites-v10-anchored-expanded.png"

RUNTIME_W = 3072
RUNTIME_H = 2048
SOURCE_W = 6144
SOURCE_H = 4096
CHUNK_SIZE = 1024
LINA_RUNTIME_HEIGHT = 147
ATLAS_W = 4096
ATLAS_H = 4096

OUT = {
    "marker_master": SOURCE_DIR / "ch1-m01-marker-base-master-6144-v4.png",
    "marker_manifest": SOURCE_DIR / "ch1-m01-marker-manifest-v4.json",
    "base_master": SOURCE_DIR / "ch1-m01-base-master-6144-v4.png",
    "runtime_base": BACKGROUND_DIR / "ch1-map-classroom-spawn-base-v4-3072x2048.png",
    "runtime_assembled": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-v4-3072x2048.png",
    "runtime_qa": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-qa-v4-3072x2048.png",
    "props_master": SOURCE_DIR / "ch1-m01-props-atlas-master-6144-v4.png",
    "props_runtime": PROPS_DIR / "ch1-m01-props-atlas-v4-4096x4096.png",
    "foreground_master": SOURCE_DIR / "ch1-m01-foreground-atlas-master-6144-v4.png",
    "foreground_runtime": FOREGROUND_DIR / "ch1-m01-foreground-atlas-v4-4096x4096.png",
    "wall_overlay_runtime": FOREGROUND_DIR / "ch1-m01-wall-overlay-v5-3072x2048.png",
    "wall_overlay_front_runtime": FOREGROUND_DIR / "ch1-m01-wall-overlay-front-v5-3072x2048.png",
    "placement_manifest": MAP_DIR / "ch1-m01-layered-map-manifest-v4.json",
}

SOURCE_BLOCKS = [
    ("r0-c0", 0, 0),
    ("r0-c1", 2048, 0),
    ("r0-c2", 4096, 0),
    ("r1-c0", 0, 2048),
    ("r1-c1", 2048, 2048),
    ("r1-c2", 4096, 2048),
]

RUNTIME_CHUNKS = [
    ("r0-c0", 0, 0),
    ("r0-c1", 1024, 0),
    ("r0-c2", 2048, 0),
    ("r1-c0", 0, 1024),
    ("r1-c1", 1024, 1024),
    ("r1-c2", 2048, 1024),
]

WALL_COLLISIONS = [
    {"id": "m01_v5_north_wall_body", "x": 370, "y": 275, "w": 2332, "h": 120},
    {"id": "m01_v5_west_wall_body", "x": 285, "y": 300, "w": 220, "h": 1390},
    {"id": "m01_v5_east_wall_body", "x": 2568, "y": 300, "w": 220, "h": 1390},
    {"id": "m01_v5_south_wall_left_body", "x": 365, "y": 1580, "w": 950, "h": 165},
    {"id": "m01_v5_south_wall_right_body", "x": 1760, "y": 1580, "w": 950, "h": 165},
    {"id": "m01_v5_south_gate_left_post", "x": 1302, "y": 1515, "w": 125, "h": 245},
    {"id": "m01_v5_south_gate_right_post", "x": 1645, "y": 1515, "w": 125, "h": 245},
]

FRONT_WALL_RECTS = [
    (340, 1485, 1428, 1805),
    (1644, 1485, 2735, 1805),
]

MARKER_COLORS = {
    "D": (50, 140, 240, 168),
    "P": (245, 182, 55, 176),
    "L": (255, 240, 95, 176),
    "B": (150, 100, 235, 164),
    "F": (76, 190, 110, 164),
    "R": (82, 210, 220, 160),
    "W": (115, 125, 145, 168),
    "T": (68, 170, 86, 168),
    "S": (185, 155, 100, 160),
    "G": (80, 190, 210, 164),
    "N": (245, 110, 140, 168),
    "E": (65, 220, 150, 176),
    "I": (255, 255, 255, 184),
    "C": (255, 90, 80, 152),
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def ensure_dirs() -> None:
    for directory in [SOURCE_DIR, BACKGROUND_DIR, CHUNKS_DIR, PROPS_DIR, FOREGROUND_DIR]:
        directory.mkdir(parents=True, exist_ok=True)


def load_font(size: int) -> ImageFont.ImageFont:
    for candidate in ["C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/msyh.ttc"]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def paste_alpha(canvas: Image.Image, image: Image.Image, xy: tuple[int, int]) -> None:
    canvas.alpha_composite(image.convert("RGBA"), dest=xy)


def save_png(image: Image.Image, path: Path) -> None:
    tmp = path.with_name(f"{path.stem}.tmp.png")
    image.save(tmp)
    tmp.replace(path)


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = px[x, y]
            if a == 0:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def expand_transparency(image: Image.Image, radius: int = 1, passes: int = 1) -> Image.Image:
    rgba = image.convert("RGBA")
    size = max(3, radius * 2 + 1)
    alpha = rgba.getchannel("A")
    for _ in range(max(1, passes)):
        alpha = alpha.filter(ImageFilter.MinFilter(size))
    rgba.putalpha(alpha)
    return clear_transparent_rgb(rgba)


def remove_magenta_bands(image: Image.Image, min_run: int = 24) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    def is_hot(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and g < 45 and r > 140 and b > 135 and r - g > 90 and b - g > 85 and abs(r - b) < 95

    def is_loose(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and g < 92 and r > 105 and b > 100 and r - g > 32 and b - g > 28 and abs(r - b) < 150

    transparent: set[tuple[int, int]] = set()
    for y in range(h):
        start = None
        for x in range(w + 1):
            active = x < w and is_hot(x, y)
            if active and start is None:
                start = x
            if (not active or x == w) and start is not None:
                if x - start >= min_run:
                    transparent.update((rx, y) for rx in range(start, x))
                start = None
    for x in range(w):
        start = None
        for y in range(h + 1):
            active = y < h and is_hot(x, y)
            if active and start is None:
                start = y
            if (not active or y == h) and start is not None:
                if y - start >= min_run:
                    transparent.update((x, ry) for ry in range(start, y))
                start = None

    for _ in range(3):
        extra: set[tuple[int, int]] = set()
        for x, y in transparent:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in transparent and is_loose(nx, ny):
                    extra.add((nx, ny))
        transparent.update(extra)

    for x, y in transparent:
        px[x, y] = (0, 0, 0, 0)
    return clear_transparent_rgb(rgba)


def add_contact_shadow(asset: Image.Image, spec: dict) -> Image.Image:
    rgba = asset.convert("RGBA")
    w, h = rgba.size
    collision = spec.get("collision")
    if collision:
        cw, ch = collision
        shadow_w = min(w * 0.92, max(cw * 1.18, w * 0.42))
        shadow_h = min(max(ch * 1.05, 22), max(h * 0.16, 28))
    else:
        shadow_w = w * 0.62
        shadow_h = max(18, h * 0.12)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow, "RGBA")
    cx = w / 2
    bottom = h - max(6, min(18, h * 0.04))
    ellipse = (
        round(cx - shadow_w / 2),
        round(bottom - shadow_h),
        round(cx + shadow_w / 2),
        round(bottom + shadow_h * 0.18),
    )
    alpha = 58 if spec.get("type", "").startswith(("window-wall", "plain-wall")) else 72
    draw.ellipse(ellipse, fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(3, round(shadow_h * 0.16))))
    shadow.alpha_composite(rgba)
    return clear_transparent_rgb(shadow)


def remove_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    def is_key_like(x: int, y: int, loose: bool = False) -> bool:
        r, g, b, _a = px[x, y]
        if loose:
            return r > 118 and b > 108 and g < 168 and r - g > 24 and b - g > 14 and abs(r - b) < 150
        return r > 176 and b > 168 and g < 132 and r - g > 54 and b - g > 48 and abs(r - b) < 112

    transparent = set()
    stack: list[tuple[int, int]] = []
    for x in range(w):
        for y in (0, h - 1):
            if is_key_like(x, y):
                stack.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_key_like(x, y):
                stack.append((x, y))

    while stack:
        x, y = stack.pop()
        if (x, y) in transparent or not is_key_like(x, y):
            continue
        transparent.add((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in transparent and is_key_like(nx, ny):
                stack.append((nx, ny))

    for _ in range(10):
        extra = set()
        for x, y in transparent:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in transparent and is_key_like(nx, ny, loose=True):
                    extra.add((nx, ny))
        transparent.update(extra)

    for x, y in transparent:
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
    return rgba


def crop_asset(raw: Image.Image, box: tuple[int, int, int, int], pad: int = 8) -> Image.Image:
    x1, y1, x2, y2 = box
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(raw.width, x2 + pad)
    y2 = min(raw.height, y2 + pad)
    crop = remove_magenta(raw.crop((x1, y1, x2, y2)))
    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)
    out = Image.new("RGBA", (crop.width + pad * 2, crop.height + pad * 2), (0, 0, 0, 0))
    paste_alpha(out, crop, (pad, pad))
    return clear_transparent_rgb(out)


def draw_text_backplate(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont) -> None:
    x, y = xy
    bbox = draw.textbbox((x, y), text, font=font)
    pad = 8
    draw.rounded_rectangle(
        (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad),
        radius=8,
        fill=(10, 18, 30, 210),
        outline=(255, 230, 145, 220),
        width=2,
    )
    draw.text((x, y), text, fill=(255, 246, 214, 255), font=font)


ASSET_SPECS = [
    # Primary prop sheet
    {"id": "m01_desk_a_v4", "marker": "D01", "type": "desk/table", "source": "primary", "box": (49, 46, 346, 268), "target": (270, 205), "collision": (250, 104)},
    {"id": "m01_desk_b_v4", "marker": "D02", "type": "desk/table", "source": "primary", "box": (403, 46, 704, 268), "target": (270, 205), "collision": (250, 104)},
    {"id": "m01_desk_c_v4", "marker": "D03", "type": "desk/table", "source": "primary", "box": (756, 46, 1045, 268), "target": (270, 205), "collision": (250, 104)},
    {"id": "m01_desk_d_v4", "marker": "D04", "type": "desk/table", "source": "primary", "box": (1105, 46, 1394, 268), "target": (270, 205), "collision": (250, 104)},
    {"id": "m01_lamp_a_v4", "marker": "L01", "type": "lamp/light", "source": "primary", "box": (404, 288, 507, 546), "target": (96, 210), "collision": (60, 42)},
    {"id": "m01_lamp_b_v4", "marker": "L02", "type": "lamp/light", "source": "primary", "box": (579, 288, 683, 546), "target": (96, 210), "collision": (60, 42)},
    {"id": "m01_protocol_podium_v4", "marker": "P01", "type": "podium/platform", "source": "primary", "box": (99, 300, 290, 518), "target": (230, 240), "collision": (205, 65)},
    {"id": "m01_bookshelf_a_v4", "marker": "B01", "type": "bookshelf/cabinet", "source": "primary", "box": (822, 304, 1052, 560), "target": (210, 230), "collision": (185, 55)},
    {"id": "m01_bookshelf_b_v4", "marker": "B02", "type": "bookshelf/cabinet", "source": "primary", "box": (1129, 308, 1355, 558), "target": (210, 230), "collision": (185, 55)},
    {"id": "m01_banner_a_v4", "marker": "N02", "type": "notice/sign", "source": "primary", "box": (1248, 568, 1352, 818), "target": (82, 190), "collision": None},
    {"id": "m01_banner_b_v4", "marker": "N03", "type": "notice/sign", "source": "primary", "box": (1390, 568, 1494, 818), "target": (82, 190), "collision": None},
    {"id": "m01_notice_board_v4", "marker": "N01", "type": "notice/sign", "source": "primary", "box": (776, 584, 1000, 774), "target": (190, 155), "collision": (150, 42)},
    {"id": "m01_globe_v4", "marker": "G01", "type": "globe/decor", "source": "primary", "box": (1066, 597, 1194, 795), "target": (118, 150), "collision": (72, 42)},
    {"id": "m01_planter_a_v4", "marker": "F01", "type": "flower/planter", "source": "primary", "box": (54, 603, 344, 737), "target": (350, 160), "collision": (330, 48)},
    {"id": "m01_planter_b_v4", "marker": "F02", "type": "flower/planter", "source": "primary", "box": (408, 601, 682, 738), "target": (350, 160), "collision": (330, 48)},
    {"id": "m01_rail_long_v4", "marker": "R01", "type": "rail/boundary prop", "source": "primary", "box": (55, 821, 478, 969), "target": (420, 145), "collision": (390, 44)},
    {"id": "m01_rail_short_v4", "marker": "R02", "type": "rail/boundary prop", "source": "primary", "box": (522, 835, 760, 967), "target": (255, 135), "collision": (225, 40)},
    {"id": "m01_bookpile_a_v4", "marker": "I05", "type": "interaction node", "source": "primary", "box": (1139, 846, 1276, 976), "target": (120, 115), "collision": (95, 34)},
    {"id": "m01_bookpile_b_v4", "marker": "I06", "type": "interaction node", "source": "primary", "box": (1326, 848, 1440, 985), "target": (120, 115), "collision": (95, 34)},
    # Outer/blocker sheet
    {"id": "m01_blackboard_a_v4", "marker": "N04", "type": "notice/sign", "source": "outer", "box": (47, 21, 469, 273), "target": (520, 300), "collision": (460, 64)},
    {"id": "m01_blackboard_b_v4", "marker": "N05", "type": "notice/sign", "source": "outer", "box": (510, 22, 920, 273), "target": (520, 300), "collision": (460, 64)},
    {"id": "m01_window_wall_n_v4", "marker": "W10", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "N", "source": "window8", "box": (0, 170, 420, 470), "target": (820, 280), "collision": (760, 72)},
    {"id": "m01_window_wall_ne_v4", "marker": "W11", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "NE", "source": "window8", "box": (410, 85, 770, 500), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_window_wall_e_v4", "marker": "W12", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "E", "source": "sidewall", "box": (0, 0, 768, 2048), "target": (250, 1200), "collision": (82, 1120), "flipX": True},
    {"id": "m01_window_wall_se_v4", "marker": "W13", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "SE", "source": "window8", "box": (965, 110, 1254, 510), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_window_wall_s_v4", "marker": "W14", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "S", "source": "window8", "box": (560, 815, 980, 1135), "target": (820, 280), "collision": (760, 72)},
    {"id": "m01_window_wall_sw_v4", "marker": "W15", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "SW", "source": "window8", "box": (255, 740, 590, 1140), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_window_wall_w_v4", "marker": "W16", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "W", "source": "sidewall", "box": (0, 0, 768, 2048), "target": (250, 1200), "collision": (82, 1120)},
    {"id": "m01_window_wall_nw_v4", "marker": "W17", "type": "window-wall/high-boundary", "family": "window_wall", "direction": "NW", "source": "window8", "box": (985, 735, 1254, 1145), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_plain_wall_n_v4", "marker": "PW10", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "N", "source": "plainwall", "box": (20, 250, 430, 430), "target": (820, 260), "collision": (760, 72)},
    {"id": "m01_plain_wall_ne_v4", "marker": "PW11", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "NE", "source": "plainwall", "box": (430, 95, 735, 505), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_plain_wall_e_v4", "marker": "PW12", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "E", "source": "plainwall", "box": (775, 35, 910, 535), "target": (250, 1200), "collision": (82, 1120), "trim": (12, 0, 12, 0)},
    {"id": "m01_plain_wall_se_v4", "marker": "PW13", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "SE", "source": "plainwall", "box": (985, 95, 1245, 515), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_plain_wall_s_v4", "marker": "PW14", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "S", "source": "plainwall", "box": (565, 875, 970, 1135), "target": (820, 260), "collision": (760, 72)},
    {"id": "m01_plain_wall_sw_v4", "marker": "PW15", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "SW", "source": "plainwall", "box": (255, 730, 600, 1145), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_plain_wall_w_v4", "marker": "PW16", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "W", "source": "plainwall", "box": (55, 630, 185, 1150), "target": (250, 1200), "collision": (82, 1120), "trim": (12, 0, 12, 0)},
    {"id": "m01_plain_wall_nw_v4", "marker": "PW17", "type": "plain-wall/high-boundary", "family": "plain_wall", "direction": "NW", "source": "plainwall", "box": (980, 725, 1245, 1148), "target": (560, 430), "collision": (430, 76)},
    {"id": "m01_wall_long_v4", "marker": "W01", "type": "rail/boundary prop", "source": "outer", "box": (970, 87, 1404, 203), "target": (520, 140), "collision": (480, 55)},
    {"id": "m01_wall_short_v4", "marker": "W02", "type": "rail/boundary prop", "source": "outer", "box": (998, 284, 1282, 403), "target": (330, 138), "collision": (300, 55)},
    {"id": "m01_wall_vertical_v4", "marker": "W03", "type": "rail/boundary prop", "source": "outer", "box": (1388, 229, 1438, 440), "target": (80, 260), "collision": (46, 220)},
    {"id": "m01_screen_a_v4", "marker": "R03", "type": "rail/boundary prop", "source": "outer", "box": (64, 307, 255, 468), "target": (210, 180), "collision": (180, 44)},
    {"id": "m01_screen_b_v4", "marker": "R04", "type": "rail/boundary prop", "source": "outer", "box": (292, 307, 439, 469), "target": (190, 180), "collision": (160, 44)},
    {"id": "m01_bench_a_v4", "marker": "S01", "type": "bench/seat", "source": "outer", "box": (500, 335, 696, 451), "target": (250, 130), "collision": (225, 42)},
    {"id": "m01_bench_b_v4", "marker": "S02", "type": "bench/seat", "source": "outer", "box": (743, 335, 938, 451), "target": (250, 130), "collision": (225, 42)},
    {"id": "m01_tree_a_v4", "marker": "T01", "type": "tree/greenery", "source": "outer", "box": (25, 480, 263, 799), "target": (255, 340), "collision": (155, 58)},
    {"id": "m01_tree_b_v4", "marker": "T02", "type": "tree/greenery", "source": "outer", "box": (301, 478, 441, 796), "target": (190, 340), "collision": (115, 54)},
    {"id": "m01_tree_c_v4", "marker": "T03", "type": "tree/greenery", "source": "outer", "box": (473, 499, 660, 798), "target": (220, 330), "collision": (130, 56)},
    {"id": "m01_shrub_a_v4", "marker": "F03", "type": "flower/planter", "source": "outer", "box": (708, 493, 897, 613), "target": (220, 135), "collision": (190, 42)},
    {"id": "m01_shrub_b_v4", "marker": "F04", "type": "flower/planter", "source": "outer", "box": (952, 502, 1092, 605), "target": (170, 120), "collision": (145, 38)},
    {"id": "m01_shrub_c_v4", "marker": "F05", "type": "flower/planter", "source": "outer", "box": (1149, 514, 1260, 597), "target": (145, 105), "collision": (120, 34)},
    {"id": "m01_shrub_d_v4", "marker": "F06", "type": "flower/planter", "source": "outer", "box": (1319, 528, 1410, 596), "target": (120, 90), "collision": (98, 30)},
    {"id": "m01_flowerbed_a_v4", "marker": "F07", "type": "flower/planter", "source": "outer", "box": (690, 656, 931, 771), "target": (300, 140), "collision": (270, 42)},
    {"id": "m01_flowerbed_b_v4", "marker": "F08", "type": "flower/planter", "source": "outer", "box": (978, 654, 1194, 776), "target": (285, 150), "collision": (255, 42)},
    {"id": "m01_flowerbed_c_v4", "marker": "F09", "type": "flower/planter", "source": "outer", "box": (1239, 655, 1482, 780), "target": (315, 155), "collision": (285, 42)},
    {"id": "m01_crystal_pedestal_v4", "marker": "G02", "type": "globe/decor", "source": "outer", "box": (758, 820, 853, 980), "target": (110, 180), "collision": (80, 42)},
    {"id": "m01_statue_pedestal_v4", "marker": "G03", "type": "globe/decor", "source": "outer", "box": (922, 801, 1018, 980), "target": (110, 190), "collision": (80, 42)},
    {"id": "m01_grass_a_v4", "marker": "F10", "type": "flower/planter", "source": "outer", "box": (87, 846, 224, 959), "target": (150, 120), "collision": (120, 30)},
    {"id": "m01_grass_b_v4", "marker": "F11", "type": "flower/planter", "source": "outer", "box": (317, 860, 469, 950), "target": (165, 105), "collision": (130, 28)},
    {"id": "m01_grass_c_v4", "marker": "F12", "type": "flower/planter", "source": "outer", "box": (554, 868, 657, 952), "target": (130, 100), "collision": (105, 28)},
]

PLACEMENTS = [
    # Walls and exterior dense garden now live in the full-size overlay layer.
    ("m01_blackboard_a_v4", 1536, 370, 0, "B01"),
    ("m01_protocol_podium_v4", 1536, 700, 0, "P01"),
    ("m01_lamp_a_v4", 1350, 765, 0, "L01"),
    ("m01_lamp_b_v4", 1725, 765, 0, "L02"),
    ("m01_crystal_pedestal_v4", 1260, 520, 0, "G02"),
    ("m01_statue_pedestal_v4", 1810, 520, 0, "G03"),
    ("m01_desk_a_v4", 830, 775, 0, "D01"),
    ("m01_desk_b_v4", 1092, 775, 0, "D02"),
    ("m01_desk_c_v4", 830, 1050, 0, "D03"),
    ("m01_desk_d_v4", 1092, 1050, 0, "D04"),
    ("m01_desk_a_v4", 830, 1330, 0, "D05"),
    ("m01_desk_b_v4", 1092, 1330, 0, "D06"),
    ("m01_desk_c_v4", 1972, 775, 0, "D07"),
    ("m01_desk_d_v4", 2242, 775, 0, "D08"),
    ("m01_desk_a_v4", 1972, 1050, 0, "D09"),
    ("m01_desk_b_v4", 2242, 1050, 0, "D10"),
    ("m01_desk_c_v4", 1972, 1330, 0, "D11"),
    ("m01_desk_d_v4", 2242, 1330, 0, "D12"),
    ("m01_bookshelf_a_v4", 640, 555, 0, "S01"),
    ("m01_bookshelf_b_v4", 2435, 555, 0, "S02"),
    ("m01_notice_board_v4", 2480, 1445, 0, "N01"),
    ("m01_globe_v4", 565, 1490, 0, "G01"),
    ("m01_banner_a_v4", 1230, 395, -140, "N02"),
    ("m01_banner_b_v4", 1840, 395, -140, "N03"),
    ("m01_bookpile_a_v4", 1454, 1310, 0, "I01"),
    ("m01_bookpile_b_v4", 1626, 1310, 0, "I02"),
    ("m01_screen_a_v4", 600, 1165, 0, "R01"),
    ("m01_screen_b_v4", 2470, 1165, 0, "R02"),
    ("m01_bench_a_v4", 1025, 1500, 0, "C01"),
    ("m01_bench_b_v4", 2015, 1500, 0, "C02"),
]


def scale_to_fit(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    tw, th = target
    scale = min(tw / image.width, th / image.height)
    w = max(1, round(image.width * scale))
    h = max(1, round(image.height * scale))
    return image.resize((w, h), Image.Resampling.LANCZOS)


def remove_background_blackboard(base: Image.Image) -> Image.Image:
    """Keep the base as floor/boundary only; the blackboard is a prop."""
    out = base.copy()
    sx = out.width / RUNTIME_W
    sy = out.height / RUNTIME_H
    dst = tuple(round(v * (sx if i % 2 == 0 else sy)) for i, v in enumerate((1140, 120, 1935, 315)))
    src = tuple(round(v * (sx if i % 2 == 0 else sy)) for i, v in enumerate((1140, 330, 1935, 525)))
    patch = out.crop(src).resize((dst[2] - dst[0], dst[3] - dst[1]), Image.Resampling.LANCZOS)
    out.paste(patch, (dst[0], dst[1]))
    return out


def build_tiled_floor(size: tuple[int, int]) -> Image.Image:
    tile = Image.open(RAW_FLOOR_TILE).convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size)
    for y in range(0, size[1], tile.height):
        for x in range(0, size[0], tile.width):
            canvas.paste(tile, (x, y))
    return canvas.crop((0, 0, size[0], size[1]))


def remove_wall_overlay_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size

    transparent: set[tuple[int, int]] = set()
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if r > 220 and b > 220 and g < 90 and abs(r - b) < 55:
                transparent.add((x, y))

    for _ in range(14):
        extra: set[tuple[int, int]] = set()
        for x, y in transparent:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if not (0 <= nx < w and 0 <= ny < h) or (nx, ny) in transparent:
                    continue
                r, g, b, _a = px[nx, ny]
                if r > 130 and b > 110 and g < 188 and r - g > 14 and b - g > -8 and abs(r - b) < 170:
                    extra.add((nx, ny))
        transparent.update(extra)

    for x, y in transparent:
        px[x, y] = (0, 0, 0, 0)
    return expand_transparency(rgba, radius=4, passes=1)


def build_wall_overlay() -> Image.Image:
    raw = Image.open(RAW_WALL_OVERLAY).convert("RGBA")
    raw_keyed = remove_wall_overlay_key(raw)
    overlay = raw_keyed.resize((RUNTIME_W, RUNTIME_H), Image.Resampling.LANCZOS)
    return remove_wall_overlay_key(overlay)


def split_wall_overlay(overlay: Image.Image) -> tuple[Image.Image, Image.Image]:
    back = overlay.convert("RGBA")
    front = Image.new("RGBA", back.size, (0, 0, 0, 0))
    clear = Image.new("RGBA", back.size, (0, 0, 0, 0))
    for rect in FRONT_WALL_RECTS:
        x1, y1, x2, y2 = rect
        front.alpha_composite(back.crop(rect), (x1, y1))
        clear_patch = Image.new("RGBA", (x2 - x1, y2 - y1), (0, 0, 0, 0))
        back.paste(clear_patch, (x1, y1))
    return clear_transparent_rgb(back), clear_transparent_rgb(front)


def pack_assets() -> tuple[Image.Image, dict[str, dict], dict[str, dict]]:
    raw_primary = Image.open(RAW_PRIMARY_PROPS).convert("RGBA")
    raw_outer = Image.open(RAW_OUTER_PROPS).convert("RGBA")
    raw_structure = Image.open(RAW_STRUCTURE_PROPS).convert("RGBA")
    raw_window8 = Image.open(RAW_WINDOW_WALL_8DIR).convert("RGBA")
    raw_sidewall = Image.open(RAW_SIDE_WINDOW_WALL).convert("RGBA")
    raw_plainwall = Image.open(RAW_PLAIN_WALL_8DIR).convert("RGBA")
    raw_by_name = {
        "primary": raw_primary,
        "outer": raw_outer,
        "structure": raw_structure,
        "window8": raw_window8,
        "sidewall": raw_sidewall,
        "plainwall": raw_plainwall,
    }

    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))
    frames: dict[str, dict] = {}
    specs_by_id: dict[str, dict] = {}

    x = 40
    y = 40
    row_h = 0
    used_asset_ids = {unpack_placement(placement)[0] for placement in PLACEMENTS}
    family_specs = set()
    packable_specs = [spec for spec in ASSET_SPECS if spec["id"] in used_asset_ids or spec.get("family") in family_specs]
    for spec in packable_specs:
        asset = crop_asset(raw_by_name[spec["source"]], spec["box"])
        if spec.get("flipX"):
            asset = asset.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        asset = scale_to_fit(asset, spec["target"])
        asset = clear_transparent_rgb(asset)
        asset = remove_magenta_bands(asset)
        if spec.get("trim"):
            left, top, right, bottom = spec["trim"]
            asset = asset.crop((left, top, asset.width - right, asset.height - bottom))
        asset = add_contact_shadow(asset, spec)
        if x + asset.width + 40 > ATLAS_W:
            x = 40
            y += row_h + 44
            row_h = 0
        if y + asset.height + 40 > ATLAS_H:
            raise RuntimeError("v4 runtime atlas does not fit")
        paste_alpha(atlas, asset, (x, y))
        frame = {"x": x, "y": y, "w": asset.width, "h": asset.height}
        frames[spec["id"]] = frame
        spec_copy = deepcopy(spec)
        spec_copy["frame"] = frame
        specs_by_id[spec["id"]] = spec_copy
        x += asset.width + 44
        row_h = max(row_h, asset.height)
    return atlas, frames, specs_by_id


def unpack_placement(placement: tuple) -> tuple[str, int, int, int, str | None]:
    asset_id, x, y, depth_offset, *rest = placement
    return asset_id, x, y, depth_offset, rest[0] if rest else None


def collision_for(spec: dict, placement: tuple) -> dict | None:
    if not spec.get("collision"):
        return None
    _asset_id, x, y, _depth, _marker_override = unpack_placement(placement)
    cw, ch = spec["collision"]
    return {
        "x": round(x - cw / 2),
        "y": round(y - ch),
        "w": cw,
        "h": ch,
    }


def build_props(specs_by_id: dict[str, dict]) -> list[dict]:
    props: list[dict] = []
    placement_counts: dict[str, int] = {}
    for placement in PLACEMENTS:
        asset_id, x, y, depth_offset, marker_override = unpack_placement(placement)
        spec = specs_by_id[asset_id]
        placement_counts[asset_id] = placement_counts.get(asset_id, 0) + 1
        suffix = "" if placement_counts[asset_id] == 1 else f"_{placement_counts[asset_id]}"
        prop_id = asset_id.replace("_v4", f"{suffix}_v4")
        frame = spec["frame"]
        prop = {
            "id": prop_id,
            "markerId": marker_override or f"{spec['marker']}{suffix}",
            "type": spec["type"],
            "frame": asset_id,
            "atlas": "m01-v4",
            "x": x,
            "y": y,
            "origin": {"x": 0.5, "y": 1},
            "scale": 1,
            "maxScale": 1,
            "depthY": y + depth_offset,
            "depthOffset": depth_offset,
            "visualBounds": {"w": frame["w"], "h": frame["h"]},
            "runtimeScalePolicy": "scale=1; generated-size-baked-into-v4-atlas",
            "qaStatus": "generated-awaiting-browser-check",
        }
        if spec.get("family"):
            prop["assetFamily"] = spec["family"]
        if spec.get("direction"):
            prop["direction"] = spec["direction"]
        col = collision_for(spec, placement)
        if col:
            prop["collision"] = col
            prop["collisionFootprint"] = col
        props.append(prop)
    return props


def marker_entries(props: list[dict]) -> list[dict]:
    entries = []
    for prop in props:
        collision = prop.get("collisionFootprint", {})
        entries.append(
            {
                "markerId": prop["markerId"],
                "type": prop["type"],
                "runtimePropId": prop["id"],
                "x": prop["x"],
                "y": prop["y"],
                "anchor": "bottom-center",
                "targetRuntimeSize": prop["visualBounds"],
                "collisionFootprint": collision,
                "depthY": prop["depthY"],
                "notes": "v4 landscape prop placement",
            }
        )
    entries.extend(
        [
            {"markerId": "INT01", "type": "interaction node", "x": 1536, "y": 270, "anchor": "center", "targetRuntimeSize": {"w": 180, "h": 180}, "collisionFootprint": {}, "depthY": 270, "notes": "syllabus board trigger"},
            {"markerId": "INT02", "type": "interaction node", "x": 1536, "y": 680, "anchor": "center", "targetRuntimeSize": {"w": 170, "h": 170}, "collisionFootprint": {}, "depthY": 680, "notes": "protocol card pickup"},
            {"markerId": "INT03", "type": "interaction node", "x": 1536, "y": 1310, "anchor": "center", "targetRuntimeSize": {"w": 220, "h": 220}, "collisionFootprint": {}, "depthY": 1310, "notes": "bug-note encounter trigger"},
            {"markerId": "SP", "type": "spawn", "x": 1536, "y": 1905, "anchor": "center", "targetRuntimeSize": {"w": 140, "h": 140}, "collisionFootprint": {}, "depthY": 1905, "notes": "player spawn"},
            {"markerId": "E01", "type": "exit/portal", "x": 1536, "y": 1805, "anchor": "center", "targetRuntimeSize": {"w": 190, "h": 190}, "collisionFootprint": {}, "depthY": 1805, "notes": "open transfer gap to ch1_m02_prompt_archive"},
            {"markerId": "CMB01", "type": "combat space", "x": 1536, "y": 1280, "anchor": "center", "targetRuntimeSize": {"w": 660, "h": 460}, "collisionFootprint": {}, "depthY": 1280, "notes": "first enemy-wave kite area"},
        ]
    )
    return entries


def assemble_preview(base: Image.Image, wall_back: Image.Image, wall_front: Image.Image, atlas: Image.Image, props: list[dict], frames: dict[str, dict]) -> Image.Image:
    assembled = base.convert("RGBA")
    paste_alpha(assembled, wall_back, (0, 0))
    for prop in sorted(props, key=lambda p: p["depthY"]):
        frame = frames[prop["frame"]]
        crop = atlas.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
        x = round(prop["x"] - frame["w"] * prop["origin"]["x"])
        y = round(prop["y"] - frame["h"] * prop["origin"]["y"])
        paste_alpha(assembled, crop, (x, y))
    paste_alpha(assembled, wall_front, (0, 0))
    return assembled.convert("RGB")


def crop_lina() -> Image.Image:
    sheet = Image.open(LINA_SPRITE_PATH).convert("RGBA")
    frame = sheet.crop((0, 0, LINA_RUNTIME_HEIGHT, LINA_RUNTIME_HEIGHT))
    bbox = frame.getbbox()
    if not bbox:
        return frame
    trimmed = frame.crop(bbox)
    out = Image.new("RGBA", (LINA_RUNTIME_HEIGHT, LINA_RUNTIME_HEIGHT), (0, 0, 0, 0))
    paste_alpha(out, trimmed, ((LINA_RUNTIME_HEIGHT - trimmed.width) // 2, LINA_RUNTIME_HEIGHT - trimmed.height))
    return out


def make_marker_master(source_base: Image.Image, entries: list[dict]) -> Image.Image:
    marker = source_base.convert("RGBA")
    overlay = Image.new("RGBA", marker.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font(44)
    small = load_font(28)
    for entry in entries:
        prefix = entry["markerId"][0]
        color = MARKER_COLORS.get(prefix, (255, 255, 255, 168))
        x = entry["x"] * 2
        y = entry["y"] * 2
        size = entry.get("targetRuntimeSize", {"w": 120, "h": 120})
        w = size.get("w", 120) * 2
        h = size.get("h", 120) * 2
        if entry.get("anchor") == "bottom-center":
            rect = (x - w // 2, y - h, x + w // 2, y)
            draw.rounded_rectangle(rect, radius=18, fill=color, outline=(255, 255, 255, 230), width=4)
            label = (rect[0] + 10, rect[1] + 10)
        else:
            r = max(w, h) // 2
            rect = (x - r, y - r, x + r, y + r)
            draw.ellipse(rect, fill=color, outline=(255, 255, 255, 230), width=4)
            label = (x - r + 10, y - 18)
        draw_text_backplate(draw, (round(label[0]), round(label[1])), entry["markerId"], font)
        c = entry.get("collisionFootprint") or {}
        if c:
            crect = (c["x"] * 2, c["y"] * 2, (c["x"] + c["w"]) * 2, (c["y"] + c["h"]) * 2)
            draw.rectangle(crect, outline=(255, 70, 80, 230), width=4)
            draw.text((crect[0] + 8, crect[1] + 8), "foot", fill=(255, 220, 220, 230), font=small)
    route = [(1536, 1905), (1536, 680), (1536, 1310), (1536, 1805)]
    draw.line([(x * 2, y * 2) for x, y in route], fill=(90, 240, 255, 210), width=10)
    marker.alpha_composite(overlay)
    return marker.convert("RGB")


def make_qa_overlay(assembled: Image.Image, props: list[dict]) -> Image.Image:
    qa = assembled.convert("RGBA")
    draw = ImageDraw.Draw(qa, "RGBA")
    font = load_font(26)
    title_font = load_font(34)
    for x in [1024, 2048]:
        draw.line((x, 0, x, RUNTIME_H), fill=(255, 255, 255, 130), width=3)
    draw.line((0, 1024, RUNTIME_W, 1024), fill=(255, 255, 255, 130), width=3)
    draw_text_backplate(draw, (28, 28), "M1 v4 landscape QA: 3072x2048 / 147px Lina / prop-foot collision", title_font)
    for prop in props:
        c = prop.get("collision")
        if not c:
            continue
        draw.rectangle((c["x"], c["y"], c["x"] + c["w"], c["y"] + c["h"]), outline=(255, 65, 85, 230), fill=(255, 65, 85, 42), width=3)
    for item in WALL_COLLISIONS:
        draw.rectangle((item["x"], item["y"], item["x"] + item["w"], item["y"] + item["h"]), outline=(255, 65, 85, 230), fill=(255, 65, 85, 34), width=3)
    lina = crop_lina()
    for label, x, y in [
        ("spawn", 1536, 1905),
        ("podium", 1536, 700),
        ("desk", 1092, 1050),
        ("outer", 2825, 1710),
        ("exit", 1536, 1805),
    ]:
        paste_alpha(qa, lina, (x - LINA_RUNTIME_HEIGHT // 2, y - LINA_RUNTIME_HEIGHT))
        draw_text_backplate(draw, (x + 14, y - LINA_RUNTIME_HEIGHT + 4), label, font)
    draw_text_backplate(draw, (28, 1980), "Outer 20% is decorated with props; active blocking uses prop foot/base rectangles.", font)
    return qa.convert("RGB")


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_registry(frames: dict[str, dict], props: list[dict]) -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    registry["version"] = "0.5.0"
    m01 = registry["maps"]["ch1_m01_classroom_spawn"]
    m01["assetPackage"] = {
        "id": "ch1-m01-formal-landscape-v4",
        "status": "active-runtime",
        "manifest": rel(OUT["placement_manifest"]),
        "markerManifest": rel(OUT["marker_manifest"]),
        "qaOverlay": rel(OUT["runtime_qa"]),
    }
    m01["background"] = {
        "key": "ch1-map-classroom-spawn-bg",
        "path": rel(OUT["runtime_base"]),
        "width": RUNTIME_W,
        "height": RUNTIME_H,
        "chunks": [
            {
                "id": f"ch1-m01-spawn-{suffix}",
                "key": f"ch1-m01-spawn-{suffix}",
                "path": rel(CHUNKS_DIR / f"ch1-m01-base-v4-{suffix}.png"),
                "x": x,
                "y": y,
                "width": CHUNK_SIZE,
                "height": CHUNK_SIZE,
            }
            for suffix, x, y in RUNTIME_CHUNKS
        ],
    }
    m01["spawn"] = {"id": "ch1_m01_spawn_player_start", "x": 1536, "y": 1905, "facing": "N", "setFlags": ["ch1_intro_entered_classroom"]}
    m01["spawnPoints"] = [
        {"id": "ch1_m01_spawn_player_start", "x": 1536, "y": 1905, "facing": "N"},
        {"id": "ch1_m01_spawn_from_archive", "x": 1536, "y": 1815, "facing": "S"},
    ]
    m01["camera"] = {"startX": 1536, "startY": 1180}
    m01["obstacles"] = [
        {"id": "m01_v4_world_north_edge", "x": 0, "y": 0, "w": RUNTIME_W, "h": 36},
        {"id": "m01_v4_world_south_edge", "x": 0, "y": RUNTIME_H - 36, "w": RUNTIME_W, "h": 36},
        {"id": "m01_v4_world_west_edge", "x": 0, "y": 0, "w": 36, "h": RUNTIME_H},
        {"id": "m01_v4_world_east_edge", "x": RUNTIME_W - 36, "y": 0, "w": 36, "h": RUNTIME_H},
        *deepcopy(WALL_COLLISIONS),
    ]
    m01["interactionNodes"] = [
        {"id": "ch1_m01_node_syllabus_terminal", "type": "inspect", "label": "课程协议板", "x": 1536, "y": 270, "radius": 112, "dialogueId": "ch1_m01_dialogue_intro", "setFlags": ["ch1_intro_read_syllabus", "ch1_task_fix_prompt_chain_active"], "unlockCards": ["ch1_card_context_window"]},
        {"id": "ch1_m01_node_protocol_deck", "type": "collect", "label": "协议卡讲台", "x": 1536, "y": 680, "radius": 96, "requiresFlags": ["ch1_intro_read_syllabus"], "grantCards": ["ch1_card_context_window", "ch1_card_traceable_instruction"], "setFlags": ["ch1_intro_card_claimed"], "once": True},
        {"id": "ch1_m01_node_bug_notes", "type": "spawn", "label": "错乱笔记堆", "x": 1536, "y": 1310, "radius": 130, "requiresFlags": ["ch1_intro_card_claimed"], "spawnEncounterId": "ch1_m01_encounter_bug_notes", "setFlags": ["ch1_m01_bug_notes_disturbed"], "once": True},
    ]
    m01["enemySpawns"] = [
        {"id": "ch1-m01-demand-bug-west", "x": 1230, "y": 1280, "group": "ch1_m01_encounter_bug_notes", "activeAfter": "ch1_m01_bug_notes_disturbed", "rank": "mob", "label": "需求噪点", "maxHp": 58, "damage": 7},
        {"id": "ch1-m01-demand-bug-east", "x": 1840, "y": 1280, "group": "ch1_m01_encounter_bug_notes", "activeAfter": "ch1_m01_bug_notes_disturbed", "rank": "mob", "label": "格式噪点", "maxHp": 58, "damage": 7},
        {"id": "ch1-m01-demand-bug-center", "x": 1536, "y": 1160, "group": "ch1_m01_encounter_bug_notes", "activeAfter": "ch1_m01_bug_notes_disturbed", "rank": "mob", "label": "遗漏注脚", "maxHp": 68, "damage": 8},
    ]
    m01["exitPoints"] = [
        {"id": "ch1_m01_exit_to_m02", "type": "teleport", "label": "提示词资料室", "x": 1536, "y": 1805, "radius": 115, "targetMapId": "ch1_m02_prompt_archive", "targetSpawnId": "ch1_m02_spawn_from_classroom", "requiresFlags": ["ch1_intro_card_claimed", "ch1_m01_bug_notes_cleared"], "setFlags": ["ch1_m01_cleared", "ch1_m02_unlocked"], "lockedDialogueId": "ch1_m01_dialogue_exit_locked"},
    ]
    m01["foregroundOverlays"] = [
        {
            "id": "m01_wall_overlay_back_v5",
            "textureKey": "ch1-m01-wall-overlay-v5",
            "path": rel(OUT["wall_overlay_runtime"]),
            "x": 0,
            "y": 0,
            "w": RUNTIME_W,
            "h": RUNTIME_H,
            "sourceX": 0,
            "sourceY": 0,
            "depth": -10,
            "alpha": 1,
        },
        {
            "id": "m01_wall_overlay_front_v5",
            "textureKey": "ch1-m01-wall-overlay-front-v5",
            "path": rel(OUT["wall_overlay_front_runtime"]),
            "x": 0,
            "y": 0,
            "w": RUNTIME_W,
            "h": RUNTIME_H,
            "sourceX": 0,
            "sourceY": 0,
            "depth": 2200,
            "alpha": 1,
        }
    ]
    m01["minimapImage"] = {"key": "ch1-map-classroom-spawn-assembled-v4", "path": rel(OUT["runtime_assembled"]), "width": RUNTIME_W, "height": RUNTIME_H}
    m01["propAtlases"] = [{"id": "m01-v4", "key": "ch1-m01-props-atlas-v4", "path": rel(OUT["props_runtime"]), "frames": frames}]
    m01["foregroundAtlases"] = [{"id": "m01-foreground-v4", "key": "ch1-m01-foreground-atlas-v4", "path": rel(OUT["foreground_runtime"]), "frames": frames}]
    m01["props"] = []
    for prop in props:
        item = {
            "id": prop["id"],
            "frame": prop["frame"],
            "atlas": prop["atlas"],
            "x": prop["x"],
            "y": prop["y"],
            "origin": prop["origin"],
            "scale": 1,
            "depthOffset": prop["depthOffset"],
        }
        if prop.get("assetFamily"):
            item["assetFamily"] = prop["assetFamily"]
        if prop.get("direction"):
            item["direction"] = prop["direction"]
        if prop.get("collision"):
            item["collision"] = prop["collision"]
        m01["props"].append(item)
    write_json(REGISTRY_PATH, registry)


def write_usage_doc(props: list[dict]) -> None:
    doc = ROOT / "docs" / "asset-guides" / "ch1-m01-formal-landscape-v4-usage.md"
    rows = "\n".join(
        f"| `{p['markerId']}` | `{p['id']}` | `{p['frame']}` | {p['x']} | {p['y']} | {p['visualBounds']['w']} x {p['visualBounds']['h']} |"
        for p in props
    )
    content = f"""# ch1-m01 Formal Landscape v4 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-landscape-v4
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: {date.today().isoformat()}
- `runtime_size`: 3072 x 2048
- `source_size`: 6144 x 4096
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `{rel(OUT['placement_manifest'])}`
- `marker_manifest`: `{rel(OUT['marker_manifest'])}`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `{rel(OUT['runtime_base'])}` |
| assembled minimap / review | `{rel(OUT['runtime_assembled'])}` |
| QA overlay | `{rel(OUT['runtime_qa'])}` |
| dense wall / garden back overlay | `{rel(OUT['wall_overlay_runtime'])}` |
| bottom wall foreground overlay | `{rel(OUT['wall_overlay_front_runtime'])}` |
| runtime prop atlas | `{rel(OUT['props_runtime'])}` |
| source clean base | `{rel(OUT['base_master'])}` |
| marker base | `{rel(OUT['marker_master'])}` |
| marked image layout reference | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-marked-layout-reference-v4.png` |
| raw floor tile | `{rel(RAW_FLOOR_TILE)}` |
| raw dense wall overlay | `{rel(RAW_WALL_OVERLAY)}` |
| raw window-wall 8dir sheet | `{rel(RAW_WINDOW_WALL_8DIR)}` |
| raw plain-wall 8dir sheet | `{rel(RAW_PLAIN_WALL_8DIR)}` |

## Production Rules Applied

- Landscape map, 3072 x 2048 runtime, about 50% wider than the previous 2048 square map.
- Background base is a crisp image-generated floor tile repeated as a 3 x 2 map.
- Walls and the dense exterior garden are split into transparent overlays: top/side/back layer below the character, bottom wall foreground layer above the character.
- `window_wall` and `plain_wall` are retained as 8-direction source families, but they are not active hand-placed m01 props in this pass.
- Outer buffer is filled by the dense wall overlay: grass ground, grouped trees, flower beds, and an irregular stone transfer path.
- Prop atlas frames include baked soft contact shadows; the shadows are visual only.
- Runtime collision uses prop foot/base rectangles, not full texture rectangles.
- Active prop runtime scale is `1`; sizes are baked into atlas frames.

## Prop Placement

| marker | prop id | frame | x | y | runtime size |
| --- | --- | --- | ---: | ---: | --- |
{rows}
"""
    doc.write_text(content, encoding="utf-8")


def main() -> None:
    ensure_dirs()
    runtime_base = build_tiled_floor((RUNTIME_W, RUNTIME_H))
    source_base = build_tiled_floor((SOURCE_W, SOURCE_H))
    save_png(runtime_base, OUT["runtime_base"])
    save_png(source_base, OUT["base_master"])
    wall_overlay = build_wall_overlay()
    wall_back, wall_front = split_wall_overlay(wall_overlay)
    save_png(wall_back, OUT["wall_overlay_runtime"])
    save_png(wall_front, OUT["wall_overlay_front_runtime"])
    for suffix, x, y in SOURCE_BLOCKS:
        save_png(source_base.crop((x, y, x + 2048, y + 2048)), SOURCE_DIR / f"ch1-m01-base-v4-{suffix}-2048.png")
    for suffix, x, y in RUNTIME_CHUNKS:
        save_png(runtime_base.crop((x, y, x + CHUNK_SIZE, y + CHUNK_SIZE)), CHUNKS_DIR / f"ch1-m01-base-v4-{suffix}.png")

    atlas, frames, specs_by_id = pack_assets()
    save_png(atlas, OUT["props_runtime"])
    save_png(atlas, OUT["foreground_runtime"])
    save_png(atlas.resize((SOURCE_W, SOURCE_H), Image.Resampling.NEAREST), OUT["props_master"])
    save_png(atlas.resize((SOURCE_W, SOURCE_H), Image.Resampling.NEAREST), OUT["foreground_master"])

    props = build_props(specs_by_id)
    entries = marker_entries(props)
    assembled = assemble_preview(runtime_base, wall_back, wall_front, atlas, props, frames)
    save_png(assembled, OUT["runtime_assembled"])
    save_png(make_qa_overlay(assembled, props), OUT["runtime_qa"])
    save_png(make_marker_master(source_base, entries), OUT["marker_master"])

    write_json(
        OUT["marker_manifest"],
        {
            "$schema": "https://efv.local/schemas/ch1-marker-manifest-v1.json",
            "id": "ch1-m01-marker-manifest-v4",
            "mapId": "ch1_m01_classroom_spawn",
            "runtimeSize": {"w": RUNTIME_W, "h": RUNTIME_H},
            "sourceSize": {"w": SOURCE_W, "h": SOURCE_H},
            "coordinateSystem": "runtime coordinates; marker concept image is 2x",
            "markers": entries,
        },
    )

    write_json(
        OUT["placement_manifest"],
        {
            "$schema": "https://efv.local/schemas/layered-map-manifest-v4.json",
            "id": "ch1_m01_classroom_spawn_formal_landscape_v4",
            "mapId": "ch1_m01_classroom_spawn",
            "status": "runtime-promoted-formal-landscape-v4",
            "runtimeSource": "assets/chapter1/chapter1-maps-v1.json#maps.ch1_m01_classroom_spawn",
            "productionDate": date.today().isoformat(),
            "resolution": {
                "sourceMaster": {"w": SOURCE_W, "h": SOURCE_H},
                "runtime": {"w": RUNTIME_W, "h": RUNTIME_H},
                "runtimeChunk": {"w": CHUNK_SIZE, "h": CHUNK_SIZE, "grid": "3x2"},
            },
            "baseBackground": {
                "rawImagegenBase": rel(RAW_BASE),
                "rawFloorTile": rel(RAW_FLOOR_TILE),
                "rawWallOverlay": rel(RAW_WALL_OVERLAY),
                "rawMarkedLayoutReference": "assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-imagegen-marked-layout-reference-v4.png",
                "markerMaster": rel(OUT["marker_master"]),
                "markerManifest": rel(OUT["marker_manifest"]),
                "sourceMaster": rel(OUT["base_master"]),
                "runtimeAsset": rel(OUT["runtime_base"]),
                "runtimeWallOverlayBack": rel(OUT["wall_overlay_runtime"]),
                "runtimeWallOverlayFront": rel(OUT["wall_overlay_front_runtime"]),
                "assembledPreview": rel(OUT["runtime_assembled"]),
                "qaOverlay": rel(OUT["runtime_qa"]),
            },
            "overlayLayers": [
                {
                    "id": "m01_wall_overlay_back_v5",
                    "textureKey": "ch1-m01-wall-overlay-v5",
                    "path": rel(OUT["wall_overlay_runtime"]),
                    "layering": "above tiled floor, below props and character",
                    "transparentKey": "#ff00ff center fill removed",
                    "depth": -10,
                },
                {
                    "id": "m01_wall_overlay_front_v5",
                    "textureKey": "ch1-m01-wall-overlay-front-v5",
                    "path": rel(OUT["wall_overlay_front_runtime"]),
                    "layering": "bottom wall foreground occluder above character",
                    "transparentKey": "#ff00ff center fill removed",
                    "depth": 2200,
                }
            ],
            "assetFamilies": {
                "window_wall": {
                    "directions": ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
                    "rawSheet": rel(RAW_WINDOW_WALL_8DIR),
                    "activeM01Directions": [],
                    "status": "source-retained; active wall uses full-size overlay",
                },
                "plain_wall": {
                    "directions": ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
                    "rawSheet": rel(RAW_PLAIN_WALL_8DIR),
                    "activeM01Directions": [],
                    "status": "source-retained; active wall uses full-size overlay",
                },
                "contactShadowPolicy": "each prop atlas frame has baked soft contact shadow; collision remains foot/base rectangle",
            },
            "sourceBlocks": {suffix: rel(SOURCE_DIR / f"ch1-m01-base-v4-{suffix}-2048.png") for suffix, _x, _y in SOURCE_BLOCKS},
            "runtimeChunks": {suffix: rel(CHUNKS_DIR / f"ch1-m01-base-v4-{suffix}.png") for suffix, _x, _y in RUNTIME_CHUNKS},
            "wallCollisions": deepcopy(WALL_COLLISIONS),
            "propAtlas": {"id": "m01-v4", "key": "ch1-m01-props-atlas-v4", "path": rel(OUT["props_runtime"]), "frames": frames},
            "foregroundAtlas": {"id": "m01-foreground-v4", "key": "ch1-m01-foreground-atlas-v4", "path": rel(OUT["foreground_runtime"]), "frames": frames},
            "props": props,
            "qa": {
                "checks": [
                    "landscape runtime base is 3072 x 2048",
                    "runtime is cut into 3 x 2 chunks of 1024 x 1024",
                    "background contains floor and flat boundary trim only",
                    "wall and dense exterior garden are carried by a transparent overlay layer",
                    "outer wall ring has explicit runtime collision rectangles; the bottom transfer gap stays open",
                    "all prop runtime scales are 1",
                    "collision boxes are foot/base rectangles",
                ]
            },
        },
    )
    update_registry(frames, props)
    write_usage_doc(props)

    print("Generated ch1_m01 formal landscape v4 package")
    print(rel(OUT["runtime_base"]))
    print(rel(OUT["wall_overlay_runtime"]))
    print(rel(OUT["runtime_assembled"]))
    print(rel(OUT["props_runtime"]))
    print(rel(OUT["placement_manifest"]))


if __name__ == "__main__":
    main()
