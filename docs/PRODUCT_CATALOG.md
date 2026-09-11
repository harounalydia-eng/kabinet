# KABINET product catalog (Phase 1 — 2026-09-11)

The shared foundation for product intelligence. One canonical record per product, shared by every user and by
both KABINET apps (inspo + check-in). Built cache-first so KABINET's own catalog grows with use.

## Two systems, kept apart

| | `catalog_products` (canonical) | the user's own records |
|---|---|---|
| Means | what the product **is** | "I own / use this" |
| Lives in | Supabase, public read, service-role write | check-in app: `public.products` (RLS, owner only) · inspo: IndexedDB `owned` |
| Holds | brand, name, category, barcode, ingredients, provider packshot | status, notes, compatibility, evidence, the user's own photo (`image_path` in the private `photos` bucket) |
| Link | — | `products.catalog_product_id` · `OwnedProduct.catalogProductId` (nullable — older/unmatched products keep working) |

Personal data is never written to the catalog. Private user photos (skin, hair/scalp, progress, product shots)
stay in the private `photos` bucket exactly as before; canonical imagery is a URL on the catalog row.

## Schema (`supabase/migrations/20260911_catalog_products.sql`)

- `catalog_sources` — providers as rows (`open_beauty_facts`, `open_food_facts`, `brand`, `retailer`, `manual`).
  A new provider is an INSERT, not a migration.
- `catalog_products` — `id, brand, name, category, category_tags, barcode, quantity, image_url, ingredients[],
  ingredients_text, source, source_id, source_url, raw, fetched_at, created_at, updated_at`
  plus generated `normalized_brand`, `normalized_name`, `search_text` (via `kabinet_normalize()`: lower-case,
  accent-free, alphanumeric). Unique on `(source, source_id)` and on `barcode`; trigram index on `search_text`.
  `category` is KABINET's own vocabulary (skin · hair · makeup · nails · body · wellness), mapped heuristically;
  the provider's raw tags stay in `category_tags` for re-mapping. `raw` keeps a trimmed provider payload.
- `image_url` is the provider's packshot or **null**. Never stock imagery. The UI decides the fallback.

## Lookup (`supabase/functions/lookup-product`)

`POST /functions/v1/lookup-product` with one of `{ barcode }`, `{ query }`, `{ brand, name }` (+ `limit` ≤ 10, `refresh`).

```
catalog_products hit?  → return it            (cached: true, source: "kabinet")
miss                   → Open Beauty Facts → normalise (obf.ts) → upsert → return the stored row
```

- Identity: the user's session JWT, or the project's publishable key (`apikey`) — i.e. whatever supabase-js sends.
- Barcodes are normalised to GTIN digits (UPC-A → 13-digit EAN), so one product = one barcode.
- Repeated lookups return the same row; `(source, source_id)` upsert + the barcode unique index prevent duplicates.
- Provider down / timeout / non-JSON → HTTP 502 with a human message; nothing is written.
- Not found → HTTP 404 `{ ok: false, found: false }` — a result, not an exception.

`obf.ts` is a pure module (fetch injected). Test it with Node: `node --experimental-strip-types <test.mjs>`.

## Client access

- inspo: `src/lib/catalogProducts.ts` → `lookupProduct()`, `getCatalogProduct()`, `getCatalogProducts()`
- check-in app: same file, same API.
- Types: `src/lib/catalogProducts.types.ts` (identical in both apps).

## Open Beauty Facts — what we learned (2026-09-11)

- Endpoints in use: `GET /api/v2/product/{code}.json?product_type=all&fields=…` and the legacy
  `GET /cgi/search.pl?search_terms=…&search_simple=1&action=process&json=1`. The v2 search endpoint is tag-only.
- Search AND-s every word against product names, so brand + descriptor queries can miss; the function falls back
  to name-within-brand, then brand-only filtered by name words.
- Some beauty products are filed under the wrong product type (Olaplex No.3 → "food"); the redirect is followed and
  the row records `source = open_food_facts`.
- Coverage is uneven: names may be in the contributor's language ("CeraVe Hydraterende Crème"), ingredient lists
  are often empty (0 of 3 Fit Me shades, 1 of 3 Kérastase), images missing on some rows, and popular products can be
  absent entirely (no The Ordinary Niacinamide). Licence: ODbL data, CC BY-SA images — keep `source_url` for attribution.

## Not in this phase

No barcode camera UI, no compatibility/ingredient scoring, no pricing/affiliate, no recommendations, no new Explore UI,
no product-card redesign. The catalog is the data layer those will sit on.
