#!/usr/bin/env python3
"""Read an organizer XLSX without modifying it; keep lookup data under private/."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_rows(path):
    with zipfile.ZipFile(path) as archive:
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            strings = ["".join(item.itertext()) for item in ET.fromstring(
                archive.read("xl/sharedStrings.xml")).findall("m:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        first = workbook.find("m:sheets/m:sheet", NS)
        relationship = first.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        relations = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(item.get("Target") for item in relations if item.get("Id") == relationship)
        sheet_path = target.lstrip("/") if target.startswith("/") else "xl/" + target
        sheet = ET.fromstring(archive.read(sheet_path))
        for row in sheet.findall("m:sheetData/m:row", NS):
            cells = {}
            for cell in row.findall("m:c", NS):
                value = cell.findtext("m:v", "", NS)
                if cell.get("t") == "s":
                    value = strings[int(value)] if value else ""
                elif cell.get("t") == "inlineStr":
                    value = "".join(cell.find("m:is", NS).itertext())
                if value.strip():
                    cells[re.sub(r"\d", "", cell.get("r"))] = value.strip()
            yield int(row.get("r")), cells


def prepare(path):
    rows = iter(read_rows(path))
    _, headings = next(rows)
    headers = {value.lower(): column for column, value in headings.items()}
    phone_col = next((headers[key] for key in ["phone", "전화번호", "연락처"] if key in headers), None)
    seat_col = next((headers[key] for key in ["seat name", "seat", "좌석", "좌석번호"] if key in headers), None)
    name_col = next((headers[key] for key in ["attendess name", "attendee name", "name", "이름", "성함", "참석자명"] if key in headers), None)
    vip_col = headers.get("vip")
    if not phone_col or not seat_col:
        raise ValueError("First sheet must have phone and seat name columns")
    lookup, occupied, counts = {}, set(), Counter()
    for number, cells in rows:
        raw_phone, raw_seat = cells.get(phone_col, ""), cells.get(seat_col, "")
        if not raw_phone:
            counts["without_phone"] += 1
            continue
        phone = re.sub(r"[\s().·-]", "", raw_phone)
        if phone.startswith("+82"):
            phone = "0" + phone[3:].lstrip("0")
        if not re.fullmatch(r"0\d{9,10}", phone):
            raise ValueError(f"Row {number}: invalid phone format")
        explicit_vip = cells.get(vip_col, "").lower() == "vip"
        is_vip = explicit_vip or bool(re.fullmatch(r"VIP|V[12]", raw_seat, re.I))
        if not raw_seat and not is_vip:
            counts["without_seat"] += 1
            continue
        if is_vip:
            seat = raw_seat.upper() if re.fullmatch(r"V[12]", raw_seat, re.I) else "VIP"
        else:
            match = re.fullmatch(r"([A-F])(?:구역)?[\s_-]*([a-g])[\s_-]*([1-5])", raw_seat, re.I)
            if not match or (match[2].lower() <= "e" and match[3] == "5"):
                raise ValueError(f"Row {number}: seat is not present on PDF page 17")
            seat = f"{match[1].upper()}-{match[2].lower()}-{match[3]}"
            if seat in occupied:
                raise ValueError(f"Row {number}: duplicate assigned seat")
            occupied.add(seat)
        key = hashlib.sha256(phone.encode()).hexdigest()
        record = {"seat": seat, "vip": "vip" if is_vip else "", "name": cells.get(name_col, "")}
        if record not in lookup.setdefault(key, []):
            lookup[key].append(record)
            counts["vip" if is_vip else "assigned"] += 1
    if not lookup:
        raise ValueError("No usable allocations; previous lookup data preserved")
    return lookup, dict(counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "private/rosters/lookup.json")
    args = parser.parse_args()
    if not args.output.resolve().is_relative_to(ROOT / "private"):
        parser.error("Actual roster lookup output must stay under private/")
    lookup, counts = prepare(args.input)
    # Keep explicit VIP registrations when a newer organizer workbook is imported.
    vip_guests = ROOT / "private/rosters/vip-guests.json"
    if vip_guests.is_file():
        for guest in json.loads(vip_guests.read_text(encoding="utf-8")):
            phone = re.sub(r"[\s().·-]", "", guest["phone"])
            if not re.fullmatch(r"0\d{9,10}", phone):
                parser.error("Invalid phone format in private VIP registrations")
            key = hashlib.sha256(phone.encode()).hexdigest()
            lookup[key] = [{"seat": "VIP", "vip": "vip", "name": guest.get("name", "").strip()}]
        counts["assigned"] = sum(item["vip"] != "vip" for rows in lookup.values() for item in rows)
        counts["vip"] = sum(item["vip"] == "vip" for rows in lookup.values() for item in rows)
    payload = {"lookup": lookup, "counts": counts}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(args.output)
    print(json.dumps({"lookup_keys": len(lookup), **counts}, ensure_ascii=False))


if __name__ == "__main__":
    main()
