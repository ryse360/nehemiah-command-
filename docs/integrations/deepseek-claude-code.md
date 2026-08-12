# DeepSeek for Claude Code (dev tooling)

## What this is

Claude Code's CLI reads three environment variables to decide which model
provider it talks to. Pointing them at DeepSeek's Anthropic-compatible
endpoint swaps the model a contributor's own Claude Code session runs on,
without touching Anthropic's API at all:

```bash
ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
ANTHROPIC_AUTH_TOKEN="your-deepseek-key"
ANTHROPIC_MODEL="deepseek-model-id"
```

This is a per-developer, local dev-tooling choice — an optional second model
to run Claude Code sessions against this repo on, for example when working
in parallel across multiple sessions or trying to cut per-session cost.
It is **not** part of the Nehemiah Command application. It does not touch
`NEHEMIAH_AI_API_KEY` / `NEHEMIAH_AI_MODEL` / `NEHEMIAH_AI_BASE_URL`, which
configure the app's own governed AI decision-preparation calls
(`docs/releases/v0.18.0-ai-orchestration.md`), and it is not read by any
code in `src/`.

## Why this works

`ANTHROPIC_BASE_URL` overrides the host Claude Code's CLI sends Messages
API requests to. `ANTHROPIC_AUTH_TOKEN` is the bearer credential for that
host. `ANTHROPIC_MODEL` is the model ID sent in each request. DeepSeek
publishes an endpoint (`/anthropic` on `api.deepseek.com`) that accepts the
same Anthropic Messages API shape Claude Code already speaks, so setting
these three variables is the entire swap — no CLI flags, config file, or
code change required.

## Setting it up

1. Get a DeepSeek API key from the [DeepSeek platform](https://platform.deepseek.com/).
2. Check DeepSeek's current API docs for the exact model ID to use —
   `ANTHROPIC_MODEL` must match a model DeepSeek currently serves behind its
   Anthropic-compatible endpoint; the ID drifts as DeepSeek ships new model
   versions, so don't assume any specific value stays valid.
3. Export the three variables in the shell that launches Claude Code:

   ```bash
   export ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
   export ANTHROPIC_AUTH_TOKEN="your-deepseek-key"
   export ANTHROPIC_MODEL="deepseek-model-id"
   claude
   ```

4. To go back to Anthropic's own API, unset all three (or open a fresh
   shell that never set them).

Treat `ANTHROPIC_AUTH_TOKEN` as a secret: keep it out of shell history committed
to dotfiles repos and out of anything checked into this repo. It is a
personal credential for a personal choice of model provider, not a project
secret — it does not belong in `.env.example`, which documents only what
the Next.js application itself reads at runtime.

## Out of scope

This does not change what model Nehemiah Command's own AI orchestration
uses in production, is not invoked by `npm run dev` or any build/CI step,
and does not modify any file under `src/`. It only affects a contributor's
own local Claude Code CLI sessions against this repo.
