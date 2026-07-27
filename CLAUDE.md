# Nehemiah Command

Next.js 16 (App Router) + React 19 + TypeScript. Founder-only decision system.
Node 22. ESM (`"type": "module"`).

## Commands

    npm run dev              # next dev
    npm run gate             # test + typecheck + governance:organism + build — run before claiming done
    npm test                 # node --import tsx --test "src/**/*.test.ts"
    npm run typecheck        # tsc --noEmit
    npm run governance:organism   # Founder compliance gate (see below)

CI additionally runs `quality:performance`, `quality:smoke`, `quality:headers`,
and `release:audit`. `npm run gate` is the local subset.

## Architecture

    src/nehemiah/     Domain core. Pure logic + colocated *.test.ts. Start here.
                      Subdirs: ai/ cost/ memory/
    src/app/          App Router. api/ has 14 route groups (auth, ai, founder-*, …).
                      src/app/lab/organism/ is the laboratory — NOT production.
    src/components/   organism/ = R3F/Three.js scene. ui/ = shadcn primitives.
    docs/database/    Numbered SQL migrations 001–006, applied in order. No migration tool.
    prototype/        Static HTML/CSS/JS. Not part of the build.

## Governance gate

`scripts/check-founder-compliance.ts` turns Founder-locked decisions into 15
machine checks. It runs in CI on every push. A red gate blocks the branch.
Constraints that are not visible from the code:

- **Dependency freeze.** `gsap`, `tsparticles`, `anime.js`, `animejs` are denied.
  Additions to the rendering/animation stack need Founder sign-off, recorded in
  the script's comments with a dated decision ID.
- **Palette is locked** to reference-derived tokens in `src/nehemiah/organism-palette.ts`.
- **Lab isolation.** `src/app/page.tsx` must not import `organism-lab`,
  `organism-engine`, `luminous-core`, or `organism-field`. Leva may be imported
  only by `organism-lab.tsx`, never by the engine layers.
- **No dashboard language in the lab**: "Founder Agenda", "Active Projects",
  "Live Context", "Personal Standard".
- **No monolithic rotation.** The engine root group carries breathing/float only;
  `root.current.rotation` is forbidden. Only the globe net sub-layer spins.
- **Governed modules must carry tests** — the script hardcodes a required list of
  `src/nehemiah/organism-*.test.ts` files.

Read the script before touching the organism. It explains each rule's reasoning.

## Testing

Tests are colocated `*.test.ts` next to their source, run by the built-in Node
test runner via tsx. No Jest, no Vitest — do not add one.

## Gotchas

- `next-env.d.ts` is gitignored deliberately (phantom diffs between dev and build
  type output). Do not un-ignore it; `next build` regenerates it.
- Security headers live in `next.config.ts` and are asserted by
  `npm run quality:headers`. Change both together.
- `.env*` is gitignored. `.env.example` is the source of truth for required vars;
  update it when adding one.
- Founder passwords are scrypt hashes — generate with `npm run security:hash-password`.

## Key files

    next.config.ts                        CSP + security headers
    scripts/check-founder-compliance.ts   the governance gate
    docs/organism/ACCEPTANCE.md           acceptance criteria for the organism
    docs/quality/accessibility-contract.md
    docs/design/motion-specification.md
    .mcp.json                             project-scoped Context7 MCP server
