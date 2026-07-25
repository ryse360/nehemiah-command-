# Living Interface — Acceptance & Compliance Registry

Every detail that matters, mapped to its enforcement. Nothing on this list
relies on memory or good intentions: each row is either enforced by an
automated check that runs on every push, or explicitly assigned to Founder
visual review on the preview deployment.

Status vocabulary (per MASTER_AI_HANDOFF §17):
**FOUNDER-LOCKED** — decided, may not be silently reopened.
**ENFORCED** — an automated check goes red if violated.
**VISUAL-REVIEW** — verified by Founder eyes on the preview URL, not by code.

Run the whole gate locally: `npm run gate`
(tests → typecheck → compliance → production build; CI runs the same on every push.)

## A. Product identity

| Detail | Status | Enforcement |
|---|---|---|
| Nehemiah is a living intelligence artifact, not a dashboard | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §5 (prohibited dashboard language); `organism-architecture.test.ts` |
| Production Founder interface untouched by lab work | ENFORCED | `check-founder-compliance` §4; `organism-architecture.test.ts` |
| Command surface visually alive but never functional in the lab | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §8; `organism-lab-contract.test.ts` |
| No words/logo inside the central artifact | FOUNDER-LOCKED + VISUAL-REVIEW | Founder review of preview |

## B. Visual system

| Detail | Status | Enforcement |
|---|---|---|
| Reference-derived neo palette, verbatim | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §2; `organism-palette.test.ts` |
| Gold never neon yellow; lavender never electric | ENFORCED | `organism-palette.test.ts` warmth heuristics |
| No hard circular borders (volumetric fades only) | VISUAL-REVIEW | Founder review; inverse-fresnel construction in engine |
| Lavender leans right, interwoven — never a clean half split | ENFORCED | `organism-field.test.ts` hemisphere/interweave assertions |
| Lavender must stay legible (WEIGHING convergence depends on it) | VISUAL-REVIEW | Founder review; lavender carries a luminance boost and never blows out to white |
| Radial strands begin at the core — but never ALL of them | ENFORCED | `organism-field.test.ts` radial/origin-spread assertions (guards against "sun with rays") |
| Field specs are exercised against the field that actually ships | ENFORCED | `ORGANISM_FIELD_OPTIONS` single source of truth + identity assertion |
| Tuning one layer never re-rolls another | ENFORCED | `organism-field.test.ts` per-layer RNG isolation test |
| Node-to-node connections stay in the 150–280 spec band | ENFORCED | `organism-field.test.ts` |
| Filaments radiate/sweep — never all from the exact center | ENFORCED | `organism-field.test.ts` origin-spread assertions |
| Micro-weave: 120–220 fine strands, constellation-anchored, membrane falloff | ENFORCED | `organism-field.test.ts` micro-weave suite |
| Majors immutable when micro layer changes | ENFORCED | `organism-field.test.ts` deep-equal isolation test |
| Depth groups all present; brightness genuinely varies | ENFORCED | `organism-field.test.ts` |
| Star field: 760 points, never over the body (in projection), three brightness classes, far field recedes | ENFORCED | `organism-field.test.ts` star-field suite |
| Star density never re-rolls the organism | ENFORCED | `organism-field.test.ts` deep-equal isolation test |
| Violet reasoning region is a graded VOLUME (three shells), peaking at the decision and receding by proof | VISUAL-REVIEW | Founder review; measured warm/cool separation across the six states |
| Volumetric ribbons read as light-folds, never as ribbon sculpture | VISUAL-REVIEW | Founder review; parallel-transported frame + three-vertex spine (no bowties, no lit edge) |
| Approved adaptive sizing (58vh target, 760px ceiling, no scroll) | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §6; viewport sweep during review passes |

## C. Life & motion

| Detail | Status | Enforcement |
|---|---|---|
| Six lifecycle labels: BREATHING → ATTENDING → SURFACING → WEIGHING → ENACTING → WITNESSED | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §7; `organism-lab-contract.test.ts` |
| Never rotates as one object | ENFORCED | `check-founder-compliance` §11 |
| Held-breath transitions; leaving a decision holds longest | ENFORCED | `organism-transition.test.ts` |
| Transitions never snap — no per-frame scale jump at the hold→settle seam | ENFORCED | `organism-transition.test.ts` walks the transition at 1/120s |
| Overshoot is real motion, not a decorative field | ENFORCED | `organism-transition.test.ts` asserts the settle carries past the target |
| Core shape and pulse change across the lifecycle | ENFORCED | `organism-parameters.test.ts` (guards the frozen-core regression) |
| The charge ring only completes when releasing will actually advance | VISUAL-REVIEW | Dwell-aware charge; verified in-browser across tap/hold/Enter |
| Action-underway cannot be skipped instantly (min dwell) | ENFORCED | `organism-transition.test.ts` |
| Gentle float; reduced-motion quiets, never kills | ENFORCED | `organism-motion.test.ts`; `check-founder-compliance` §9 |
| Five-minute idle → dark DORMANT sleep; any activity wakes | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §12; `organism-sleep.test.ts` |
| Arcs cycle 16–32s, mixed directions; some orbit beyond the shell, most hug it | ENFORCED | `organism-field.test.ts` |
| Flares never pulse in unison | ENFORCED | `organism-field.test.ts` phase-diversity assertion |
| Breathing pace/mood feels alive, not mechanical | VISUAL-REVIEW | Founder review of preview |

