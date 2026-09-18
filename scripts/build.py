#!/usr/bin/env python3
"""Copy only public website files into dist/ for deployment."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ("index.html", "styles.css", "script.js", "manifest.webmanifest",
          "service-worker.js", "seats.csv")

def main():
    for name in PUBLIC:
        if not (ROOT / name).is_file():
            raise SystemExit(f"Missing public file: {name}")
    destination = ROOT / "dist"
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir()
    for name in PUBLIC:
        shutil.copy2(ROOT / name, destination / name)
    shutil.copytree(ROOT / "assets", destination / "assets")
    (destination / ".nojekyll").touch()
    if (ROOT / "mockup").is_dir():
        shutil.copytree(ROOT / "mockup", destination / "mockup")
    (destination / "_headers").write_text(
        "/seats.csv\n  Cache-Control: no-store\n"
        "/service-worker.js\n  Cache-Control: no-cache\n", encoding="utf-8")
    size = sum(p.stat().st_size for p in destination.rglob("*") if p.is_file())
    print(f"Built {destination} ({size / 1024 / 1024:.2f} MiB)")

if __name__ == "__main__":
    main()
