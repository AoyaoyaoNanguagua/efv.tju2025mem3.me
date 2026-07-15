from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ENEMY_DIR = ROOT / "assets" / "game" / "enemies" / "animated"
BOSS_DIR = ROOT / "assets" / "game" / "bosses"
ALPHA_THRESHOLD = 8
SAFE_MARGIN = 6


def threshold_alpha(image: Image.Image) -> Image.Image:
    return image.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0)


def runtime_grid_is_safe(
    image: Image.Image,
    columns: int,
    rows: int,
    frame_width: int,
    frame_height: int,
) -> bool:
    if image.size != (columns * frame_width, rows * frame_height):
        return False
    for row in range(rows):
        for column in range(columns):
            frame = image.crop(
                (
                    column * frame_width,
                    row * frame_height,
                    (column + 1) * frame_width,
                    (row + 1) * frame_height,
                )
            )
            bbox = threshold_alpha(frame).getbbox()
            if not bbox:
                return False
            if bbox[0] < 4 or bbox[1] < 4 or bbox[2] > frame_width - 4 or bbox[3] > frame_height - 4:
                return False
    return True


def fit_sprite(source: Image.Image, width: int, height: int) -> Image.Image | None:
    bbox = threshold_alpha(source).getbbox()
    if not bbox or (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < 160:
        return None
    sprite = source.crop(bbox)
    scale = min(
        (width - SAFE_MARGIN * 2) / sprite.width,
        (height - SAFE_MARGIN * 2) / sprite.height,
        1.0,
    )
    if scale < 1:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
    frame = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    frame.alpha_composite(sprite, (round((width - sprite.width) / 2), height - SAFE_MARGIN - sprite.height))
    return frame


def adaptive_boundaries(alpha: Image.Image, top: int, bottom: int, columns: int) -> list[int]:
    counts = []
    for x in range(alpha.width):
        strip = alpha.crop((x, top, x + 1, bottom))
        counts.append(sum(1 for value in strip.getdata() if value >= ALPHA_THRESHOLD))

    boundaries = [0]
    nominal_width = alpha.width / columns
    radius = min(62, round(nominal_width * 0.42))
    for column in range(1, columns):
        nominal = round(column * nominal_width)
        left = max(boundaries[-1] + 32, nominal - radius)
        right = min(alpha.width - (columns - column) * 32, nominal + radius)
        candidates = range(left, right + 1)
        boundary = min(candidates, key=lambda x: (counts[x], abs(x - nominal)))
        boundaries.append(boundary)
    boundaries.append(alpha.width)
    return boundaries


def fill_missing_frames(frames: list[Image.Image | None]) -> list[Image.Image]:
    valid_indexes = [index for index, frame in enumerate(frames) if frame is not None]
    if not valid_indexes:
        raise RuntimeError("A source row did not contain a usable sprite")
    result = []
    for index, frame in enumerate(frames):
        if frame is not None:
            result.append(frame)
            continue
        nearest = min(valid_indexes, key=lambda candidate: abs(candidate - index))
        result.append(frames[nearest].copy())
    return result


def normalize_sheet(
    path: Path,
    row_bands: list[tuple[int, int]],
    columns: int,
    frame_width: int,
    frame_height: int,
) -> None:
    source = Image.open(path).convert("RGBA")
    rows = len(row_bands)
    if runtime_grid_is_safe(source, columns, rows, frame_width, frame_height):
        print(f"{path.name}: already normalized")
        return

    output = Image.new("RGBA", (columns * frame_width, rows * frame_height), (0, 0, 0, 0))
    alpha = source.getchannel("A")
    for row, (top, bottom) in enumerate(row_bands):
        boundaries = adaptive_boundaries(alpha, top, bottom, columns)
        frames = fill_missing_frames(
            [
                fit_sprite(source.crop((left, top, right, bottom)), frame_width, frame_height)
                for left, right in zip(boundaries[:-1], boundaries[1:])
            ]
        )
        for column, frame in enumerate(frames):
            output.alpha_composite(frame, (column * frame_width, row * frame_height))
    output.save(path, optimize=True)
    print(f"{path.name}: normalized to {columns}x{rows}")


def main() -> None:
    normalize_sheet(
        ENEMY_DIR / "ch1-m04-quantum-family-atlas-v2.png",
        [(24, 181), (198, 358), (378, 519), (550, 664), (682, 788), (798, 909), (925, 1031), (1049, 1155)],
        columns=8,
        frame_width=147,
        frame_height=147,
    )
    normalize_sheet(
        ENEMY_DIR / "ch1-m04-blockchain-family-atlas-v3.png",
        [(20, 167), (194, 343), (364, 507), (531, 646), (674, 800), (806, 922), (952, 1028), (1049, 1159)],
        columns=8,
        frame_width=147,
        frame_height=147,
    )
    normalize_sheet(
        ENEMY_DIR / "ch1-m04-aiagent-family-atlas-v3.png",
        [(30, 200), (220, 368), (400, 538), (569, 684), (701, 814), (839, 932), (960, 1045), (1073, 1155)],
        columns=7,
        frame_width=168,
        frame_height=147,
    )
    normalize_sheet(
        BOSS_DIR / "m04-structural-instability-boss-sheet-v2.png",
        [(22, 174), (199, 343), (354, 531), (562, 688), (737, 826), (873, 970), (1018, 1138)],
        columns=8,
        frame_width=147,
        frame_height=168,
    )


if __name__ == "__main__":
    main()