## D. Engineering discipline

| Detail | Status | Enforcement |
|---|---|---|
| Dependency freeze — **reopened by Founder decision 2026-07-25** to adopt a full platform stack | FOUNDER-DECISION + ENFORCED | `check-founder-compliance` §1. Sanctioned with trade-offs stated before install. Round A: `3d-force-graph` + `r3f-forcegraph` (force-graph), `@react-three/postprocessing` + `postprocessing` (bloom, was banned by name), `react-glass-ui` (glass cards, dashboard surface). Round B: `ai` (Vercel AI SDK), `motion` (framer-motion successor, was banned by name), `@theatre/core` + `@theatre/studio` (Theatre.js, was in the original locked prohibition), `promptfoo` (dev, evals). Denylist still catches unsanctioned animation/particle libs. |
| shadcn/ui primitive layer added additively (Tailwind v4, no Preflight) | DONE + ENFORCED | Nine approved primitives under `src/components/ui`, tokens mapped to the MiP palette. `globals.css` byte-unchanged; orb pixel-identical; budgets green. Restyle-before-product-use is a VISUAL-REVIEW gate per primitive. |
| AI cost-control boundary precedes any real spend | FOUNDER-DECISION + ENFORCED | `src/nehemiah/cost/*` — model routing by complexity, integer nano-dollar ledger with per-agent/daily attribution, hard-fail spend ceilings. Server-only, synthetic, `cost.test.ts` proves all three ceilings throw. No API key or real data wired. |
| Memory admission gates writes + embeds (don't memorialize everything) | FOUNDER-DECISION + ENFORCED | `src/nehemiah/memory/*` — salience threshold (kind + substance) drops chatter/thin text; dedup-before-embed (normalized exact + shingled-Jaccard near-dup) skips paying to embed duplicates. Server-only, synthetic; `memory.test.ts` proves noise and duplicates never reach the embedding model. |
| Unified AI boundary: caching + telemetry, provider call is an injected seam | FOUNDER-DECISION + ENFORCED | `src/nehemiah/ai/*` — `AIBoundary` composes routing + hard ceilings + response cache + usage telemetry + memory admission behind one entry point; the model call is an injected executor (synthetic now, real AI SDK later) with every control in front of it. `ai.test.ts` proves cache hits are free, ceilings refuse before the provider runs, and a synthetic "day" reports controlled-vs-naive savings (~80% on the sample workload). |
| Remaining platform nodes (non-npm path or a decision) | OPEN | Graphiti is Python (separate backend service, not an npm dep). Context7 + Playwright MCP are MCP servers (config-level, not project deps). Wiring AI SDK + memory to real Founder data stays a security-gated step (keys/PII/production surface per MASTER_AI_HANDOFF) — the cost boundary above is the prerequisite. |
| Leva confined to the lab shell; engine layers clean | ENFORCED | `check-founder-compliance` §3; `organism-architecture.test.ts` |
| Every governed module carries tests | ENFORCED | `check-founder-compliance` §10 |
| Tests, typecheck, build green before any push | ENFORCED | CI (`.github/workflows/ci.yml`) on every push and PR |
| Production JS budget 750KB — lab engine may never bloat Founder-facing routes | ENFORCED | `check-performance-budget.ts` (WebGL-marked chunks budgeted separately; compliance §4 guarantees they are lab-only) |
| Lab WebGL engine bounded at 1.5MB | ENFORCED | `check-performance-budget.ts` labEngine allowance |
| Seven security headers survive any `next.config.ts` edit | ENFORCED | `check-founder-compliance` §13; CI `quality:headers` against a running server |
| Evidence before completion claims | FOUNDER-LOCKED | Superpowers `verification-before-completion`; CI as backstop |

## E. Known gaps (honest register)

Recorded rather than hidden, so nobody mistakes silence for completion.

| Gap | Status | Note |
|---|---|---|
| Real-hardware frame rate | UNVERIFIED | This build environment has no GPU. All FPS figures describe a CPU software rasterizer and overweight vertex cost. Needs measuring on real hardware. |
| Violet volume / ribbon strength balance | VISUAL-REVIEW | Landed and measured, but the final call on how cool the reasoning region should read at `decision-required` is the Founder's, not a number a test can settle. |
| Tier 3 audit findings | PLANNED | ~38 medium / 10 low severity items from the six-lens audit remain unimplemented. |

## Process

1. Every push to `feature/**` runs the full CI gate including the Founder
   compliance check. Red gate = the change does not ship.
2. The Vercel preview rebuilds on every push; Founder visual review happens
   there. VISUAL-REVIEW rows are closed only by Founder approval.
3. New Founder decisions get a row here AND a check in
   `scripts/check-founder-compliance.ts` in the same commit. A decision
   without an enforcement row is not yet locked.
