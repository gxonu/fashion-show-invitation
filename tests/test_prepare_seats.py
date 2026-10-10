"""Check meeting-specific allocation rules without touching the actual roster."""
import csv
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "prepare_seats.py"


class PrepareSeatsTests(unittest.TestCase):
    def convert(self, rows):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "guests.csv"
            destination = Path(directory) / "seats.csv"
            source.write_text("phone,seat,name,vip\n" + rows, encoding="utf-8")
            destination.write_text("previous roster", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), str(source), "--output", str(destination)],
                text=True, capture_output=True,
            )
            return result, destination.read_text(encoding="utf-8")

    def test_shared_zones_and_assigned_seats(self):
        result, output = self.convert(
            "01000000001,V1,테스트1,vip\n"
            "01000000002,V1,테스트2,vip\n"
            "01000000003,V2,테스트3,vip\n"
            "01000000004,V2,테스트4,vip\n"
            "01000000005,A01,테스트5,\n"
            "01000000005,A02,테스트5,\n"
            "01000000006,V01,기존 VIP,vip\n"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        records = list(csv.DictReader(output.splitlines()))
        self.assertEqual([r["seat_type"] for r in records], ["zone"] * 4 + ["assigned"] * 3)
        self.assertEqual(records[0]["phone_hash"], hashlib.sha256(b"01000000001").hexdigest())
        self.assertNotIn("01000000001", output)
        self.assertEqual(records[4]["phone_hash"], records[5]["phone_hash"])

    def test_duplicate_assigned_seat_does_not_overwrite(self):
        result, output = self.convert("01000000001,A01,,\n01000000002,a01,,\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already assigned", result.stderr)
        self.assertEqual(output, "previous roster")

    def test_unallocated_guests_are_omitted(self):
        result, output = self.convert("01000000001,A01,,\n01000000002,,미배정,\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(list(csv.DictReader(output.splitlines()))), 1)
        self.assertIn("Skipped 1", result.stdout)

    def test_empty_allocations_do_not_erase_previous_roster(self):
        result, output = self.convert("01000000001,,,\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output, "previous roster")

    def test_invalid_phone_and_grade_do_not_overwrite(self):
        for row in ["1000000001,V1,,vip\n", "01000000001,V1,,unknown\n"]:
            with self.subTest(row=row):
                result, output = self.convert(row)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(output, "previous roster")


if __name__ == "__main__":
    unittest.main()
