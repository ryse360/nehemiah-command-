# Operations Runbook

All commands assume `TARGET="$HOME/Developer/nehemiah-book-brain"` and are
run on the actual MacBook Air, not in a cloud session.

## Start

```bash
cd "$HOME/Developer/nehemiah-book-brain"
source .venv/bin/activate
export SWARMVAULT_OUT="$PWD/vault"
```

Open `vault/wiki/` in Obsidian as a **new, separate vault** (File → Open
another vault → open folder → select `vault/wiki`). Do not add it as a
subfolder of, or point it at, your existing Nehemiah/MiP vault.

To query from the CLI:

```bash
swarmvault query "your question"
```

To serve the interactive graph viewer:

```bash
swarmvault graph serve
```

To start the MCP server manually (normally Claude Code launches this
itself via `.mcp.json`):

```bash
swarmvault mcp
```

## Stop

The pipeline has no long-running daemon except `swarmvault graph serve`
(a local web server) — stop it with Ctrl-C. `swarmvault mcp` runs over
stdio and exits when the calling agent session ends. Deactivate the venv
with:

```bash
deactivate
```

## Update

Re-run extraction/compilation after adding or correcting a book's metadata:

```bash
cd "$HOME/Developer/nehemiah-book-brain"
source .venv/bin/activate
python "$(git -C /path/to/repo rev-parse --show-toplevel)/book-brain-pilot/scripts/02_classify_pdfs.py"
python .../scripts/03_extract.py
python .../scripts/05_quality_report.py
SWARMVAULT_OUT="$PWD/vault" swarmvault ingest "$PWD/extracted"
SWARMVAULT_OUT="$PWD/vault" swarmvault compile
```

(Adjust the script paths to wherever you cloned the `book-brain-pilot/`
folder locally.)

To update dependency versions: bump the pin in `requirements.txt`, then

```bash
pip install -r requirements.txt --upgrade
pip freeze > logs/installation-record.txt
```

For SwarmVault:

```bash
npm update -g @swarmvaultai/cli
npm list -g @swarmvaultai/cli --depth=0 >> logs/installation-record.txt
```

## Backup

Everything worth backing up lives under
`$HOME/Developer/nehemiah-book-brain`. It contains no original books (those
stay wherever your real library lives) and no API keys (none are stored on
disk by this pilot's default offline configuration). A plain copy/archive is
sufficient:

```bash
tar --exclude='.venv' --exclude='node_modules' \
    -czf "$HOME/Developer/nehemiah-book-brain-backup-$(date +%Y%m%d).tar.gz" \
    -C "$HOME/Developer" nehemiah-book-brain
```

Store that archive wherever you already back up `$HOME/Developer`.

## Uninstall

Full, reversible teardown — removes only the pilot's own files, never your
original books or your existing Obsidian vault:

```bash
"$(git -C /path/to/repo rev-parse --show-toplevel)/book-brain-pilot/scripts/99_uninstall.sh"
```

This:
1. Prompts for confirmation with the exact path it's about to remove.
2. Removes `$HOME/Developer/nehemiah-book-brain` (venv, extracted output,
   vault, logs — everything the pilot created).
3. Optionally uninstalls the global SwarmVault CLI
   (`npm uninstall -g @swarmvaultai/cli`) — asked separately, since it's a
   general-purpose tool that might be reused for something else.

It never touches `pilot-input/`'s originating source library location, and
never touches an existing Obsidian vault.
