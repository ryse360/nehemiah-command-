create table if not exists enterprise_context (
  founder_id text primary key,
  context jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists integration_signals (
  id bigserial primary key,
  founder_id text not null,
  integration_id text not null,
  external_id text not null,
  signal_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  unique (founder_id, integration_id, external_id)
);

create index if not exists integration_signals_founder_received_idx
  on integration_signals (founder_id, received_at desc);
