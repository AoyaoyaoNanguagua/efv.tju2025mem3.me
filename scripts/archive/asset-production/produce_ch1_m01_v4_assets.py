from __future__ import annotations

import json
import math
from copy import deepcopy
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "assets" / "chapter1" / "maps" / "ch1_m01_classroom_spawn"
SOURCE_DIR = MAP_DIR / "source"
BACKGROUND_DIR = MAP_DIR / "background"
CHUNKS_DIR = MAP_DIR / "chunks"
PROPS_DIR = MAP_DIR / "props"
FOREGROUND_DIR = MAP_DIR / "foreground"
DOCS_DIR = ROOT / "docs" / "asset-guides"
REGISTRY_PATH = ROOT / "assets" / "chapter1" / "chapter1-maps-v1.json"
LEGACY_MAP_PATH = ROOT / "assets" / "chapter1" / "ch1-m01-classroom-spawn.json"
LINA_SPRITE_PATH = ROOT / "assets" / "sprites" / "lina-sprites-v10-anchored-expanded.png"
ASSET_INDEX_PATH = DOCS_DIR / "chapter1-p0-asset-index.md"

RUNTIME_SIZE = 2048
SOURCE_SIZE = 4096
SOURCE_SCALE = 2
CHUNK_SIZE = 1024
OVERLAP = 256
LINA_RUNTIME_HEIGHT = 147


OUT = {
    "marker_master": SOURCE_DIR / "ch1-m01-marker-base-master-4096-v4.png",
    "marker_runtime": SOURCE_DIR / "ch1-m01-marker-base-v4-2048.png",
    "marker_manifest": SOURCE_DIR / "ch1-m01-marker-manifest-v4.json",
    "base_master": SOURCE_DIR / "ch1-m01-base-master-4096-v4.png",
    "base_ul": SOURCE_DIR / "ch1-m01-base-v4-ul-overlap-2304.png",
    "base_ur": SOURCE_DIR / "ch1-m01-base-v4-ur-overlap-2304.png",
    "base_lr": SOURCE_DIR / "ch1-m01-base-v4-lr-overlap-2304.png",
    "base_ll": SOURCE_DIR / "ch1-m01-base-v4-ll-overlap-2304.png",
    "runtime_base": BACKGROUND_DIR / "ch1-map-classroom-spawn-base-v4-2048.png",
    "runtime_assembled": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-v4-2048.png",
    "runtime_qa": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-qa-v4.png",
    "props_master": SOURCE_DIR / "ch1-m01-props-atlas-master-4096-v4.png",
    "foreground_master": SOURCE_DIR / "ch1-m01-foreground-atlas-master-4096-v4.png",
    "props_runtime": PROPS_DIR / "ch1-m01-props-atlas-v4.png",
    "foreground_runtime": FOREGROUND_DIR / "ch1-m01-foreground-atlas-v4.png",
    "placement_manifest": MAP_DIR / "ch1-m01-layered-map-manifest-v4.json",
    "usage_doc": DOCS_DIR / "ch1-m01-formal-v4-usage.md",
}

CHUNKS = [
    ("nw", 0, 0),
    ("ne", CHUNK_SIZE, 0),
    ("sw", 0, CHUNK_SIZE),
    ("se", CHUNK_SIZE, CHUNK_SIZE),
]

MARKER_COLORS = {
    "B": (128, 94, 228, 156),
    "C": (255, 88, 84, 130),
    "D": (57, 142, 235, 150),
    "E": (62, 220, 150, 172),
    "F": (69, 184, 100, 150),
    "I": (255, 255, 255, 172),
    "L": (255, 226, 90, 164),
    "N": (242, 96, 136, 160),
    "P": (246, 178, 58, 172),
    "R": (82, 205, 218, 150),
    "S": (184, 148, 88, 150),
}


@dataclass
class PropDef:
    marker_id: str
    prop_id: str
    prop_type: str
    frame: str
    x: int
    y: int
    w: int
    h: int
    draw_fn: Callable[[int, int], Image.Image]
    collision: dict | None = None
    depth_offset: int = 0
    anchor: str = "bottom-center"
    notes: str = ""


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def ensure_dirs() -> None:
    for directory in [SOURCE_DIR, BACKGROUND_DIR, CHUNKS_DIR, PROPS_DIR, FOREGROUND_DIR, DOCS_DIR]:
        directory.mkdir(parents=True, exist_ok=True)


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def rgba(color: tuple[int, int, int], alpha: int = 255) -> tuple[int, int, int, int]:
    return (*color, alpha)


def sr(value: int | float) -> int:
    return int(round(value * SOURCE_SCALE))


