# Pilot Recommendation — Proceed / Correct / Reject

Fill this in **after** actually running the pilot on the real MacBook Air
with the real 20 books. This file, unfilled, is not a recommendation — it's
the form the recommendation goes in.

## Installation record

- [ ] `logs/installation-record.txt` exists and lists pinned versions that
      actually resolved (Docling, SwarmVault CLI, Node, Python).
- Deviations from `docs/installation-plan.md`, if any: _______________

## Extraction results summary

- Books processed: ___ / 20
- Books rejected: ___ (see `evaluation/failed-documents-report.md`)
- Route breakdown: direct ___ / docling ___ / scanned ___
- Any book with <90% page coverage per
  `evaluation/extraction-quality-report.md`: _______________

## Citation-quality evaluation

- 5/5 cross-book questions produced answers that cited a specific book +
  PDF page: yes / no — if no, which failed and why: _______________
- Contradiction-pair question correctly surfaced both competing positions:
  yes / no

## MCP smoke test

- Agent successfully queried the vault via MCP and cited a source: yes / no
- Transcript excerpt saved to `evaluation/mcp-smoke-test.md`: yes / no

## Safety constraints re-check

- [ ] No original book file was modified, renamed, moved, or deleted
      (spot-check checksums/mtimes against the real library if unsure).
- [ ] Exactly 20 books were processed — no accidental scale-up.
- [ ] No additional OCR engine, RAGFlow, LightRAG, or Ollama was installed.
- [ ] The existing Nehemiah/MiP Obsidian vault was not touched.
- [ ] No API key appears in any committed file or script.

## Recommendation

Choose one:

- [ ] **Proceed** — pilot met the bar on extraction quality and citation
      accuracy; ready to plan a controlled, batched expansion (state the
      proposed next batch size and any additional review gates).
- [ ] **Correct** — pilot surfaced fixable problems (name them, and the
      specific script/step each maps to) before any further scale-up.
- [ ] **Reject** — pilot revealed a structural problem with this approach
      that isn't a simple fix (name it).

### Reasoning

_______________________________________________________________
_______________________________________________________________

### If proceeding: proposed next step (still requires separate approval)

_______________________________________________________________
