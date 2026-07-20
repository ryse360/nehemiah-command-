# Nehemiah Command — Phase 1 Production Release

## Release purpose

This release establishes the production front-end behavior prototype for the Founder’s private intelligence interface.

## Included

- Six-state lifecycle: Resting, Listening, Focus Surfaced, Decision Required, Action Underway, Proof Created.
- Typed deterministic state machine.
- Approved Founder focus and decision flow.
- Living organism with purposeful state-specific behavior.
- Responsive desktop-first composition.
- Reduced-motion support.
- Automated logic and brand-language tests.
- Production Next.js build configuration.
- Vercel deployment configuration.
- GitHub Actions verification workflow.

## Approved subtraction rules

The engaged state excludes:

- Bottom status strip.
- Permanent Personal Standard.
- Navigation-rail quote.
- Multiple competing decisions.
- Copy inside the living organism.

## Verification gate

A release is valid only after all commands pass:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

## Production boundary

This release contains no authentication, external integrations, encrypted Founder memory, AI decision engine, or production database. Those capabilities belong to subsequent governed phases.
