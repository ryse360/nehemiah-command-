# World Monitor — Economic Intelligence Skills

Upstream repository:
https://github.com/koala73/worldmonitor

Upstream path:
`public/.well-known/agent-skills/<skill-name>/SKILL.md` (branch: main)

Original author:
Elie Habib

License:
AGPL-3.0-only (see `LICENSE` in this directory, copied verbatim from upstream)

Installed via:
Vendored by hand — files pulled byte-for-byte from a shallow clone of the
upstream repository and placed in the same relative layout, minus the
`public/.well-known/agent-skills/` web-serving prefix.

## What this is

World Monitor ships 25 Claude-Code-compatible agent skills describing its
live intelligence API (`api.worldmonitor.app`) and MCP server
(`worldmonitor.app/mcp`). This directory vendors the 15 that map onto what a
financial advisor, counselor, or coach needs to stay current on economic
and geopolitical conditions before advising a client:

- `get-market-quotes` — real-time equity/index/ETF quotes
- `track-tariff-trends` — applied vs. bound tariff rates by country pair
- `check-sanctions-pressure` — OFAC designation and sanctions exposure
- `assess-energy-shock` — modeled oil/gas chokepoint disruption scenarios
- `trace-trade-flows` — UN Comtrade commodity flow anomalies
- `get-prediction-markets` — Polymarket-derived probability signals
- `check-country-risk` — composite Country Instability Index + advisories
- `fetch-country-brief` — AI-generated country situation summary
- `fetch-resilience-score` — composite country resilience score/breakdown
- `monitor-supply-chain-stress` — carrier/freight shipping stress signals
- `monitor-energy-disruptions` — energy asset disruption event log
- `check-chokepoint-status` — live maritime chokepoint disruption status
- `fetch-news-digest` — categorized, threat-classified news aggregation
- `check-forecast-signals` — probabilistic forecasts and calibration
- `track-conflict-events` — geolocated armed-conflict event log (UCDP)

The other 10 upstream skills (webcams, airport delays, internet outages,
cyber threats, unrest events, military flight tracking, earthquakes,
climate hazards, vessel traffic, health alerts) are out of scope for the
financial-advisory use case and were not vendored.

## Governance — reference only, not live-wired

**No API key is configured anywhere in this repository or its secrets.**
Every skill's endpoint requires `X-WorldMonitor-Key`; without a provisioned
key, an invocation fails closed at `api.worldmonitor.app` rather than
silently degrading. That is deliberate. These skills are vendored so
Nehemiah has the documented *shape* of this data source on hand — what
signals exist, how they're parameterized, what the response schema looks
like — without granting a third-party host (`worldmonitor.app`) any live
query traffic, including real client-relevant financial questions.

Do not provision `WM_API_KEY` (or wire `worldmonitor.app/mcp` into
`.mcp.json`) without an explicit Founder decision. Two open concerns as of
this review, neither a defect in the vendored skill text itself:

1. **Account trust.** The upstream repository's GitHub-reported star/fork
   counts are implausible for its account age at time of review — a
   pattern consistent with inflated-engagement campaigns used to make a
   project look more established than its history supports. This vendoring
   round evaluated the *content* of the 15 skill files (see
   `docs/security/skill-vetting.md`), not the trustworthiness of the
   organization operating `worldmonitor.app` as a live service.
2. **Third-party data dependency.** Even once trusted, every one of these
   skills routes a live query to an external host. Founder financial
   guidance should treat any response as one input among others, not a
   sole source — consistent with this skill set's own "Content safety"
   disclaimers instructing exactly that treatment of its own output.

## SkillSpector review

All 15 skills were scanned with the same pinned NVIDIA SkillSpector build
this repository's CI gate uses. Every finding traced to one false-positive
pattern (the "Content safety" disclaimer's quoted example of injected
text). Full rationale, and the reviewed baseline entries, are in
`docs/security/skill-vetting.md` and
`docs/security/skillspector-baseline.yaml`.
