---
name: nehemiah-organism
description: Project context for the Nehemiah Living Intelligence organism (the Founder's orb). Use for ANY pass that touches the organism's visual system — organism-engine.tsx, organism-ecology, filament flow, membrane, atmosphere, states, or lab captures. Gives the identity, visual authority, hierarchy, rejected reads, state meanings, gated-pass protocol, and evidence standard so small corrections can run without re-pasting the design brief.
license: Proprietary — MiP Coaching / Nehemiah internal
---

# Nehemiah Organism

## 1. Purpose and identity

Nehemiah is the Founder's private living assistant operating system. The
organism is its felt presence: one calm, premium, aware intelligence. It is
never a generic sphere, particle animation, wireframe, sculpture, biological
creature, or decorative AI icon. If a render could be mistaken for any of
those, the pass has failed regardless of what the code says.

## 2. Visual authority

The approved living-artifact reference (warm ivory field, luminous gold
ecology, lavender reasoning region — see `docs/organism/` captures and the
Founder-supplied reference image) is the authority for: emotional presence,
warm ivory atmosphere, volumetric depth, gold/lavender hierarchy, filament
delicacy, organized density, membrane dissolution, and perceived intelligence.
It governs the design language. It is NOT a pixel-for-pixel reproduction
target — exercise judgment against its qualities, not its pixels.

## 3. Organism systems

Stable systems, each with a job (main implementations: `organism-engine.tsx`,
`organism-ecology.ts`, `organism-filament-flow.ts`):

- **Living membrane** — a boundary that emerges selectively from accumulated
  light; never a drawn shell.
- **Subordinate volumetric atmosphere** — warm umber/plum interior air
  (fbm-broken density); supports, never dominates.
- **Macro circulation paths** — 3–5 long, readable, tapered flows (MeshLine)
  that organize the composition.
- **Principal + supporting filaments** — curl-noise traced light threading the
  attractor regions.
- **Recessive micro-strands** — near-threshold strands read as accumulated
  light, not as lines.
- **Latent volumetric graph** — node relationships implied in depth; never an
  exposed wireframe.
- **Primary gold attractor / core** — the focal cognition center.
- **Secondary lavender attractor** — the reasoning region, right-leaning,
  connected by active paths.
- **Ambient field** — dust/starfield evidence of the surrounding field.
- **Contact shadow** — grounds the organism on the ivory page.

## 4. Permanent hierarchy

Gold is the principal cognition field; lavender is secondary/alternative
reasoning; hot white is reserved for very small focal events. Macro
circulation organizes the composition; filaments reveal internal flow; the
graph stays latent; particles are evidence of field behavior; the body
supports rather than obscures the ecology. When two layers compete, the one
higher in this hierarchy wins the light.

## 5. Rejected visual reads (diagnostics, not rules)

Each failed read and the failure that usually causes it:

- **Glass marble / continuous circular shell** — a radially uniform density or
  fresnel envelope whose perceptible-alpha isoline sits at constant radius.
  Fix the ENVELOPE (direction-broken fbm dissolution), not the highlight.
- **Grey opaque ball** — body opacity/darkness competing with the ecology.
- **Geodesic cage / exposed polygon mesh** — shell-distributed nodes with
  nearest-neighbor tessellation; graph legibility set too high.
- **Radial sunburst / pinwheel** — any `sin(angle * N)` shader term or a
  divergent (source-like) flow field. Curl noise is divergence-free precisely
  so this cannot happen.
- **Pale wire** — filament tint too dark or desaturated for additive blending
  over ivory; additive sums must land ON gold, not past it into white.
- **Tangled spaghetti** — filaments without tier hierarchy or attractor
  adherence.
- **Amorphous luminous blobs** — cluster glow without directional filament
  interiors.
- **Ribbon sculpture** — line width/taper too large; filaments must stay
  filaments of light.
- **Isolated gold and lavender lights** — attractors without active connecting
  paths.
- **Featureless white core** — additive layers stacking unclamped at the
  center; compress energy locally (small-radius smooth falloff), never dim the
  whole scene.
- **Uniform density** — everything equally prominent; organized density needs
  dense regions, quiet regions, bridges, and negative space.
- **Cosmetic state filters** — states re-tinting one static composition
  instead of reorganizing the internal system.

## 6. State meanings

One organism persists across all six states; a state change reorganizes the
same internal system, never replaces its identity.

- **Breathing** — regulated equilibrium.
- **Attending** — selective orientation and concentration; peripheral noise
  quiets, selected pathways align.
- **Surfacing** — progressive retrieval; a dormant cluster wakes and
  propagates.
- **Weighing** — competing attractors; influence and bridges redistribute
  between gold and lavender.
- **Enacting** — organized directional commitment.
- **Witnessed** — settled integration and proof.

## 7. Gated-pass protocol

Organism prompts focus on ONE subsystem or state at a time. For every pass:

1. Inspect the current implementation and the latest approved capture.
2. Identify the NARROWEST source of the visual defect.
3. Preserve approved systems; implement one focused correction.
4. Render the affected state and compare against the explicit acceptance gate.
5. Run relevant tests, typecheck, compliance, build.
6. Commit the stable result (commit and push EARLY — this environment has
   rolled back uncommitted work).
7. Stop when the requested gate is reached. Do not expand a pass into
   unrelated improvements.

## 8. Available capabilities

Installed agent skills (`.claude/skills/`): **shader-glsl**,
**threejs-animation**, **particle-system** — these guide implementation
judgment (GLSL/noise, R3F lifecycle/perf, flow fields/GPU points).

Implementation resources: **Canvas UI** source (adapted fbm — see
`docs/organism/THIRD-PARTY.md` for license), **meshline** (tapered paths via
`widthCallback`), **React Three Fiber + Drei**, and the existing
**organism-ecology** / **organism-filament-flow** systems (pure, seeded,
tested — structure and flow share one source of truth). Skills guide
judgment; libraries provide source and rendering primitives.

## 9. Evidence standard

Visual claims require CURRENT rendered captures (headless Chromium +
SwiftShader against a production build of `/lab/organism`). Code inspection
alone never proves visual success. Reports distinguish: **verified** (rendered
and inspected), **inferred** (reasoned from code), **unverified
hardware-dependent** (MacBook GPU, Safari, display color, thermals, hardware
frame rate — never claimable from SwiftShader captures).

## 10. Completion report

For a focused pass report only: what changed; why that narrow change; files
changed; rendered evidence; verification results; whether the stated gate
passed; and the largest remaining gap OUTSIDE the current pass.
