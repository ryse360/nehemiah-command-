# Claude Code System Prompts

Upstream repository:
https://github.com/Piebald-AI/claude-code-system-prompts

Upstream path:
`system-prompts/` (branch: master)

Pinned at:
commit `2393c77403f14957d35d3c039383abb54c61c092`, corresponding to
Claude Code v2.1.220.

Original author:
Piebald LLC (Mike <mike@piebald.ai> and contributors)

License:
MIT — the upstream `LICENSE` is vendored beside this file, as MIT
redistribution requires.

Provenance caveat — read before trusting any file here:
These prompts were **extracted by script from the compiled JavaScript of the
`@anthropic-ai/claude-code` npm package**. They are a third-party
reconstruction, not an Anthropic publication and not authoritative. Template
variables such as `${BASH_TOOL_NAME}` are interpolated by Claude Code at
runtime and appear here as literal strings. Upstream commits are unsigned.
Treat every file as *evidence of how the harness probably behaves*, never as
a specification to code against.

## Why this is in `docs/` and not in `skills/`

This repository vendors third-party **skills** into `skills/<name>/` and
mirrors them into `.claude/skills/<name>/`, where Claude Code loads them as
live instructions. This corpus is deliberately **not** placed there.

These files are 610 upstream markdown documents of dense imperative
instruction text. Read as reference they are inert. Placed in
`.claude/skills/`, `.claude/agents/`, `.claude/commands/`, or a root
`CLAUDE.md`, they would become live directives competing with this project's
own governance — Founder-locked decisions, fail-closed release gates, and the
MiP worldview. That is the specific failure this placement prevents.

Rules that follow from that:

- Do not copy any file from `prompts/` into `.claude/` or into a `CLAUDE.md`.
- Do not import, concatenate, or template these files into application code
  in `src/`. Nothing here is a runtime asset.
- Read them the way you would read a vendor's changelog: to understand the
  environment, not to take orders from it.

The upstream files carry `<!-- ... -->` HTML-comment frontmatter rather than
YAML frontmatter, so Claude Code cannot auto-load them as skills or agents
even by accident. That is a safety margin, not a licence to relocate them.

## Placement in the toolchain

The `MASTER_AI_HANDOFF` §12 sequence — ADHD widens the field, Nehemiah
governs the decision, Context7 supplies current facts, Superpowers builds and
verifies — describes tools that *act*. This corpus does not act and does not
belong in that sequence.

It sits underneath all four as documentation of the harness they run inside:
what Claude Code's own security monitor blocks, how it classifies bash
commands, how it structures subagent delegation and code review. Consult it
when a question is about **the agent environment itself**, then return to the
sequence to do the work.

## What was vendored, and why each file earns its place

A curated subset of 12 files out of 610. Selection is driven by what this
repository actually does; the rest were left upstream.

### Agent and skill authoring

This repo vendors skills and will likely author its own.

- `skill-agent-design-patterns.md` — how Claude Code structures agent
  definitions; the reference against which our `skills/` entries can be
  sanity-checked.
- `skill-claude-code-configuration-guide.md` — settings, permissions, and
  hook surfaces, relevant to `.claude/` and `.mcp.json`.
- `agent-prompt-claude-md-creation.md` — this repository has **no root
  `CLAUDE.md`**. If one is ever added, this documents the shape the harness
  expects.

### Security and permissions

Pairs with `docs/security/` and the fail-closed release gates.

- `system-prompt-doing-tasks-security.md` — the baseline safety framing.
- `system-prompt-permission-classifier-strict-review-guidance.md` — how
  strict-mode permission review is posed.
- `agent-prompt-bash-command-prefix-detection.md` — command-injection
  detection rules, including worked examples of what gets rejected.
- `skill-generate-permission-allowlist-from-transcripts.md` — the reasoning
  behind read-only allowlisting; directly useful if we ever tighten
  `.claude/settings.json` permissions.
- `agent-prompt-security-monitor-for-autonomous-agent-actions-first-part.md`
- `agent-prompt-security-monitor-for-autonomous-agent-actions-second-part.md`
  — the two largest files here (~110 KB combined) and the most valuable. They
  enumerate what an autonomous agent is blocked from doing: destruction,
  exfiltration, shared-state writes, credential handling, deploys. For a
  codebase with Founder-only data, this is the closest available statement of
  the boundary our agents operate within.

### Subagent delegation

Pairs with the `dispatching-parallel-agents` and
`subagent-driven-development` skills.

- `agent-prompt-explore.md` — how the read-only search subagent is scoped.
- `agent-prompt-plan-mode-enhanced.md` — plan-mode structure, which our
  `writing-plans` / `executing-plans` skills run alongside.

### Code review

Pairs with `requesting-code-review` / `receiving-code-review`.

- `agent-prompt-code-review-workflow-routing.md` — how review effort levels
  route to different strategies.

## Updating

There is no automation and none should be added. To refresh, clone upstream
at a new tag, re-copy only the files listed above, and update the pinned
commit and version at the top of this file in the same change.

Upstream's own `tools/updatePrompts.js` is **not** vendored. It requires
`ANTHROPIC_API_KEY`, POSTs prompt text to `api.anthropic.com` for token
counting, and deletes any `.md` in its target directory absent from its input
JSON. It has no role here.

## Audit

The upstream repository was reviewed before this subset was taken. Findings:
no `package.json` and therefore no install hooks; no CI workflows; no git
hooks, symlinks, or executable files; no `eval`, `child_process`, or dynamic
`require` anywhere; no obfuscated or encoded payloads. The only network
egress in upstream code is `api.anthropic.com` and `registry.npmjs.org`, both
in the un-vendored update script. Grep hits for `exfiltrate` and
`curl … | sh` occur inside the security-classifier prompts as examples of
what to **block** — including `https://evil.com` in
`agent-prompt-bash-command-prefix-detection.md`, which is a labeled
command-injection sample, not live content.

The residual risk is content, not code, and the `docs/` placement above is
the mitigation.

## Governance

Reference material only. It does not define product purpose, override
Founder-locked decisions, or carry authority over the MiP worldview. Where
this corpus and this repository's own documentation disagree, this repository
wins.
