#!/usr/bin/env python3
"""Convert an organizer CSV into lookup data with assigned seats or V1/V2 zones."""
import argparse
import csv
import hashlib
import io
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
UNASSIGNED_ZONES = {"V1", "V2"}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="UTF-8 CSV: phone,seat,name,vip (V1/V2 are first-come zones)")
    parser.add_argument("--output", type=Path, default=ROOT / "seats.csv")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Input and output must be different files")
    records = []
    used_seats = set()
    skipped = 0
    with args.input.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        if not {"phone", "seat"}.issubset(reader.fieldnames or []):
            parser.error("CSV requires phone and seat columns")
        for line, row in enumerate(reader, 2):
            raw_phone = (row.get("phone") or "").strip()
            phone = re.sub(r"[\s()-]", "", raw_phone)
            seat = (row.get("seat") or "").strip()
            vip = (row.get("vip") or "").strip().lower()
            # An attendee without an allocation must not receive a ticket.
            if not seat:
                skipped += 1
                continue
            seat = seat.upper()
            seat_type = "zone" if seat in UNASSIGNED_ZONES else "assigned"
            if not re.fullmatch(r"0[0-9]{9,10}", phone):
                parser.error(f"Row {line}: phone must be 10–11 digits starting with 0")
            if seat_type == "assigned" and seat in used_seats:
                parser.error(f"Row {line}: seat is already assigned")
            if vip not in ("", "vip"):
                parser.error(f"Row {line}: vip must be empty or 'vip'")
            if seat_type == "assigned":
                used_seats.add(seat)
            records.append([hashlib.sha256(phone.encode()).hexdigest(), seat,
                            (row.get("name") or "").strip(), vip, seat_type])
    if not records:
        parser.error("CSV contains no attendees")
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["phone_hash", "seat", "name", "vip", "seat_type"])
    writer.writerows(records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(output.getvalue(), encoding="utf-8")
    print(f"Prepared {len(records)} seats for {len(set(r[0] for r in records))} lookup keys")
    if skipped:
        print(f"Skipped {skipped} rows without a seat allocation")

if __name__ == "__main__":
    main()
