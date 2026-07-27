#!/usr/bin/env bash
#
# Voicebox one-shot setup + contract probe.
#
# Takes a Mac from nothing to a verified, running Voicebox with the Nehemiah
# voice profile and a captured API contract. Idempotent — safe to re-run.
#
#   bash scripts/voicebox-setup.sh
#
# Options (env vars):
#   VOICEBOX_DIR   where the voicebox repo lives      (default ~/voicebox)
#   PORT           port to serve on                   (default 17493)
#   VOICE          Kokoro preset voice id             (default bm_george)
#   PROFILE_NAME   profile name                       (default Nehemiah)
#   CORS_ORIGIN    origin allowed to call Voicebox    (default http://localhost:3000)
#
# WHY THIS EXISTS: the backend's requirements.txt is incomplete, its TTS engine
# runtimes ship separately, and the whole stack fails to build on Python 3.13+.
# Discovering that one error at a time costs hours. This encodes every finding.

set -uo pipefail

VOICEBOX_DIR="${VOICEBOX_DIR:-$HOME/voicebox}"
PORT="${PORT:-17493}"
VOICE="${VOICE:-bm_george}"
PROFILE_NAME="${PROFILE_NAME:-Nehemiah}"
CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$SCRIPT_DIR/voicebox-contract-probe.py"
LOG="$VOICEBOX_DIR/voicebox-server.log"
VENV="$VOICEBOX_DIR/.venv"
BASE="http://127.0.0.1:$PORT"

step()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()    { printf '    \033[32m✓\033[0m %s\n' "$1"; }
warn()  { printf '    \033[33m!\033[0m %s\n' "$1"; }
die()   { printf '\n    \033[31m✗ %s\033[0m\n\n' "$1"; exit 1; }

# ---------------------------------------------------------------- 1. repo
step "1/7  Checking the Voicebox source"
if [ ! -f "$VOICEBOX_DIR/backend/main.py" ]; then
  if [ -d "$VOICEBOX_DIR" ]; then
    die "$VOICEBOX_DIR exists but has no backend/main.py. Remove it or set VOICEBOX_DIR."
  fi
  warn "Not found — cloning into $VOICEBOX_DIR"
  git clone --depth 1 https://github.com/jamiepine/voicebox.git "$VOICEBOX_DIR" \
    || die "clone failed"
fi
ok "backend found at $VOICEBOX_DIR"

# ------------------------------------------------------------- 2. free port
step "2/7  Freeing port $PORT"
HOLDER="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -n "$HOLDER" ]; then
  warn "port held by PID(s): $HOLDER — $(ps -p "$(echo "$HOLDER" | head -1)" -o comm= 2>/dev/null || echo unknown)"
  kill $HOLDER 2>/dev/null || true
  sleep 2
  HOLDER="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$HOLDER" ]; then
    warn "still held — forcing"
    kill -9 $HOLDER 2>/dev/null || true
    sleep 2
  fi
fi
if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  die "Port $PORT is still in use. If the Voicebox DESKTOP APP is running, quit it (Cmd+Q), or re-run with PORT=17494."
fi
ok "port $PORT is free"

# ---------------------------------------------------------- 3. python 3.12
step "3/7  Locating Python 3.12"
PY312=""
for candidate in python3.12 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12; do
  if command -v "$candidate" >/dev/null 2>&1; then PY312="$candidate"; break; fi
done
if [ -z "$PY312" ]; then
  if command -v brew >/dev/null 2>&1; then
    warn "not found — installing via Homebrew (this may take a few minutes)"
    brew install python@3.12 || die "brew install python@3.12 failed"
    for candidate in python3.12 /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12; do
      if command -v "$candidate" >/dev/null 2>&1; then PY312="$candidate"; break; fi
    done
  fi
fi
[ -n "$PY312" ] || die "Python 3.12 not found and Homebrew unavailable. Install 3.12 from python.org, then re-run.
  NOTE: 3.13/3.14 do NOT work — blis (via kokoro->misaki->spacy->thinc) has no wheel and fails to build."
