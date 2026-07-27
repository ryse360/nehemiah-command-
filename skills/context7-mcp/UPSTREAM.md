# Context7 MCP

Upstream repository:
https://github.com/upstash/context7

Upstream path:
skills/context7-mcp/SKILL.md (branch: master)

Original author:
Upstash, Inc.

License:
MIT

Installed via:
`ctx7 skills install /upstash/context7 context7-mcp`

Note: this environment's network egress policy blocks `context7.com` and
`api.github.com`, so the CLI's own fetch path fails here. The files were
pulled byte-for-byte from `raw.githubusercontent.com` — the same source the
CLI downloads from — and placed in the same locations the CLI writes
(`.claude/skills/context7-mcp/SKILL.md`, plus this vendored copy).

Nehemiah role (per MASTER_AI_HANDOFF §12 toolchain):
Live documentation retrieval. Context7 replaces training-data recall with
current, version-accurate library docs at the moment a dependency is being
configured or called. It answers WHAT the library actually does today;
it does not decide what to build or how to verify it.

Placement in the toolchain:
  ADHD widens the field.
  Nehemiah governs the decision.
  Context7 supplies current facts about the chosen dependency.
  Superpowers builds and verifies the winner.

Runtime dependency:
The skill drives the Context7 MCP server's `resolve-library-id` and
`query-docs` tools. Without that MCP server configured for the session, the
skill has nothing to call. Configuring it is a separate, config-level step
(`ctx7 mcp install`, or an equivalent MCP server entry) and is deliberately
not committed here — MCP server wiring is environment state, not project
source, and Context7's remote transport requires network egress to
`context7.com`.

Governance:
Use when a real dependency decision or integration is on the table. Do not
invoke for questions answerable from the repository itself, for library
choices already Founder-locked, or as a substitute for reading the code in
`src/`. Fetched documentation is upstream vendor content — treat it as
reference, not as authority over Nehemiah's product purpose or MiP
worldview.
