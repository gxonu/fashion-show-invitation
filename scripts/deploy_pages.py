#!/usr/bin/env python3
"""Build and push public files to gh-pages using your configured Git credentials."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def git(directory, *args):
    return subprocess.check_output(["git", *args], cwd=directory, text=True).strip()

def main():
    subprocess.run([sys.executable, str(ROOT / "scripts/build.py")], check=True)
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
        if exists:
            git(target, "fetch", "--depth=1", "origin", "gh-pages")
            git(target, "checkout", "-B", "gh-pages", "FETCH_HEAD")
        for item in target.iterdir():
            if item.name != ".git":
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
        shutil.copytree(ROOT / "dist", target, dirs_exist_ok=True)
        git(target, "add", "--all")
        if not git(target, "status", "--porcelain"):
            print("Public files unchanged; no deployment needed")
            return
        revision = git(ROOT, "rev-parse", "--short", "HEAD")
        git(target, "commit", "-m", "Publish invitation from " + revision)
        git(target, "push", "origin", "gh-pages")
    print("Published gh-pages. GitHub Pages builds the site asynchronously.")

if __name__ == "__main__":
    main()
