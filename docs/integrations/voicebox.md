# Voicebox — Founder-machine-local voice integration

Voice output (Phase 0) uses [Voicebox](https://voicebox.sh), the free,
local-first TTS studio running on the **Founder's own Mac**. This is **not** a
trusted-bridge integration like Gmail/Calendar/Drive: Voicebox is local-only and
never sends to Nehemiah. The Founder's **browser** calls the Founder's **local**
Voicebox directly, because Nehemiah's deployed (Vercel) server cannot reach
`127.0.0.1` on the Founder's machine.

See the design spec:
`docs/superpowers/specs/2026-07-27-voicebox-voice-output-design.md`.

## Confirmed: CORS must be explicitly opened per origin

Voicebox's CORS allowlist is **hardcoded** to its own defaults
(`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:17493`,
`http://127.0.0.1:17493`, `tauri://localhost`). Any other origin — including
Nehemiah's deployed URL — is silently rejected by the browser unless added via:

```bash
VOICEBOX_CORS_ORIGINS=https://<your-nehemiah-origin> python3 -m backend.main --host 127.0.0.1 --port 17493
```

Comma-separate multiple origins. **This is a required setup step, not
optional** — confirmed by the 2026-07-27 compatibility probe (see the design
spec). If you run the packaged desktop app rather than the standalone backend,
its CORS origins are fixed unless the app exposes its own setting for this.

## Step 0 — Run the compatibility probe first (go/no-go gate)

Because a deployed HTTPS origin reaching `http://127.0.0.1` is governed by
browser CORS and Private Network Access rules, **prove the boundary before the
transport is built.** A turnkey probe ships at `public/voicebox-probe.html`.

1. Start Voicebox on the Mac (it listens on `http://127.0.0.1:17493` by default;
   confirm at `http://localhost:17493/docs`).
2. Open the deployed Nehemiah origin in the browser you want to test, then visit
   **`/voicebox-probe.html`** at that origin (e.g.
   `https://<your-nehemiah-host>/voicebox-probe.html`). Running it from the real
   deployed origin is the whole point — it reproduces the exact security context.
3. Click **Run probe**. Record the verdict (GO / PARTIAL / NO-GO) and click
   **Copy results** to save the per-browser row and the captured API contract.
4. Repeat in **Firefox, Chrome, Safari, Edge**. You only need **one** browser to
   reach GO. Firefox is often the most permissive to loopback.

Paste the captured contract into the transport implementation as fixtures/types.
If every browser is NO-GO, use a documented fallback (run Nehemiah from
`localhost` in the Founder's session, or a small local shim) — decided from the
matrix, not guessed.

## Voice profiles (confirmed live, 2026-07-27)

Voicebox profiles come in two kinds, and the distinction decides which model
gets downloaded:

- **`preset`** — uses a built-in voice from a preset engine. Requires
  `voice_type: "preset"`, `preset_engine`, and `preset_voice_id`. Runs on
  **Kokoro** (~82M parameters, a few hundred MB).
- **`cloned`** — clones a voice from an audio sample. Requires the
  **Qwen3-TTS** model (1.7B parameters, multi-gigabyte download).

**Gotcha:** `POST /profiles` silently ignores an unrecognised `engine` field and
defaults to `voice_type: "cloned"`. A cloned profile with zero samples fails
generation with `No module named 'qwen_tts'`. Always set the three preset fields
explicitly:

```bash
curl -X POST http://127.0.0.1:17493/profiles \
  -H 'Content-Type: application/json' \
  -d '{"name":"Nehemiah","voice_type":"preset","preset_engine":"kokoro","preset_voice_id":"bm_george","language":"en"}'
```

Kokoro preset voice ids are prefixed by accent and gender: `af_`/`am_` American
female/male, `bf_`/`bm_` British female/male, plus `ef_`/`em_` Spanish, `ff_`
French, `if_`/`im_` Italian, `jf_`/`jm_` Japanese, `pf_`/`pm_` Portuguese,
`zf_`/`zm_` Chinese. List them with
`GET /profiles/presets/kokoro`.

**Locale implication:** Kokoro voices are language-specific, so the spec's
`es-US` locale needs its **own Spanish profile** (e.g. `em_alex`) — setting the
language field on an English profile is not sufficient. Phase 0 pins one
English profile; add a second pinned profile before enabling Spanish output.

## Use Python 3.12 — not 3.13/3.14 (the single most important setup fact)

The Voicebox backend must run on **Python 3.12** in a dedicated virtualenv.
Confirmed the hard way on 2026-07-27: on Python 3.14 the TTS engines cannot be
installed at all. `kokoro` depends on `misaki` → `spacy` → `thinc` → `blis`,
and `blis` has no 3.14 wheel and fails to compile from source with
`Cython.Compiler.Errors.CompileError: blis/py.pyx`. Most of the other pitfalls
below are downstream of the same root cause.

Clean setup:

```bash
brew install python@3.12          # or install 3.12 from python.org
cd ~/voicebox
python3.12 -m venv .venv
source .venv/bin/activate
python --version                  # must print 3.12.x
pip install --upgrade pip
pip install -r requirements.txt
pip install fastmcp pedalboard kokoro   # engine + missing backend deps
HF_HUB_DISABLE_XET=1 VOICEBOX_CORS_ORIGINS=http://localhost:3000 \
  python -m backend.main --host 127.0.0.1 --port 17493
```

Re-activate the venv (`source .venv/bin/activate`) in any new terminal before
starting the server.

## Known dependency pitfalls (macOS, confirmed live)

- The backend's `requirements.txt` is incomplete: `fastmcp` and `pedalboard`
  must be installed separately before the server starts.
- **Neither TTS engine's runtime ships with the backend.** Install the one the
  profile uses, or generation fails with `No module named ...`:
  - preset/Kokoro profiles → `pip install kokoro` (may also need
    `brew install espeak-ng` for phonemisation of out-of-dictionary words)
  - cloned profiles → `pip install qwen-tts`
- Installing `qwen-tts` pins `transformers==4.57.3`, which **downgrades**
  `huggingface_hub` below 1.0 and breaks `hf-xet`, producing
  `cannot import name 'XetAuthorizationError'` during model download. Start the
  server with `HF_HUB_DISABLE_XET=1` (Xet is only a transfer optimisation; the
  downloaded files are identical), or uninstall `hf-xet`.

## Configuration (added when the transport is built)

Two distinct layers — a deployment capability flag and the Founder's runtime
preference:

```
# Deployment capability (default off)
NEXT_PUBLIC_VOICEBOX_ENABLED=false
# Approved loopback origin only: 127.0.0.1 / localhost / [::1]
NEXT_PUBLIC_VOICEBOX_URL=http://127.0.0.1:17493
# Pin the Founder-approved voice; required when voice is enabled in production
NEXT_PUBLIC_VOICEBOX_PROFILE_ID=
NEXT_PUBLIC_VOICEBOX_PROFILE_VERSION=
```

The Founder's per-session controls (auto-speak on/off, stop, replay, volume,
quiet mode) are runtime UI state, not environment configuration.

## Guarantees

- Voice is optional and non-blocking. Flag off or Voicebox absent → the app
  behaves exactly as today (fail-safe, silent).
- Only an approved loopback origin is accepted; a non-loopback URL is refused in
  a production build (fail-closed).
- No Nehemiah API route, server secret, or server code is involved.
