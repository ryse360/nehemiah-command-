#!/usr/bin/env python3
"""Route each classified PDF to direct extraction or Docling, and write
provenance-tagged Markdown into extracted/. Failed/rejected PDFs are routed
to rejected/ with a reason report instead of being force-processed through
another OCR engine.

Reads pilot-input/*.pdf (read-only — never opened in write mode) plus
source-manifest/classification.json (from 02_classify_pdfs.py) and, if
present, source-manifest/manifest.csv (book_title/author/edition, filled in
by a human) for accurate frontmatter. Falls back to PDF metadata/filename
when manifest rows are missing.

Output: one Markdown file per book in extracted/<slug>.md, with:
  - book-level YAML frontmatter (title, author, edition, source_pdf,
    extraction_method, extracted_at, status: candidate)
  - inline page markers ("<!-- pdf_page: N -->") before each page's text,
    so every paragraph traces back to an exact PDF page
  - "## Chapter: ..." headings wherever a chapter/section boundary is
    detected, so downstream chunking has natural break points
"""
from __future__ import annotations

import csv
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF (pymupdf) is not installed. Activate the pilot venv first.", file=sys.stderr)
    sys.exit(1)

BOOK_BRAIN_HOME = Path(
    os.environ.get("NEHEMIAH_BOOK_BRAIN_HOME", str(Path.home() / "Developer" / "nehemiah-book-brain"))
)
INPUT_DIR = BOOK_BRAIN_HOME / "pilot-input"
MANIFEST_DIR = BOOK_BRAIN_HOME / "source-manifest"
EXTRACTED_DIR = BOOK_BRAIN_HOME / "extracted"
REJECTED_DIR = BOOK_BRAIN_HOME / "rejected"
LOG_DIR = BOOK_BRAIN_HOME / "logs"

HEADING_MIN_FONT_DELTA = 2.0  # points larger than the page's median to count as a heading
HEADING_MAX_CHARS = 80


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return s or "untitled"


def load_manifest_rows() -> dict[str, dict]:
    path = MANIFEST_DIR / "manifest.csv"
    rows: dict[str, dict] = {}
    if not path.exists():
        return rows
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            filename = (row.get("source_filename") or "").strip()
            if filename:
                rows[filename] = row
    return rows


def load_classification() -> dict[str, dict]:
    path = MANIFEST_DIR / "classification.json"
    if not path.exists():
        print(f"ERROR: {path} missing. Run 02_classify_pdfs.py first.", file=sys.stderr)
        sys.exit(1)
    return {c["filename"]: c for c in json.loads(path.read_text())}


def frontmatter(meta_row: dict, pdf_path: Path, extraction_method: str) -> str:
    title = meta_row.get("title") or pdf_path.stem
    author = meta_row.get("author") or "unknown"
    edition = meta_row.get("edition") or "unknown"
    lines = [
        "---",
        f'book_title: "{title}"',
        f'author: "{author}"',
        f'edition: "{edition}"',
        f'source_pdf: "{pdf_path.name}"',
        f"extraction_method: {extraction_method}",
        f'extracted_at: "{dt.datetime.now(dt.timezone.utc).isoformat()}"',
        "status: candidate",
        "---",
        "",
    ]
    return "\n".join(lines)


