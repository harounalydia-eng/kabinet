# Social video → routine: how it works and what it needs

## Flow
Paste link → `detectPlatform` (src/lib/social/platform.ts) → platform adapter (src/lib/social/adapters.ts)
→ `NormalizedSocialContent` → saved as a `Save` with `social` metadata → user taps **Turn into routine ✦**
→ `extractRoutine` (src/lib/routines/extract.ts) → `SocialTextExtractor` → provider chain
(src/lib/routines/textExtract.ts) → validated `RoutineDraft` → review → saved `Routine`.

Analysis runs only on that tap. Results (or misses) are cached on the save (`save.extraction`), so returning
to a save shows **Open routine** instead of re-running anything.

## What each platform gives the browser, legally, without keys
| Platform  | Metadata                          | Text for extraction | Transcript |
|-----------|-----------------------------------|---------------------|------------|
| TikTok    | public oEmbed: caption, creator, thumbnail | caption      | no         |
| YouTube   | public oEmbed: title, channel, thumbnail   | title only   | no (captions need the Data API + owner OAuth; auto-captions are not officially exposed) |
| Instagram | nothing without an approved Meta app       | none         | no         |

Scraping pages or downloading media is prohibited by all three platforms' terms and is not implemented.

## Extraction levels
1. **Existing text** — caption / title / description / transcript. Free. Rule-based extractor runs in the browser:
   numbered lists and imperative sentences become steps; brands only from a known list; product names never
   guessed; timings only when literally present ("10 minutes"); techniques only from a vocabulary.
2. **Audio transcription** — `TranscriptionProvider` interface exists; none connected (would require server-side
   media access the platforms do not grant).
3. Visual video analysis — deliberately not built.

## Connecting a server-side model (optional, better results on long captions)
1. Deploy `supabase/functions/extract-routine` (source in `../app/supabase/functions/extract-routine/`) to the
   KABINET Supabase project with `ANTHROPIC_API_KEY` set as a function secret.
2. The function must validate the model output against the strict schema before returning it; the browser
   validates again (`validateDraft`) before anything is stored.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
4. Because this app has no sign-in yet, the function should stay JWT-verified and this app needs auth before
   it can call it — otherwise the anon key would let anyone spend model calls. Rate-limit per user server-side.

## Web Share Target (future)
This app is not a PWA (no manifest, no service worker). Adding a manifest with `share_target` would let
TikTok/Instagram/YouTube's share sheets send links straight into `/?share=<url>` on Android and desktop Chrome;
iOS Safari does not support Web Share Target. The import path already accepts a bare URL, so that is the only
missing piece.
