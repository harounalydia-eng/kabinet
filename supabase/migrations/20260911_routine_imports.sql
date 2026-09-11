-- KABINET · beauty content → structured routine (2026-09-11)
--
-- content_imports  = one public post/video (shared: the same URL is read once for everyone)
-- routines         = the structured interpretation of that content (title, type, steps, products)
-- routine_products = what the creator used — the creator's words kept verbatim + the canonical catalog match
-- routine_steps    = what the creator did, in order
-- user_routines    = "I saved this" — the person's relationship to a routine (private, owner-only)
--
-- Shared tables are readable by signed-in users and written only by the import pipeline (service role).
-- Nothing here re-hosts a video: source URL, thumbnail URL, metadata and the extraction only.

create table if not exists public.content_imports (
  id                    uuid primary key default gen_random_uuid(),
  platform              text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  source_url            text not null,                    -- as pasted; kept forever for attribution
  canonical_url         text not null,
  source_content_id     text not null,                    -- the platform's own id
  creator_name          text,
  creator_handle        text,
  creator_profile_url   text,
  title                 text,
  caption               text,                             -- TikTok caption / YouTube title-line caption
  description           text,                             -- YouTube description when retrievable
  hashtags              text[] not null default '{}',
  thumbnail_url         text,
  thumbnail_w           integer,
  thumbnail_h           integer,
  embed_url             text,
  video_url             text,                             -- null by design: third-party video is never re-hosted
  transcript            text,
  transcript_source     text check (transcript_source in ('platform', 'user', 'provider')),
  raw_metadata          jsonb not null default '{}'::jsonb,
  evidence_sources      text[] not null default '{}',     -- which of title/caption/description/hashtags/transcript existed
  import_status         text not null default 'queued' check (import_status in ('queued', 'reading', 'listening', 'extracting', 'matching', 'ready', 'failed')),
  status_message        text,                             -- the restrained copy the UI shows
  error                 text,
  extraction_confidence text check (extraction_confidence in ('high', 'medium', 'low')),
  model                 text,                             -- which model produced the extraction
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (platform, source_content_id)
);

create table if not exists public.routines (
  id                    uuid primary key default gen_random_uuid(),
  content_import_id     uuid references public.content_imports (id) on delete cascade,
  origin                text not null default 'import' check (origin in ('import', 'user', 'adapted')),
  parent_routine_id     uuid references public.routines (id) on delete set null, -- an adaptation points at its source
  title                 text not null,
  routine_type          text check (routine_type in ('skincare', 'makeup', 'haircare', 'scalp', 'body', 'nails', 'mixed', 'unknown')),
  description           text,
  skin_hair_context     text,                             -- what the creator said about their own skin/hair, verbatim-ish
  extraction_confidence text check (extraction_confidence in ('high', 'medium', 'low')),
  extraction_notes      text,                             -- why confidence is what it is / what was missing
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists routines_import_idx on public.routines (content_import_id);

create table if not exists public.routine_products (
  id                    uuid primary key default gen_random_uuid(),
  routine_id            uuid not null references public.routines (id) on delete cascade,
  catalog_product_id    uuid references public.catalog_products (id) on delete set null,
  raw_brand             text,
  raw_product_name      text not null,
  raw_variant           text,
  raw_text              text,                             -- the creator's words this came from, verbatim
  usage_order           integer not null default 1,
  usage_notes           text,
  amount_text           text,
  evidence_sources      text[] not null default '{}',     -- caption · description · title · hashtags · transcript
  extraction_confidence text check (extraction_confidence in ('high', 'medium', 'low')),
  resolution_status     text not null default 'unresolved' check (resolution_status in ('matched', 'possible_match', 'unresolved', 'manual', 'none')),
  candidate_ids         uuid[] not null default '{}',     -- possible catalog matches for the person to choose from
  resolved_by           uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists routine_products_routine_idx on public.routine_products (routine_id);
create index if not exists routine_products_catalog_idx on public.routine_products (catalog_product_id);

create table if not exists public.routine_steps (
  id                    uuid primary key default gen_random_uuid(),
  routine_id            uuid not null references public.routines (id) on delete cascade,
  step_number           integer not null,
  title                 text,                              -- "Cleanse", "Prep", "Protect"
  instruction           text not null,
  routine_product_id    uuid references public.routine_products (id) on delete set null,
  catalog_product_id    uuid references public.catalog_products (id) on delete set null,
  timing_text           text,
  area_text             text,
  notes                 text,
  extraction_confidence text check (extraction_confidence in ('high', 'medium', 'low')),
  created_at            timestamptz not null default now(),
  unique (routine_id, step_number)
);

create table if not exists public.user_routines (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  routine_id            uuid not null references public.routines (id) on delete cascade,
  status                text not null default 'saved' check (status in ('saved', 'adapted', 'archived')),
  title_override        text,
  notes                 text,
  saved_at              timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, routine_id)
);
create index if not exists user_routines_user_idx on public.user_routines (user_id);

create or replace function public.routines_touch()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['content_imports','routines','routine_products','user_routines'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.routines_touch()', t, t);
  end loop;
end $$;

alter table public.content_imports  enable row level security;
alter table public.routines         enable row level security;
alter table public.routine_products enable row level security;
alter table public.routine_steps    enable row level security;
alter table public.user_routines    enable row level security;

drop policy if exists "imports readable by members" on public.content_imports;
create policy "imports readable by members" on public.content_imports for select to authenticated using (true);
drop policy if exists "routines readable by members" on public.routines;
create policy "routines readable by members" on public.routines for select to authenticated using (true);
drop policy if exists "routine products readable by members" on public.routine_products;
create policy "routine products readable by members" on public.routine_products for select to authenticated using (true);
drop policy if exists "routine steps readable by members" on public.routine_steps;
create policy "routine steps readable by members" on public.routine_steps for select to authenticated using (true);
-- shared tables: no client insert/update/delete policies — the import pipeline (service role) writes.

drop policy if exists "own saved routines" on public.user_routines;
create policy "own saved routines" on public.user_routines for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
