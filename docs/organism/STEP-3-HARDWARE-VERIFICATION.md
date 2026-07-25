# Step 3 — Hardware Verification Gate (MANDATORY before visual acceptance)

Step 3 is **implemented, not visually accepted.** The build environment has no
GPU, so every visual and performance claim about the WebGL orb is unverified.
This document is the gate that must pass on real hardware before Step 3 is
accepted and before any further implementation is stacked on top of the orb
integration.

**This is verification, not permission to redesign the organism.** If something
looks wrong, corrections target — in this order — rendering parameters, scaling,
layout integration, device-pixel-ratio handling, postprocessing (bloom)
intensity, and performance. **Changes to the organism itself require Founder
approval.**

Do not begin new implementation on top of the orb until this gate is green.

## Device & build

- **Device:** the Founder's MacBook Air.
- **Build:** a **production** build (`npm run build && npm start`), not `npm run dev`.
- **Browsers:** Safari **and** Chrome.
- **Surfaces:** the authenticated dashboard **and** `/lab/organism`.

## Matrix

Run every cell. Six approved states × two motion settings × two viewports, in
each browser, on each surface.

- **States:** resting, listening, focus-surfaced, decision-required,
  action-underway, proof-created.
- **Motion:** normal, and `prefers-reduced-motion: reduce`
  (System Settings → Accessibility → Display → Reduce motion).
- **Viewports:** the actual laptop viewport, and one narrower viewport
  (resize the window to a narrow column to hit the `max-width: 960px` layout).

## Pass criteria (all must hold)

- No WebGL **context loss** (no "Rats! WebGL hit a snag" / black canvas).
- No **console errors** or React warnings in either browser.
- No **clipping** of the orb against the ivory stage or the command bar.
- No **text degradation** (blurry/jittery labels, overlapping copy).
- No **layout shift** when the orb mounts or when the state changes.
- No **uncontrolled bloom** — the glow must not wash out the ivory interface or
  bleed past the orb stage.
- The orb stays **visually dominant** without **overwhelming** the ivory
  interface (the Founder's design intent: present, not blinding).
- **Stable interaction and animation** — no obvious frame drops, and no
  excessive heat / fan spin-up / battery drain during a full state sequence.

## Captures to attach to the gate result

- **One screenshot per state** (six), on the dashboard, at the laptop viewport.
  Repeat for `/lab/organism` if the two surfaces differ visually.
- **A short screen recording** of the full transition sequence
  resting → listening → focus-surfaced → decision-required → action-underway →
  proof-created (and reduced-motion once, to confirm motion is honored).
- **A browser performance trace** captured during the complete state sequence
  (Chrome DevTools → Performance → record the sequence; export the profile).
  Note sustained frame rate and any long tasks / dropped frames.

## Result log

Fill this in on the device. The gate is green only when every row passes in
both browsers, both surfaces, both motion settings, and both viewports.

| Browser | Surface | State | Motion | Viewport | Pass? | Notes (only if fail) |
|---|---|---|---|---|---|---|
| Safari | dashboard | resting | normal | laptop | | |
| Safari | dashboard | listening | normal | laptop | | |
| Safari | dashboard | focus-surfaced | normal | laptop | | |
| Safari | dashboard | decision-required | normal | laptop | | |
| Safari | dashboard | action-underway | normal | laptop | | |
| Safari | dashboard | proof-created | normal | laptop | | |
| Safari | dashboard | (all six) | reduced | laptop | | |
| Safari | dashboard | (all six) | normal | narrow | | |
| Safari | /lab/organism | (all six) | normal | laptop | | |
| Chrome | dashboard | (all six) | normal | laptop | | |
| Chrome | dashboard | (all six) | reduced | laptop | | |
| Chrome | dashboard | (all six) | normal | narrow | | |
| Chrome | /lab/organism | (all six) | normal | laptop | | |

**Performance trace summary:** sustained FPS ______ · worst dropped-frame
window ______ · thermal/fan/battery observation ______.

## If a cell fails

1. Record the exact symptom in the Notes column with a screenshot.
2. Propose a fix scoped to **rendering parameters / scaling / DPR /
   postprocessing intensity / performance** only.
3. If the only viable fix would change the **organism's design**, stop and get
   **Founder approval** first — that is out of scope for this gate.
