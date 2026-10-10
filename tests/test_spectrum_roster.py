"""Check import rules with synthetic rows, without reading attendee information."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("roster", Path(__file__).resolve().parents[1] / "scripts/prepare_spectrum_roster.py")
roster = importlib.util.module_from_spec(spec)
spec.loader.exec_module(roster)


class SpectrumRosterTests(unittest.TestCase):
    def prepare(self, rows):
        headings = (1, {"A": "attendess name", "B": "seat name", "C": "phone", "D": "vip"})
        with patch.object(roster, "read_rows", return_value=iter([headings, *rows])):
            return roster.prepare("unused.xlsx")

    def test_normalization_companions_and_vip(self):
        lookup, counts = self.prepare([
            (2, {"A": "Private name", "B": "C_f-1", "C": "010-0000-0001"}),
            (3, {"B": "D-a-1", "C": "01000000001"}),
            (4, {"B": "v1", "C": "01000000002"}),
            (5, {"B": "A-a-1", "C": "01000000003", "D": "vip"}),
        ])
        self.assertEqual(len(lookup), 3)
        self.assertEqual(counts, {"assigned": 2, "vip": 2})
        seats = [row["seat"] for matches in lookup.values() for row in matches]
        self.assertEqual(seats, ["C-f-1", "D-a-1", "V1", "VIP"])
        self.assertEqual(next(iter(lookup.values()))[0]["name"], "Private name")
        self.assertNotIn("01000000001", str(lookup))

    def test_unallocated_and_unidentified_rows_are_omitted(self):
        lookup, counts = self.prepare([
            (2, {"B": "A-a-1"}),
            (3, {"C": "01000000001"}),
            (4, {"B": "v2", "C": "01000000002"}),
        ])
        self.assertEqual(len(lookup), 1)
        self.assertEqual(counts, {"without_phone": 1, "without_seat": 1, "vip": 1})

    def test_ambiguous_seats_and_duplicate_chairs_fail(self):
        for seat in ["A01", "A-a-5", "G-a-1"]:
            with self.subTest(seat=seat), self.assertRaises(ValueError):
                self.prepare([(2, {"B": seat, "C": "01000000001"})])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            self.prepare([(2, {"B": "A-a-1", "C": "01000000001"}), (3, {"B": "A_a-1", "C": "01000000002"})])


if __name__ == "__main__":
    unittest.main()
