from __future__ import annotations

import json
import math
from copy import deepcopy
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "assets" / "chapter1" / "maps" / "ch1_m01_classroom_spawn"
SOURCE_DIR = MAP_DIR / "source"
BACKGROUND_DIR = MAP_DIR / "background"
CHUNKS_DIR = MAP_DIR / "chunks"
PROPS_DIR = MAP_DIR / "props"
FOREGROUND_DIR = MAP_DIR / "foreground"

V2_MANIFEST_PATH = MAP_DIR / "ch1-m01-layered-map-manifest-v2.json"
V2_BASE_PATH = BACKGROUND_DIR / "ch1-map-classroom-spawn-base-v2-scale80-2048.png"
V2_ATLAS_PATH = PROPS_DIR / "ch1-m01-props-atlas-v2.png"
LINA_SPRITE_PATH = ROOT / "assets" / "sprites" / "lina-sprites-v10-anchored-expanded.png"
REGISTRY_PATH = ROOT / "assets" / "chapter1" / "chapter1-maps-v1.json"

RUNTIME_SIZE = 2048
SOURCE_SIZE = 4096
LINA_RUNTIME_HEIGHT = 147

OUT = {
    "marker_master": SOURCE_DIR / "ch1-m01-marker-base-master-4096-v3.png",
    "marker_manifest": SOURCE_DIR / "ch1-m01-marker-manifest-v3.json",
    "base_master": SOURCE_DIR / "ch1-m01-base-master-4096-v3.png",
    "base_ul": SOURCE_DIR / "ch1-m01-base-v3-ul-2048.png",
    "base_ur": SOURCE_DIR / "ch1-m01-base-v3-ur-2048.png",
    "base_lr": SOURCE_DIR / "ch1-m01-base-v3-lr-2048.png",
    "base_ll": SOURCE_DIR / "ch1-m01-base-v3-ll-2048.png",
    "runtime_base": BACKGROUND_DIR / "ch1-map-classroom-spawn-base-v3-2048.png",
    "runtime_assembled": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-v3-2048.png",
    "runtime_qa": BACKGROUND_DIR / "ch1-map-classroom-spawn-assembled-qa-v3.png",
    "props_master": SOURCE_DIR / "ch1-m01-props-atlas-master-4096-v3.png",
    "foreground_master": SOURCE_DIR / "ch1-m01-foreground-atlas-master-4096-v3.png",
    "props_runtime": PROPS_DIR / "ch1-m01-props-atlas-v3.png",
    "foreground_runtime": FOREGROUND_DIR / "ch1-m01-foreground-atlas-v3.png",
    "placement_manifest": MAP_DIR / "ch1-m01-layered-map-manifest-v3.json",
}

CHUNKS = [
    ("nw", 0, 0),
    ("ne", 1024, 0),
    ("sw", 0, 1024),
    ("se", 1024, 1024),
]

MARKER_BY_PROP_ID = {
    "m01_protocol_podium_v2": ("P01", "podium/platform", "protocol-card podium"),
    "m01_west_desk_top_v2": ("D01", "desk/table", "west upper protocol desk"),
    "m01_west_desk_lower_v2": ("D02", "desk/table", "west lower protocol desk"),
    "m01_east_desk_top_v2": ("D03", "desk/table", "east upper protocol desk"),
    "m01_east_desk_lower_v2": ("D04", "desk/table", "east lower protocol desk"),
    "m01_west_bookshelf_v2": ("B01", "bookshelf/cabinet", "west wall archive shelf"),
    "m01_east_bookshelf_v2": ("B02", "bookshelf/cabinet", "east wall archive shelf"),
    "m01_west_podium_lamp_v2": ("L01", "lamp/light", "west podium lamp"),
    "m01_east_podium_lamp_v2": ("L02", "lamp/light", "east podium lamp"),
    "m01_south_left_planter_v2": ("F01", "flower/planter", "southwest planter boundary"),
    "m01_south_right_planter_v2": ("F02", "flower/planter", "southeast planter boundary"),
    "m01_notice_board_v2": ("N01", "notice/sign", "bug-note notice board"),
    "m01_west_globe_v2": ("G01", "globe/decor", "west globe decor"),
    "m01_wall_banner_left_v2": ("N02", "notice/sign", "left wall banner"),
    "m01_wall_banner_right_v2": ("N03", "notice/sign", "right wall banner"),
}

