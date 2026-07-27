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
