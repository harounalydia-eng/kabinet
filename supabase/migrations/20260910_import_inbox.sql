-- Inbox for links shared into KABINET from outside the app (iOS Shortcut, etc.).
-- Rows are keyed by a hashed device token; only the `import` edge function (service role) touches this table.
create table if not exists public.import_inbox (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  source text not null default 'unknown',
  url text not null,
  canonical_url text not null,
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  source_id text,
  vertical boolean not null default true,
  title text,
  caption text,
  creator_name text,
  thumbnail_url text,
  thumbnail_w integer,
  thumbnail_h integer,
  access_note text,
  status text not null default 'pending' check (status in ('pending', 'imported', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  imported_at timestamptz,
  unique (token_hash, canonical_url)
);
create index if not exists import_inbox_token_status_idx on public.import_inbox (token_hash, status, created_at);
alter table public.import_inbox enable row level security;
-- No policies on purpose: anon/authenticated roles cannot read or write; the edge function uses the service role.
