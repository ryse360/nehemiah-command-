create table if not exists founder_memory (
  founder_id text primary key,
  memory jsonb not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on founder_memory from public;
