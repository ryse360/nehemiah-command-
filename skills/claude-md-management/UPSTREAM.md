# CLAUDE.md Management

Upstream repository:
https://github.com/anthropics/claude-plugins-official

Upstream path:
plugins/claude-md-management (branch: main)

Upstream commit:
f2d1e02

Original author:
Anthropic

License:
Apache-2.0

Installed via:
Vendored by hand from the official marketplace plugin
(`/plugin install claude-md-management@claude-plugins-official`). Vendored
rather than installed so that the audit rubric this project's CLAUDE.md is
graded against is itself in version control.

Modifications from upstream:
None to the instruction files. `claude-md-improver/SKILL.md`, its three
`references/` files, and `commands/revise-claude-md.md` are byte-for-byte
identical to upstream. The plugin's two PNG screenshots, `README.md` and
`plugin.json` were not carried over.

Layout note:
Upstream ships this as one plugin containing a skill and a command. Claude Code
loads skills and commands from different directories, so the live copies are
split:
  .claude/skills/claude-md-improver/   <- the audit skill + references
  .claude/commands/revise-claude-md.md <- the session-capture command
This directory keeps them together as a single vendored unit, mirroring how
`skills/superpowers/` holds a bundle of related skills.

Nehemiah role:
Project memory maintenance. Everything else in the toolchain assumes Claude
starts a session already knowing how this repository works; that knowledge
lives in CLAUDE.md, and this is what keeps it accurate. Two entry points with
different timing:

  claude-md-improver (skill)  - audit on demand. Discover every CLAUDE.md,
                                score each against a weighted 100-point rubric
                                (commands/workflows, architecture clarity,
                                non-obvious patterns, conciseness, currency,
                                actionability), report before touching
                                anything, then propose diffs.
  /revise-claude-md (command) - capture at the end of a working session. What
                                context was missing that would have helped?
                                Route each addition to CLAUDE.md (team-shared)
                                or .claude.local.md (personal, gitignored).

Both stop and ask before writing. Neither edits a file without showing the diff
first.

Immediate applicability:
This repository has no CLAUDE.md. It does have 18 skills under
`.claude/skills/`, a project-scoped MCP server in `.mcp.json`, a `scripts/`
directory, and 47 documents under `docs/` — none of which is described to
Claude at session start. Running the audit skill will score the repository at
grade F on a missing file; the useful output is its list of recommended
sections, not the grade.

Governance:
CLAUDE.md is part of every prompt in this repository, so additions are a real
cost, not free documentation. Apply the skill's own restraint rules: no
restating what is obvious from the code, no generic best practices, no one-off
fixes unlikely to recur. Anything Founder-only or environment-specific belongs
in `.claude.local.md`, which is gitignored — never commit Founder data or
credentials to `CLAUDE.md`.
