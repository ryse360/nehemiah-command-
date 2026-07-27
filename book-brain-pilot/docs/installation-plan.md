# Installation Plan — Requires Your Approval Before Running

Run `../scripts/00_system_check.sh` first and paste its output back before
approving this plan — the checks below (Node ≥24, Python compatibility, free
disk) gate whether this plan can proceed as-is.

## What gets installed, and where

| Component | Version pinned | Install method | Scope |
|---|---|---|---|
| Python (interpreter) | 3.11 or 3.12 (see note) | *(assumed already present via Homebrew/pyenv/system)* | system-wide, not touched by this pilot |
| Python venv | — | `python3 -m venv .venv` inside `nehemiah-book-brain/` | project-local only |
| `docling` | `2.115.0` | `pip install` inside the venv | venv-local |
| `pypdf` | `5.1.0` | `pip install` inside the venv | venv-local |
| `pymupdf` (fitz) | `1.24.13` | `pip install` inside the venv | venv-local |
| `pdfplumber` | `0.11.4` | `pip install` inside the venv | venv-local |
| `rich` | `13.9.4` | `pip install` inside the venv (progress output only) | venv-local |
| Node.js | `>=24` (required by SwarmVault) | *(assumed already present via nvm/Homebrew)* | system-wide, not touched by this pilot |
| `@swarmvaultai/cli` (SwarmVault) | latest at install time — record exact resolved version in the installation record after running `npm install -g` | `npm install -g @swarmvaultai/cli` | global npm, user-level (no sudo) |

No Docker, RAGFlow, LightRAG, Unlimited-OCR, or Ollama are installed. Docling's
optional `ocrmac` extra (native macOS Vision-framework OCR, Apple Silicon
only) may be enabled for scanned pages — this is a Docling extra, not a
separate OCR product, and stays fully local/offline.

## Preconditions to verify from `00_system_check.sh` output

1. **Architecture:** Apple Silicon (`arm64`) confirmed via `uname -m`.
2. **macOS version:** recorded, no specific minimum required by Docling or
   SwarmVault, but note it for the installation record.
3. **RAM:** Docling's layout/OCR models are comfortable on 16 GB+; if the
   machine reports less, flag it before proceeding — do not silently
   downgrade to CPU-only-degraded behavior without telling you.
4. **Free disk space:** budget ~3–5 GB for Docling's model downloads (layout
   + OCR models, pulled once from Hugging Face on first conversion) plus
   ~500 MB for the 20-book pilot's extracted/vault artifacts. Stop and report
   if free space is under 10 GB.
5. **Python version:** Docling 2.115.0 requires **Python ≥3.10, <4.0**. Do not
   install a new Python version automatically — report which interpreters
   `00_system_check.sh` finds (`python3 --version`, `pyenv versions`, or
   Homebrew python@3.x) and let you pick which one the venv is built from.
6. **Node version:** SwarmVault requires **Node ≥24**. If the system reports
   an older LTS (e.g. 20/22), stop and report — do not install a new Node via
   this pipeline; you decide whether to use nvm to add Node 24 alongside your
   existing version.
7. **npm version:** recorded for the installation record; no hard minimum
   beyond what ships with Node 24.
8. **Docker status:** recorded only — Docker is not required and nothing in
   this pilot starts or depends on a Docker daemon.
9. **Obsidian vault locations:** `00_system_check.sh` searches for
   `*.obsidian` config folders under common locations (`~/Documents`,
   `~/Obsidian`, iCloud Drive's Obsidian folder) and lists them **without
   opening or modifying any of them**. This pilot's new vault
   (`nehemiah-book-brain/vault/`) is never pointed at the same path as an
   existing vault.

## Approval checklist

Before running `01_bootstrap_pilot.sh`, confirm:

- [ ] `00_system_check.sh` has been run and its output reviewed.
- [ ] Architecture is Apple Silicon and Python ≥3.10 is available (or you've
      chosen which interpreter to use).
- [ ] Node ≥24 is available (or you've installed it yourself via nvm first).
- [ ] Free disk space is ≥10 GB.
- [ ] You've confirmed `$HOME/Developer/nehemiah-book-brain` does not already
      exist with unrelated content (the bootstrap script checks this too and
      refuses to overwrite a non-empty, non-pilot directory).
- [ ] You've selected exactly 20 books for the pilot set, per the mix required
      in `docs/cross-book-evaluation.md` (clean PDFs, scanned PDFs,
      complex-layout books, and ≥2 books with competing perspectives).
- [ ] You are not asking this pipeline to touch the existing Nehemiah/MiP
      Obsidian vault.

Once all boxes are checked, run `scripts/01_bootstrap_pilot.sh`.

## After installing: record actual resolved versions

`01_bootstrap_pilot.sh` writes the exact resolved versions (via `pip freeze`
and `npm list -g @swarmvaultai/cli`) to
`logs/installation-record.txt` — that file, not this plan, is the source of
truth for "what's actually installed" once you've run it.
