#!/usr/bin/env python3
"""Publish the mobile build and approved static roster to the netlify Git branch.

Netlify follows this generated branch with publish directory `public` and no
build command. Source branches and GitHub Pages are not changed by this script.
"""
import argparse
import csv
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ("index.html", "app.js", "app.css", "design.css", "seat-layout.mjs",
                "seat-data.mjs", "phone-hash.mjs", "seats.csv")
IMAGE_TYPES = {".svg", ".png", ".webp", ".jpg", ".jpeg", ".avif", ".gif"}


def git(directory, *args):
    return subprocess.check_output(["git", *args], cwd=directory, text=True).strip()


def copy_mobile(source, target):
    """Allow only app files/images into the public directory; replace stale files."""
    for name in PUBLIC_FILES:
        if not (source / name).is_file() or (source / name).is_symlink():
            raise ValueError(f"Missing or unsafe public file: {name}")
    with (source / "seats.csv").open(encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != ["phone_hash", "seat", "name", "vip"]:
            raise ValueError("Expected only phone hashes, seats, names and VIP flags")
        records = list(reader)
        if not records or any(not re.fullmatch(r"[a-f0-9]{64}", row["phone_hash"])
                              for row in records):
            raise ValueError("Invalid static roster; existing release preserved")
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    text = "\n".join((source / name).read_text() for name in PUBLIC_FILES
                     if name != "seats.csv")
    for name in PUBLIC_FILES:
        shutil.copy2(source / name, target / name)
    for asset in (source / "assets").rglob("*"):
        if not asset.is_file() or asset.is_symlink() or asset.suffix.lower() not in IMAGE_TYPES:
            continue
        relative = asset.relative_to(source)
        # Keep the original PNG in source control; deploy its smaller WebP
        # when the app no longer references the original.
        if (asset.suffix == ".png" and asset.with_suffix(".webp").is_file()
                and relative.as_posix() not in text):
            continue
        output = target / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(asset, output)
    (target / "_headers").write_text(
        "/seats.csv\n  Cache-Control: no-store\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--roster", type=Path, required=True,
                        help="Approved private lookup JSON to include in the public release")
    parser.add_argument("--include-demo", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="Build/validate without pushing")
    args = parser.parse_args()
    branch = git(ROOT, "branch", "--show-current")
    if branch not in {"develop", "main"}:
        parser.error("Release from develop or main only")
    if git(ROOT, "diff", "HEAD", "--", "spectrum", "scripts/build.py", "scripts/deploy_netlify.py"):
        parser.error("Commit app and deployment changes before publishing")
    command = [sys.executable, str(ROOT / "scripts/build.py"), "--roster", str(args.roster.resolve())]
    if args.include_demo:
        command.append("--include-demo")
    subprocess.run(command, check=True)
    revision = git(ROOT, "rev-parse", "HEAD")
    with tempfile.TemporaryDirectory(prefix="fashion-netlify-release-") as temporary:
        target = Path(temporary)
        if not args.dry_run:
            git(target, "init", "--initial-branch=netlify")
            git(target, "config", "user.name", git(ROOT, "config", "user.name"))
            git(target, "config", "user.email", git(ROOT, "config", "user.email"))
            git(target, "remote", "add", "origin", git(ROOT, "remote", "get-url", "origin"))
            if git(target, "ls-remote", "--heads", "origin", "netlify"):
                git(target, "fetch", "--depth=1", "origin", "netlify")
                git(target, "checkout", "-B", "netlify", "FETCH_HEAD")
            for item in target.iterdir():
                if item.name != ".git":
                    shutil.rmtree(item) if item.is_dir() else item.unlink()
        copy_mobile(ROOT / "dist/spectrum", target / "public")
        (target / "netlify.toml").write_text(
            '[build]\n  command = ""\n  publish = "public"\n', encoding="utf-8")
        (target / "README.md").write_text(
            "# Netlify mobile release\n\n"
            f"Source: `{branch}` at `{revision}`.\n\n"
            "Connect this repository in Netlify with production branch `netlify`, "
            "publish directory `public`, and an empty build command.\n\n"
            "Generated files only. Update the source branch, then run "
            "`python3 scripts/deploy_netlify.py --roster private/rosters/lookup.json` "
            "there; add `--include-demo` for client testing.\n\n"
            "The static roster contains approved public names, seats, VIP flags and "
            "phone hashes. Hashes do not make the roster private. "
            "Original spreadsheets, PDFs and raw phone numbers are excluded.\n",
            encoding="utf-8")
        files = list((target / "public").rglob("*"))
        print(f"Validated mobile package: {sum(p.stat().st_size for p in files if p.is_file()):,} bytes")
        if args.dry_run:
            print("Dry run complete; no remote changes")
            return
        git(target, "add", "--all")
        if not git(target, "status", "--porcelain"):
            print("Release unchanged; no push needed")
            return
        git(target, "commit", "-m", "Release mobile invitation from " + revision[:7])
        # Explicit destination and ordinary push; never touch main or gh-pages.
        git(target, "push", "origin", "HEAD:refs/heads/netlify")
    print("Updated netlify branch. Connected Netlify projects deploy automatically.")


if __name__ == "__main__":
    main()
