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
