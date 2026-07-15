from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ENEMY_DIR = ROOT / "assets" / "game" / "enemies" / "animated"
ALPHA_THRESHOLD = 8


def projection_runs(alpha: Image.Image, axis: str) -> list[tuple[int, int]]:
    length = alpha.height if axis == "y" else alpha.width
    occupied = []
    for index in range(length):
        strip = alpha.crop((0, index, alpha.width, index + 1)) if axis == "y" else alpha.crop((index, 0, index + 1, alpha.height))
        occupied.append(strip.point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0).getbbox() is not None)
    runs = []
    start = None
    for index, value in enumerate([*occupied, False]):
        if value and start is None:
            start = index
        elif not value and start is not None:
            runs.append((start, index))
            start = None
    return runs


def fit_sprite(source: Image.Image, width: int, height: int, margin: int = 6) -> Image.Image:
    bbox = source.getchannel("A").point(lambda value: 255 if value >= ALPHA_THRESHOLD else 0).getbbox()
    if not bbox:
        raise RuntimeError("Encountered an empty source frame")
    sprite = source.crop(bbox)
    scale = min((width - margin * 2) / sprite.width, (height - margin * 2) / sprite.height, 1.0)
    if scale < 1:
        sprite = sprite.resize(
            (max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
            Image.Resampling.LANCZOS,
        )
    frame = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = round((width - sprite.width) / 2)
    y = height - margin - sprite.height
    frame.alpha_composite(sprite, (x, y))
    return frame


def normalize_variable_grid(
    path: Path,
    target_columns: int,
    target_rows: int,
    frame_width: int,
    frame_height: int,
    source_columns_by_row: list[int] | None = None,
) -> None:
    source = Image.open(path).convert("RGBA")
    alpha = source.getchannel("A")
    row_runs = projection_runs(alpha, "y")
    if len(row_runs) != target_rows:
        raise RuntimeError(f"{path.name}: expected {target_rows} source rows, got {row_runs}")
    output = Image.new("RGBA", (target_columns * frame_width, target_rows * frame_height), (0, 0, 0, 0))
    reference_boundaries = None

    for row, (top, bottom) in enumerate(row_runs):
        source_columns = source_columns_by_row[row] if source_columns_by_row else target_columns
        row_alpha = alpha.crop((0, top, source.width, bottom))
        column_runs = projection_runs(row_alpha, "x")
        if len(column_runs) == source_columns:
            regions = column_runs
            if source_columns == target_columns:
                boundaries = [0]
                for left_run, right_run in zip(column_runs, column_runs[1:]):
                    boundaries.append(round((left_run[1] + right_run[0]) / 2))
                boundaries.append(source.width)
                reference_boundaries = boundaries
        elif source_columns == target_columns and reference_boundaries:
            regions = list(zip(reference_boundaries[:-1], reference_boundaries[1:]))
        else:
            raise RuntimeError(
                f"{path.name}: row {row} expected {source_columns} source columns, got {column_runs}"
            )

        frames = []
        for left, right in regions:
            frames.append(fit_sprite(source.crop((left, top, right, bottom)), frame_width, frame_height))
        while len(frames) < target_columns:
            frames.append(frames[-1].copy())
        for column, frame in enumerate(frames[:target_columns]):
            output.alpha_composite(frame, (column * frame_width, row * frame_height))
    output.save(path, optimize=True)


def main() -> None:
    normalize_variable_grid(
        ENEMY_DIR / "ch1-m03-garden-patrol-atlas-v3.png",
        target_columns=8,
        target_rows=8,
        frame_width=147,
        frame_height=147,
        source_columns_by_row=[7, 7, 7, 7, 7, 7, 8, 8],
    )
    normalize_variable_grid(
        ENEMY_DIR / "ch1-m03-moon-orchid-rare-sheet-v3.png",
        target_columns=6,
        target_rows=8,
        frame_width=196,
        frame_height=147,
    )
    normalize_variable_grid(
        ENEMY_DIR / "ch1-m03-carnivora-boss-sheet-v3.png",
        target_columns=6,
        target_rows=7,
        frame_width=196,
        frame_height=168,
    )
    print("M03 enemy sheets normalized to runtime grids")


if __name__ == "__main__":
    main()
