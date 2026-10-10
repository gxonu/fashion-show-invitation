#!/usr/bin/env python3
"""Build and push public files to gh-pages using your configured Git credentials."""
from pathlib import Path
import argparse
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def git(directory, *args):
    return subprocess.check_output(["git", *args], cwd=directory, text=True).strip()

def copy_site(build, target, preview=False):
    if preview:
        source = build / "spectrum"
        if not source.is_dir():
            raise SystemExit("Missing Spectrum build; current preview preserved")
        destination = target / "develop"
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination / "spectrum")
        return
    # Publishing production must also preserve the independent development URL.
    for item in target.iterdir():
        if item.name not in {".git", "develop"}:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
    shutil.copytree(build, target, dirs_exist_ok=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", action="store_true", help="Publish develop to /develop/spectrum/ without changing production")
    parser.add_argument("--roster", type=Path, help="Prepared lookup JSON to publish as downloadable static data")
    parser.add_argument("--include-demo", action="store_true", help="Keep test numbers alongside the supplied roster")
    args = parser.parse_args()
    branch = git(ROOT, "branch", "--show-current")
    if args.preview and branch != "develop":
        parser.error("Preview deployment is only allowed from develop.")
    if not args.preview and branch != "main":
        parser.error("Production deployment is only allowed from main. Review and merge develop into main first.")
    build = [sys.executable, str(ROOT / "scripts/build.py")]
    if args.roster:
        build.extend(["--roster", str(args.roster.resolve())])
    if args.include_demo:
        build.append("--include-demo")
    subprocess.run(build, check=True)
    remote = git(ROOT, "remote", "get-url", "origin")
    name = git(ROOT, "config", "user.name")
    email = git(ROOT, "config", "user.email")
    with tempfile.TemporaryDirectory(prefix="fashion-pages-publish-") as temporary:
        target = Path(temporary)
        git(target, "init", "--initial-branch=gh-pages")
        git(target, "config", "user.name", name)
        git(target, "config", "user.email", email)
        git(target, "remote", "add", "origin", remote)
        exists = git(target, "ls-remote", "--heads", "origin", "gh-pages")
        if args.preview and not exists:
            parser.error("Publish production first before adding a development preview.")
        if exists:
            git(target, "fetch", "--depth=1", "origin", "gh-pages")
            git(target, "checkout", "-B", "gh-pages", "FETCH_HEAD")
        copy_site(ROOT / "dist", target, preview=args.preview)
        git(target, "add", "--all")
        if args.preview:
            changed = git(target, "diff", "--cached", "--name-only").splitlines()
            if any(not path.startswith("develop/") for path in changed):
                raise SystemExit("Preview changed production files; refusing to publish")
        if not git(target, "status", "--porcelain"):
            print("Public files unchanged; no deployment needed")
            return
        revision = git(ROOT, "rev-parse", "--short", "HEAD")
        label = "development preview" if args.preview else "invitation"
        git(target, "commit", "-m", "Publish " + label + " from " + revision)
        git(target, "push", "origin", "gh-pages")
    print("Published gh-pages. GitHub Pages builds the site asynchronously.")

if __name__ == "__main__":
    main()