MARKER_COLORS = {
    "D": (50, 140, 240, 168),
    "P": (245, 182, 55, 176),
    "L": (255, 240, 95, 176),
    "B": (150, 100, 235, 164),
    "F": (76, 190, 110, 164),
    "R": (82, 210, 220, 160),
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
    candidates = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/calibri.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


def paste_alpha(canvas: Image.Image, image: Image.Image, xy: tuple[int, int]) -> None:
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    canvas.alpha_composite(image, dest=xy)


def draw_text_with_backplate(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont) -> None:
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


def scaled_frame_size(frame: dict, scale: float) -> tuple[int, int]:
    return (
        max(1, int(round(frame["w"] * scale))),
        max(1, int(round(frame["h"] * scale))),
    )


def pack_runtime_frames(manifest: dict, atlas: Image.Image) -> tuple[Image.Image, dict, list[dict]]:
    props = manifest["props"]
    frames = manifest["propAtlas"]["frames"]
    source_canvas = Image.new("RGBA", (SOURCE_SIZE, SOURCE_SIZE), (0, 0, 0, 0))
    runtime_frames: dict[str, dict] = {}
    runtime_props: list[dict] = []

    x = 64
    y = 64
    row_h = 0

    for prop in props:
        marker_id, marker_type, _note = MARKER_BY_PROP_ID.get(prop["id"], ("I99", "interaction", prop["id"]))
        src_frame = frames[prop["frame"]]
        crop = atlas.crop(
            (
                src_frame["x"],
                src_frame["y"],
                src_frame["x"] + src_frame["w"],
                src_frame["y"] + src_frame["h"],
            )
        )
        scale = float(prop.get("scale", 1))
        rw, rh = scaled_frame_size(src_frame, scale)
        sw, sh = rw * 2, rh * 2
        if x + sw + 64 > SOURCE_SIZE:
            x = 64
            y += row_h + 96
            row_h = 0
        if y + sh + 64 > SOURCE_SIZE:
            raise RuntimeError("v3 prop atlas does not fit the 4096 source canvas")

        resized = crop.resize((sw, sh), Image.Resampling.LANCZOS)
        paste_alpha(source_canvas, resized, (x, y))
        frame_name = prop["id"].replace("_v2", "_v3")
        runtime_frames[frame_name] = {"x": x // 2, "y": y // 2, "w": rw, "h": rh}

        collision = deepcopy(prop.get("collision", {}))
        runtime_props.append(
            {
                "id": frame_name,
                "markerId": marker_id,
                "type": marker_type,
                "frame": frame_name,
                "atlas": "m01-v3",
                "x": int(round(prop["x"])),
                "y": int(round(prop["y"])),
                "origin": deepcopy(prop.get("origin", {"x": 0.5, "y": 1})),
                "scale": 1,
                "maxScale": 1,
                "depthY": int(round(prop["y"] + prop.get("depthOffset", 0))),
                "depthOffset": int(round(prop.get("depthOffset", 0))),
                "visualBounds": {"w": rw, "h": rh},
                "collision": collision,
                "collisionFootprint": collision,
                "runtimeScalePolicy": "no-upscale-scale-baked-into-v3-atlas",
                "sourceFrame": prop["frame"],
                "sourceRuntimeScale": scale,
                "qaStatus": "generated-awaiting-browser-check",
            }
        )
        x += sw + 96
        row_h = max(row_h, sh)

    return source_canvas, runtime_frames, runtime_props


def make_marker_entries(runtime_props: list[dict], map_data: dict) -> list[dict]:
    entries: list[dict] = []
    for prop in runtime_props:
        bounds = prop["visualBounds"]
        collision = prop.get("collision") or {}
        marker_id = prop["markerId"]
        _mid, _type, note = MARKER_BY_PROP_ID.get(prop["sourceFrame"].replace("_v3", "_v2"), (marker_id, prop["type"], prop["id"]))
        entries.append(
            {
                "markerId": marker_id,
                "type": prop["type"],
                "runtimePropId": prop["id"],
                "x": prop["x"],
                "y": prop["y"],
                "anchor": "bottom-center",
                "targetRuntimeSize": {"w": bounds["w"], "h": bounds["h"]},
                "collisionFootprint": collision,
                "depthY": prop["depthY"],
                "notes": note,
            }
        )

    def circle_marker(marker_id: str, marker_type: str, x: int, y: int, radius: int, notes: str) -> dict:
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

    m01 = map_data["maps"]["ch1_m01_classroom_spawn"]
    spawn = m01["spawn"]
    entries.extend(
        [
            circle_marker("I01", "interaction node", 1024, 469, 96, "syllabus board trigger"),
            circle_marker("I02", "interaction node", 1024, 637, 88, "protocol card pickup"),
            circle_marker("I03", "interaction node", 1437, 1269, 112, "bug-note encounter trigger"),
            circle_marker("I04", "spawn", int(spawn["x"]), int(spawn["y"]), 70, "player spawn"),
            circle_marker("E01", "exit/portal", 1715, 549, 96, "exit to ch1_m02_prompt_archive"),
            circle_marker("C01", "combat space", 1024, 1240, 260, "first enemy-wave kite area"),
        ]
    )
    return sorted(entries, key=lambda item: item["markerId"])


def draw_marker_master(base_master: Image.Image, entries: list[dict]) -> Image.Image:
    marker = base_master.convert("RGBA")
    overlay = Image.new("RGBA", marker.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = load_font(42)
    small_font = load_font(30)

    for entry in entries:
        prefix = entry["markerId"][0]
        color = MARKER_COLORS.get(prefix, (255, 255, 255, 168))
        x = int(entry["x"] * 2)
        y = int(entry["y"] * 2)
        size = entry.get("targetRuntimeSize", {"w": 120, "h": 120})
        w = int(size.get("w", 120) * 2)
        h = int(size.get("h", 120) * 2)
        if entry.get("anchor") == "bottom-center":
            rect = (x - w // 2, y - h, x + w // 2, y)
            draw.rounded_rectangle(rect, radius=18, fill=color, outline=(255, 255, 255, 230), width=4)
            label_xy = (rect[0] + 12, max(12, rect[1] + 10))
        else:
            r = max(w, h) // 2
            rect = (x - r, y - r, x + r, y + r)
            draw.ellipse(rect, fill=color, outline=(255, 255, 255, 230), width=4)
            label_xy = (x - r + 12, y - 18)
        draw_text_with_backplate(draw, label_xy, entry["markerId"], font)
        if "collisionFootprint" in entry and entry["collisionFootprint"]:
            c = entry["collisionFootprint"]
            crect = (
                int(c["x"] * 2),
                int(c["y"] * 2),
                int((c["x"] + c["w"]) * 2),
                int((c["y"] + c["h"]) * 2),
            )
            draw.rectangle(crect, outline=(255, 70, 80, 230), width=4)
            draw.text((crect[0] + 8, crect[1] + 8), "foot", fill=(255, 220, 220, 230), font=small_font)

    route = [(1024, 1581), (1024, 637), (1437, 1269), (1715, 549)]
    route2 = [(x * 2, y * 2) for x, y in route]
    draw.line(route2, fill=(90, 240, 255, 210), width=10, joint="curve")
    for x, y in route2:
        draw.ellipse((x - 16, y - 16, x + 16, y + 16), fill=(90, 240, 255, 240))

    marker.alpha_composite(overlay)
    return marker.convert("RGB")


def assemble_preview(base: Image.Image, runtime_atlas: Image.Image, props: list[dict], frames: dict) -> Image.Image:
    assembled = base.convert("RGBA")
    for prop in sorted(props, key=lambda item: item.get("depthY", item["y"])):
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
    x = (LINA_RUNTIME_HEIGHT - trimmed.width) // 2
    y = LINA_RUNTIME_HEIGHT - trimmed.height
    paste_alpha(out, trimmed, (x, y))
    return out


def make_qa_overlay(assembled: Image.Image, props: list[dict], entries: list[dict]) -> Image.Image:
    qa = assembled.convert("RGBA")
    draw = ImageDraw.Draw(qa, "RGBA")
    font = load_font(26)
    title_font = load_font(34)

    draw.line((1024, 0, 1024, RUNTIME_SIZE), fill=(255, 255, 255, 130), width=3)
    draw.line((0, 1024, RUNTIME_SIZE, 1024), fill=(255, 255, 255, 130), width=3)
    draw_text_with_backplate(draw, (28, 28), "M1 v3 QA: 147px Lina / collisions / seams", title_font)

    for prop in props:
        c = prop.get("collision")
        if c:
            draw.rectangle(
                (c["x"], c["y"], c["x"] + c["w"], c["y"] + c["h"]),
                outline=(255, 65, 85, 230),
                fill=(255, 65, 85, 44),
                width=3,
            )
            draw.text((c["x"] + 4, c["y"] + 4), prop["markerId"], fill=(255, 235, 235, 240), font=font)

    lina = crop_lina()
    lina_points = [
        ("spawn", 1024, 1581),
        ("desk", 730, 1070),
        ("lamp", 861, 775),
        ("exit", 1715, 549),
        ("podium", 1024, 710),
    ]
    for label, x, y in lina_points:
        paste_alpha(qa, lina, (x - LINA_RUNTIME_HEIGHT // 2, y - LINA_RUNTIME_HEIGHT))
        draw.line((x - 28, y, x + 28, y), fill=(255, 255, 255, 210), width=2)
        draw_text_with_backplate(draw, (x + 14, y - LINA_RUNTIME_HEIGHT + 4), label, font)

    for entry in entries:
        if entry["markerId"].startswith(("E", "I", "C")):
            x, y = entry["x"], entry["y"]
            draw.ellipse((x - 10, y - 10, x + 10, y + 10), fill=(80, 235, 255, 230))
            draw.text((x + 14, y - 12), entry["markerId"], fill=(250, 255, 255, 240), font=font)

    draw_text_with_backplate(
        draw,
        (28, 1980),
        "Runtime prop scale: all v3 props scale=1; red boxes are foot/base collision only.",
        font,
    )
    return qa.convert("RGB")


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def update_registry(frames: dict, props: list[dict]) -> None:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    registry["version"] = "0.4.0"
    m01 = registry["maps"]["ch1_m01_classroom_spawn"]
    m01["assetPackage"] = {
        "id": "ch1-m01-formal-v3",
        "status": "active-runtime",
        "manifest": rel(OUT["placement_manifest"]),
        "markerManifest": rel(OUT["marker_manifest"]),
        "qaOverlay": rel(OUT["runtime_qa"]),
    }
    m01["background"]["path"] = rel(OUT["runtime_base"])
    m01["background"]["chunks"] = [
        {
            "id": f"ch1-m01-spawn-{suffix}",
            "key": f"ch1-m01-spawn-{suffix}",
            "path": rel(CHUNKS_DIR / f"ch1-m01-base-v3-{suffix}.png"),
            "x": x,
            "y": y,
            "width": 1024,
            "height": 1024,
        }
        for suffix, x, y in CHUNKS
    ]
    m01["minimapImage"] = {
        "key": "ch1-map-classroom-spawn-assembled-v3",
        "path": rel(OUT["runtime_assembled"]),
        "width": RUNTIME_SIZE,
        "height": RUNTIME_SIZE,
    }
    m01["propAtlases"] = [
        {
            "id": "m01-v3",
            "key": "ch1-m01-props-atlas-v3",
            "path": rel(OUT["props_runtime"]),
            "frames": frames,
        }
    ]
    m01["foregroundAtlases"] = [
        {
            "id": "m01-foreground-v3",
            "key": "ch1-m01-foreground-atlas-v3",
            "path": rel(OUT["foreground_runtime"]),
            "frames": frames,
        }
    ]
    m01["foregroundOverlays"] = []
    m01["props"] = [
        {
            "id": prop["id"],
            "frame": prop["frame"],
            "atlas": prop["atlas"],
            "x": prop["x"],
            "y": prop["y"],
            "origin": prop["origin"],
            "scale": 1,
            "depthOffset": prop["depthOffset"],
            "collision": prop["collision"],
        }
        if prop.get("collision")
        else {
            "id": prop["id"],
            "frame": prop["frame"],
            "atlas": prop["atlas"],
            "x": prop["x"],
            "y": prop["y"],
            "origin": prop["origin"],
            "scale": 1,
            "depthOffset": prop["depthOffset"],
        }
        for prop in props
    ]
    write_json(REGISTRY_PATH, registry)


def write_usage_doc(props: list[dict]) -> None:
    doc_path = ROOT / "docs" / "asset-guides" / "ch1-m01-formal-v3-usage.md"
    prop_rows = "\n".join(
        f"| `{prop['markerId']}` | `{prop['id']}` | `{prop['frame']}` | {prop['x']} | {prop['y']} | {prop['visualBounds']['w']} x {prop['visualBounds']['h']} | `{prop['runtimeScalePolicy']}` |"
        for prop in props
    )
    content = f"""# ch1-m01 Formal v3 Usage

## Batch Info

- `batch_id`: ch1-m01-formal-v3
- `map_id`: `ch1_m01_classroom_spawn`
- `production_date`: {date.today().isoformat()}
- `runtime_size`: 2048 x 2048
- `source_size`: 4096 x 4096
- `active_registry`: `assets/chapter1/chapter1-maps-v1.json`
- `placement_manifest`: `{rel(OUT['placement_manifest'])}`
- `marker_manifest`: `{rel(OUT['marker_manifest'])}`

## Runtime Files

| purpose | path |
| --- | --- |
| clean runtime base | `{rel(OUT['runtime_base'])}` |
| assembled minimap / review | `{rel(OUT['runtime_assembled'])}` |
| QA overlay | `{rel(OUT['runtime_qa'])}` |
| runtime prop atlas | `{rel(OUT['props_runtime'])}` |
| runtime foreground atlas | `{rel(OUT['foreground_runtime'])}` |
| source clean base | `{rel(OUT['base_master'])}` |
| source prop atlas | `{rel(OUT['props_master'])}` |
| marker base | `{rel(OUT['marker_master'])}` |

## Prop Placement

Every v3 prop has its visual scale baked into the atlas frame. Runtime placement uses `scale: 1` and collision uses the foot/base rectangle only.

| marker | prop id | frame | x | y | runtime size | scale policy |
| --- | --- | --- | ---: | ---: | --- | --- |
{prop_rows}

## QA Notes

- The base is a clean runtime layer and props are placed from `ch1-m01-props-atlas-v3.png`.
- The 1024 x 1024 chunks are cut from `ch1-map-classroom-spawn-base-v3-2048.png`.
- `ch1-map-classroom-spawn-assembled-qa-v3.png` includes 147 px Lina references, seam guides, route dots, and collision rectangles.
- The v3 package keeps the active v2 composition and scale calibration but promotes it into a scale-1 atlas/manifest package.
"""
    doc_path.write_text(content, encoding="utf-8")


def main() -> None:
    ensure_dirs()
    v2_manifest = json.loads(V2_MANIFEST_PATH.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))

    runtime_base = Image.open(V2_BASE_PATH).convert("RGB")
    if runtime_base.size != (RUNTIME_SIZE, RUNTIME_SIZE):
        runtime_base = runtime_base.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS)
    runtime_base.save(OUT["runtime_base"])

    source_base = runtime_base.resize((SOURCE_SIZE, SOURCE_SIZE), Image.Resampling.LANCZOS)
    source_base.save(OUT["base_master"])
    source_base.crop((0, 0, 2048, 2048)).save(OUT["base_ul"])
    source_base.crop((2048, 0, 4096, 2048)).save(OUT["base_ur"])
    source_base.crop((2048, 2048, 4096, 4096)).save(OUT["base_lr"])
    source_base.crop((0, 2048, 2048, 4096)).save(OUT["base_ll"])

    v2_atlas = Image.open(V2_ATLAS_PATH).convert("RGBA")
    source_atlas, frames, props = pack_runtime_frames(v2_manifest, v2_atlas)
    source_atlas.save(OUT["props_master"])
    source_atlas.save(OUT["foreground_master"])
    runtime_atlas = source_atlas.resize((RUNTIME_SIZE, RUNTIME_SIZE), Image.Resampling.LANCZOS)
    runtime_atlas.save(OUT["props_runtime"])
    runtime_atlas.save(OUT["foreground_runtime"])

    for suffix, x, y in CHUNKS:
        runtime_base.crop((x, y, x + 1024, y + 1024)).save(CHUNKS_DIR / f"ch1-m01-base-v3-{suffix}.png")

    marker_entries = make_marker_entries(props, registry)
    marker_payload = {
        "$schema": "https://efv.local/schemas/ch1-marker-manifest-v1.json",
        "id": "ch1-m01-marker-manifest-v3",
        "mapId": "ch1_m01_classroom_spawn",
        "runtimeSize": {"w": RUNTIME_SIZE, "h": RUNTIME_SIZE},
        "sourceSize": {"w": SOURCE_SIZE, "h": SOURCE_SIZE},
        "coordinateSystem": "runtime coordinates; marker concept image is 2x",
        "markers": marker_entries,
    }
    write_json(OUT["marker_manifest"], marker_payload)
    draw_marker_master(source_base, marker_entries).save(OUT["marker_master"])

    assembled = assemble_preview(runtime_base, runtime_atlas, props, frames)
    assembled.save(OUT["runtime_assembled"])
    make_qa_overlay(assembled, props, marker_entries).save(OUT["runtime_qa"])

    placement_manifest = {
        "$schema": "https://efv.local/schemas/layered-map-manifest-v3.json",
        "id": "ch1_m01_classroom_spawn_formal_v3",
        "mapId": "ch1_m01_classroom_spawn",
        "status": "runtime-promoted-formal-v3",
        "runtimeSource": "assets/chapter1/chapter1-maps-v1.json#maps.ch1_m01_classroom_spawn",
        "productionDate": date.today().isoformat(),
        "resolution": {
            "sourceMaster": {"w": SOURCE_SIZE, "h": SOURCE_SIZE},
            "runtime": {"w": RUNTIME_SIZE, "h": RUNTIME_SIZE},
            "runtimeChunk": {"w": 1024, "h": 1024},
        },
        "scale": {
            "runtimePlayerPx": LINA_RUNTIME_HEIGHT,
            "calibratedM1LinaReferencePx": 368,
            "runtimePropScalePolicy": "all v3 prop scales are baked into atlas frames; runtime scale is 1",
        },
        "sourceDerivation": {
            "base": "formalized from the active v2 scale80 clean runtime package into a 2x source master",
            "props": "v2 atlas frames were re-cropped and resized into final v3 runtime-size frames, then written through a 2x source atlas",
        },
        "baseBackground": {
            "markerMaster": rel(OUT["marker_master"]),
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
        "runtimeChunks": {
            suffix: rel(CHUNKS_DIR / f"ch1-m01-base-v3-{suffix}.png") for suffix, _x, _y in CHUNKS
        },
        "propAtlas": {
            "id": "m01-v3",
            "key": "ch1-m01-props-atlas-v3",
            "sourcePath": rel(OUT["props_master"]),
            "path": rel(OUT["props_runtime"]),
            "frames": frames,
        },
        "foregroundAtlas": {
            "id": "m01-foreground-v3",
            "key": "ch1-m01-foreground-atlas-v3",
            "sourcePath": rel(OUT["foreground_master"]),
            "path": rel(OUT["foreground_runtime"]),
            "frames": frames,
            "note": "The atlas currently mirrors the prop atlas and is reserved for later separated occlusion pieces.",
        },
        "props": props,
        "qa": {
            "checks": [
                "runtime base exists and is 2048 x 2048",
                "source master exists and is 4096 x 4096",
                "four runtime chunks exist and are 1024 x 1024",
                "all prop runtime scales are 1",
                "all prop collisions are foot/base rectangles",
                "QA overlay includes 147 px Lina references, collision boxes, and seam guides",
            ]
        },
    }
    write_json(OUT["placement_manifest"], placement_manifest)
    update_registry(frames, props)
    write_usage_doc(props)

    print("Generated ch1_m01 formal v3 asset package")
    for key, path in OUT.items():
        print(f"{key}: {rel(path)}")
    print("chunks:")
    for suffix, _x, _y in CHUNKS:
        print(f"  {suffix}: {rel(CHUNKS_DIR / f'ch1-m01-base-v3-{suffix}.png')}")


if __name__ == "__main__":
    main()
