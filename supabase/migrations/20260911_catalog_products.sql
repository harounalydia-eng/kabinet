-- KABINET · shared product catalog (2026-09-11)
--
-- catalog_products = what a product IS (canonical, shared by every user and both KABINET apps).
-- It is NOT anyone's Kabinet. Ownership, status, personal notes, compatibility and evidence live on the
-- per-user tables (public.products in the check-in app, IndexedDB `owned` in the inspo app) which point
-- here through catalog_product_id. Nothing personal is ever written into this table.
--
-- Providers are rows in catalog_sources, so a new data source is an INSERT, not a schema change.
-- Writes happen only through edge functions with the service role; clients can read.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Lower-case, accent-free, alphanumeric-only text for matching and de-duplication.
-- Declared immutable so it can back generated columns; the unaccent dictionary is static.
create or replace function public.kabinet_normalize(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(trim(regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9]+', ' ', 'g')), '')
$$;

create table if not exists public.catalog_sources (
  key         text primary key,
  label       text not null,
  kind        text not null check (kind in ('open_data', 'brand', 'retailer', 'manual', 'provider')),
  base_url    text,
  attribution text,
  licence     text,
  created_at  timestamptz not null default now()
);

insert into public.catalog_sources (key, label, kind, base_url, attribution, licence) values
  ('open_beauty_facts', 'Open Beauty Facts', 'open_data', 'https://world.openbeautyfacts.org',
   'Product data © Open Beauty Facts contributors', 'ODbL (data) · CC BY-SA (images)'),
  ('open_food_facts',   'Open Food Facts',   'open_data', 'https://world.openfoodfacts.org',
   'Product data © Open Food Facts contributors',   'ODbL (data) · CC BY-SA (images)'),
  ('brand',    'Brand (official)', 'brand',    null, null, null),
  ('retailer', 'Retailer',         'retailer', null, null, null),
  ('manual',   'Entered by hand',  'manual',   null, null, null)
on conflict (key) do nothing;

create table if not exists public.catalog_products (
  id               uuid primary key default gen_random_uuid(),
  brand            text,
  name             text not null,
  normalized_brand text generated always as (public.kabinet_normalize(brand)) stored,
  normalized_name  text generated always as (public.kabinet_normalize(name)) stored,
  search_text      text generated always as (coalesce(public.kabinet_normalize(brand), '') || ' ' || coalesce(public.kabinet_normalize(name), '')) stored,
  -- KABINET's own category vocabulary (the inspo worlds). Null when the source gave nothing mappable.
  category         text check (category in ('skin', 'hair', 'makeup', 'nails', 'body', 'wellness')),
  category_tags    text[] not null default '{}',          -- the source's raw tags, kept for re-mapping
  barcode          text check (barcode ~ '^[0-9]{8,14}$'), -- GTIN as digits (UPC-A stored as 13-digit EAN)
  quantity         text,
  image_url        text check (image_url is null or image_url ~ '^https://'), -- legitimate product/packshot only, else null
  ingredients      text[] not null default '{}',          -- INCI list, one entry per ingredient, in label order
  ingredients_text text,                                  -- the source's raw ingredient string
  source           text not null references public.catalog_sources (key),
  source_id        text,                                  -- the provider's own id (Open Beauty Facts: the code)
  source_url       text,                                  -- provider page for attribution
  raw              jsonb,                                 -- trimmed provider payload, for re-normalising later
  fetched_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (source, source_id)
);

comment on table public.catalog_products is 'Canonical product records shared by all users. Never holds personal data.';

create unique index if not exists catalog_products_barcode_key on public.catalog_products (barcode) where barcode is not null;
create index if not exists catalog_products_search_trgm on public.catalog_products using gin (search_text extensions.gin_trgm_ops);
create index if not exists catalog_products_brand_idx on public.catalog_products (normalized_brand);

create or replace function public.catalog_products_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists catalog_products_touch on public.catalog_products;
create trigger catalog_products_touch before update on public.catalog_products
  for each row execute function public.catalog_products_touch();

alter table public.catalog_sources  enable row level security;
alter table public.catalog_products enable row level security;

drop policy if exists "catalog sources are public" on public.catalog_sources;
create policy "catalog sources are public" on public.catalog_sources
  for select to anon, authenticated using (true);

drop policy if exists "catalog products are public" on public.catalog_products;
create policy "catalog products are public" on public.catalog_products
  for select to anon, authenticated using (true);
-- No insert/update/delete policies: only the service role (edge functions) writes.

-- The check-in app's per-user products point at the canonical record. Nullable: products identified from a
-- photo before the catalog existed, or with no match, keep working unchanged.
alter table public.products add column if not exists catalog_product_id uuid references public.catalog_products (id) on delete set null;
create index if not exists products_catalog_product_idx on public.products (catalog_product_id);
comment on column public.products.catalog_product_id is 'What the product IS lives in catalog_products; this row is what the user owns/uses.';
