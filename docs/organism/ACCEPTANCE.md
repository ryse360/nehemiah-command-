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
| Filaments radiate/sweep — never all from the exact center | ENFORCED | `organism-field.test.ts` origin-spread assertions |
| Micro-weave: 120–220 fine strands, constellation-anchored, membrane falloff | ENFORCED | `organism-field.test.ts` micro-weave suite |
| Majors immutable when micro layer changes | ENFORCED | `organism-field.test.ts` deep-equal isolation test |
| Depth groups all present; brightness genuinely varies | ENFORCED | `organism-field.test.ts` |
| Approved adaptive sizing (58vh target, 760px ceiling, no scroll) | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §6; viewport sweep during review passes |

## C. Life & motion

| Detail | Status | Enforcement |
|---|---|---|
| Six lifecycle labels: BREATHING → ATTENDING → SURFACING → WEIGHING → ENACTING → WITNESSED | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §7; `organism-lab-contract.test.ts` |
| Never rotates as one object | ENFORCED | `check-founder-compliance` §11 |
| Held-breath transitions; leaving a decision holds longest | ENFORCED | `organism-transition.test.ts` |
| Action-underway cannot be skipped instantly (min dwell) | ENFORCED | `organism-transition.test.ts` |
| Gentle float; reduced-motion quiets, never kills | ENFORCED | `organism-motion.test.ts`; `check-founder-compliance` §9 |
| Five-minute idle → dark DORMANT sleep; any activity wakes | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §12; `organism-sleep.test.ts` |
| Arcs cycle 16–32s, mixed directions; some orbit beyond the shell, most hug it | ENFORCED | `organism-field.test.ts` |
| Flares never pulse in unison | ENFORCED | `organism-field.test.ts` phase-diversity assertion |
| Breathing pace/mood feels alive, not mechanical | VISUAL-REVIEW | Founder review of preview |

## D. Engineering discipline

| Detail | Status | Enforcement |
|---|---|---|
| Dependency freeze (no postprocessing/Theatre/animation libs) | FOUNDER-LOCKED + ENFORCED | `check-founder-compliance` §1 |
| Leva confined to the lab shell; engine layers clean | ENFORCED | `check-founder-compliance` §3; `organism-architecture.test.ts` |
| Every governed module carries tests | ENFORCED | `check-founder-compliance` §10 |
| Tests, typecheck, build green before any push | ENFORCED | CI (`.github/workflows/ci.yml`) on every push and PR |
| Production JS budget 750KB — lab engine may never bloat Founder-facing routes | ENFORCED | `check-performance-budget.ts` (WebGL-marked chunks budgeted separately; compliance §4 guarantees they are lab-only) |
| Lab WebGL engine bounded at 1.5MB | ENFORCED | `check-performance-budget.ts` labEngine allowance |
| Evidence before completion claims | FOUNDER-LOCKED | Superpowers `verification-before-completion`; CI as backstop |

## Process

1. Every push to `feature/**` runs the full CI gate including the Founder
   compliance check. Red gate = the change does not ship.
2. The Vercel preview rebuilds on every push; Founder visual review happens
   there. VISUAL-REVIEW rows are closed only by Founder approval.
3. New Founder decisions get a row here AND a check in
   `scripts/check-founder-compliance.ts` in the same commit. A decision
   without an enforcement row is not yet locked.
