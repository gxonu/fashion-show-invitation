import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import contextlib
import io
import tempfile

spec = importlib.util.spec_from_file_location(
    "deploy_pages", Path(__file__).resolve().parents[1] / "scripts/deploy_pages.py"
)
deploy_pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy_pages)


class DeploymentBranchTests(unittest.TestCase):
    def test_preview_rejects_other_branches_before_build(self):
        for branch in ("main", "feature/ui", ""):
            with self.subTest(branch=branch), \
                 patch.object(deploy_pages.sys, "argv", ["deploy_pages.py", "--preview"]), \
                 patch.object(deploy_pages, "git", return_value=branch), \
                 patch.object(deploy_pages.subprocess, "run") as run, \
                 contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    deploy_pages.main()
                run.assert_not_called()

    def test_non_main_cannot_build_or_publish(self):
        for branch in ("develop", "feature/ui", ""):
            with self.subTest(branch=branch), \
                 patch.object(deploy_pages.sys, "argv", ["deploy_pages.py"]), \
                 patch.object(deploy_pages, "git", return_value=branch) as git, \
                 patch.object(deploy_pages.subprocess, "run") as run, \
                 contextlib.redirect_stderr(io.StringIO()) as stderr:
                with self.assertRaises(SystemExit) as error:
                    deploy_pages.main()
                self.assertEqual(error.exception.code, 2)
                self.assertIn("only allowed from main", stderr.getvalue())
                git.assert_called_once_with(deploy_pages.ROOT, "branch", "--show-current")
                run.assert_not_called()

    def test_preview_preserves_production_and_replaces_old_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build, target = root / "build", root / "site"
            (build / "spectrum").mkdir(parents=True)
            (build / "spectrum/index.html").write_text("new preview")
            (build / "index.html").write_text("must not publish")
            (target / "develop/spectrum").mkdir(parents=True)
            (target / "develop/spectrum/old.js").write_text("stale")
            (target / "spectrum").mkdir()
            (target / "spectrum/index.html").write_text("production")
            (target / "index.html").write_text("reference")
            (target / ".nojekyll").touch()
            before = {p.relative_to(target): p.read_bytes() for p in target.rglob("*")
                      if p.is_file() and "develop" not in p.relative_to(target).parts}
            deploy_pages.copy_site(build, target, preview=True)
            self.assertEqual((target / "develop/spectrum/index.html").read_text(), "new preview")
            self.assertFalse((target / "develop/spectrum/old.js").exists())
            after = {p.relative_to(target): p.read_bytes() for p in target.rglob("*")
                     if p.is_file() and "develop" not in p.relative_to(target).parts}
            self.assertEqual(before, after)

    def test_production_preserves_development_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            build, target = root / "build", root / "site"
            build.mkdir()
            (build / "index.html").write_text("new production")
            (target / "develop/spectrum").mkdir(parents=True)
            (target / "develop/spectrum/index.html").write_text("preview")
            (target / ".git").mkdir()
            (target / ".git/config").write_text("git config")
            (target / "old.js").write_text("stale")
            deploy_pages.copy_site(build, target)
            self.assertEqual((target / "index.html").read_text(), "new production")
            self.assertEqual((target / "develop/spectrum/index.html").read_text(), "preview")
            self.assertEqual((target / ".git/config").read_text(), "git config")
            self.assertFalse((target / "old.js").exists())


if __name__ == "__main__":
    unittest.main()
