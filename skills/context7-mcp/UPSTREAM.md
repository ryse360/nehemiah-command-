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
`query-docs` tools. That server is configured for this project in the
repo-root `.mcp.json`, using the remote HTTP transport
(`https://mcp.context7.com/mcp`) — the same entry `ctx7 setup --claude
--project` writes. Claude Code prompts for approval before loading a
project-scoped MCP server, so checking it in shares the configuration
without granting it trust implicitly.

Transport choice:
HTTP over stdio, deliberately. The stdio alternative is
`npx -y @upstash/context7-mcp`, which resolves and executes the latest
published version of an external package on every session start. For a
codebase with Founder-only data and fail-closed release gates, a pinned
remote endpoint is the smaller supply-chain surface.

API key (optional):
The endpoint works unauthenticated at reduced rate limits, so no secret is
required and none is committed. To raise the limits, add the key as a header
in `.mcp.json`:

    "headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }

`CONTEXT7_API_KEY` is developer-tooling configuration, not application
runtime configuration — it is intentionally absent from `.env.example`, which
describes only what the Next.js app itself reads.

Network requirement:
`mcp.context7.com` must be reachable. Egress-restricted environments
(including Claude Code web sessions on a restricted network policy) will fail
to connect; the skill then has nothing to call and should not be invoked.

Governance:
Use when a real dependency decision or integration is on the table. Do not
invoke for questions answerable from the repository itself, for library
choices already Founder-locked, or as a substitute for reading the code in
`src/`. Fetched documentation is upstream vendor content — treat it as
reference, not as authority over Nehemiah's product purpose or MiP
worldview.
