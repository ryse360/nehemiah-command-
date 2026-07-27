# Frontend Design

Upstream repository:
https://github.com/anthropics/claude-plugins-official

Upstream path:
plugins/frontend-design/skills/frontend-design/SKILL.md (branch: main)

Upstream commit:
f2d1e02

Original author:
Anthropic

License:
Apache-2.0

Installed via:
Vendored by hand. The plugin is installable through the official marketplace
(`/plugin install frontend-design@claude-plugins-official`), but marketplace
installs live outside the repository and are not shared with anyone else
working on Nehemiah. Copying the file in makes the guidance reviewable in diff
and versioned with the UI it governs.

Modifications from upstream:
None. `SKILL.md` is byte-for-byte identical to the upstream file. The plugin's
`LICENSE.txt` (a duplicate of the Apache-2.0 text already at `LICENSE` here)
and its `README.md` and `plugin.json` were not carried over — they describe
marketplace packaging, not the skill.

Nehemiah role:
Aesthetic direction for the Next.js surface in `src/`. This is the only
vendored skill that governs how the product looks rather than how it is
reasoned about or built. It applies when a screen is being designed or
reshaped — palette, type scale, layout concept, motion, and the interface copy
that carries them.

Placement in the toolchain:
  ADHD widens the field.
  Nehemiah governs the decision.
  Context7 supplies current facts about the chosen dependency.
  Frontend Design decides what the chosen surface looks like.
  Superpowers builds and verifies the winner.

What it actually enforces:
- A two-pass process: a written token system (4-6 named hex values, a display
  face, a body face, an optional utility face, a layout concept, and one
  signature element) is drafted and self-critiqued against the brief before any
  code is written.
- An explicit anti-default calibration. The skill names the three looks
  AI-generated design converges on and forbids spending a free design axis on
  them. Where a brief pins a direction, the brief wins — including when it asks
  for one of those looks.
- A quality floor stated as non-negotiable: responsive down to mobile, visible
  keyboard focus, `prefers-reduced-motion` respected.

Relationship to existing project standards:
`docs/quality/accessibility-contract.md` and `docs/design/motion-specification.md`
are the binding specifications for this repository. Where the skill's quality
floor and those documents disagree, the repository documents win — the skill is
upstream guidance, not a project contract. In practice the skill's floor is the
weaker of the two and adds no conflicting requirement.

Governance:
Invoke when building or reshaping UI. Do not invoke for logic, data, or
API-layer work, for copy edits that carry no visual decision, or to relitigate
a design a Founder has already locked. The skill deliberately encourages taking
one aesthetic risk; that latitude covers presentation only and does not extend
to product scope, information architecture, or the MiP worldview.