def rounded(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(tuple(map(int, xy)), radius=int(radius), fill=fill, outline=outline, width=width)


def text_backplate(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont) -> None:
    x, y = xy
    bbox = draw.textbbox((x, y), text, font=font)
    pad = 9
    rounded(
        draw,
        (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad),
        10,
        (8, 16, 28, 222),
        (255, 231, 156, 230),
        2,
    )
    draw.text((x, y), text, fill=(255, 247, 222, 255), font=font)


def paste_alpha(canvas: Image.Image, image: Image.Image, xy: tuple[int, int]) -> None:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    canvas.alpha_composite(image, dest=xy)


def draw_shadow(draw: ImageDraw.ImageDraw, rect, radius: int = 20, alpha: int = 70) -> None:
    x1, y1, x2, y2 = rect
    rounded(draw, (x1 + 12, y1 + 14, x2 + 12, y2 + 14), radius, (13, 19, 28, alpha))


def high_canvas(w: int, h: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image, "RGBA")


def make_base_master() -> Image.Image:
    img = Image.new("RGB", (SOURCE_SIZE, SOURCE_SIZE), (208, 199, 178))
    draw = ImageDraw.Draw(img, "RGBA")

    tile = sr(64)
    for y in range(0, SOURCE_SIZE, tile):
        for x in range(0, SOURCE_SIZE, tile):
            alt = ((x // tile) + (y // tile)) % 2
            base = (202, 194, 174) if alt else (216, 207, 185)
            draw.rectangle((x, y, x + tile, y + tile), fill=rgba(base, 255))
            draw.rectangle((x, y, x + tile, y + tile), outline=(154, 137, 112, 64), width=2)
            if alt:
                draw.line((x + tile * 0.25, y + tile * 0.5, x + tile * 0.75, y + tile * 0.5), fill=(255, 255, 255, 34), width=2)

    interior = (sr(235), sr(320), sr(1810), sr(1790))
    rounded(draw, interior, sr(22), (226, 217, 194, 255), (151, 130, 100, 150), sr(3))

    for x in [sr(760), sr(1024), sr(1288)]:
        draw.rectangle((x - sr(12), sr(360), x + sr(12), sr(1790)), fill=(176, 151, 116, 80))
        draw.rectangle((x - sr(4), sr(360), x + sr(4), sr(1790)), fill=(238, 213, 148, 118))
    for y in [sr(660), sr(890), sr(1120), sr(1350), sr(1580)]:
        draw.line((sr(260), y, sr(1788), y), fill=(255, 255, 255, 42), width=sr(3))

    path_rect = (sr(850), sr(330), sr(1198), sr(1795))
    rounded(draw, path_rect, sr(18), (231, 224, 204, 148), (206, 176, 112, 120), sr(2))
    for y in range(sr(430), sr(1760), sr(210)):
        draw.polygon(
            [
                (sr(1024), y - sr(42)),
                (sr(1066), y),
                (sr(1024), y + sr(42)),
                (sr(982), y),
            ],
            fill=(186, 148, 86, 70),
            outline=(240, 215, 148, 126),
        )

    wall_dark = (46, 61, 78)
    wall_mid = (69, 84, 95)
    trim = (185, 143, 78)
    north = (0, 0, SOURCE_SIZE, sr(330))
    west = (0, 0, sr(235), SOURCE_SIZE)
    east_top = (sr(1810), 0, SOURCE_SIZE, sr(560))
    east_bottom = (sr(1810), sr(840), SOURCE_SIZE, SOURCE_SIZE)
    south_left = (0, sr(1790), sr(850), SOURCE_SIZE)
    south_right = (sr(1198), sr(1790), SOURCE_SIZE, SOURCE_SIZE)
    for rect in [north, west, east_top, east_bottom, south_left, south_right]:
        draw.rectangle(rect, fill=rgba(wall_mid, 255))
        x1, y1, x2, y2 = rect
        draw.rectangle((x1, y1, x2, min(y2, y1 + sr(42))), fill=rgba((90, 103, 112), 180))
        draw.rectangle((x1, max(y1, y2 - sr(42)), x2, y2), fill=rgba(wall_dark, 200))
        draw.rectangle(rect, outline=rgba(trim, 170), width=sr(4))

    draw.rectangle((sr(235), sr(330), sr(1810), sr(364)), fill=(35, 48, 62, 135))
    draw.rectangle((sr(235), sr(1758), sr(850), sr(1790)), fill=(35, 48, 62, 120))
    draw.rectangle((sr(1198), sr(1758), sr(1810), sr(1790)), fill=(35, 48, 62, 120))
    draw.rectangle((sr(1778), sr(0), sr(1810), sr(560)), fill=(35, 48, 62, 135))
    draw.rectangle((sr(1778), sr(840), sr(1810), SOURCE_SIZE), fill=(35, 48, 62, 135))

    draw.rectangle((sr(850), sr(1790), sr(1198), SOURCE_SIZE), fill=(224, 216, 196, 255))
    draw.rectangle((sr(1810), sr(560), SOURCE_SIZE, sr(840)), fill=(224, 216, 196, 255))
    draw.rectangle((sr(850), sr(1790), sr(1198), sr(1822)), fill=(243, 218, 150, 120))
    draw.rectangle((sr(1778), sr(560), sr(1810), sr(840)), fill=(243, 218, 150, 120))

    for i in range(10):
        alpha = max(0, 62 - i * 6)
        draw.line((sr(240 + i * 12), sr(340), sr(240 + i * 12), sr(1770)), fill=(18, 25, 35, alpha), width=sr(16))
        draw.line((sr(1806 - i * 12), sr(340), sr(1806 - i * 12), sr(1770)), fill=(18, 25, 35, alpha), width=sr(16))
        draw.line((sr(240), sr(340 + i * 12), sr(1806), sr(340 + i * 12)), fill=(18, 25, 35, alpha), width=sr(16))
        draw.line((sr(240), sr(1788 - i * 12), sr(1806), sr(1788 - i * 12)), fill=(18, 25, 35, alpha), width=sr(16))

    sunlight = Image.new("RGBA", (SOURCE_SIZE, SOURCE_SIZE), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(sunlight, "RGBA")
    for i in range(9):
        x = sr(280 + i * 116)
        sdraw.polygon(
            [(x, sr(345)), (x + sr(340), sr(345)), (x + sr(120), sr(1580)), (x - sr(220), sr(1580))],
            fill=(255, 244, 196, 22),
        )
    img = Image.alpha_composite(img.convert("RGBA"), sunlight).convert("RGB")
    draw = ImageDraw.Draw(img, "RGBA")

    return img


def prop_terminal(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (18, 36, w - 18, h - 30), 26, 82)
    rounded(draw, (18, 18, w - 18, h - 38), 24, (45, 55, 68, 255), (202, 156, 84, 255), 8)
    rounded(draw, (56, 54, w - 56, h - 76), 18, (22, 39, 48, 255), (104, 235, 210, 180), 4)
    for i in range(5):
        x = 86 + i * ((w - 180) // 4)
        draw.line((x, 74, x + 70, 112), fill=(94, 232, 206, 110), width=5)
        draw.ellipse((x + 60, 102, x + 82, 124), fill=(246, 209, 94, 200))
    rounded(draw, (w // 2 - 70, h - 56, w // 2 + 70, h - 18), 10, (62, 70, 80, 255), (226, 183, 92, 220), 4)
    return img


def prop_steps(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    for i in range(4):
        y = 16 + i * 24
        rounded(draw, (28 + i * 20, y, w - 28 - i * 20, y + 30), 10, (154 + i * 12, 138 + i * 9, 118 + i * 8, 255), (231, 204, 145, 180), 3)
    draw.rectangle((54, h - 26, w - 54, h - 16), fill=(72, 83, 96, 175))
    return img


def prop_podium(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (42, 62, w - 42, h - 28), 24, 80)
    rounded(draw, (52, 36, w - 52, h - 42), 24, (118, 82, 58, 255), (220, 166, 82, 255), 6)
    rounded(draw, (76, 58, w - 76, 118), 16, (45, 64, 82, 255), (108, 232, 210, 170), 4)
    draw.polygon([(w // 2, 130), (w // 2 + 48, 164), (w // 2, 198), (w // 2 - 48, 164)], fill=(236, 194, 84, 210), outline=(255, 232, 150, 240))
    for x in [90, w - 118]:
        rounded(draw, (x, 136, x + 28, h - 48), 8, (58, 42, 34, 255), (212, 164, 82, 200), 3)
    return img


def prop_desk(w: int, h: int, accent: tuple[int, int, int]) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (24, 44, w - 24, h - 26), 22, 74)
    rounded(draw, (28, 32, w - 28, h - 46), 18, (111, 78, 52, 255), (219, 161, 86, 255), 5)
    rounded(draw, (52, 48, w - 52, h - 66), 12, rgba(accent, 230), (248, 215, 140, 180), 3)
    rounded(draw, (78, 58, 142, 108), 8, (231, 221, 195, 255), (143, 118, 86, 160), 3)
    draw.line((110, 62, 110, 104), fill=(151, 126, 86, 160), width=3)
    rounded(draw, (w - 138, 62, w - 68, 100), 8, (38, 54, 66, 255), (102, 230, 208, 160), 3)
    for x in [48, w - 76]:
        rounded(draw, (x, h - 62, x + 26, h - 20), 8, (62, 42, 34, 255), (191, 137, 72, 180), 2)
    return img


def prop_shelf(w: int, h: int, accent: tuple[int, int, int]) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (24, 32, w - 24, h - 22), 18, 78)
    rounded(draw, (26, 18, w - 26, h - 30), 18, (78, 56, 45, 255), (203, 151, 82, 255), 5)
    for y in range(50, h - 70, 46):
        draw.rectangle((44, y, w - 44, y + 7), fill=(221, 166, 86, 210))
        for i in range(5):
            x = 54 + i * 28
            color = accent if i % 2 == 0 else (226, 205, 142)
            rounded(draw, (x, y - 28, x + 18, y + 4), 4, rgba(color, 255))
    rounded(draw, (w // 2 - 34, h - 64, w // 2 + 34, h - 30), 8, (45, 58, 68, 255), (112, 232, 209, 160), 3)
    return img


def prop_lamp(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw.ellipse((w // 2 - 36, 18, w // 2 + 36, 90), fill=(255, 230, 128, 170))
    rounded(draw, (w // 2 - 22, 42, w // 2 + 22, 92), 14, (246, 206, 104, 255), (255, 248, 190, 220), 3)
    draw.rectangle((w // 2 - 8, 88, w // 2 + 8, h - 44), fill=(71, 62, 58, 255))
    rounded(draw, (w // 2 - 38, h - 58, w // 2 + 38, h - 20), 14, (66, 73, 82, 255), (218, 166, 86, 220), 4)
    return img


def prop_planter(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (24, 58, w - 24, h - 18), 22, 58)
    for i in range(18):
        x = 34 + i * ((w - 68) / 17)
        y = 42 + math.sin(i * 0.8) * 14
        draw.ellipse((x - 22, y - 18, x + 22, y + 18), fill=(63, 142, 76, 235))
        if i % 3 == 0:
            draw.ellipse((x - 8, y - 8, x + 8, y + 8), fill=(238, 146, 172, 230))
    rounded(draw, (26, 72, w - 26, h - 24), 18, (101, 76, 58, 255), (218, 166, 94, 220), 4)
    draw.rectangle((48, h - 48, w - 48, h - 26), fill=(66, 52, 42, 180))
    return img


def prop_exit_frame(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (22, 32, w - 18, h - 18), 28, 70)
    rounded(draw, (28, 24, w - 28, h - 24), 28, (50, 64, 78, 245), (216, 164, 82, 245), 7)
    rounded(draw, (64, 72, w - 64, h - 38), 24, (0, 0, 0, 0), (112, 230, 208, 210), 5)
    for y in range(106, h - 72, 44):
        draw.line((72, y, w - 72, y), fill=(95, 241, 216, 78), width=4)
    return img


def prop_note_pile(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (30, 52, w - 28, h - 22), 18, 66)
    for i, color in enumerate([(233, 224, 198), (214, 226, 232), (238, 210, 191), (220, 228, 190)]):
        x = 48 + i * 34
        y = 44 + (i % 2) * 16
        draw.polygon([(x, y), (x + 92, y + 14), (x + 80, y + 80), (x - 10, y + 64)], fill=rgba(color, 255), outline=(120, 98, 76, 160))
        draw.line((x + 12, y + 24, x + 70, y + 33), fill=(96, 73, 65, 120), width=3)
    rounded(draw, (34, h - 54, w - 34, h - 24), 10, (68, 78, 90, 220), (246, 196, 98, 200), 3)
    return img


def prop_banner(w: int, h: int, accent: tuple[int, int, int]) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw.line((w // 2, 20, w // 2, h - 18), fill=(211, 161, 82, 255), width=8)
    rounded(draw, (18, 32, w - 18, h - 34), 12, rgba(accent, 238), (246, 209, 130, 220), 4)
    draw.polygon([(w // 2, 76), (w // 2 + 24, 104), (w // 2, 132), (w // 2 - 24, 104)], fill=(246, 216, 118, 210))
    return img


def prop_rail(w: int, h: int) -> Image.Image:
    img, draw = high_canvas(w, h)
    draw_shadow(draw, (24, 44, w - 24, h - 18), 18, 55)
    rounded(draw, (22, 44, w - 22, 76), 12, (69, 83, 93, 255), (216, 164, 82, 220), 4)
    for x in range(48, w - 48, 56):
        rounded(draw, (x, 24, x + 22, h - 24), 7, (48, 61, 74, 255), (220, 169, 86, 180), 2)
    return img


def make_props() -> list[PropDef]:
    blue = (54, 86, 132)
    teal = (47, 116, 128)
    wine = (126, 62, 76)
    return [
        PropDef("P01", "m01_syllabus_terminal_v4", "wall terminal", "m01_syllabus_terminal_v4", 1024, 455, 560, 260, prop_terminal, None, -110, notes="syllabus terminal wall prop"),
        PropDef("S01", "m01_north_steps_v4", "steps/platform", "m01_north_steps_v4", 1024, 640, 720, 126, prop_steps, {"x": 664, "y": 590, "w": 720, "h": 46}, notes="shallow stage steps, base collision only"),
        PropDef("P02", "m01_protocol_podium_v4", "podium/platform", "m01_protocol_podium_v4", 1024, 820, 320, 230, prop_podium, {"x": 882, "y": 746, "w": 284, "h": 70}, notes="protocol-card podium"),
        PropDef("D01", "m01_west_desk_front_v4", "desk/table", "m01_west_desk_front_v4", 610, 940, 340, 160, lambda w, h: prop_desk(w, h, blue), {"x": 455, "y": 884, "w": 310, "h": 54}, notes="west upper desk"),
        PropDef("D02", "m01_west_desk_mid_v4", "desk/table", "m01_west_desk_mid_v4", 610, 1170, 340, 160, lambda w, h: prop_desk(w, h, teal), {"x": 455, "y": 1114, "w": 310, "h": 54}, notes="west middle desk"),
        PropDef("D03", "m01_west_desk_rear_v4", "desk/table", "m01_west_desk_rear_v4", 610, 1400, 340, 160, lambda w, h: prop_desk(w, h, wine), {"x": 455, "y": 1344, "w": 310, "h": 54}, notes="west lower desk"),
        PropDef("D04", "m01_east_desk_front_v4", "desk/table", "m01_east_desk_front_v4", 1438, 940, 340, 160, lambda w, h: prop_desk(w, h, blue), {"x": 1283, "y": 884, "w": 310, "h": 54}, notes="east upper desk"),
        PropDef("D05", "m01_east_desk_mid_v4", "desk/table", "m01_east_desk_mid_v4", 1438, 1170, 340, 160, lambda w, h: prop_desk(w, h, teal), {"x": 1283, "y": 1114, "w": 310, "h": 54}, notes="east middle desk"),
        PropDef("D06", "m01_east_desk_rear_v4", "desk/table", "m01_east_desk_rear_v4", 1438, 1400, 340, 160, lambda w, h: prop_desk(w, h, wine), {"x": 1283, "y": 1344, "w": 310, "h": 54}, notes="east lower desk"),
        PropDef("B01", "m01_west_bookshelf_v4", "bookshelf/cabinet", "m01_west_bookshelf_v4", 370, 570, 220, 260, lambda w, h: prop_shelf(w, h, (118, 92, 210)), {"x": 270, "y": 514, "w": 200, "h": 56}, notes="west wall bookshelf"),
        PropDef("B02", "m01_east_bookshelf_v4", "bookshelf/cabinet", "m01_east_bookshelf_v4", 1650, 570, 220, 260, lambda w, h: prop_shelf(w, h, (92, 160, 178)), {"x": 1550, "y": 514, "w": 200, "h": 56}, notes="east wall bookshelf"),
        PropDef("L01", "m01_west_lamp_v4", "lamp/light", "m01_west_lamp_v4", 835, 735, 100, 220, prop_lamp, {"x": 804, "y": 682, "w": 62, "h": 44}, notes="west scale lamp"),
        PropDef("L02", "m01_east_lamp_v4", "lamp/light", "m01_east_lamp_v4", 1213, 735, 100, 220, prop_lamp, {"x": 1182, "y": 682, "w": 62, "h": 44}, notes="east scale lamp"),
        PropDef("F01", "m01_south_left_planter_v4", "flower/planter", "m01_south_left_planter_v4", 520, 1688, 380, 150, prop_planter, {"x": 340, "y": 1635, "w": 360, "h": 50}, notes="southwest planter boundary"),
        PropDef("F02", "m01_south_right_planter_v4", "flower/planter", "m01_south_right_planter_v4", 1528, 1688, 380, 150, prop_planter, {"x": 1348, "y": 1635, "w": 360, "h": 50}, notes="southeast planter boundary"),
        PropDef("E01", "m01_east_exit_frame_v4", "exit/opening frame", "m01_east_exit_frame_v4", 1810, 850, 220, 360, prop_exit_frame, None, -150, notes="east exit visual frame; transfer uses node radius"),
        PropDef("N01", "m01_bug_note_pile_v4", "notice/spawn prop", "m01_bug_note_pile_v4", 1530, 1475, 240, 160, prop_note_pile, {"x": 1428, "y": 1424, "w": 204, "h": 52}, notes="bug-note encounter anchor"),
        PropDef("N02", "m01_wall_banner_left_v4", "notice/sign", "m01_wall_banner_left_v4", 790, 410, 110, 210, lambda w, h: prop_banner(w, h, (83, 92, 150)), None, -130, notes="left wall banner"),
        PropDef("N03", "m01_wall_banner_right_v4", "notice/sign", "m01_wall_banner_right_v4", 1258, 410, 110, 210, lambda w, h: prop_banner(w, h, (126, 70, 110)), None, -130, notes="right wall banner"),
        PropDef("R01", "m01_west_low_rail_v4", "low rail", "m01_west_low_rail_v4", 335, 1545, 300, 110, prop_rail, {"x": 200, "y": 1504, "w": 270, "h": 40}, notes="west lower guide rail"),
        PropDef("R02", "m01_east_low_rail_v4", "low rail", "m01_east_low_rail_v4", 1713, 1545, 300, 110, prop_rail, {"x": 1578, "y": 1504, "w": 270, "h": 40}, notes="east lower guide rail"),
    ]


def pack_props(props: list[PropDef]) -> tuple[Image.Image, dict, list[dict]]:
    source = Image.new("RGBA", (SOURCE_SIZE, SOURCE_SIZE), (0, 0, 0, 0))
    frames: dict[str, dict] = {}
    runtime_props: list[dict] = []
    x = 64
    y = 64
    row_h = 0

    for prop in props:
        source_w = prop.w * SOURCE_SCALE
        source_h = prop.h * SOURCE_SCALE
        if x + source_w + 64 > SOURCE_SIZE:
            x = 64
            y += row_h + 96
            row_h = 0
        if y + source_h + 64 > SOURCE_SIZE:
            raise RuntimeError("v4 prop atlas does not fit the 4096 source canvas")

        image = prop.draw_fn(source_w, source_h).convert("RGBA")
        paste_alpha(source, image, (x, y))
        frames[prop.frame] = {"x": x // SOURCE_SCALE, "y": y // SOURCE_SCALE, "w": prop.w, "h": prop.h}
        collision = deepcopy(prop.collision or {})
        depth_y = prop.y + prop.depth_offset
        runtime_props.append(
            {
                "id": prop.prop_id,
                "markerId": prop.marker_id,
                "type": prop.prop_type,
                "frame": prop.frame,
                "atlas": "m01-v4",
                "x": prop.x,
                "y": prop.y,
                "origin": {"x": 0.5, "y": 1},
                "anchor": prop.anchor,
                "scale": 1,
                "maxScale": 1,
                "depthY": depth_y,
                "depthOffset": prop.depth_offset,
                "visualBounds": {"w": prop.w, "h": prop.h},
                "collision": collision,
                "collisionFootprint": collision,
                "runtimeScalePolicy": "no-upscale-source-drawn-at-2x-downsampled-to-runtime-scale-1",
                "qaStatus": "generated-v4",
                "notes": prop.notes,
            }
        )
        x += source_w + 96
        row_h = max(row_h, source_h)

    return source, frames, runtime_props


def make_marker_entries(props: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for prop in props:
        entries.append(
            {
                "markerId": prop["markerId"],
                "type": prop["type"],
                "runtimePropId": prop["id"],
                "x": prop["x"],
                "y": prop["y"],
                "anchor": prop["anchor"],
                "targetRuntimeSize": prop["visualBounds"],
                "collisionFootprint": prop.get("collisionFootprint", {}),
                "depthY": prop["depthY"],
                "notes": prop["notes"],
            }
        )

    def circle(marker_id: str, marker_type: str, x: int, y: int, radius: int, notes: str) -> dict:
        return {
            "markerId": marker_id,
            "type": marker_type,
            "x": x,
            "y": y,
            "anchor": "center",
            "targetRuntimeSize": {"w": radius * 2, "h": radius * 2},
            "collisionFootprint": {"x": x - radius, "y": y - radius, "w": radius * 2, "h": radius * 2},
            "depthY": y,
            "notes": notes,
        }

    entries.extend(
        [
            circle("I01", "interaction node", 1024, 520, 110, "syllabus terminal trigger"),
            circle("I02", "interaction node", 1024, 790, 96, "protocol card pickup"),
            circle("I03", "interaction node", 1530, 1475, 130, "bug-note encounter trigger"),
            circle("I04", "spawn", 1024, 1685, 72, "player start spawn"),
            circle("E01N", "exit node", 1780, 700, 110, "exit trigger to prompt archive"),
            circle("C01", "combat space", 1180, 1330, 300, "first enemy-wave kite loop"),
        ]
    )
    return sorted(entries, key=lambda item: item["markerId"])


def draw_marker_master(base: Image.Image, entries: list[dict]) -> Image.Image:
    marker = base.convert("RGBA")
    overlay = Image.new("RGBA", marker.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    font = load_font(44)
    small = load_font(28)

    for entry in entries:
        marker_id = entry["markerId"]
        prefix = marker_id[0]
        color = MARKER_COLORS.get(prefix, (255, 255, 255, 160))
        x = sr(entry["x"])
        y = sr(entry["y"])
        size = entry.get("targetRuntimeSize", {"w": 120, "h": 120})
        w = sr(size.get("w", 120))
        h = sr(size.get("h", 120))
        if entry.get("anchor") == "bottom-center":
            rect = (x - w // 2, y - h, x + w // 2, y)
            rounded(draw, rect, 18, color, (255, 255, 255, 230), 4)
            label_xy = (rect[0] + 14, max(18, rect[1] + 12))
        else:
            radius = max(w, h) // 2
            rect = (x - radius, y - radius, x + radius, y + radius)
            draw.ellipse(rect, fill=color, outline=(255, 255, 255, 230), width=4)
            label_xy = (x - radius + 14, y - 20)
        text_backplate(draw, label_xy, marker_id, font)
        footprint = entry.get("collisionFootprint") or {}
        if footprint and entry["markerId"] != "C01":
            crect = (
                sr(footprint["x"]),
                sr(footprint["y"]),
                sr(footprint["x"] + footprint["w"]),
                sr(footprint["y"] + footprint["h"]),
            )
            draw.rectangle(crect, outline=(255, 66, 78, 235), width=4)
            draw.text((crect[0] + 8, crect[1] + 8), "foot", fill=(255, 225, 225, 235), font=small)

    route = [(1024, 1685), (1024, 790), (1530, 1475), (1780, 700)]
    route2 = [(sr(x), sr(y)) for x, y in route]
    draw.line(route2, fill=(70, 236, 255, 210), width=10, joint="curve")
    for x, y in route2:
        draw.ellipse((x - 18, y - 18, x + 18, y + 18), fill=(70, 236, 255, 240))

    text_backplate(draw, (sr(32), sr(32)), "M01 v4 marker base: clean board + prop anchors + 147px scale", load_font(38))
    marker.alpha_composite(overlay)
    return marker.convert("RGB")


def assemble_preview(base: Image.Image, runtime_atlas: Image.Image, props: list[dict], frames: dict) -> Image.Image:
    assembled = base.convert("RGBA")
    for prop in sorted(props, key=lambda item: item["depthY"]):
        frame = frames[prop["frame"]]
        crop = runtime_atlas.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
        x = int(round(prop["x"] - frame["w"] * prop["origin"]["x"]))
        y = int(round(prop["y"] - frame["h"] * prop["origin"]["y"]))
        paste_alpha(assembled, crop, (x, y))
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


def make_qa_overlay(assembled: Image.Image, props: list[dict], entries: list[dict]) -> Image.Image:
    qa = assembled.convert("RGBA")
    draw = ImageDraw.Draw(qa, "RGBA")
    font = load_font(26)
    title = load_font(34)

    draw.line((CHUNK_SIZE, 0, CHUNK_SIZE, RUNTIME_SIZE), fill=(255, 255, 255, 136), width=3)
    draw.line((0, CHUNK_SIZE, RUNTIME_SIZE, CHUNK_SIZE), fill=(255, 255, 255, 136), width=3)
    text_backplate(draw, (24, 24), "M01 v4 QA: clean base, scale-1 props, foot collisions", title)

    for prop in props:
        c = prop.get("collisionFootprint") or {}
        if c:
            draw.rectangle((c["x"], c["y"], c["x"] + c["w"], c["y"] + c["h"]), outline=(255, 65, 85, 230), fill=(255, 65, 85, 42), width=3)
            draw.text((c["x"] + 5, c["y"] + 4), prop["markerId"], fill=(255, 235, 235, 240), font=font)

    for rect in base_obstacles():
        draw.rectangle((rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["h"]), outline=(255, 176, 66, 165), width=2)

    lina = crop_lina()
    for label, x, y in [
        ("spawn", 1024, 1685),
        ("desk lane", 810, 1180),
        ("podium", 1024, 820),
        ("combat", 1320, 1390),
        ("exit", 1780, 700),
    ]:
        paste_alpha(qa, lina, (x - LINA_RUNTIME_HEIGHT // 2, y - LINA_RUNTIME_HEIGHT))
        draw.line((x - 30, y, x + 30, y), fill=(255, 255, 255, 220), width=2)
        text_backplate(draw, (x + 16, y - LINA_RUNTIME_HEIGHT + 6), label, font)

    for entry in entries:
        if entry["markerId"][0] in {"I", "E", "C"}:
            x, y = entry["x"], entry["y"]
            draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(80, 235, 255, 230))
            draw.text((x + 14, y - 12), entry["markerId"], fill=(250, 255, 255, 240), font=font)

    text_backplate(draw, (24, 1980), "All prop scale values are 1. Red boxes are collisionFootprint, not visual bounds.", font)
    return qa.convert("RGB")


def base_obstacles() -> list[dict]:
    return [
        {"id": "m01_v4_north_wall", "type": "wall", "x": 0, "y": 0, "w": 2048, "h": 330},
        {"id": "m01_v4_west_wall", "type": "wall", "x": 0, "y": 0, "w": 235, "h": 2048},
        {"id": "m01_v4_east_wall_north", "type": "wall", "x": 1810, "y": 0, "w": 238, "h": 560},
        {"id": "m01_v4_east_wall_south", "type": "wall", "x": 1810, "y": 840, "w": 238, "h": 1208},
        {"id": "m01_v4_south_wall_west", "type": "wall", "x": 0, "y": 1790, "w": 850, "h": 258},
        {"id": "m01_v4_south_wall_east", "type": "wall", "x": 1198, "y": 1790, "w": 850, "h": 258},
    ]


def runtime_prop_for_registry(prop: dict) -> dict:
    payload = {
        "id": prop["id"],
        "markerId": prop["markerId"],
        "frame": prop["frame"],
        "atlas": prop["atlas"],
        "x": prop["x"],
        "y": prop["y"],
        "origin": prop["origin"],
        "anchor": prop["anchor"],
        "scale": 1,
        "maxScale": 1,
        "depthY": prop["depthY"],
        "depthOffset": prop["depthOffset"],
        "visualBounds": prop["visualBounds"],
        "collisionFootprint": prop["collisionFootprint"],
    }
    if prop.get("collision"):
        payload["collision"] = prop["collision"]
    return payload


def with_existing(existing: list[dict], item_id: str, overrides: dict) -> dict:
    base = next((deepcopy(item) for item in existing if item.get("id") == item_id), {"id": item_id})
    base.update(overrides)
    return base


def build_m01_runtime_payload(current_m01: dict, frames: dict, props: list[dict]) -> dict:
    nodes = current_m01.get("interactionNodes", [])
    enemies = current_m01.get("enemySpawns", [])
    exits = current_m01.get("exitPoints", [])
    m01 = deepcopy(current_m01)
    m01["assetPackage"] = {
        "id": "ch1-m01-formal-v4",
        "status": "active-runtime",
        "manifest": rel(OUT["placement_manifest"]),
        "markerManifest": rel(OUT["marker_manifest"]),
        "markerBase": rel(OUT["marker_runtime"]),
        "qaOverlay": rel(OUT["runtime_qa"]),
        "sop": "clean board background, marker-first placement, scale-1 prop atlas, foot collisions",
    }
    m01["background"] = {
        "key": "ch1-map-classroom-spawn-bg",
        "path": rel(OUT["runtime_base"]),
        "width": RUNTIME_SIZE,
        "height": RUNTIME_SIZE,
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
            for suffix, x, y in CHUNKS
        ],
    }
    m01["spawn"] = {
        "id": "ch1_m01_spawn_player_start",
        "x": 1024,
        "y": 1685,
        "facing": "N",
        "setFlags": ["ch1_intro_entered_classroom"],
    }
    m01["spawnPoints"] = [
        {"id": "ch1_m01_spawn_player_start", "x": 1024, "y": 1685, "facing": "N"},
        {"id": "ch1_m01_spawn_from_archive", "x": 1706, "y": 708, "facing": "W"},
    ]
    m01["camera"] = {"startX": 1024, "startY": 1320}
    m01["obstacles"] = base_obstacles()
    m01["propAtlases"] = [{"id": "m01-v4", "key": "ch1-m01-props-atlas-v4", "path": rel(OUT["props_runtime"]), "frames": frames}]
    m01["foregroundAtlases"] = [{"id": "m01-foreground-v4", "key": "ch1-m01-foreground-atlas-v4", "path": rel(OUT["foreground_runtime"]), "frames": frames}]
    m01["props"] = [runtime_prop_for_registry(prop) for prop in props]
    m01["foregroundOverlays"] = []
    m01["minimapImage"] = {
        "key": "ch1-map-classroom-spawn-assembled-v4",
        "path": rel(OUT["runtime_assembled"]),
        "width": RUNTIME_SIZE,
        "height": RUNTIME_SIZE,
    }
    m01["interactionNodes"] = [
        with_existing(nodes, "ch1_m01_node_syllabus_terminal", {"x": 1024, "y": 520, "radius": 110}),
        with_existing(nodes, "ch1_m01_node_protocol_deck", {"x": 1024, "y": 790, "radius": 96}),
        with_existing(nodes, "ch1_m01_node_bug_notes", {"x": 1530, "y": 1475, "radius": 130}),
    ]
    m01["enemySpawns"] = [
        with_existing(enemies, "ch1-m01-demand-bug-west", {"x": 860, "y": 1435, "group": "ch1_m01_encounter_bug_notes"}),
        with_existing(enemies, "ch1-m01-demand-bug-east", {"x": 1320, "y": 1410, "group": "ch1_m01_encounter_bug_notes"}),
        with_existing(enemies, "ch1-m01-demand-bug-center", {"x": 1120, "y": 1245, "group": "ch1_m01_encounter_bug_notes"}),
    ]
    m01["exitPoints"] = [
        with_existing(
            exits,
            "ch1_m01_exit_to_m02",
            {
                "type": "teleport",
                "x": 1780,
                "y": 700,
                "radius": 110,
                "targetMapId": "ch1_m02_prompt_archive",
                "targetSpawnId": "ch1_m02_spawn_from_classroom",
                "requiresFlags": ["ch1_intro_card_claimed", "ch1_m01_bug_notes_cleared"],
                "setFlags": ["ch1_m01_cleared", "ch1_m02_unlocked"],
                "lockedDialogueId": "ch1_m01_dialogue_exit_locked",
            },
        )
    ]
    return m01


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_registry(frames: dict, props: list[dict]) -> dict:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    registry["version"] = "0.5.0"
    current = registry["maps"]["ch1_m01_classroom_spawn"]
    registry["maps"]["ch1_m01_classroom_spawn"] = build_m01_runtime_payload(current, frames, props)
    write_json(REGISTRY_PATH, registry)
    return registry["maps"]["ch1_m01_classroom_spawn"]


def update_legacy_map(m01: dict) -> None:
    if not LEGACY_MAP_PATH.exists():
        return
    legacy = json.loads(LEGACY_MAP_PATH.read_text(encoding="utf-8"))
    for key in [
        "background",
        "spawn",
        "spawnPoints",
        "camera",
        "obstacles",
        "propAtlases",
        "foregroundAtlases",
        "props",
        "foregroundOverlays",
        "minimapImage",
        "interactionNodes",
        "enemySpawns",
        "exitPoints",
        "assetPackage",
    ]:
        legacy[key] = deepcopy(m01[key])
    legacy["runtime"] = {
        "kind": "layered-board-map-v4",
        "tileSize": 64,
        "world": {"width": RUNTIME_SIZE, "height": RUNTIME_SIZE},
        "activeRegistry": rel(REGISTRY_PATH),
        "materializationNote": "m01 v4 is a clean board background plus runtime props; no furniture is baked into the base.",
    }
    legacy["tilePlan"] = {
        "kind": "orthographic-board-v4",
        "cleanBaseRules": [
            "floor only",
            "outer walls or boundaries only",
            "south and east openings only",
            "basic light and shadow only",
            "no furniture or marker labels in runtime base",
        ],
        "walkableCorridors": [
            {"id": "m01_v4_south_entry", "x": 850, "y": 1685, "w": 348, "h": 363},
            {"id": "m01_v4_center_aisle", "x": 820, "y": 650, "w": 408, "h": 1050},
            {"id": "m01_v4_west_loop", "x": 235, "y": 620, "w": 215, "h": 1000},
            {"id": "m01_v4_east_loop", "x": 1598, "y": 620, "w": 212, "h": 1000},
            {"id": "m01_v4_east_exit", "x": 1680, "y": 560, "w": 368, "h": 280},
        ],
    }
    legacy["propFrames"] = {}
    legacy["macroPropFrames"] = {}
    legacy["version"] = "0.5.0"
    legacy["status"] = "active-layered-board-v4"
    legacy["summary"] = "Chapter 1 entry map redesigned as a clean board base plus runtime-controlled props, depth, and foot collisions."
    write_json(LEGACY_MAP_PATH, legacy)


def make_placement_manifest(frames: dict, props: list[dict], marker_entries: list[dict]) -> dict:
    return {
        "$schema": "https://efv.local/schemas/layered-map-manifest-v4.json",
        "id": "ch1_m01_classroom_spawn_formal_v4",
        "mapId": "ch1_m01_classroom_spawn",
        "status": "active-runtime-redesign-v4",
        "runtimeSource": "assets/chapter1/chapter1-maps-v1.json#maps.ch1_m01_classroom_spawn",
        "productionDate": date.today().isoformat(),
        "sop": [
            "marker-first orthographic layout",
            "base expansion contains only floor, outer wall, openings, light, and markers",
            "clean runtime base removes markers and contains no furniture props",
            "prop atlas is source larger than runtime and downsampled",
            "runtime prop scale is 1 and never enlarged",
            "collision uses foot/base rectangles only",
        ],
        "resolution": {
            "sourceMaster": {"w": SOURCE_SIZE, "h": SOURCE_SIZE},
            "runtime": {"w": RUNTIME_SIZE, "h": RUNTIME_SIZE},
            "runtimeChunk": {"w": CHUNK_SIZE, "h": CHUNK_SIZE},
            "overlapReference": {"pixels": OVERLAP, "note": "source quadrants retain 256 px overlap for four-grid expansion review"},
        },
        "scale": {
            "runtimePlayerPx": LINA_RUNTIME_HEIGHT,
            "runtimePropScalePolicy": "all v4 props are drawn at 2x source and downsampled; runtime scale is 1",
        },
        "baseBackground": {
            "markerMaster": rel(OUT["marker_master"]),
            "markerRuntime": rel(OUT["marker_runtime"]),
            "markerManifest": rel(OUT["marker_manifest"]),
            "sourceMaster": rel(OUT["base_master"]),
            "runtimeAsset": rel(OUT["runtime_base"]),
            "assembledPreview": rel(OUT["runtime_assembled"]),
            "qaOverlay": rel(OUT["runtime_qa"]),
            "sourceQuadrants": {
                "ul": rel(OUT["base_ul"]),
                "ur": rel(OUT["base_ur"]),
                "lr": rel(OUT["base_lr"]),
                "ll": rel(OUT["base_ll"]),
            },
        },
        "runtimeChunks": {suffix: rel(CHUNKS_DIR / f"ch1-m01-base-v4-{suffix}.png") for suffix, _x, _y in CHUNKS},
        "propAtlas": {"id": "m01-v4", "key": "ch1-m01-props-atlas-v4", "sourcePath": rel(OUT["props_master"]), "path": rel(OUT["props_runtime"]), "frames": frames},
        "foregroundAtlas": {"id": "m01-foreground-v4", "key": "ch1-m01-foreground-atlas-v4", "sourcePath": rel(OUT["foreground_master"]), "path": rel(OUT["foreground_runtime"]), "frames": frames},
        "markers": marker_entries,
        "props": props,
        "baseObstacles": base_obstacles(),
        "qa": {
            "checks": [
                "clean runtime base has no desks, podium, shelves, planters, rails, or door frames",
                "marker image contains D/P/S/E/I/C anchors",
                "runtime prop scales are all 1",
                "each collidable prop has collisionFootprint",
                "QA overlay includes 147 px Lina references",
            ]
        },
    }


def write_usage_doc(props: list[dict]) -> None:
    rows = "\n".join(
        f"| `{prop['markerId']}` | `{prop['id']}` | {prop['x']} | {prop['y']} | {prop['visualBounds']['w']} x {prop['visualBounds']['h']} | `{prop['runtimeScalePolicy']}` |"
        for prop in props
    )
    prompt = """Use case: stylized-concept
Asset type: orthographic runtime game map and prop atlas
Primary request: generate an orthographic marker-first classroom board map for EFV chapter 1 m01.
Scene/backdrop: clean board only, floor tiles, outer walls or fences, two openings, basic light and shadow, colored numbered anchors.
Subject: no furniture in the base image; desks, stage steps, podium, shelves, railings, flower boxes, door frame, lamps, and note pile are separate props.
Style/medium: crisp top-down 2D game art, no perspective, horizontal and vertical alignment.
Composition/framing: square 2048 runtime / 4096 source, preserve 200-300 px overlap for four-grid expansion.
Scale reference: 147 px runtime Lina character, props generated larger than runtime then downsampled; runtime scale must be <= 1.
Constraints: final clean base removes marker labels; prop atlas has transparent background; collision uses only foot/base rectangles.
Avoid: baked furniture in background, perspective room painting, duplicate prop silhouettes, shadows that imply fixed collision, text-dependent readability."""
    content = f"""# ch1-m01 Formal v4 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-v4
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: {date.today().isoformat()}
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `{rel(OUT['placement_manifest'])}`
- `marker_manifest`: `{rel(OUT['marker_manifest'])}`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `{rel(OUT['runtime_base'])}` |
| marker base | `{rel(OUT['marker_runtime'])}` |
| assembled minimap / review | `{rel(OUT['runtime_assembled'])}` |
| QA overlay | `{rel(OUT['runtime_qa'])}` |
| runtime prop atlas | `{rel(OUT['props_runtime'])}` |
| source clean base | `{rel(OUT['base_master'])}` |
| source prop atlas | `{rel(OUT['props_master'])}` |
| overlap quadrants | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v4-*-overlap-2304.png` |

## Prop Placement

The clean base contains no furniture. Every prop below is drawn from the atlas at `scale: 1`; collision uses `collisionFootprint`.

| marker | prop id | x | y | runtime size | scale policy |
| --- | --- | ---: | ---: | --- | --- |
{rows}

## Image Generation Prompt Contract

```text
{prompt}
```

## QA Notes

- `ch1-map-classroom-spawn-assembled-qa-v4.png` overlays 147 px Lina at spawn, desk lane, podium, combat space, and exit.
- Red rectangles are foot/base collisions; visual bounds are intentionally larger.
- Source quadrants keep 256 px overlap in the order UL -> UR -> LR -> LL.
"""
    OUT["usage_doc"].write_text(content, encoding="utf-8")


def update_asset_index() -> None:
    if not ASSET_INDEX_PATH.exists():
        return
    text = ASSET_INDEX_PATH.read_text(encoding="utf-8")
    v4_section = """## m01 v4 Board Runtime Package

The active `ch1_m01_classroom_spawn` runtime now uses the formal v4 board package. This pass follows the marker-first SOP: the marker image holds the references, while the clean runtime background is only floor, outer walls or boundaries, openings, and light. Desks, steps, podium, shelves, rails, planters, exit frame, lamps, and the bug-note pile are independent atlas props. Runtime prop scale is `1`, and collision uses foot/base rectangles.

| asset id | path | use |
| --- | --- | --- |
| `ch1-m01-marker-base-master-4096-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-base-master-4096-v4.png` | 4096 marker concept with D/P/S/E/I/C anchors, route, and collision guides |
| `ch1-m01-marker-manifest-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-marker-manifest-v4.json` | marker ids, runtime coordinates, visual bounds, depth, and collision footprints |
| `ch1-m01-base-master-4096-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-master-4096-v4.png` | 2x source master for the clean board base |
| `ch1-m01-base-v4-overlap-quadrants` | `assets/chapter1/maps/ch1_m01_classroom_spawn/source/ch1-m01-base-v4-*-overlap-2304.png` | UL/UR/LR/LL source quadrants with 256 px overlap |
| `ch1-map-classroom-spawn-base-v4-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-base-v4-2048.png` | active clean runtime base |
| `ch1-m01-base-v4-runtime-chunks` | `assets/chapter1/maps/ch1_m01_classroom_spawn/chunks/ch1-m01-base-v4-*.png` | active 1024 x 1024 runtime chunks |
| `ch1-m01-props-atlas-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/props/ch1-m01-props-atlas-v4.png` | active transparent runtime prop atlas |
| `ch1-map-classroom-spawn-assembled-v4-2048` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-v4-2048.png` | active minimap and review composite |
| `ch1-map-classroom-spawn-assembled-qa-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/background/ch1-map-classroom-spawn-assembled-qa-v4.png` | 147 px Lina checks, collision boxes, and seam guides |
| `ch1-m01-layered-map-manifest-v4` | `assets/chapter1/maps/ch1_m01_classroom_spawn/ch1-m01-layered-map-manifest-v4.json` | active v4 placement manifest and QA checklist |

"""
    start = text.find("## m01 v4 Board Runtime Package")
    if start != -1:
        end = text.find("## m01 v3 Formal Runtime Package", start)
        if end != -1:
            text = text[:start] + v4_section + text[end:]
    else:
        marker = "## m01 v3 Formal Runtime Package"
        text = text.replace(marker, v4_section + marker, 1)
    text = text.replace("M1 now uses the formal v3 package", "M1 now uses the formal v4 board package")
    text = text.replace("keep the v3 manifest contract", "keep the v4 marker/prop manifest contract")
    ASSET_INDEX_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    ensure_dirs()
    base_master = make_base_master()
    base_master.save(OUT["base_master"])
    runtime_base = base_master.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS)
    runtime_base.save(OUT["runtime_base"])

    quadrants = {
        "base_ul": (0, 0, SOURCE_SIZE // 2 + OVERLAP, SOURCE_SIZE // 2 + OVERLAP),
        "base_ur": (SOURCE_SIZE // 2 - OVERLAP, 0, SOURCE_SIZE, SOURCE_SIZE // 2 + OVERLAP),
        "base_lr": (SOURCE_SIZE // 2 - OVERLAP, SOURCE_SIZE // 2 - OVERLAP, SOURCE_SIZE, SOURCE_SIZE),
        "base_ll": (0, SOURCE_SIZE // 2 - OVERLAP, SOURCE_SIZE // 2 + OVERLAP, SOURCE_SIZE),
    }
    for key, box in quadrants.items():
        base_master.crop(box).save(OUT[key])

    for suffix, x, y in CHUNKS:
        runtime_base.crop((x, y, x + CHUNK_SIZE, y + CHUNK_SIZE)).save(CHUNKS_DIR / f"ch1-m01-base-v4-{suffix}.png")

    prop_defs = make_props()
    source_atlas, frames, props = pack_props(prop_defs)
    source_atlas.save(OUT["props_master"])
    source_atlas.save(OUT["foreground_master"])
    runtime_atlas = source_atlas.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS)
    runtime_atlas.save(OUT["props_runtime"])
    runtime_atlas.save(OUT["foreground_runtime"])

    marker_entries = make_marker_entries(props)
    marker_manifest = {
        "$schema": "https://efv.local/schemas/ch1-marker-manifest-v1.json",
        "id": "ch1-m01-marker-manifest-v4",
        "mapId": "ch1_m01_classroom_spawn",
        "runtimeSize": {"w": RUNTIME_SIZE, "h": RUNTIME_SIZE},
        "sourceSize": {"w": SOURCE_SIZE, "h": SOURCE_SIZE},
        "coordinateSystem": "runtime coordinates; marker concept image is 2x",
        "characterReference": {"id": "lina", "runtimeHeightPx": LINA_RUNTIME_HEIGHT},
        "markers": marker_entries,
    }
    write_json(OUT["marker_manifest"], marker_manifest)
    marker_master = draw_marker_master(base_master, marker_entries)
    marker_master.save(OUT["marker_master"])
    marker_master.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS).save(OUT["marker_runtime"])

    assembled = assemble_preview(runtime_base, runtime_atlas, props, frames)
    assembled.save(OUT["runtime_assembled"])
    make_qa_overlay(assembled, props, marker_entries).save(OUT["runtime_qa"])

    placement_manifest = make_placement_manifest(frames, props, marker_entries)
    write_json(OUT["placement_manifest"], placement_manifest)
    m01 = update_registry(frames, props)
    update_legacy_map(m01)
    write_usage_doc(props)
    update_asset_index()

    print("Generated ch1_m01 formal v4 board asset package")
    for key, path in OUT.items():
        print(f"{key}: {rel(path)}")
    for suffix, _x, _y in CHUNKS:
        print(f"chunk_{suffix}: {rel(CHUNKS_DIR / f'ch1-m01-base-v4-{suffix}.png')}")


if __name__ == "__main__":
    main()
