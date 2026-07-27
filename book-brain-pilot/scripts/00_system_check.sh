#!/usr/bin/env bash
# Read-only environment report for the Nehemiah Book Brain pilot.
# Makes no changes. Run this on the actual MacBook Air, not in a cloud session.
set -uo pipefail

OUT="${1:-/dev/stdout}"

section() { printf '\n## %s\n' "$1"; }

{
  echo "# Nehemiah Book Brain — System Check"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  section "Architecture"
  uname -m 2>/dev/null || echo "uname not available"
  if command -v sysctl >/dev/null 2>&1; then
    sysctl -n machdep.cpu.brand_string 2>/dev/null
  fi

  section "macOS version"
  if command -v sw_vers >/dev/null 2>&1; then
    sw_vers
  else
    echo "sw_vers not found — not running on macOS?"
  fi

  section "RAM"
  if command -v sysctl >/dev/null 2>&1; then
    bytes=$(sysctl -n hw.memsize 2>/dev/null)
    if [ -n "${bytes:-}" ]; then
      awk -v b="$bytes" 'BEGIN { printf "%.1f GB total\n", b/1024/1024/1024 }'
    fi
  fi

  section "Disk space (home volume)"
  df -h "$HOME" 2>/dev/null

  section "Python interpreters"
  for py in python3 python3.10 python3.11 python3.12 python3.13; do
    if command -v "$py" >/dev/null 2>&1; then
      printf '%s: %s (%s)\n' "$py" "$("$py" --version 2>&1)" "$(command -v "$py")"
    fi
  done
  if command -v pyenv >/dev/null 2>&1; then
    echo "pyenv versions:"
    pyenv versions 2>/dev/null
  fi

  section "Node / npm"
  if command -v node >/dev/null 2>&1; then
    echo "node: $(node --version)"
  else
    echo "node: not found"
  fi
  if command -v npm >/dev/null 2>&1; then
    echo "npm: $(npm --version)"
  else
    echo "npm: not found"
  fi
  if command -v nvm >/dev/null 2>&1 || [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "nvm appears to be installed (can be used to add Node 24 alongside your current version)"
  fi

  section "Docker status"
  if command -v docker >/dev/null 2>&1; then
    echo "docker CLI found: $(docker --version 2>&1)"
    docker info >/dev/null 2>&1 && echo "docker daemon: running" || echo "docker daemon: not running / not accessible"
  else
    echo "docker: not found (not required by this pilot)"
  fi

  section "Obsidian vaults discovered (read-only search, nothing opened)"
  found_any=0
  for base in "$HOME/Documents" "$HOME/Obsidian" "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents" "$HOME"; do
    if [ -d "$base" ]; then
      while IFS= read -r -d '' vault; do
        found_any=1
        echo "  - $(dirname "$vault")"
      done < <(find "$base" -maxdepth 4 -type d -name ".obsidian" -print0 2>/dev/null)
    fi
  done
  if [ "$found_any" -eq 0 ]; then
    echo "  (none found in common locations — search manually if you know a vault lives elsewhere)"
  fi

  section "Target pilot directory"
  target="$HOME/Developer/nehemiah-book-brain"
  if [ -e "$target" ]; then
    echo "$target already exists:"
    ls -la "$target"
  else
    echo "$target does not exist yet (expected before bootstrap)."
  fi

  echo
  echo "Review this output, then work through docs/installation-plan.md's approval checklist."
} | tee "$OUT"
