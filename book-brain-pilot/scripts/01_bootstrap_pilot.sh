#!/usr/bin/env bash
# Creates the pilot directory tree, Python venv, pinned pip installs, and the
# SwarmVault CLI. Idempotent and non-destructive: refuses to touch a
# pre-existing, non-pilot directory, and never modifies anything outside
# $HOME/Developer/nehemiah-book-brain.
#
# Run only after approving docs/installation-plan.md.
set -euo pipefail

TARGET="${NEHEMIAH_BOOK_BRAIN_HOME:-$HOME/Developer/nehemiah-book-brain}"
PY_BIN="${PYTHON_BIN:-python3}"

echo "Target: $TARGET"
echo "Python: $($PY_BIN --version 2>&1) ($(command -v "$PY_BIN"))"

# Safety: refuse to hijack an existing, unrelated directory.
if [ -e "$TARGET" ] && [ -z "$(find "$TARGET" -maxdepth 1 -name 'source-manifest' -o -name 'vault' 2>/dev/null)" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
  echo "ERROR: $TARGET already exists and does not look like a pilot directory."
  echo "Refusing to touch it. Move it aside or point NEHEMIAH_BOOK_BRAIN_HOME elsewhere."
  exit 1
fi

# Python version guard (Docling requires >=3.10, <4.0).
py_ver=$("$PY_BIN" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
py_major=${py_ver%%.*}
py_minor=${py_ver##*.}
if [ "$py_major" -ne 3 ] || [ "$py_minor" -lt 10 ]; then
  echo "ERROR: Docling requires Python >=3.10, <4.0. Found $py_ver."
  echo "Set PYTHON_BIN to a compatible interpreter and re-run, e.g.:"
  echo "  PYTHON_BIN=python3.11 $0"
  exit 1
fi

# Node version guard (SwarmVault requires >=24).
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node >=24 (e.g. via nvm) before continuing."
  exit 1
fi
node_major=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$node_major" -lt 24 ]; then
  echo "ERROR: SwarmVault requires Node >=24. Found $(node --version)."
  echo "Install/switch to Node 24+ (e.g. 'nvm install 24 && nvm use 24') and re-run."
  exit 1
fi

echo "Creating directory tree under $TARGET ..."
mkdir -p \
  "$TARGET/source-manifest" \
  "$TARGET/pilot-input" \
  "$TARGET/extracted" \
  "$TARGET/rejected" \
  "$TARGET/logs" \
  "$TARGET/evaluation" \
  "$TARGET/vault/raw" \
  "$TARGET/vault/wiki/Sources" \
  "$TARGET/vault/wiki/Authors" \
  "$TARGET/vault/wiki/Concepts" \
  "$TARGET/vault/wiki/Frameworks" \
  "$TARGET/vault/wiki/Principles" \
  "$TARGET/vault/wiki/Contradictions" \
  "$TARGET/vault/wiki/Applications" \
  "$TARGET/vault/wiki/Synthesis" \
  "$TARGET/vault/state" \
  "$TARGET/vault/agent" \
  "$TARGET/vault/inbox"

cd "$TARGET"

if [ ! -d ".venv" ]; then
  echo "Creating Python venv ..."
  "$PY_BIN" -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

REQ_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/requirements.txt"
echo "Installing pinned Python dependencies from $REQ_FILE ..."
pip install --upgrade pip >/dev/null
pip install -r "$REQ_FILE"

echo "Installing SwarmVault CLI (npm, user-level, no sudo) ..."
npm install -g @swarmvaultai/cli

{
  echo "# Installation record — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "## Python"
  echo '```'
  "$PY_BIN" --version
  pip freeze
  echo '```'
  echo
  echo "## Node / SwarmVault"
  echo '```'
  node --version
  npm --version
  npm list -g @swarmvaultai/cli --depth=0 2>&1
  swarmvault --version 2>&1 || true
  echo '```'
} > "$TARGET/logs/installation-record.txt"

echo
echo "Bootstrap complete. Installation record written to:"
echo "  $TARGET/logs/installation-record.txt"
echo
echo "Next: copy exactly 20 books into $TARGET/pilot-input/, then run"
echo "  python scripts/02_classify_pdfs.py"
