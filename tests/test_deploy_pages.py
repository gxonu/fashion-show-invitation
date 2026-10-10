import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import contextlib
import io

spec = importlib.util.spec_from_file_location(
    "deploy_pages", Path(__file__).resolve().parents[1] / "scripts/deploy_pages.py"
)
deploy_pages = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy_pages)


class DeploymentBranchTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