def extract_direct(pdf_path: Path) -> str:
    """PyMuPDF extraction with a font-size heuristic for chapter headings."""
    doc = fitz.open(pdf_path)  # read-only
    out_lines: list[str] = []
    try:
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            page_dict = page.get_text("dict")
            sizes = [
                span["size"]
                for block in page_dict.get("blocks", [])
                for line in block.get("lines", [])
                for span in line.get("spans", [])
            ]
            median_size = sorted(sizes)[len(sizes) // 2] if sizes else 0
            out_lines.append(f"<!-- pdf_page: {page_index + 1} -->")
            for block in page_dict.get("blocks", []):
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue
                    text = "".join(span.get("text", "") for span in spans).strip()
                    if not text:
                        continue
                    max_size = max(span["size"] for span in spans)
                    is_heading = (
                        max_size >= median_size + HEADING_MIN_FONT_DELTA
                        and len(text) <= HEADING_MAX_CHARS
                    )
                    if is_heading:
                        out_lines.append(f"\n## Chapter: {text}\n")
                    else:
                        out_lines.append(text)
            out_lines.append("")
    finally:
        doc.close()
    return "\n".join(out_lines)


def extract_docling(pdf_path: Path) -> str:
    """Docling conversion for complex-layout or scanned books.

    Uses Docling's default layout + (as needed) OCR pipeline. On Apple
    Silicon, enable the native `ocrmac` extra in requirements.txt if scanned
    books need OCR — no separate OCR product is installed.
    """
    from docling.document_converter import DocumentConverter  # imported lazily: heavy import

    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))  # reads the PDF; never writes to it
    doc = result.document

    out_lines: list[str] = []
    current_page = None
    for item, _level in doc.iterate_items():
        page_no = None
        prov = getattr(item, "prov", None)
        if prov:
            page_no = prov[0].page_no
        if page_no is not None and page_no != current_page:
            current_page = page_no
            out_lines.append(f"<!-- pdf_page: {page_no} -->")

        label = str(getattr(item, "label", "")).lower()
        text = getattr(item, "text", "") or ""
        if not text.strip():
            continue
        if "heading" in label or "title" in label or "section" in label:
            out_lines.append(f"\n## Chapter: {text.strip()}\n")
        else:
            out_lines.append(text.strip())
    return "\n".join(out_lines)


def main() -> int:
    if not INPUT_DIR.exists():
        print(f"ERROR: {INPUT_DIR} does not exist. Run 01_bootstrap_pilot.sh first.", file=sys.stderr)
        return 1

    EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
    REJECTED_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    classification = load_classification()
    manifest_rows = load_manifest_rows()

    log_path = LOG_DIR / "extract.log"
    log_lines = [f"--- extract run: {dt.datetime.now(dt.timezone.utc).isoformat()} ---"]

    for filename, info in sorted(classification.items()):
        pdf_path = INPUT_DIR / filename
        route = info["route"]
        meta_row = manifest_rows.get(filename, {})

        if route == "reject" or not pdf_path.exists():
            reason = info.get("reason", "missing file") if pdf_path.exists() else "file missing from pilot-input/"
            reject_report = REJECTED_DIR / f"{slugify(filename)}.reason.txt"
            reject_report.write_text(
                f"source_pdf: {filename}\nreason: {reason}\n"
                f"action: not processed. Review manually; do not auto-install another OCR engine.\n"
            )
            log_lines.append(f"{filename}: REJECTED ({reason})")
            print(f"{filename}: rejected -> {reject_report}")
            continue

        method = "direct" if route == "direct" else "docling"
        try:
            if method == "direct":
                body = extract_direct(pdf_path)
            else:
                body = extract_docling(pdf_path)
        except Exception as exc:  # noqa: BLE001 - route extraction failures to rejected/, don't crash the batch
            reject_report = REJECTED_DIR / f"{slugify(filename)}.reason.txt"
            reject_report.write_text(
                f"source_pdf: {filename}\nreason: extraction failed via {method}: {exc}\n"
                f"action: not processed further. Review manually.\n"
            )
            log_lines.append(f"{filename}: EXTRACTION FAILED via {method} ({exc})")
            print(f"{filename}: extraction failed via {method} -> {reject_report}")
            continue

        title = meta_row.get("title") or pdf_path.stem
        out_path = EXTRACTED_DIR / f"{slugify(title)}.md"
        out_path.write_text(frontmatter(meta_row, pdf_path, method) + body)
        log_lines.append(f"{filename}: OK via {method} -> {out_path.name}")
        print(f"{filename}: extracted via {method} -> {out_path}")

    with log_path.open("a") as f:
        f.write("\n".join(log_lines) + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
