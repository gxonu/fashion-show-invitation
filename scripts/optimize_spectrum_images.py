#!/usr/bin/env python3
"""Regenerate mobile WebP assets from the unchanged Figma PNG originals.

Requires cwebp (Homebrew: brew install webp). Regular builds use the checked-in
WebP files and do not require an image encoder.
"""
from pathlib import Path
import shutil
import subprocess

ASSETS = Path(__file__).resolve().parents[1] / "spectrum" / "assets"


def main():
    encoder = shutil.which("cwebp")
    if not encoder:
        raise SystemExit("Install cwebp to regenerate images: brew install webp")
    settings = {
        # The design displays this at 342 CSS px; retain 3x pixel density.
        "about-img1": ["-q", "90", "-resize", "1026", "0"],
        "exhibition-img1": ["-q", "90", "-resize", "1026", "0"],
        # Preserve map labels and transparent home artwork pixel-for-pixel.
        "directions-img1": ["-lossless", "-exact"],
        "home-img1": ["-lossless", "-exact"],
        "home-img2": ["-lossless", "-exact"],
    }
    for name, options in settings.items():
        source = ASSETS / f"{name}.png"
        target = ASSETS / f"{name}.webp"
        subprocess.run([encoder, "-quiet", "-m", "6", *options,
                        str(source), "-o", str(target)], check=True)
        print(f"{name}: {source.stat().st_size:,} → {target.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
