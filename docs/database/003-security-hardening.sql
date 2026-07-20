create table if not exists revoked_founder_sessions (
  founder_id text not null,
  session_id text not null,
  revoked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (founder_id, session_id)
);

create index if not exists revoked_founder_sessions_expiry_idx
  on revoked_founder_sessions (expires_at);

create table if not exists security_audit_events (
  id bigint generated always as identity primary key,
  founder_id text not null,
  actor_type text not null,
  actor_id text not null,
  event_type text not null,
  outcome text not null,
  request_id text not null,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_audit_events_founder_time_idx
  on security_audit_events (founder_id, occurred_at desc);

-- Recommended scheduled maintenance:
-- delete from revoked_founder_sessions where expires_at <= now();
