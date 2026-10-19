import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "deploy_netlify", Path(__file__).resolve().parents[1] / "scripts/deploy_netlify.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


class NetlifyPackageTests(unittest.TestCase):
    def make_source(self, root):
        source = root / "source"
        source.mkdir()
        for name in deploy.PUBLIC_FILES:
            (source / name).write_text("app")
        (source / "seats.csv").write_text(
            "phone_hash,seat,name,vip\n" + "a" * 64 + ",A-a-1,Demo,\n")
        (source / "assets").mkdir()
        return source

    def test_mobile_only_package_excludes_private_files_and_preserves_image_references(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_source(root)
            (source / "index.html").write_text(
                '<img src="assets/photo.webp"><img src="assets/map.png">')
            for name in ("photo.png", "photo.webp", "map.png", "map.webp", "icon.svg"):
                (source / "assets" / name).write_text("image")
            (source / "private").mkdir()
            (source / "private/roster.xlsx").write_text("private")
            (source / "assets/report.pdf").write_text("private")
            (source / ".DS_Store").write_text("metadata")
            (source / "assets/link.png").symlink_to(source / "private/roster.xlsx")
            target = root / "public"
            target.mkdir()
            (target / "stale.txt").write_text("old")
            deploy.copy_mobile(source, target)
            expected = set(deploy.PUBLIC_FILES) | {
                "_headers", "assets/photo.webp", "assets/map.png", "assets/map.webp", "assets/icon.svg"}
            actual = {p.relative_to(target).as_posix() for p in target.rglob("*") if p.is_file()}
            self.assertEqual(actual, expected)
            self.assertIn("Cache-Control: no-store", (target / "_headers").read_text())

    def test_raw_phone_csv_is_rejected_before_replacing_release(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.make_source(root)
            target = root / "public"
            target.mkdir()
            (target / "index.html").write_text("existing release")
            for csv in ("phone,seat,name,vip\n01000000001,A-a-1,Demo,\n",
                        "phone_hash,seat,name,vip\n01000000001,A-a-1,Demo,\n",
                        "phone_hash,seat,name,vip\n"):
                (source / "seats.csv").write_text(csv)
                with self.subTest(csv=csv), self.assertRaises(ValueError):
                    deploy.copy_mobile(source, target)
                self.assertEqual((target / "index.html").read_text(), "existing release")


if __name__ == "__main__":
    unittest.main()
