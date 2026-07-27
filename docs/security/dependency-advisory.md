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

### Residual exposure — RESOLVED via overrides, same day

The three advisories described below were subsequently **eliminated**. See
"Override remediation" further down. The analysis is retained because it
documents why the obvious fix was rejected and what was done instead.

Three high-severity advisories remained after the patch upgrade, with **no
safe remediation path through version bumps alone**:

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

Three options were considered:

1. **Accept the risk and record it.** Lowest disruption; leaves the
   vulnerability present.
2. **Force resolution via `overrides`** in `package.json`.
3. **Wait for an upstream Next.js release** that bumps its own pins.

Option 2 was chosen and succeeded. Option 1 was held as the fallback had the
gate failed.

## Override remediation — 2026-07-27

`package.json` now carries:

```json
"overrides": {
  "postcss": "$postcss",
  "sharp": "0.35.3"
}
```

`npm audit --omit=dev` now reports **0 vulnerabilities across 220 production
dependencies**, down from 3 high. Evidence regenerated at
`docs/production/dependency-audit-result.json`.

### Why this form

`postcss` uses the `$postcss` reference rather than a literal version. A
literal fails with `EOVERRIDE — Override for postcss@^8.5.23 conflicts with
direct dependency`, because npm requires an override on a package that is also
a direct dependency to reference that dependency rather than restate it. The
`$` form keeps the nested copy pinned to whatever the direct devDependency
resolves to, so the two can never drift apart again.

`sharp` is pinned to an exact `0.35.3`, matching this repository's convention
of exact pins. It is declared by `next` as an **optional** dependency at
`^0.34.5`, so the override is what lifts it past the vulnerable `<0.35.0`
range.

Net effect on the tree: the nested `next/node_modules/postcss@8.4.31`
disappears entirely and dedupes to the single safe top-level `postcss@8.5.23`;
`sharp` moves `0.34.5` → `0.35.3`.

### Verification

The overridden tree passed every check this repository has:

| Check | Result |
| --- | --- |
| `npm audit --omit=dev` | **0 vulnerabilities** (220 prod deps) |
| Tests | 251 passed, 0 failed |
| Strict TypeScript | pass |
| Founder compliance | 14/14 |
| Production build | pass, all 20 routes |
| Performance budget | pass — lab engine 1,156,963 B of 1,500,000 B |
| Runtime smoke | pass — `/api/health` 200, `/` 200, protected routes 401 |
| Security headers | pass, no failures |

`sharp` was additionally exercised directly, because a native binary swap is
not necessarily exercised by a build or a server boot:

- `sharp` 0.35.3 on libvips 8.18.3
- WebP encode: OK
- AVIF encode: OK

Those are the two formats Next.js uses for image optimization, so the image
path is confirmed live rather than merely installed.

### Maintenance note

These overrides force versions on a dependency this project does not control.
When Next.js next bumps its own `postcss` and `sharp` pins past the vulnerable
ranges, **re-check whether the overrides are still needed** and remove them if
not. Leaving a stale override in place is its own hazard: it silently pins a
transitive dependency and can hold it *below* a future fix. Re-evaluate at each
Next.js minor upgrade.

### Verification caveat

This audit ran against `https://registry.npmjs.org` through this environment's
agent proxy, not from the production CI registry named in required production
action 1. The advisory data is the public npm source either way, but if the
release process requires the audit to originate from production CI
specifically, this evidence should be regenerated there.
