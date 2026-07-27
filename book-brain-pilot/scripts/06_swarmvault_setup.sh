#!/usr/bin/env bash
# Initializes SwarmVault against this pilot's vault/ directory, ingests
# extracted/ Markdown, compiles the wiki + knowledge graph, and registers
# the MCP server for Claude Code. Uses SwarmVault's offline heuristic
# provider by default — no API key required and none is written to disk.
set -euo pipefail

TARGET="${NEHEMIAH_BOOK_BRAIN_HOME:-$HOME/Developer/nehemiah-book-brain}"
cd "$TARGET"

if ! command -v swarmvault >/dev/null 2>&1; then
  echo "ERROR: swarmvault CLI not found. Run 01_bootstrap_pilot.sh first." >&2
  exit 1
fi

# SWARMVAULT_OUT relocates raw/, wiki/, state/, agent/, inbox/ under our
# existing vault/ directory instead of SwarmVault's default project-root
# layout, so it matches the target structure this pilot already created.
export SWARMVAULT_OUT="$TARGET/vault"

if [ ! -f "swarmvault.config.json" ]; then
  echo "Initializing SwarmVault (offline heuristic provider, no API key) ..."
  swarmvault init --profile default
  cp "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/templates/swarmvault.config.template.json" \
     "swarmvault.config.json"
fi

echo "Ingesting extracted/ ..."
swarmvault ingest "$TARGET/extracted"

echo "Compiling wiki + knowledge graph ..."
swarmvault compile

echo "Registering the MCP server for Claude Code (writes .mcp.json in $TARGET) ..."
swarmvault install --agent claude --mcp

echo
echo "Done. To test retrieval from the CLI:"
echo "  cd $TARGET && SWARMVAULT_OUT=\"$TARGET/vault\" swarmvault query \"<your question>\""
echo
echo "To test the MCP server with an agent, start Claude Code inside $TARGET"
echo "so it picks up the generated .mcp.json, and ask it a question that"
echo "should cite this vault."
