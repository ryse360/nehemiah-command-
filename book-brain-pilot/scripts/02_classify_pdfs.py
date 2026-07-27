#!/usr/bin/env python3
"""Classify each PDF in pilot-input/ before choosing an extraction route.

Read-only with respect to source PDFs: every file is opened in read mode
only. Writes a classification report to source-manifest/classification.json
and logs/classify.log. Does not extract any content itself — that's
03_extract.py's job, using this script's routing decision.

Classification buckets:
  - "direct"   : has a real embedded text layer, simple layout -> direct
                 extraction (PyMuPDF) is sufficient.
  - "docling"  : has text but complex layout (multi-column, heavy tables,
                 footnotes) -> needs Docling's layout-aware conversion.
  - "scanned"  : no usable embedded text layer (image-only pages) -> needs
                 Docling + OCR (ocrmac extra on Apple Silicon).
  - "reject"   : could not be classified (corrupt/encrypted/unreadable) ->
                 routed straight to rejected/ without attempting extraction.
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF (pymupdf) is not installed. Activate the pilot venv first.", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
BOOK_BRAIN_HOME = Path(
    __import__("os").environ.get("NEHEMIAH_BOOK_BRAIN_HOME", str(Path.home() / "Developer" / "nehemiah-book-brain"))
)
INPUT_DIR = BOOK_BRAIN_HOME / "pilot-input"
MANIFEST_DIR = BOOK_BRAIN_HOME / "source-manifest"
LOG_DIR = BOOK_BRAIN_HOME / "logs"

MAX_BOOKS = 20
# A page counts as "text-bearing" if it yields at least this many characters
# of extractable text — short of that, treat the page as image-only.
MIN_CHARS_PER_PAGE = 40
# Fraction of sampled pages that must be text-bearing for a book to be
# considered to have a usable embedded text layer at all.
TEXT_LAYER_THRESHOLD = 0.6
# A book is "complex layout" (route to Docling) if this fraction of sampled
# pages contain multiple text columns/blocks in a way that suggests layout
# reconstruction matters (heuristic: many narrow, offset text blocks).
COMPLEX_LAYOUT_BLOCK_THRESHOLD = 8
COMPLEX_LAYOUT_FRACTION = 0.3
SAMPLE_PAGES = 15  # sample at most this many pages, spread across the book


@dataclass
class Classification:
    filename: str
    pages: int
    sampled_pages: int
    text_bearing_fraction: float
    complex_layout_fraction: float
    route: str
    reason: str


def sample_page_indices(n_pages: int, sample_size: int) -> list[int]:
    if n_pages <= sample_size:
        return list(range(n_pages))
    step = n_pages / sample_size
    return sorted({int(i * step) for i in range(sample_size)})


def classify_one(pdf_path: Path) -> Classification:
    try:
        doc = fitz.open(pdf_path)  # opened read-only; never written back to
    except Exception as exc:  # noqa: BLE001 - want to route any failure to reject
        return Classification(
            filename=pdf_path.name,
            pages=0,
            sampled_pages=0,
            text_bearing_fraction=0.0,
            complex_layout_fraction=0.0,
            route="reject",
            reason=f"could not open PDF: {exc}",
        )

    n_pages = doc.page_count
    if n_pages == 0:
        doc.close()
        return Classification(pdf_path.name, 0, 0, 0.0, 0.0, "reject", "zero pages")

    indices = sample_page_indices(n_pages, SAMPLE_PAGES)
    text_bearing = 0
    complex_pages = 0
    for i in indices:
        page = doc.load_page(i)
        text = page.get_text("text") or ""
        if len(text.strip()) >= MIN_CHARS_PER_PAGE:
            text_bearing += 1
        blocks = page.get_text("blocks") or []
        # Many distinct text blocks on a page is a decent proxy for
        # multi-column / footnote-heavy / table-heavy layouts.
        if len(blocks) >= COMPLEX_LAYOUT_BLOCK_THRESHOLD:
            complex_pages += 1
    doc.close()

    sampled = len(indices)
    text_frac = text_bearing / sampled
    complex_frac = complex_pages / sampled

    if text_frac < TEXT_LAYER_THRESHOLD:
        route = "scanned"
        reason = f"only {text_frac:.0%} of sampled pages had a usable text layer"
    elif complex_frac >= COMPLEX_LAYOUT_FRACTION:
        route = "docling"
        reason = f"{complex_frac:.0%} of sampled pages show complex/multi-block layout"
    else:
        route = "direct"
        reason = "clean embedded text layer, simple layout"

    return Classification(
        filename=pdf_path.name,
        pages=n_pages,
        sampled_pages=sampled,
        text_bearing_fraction=round(text_frac, 3),
        complex_layout_fraction=round(complex_frac, 3),
        route=route,
        reason=reason,
    )


def main() -> int:
    if not INPUT_DIR.exists():
        print(f"ERROR: {INPUT_DIR} does not exist. Run 01_bootstrap_pilot.sh first.", file=sys.stderr)
        return 1

    pdfs = sorted(INPUT_DIR.glob("*.pdf"))
    if len(pdfs) == 0:
        print(f"ERROR: no PDFs found in {INPUT_DIR}.", file=sys.stderr)
        return 1
    if len(pdfs) > MAX_BOOKS:
        print(
            f"ERROR: {len(pdfs)} PDFs found in {INPUT_DIR}, but this pilot is "
            f"capped at {MAX_BOOKS}. Remove books before proceeding — do not "
            f"scale the pilot without explicit approval.",
            file=sys.stderr,
        )
        return 1

    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    for pdf_path in pdfs:
        result = classify_one(pdf_path)
        results.append(result)
        print(f"{result.filename}: {result.route}  ({result.reason})")

    out_path = MANIFEST_DIR / "classification.json"
    out_path.write_text(json.dumps([asdict(r) for r in results], indent=2))

    route_counts: dict[str, int] = {}
    for r in results:
        route_counts[r.route] = route_counts.get(r.route, 0) + 1

    log_path = LOG_DIR / "classify.log"
    with log_path.open("a") as f:
        f.write(f"\n--- classify run: {len(pdfs)} PDFs ---\n")
        f.write(json.dumps(route_counts, indent=2) + "\n")

    print(f"\nWrote classification for {len(pdfs)} books to {out_path}")
    print(f"Route counts: {route_counts}")
    if route_counts.get("reject", 0) > 0:
        print(
            "Some PDFs were unreadable/corrupt and are marked 'reject' — they "
            "will be routed to rejected/ by 03_extract.py, not force-processed."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
