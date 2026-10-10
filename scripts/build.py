#!/usr/bin/env python3
"""Copy only public website files into dist/ for deployment."""
from pathlib import Path
import argparse
import csv
import io
import json
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ("index.html", "styles.css", "script.js", "manifest.webmanifest",
          "service-worker.js", "seats.csv")

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roster", type=Path, help="Include a prepared private lookup JSON in the PUBLIC static CSV")
    parser.add_argument("--include-demo", action="store_true", help="Keep fictional test numbers alongside the supplied roster")
    args = parser.parse_args()
    roster_csv = None
    if args.roster:
        lookup = json.loads(args.roster.read_text(encoding="utf-8"))["lookup"]
        records = []
        for key, matches in lookup.items():
            if not re.fullmatch(r"[a-f0-9]{64}", key):
                parser.error("Roster contains an invalid phone hash")
            for item in matches:
                records.append({"phone_hash": key, "seat": item["seat"], "name": item.get("name", ""), "vip": item.get("vip", "")})
        if not records:
            parser.error("Roster is empty; current build preserved")
        if args.include_demo:
            with (ROOT / "spectrum/seats.csv").open(encoding="utf-8") as source:
                records.extend(row for row in csv.DictReader(source) if row["phone_hash"] not in lookup)
        output = io.StringIO(newline="")
        writer = csv.DictWriter(output, fieldnames=["phone_hash", "seat", "name", "vip"], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)
        roster_csv = output.getvalue()
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
    if (ROOT / "spectrum").is_dir():
        shutil.copytree(ROOT / "spectrum", destination / "spectrum")
    if roster_csv is not None:
        (destination / "spectrum/seats.csv").write_text(roster_csv, encoding="utf-8")
        print(f"Static lookup: {len(records)} allocations, {len(roster_csv.encode('utf-8'))} bytes; names and seat data are downloadable")
    (destination / "_headers").write_text(
        "/seats.csv\n  Cache-Control: no-store\n"
        "/spectrum/seats.csv\n  Cache-Control: no-store\n"
        "/service-worker.js\n  Cache-Control: no-cache\n", encoding="utf-8")
    size = sum(p.stat().st_size for p in destination.rglob("*") if p.is_file())
    print(f"Built {destination} ({size / 1024 / 1024:.2f} MiB)")

if __name__ == "__main__":
    main()
