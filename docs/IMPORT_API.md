# Social import — `POST /functions/v1/import`

One pipeline for every way a TikTok, Instagram Reel, YouTube video or Short enters KABINET: the web "paste a link" flow and the iPhone Shortcut both call this endpoint. It lives on the `kabinet` Supabase project as the `import` edge function. Source: `supabase/functions/import/`.

## What gets saved

A social save **is video content**. The thumbnail is only its poster for the masonry; tapping a save opens the video experience (`SocialPlayer`), which loads the platform's own embed player (`social.embedUrl`) or, when a platform offers none, opens the original post. Preserved per save: platform, the link as shared (`sourceUrl`), canonical URL, creator name + profile URL, title/caption, poster, embed URL, orientation, and an honest `accessNote` about what the platform did not expose.

Not done at save time, by design: no download or re-hosting of video, no AI, no transcription, no routine extraction, no product identification. Saving is a single metadata fetch.

## Products are a separate system

Product pages, Shop and My Kabinet use clean product photography from a product catalogue that will be chosen later. A social thumbnail is never a product image; the import never sets `productId`. The relationship is relational, in this order: social video → saved → *user chooses* "Turn into routine" → routine → identified product references → canonical products → product photography → My Kabinet.

## Auth (v3 — account-bound)

Every row belongs to a signed-in account (`import_inbox.user_id`). Two credentials are accepted:

- **The user's session JWT** — the web app (`Authorization: Bearer <jwt>`), verified server-side with `auth.getUser()`.
- **A device token** `kbt_` + 32–64 url-safe characters — the iPhone Shortcut. Tokens are **minted by the server** for a signed-in user and stored only as a SHA-256 in `import_tokens` (user_id, label, last_used_at, revoked_at). Send as `Authorization: Bearer kbt_…` (also accepted: `x-kabinet-token` header, or `token` in the POST body). A revoked or unknown token gets 401 with a human `message` telling the person to reconnect in Settings.

The Shortcut obtains its token by **pairing**: the app asks `POST /import/pairings` (session) for a 6-character code (alphabet without 0/O/1/I, valid 10 minutes, one live code per account); the Shortcut's first run asks the person for that code and calls `POST /import/pair { code }` → `{ token, message }`, then stores the token in its own iCloud Drive file (`Shortcuts/KABINET/connection.txt`). "Connected" in the app means the code was redeemed (`import_pairings.consumed_at`); "last save" is `import_tokens.last_used_at`. Installation on the phone itself is not detectable and is never claimed.

Disconnecting (Settings → Save to KABINET → Disconnect) sets `revoked_at` on the account's tokens through RLS; the Shortcut then asks for a new code on its next run.

The function is deployed with Supabase JWT verification **off** because the Authorization header may carry a device token; JWTs are verified inside the function. The service-role key never leaves the function.

## POST — share a link

```json
{ "url": "https://www.tiktok.com/@creator/video/7312345678901234567", "source": "ios-shortcut" }
```

| Status | Meaning |
|---|---|
| 201 | Stored. Body: `{ ok, duplicate:false, item, message }` — `message` is written for Shortcuts’ Show Result. |
| 200 | Already shared with this token (`duplicate:true`, existing `item`). |
| 400 | No `url`, or body is not JSON. |
| 401 | Missing or malformed token. |
| 413 | Body over 8 KB. |
| 422 | Not a TikTok, Instagram or YouTube link. |
| 429 | More than 60 imports in the last hour for this token. |
| 503 | Service role key not configured on the function. |

Server-side metadata uses the platforms' public oEmbed endpoints only (TikTok, YouTube). Instagram exposes nothing without an approved Meta app, so the row keeps the link and an honest `access_note`. No scraping, no transcripts, no model calls.

### Web paste (same pipeline)

`SaveSheet` posts pasted links here with `source: "web-paste"`, previews the returned item, and on Save stores it locally and acknowledges the row (PATCH `imported`). Closing the sheet without saving acknowledges it as `failed` so the background sync does not import it later; sharing the same link again revives that row. Without `VITE_SUPABASE_URL` the browser adapters (`src/lib/social/adapters.ts`) do the same oEmbed fetch client-side.

## GET — what the phone shared

`GET /functions/v1/import?status=pending` → `{ items: InboxRow[] }` (max 50, oldest first). Fields: `id, source, url, canonical_url, platform, source_id, vertical, title, caption, creator_name, creator_url, thumbnail_url, thumbnail_w, thumbnail_h, embed_url, access_note, status, error, created_at, imported_at`.

## PATCH — acknowledge

```json
{ "ids": ["…"], "status": "imported" }
```
or `{ "ids": ["…"], "status": "failed", "error": "…" }`. Rows are only ever updated for the calling token.

## App side

- `src/lib/social/inbox.ts` — token, endpoint, `fetchInbox`, `ackInbox`.
- `src/lib/social/useInboxSync.ts` — mounted in `Shell`: pulls on load, on tab focus/visibility, and on “Check now”; converts rows into saves (thumbnail as `url` image, tone tile when there is none, category guessed from the caption, platform metadata preserved) and acknowledges them. Failures are logged and retried on the next trigger, never shown in the feed.
- Enabled only when `VITE_SUPABASE_URL` is set (`.env.local`).

## iPhone Shortcut (Share Sheet)

One universal Shortcut for every customer, generated and signed on a Mac by `node scripts/build-shortcut.mjs` → `public/shortcuts/Save to KABINET.shortcut` (signed with `shortcuts sign --mode anyone`, so iPhones accept it without "untrusted" warnings). It embeds only the public endpoint. Steps inside it:

1. Get File `KABINET/connection.txt` (Shortcuts' iCloud Drive folder, no error if missing).
2. If missing → Ask for Input ("Enter the 6-character code shown in KABINET") → `POST /import/pair` → save the returned token to that file. If the code is refused, show the server's message and stop.
3. `POST /import` with `Authorization: Bearer <token>`, JSON `{ url: Shortcut Input, source: "ios-shortcut" }`.
4. Show Notification with the server's `message` ("Saved to KABINET: …", "Already in your Kabinet", or "…reconnect in Settings").

Distribution: `VITE_SHORTCUT_ICLOUD_URL` (an iCloud share link created once from an iPhone: Shortcuts → share → Copy iCloud Link) is the smoothest "Add Shortcut" tap; without it the app links to the signed file, which Safari downloads and opens in Shortcuts. Rebuild + re-sign whenever the endpoint changes.

Not yet verified on a physical iPhone (no device in the build environment): the plist is lint-clean and signed, and the action identifiers/parameters follow Shortcuts' documented shapes, but the first on-device run should be checked before customers see it.

## Data

- `public.import_inbox` — RLS on; owners can **select/update** their own rows (`user_id = auth.uid()`), inserts only through the edge function. Unique `(user_id, canonical_url)` (plus the legacy `(token_hash, canonical_url)`). In the `supabase_realtime` publication so the onboarding first-save check can listen.
- `public.import_tokens` — owner select + update (revoke); minted only by the function.
- `public.import_pairings` — owner select; created/consumed only by the function. Realtime-published so the app sees the redemption instantly.
- `public.kabinet_profiles` — the account's onboarding step, worlds and intents (owner-only RLS, client upsert).

Migrations: `supabase/migrations/20260910_import_inbox.sql`, `import_inbox_video_fields`, `20260911_accounts_shortcut_tokens.sql`.

## Keep in sync

`supabase/functions/import/platform.ts` is a copy of `src/lib/social/platform.ts` (`npm run sync:edge`), so the server and the app agree on which URLs count.
