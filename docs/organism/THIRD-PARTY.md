# Third-party sources used by the organism

Attribution and licence notices for external work vendored, adapted, or
installed for the Nehemiah Visual Laboratory.

## meshline — installed dependency

- Upstream: https://github.com/pmndrs/meshline
- Version: 3.3.1 (npm `meshline`, installed via the repo's existing npm lockfile)
- Commit inspected: `4df8778398e086628076267c67552c079d39be85`
- Licence: MIT (Copyright © 2023 Poimandres)
- Use: tapered principal filament paths. `MeshLineGeometry.setPoints` accepts a
  `widthCallback`, which gives true per-vertex taper — a filament that thins at
  both ends instead of a constant-width tube. Registered with R3F via
  `extend({ MeshLineGeometry, MeshLineMaterial })` in `organism-engine.tsx`.

## canvas-ui — adapted source (copy-source component system)

- Upstream: https://github.com/DavidHDev/canvas-ui
- Commit: `6c9cccf12df6eb85689ae74d1759a24d7328f88e`
- Licence: **MIT + Commons Clause License Condition v1.0**, Copyright © 2026
  David Haz. The Commons Clause forbids *selling* the software (i.e. charging
  for a product whose value derives substantially from it). Nehemiah is a
  private internal Founder tool and is not sold, so this use is within the
  licence. **This notice must be preserved.**
- Adapted from: `src/lib/Clouds/CloudsVanilla.ts` — the 2D simplex `hash`/
  `noise` pair and the `fbm` octave loop.
- Applied in: `organism-engine.tsx`, `VolumetricBody` fragment shader
  (`cuiHash` / `cuiNoise` / `fbm`). It drives uneven interior density and
  partial dissolution, so the internal atmosphere is a warm, unevenly dense
  volume rather than a smooth grey mass — and it replaced the angular
  `sin(ang * N)` term that was producing a radial pinwheel.
- The full canvas-ui documentation application was **not** installed or
  migrated; only the noise/fbm technique was adapted into the existing shader.

## webgl-animation-skills — agent skills

- Upstream: https://github.com/iart-ai/webgl-animation-skills
- Commit: `50697d659fbf70152f48f9f8aadf1efe78bbdde1`
- Licence: MIT
- Installed via `npx skills add iart-ai/webgl-animation-skills` into
  `.agents/skills/`, symlinked for Claude Code (`shader-glsl`,
  `threejs-animation`, `particle-system`).
- Use: the `particle-system` skill's curl-noise guidance directly shaped
  `organism-filament-flow.ts`. Curl of a vector potential is divergence-free
  (no sources or sinks), which is *why* filaments traced through that field
  circulate and fold instead of radiating — the property that structurally
  prevents the rejected sunburst read from returning. A test asserts the
  field's divergence stays bounded.
