# Frontend

React 18 + Vite 5 + TypeScript (strict) + Tailwind CSS 3 + Zustand + Framer Motion + Radix UI.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173, proxies to the local services
npm run build      # tsc --noEmit && vite build  ->  dist/
npm run typecheck
```

Docker (from the repo root): `docker compose up --build frontend-service` → https://localhost:8080

## Layout

```
src/
├── main.tsx                    entry
├── App.tsx                     route table, auth guard, global sockets
├── styles/
│   ├── index.css               design tokens, base layer, reduced-motion
│   └── legacy.css              restyles markup the legacy modules inject
├── lib/                        env, http client, cn, formatters
├── types/                      shared domain types
├── services/                   auth / chat / game HTTP layers
├── stores/                     zustand: auth, router, ui, presence
├── hooks/                      socket wrappers, useAsync, reduced-motion
├── components/
│   ├── ui/                     Button, Card, Avatar, Badge, Input, Modal, …
│   ├── layout/                 AppShell, Sidebar, TopBar, ErrorBoundary
│   ├── game/                   LegacyDom bridge, Scoreboard, MatchOverlay
│   ├── chat/  friends/  tournament/  dashboard/
└── screens/                    one directory per screen
```

The six modules named immutable in the brief stay at `src/` root, byte-for-byte
unchanged: `game_shared.ts`, `game_tournament_handler.ts`, `auth-42-intra.ts`,
`game_soket.ts`, `chat_soket.ts`, `friend_invite_handler.ts`. `game.ts` (the
canvas renderer they depend on) is also untouched.

## Read this before touching the Game or Tournament screens

**[DOM_CONTRACT.md](./DOM_CONTRACT.md)** is the authoritative spec for how the new
UI coexists with the legacy modules. Those modules are not pure logic — they
reach into the document by `id`, overwrite subtrees with `innerHTML`, call
`replaceChild` on buttons, and mutate inline styles.

The short version:

- Legacy owns certain DOM subtrees outright. React renders the element so the
  `id` exists, then never renders children into it.
- Where the design needed a different look than legacy's raw output (the score,
  the player slots), the contract element lives in a visually-hidden host and its
  value is mirrored into React state with a `MutationObserver`. Legacy writes,
  React repaints. See `components/game/LegacyDom.tsx`.
- Element ids include real misspellings from the legacy source — `r-palyer`,
  `serch`, `ai_butin`. They must stay misspelled.

## Deliberate decisions worth knowing

**No React Router.** The legacy modules call `history.pushState` themselves and
then invoke a `navigateCallback(path)` with slash-free paths like
`"dashboard/game/ai"`. A router that also owned history would fight them.
`stores/router.store.ts` exposes `loadPage(path)` with exactly the signature
legacy expects.

**No `StrictMode`.** Its double-invoked effects would register the legacy socket
listeners twice and run `cleanupGame` between mounts. The immutable modules
cannot be made idempotent.

**Same-origin relative URLs by default.** Vite inlines `import.meta.env` at
*build* time, but docker-compose supplies `env_file` at *run* time — so `VITE_*`
is empty inside the container unless passed as a build arg. Every endpoint
therefore defaults to a relative path that the immutable `nginx.conf` already
proxies (`/api`, `/chat/api`, `/tournaments`, `/ws`). See `.env.example` and the
`ARG` block in the `Dockerfile`.

**`chat_soket.ts` is not called.** It opens a raw WebSocket to a hardcoded
`ws://0.0.0.0:3011/socket.io`, which is neither proxied by nginx nor a valid
Socket.IO handshake. The old `main.ts` ignored it too and used Socket.IO
directly; `hooks/useChatSocket.ts` does the same. The file is preserved
unchanged as instructed. The wire protocol (emit `join-room` / `leave-room` /
`send-message`, receive **`message`**) was recovered from the deleted
`chat/chat.ts` and is tabulated in DOM_CONTRACT.md — these names are not
guessable and a wrong one fails silently.

**End-of-match overlay is legacy's.** `showGameOverOverlay` appends a
fixed-position element to `<body>`, injects its own keyframes, and auto-navigates
after 3s. A competing React result modal would stack two result screens, so
`legacy.css` restyles theirs instead. The pre-match WAITING / READY overlay *is*
ours (`components/game/MatchOverlay.tsx`).

**`.legacy-cta` uses `!important`.** `handleGameConfig` sets
`style.background = "#10b981"` inline on the start button after cloning it. The
`!important` in `legacy.css` is the only way to keep the design system's gradient
without editing the immutable module.

**No `manualChunks`.** The immutable `nginx.conf` sends `Cache-Control: no-store`
on every `.js` response, so vendor chunk splitting buys nothing in production —
the browser re-downloads everything each load regardless. That `no-store` policy
is a performance limitation we cannot fix from here.

**`noUnusedLocals` / `noUnusedParameters` are off.** The legacy modules carry
unused locals and TypeScript has no per-directory override. Everything that
affects type safety stays on via `strict`.

## ELO

No backend endpoint returns an ELO field today —
`/tournaments/matches/user/:id/stats` returns `wins`, `losses`, `total`,
`winRate` and `avgScore` only. The UI is built for it anyway: `EloBadge` and the
ELO stat tile read an optional `elo`, and render a muted em dash when it is
absent. Match rows do the same for `eloDelta`. Nothing is fabricated; the moment
the service starts sending the field, it appears.

## Accessibility

Focus rings are global and visible (`:focus-visible`, cyan, 2px). Dialogs,
dropdowns and the switch are Radix primitives, so focus trapping, escape-to-close
and ARIA wiring come for free. Interactive elements carry `aria-label` where the
text alone is not descriptive; the sidebar marks the active route with
`aria-current="page"`; the scoreboard is a `role="status"` live region with a
screen-reader-only readout. `prefers-reduced-motion: reduce` neutralises CSS
animation globally and is also read in JS by `useReducedMotion`.

## Verified

- `npm run typecheck` — clean, strict mode
- `npm run build` — clean
- `docker build` — image builds; document root verified
- Container served through the real `nginx.conf`: `/` → 200, deep route
  `/dashboard/game/ai` → 200 (SPA fallback), hashed JS and CSS assets → 200
- All 30 legacy DOM-contract ids present in the production bundle
- All legacy CSS classes survive Tailwind purge (safelisted)
