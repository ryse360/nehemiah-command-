create table if not exists founder_pilot_sessions (
  founder_id text not null,
  session_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  command text not null,
  completed_journey boolean not null,
  proof_captured boolean not null,
  decision_useful boolean not null,
  five_second_gate jsonb not null,
  critical_issues integer not null default 0 check (critical_issues >= 0),
  high_issues integer not null default 0 check (high_issues >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (founder_id, session_id)
);
