create table if not exists distributed_rate_limit_attempts (
  id bigserial primary key,
  limiter_key text not null,
  attempted_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists distributed_rate_limit_attempts_key_time_idx
  on distributed_rate_limit_attempts (limiter_key, attempted_at desc);
create index if not exists distributed_rate_limit_attempts_expiry_idx
  on distributed_rate_limit_attempts (expires_at);
