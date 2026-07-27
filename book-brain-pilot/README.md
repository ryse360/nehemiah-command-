# Nehemiah Book Brain — 20-Book Pilot

A private, local-first, owner-editable learning brain built from PDF books, using
[Docling](https://github.com/docling-project/docling) for extraction,
[SwarmVault](https://github.com/swarmclawai/swarmvault) for durable Markdown wiki
compilation + knowledge graph + retrieval + MCP, and Obsidian as the human-facing
front end.

This is a **controlled 20-book pilot**. It is explicitly not the full ~800-book
library run. Nothing here scales past 20 books without a human re-reading the
pilot's evaluation report and giving explicit approval to proceed.

## Why this lives in a repo instead of running here

This content was authored inside a **remote, ephemeral, Linux cloud session**
attached to the `ryse360/nehemiah-command-` GitHub repository — not on the
MacBook Air the pilot targets. That session cannot see your Mac's hardware,
Python/Node/Docker installs, your PDFs, or your Obsidian vaults, and it cannot
persist an install anywhere you could run Obsidian against it. Everything
under `book-brain-pilot/` is therefore **plan + tooling to run yourself**, via
a local Claude Code session (or manually) on the actual Mac. Nothing has been
installed or executed against real books yet.

## Safety constraints (non-negotiable, enforced by the scripts below)

- Original books are **never** modified, renamed, moved, or deleted. Every
  script that touches a PDF reads it and writes derived output elsewhere;
  none open source files in write mode.
- Only **20 books** are ever placed in `pilot-input/`. `01_bootstrap_pilot.sh`
  and `04_build_manifest.py` both hard-stop if the count is anything but 20.
- No installation of RAGFlow, LightRAG, Unlimited-OCR, Ollama, or additional
  Docker services. The only new tools installed are the Docling Python
  package and the SwarmVault Node CLI, both run natively (no containers).
- Nothing is merged into your existing Nehemiah/MiP Obsidian vault. This
  pilot's vault is a brand-new folder under
  `$HOME/Developer/nehemiah-book-brain/vault`, opened in Obsidian as its own
  separate vault.
- Virtual environments and pinned dependency versions only — see
  `requirements.txt` and `docs/installation-plan.md`.
- Every extracted note preserves: book title, author, edition, chapter, PDF
  page number, extraction method, and source filename — as YAML frontmatter
  on every generated Markdown note.
- Every AI-generated wiki page is written to `vault/inbox/` (or flagged
  `status: candidate` in frontmatter) until a human moves/approves it. Nothing
  auto-promotes into `vault/wiki/` as "approved."
- No API keys are ever written into a script, config committed to git, or
  source file. Where a cloud LLM provider is optional, keys are referenced by
  environment variable name only.
- Scaling past 20 books, installing anything not listed above, or merging
  into the real vault all require you to stop and explicitly approve first.

## Run order

1. Read `docs/installation-plan.md` and approve it (or request changes)
   before running anything that installs software.
2. `scripts/00_system_check.sh` — reports Mac arch, macOS version, RAM, disk,
   Python/Node/npm/Docker versions, and discovered Obsidian vaults. Read-only.
3. `scripts/01_bootstrap_pilot.sh` — creates the directory tree, Python venv,
   pinned pip installs, and the SwarmVault CLI (only after you've approved
   step 1).
4. Copy or symlink exactly 20 books into `pilot-input/` (see
   `docs/installation-plan.md` for the required mix).
5. `python scripts/02_classify_pdfs.py` — classifies each PDF
   (clean-text / scanned / complex-layout).
5a. `python scripts/04_build_manifest.py --seed` — seeds
    `source-manifest/manifest.csv` from the classified PDFs, then fill in
    title/author/edition/perspective_tag by hand and run
    `python scripts/04_build_manifest.py` (validate mode) until it passes.
6. `python scripts/03_extract.py` — routes each book to direct-text
   extraction or Docling, writes provenance-tagged Markdown into
   `extracted/`, and routes failures to `rejected/`.
7. `python scripts/05_quality_report.py` — produces the extraction-quality
   and failed-document reports under `evaluation/`.
8. `scripts/06_swarmvault_setup.sh` — points SwarmVault at `vault/`, compiles
   the wiki and knowledge graph, and registers the MCP server.
9. Work through `docs/cross-book-evaluation.md` — five cross-book questions,
   verifying every answer cites a source and PDF page.
10. Fill in `docs/recommendation-template.md` with the actual pilot results
    and a proceed / correct / reject call before considering the full library.

## Directory layout produced under `$HOME/Developer/nehemiah-book-brain/`

```
nehemiah-book-brain/
├── source-manifest/     # tracked, human-edited metadata for the 20 books
├── pilot-input/         # copies/symlinks of exactly 20 source PDFs (read-only refs)
├── extracted/           # Docling / direct-extraction Markdown output, with provenance
├── rejected/            # failed scans + reason logs, routed here instead of forced OCR
├── logs/                # run logs from every script
├── evaluation/          # quality report, failed-document report, citation evaluation
└── vault/
    ├── raw/             # SwarmVault's immutable source copies
    ├── wiki/
    │   ├── Sources/ Authors/ Concepts/ Frameworks/ Principles/
    │   └── Contradictions/ Applications/ Synthesis/
    ├── state/           # graph.json, retrieval index, embeddings, approvals
    ├── agent/           # SwarmVault agent working files
    └── inbox/           # AI-generated candidates awaiting human approval
```

## Files in this folder

| File | Purpose |
|---|---|
| `docs/architecture-report.md` | How the pipeline fits together and why |
| `docs/installation-plan.md` | Exact versions to install; requires your approval |
| `docs/operations-runbook.md` | Start / stop / update / backup / uninstall commands |
| `docs/cross-book-evaluation.md` | Five cross-book test questions + citation checklist |
| `docs/recommendation-template.md` | Proceed / correct / reject decision record |
| `scripts/00_system_check.sh` | Read-only environment report |
| `scripts/01_bootstrap_pilot.sh` | Creates folders, venv, pinned installs |
| `scripts/02_classify_pdfs.py` | Clean / scanned / complex-layout classifier |
| `scripts/03_extract.py` | Extraction router + provenance tagging |
| `scripts/04_build_manifest.py` | Builds `source-manifest/manifest.csv` |
| `scripts/05_quality_report.py` | Extraction-quality + failed-document report |
| `scripts/06_swarmvault_setup.sh` | SwarmVault init, compile, MCP registration |
| `scripts/99_uninstall.sh` | Fully reversible teardown of the pilot only |
| `requirements.txt` | Pinned Python dependencies |
| `templates/source-manifest.csv` | Manifest schema/template |
| `templates/swarmvault.config.template.json` | SwarmVault config, no literal keys |
