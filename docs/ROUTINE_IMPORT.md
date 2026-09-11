# Beauty content → structured routine (Phase 1 — 2026-09-11)

The beauty equivalent of a recipe importer: a public TikTok / YouTube / Instagram link becomes a routine with
products and ordered steps, every product resolved against the shared catalog (`docs/PRODUCT_CATALOG.md`), and the
creator kept visibly attached. Nothing is a text blob; nothing is invented.

```
URL → detect platform → public metadata → transcript (only if the person pastes one) → ONE model call
    → {title, products[], steps[]} with verbatim evidence → resolve each product (catalog → lookup-product)
    → content_imports / routines / routine_products / routine_steps → review screen → user_routines
```

## Tables (`supabase/migrations/20260911_routine_imports.sql`)

| table | what it is | who reads / writes |
|---|---|---|
| `content_imports` | one public post: platform, source_url (kept forever), canonical_url, source_content_id, creator name/handle/profile, title, caption, description, hashtags, thumbnail, embed_url, transcript (+source), raw_metadata, evidence_sources, import_status, status_message, error, extraction_confidence, model | signed-in read · pipeline writes · unique (platform, source_content_id) → one read per post, shared by everyone |
| `routines` | the structured interpretation: title, routine_type, description, skin_hair_context, extraction_confidence, extraction_notes, origin (import/user/adapted), parent_routine_id | signed-in read · pipeline writes |
| `routine_products` | the creator's words (raw_brand, raw_product_name, raw_variant, raw_text verbatim, usage_order, usage_notes, amount_text, evidence_sources, confidence) **and** the canonical link (catalog_product_id, resolution_status, candidate_ids, resolved_by) | signed-in read · pipeline + `/confirm` write |
| `routine_steps` | step_number, title, instruction, routine_product_id, catalog_product_id, timing_text, area_text, confidence | signed-in read · pipeline writes |
| `user_routines` | "I saved this": user_id, routine_id, status, title_override, notes | owner-only (RLS) |

Raw extraction is never overwritten by catalog data: `raw_*` stays as said/shown, `catalog_product_id` sits beside it.

## Edge function `import-routine` (`supabase/functions/import-routine`)

- `POST /import-routine {url, transcript?}` — runs the pipeline; returns `{import, routine, products, steps}`. A post already
  read for anyone is reused (`cached: true`). Failure is honest: HTTP 422 with `import.error` and the row kept.
- `POST /import-routine/rerun {import_id, transcript?}` — extract again with new evidence.
- `POST /import-routine/confirm {routine_product_id, catalog_product_id | null}` — the person picks the right product (`manual`).
- Identity: session JWT. Status copy is written to `content_imports.status_message` as it moves
  (Reading the post… → Listening for products… → Building the routine… → Matching products…). The app polls that row.
- Model: `claude-sonnet-5` (env `KABINET_EXTRACTION_MODEL`), **one call per import**, tool-schema output, system prompt
  forbids invention; generic mentions ("a sunscreen") become `resolution_status = none`.
- Resolution: `matched` (brand agrees + name words overlap, clear winner) · `possible_match` (candidates stored, person
  chooses) · `unresolved` (named but unknown to catalog + Open Beauty Facts) · `none` (category only).
- Secrets: `ANTHROPIC_API_KEY` (required for extraction), `YOUTUBE_API_KEY` (optional — official description; without
  it the watch page's own JSON is read, which is unofficial and may stop working).

## What each platform gives an app (verified 2026-09-11)

| | TikTok | YouTube | Instagram |
|---|---|---|---|
| metadata | oEmbed (public): caption-as-title, author name/url, thumbnail, embed | oEmbed (public): title, channel name/url, thumbnail; **description** via Data API key (official) or watch-page JSON (unofficial) | nothing without an approved Meta app + oEmbed token |
| caption | yes (oEmbed `title`) | title + description | no |
| transcript | no | no — `timedtext` returns empty bodies to non-browser clients since 2024/25; Data API `captions.download` needs the owner's OAuth | no |
| video file | no (ToS; only embed) | no (ToS; only embed) | no |
| auth / limits | none for oEmbed; polite UA | oEmbed none; Data API key = 10 000 units/day | Meta app review |
| fallback | paste what's said | paste what's said | paste caption/what's said |

So evidence today = title · caption · description · hashtags (+ a pasted transcript). Frame analysis needs a video file
KABINET is not allowed to fetch; it stays an interface for a future user-upload path.

## Screens (inspo)

- `/routines/import` — paste link (+ optional "what's said"), K mark + server status copy while it runs.
- `/routines/review/:id` — "Here's what I found." ✓ matched · ? possible/unresolved (tap → candidates or catalog search) · steps → Confirm routine.
- `/routines/r/:id` — the beauty recipe: title, by @creator · platform · View original, thumbnail → platform embed on tap,
  Products (packshot, brand, name, category, View ingredients → catalog list or "Ingredient list not available yet."),
  Routine 01…, actions Save routine · Add products to My Kabinet · Check with KABINET (env) · Adapt routine for me (soon).
- `/routines` — "From creators" section + "+ From a link".

## Not in this phase

Transcription provider, frame sampling, compatibility/adaptation intelligence, analytics. The model allows all of them
(`transcript_source = provider`, `routines.origin = adapted` + `parent_routine_id`, per-product evidence arrays).
