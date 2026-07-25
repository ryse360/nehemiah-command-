-- 007 — AI usage ledger (durable, concurrency-safe spend control).
--
-- Stores ONLY derived economics. No prompts, responses, Founder content,
-- secrets, or PII ever land here — only request id, Phoenix day, agent, model,
-- price version, status, token counts, and cost in integer nano-dollars.

create table if not exists ai_usage_ledger (
  request_id       text primary key,           -- idempotency key
  day_key          text not null,              -- America/Phoenix YYYY-MM-DD
  agent            text not null,
  model            text not null,
  price_version    text not null,
  status           text not null
                     check (status in ('reserved', 'settled', 'void', 'cache_hit')),
  est_cost_nano    bigint not null default 0,
  actual_cost_nano bigint,
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now(),
  settled_at       timestamptz
);

-- the daily-ceiling sum scans by day + status
create index if not exists ai_usage_ledger_day_status
  on ai_usage_ledger (day_key, status);
