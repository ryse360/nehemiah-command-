# Orbital Filament System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat radiating-polyline organism with the Founder-specified volumetric generative filament field (layered depth, two-pass luminous splines, fresnel membrane, nodal flares, spec palette) in `/lab/organism`.

**Architecture:** A pure, seeded generative module (`organism-field.ts`) produces all geometry specs (nodes, proximity connections, major spline filaments with depth/family/brightness, orbital arcs, flares); a palette module holds the reference-derived `--neo-*` tokens; the R3F engine renders the field in the spec's 13-layer order using CatmullRomCurve3 smoothing, two-pass additive lines (fine core + halo), a fresnel shell shader, and per-layer asynchronous motion (no monolithic rotation). Existing state/transition/sleep/float systems are preserved and feed the same engine.

**Tech Stack:** three 0.185.1, @react-three/fiber 9.6.1, @react-three/drei 10.7.7 (Line), leva (lab shell only). NO new dependencies; NO @react-three/postprocessing — bloom is faked with additive halo passes.

## Global Constraints

- Dependency freeze: only three/@react-three/fiber/@react-three/drei/leva + existing project deps. Never `npm audit fix --force`.
- Acceptance criteria (build FAILS visual review if violated): no hard dark disk; no sharp polyline corners; line weight/brightness must vary; lines must NOT all originate from center; no sun/plasma-ball look; the system must not rotate as one object; gold must not become bright yellow; lavender must not become neon; outer lines must not be clipped by the orb boundary; must not feel flat.
- Composition: desktop orb 36–42% viewport width, preferred 520–620px, max 660px; filaments extend 12–22% beyond shell; no visible hard circular border.
- Counts (desktop): 90–160 nodes; 150–280 short connections; 20–32 major filaments; 6–10 orbital arcs; 350–700 ambient particles; 6–10 flares. Distribution: 60–70% inside membrane, 20–30% touch/cross, 8–12% orbital.
- Two-pass lines: core 0.35–1.2px @ 0.25–0.75 opacity; halo 3–8px @ 0.05–0.22 additive.
- Depth groups: rear 8–22% opacity; middle 18–45%; front 35–75%.
- Color balance 55–65% warm gold/white, 20–30% lavender, 10–20% dark neutral; organic interweave (no clean half split); lavender biased right.
- Motion: breathing scale 1.000→1.012–1.018 over 6.5–8.5s; filament displacement 1–3% of radius, per-path speeds; arcs 16–32s cycles, mixed directions; particle pulses 1.8–4.8s asynchronous; flares never pulse together.
- Contact shadow: 28–38% orb width, 3–6% height, blur 18–32px, opacity 0.10–0.18, warm brown-gray `rgba(68,53,41,0.15)`.
- Palette tokens (authoritative): background #F4EBE2 / light #FBF2F0; shell white #FDFEF4; core umber #443529; core plum #5F5157; gold deep #8E7358 / mid #D9B784 / light #EAD3B7; lavender dark #6C5E7C / mid #A694BF / light #E0CFED; shadow rgba(68,53,41,0.15).
- Keep working: 6-state lifecycle + transitions, sleep mode, float, adaptive sizing, Leva confinement to lab shell, reduced-motion, 189-test suite stays green.

---

### Task 1: Palette module

**Files:**
- Create: `src/nehemiah/organism-palette.ts`
- Test: `src/nehemiah/organism-palette.test.ts`

**Interfaces:**
- Produces: `export const neoPalette = { background, backgroundLight, shellWhite, coreUmber, corePlum, goldDeep, goldMid, goldLight, lavenderDark, lavenderMid, lavenderLight, contactShadow } as const` (hex strings; contactShadow rgba string).

- [ ] Step 1: failing test asserting every token's exact spec value and that no gold token is saturated yellow (heuristic: goldMid green channel ≥ 0.6 × red channel).
- [ ] Step 2: run → FAIL (module missing).
- [ ] Step 3: implement token object verbatim from spec.
- [ ] Step 4: run → PASS.
- [ ] Step 5: commit `feat: add reference-derived neo palette tokens`.

