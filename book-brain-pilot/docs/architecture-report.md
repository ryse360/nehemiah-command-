# Architecture Report — Nehemiah Book Brain Pilot

## Goal

Turn a controlled set of 20 PDF books into a private, local-first, searchable
knowledge base that a human can browse in Obsidian and an AI agent can query
over MCP — with every claim traceable back to a specific book, page, and
extraction method.

## Pipeline

```
                 ┌─────────────────────────────────────────────┐
                 │  pilot-input/  (20 books, read-only refs)    │
                 └───────────────────────┬───────────────────────┘
                                          │
                              02_classify_pdfs.py
                       (embedded text? scanned? complex layout?)
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 │                        │                        │
        clean, embedded text     structure/complex layout     failed / no text layer
                 │                        │                        │
     direct extraction (PyMuPDF)      Docling conversion        rejected/ + reason log
                 │                        │                        │
                 └────────────┬───────────┘                        │
                              │                                    │
                    03_extract.py writes                   (no forced OCR install;
                 provenance-tagged Markdown                 human reviews and decides)
                     into extracted/
                              │
                    05_quality_report.py
              (per-book extraction-quality report,
                 evaluation/ + logs/)
                              │
                 06_swarmvault_setup.sh
        SwarmVault ingests extracted/ → compiles
        wiki/ + knowledge graph + retrieval index
        under vault/, tagging every claim
        extracted / inferred / ambiguous
                              │
                 ┌────────────┴────────────┐
                 │                         │
        Obsidian opens vault/         SwarmVault MCP server
        wiki/ as a normal vault       (`swarmvault mcp`) lets an
        for human browsing/editing    agent query/compile/lint
                                       the same vault, citing
                                       source + PDF page
```

## Why this division of labor

- **Docling** is the extraction engine for anything beyond a clean text
  layer: multi-column layouts, tables, footnotes, headers/footers, scanned
  pages needing OCR. It's IBM's open-source layout-aware document converter
  and it runs entirely locally (no network calls once its layout/OCR models
  are downloaded once from Hugging Face on first run).
- **Direct extraction** (PyMuPDF/`pypdf`) is used instead of Docling whenever
  a PDF already has a clean embedded text layer and simple single-column
  layout — it's faster and there's nothing for Docling's layout model to add.
  The classifier in step 2 decides which books qualify.
- **SwarmVault** is the compiler, knowledge graph, retrieval layer, and MCP
  server. It ingests the Markdown Docling/direct-extraction produces, builds
  a typed knowledge graph (nodes/edges tagged `extracted` / `inferred` /
  `ambiguous`, each traceable to a source content hash), compiles human-facing
  Markdown wiki pages, and exposes all of it to an agent over MCP (`swarmvault
  mcp`, stdio). It ships its own offline heuristic provider — no API key or
  cloud LLM is required to get a working pilot; a cloud/local model can be
  added later purely as an optional upgrade to compilation quality.
- **Obsidian** is not modified or extended with plugins for this pilot — it
  is simply pointed at `vault/wiki/` as a second, brand-new vault, kept
  entirely separate from the existing Nehemiah/MiP vault.

## Provenance model

Every Markdown note produced by `03_extract.py` (regardless of extraction
method) carries YAML frontmatter:

```yaml
---
book_title: "..."
author: "..."
edition: "..."
chapter: "..."
pdf_page: 142
source_pdf: "the-exact-filename.pdf"
extraction_method: docling | direct
extracted_at: "<ISO 8601 timestamp>"
---
```

SwarmVault preserves and extends this provenance: every wiki node/edge it
compiles carries a source content hash back to the originating extracted
Markdown file (and therefore back to book/page/method), and classifies each
claim as `extracted` (directly stated), `inferred` (SwarmVault's synthesis),
or `ambiguous` (conflicting across sources — this is where the two
competing-perspective books in the pilot set are expected to surface
`Contradictions/` pages).

## Human-in-the-loop gate

AI-generated wiki content lands in `vault/inbox/` (SwarmVault's own staging
area) or is marked `status: candidate` in frontmatter, not directly in
`vault/wiki/`. A human reviews and promotes candidates. This satisfies the
requirement that AI-generated wiki changes remain candidates until approved
— no separate approval tooling is needed since SwarmVault already implements
a raw → compiled → reviewed staging model with a content-hash audit trail.

## Scaling boundary

This architecture is deliberately validated at 20 books before it ever
touches the ~800-book library: 20 books is enough to exercise every code
path (clean text, scanned/OCR, complex layout, contradictory perspectives)
without the cost or risk of a full-library run. `04_build_manifest.py` and
`01_bootstrap_pilot.sh` both hard-stop if more than 20 books are present in
`pilot-input/`, so scaling requires deliberately changing the script, not
accidentally dropping in more files.
