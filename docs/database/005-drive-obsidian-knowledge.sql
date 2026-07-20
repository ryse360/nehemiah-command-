create table if not exists knowledge_sources (
  founder_id text not null,
  source_kind text not null check (source_kind in ('google-drive', 'obsidian')),
  external_id text not null,
  title text not null,
  source_ref text not null,
  modified_at timestamptz not null,
  received_at timestamptz not null default now(),
  content text not null,
  visibility text not null check (visibility in ('founder-private', 'enterprise')),
  tags text[] not null default '{}',
  owners text[] not null default '{}',
  mime_type text,
  content_hash text,
  primary key (founder_id, source_kind, external_id)
);
create index if not exists knowledge_sources_founder_modified_idx on knowledge_sources (founder_id, modified_at desc);
create index if not exists knowledge_sources_search_idx on knowledge_sources using gin (to_tsvector('english', title || ' ' || content));
