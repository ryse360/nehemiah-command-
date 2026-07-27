#!/usr/bin/env python3
"""Generate the extraction-quality report and failed-document report.

Reads extracted/*.md, rejected/*.reason.txt, source-manifest/manifest.csv,
and source-manifest/classification.json. Writes:
  - evaluation/extraction-quality-report.md  (human-readable)
  - evaluation/extraction-quality-report.json (machine-readable)
  - evaluation/failed-documents-report.md

Nothing here re-processes any PDF; it only inspects already-produced output.
"""
from __future__ import annotations

import csv
import json
import os
import re
from pathlib import Path

BOOK_BRAIN_HOME = Path(
    os.environ.get("NEHEMIAH_BOOK_BRAIN_HOME", str(Path.home() / "Developer" / "nehemiah-book-brain"))
)
MANIFEST_DIR = BOOK_BRAIN_HOME / "source-manifest"
EXTRACTED_DIR = BOOK_BRAIN_HOME / "extracted"
REJECTED_DIR = BOOK_BRAIN_HOME / "rejected"
EVAL_DIR = BOOK_BRAIN_HOME / "evaluation"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
PAGE_MARKER_RE = re.compile(r"<!-- pdf_page: (\d+) -->")
CHAPTER_MARKER_RE = re.compile(r"^## Chapter: ", re.MULTILINE)


def parse_frontmatter(text: str) -> dict:
    m = FRONTMATTER_RE.match(text)
    meta = {}
    if not m:
        return meta
    for line in m.group(1).splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip().strip('"')
    return meta


def load_classification() -> dict[str, dict]:
    path = MANIFEST_DIR / "classification.json"
    if not path.exists():
        return {}
    return {c["filename"]: c for c in json.loads(path.read_text())}


def main() -> int:
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    classification = load_classification()

    book_reports = []
    for md_path in sorted(EXTRACTED_DIR.glob("*.md")):
        text = md_path.read_text(encoding="utf-8", errors="replace")
        meta = parse_frontmatter(text)
        pages_seen = sorted({int(p) for p in PAGE_MARKER_RE.findall(text)})
        chapters_detected = len(CHAPTER_MARKER_RE.findall(text))
        word_count = len(text.split())
        source_pdf = meta.get("source_pdf", "")
        expected_pages = classification.get(source_pdf, {}).get("pages")

        page_coverage = None
        if expected_pages:
            page_coverage = round(len(pages_seen) / expected_pages, 3) if expected_pages else None

        flags = []
        if word_count < 200:
            flags.append("very low word count — check extraction actually captured content")
        if not pages_seen:
            flags.append("no pdf_page markers found — provenance is broken for this file")
        if page_coverage is not None and page_coverage < 0.9:
            flags.append(f"only {page_coverage:.0%} of expected pages produced output")
        if chapters_detected == 0:
            flags.append("no chapter headings detected (heuristic may have missed them — spot check)")

        book_reports.append(
            {
                "file": md_path.name,
                "book_title": meta.get("book_title"),
                "source_pdf": source_pdf,
                "extraction_method": meta.get("extraction_method"),
                "pages_extracted": len(pages_seen),
                "pages_expected": expected_pages,
                "page_coverage": page_coverage,
                "chapters_detected": chapters_detected,
                "word_count": word_count,
                "flags": flags,
            }
        )

    failed_reports = []
    for reason_path in sorted(REJECTED_DIR.glob("*.reason.txt")):
        content = reason_path.read_text()
        entry = {"file": reason_path.name}
        for line in content.splitlines():
            if ":" in line:
                key, _, value = line.partition(":")
                entry[key.strip()] = value.strip()
        failed_reports.append(entry)

    (EVAL_DIR / "extraction-quality-report.json").write_text(
        json.dumps({"books": book_reports, "failed": failed_reports}, indent=2)
    )

    lines = ["# Extraction Quality Report", ""]
    lines.append(f"Books successfully extracted: {len(book_reports)}")
    lines.append(f"Books rejected/failed: {len(failed_reports)}")
    lines.append("")
    lines.append("| Book | Method | Pages extracted | Coverage | Chapters | Flags |")
    lines.append("|---|---|---|---|---|---|")
    for r in book_reports:
        coverage = f"{r['page_coverage']:.0%}" if r["page_coverage"] is not None else "n/a"
        flags = "; ".join(r["flags"]) if r["flags"] else "none"
        lines.append(
            f"| {r['book_title'] or r['file']} | {r['extraction_method']} | "
            f"{r['pages_extracted']} | {coverage} | {r['chapters_detected']} | {flags} |"
        )
    (EVAL_DIR / "extraction-quality-report.md").write_text("\n".join(lines) + "\n")

    fail_lines = ["# Failed-Document Report", ""]
    if not failed_reports:
        fail_lines.append("No books were rejected in this run.")
    else:
        fail_lines.append("| File | Reason | Action |")
        fail_lines.append("|---|---|---|")
        for f in failed_reports:
            fail_lines.append(f"| {f.get('source_pdf', f['file'])} | {f.get('reason', '')} | {f.get('action', '')} |")
        fail_lines.append("")
        fail_lines.append(
            "None of these were auto-retried with an additional OCR engine, per the pilot's "
            "safety constraints. Review each manually and decide case by case."
        )
    (EVAL_DIR / "failed-documents-report.md").write_text("\n".join(fail_lines) + "\n")

    print(f"Wrote reports to {EVAL_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
