# Cross-Book Evaluation

## Required pilot book mix (20 books total)

Fill in `source-manifest/manifest.csv` so it contains, at minimum:

- ≥1 book with `pdf_type=clean` — clean embedded text, simple layout.
- ≥1 book with `pdf_type=scanned` — image-only pages needing OCR.
- ≥1 book with `pdf_type=complex` — multi-column, heavy tables/footnotes,
  or other layout that needs Docling's structure reconstruction.
- ≥2 books sharing the same `perspective_tag` value, chosen because they
  take **competing positions** on the same topic (e.g. two leadership books
  that disagree on a core practice). This pair is what should surface a
  `Contradictions/` page after SwarmVault compiles the graph.

`scripts/04_build_manifest.py` (validate mode) enforces this mix
mechanically — it fails until all four conditions hold.

## Five cross-book test questions

Write the actual five questions here once the 20 books are chosen — they
should each require synthesizing across ≥2 books, not just quoting one.
Template:

1. **Question:** _______________________________________________
   **Books it should draw from:** _______________________________
   **Expected type of answer:** synthesis / comparison / contradiction

2. **Question:** _______________________________________________
   **Books it should draw from:** _______________________________
   **Expected type of answer:** synthesis / comparison / contradiction

3. **Question:** _______________________________________________
   **Books it should draw from:** _______________________________
   **Expected type of answer:** synthesis / comparison / contradiction

4. **Question:** _______________________________________________
   **Books it should draw from:** _______________________________
   **Expected type of answer:** synthesis / comparison / contradiction

5. **Question — should surface the contradiction pair:**
   _______________________________________________
   **Books it should draw from:** the two `perspective_tag`-matched books
   **Expected type of answer:** contradiction, both positions named

Ask each via:

```bash
cd "$HOME/Developer/nehemiah-book-brain"
SWARMVAULT_OUT="$PWD/vault" swarmvault query "<question text>"
```

or, once the MCP server is registered, by asking an agent connected to it
in Claude Code.

## Citation-quality checklist (fill in per question, per answer)

For every answer produced, confirm:

- [ ] The answer names at least one specific book (not just "the sources").
- [ ] The answer (or SwarmVault's graph explanation, via
      `swarmvault graph explain <node>`) resolves back to a specific
      `pdf_page` in `extracted/<book>.md`.
- [ ] That page marker, opened in the extracted Markdown, actually contains
      the cited claim — i.e. spot-check the citation isn't hallucinated.
- [ ] If the answer draws on more than one book, each book/page is cited
      separately (not merged into one uncredited claim).
- [ ] Contradiction-pair question: both competing positions are named with
      their respective book + page, not silently resolved to one "winner."

| # | Question | Cited books+pages | Citation verified? | Notes |
|---|---|---|---|---|
| 1 | | | ☐ | |
| 2 | | | ☐ | |
| 3 | | | ☐ | |
| 4 | | | ☐ | |
| 5 | | | ☐ | |

## MCP smoke test with one agent

1. Confirm `.mcp.json` was written by `06_swarmvault_setup.sh` inside
   `$HOME/Developer/nehemiah-book-brain`.
2. Start a Claude Code session with that directory as its working
   directory so it picks up the MCP server.
3. Ask it one of the five questions above, verbatim.
4. Confirm the agent's answer cites a source and page (same checklist as
   above) and that it used the SwarmVault MCP tools (visible in its tool
   calls) rather than guessing from general knowledge.
5. Record the transcript excerpt in `evaluation/mcp-smoke-test.md`.
