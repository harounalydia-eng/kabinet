# KABINET — discovery & inspiration (V0)

Personal beauty intelligence, editorial discovery. Content is sharp, controls are soft.

- Visual source of truth: Figma `KABINET — UI/UX Design System v2` (`D0HBmkfZzQpvZG3XdY6DQN`). Semantic light/dark tokens and motion tokens in `src/index.css`.
- Stack: Vite · React 19 · TypeScript · Tailwind v4 · react-router. No backend in this build — saves, collections, the shelf and the beauty profile live on the device (IndexedDB / localStorage). Settings → Export/Import moves them.
- Routes: `/` For You (your world) · `/explore` · `/shop` · `/search?q&scope` · `/collections`, `/collections/:id` · `/s/:id` saved item · `/look/:id` Explore look · `/product/:id` · `/kabinet` shelf · `/routines`, `/routines/new`, `/routines/:id`, `/routines/:id/edit`, `/routines/:id/start` · `/profile` Beauty Profile · `/settings`.
- V1 loop: discover → save (images, videos, links, looks, products) → organize into collections → **Create routine ✦** (user-initiated only; `src/lib/routines/extract.ts` is the provider boundary — a look that lists steps becomes a draft deterministically, video/image analysis reports *unavailable* until a media provider is connected) → review/edit → save → Start routine (step-by-step, no network).
- Intelligence surfaces are honest entry points: contextual search filters real data; Ask KABINET, visual search and compatibility explain what they will do once a profile and check-ins are connected. Nothing personal is invented.

```sh
export PATH=$HOME/.local/node/bin:$PATH
npm run dev      # http://localhost:5174
npm run build
```

Device preview while developing: `/preview.html?w=393&h=852&path=/`.
