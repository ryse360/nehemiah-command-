# Founder Decision Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the static six-state review prototype into a governed Founder journey driven by valid events, explicit decisions, visible action, and captured proof.

**Architecture:** Keep the existing deterministic state machine as the authority. Add a journey reducer that combines lifecycle state with Founder command, decision disposition, action record, and proof record. React components dispatch typed journey events; review controls remain available only as a development aid.

**Tech Stack:** Next.js, React, TypeScript, Node test runner, CSS.

## Global Constraints

- Preserve the approved organism identity and engaged-state visual composition.
- Do not expose Personal Standard, bottom status metrics, or rail quote.
- Founder owns decisions; Nehemiah prepares and records them.
- No state may advance without a valid event.
- Every approved decision must produce a visible action before proof can be recorded.
- Every completed step must be logged in `docs/BUILD_LOG.md` and committed.

---

### Task 1: Journey domain model

**Files:**
- Create: `src/nehemiah/founder-journey.ts`
- Test: `src/nehemiah/founder-journey.test.ts`

**Produces:** Typed journey state, events, reducer, and validation errors.

### Task 2: Decision actions

**Files:**
- Modify: `src/components/decision-field.tsx`
- Create: `src/components/decision-actions.tsx`

**Produces:** Approve, approve with limits, request evidence, delay, and reject interactions.

### Task 3: Guided lifecycle UI

**Files:**
- Modify: `src/components/nehemiah-shell.tsx`
- Modify: `src/components/state-controller.tsx`
- Modify: `src/app/globals.css`

**Produces:** Command submission, focus surfacing, decision disposition, action start, proof capture, and review close.

### Task 4: Verification and documentation

**Files:**
- Update: `docs/BUILD_LOG.md`
- Create: `docs/releases/founder-decision-journey.md`
- Update: `README.md`

**Produces:** Verified release record, build evidence, and operator instructions.