### Task 2: Generative field module

**Files:**
- Create: `src/nehemiah/organism-field.ts`
- Test: `src/nehemiah/organism-field.test.ts`

**Interfaces:**
- Produces:
  - `interface FieldNode { position: [number,number,number]; family: 'gold'|'lavender' }`
  - `interface FieldConnection { a: number; b: number }` (indices into nodes)
  - `interface MajorFilament { controlPoints: [number,number,number][]; depth: 'rear'|'middle'|'front'; family: 'gold'|'lavender'; brightness: number; reach: 'inner'|'membrane'|'orbital' }`
  - `interface OrbitalArc { radius: number; tilt: [number,number,number]; direction: 1|-1; periodSeconds: number }`
  - `interface NodalFlare { position: [number,number,number]; family: 'gold'|'lavender'; scale: number; pulseSeconds: number; phase: number }`
  - `organismField(options: { seed: number; nodeCount: number; connectionRadius: number; majorFilamentCount: number; arcCount: number; flareCount: number }) : { nodes, connections, filaments, arcs, flares }`
- Uses mulberry32 seeded RNG (copy pattern from `organism-filaments.ts`).

Key generation rules (implement exactly):
- Nodes: volumetric within radius 1.0 (rejection-sample r = cbrt(u) for uniform volume); family lavender iff `x > 0.15 + 0.35*rng()` else gold → lavender cluster biased right but interwoven.
- Connections: all node pairs with distance < connectionRadius, capped to spec range by raising/lowering nothing — test asserts count within 150–280 for default options (tune connectionRadius default 0.34, nodeCount 120).
- Filaments: origin = a randomly chosen NODE position scaled by 0.25–0.7 (NOT the center); 5–7 control points wandering outward; reach classes: 64% 'inner' (end radius 0.6–0.95), 26% 'membrane' (1.0–1.12), 10% 'orbital' (1.14–1.24 — beyond-shell extension, 12–22% past membrane radius ≈1.02·shell); brightness 0.25–1.0 varied; depth assigned ~30/40/30 rear/middle/front; family by origin-node side with 20% crossover.
- Arcs: radius 1.25–1.65, random tilts, alternating direction, period 16–32s.
- Flares: positioned at the brightest filament origin/end points, scale 0.03–0.07, pulse 1.8–4.8s, random phase.

- [ ] Step 1: failing tests — determinism per seed; node count honored; every connection distance < connectionRadius and count in [150,280]; filament reach distribution within tolerance (inner 55–75%, membrane 18–34%, orbital 6–14%); no filament origin within 0.12 of exact center AND origins' pairwise spread > 0.4; all three depth groups present; brightness values span (max-min > 0.4); lavender nodes' mean x > gold nodes' mean x; arc periods within [16,32]; flare pulses within [1.8,4.8].
- [ ] Step 2: run → FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run → PASS.
- [ ] Step 5: commit `feat: add generative orbital filament field`.

### Task 3: Engine rewrite to layered volumetric rendering