ok "using $($PY312 --version) at $(command -v "$PY312")"

# ----------------------------------------------------------------- 4. venv
step "4/7  Preparing the virtualenv"
if [ ! -x "$VENV/bin/python" ]; then
  "$PY312" -m venv "$VENV" || die "venv creation failed"
  ok "created $VENV"
else
  ok "reusing $VENV"
fi
VENV_PY="$VENV/bin/python"
VENV_VERSION="$("$VENV_PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
[ "$VENV_VERSION" = "3.12" ] || die "venv is Python $VENV_VERSION, need 3.12. Delete $VENV and re-run."
ok "venv runs Python $VENV_VERSION"

# ------------------------------------------------------------- 5. install
step "5/7  Installing dependencies (slow on first run)"
"$VENV_PY" -m pip install --upgrade pip --quiet || warn "pip self-upgrade failed (continuing)"
"$VENV_PY" -m pip install -r "$VOICEBOX_DIR/requirements.txt" --quiet \
  || die "requirements.txt install failed — scroll up for the reason"
ok "requirements.txt installed"
# NOT in requirements.txt but imported at startup / generation time:
#   fastmcp, pedalboard -> server won't boot without them
#   kokoro              -> preset (small-model) voices
"$VENV_PY" -m pip install fastmcp pedalboard kokoro --quiet \
  || die "engine/runtime install failed — scroll up for the reason"
ok "fastmcp, pedalboard, kokoro installed"
"$VENV_PY" -c "import fastmcp, pedalboard, kokoro" 2>/dev/null \
  && ok "imports verified" \
  || die "installed but not importable — the venv may be mixed; delete $VENV and re-run"

# --------------------------------------------------------------- 6. serve
step "6/7  Starting the server on port $PORT"
: > "$LOG"
(
  cd "$VOICEBOX_DIR" || exit 1
  HF_HUB_DISABLE_XET=1 VOICEBOX_CORS_ORIGINS="$CORS_ORIGIN" \
    nohup "$VENV_PY" -m backend.main --host 127.0.0.1 --port "$PORT" >>"$LOG" 2>&1 &
  echo $! > "$VOICEBOX_DIR/.voicebox.pid"
)
SERVER_PID="$(cat "$VOICEBOX_DIR/.voicebox.pid" 2>/dev/null || echo '')"
ok "launched (pid ${SERVER_PID:-?}), logging to $LOG"

printf '    waiting for readiness'
READY=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "$BASE/profiles" >/dev/null 2>&1; then READY=1; break; fi
  if grep -q "address already in use" "$LOG" 2>/dev/null; then
    die "Port $PORT was taken between the check and the start. Re-run, or use PORT=17494."
  fi
  printf '.'; sleep 1
done
printf '\n'
[ "$READY" = "1" ] || die "Server did not become ready. Last 30 log lines:
$(tail -30 "$LOG")"
ok "server is answering on $BASE"

# ---------------------------------------------------------------- 7. probe
step "7/7  Capturing the API contract"
[ -f "$PROBE" ] || die "probe not found at $PROBE"
"$VENV_PY" "$PROBE" --base-url "$BASE" --voice "$VOICE" --profile-name "$PROFILE_NAME"
PROBE_STATUS=$?

step "Summary"
if [ "$PROBE_STATUS" = "0" ]; then
  ok "Contract captured. Server still running (pid ${SERVER_PID:-?}) on $BASE"
else
  warn "Probe reported a problem — see its output above and $LOG"
fi
cat <<EOF

  Server log     : $LOG
  Stop server    : kill \$(cat "$VOICEBOX_DIR/.voicebox.pid")
  Contract file  : $(pwd)/voicebox-contract.json
  CORS origin    : $CORS_ORIGIN  (re-run with CORS_ORIGIN=... to change)

EOF
exit "$PROBE_STATUS"
