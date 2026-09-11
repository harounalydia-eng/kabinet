# KABINET — discovery & inspiration (V0)

Personal beauty intelligence, editorial discovery. Content is sharp, controls are soft.

- Visual source of truth: Figma `KABINET — UI/UX Design System v2` (`D0HBmkfZzQpvZG3XdY6DQN`). Semantic light/dark tokens and motion tokens in `src/index.css`.
- Entry rule (design system): **dark** (`--entry-bg` #0E0E0E, not the dark theme) = KABINET entering / processing — the launch (`index.html` boot paint + `src/components/Splash.tsx`, same clock), later the analysis and "ready" moments; **ivory** = the everyday product, every functional onboarding step included; **oxblood** = action and emphasis. The entry never shows copy, a spinner or progress: dark → K wakes (200ms) → name flickers in (1000ms) → hold → dissolve (520ms) → 200ms breath → welcome type.
- Stack: Vite · React 19 · TypeScript · Tailwind v4 · react-router · `@supabase/supabase-js`. Accounts (Supabase Auth, email code), the onboarding state and the Save-to-KABINET Shortcut connection live on the `kabinet` Supabase project; saves, collections, the shelf and the beauty profile still live on the device (IndexedDB / localStorage). Settings → Export/Import moves them.
- First run: `/welcome` → `/create` (email → 6-digit code; Apple/Google appear only when the provider is enabled on the project) → `/onboarding/worlds` → `/onboarding/intents` → `/onboarding/shortcut` → `/onboarding/connect` (add the signed Shortcut, pairing code, first save watched live) → `/onboarding/connected` → `/home`. Returning users resume the exact step stored in `kabinet_profiles`. Without `VITE_SUPABASE_*` keys the app runs device-only and skips the account step honestly.
- Shortcut: `node scripts/build-shortcut.mjs` regenerates and signs `public/shortcuts/Save to KABINET.shortcut` (macOS only). Details in `docs/IMPORT_API.md`.
- Routes: `/` For You (your world) · `/explore` · `/shop` · `/search?q&scope` · `/collections`, `/collections/:id` · `/s/:id` saved item · `/look/:id` Explore look · `/product/:id` · `/kabinet` shelf · `/routines`, `/routines/new`, `/routines/:id`, `/routines/:id/edit`, `/routines/:id/start` · `/profile` Beauty Profile · `/settings`.
- V1 loop: discover → save (images, videos, links, looks, products) → organize into collections → **Create routine ✦** (user-initiated only; `src/lib/routines/extract.ts` is the provider boundary — a look that lists steps becomes a draft deterministically, video/image analysis reports *unavailable* until a media provider is connected) → review/edit → save → Start routine (step-by-step, no network).
- Intelligence surfaces are honest entry points: contextual search filters real data; Ask KABINET, visual search and compatibility explain what they will do once a profile and check-ins are connected. Nothing personal is invented.

```sh
export PATH=$HOME/.local/node/bin:$PATH
npm run dev      # http://localhost:5174
npm run build
```

Device preview while developing: `/preview.html?w=393&h=852&path=/`.