**Files:**
- Modify: `src/components/organism/organism-engine.tsx` (replace GoldPathways/IndigoPathways/ring internals; keep OrganismEngine props contract: `{ parameters, personality, reducedMotion }`)
- Modify: `src/components/organism/luminous-core.tsx` (retone to palette: kernel #FDFEF4, body golds; add secondary smaller lavender node at ~[0.52, 0.1, 0.15])

**Interfaces:**
- Consumes: `organismField`, `neoPalette`, existing `OrganismParameters`, `organismFloatOffset`, `resolveMotionScale`.
- Layer order (spec): ambient dust → rear arcs → membrane (fresnel ShaderMaterial: `opacity = rim^2.4 * strength`, color lerp gold-light→lavender-light by normalized x, additive, depthWrite false) → rear filaments → internal body (two nested translucent spheres: umber r1.08 opacity 0.42, plum r1.22 opacity 0.26 — NO opaque disk) → middle filaments → front filaments → node constellation (THREE.Points + lineSegments from connections, additive, low opacity) → flares (per-flare additive sphere + halo sphere, pulsing asynchronously in useFrame via refs) → core.
- Two-pass filament rendering: for each MajorFilament, smooth points via `new THREE.CatmullRomCurve3(vectors).getPoints(40)`; render `<Line>` twice — core: lineWidth 0.4–1.2 (by brightness), opacity depthBase*brightness clamped to [0.25,0.75] for front; halo: lineWidth 4–7, opacity 0.05–0.2, additive, family color one shade lighter.
- Depth opacity bases: rear 0.16, middle 0.34, front 0.6 (× goldIntensity/indigoIntensity params ÷ their resting values, so state/sleep dimming still works).
- Motion (useFrame): NO root rotation. Root: breathing scale `1 + 0.014 * sin(2π·elapsed/period)` with `period = clamp(9.5 - parameters.breathingSpeed·2.2, 6.5, 8.5)` × float position (existing). Rear group rotates y at +0.008 rad/s·motionScale, front at −0.006, arcs group per-arc `direction·(2π/periodSeconds)·motionScale`; filament vertex displacement approximated by per-depth-group position sine (amplitude 0.02·radius, distinct phases) — no frantic motion.
- Indigo convergence: scale lavender filament + flare group by `1 − 0.5·indigoConvergence` (keeps WEIGHING knot behavior).

- [ ] Step 1: run existing suite → must stay green (no unit tests for GPU output; architecture tests cover Leva confinement).
- [ ] Step 2: implement engine rewrite per above.
- [ ] Step 3: `npx tsc --noEmit` → clean; `npm test` → 189+ pass; `npm run build` → clean.
- [ ] Step 4: commit `feat: render organism as layered volumetric filament field`.

### Task 4: Composition & chrome to spec

**Files:**
- Modify: `src/components/organism/organism-lab.module.css` (stage ceiling 760→660px; contact shadow → width 34%, height 5%, blur 24px, color var --neo-contact-shadow equivalent rgba(68,53,41,0.15) opacity-capped ≤0.18; halo gradient tones to #FBF2F0)
- Modify: `src/app/lab/organism/page.tsx` (background gradient → #FBF2F0 center to #F4EBE2 edges; text colors keep charcoal family)

- [ ] Step 1: apply CSS/page edits.
- [ ] Step 2: `npm run build` → clean; sizes probe (Playwright viewport sweep) → orb within 36–42%W at 1536×1024 (expect ≈594px ✓), ≤660px everywhere, no scroll at any size.
- [ ] Step 3: commit `feat: align organism composition and grounding with filament spec`.

### Task 5: Visual acceptance verification

**Files:**
- None (verification only; screenshots to scratchpad)

- [ ] Step 1: Playwright captures at 1536×1024: rest, attending (long-press), weighing, witnessed, sleep (?idleMs).
- [ ] Step 2: check each acceptance criterion from Global Constraints against the captures; list any violation honestly.
- [ ] Step 3: full suite: `npm test`, `npx tsc --noEmit`, `npm run build` — all green.
- [ ] Step 4: push branch (preview URL auto-updates); report side-by-side vs reference with remaining gaps.

## Self-Review

- Spec coverage: layers 1–13 → Task 3 layer order (ribbons/caustic wisps consciously approximated by halo passes + membrane atmosphere — noted as remaining gap if visually insufficient); geometry/counts/distribution → Task 2; palette → Task 1; composition/shadow → Task 4; motion → Task 3; acceptance → Task 5. ✔
- Placeholders: none — all rules carry exact values. ✔
- Type consistency: `organismField` interfaces used in Task 3 match Task 2 definitions; `neoPalette` keys match Task 1. ✔
