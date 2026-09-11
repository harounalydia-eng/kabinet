-- KABINET (inspiration app) accounts: onboarding state + personalization.
-- Separate from the skin app's `profiles` so the two step vocabularies never collide.
create table if not exists public.kabinet_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  worlds text[] not null default '{}',
  intents text[] not null default '{}',
  onboarding_step text not null default 'worlds',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kabinet_profiles enable row level security;
create policy "kabinet_profiles owner select" on public.kabinet_profiles for select using (auth.uid() = user_id);
create policy "kabinet_profiles owner insert" on public.kabinet_profiles for insert with check (auth.uid() = user_id);
create policy "kabinet_profiles owner update" on public.kabinet_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger kabinet_profiles_updated before update on public.kabinet_profiles for each row execute function public.set_updated_at();

-- Shortcut credentials: bound to a user, stored hashed, revocable. Minted only by the `import` edge function.
create table if not exists public.import_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'iPhone Shortcut',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists import_tokens_user_idx on public.import_tokens (user_id, created_at);
alter table public.import_tokens enable row level security;
create policy "import_tokens owner select" on public.import_tokens for select using (auth.uid() = user_id);
create policy "import_tokens owner revoke" on public.import_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One-time pairing codes shown in KABINET and redeemed by the Shortcut on its first run.
create table if not exists public.import_pairings (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  consumed_at timestamptz,
  token_id uuid references public.import_tokens(id) on delete set null
);
create index if not exists import_pairings_user_idx on public.import_pairings (user_id, created_at);
alter table public.import_pairings enable row level security;
create policy "import_pairings owner select" on public.import_pairings for select using (auth.uid() = user_id);

-- Inbox rows now belong to a user (the token that wrote them is kept for auditing).
alter table public.import_inbox add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists import_inbox_user_status_idx on public.import_inbox (user_id, status, created_at);
create unique index if not exists import_inbox_user_url_key on public.import_inbox (user_id, canonical_url) where user_id is not null;
create policy "import_inbox owner select" on public.import_inbox for select using (auth.uid() = user_id);
create policy "import_inbox owner update" on public.import_inbox for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- The onboarding connection + first-save checks listen for rows arriving.
alter publication supabase_realtime add table public.import_inbox;
alter publication supabase_realtime add table public.import_pairings;
