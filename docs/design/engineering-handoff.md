# Nehemiah Phase 1 Engineering Handoff

## Production Entry

- Framework: Next.js App Router
- Route: `/`
- Main component: `src/components/nehemiah-shell.tsx`
- State machine: `src/nehemiah/state-machine.ts`
- State content: `src/nehemiah/state-content.ts`
- Presentation adapter: `src/nehemiah/shell-model.ts`
- Visual system: `src/app/globals.css`

## Verification

```bash
npm install
npm test
npm run typecheck
npm run build
npm start
```

## Acceptance Criteria

- Six states are reachable from the review controller.
- Resting state contains no decision panel.
- Decision Required contains exactly one Founder decision.
- Engaged screen excludes bottom status strip, permanent Personal Standard, and rail quote.
- Proof state says `Proof change is possible.`
- Founder remains decision owner in visible copy.
- Reduced-motion preference is respected.
