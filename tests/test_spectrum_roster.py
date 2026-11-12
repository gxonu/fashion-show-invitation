"""Check import rules with synthetic rows, without reading attendee information."""
import importlib.util
import copy
import hashlib
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

    def test_overrides_move_vip_to_chair_and_preserve_v2_registration(self):
        lookup, _ = self.prepare([
            (2, {"A": "Existing VIP", "B": "VIP", "C": "01000000001"}),
            (3, {"A": "Unchanged", "B": "A-a-1", "C": "01000000002"}),
        ])
        before = copy.deepcopy(lookup)
        result = roster.apply_guest_overrides(lookup, [
            {"name": "Moved guest", "phone": "010-0000-0001", "seat": "D_c-3"},
            {"name": "New VIP", "phone": "+82 10 0000 0003", "seat": "v2"},
            {"name": "Legacy VIP", "phone": "01000000004"},
        ])
        key = lambda phone: hashlib.sha256(phone.encode()).hexdigest()
        self.assertEqual(result[key("01000000001")], [{"seat": "D-c-3", "vip": "", "name": "Moved guest"}])
        self.assertEqual(result[key("01000000002")], before[key("01000000002")])
        self.assertEqual(result[key("01000000003")][0]["seat"], "V2")
        self.assertEqual(result[key("01000000003")][0]["vip"], "vip")
        self.assertEqual(result[key("01000000004")][0]["seat"], "VIP")
        self.assertEqual(lookup, before)

    def test_conflicting_or_invalid_overrides_do_not_mutate_lookup(self):
        lookup, _ = self.prepare([(2, {"B": "D-c-3", "C": "01000000001"})])
        before = copy.deepcopy(lookup)
        for overrides in [
            [{"phone": "01000000002", "seat": "D-c-3"}],
            [{"phone": "01000000002", "seat": "D-c-5"}],
            [{"phone": "invalid", "seat": "VIP"}],
            [{"phone": "01000000002", "seat": "V1"}, {"phone": "010-0000-0002", "seat": "V2"}],
        ]:
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                roster.apply_guest_overrides(lookup, overrides)
            self.assertEqual(lookup, before)


if __name__ == "__main__":
    unittest.main()
