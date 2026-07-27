#!/usr/bin/env bash
# Fully reversible teardown of the pilot only. Never touches original books
# or an existing Obsidian vault.
set -euo pipefail

TARGET="${NEHEMIAH_BOOK_BRAIN_HOME:-$HOME/Developer/nehemiah-book-brain}"

if [ ! -e "$TARGET" ]; then
  echo "$TARGET does not exist — nothing to uninstall."
  exit 0
fi

echo "This will permanently delete:"
echo "  $TARGET"
echo "(venv, extracted Markdown, vault, logs, evaluation reports — everything"
echo "the pilot created. Original source books elsewhere are never touched.)"
read -r -p "Type the full path above to confirm deletion: " confirm
if [ "$confirm" != "$TARGET" ]; then
  echo "Confirmation did not match. Aborting — nothing deleted."
  exit 1
fi

rm -rf "$TARGET"
echo "Removed $TARGET."

read -r -p "Also uninstall the global SwarmVault CLI (@swarmvaultai/cli)? [y/N] " remove_cli
if [[ "$remove_cli" =~ ^[Yy]$ ]]; then
  npm uninstall -g @swarmvaultai/cli
  echo "Uninstalled @swarmvaultai/cli."
else
  echo "Left @swarmvaultai/cli installed (it's a general-purpose tool)."
fi

echo "Uninstall complete."
