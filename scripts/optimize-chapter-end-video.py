from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import imageio_ffmpeg


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a browser-friendly chapter-end cinematic.")
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--width", type=int, default=2560)
    parser.add_argument("--height", type=int, default=1440)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--crf", type=int, default=18)
    parser.add_argument("--preset", default="veryfast")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists():
        raise FileExistsError(f"Refusing to overwrite existing output: {args.output}")

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    command = [
        ffmpeg,
        "-hide_banner",
        "-nostdin",
        "-i",
        str(args.input),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        f"scale={args.width}:{args.height}:flags=lanczos,fps={args.fps}",
        "-c:v",
        "libx264",
        "-preset",
        args.preset,
        "-crf",
        str(args.crf),
        "-profile:v",
        "high",
        "-level:v",
        "5.0",
        "-pix_fmt",
        "yuv420p",
        "-g",
        str(args.fps * 2),
        "-keyint_min",
        str(args.fps),
        "-sc_threshold",
        "40",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(args.output),
    ]
    subprocess.run(command, check=True)
    print(f"output={args.output}")


if __name__ == "__main__":
    main()
