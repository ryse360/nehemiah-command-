#!/usr/bin/env python3
"""Build/validate source-manifest/manifest.csv for the 20-book pilot.

Two modes:
  --seed     Scan pilot-input/*.pdf and write a starter manifest.csv row per
             file (source_filename + pdf_type pre-filled from
             classification.json if available). Never overwrites an
             existing manifest.csv without --force.
  --validate (default) Check the existing manifest.csv: exactly 20 rows,
             every pilot-input file accounted for, and the required mix
             (>=1 clean, >=1 scanned, >=1 complex, >=2 rows sharing a
             perspective_tag) is present.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter
from pathlib import Path

BOOK_BRAIN_HOME = Path(
    os.environ.get("NEHEMIAH_BOOK_BRAIN_HOME", str(Path.home() / "Developer" / "nehemiah-book-brain"))
)
INPUT_DIR = BOOK_BRAIN_HOME / "pilot-input"
MANIFEST_DIR = BOOK_BRAIN_HOME / "source-manifest"
MANIFEST_PATH = MANIFEST_DIR / "manifest.csv"

FIELDS = ["source_filename", "title", "author", "edition", "pdf_type", "perspective_tag", "notes"]
MAX_BOOKS = 20

ROUTE_TO_PDF_TYPE = {"direct": "clean", "docling": "complex", "scanned": "scanned", "reject": "reject"}


def seed(force: bool) -> int:
    if MANIFEST_PATH.exists() and not force:
        print(f"ERROR: {MANIFEST_PATH} already exists. Use --force to overwrite.", file=sys.stderr)
        return 1

    pdfs = sorted(INPUT_DIR.glob("*.pdf"))
    if len(pdfs) == 0:
        print(f"ERROR: no PDFs in {INPUT_DIR}.", file=sys.stderr)
        return 1
    if len(pdfs) > MAX_BOOKS:
        print(f"ERROR: {len(pdfs)} PDFs found; pilot is capped at {MAX_BOOKS}.", file=sys.stderr)
        return 1

    classification: dict[str, dict] = {}
    class_path = MANIFEST_DIR / "classification.json"
    if class_path.exists():
        classification = {c["filename"]: c for c in json.loads(class_path.read_text())}

    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    with MANIFEST_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        for pdf in pdfs:
            route = classification.get(pdf.name, {}).get("route", "")
            writer.writerow(
                {
                    "source_filename": pdf.name,
                    "title": "",
                    "author": "",
                    "edition": "",
                    "pdf_type": ROUTE_TO_PDF_TYPE.get(route, ""),
                    "perspective_tag": "",
                    "notes": "",
                }
            )
    print(f"Seeded {len(pdfs)} rows into {MANIFEST_PATH}.")
    print("Fill in title/author/edition/perspective_tag by hand, then run --validate.")
    return 0


def validate() -> int:
    if not MANIFEST_PATH.exists():
        print(f"ERROR: {MANIFEST_PATH} does not exist. Run with --seed first.", file=sys.stderr)
        return 1

    with MANIFEST_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    problems: list[str] = []

    if len(rows) != MAX_BOOKS:
        problems.append(f"expected exactly {MAX_BOOKS} rows, found {len(rows)}")

    pdfs_on_disk = {p.name for p in INPUT_DIR.glob("*.pdf")}
    rows_by_file = {r["source_filename"] for r in rows}
    missing_from_manifest = pdfs_on_disk - rows_by_file
    missing_from_disk = rows_by_file - pdfs_on_disk
    if missing_from_manifest:
        problems.append(f"PDFs in pilot-input/ not in manifest: {sorted(missing_from_manifest)}")
    if missing_from_disk:
        problems.append(f"manifest rows with no matching PDF in pilot-input/: {sorted(missing_from_disk)}")

    type_counts = Counter(r["pdf_type"].strip().lower() for r in rows if r["pdf_type"].strip())
    for required in ("clean", "scanned", "complex"):
        if type_counts.get(required, 0) < 1:
            problems.append(f"need at least 1 book with pdf_type='{required}', found {type_counts.get(required, 0)}")

    tag_counts = Counter(r["perspective_tag"].strip() for r in rows if r["perspective_tag"].strip())
    paired_tags = [tag for tag, n in tag_counts.items() if n >= 2]
    if not paired_tags:
        problems.append(
            "need at least 2 books sharing the same non-empty perspective_tag "
            "(competing-perspective pair) — none found"
        )

    for r in rows:
        for field in ("title", "author"):
            if not r.get(field, "").strip():
                problems.append(f"{r.get('source_filename', '?')}: '{field}' is blank")

    if problems:
        print("Manifest validation FAILED:")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"Manifest validation passed: {len(rows)} books, mix requirements satisfied.")
    print(f"Perspective pairs found: {paired_tags}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", action="store_true", help="write a starter manifest.csv")
    parser.add_argument("--force", action="store_true", help="overwrite an existing manifest.csv when seeding")
    args = parser.parse_args()

    if args.seed:
        return seed(force=args.force)
    return validate()


if __name__ == "__main__":
    raise SystemExit(main())
