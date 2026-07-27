# Skill Vetting — NVIDIA SkillSpector

## Why this exists

`.claude/skills/` is not a dependency tree — it is a set of files Claude Code
loads as **live instructions**. A vendored `SKILL.md` (or a script it
references) can direct the agent to run commands, so it gets a higher trust
bar than an npm package: something that would be an advisory for a library
is a build-breaking gate here.

[NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) (Apache-2.0) is
a static/LLM scanner purpose-built for this: it detects 68 vulnerability
patterns across categories like prompt injection, credential access, supply
chain (remote-code execution), and unauthorized session persistence in AI
agent skill files.

## How the gate works

CI (`.github/workflows/ci.yml`, step "Skill security scan") runs:

```bash
npm run security:scan-skills
```

which calls `scripts/scan-skills.ts`. That script:

1. Scans `.claude/skills/` — the skill tree Claude Code actually loads —
   with `skillspector scan --no-llm --baseline docs/security/skillspector-baseline.yaml`.
2. Any finding **not** already in the baseline fails the build (exit 1),
   regardless of SkillSpector's own aggregate severity score. The baseline
   is the review record; an unbaselined finding means the vendored skill
   tree changed in a way nobody has looked at yet.
3. Findings already in the baseline are suppressed and don't fail the
   build, but are still counted and printed (`--show-suppressed`) so the
   evidence file always shows the full picture, not just what passed.

`--no-llm` is deliberate: CI has no LLM provider credentials wired in, and a
static-only scan is deterministic (no external API call, no result drift
between runs). Static-only scanning is also known to be more false-positive
prone — see "What's baselined" below for why that's an acceptable tradeoff
here rather than a gap.

The scanner is installed from a **pinned commit SHA**
(`fd25398d7aa99353d86237b9c260759351f0e644`, SkillSpector v2.4.4), not a
floating branch — a scanner update can change what it flags, and that
should be a deliberate version bump in this file's history, not a silent
CI behavior change.

## Running it locally

```bash
uv tool install "git+https://github.com/NVIDIA/skillspector.git@fd25398d7aa99353d86237b9c260759351f0e644"
npm run security:scan-skills
```

## What's baselined, and why

`docs/security/skillspector-baseline.yaml` currently suppresses 28 findings,
all against the vendored `obra/superpowers` skill set
(`skills/superpowers/`, mirrored into `.claude/skills/`). Reviewed
2026-07-27, static-only scan. None of them trace to code that exfiltrates
data, escalates privilege beyond the skill's own local tooling, or executes
attacker- or network-controlled input:

- **`brainstorming`** (scored CRITICAL / 95 unbaselined — the highest of any
  vendored skill): its `scripts/` run a local companion web server for the
  brainstorming UI. `nohup`/`disown` in `start-server.sh` back that server
  process off the foreground shell (flagged as "Rogue Agent / Session
  Persistence"); `chmod 600` sets the permission on the server's own lock
  file (flagged as "Sudo/Root Execution" — no `sudo` is present);
  `rm -f "${STATE_DIR}/server-info"` in `stop-server.sh` deletes that same
  lock file on shutdown (flagged as "Tool Parameter Abuse"); an HTML
  `<!-- BRANDING -->` comment in the served page is flagged as a "Hidden
  Instruction" — it's markup, not an instruction to the agent; and a
  `.env` string appears only as a path check inside a cross-platform
  browser-launcher helper, never read or transmitted.
- **`subagent-driven-development`**: matched a YARA rule for "autonomous
  destructive filesystem actions" on `git clean -fdx`, `without asking`, and
  `silently` — these are strings *inside the skill's own documentation*,
  illustrating the pattern to avoid, not something it executes.
- **`writing-skills`**: matched "Self-Modification" and "Agent Config
  Directory Access" on `Write skill`, `Edit skill`, and
  `grep -r ... ~/.claude/` — this skill's entire purpose is teaching how to
  author and test other skills, so its own docs necessarily describe
  writing `SKILL.md` files and searching `~/.claude/`.
- **`systematic-debugging`**: matched "Credential Access" on the word
  `Keychain`/`keychain` — it appears in a debugging example, not in code
  that reads a credential store.
- The remaining findings (`executing-plans`, `requesting-code-review`,
  `using-git-worktrees`, `verification-before-completion`,
  `using-superpowers`) are all "Excessive Agency" matches on prose like
  *"without asking"* / *"without verification"* — the skills are
  *instructing the agent not to do those things*, and the pattern matcher
  can't distinguish a prohibition from the act itself.

If a future LLM-assisted pass (`skillspector scan --baseline ... `, without
`--no-llm`, given provider credentials) disagrees with any of the above,
treat that as a reason to re-review, not to widen the baseline further.

`docs/security/skillspector-baseline.yaml` also suppresses 20 findings
(reviewed 2026-07-27) against the 15 vendored `koala73/worldmonitor`
economic-intelligence skills in `skills/worldmonitor-economic-intelligence/`
(mirrored into `.claude/skills/`). Every finding — `P1` (Prompt Injection)
on all 15, plus `YR4` (YARA rule `agent_skill_prompt_injection_hidden_
instructions`) on 5 of them — traces to the same source: each `SKILL.md`
carries a "Content safety" section instructing the agent to treat API
response fields as data, never as instructions, and it quotes the literal
phrase *"ignore previous instructions"* as the example text to disregard.
The static matcher and the YARA rule both fire on the quoted example, not
on an actual embedded instruction override — the same prohibition-vs-act
confusion documented above for `obra/superpowers`. None of the 20 findings
trace to exploit code, credential access, or executable content; each
skill is a single static `SKILL.md` describing a REST endpoint, with no
accompanying scripts. See `skills/worldmonitor-economic-intelligence/
UPSTREAM.md` for why these skills are vendored for reference only (no API
key is provisioned, so none of them can make a live call) and for the
separate, still-open account-trust caveat on the upstream repository.

## Reviewing a new finding

When the gate fails on a real change:

1. Read the printed finding (severity, category, file, line, explanation).
2. If it's a genuine problem, fix the skill content and re-run.
3. If it's a false positive or an accepted, understood risk:
   ```bash
   npm run security:scan-skills -- --accept
   ```
   This regenerates `docs/security/skillspector-baseline.yaml` with a
   `reason: 'UNREVIEWED — ...'` placeholder on every current finding.
   Replace each placeholder you're keeping with an actual reason before
   committing — an `UNREVIEWED` reason must never be merged. Delete
   fingerprints for anything you fixed instead of accepted (rerun the scan
   without `--accept` after fixing to confirm they're gone).

## License note

SkillSpector is Apache License 2.0. It is invoked as an external CLI tool
in CI and locally — it is not vendored into this repository and carries no
dependency-tree or attribution obligation beyond this note.
