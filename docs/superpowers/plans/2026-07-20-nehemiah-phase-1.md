# Nehemiah Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working desktop prototype of Nehemiah Command with the approved engaged-state visual identity and six purposeful organism states.

**Architecture:** A Next.js application owns the screen shell and renders a deterministic state machine. The organism is first implemented as layered SVG/CSS animation so motion remains reversible and testable. State-specific UI is driven by typed configuration rather than duplicated screens.

**Tech Stack:** Next.js, React, TypeScript, Framer Motion, Vitest, Testing Library, Playwright.

## Global Constraints

- Primary screen ratio is 16:10.
- Approved palette: Deep Navy #081626, Warm Ivory #F7F5F1, Muted Slate #4B5563, Charcoal #111317, Restrained Gold #C49A4D.
- The organism’s approved visual identity must not be redesigned.
- Permanent engaged-state canvas excludes the bottom status strip, Personal Standard, and rail quote.
- Founder is the hero; Nehemiah is the guide.
- Core states: resting, listening, focus-surfaced, decision-required, action-underway, proof-created.
- Every state transition must have an explicit trigger and visible purpose.
- Founder-private information remains separate from enterprise-facing data.

---

### Task 1: Project foundation and canonical documentation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `docs/design/phase-1-state-system.md`
- Create: `docs/BUILD_LOG.md`
- Copy: `public/reference/approved-engaged-state.png`

**Produces:** A reproducible repository and canonical Phase 1 source documents.

### Task 2: State machine

**Files:**
- Create: `src/nehemiah/state-machine.ts`
- Test: `src/nehemiah/state-machine.test.ts`

**Produces:** `transitionState(current, event): NehemiahState` and typed transition metadata.

### Task 3: State content model

**Files:**
- Create: `src/nehemiah/state-content.ts`
- Test: `src/nehemiah/state-content.test.ts`

**Produces:** State-specific Founder copy, visible components, motion intent, and allowed actions.

### Task 4: Application shell

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/components/nehemiah-shell.tsx`
- Test: `src/components/nehemiah-shell.test.tsx`

**Produces:** The approved desktop composition with accessible semantic regions.

### Task 5: Living organism

**Files:**
- Create: `src/components/living-organism.tsx`
- Create: `src/components/living-organism.css`
- Test: `src/components/living-organism.test.tsx`

**Produces:** One organism component whose purposeful animation changes by state.

### Task 6: Founder focus and decision field

**Files:**
- Create: `src/components/founder-focus.tsx`
- Create: `src/components/decision-field.tsx`
- Test: `src/components/decision-field.test.tsx`

**Produces:** Contextual coaching and Founder decision flow.

### Task 7: Prototype controls and transitions

**Files:**
- Create: `src/components/state-controller.tsx`
- Test: `src/components/state-controller.test.tsx`

**Produces:** A review mode that advances through all six states.

### Task 8: Visual and accessibility verification

**Files:**
- Create: `tests/e2e/state-journey.spec.ts`
- Create: `playwright.config.ts`

**Produces:** Screenshot baselines and keyboard-accessible interaction checks.

### Task 9: Documentation and handoff

**Files:**
- Update: `docs/BUILD_LOG.md`
- Create: `docs/design/motion-specification.md`
- Create: `docs/design/engineering-handoff.md`

**Produces:** Traceable completion record and next-phase handoff.
