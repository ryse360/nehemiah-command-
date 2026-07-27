# Dependency Advisory Record

## v0.17.1 status

A prior local audit reported two moderate advisories in the PostCSS dependency path bundled through Next.js. The automated remediation proposed a forced downgrade to an older Next.js major version and was rejected because it would create a larger compatibility and security risk.

During the v0.17.1 exit-gate verification, the configured package registry audit endpoint returned HTTP 502, so a fresh advisory result could not be obtained. This is recorded as an external verification limitation rather than reported as resolved.

## Required production action

1. Run `npm audit --omit=dev` from the production CI registry.
2. Preserve the resulting JSON as release evidence.
3. Upgrade through a supported Next.js patch when an upstream fix is available.
4. Do not use `npm audit fix --force` without a reviewed migration and complete regression gate.

## v1.0.0-rc.1 audit note

On 2026-07-20, the configured registry audit endpoint returned HTTP 502 and did not provide current advisory evidence. Safe patch updates were applied to `postgres` 3.4.9 and `tsx` 4.23.1. No forced dependency downgrade or `npm audit fix --force` was applied. Production release remains blocked until a current audit succeeds through a functioning registry.

## 2026-07-27 audit — registry blocker cleared

The registry audit endpoint responded normally for the first time since
v0.17.1 (`npm ping` → PONG). `npm audit --omit=dev` completed and produced
current advisory evidence, preserved at
`docs/production/dependency-audit-result.json`.

This closes required production action 1 and 2, and the production-gate item
**"Current dependency audit."**

### Remediation applied

`next` was moved from `16.2.10` to `16.2.12` — a two-patch upgrade within the
same major and minor. This is required production action 3, an upgrade
through a supported Next.js patch.

`npm audit` reported this fix as "outside the stated dependency range" only
because `package.json` pins `next` to an exact version rather than a range.
It is not a major-version change. `npm audit fix --force` was **not** used, in
keeping with required production action 4.

The upgrade resolved **nine high-severity Next.js advisories**:

- Middleware / Proxy bypass in App Router applications using Turbopack and
  single locale
- Denial of Service in App Router using Server Actions
- Server-Side Request Forgery in Server Actions on custom servers
- Cache confusion of response bodies for requests with bodies
- Cache confusion of response bodies for requests with bodies containing
  invalid UTF-8 byte sequences
- Unbounded Server Action payload in Edge runtime
- Server-Side Request Forgery in rewrites via attacker-controlled destination
  hostname
- Denial of Service in the Image Optimization API using SVGs
- Unauthenticated disclosure of internal Server Function endpoints

The middleware/proxy bypass is the most consequential of these for this
codebase: authorization boundaries and Founder-only gating depend on App
Router middleware behaving as declared.

### Regression gate

The upgrade was verified with the full `npm run gate` on the exact upgraded
tree — 251 tests passing, strict TypeScript, 14/14 founder-compliance
governance checks, and an optimized production build on Next.js 16.2.12. All
20 routes built. Exit code 0.

### Residual exposure — requires Founder risk acceptance

Three high-severity advisories remain and **have no safe remediation path
today**:

| Package | Installed | Vulnerable range | Nature |
| --- | --- | --- | --- |
| `postcss` (nested under `next`) | 8.4.31 | `<=8.5.17` | XSS via unescaped `</style>`; arbitrary file read and path traversal via `sourceMappingURL` |
| `sharp` (transitive via `next`) | 0.34.5 | `<0.35.0` | Inherited libvips CVE-2026-33327, -33328, -35590, -35591 |
| `next` | 16.2.12 | — | Carries no direct advisory; flagged solely for depending on the two above |

`next` itself is clean as of 16.2.12. Both remaining advisories sit inside
Next.js's own bundled dependency tree.

There is no forward fix because **16.2.12 is already the latest published
Next.js**. `npm audit` reports `fixAvailable: next@9.3.3` for all three, which
is a downgrade of seven major versions — the same class of proposal rejected
at v0.17.1, and rejected again here. The top-level `postcss` is already safe
at 8.5.23; only the copy nested inside `next` is affected.

Options, none applied — this is a Founder decision:

1. **Accept the risk and record it.** Both are build-time and
   image-processing paths rather than request-handling paths. This is the
   lowest-disruption option and would satisfy the gate item "No unresolved
   critical or **unaccepted** high issues" by making the acceptance explicit.
2. **Force resolution via `overrides`** in `package.json` to lift the nested
   `postcss` to 8.5.23 and `sharp` to `>=0.35.0`. Untested here. `sharp` is a
   native binary module, so this carries real breakage risk and would require
   a fresh full gate plus image-optimization verification.
3. **Wait for an upstream Next.js release** that bumps its own pins, then
   re-audit.

Until one of these is chosen and evidenced, the production-gate item "No
unresolved critical or unaccepted high issues" remains open.

### Verification caveat

This audit ran against `https://registry.npmjs.org` through this environment's
agent proxy, not from the production CI registry named in required production
action 1. The advisory data is the public npm source either way, but if the
release process requires the audit to originate from production CI
specifically, this evidence should be regenerated there.
