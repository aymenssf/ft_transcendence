# Legacy DOM Contract

The six modules listed as immutable in the rebuild brief are **not** pure logic. They reach into the
document by `id`, overwrite subtrees with `innerHTML`, replace nodes outright, and mutate inline
styles. Any framework that renders those same nodes will fight them.

This file is the authoritative list of what those modules require. **Every rule here is load-bearing.**
Breaking one produces a runtime failure with no build error and no console warning.

## The three rules

1. **Ceded subtree** — React renders the element (so the `id` exists) but *never* renders children into
   it and never re-renders it. Implemented as `<div id="…" />` with a stable `key` and no children.
   Legacy owns everything inside.
2. **Ceded attributes** — React renders the element once with initial values. Legacy then mutates
   `src` / `textContent` / `className` / `style`. React must never re-render that element with
   controlled values, or it will clobber legacy's writes on the next commit.
3. **Ceded node** — legacy calls `replaceChild`, destroying the DOM node React holds a reference to.
   The element must live inside a ceded subtree, or React's reconciler will hold a detached node and
   subsequent updates silently go nowhere.

---

## `game_shared.ts`

### Ceded subtrees

| Element | Written by | Behaviour |
|---|---|---|
| `#game-container` | `handleGameConfig` (`:428`), `cleanupGame` (`:38`), `cleanupTournamentPage` (`:683`) | Set to `''`, then a `<canvas id="game-id">` is appended. Sized from server config, styled inline. |

`cleanupGame` clears `#game-container` unconditionally. React must therefore treat it as empty at all
times — mounting the canvas is legacy's job, triggered by the `game_config` socket message.

### Ceded nodes (`cloneNode` + `replaceChild`)

`handleGameConfig:447-469` takes the start button by id, **clones it, replaces the original in the DOM**,
then binds its own click handler, rewrites `innerHTML` to `"✅ Ready - Click to Start!"`, sets
`disabled`, `style.background`, `style.cursor`, `style.opacity`.

| id | Screen |
|---|---|
| `start-local-game` | Game → Local |
| `start-ai-game` | Game → AI |
| `start-remote-game` | Game → Remote |

These buttons **cannot be React-controlled**. They are rendered inside a ceded subtree, as raw HTML,
once. React must not own their text, `disabled` state, or styling after mount.

### Ceded attributes

| id | Element | Mutated |
|---|---|---|
| `r-palyer` *(sic)* | `<img>` | `src`, `alt`, `className`, `style.opacity`, `style.borderColor` |
| `r-name` | text node | `textContent`, `className`, `style.color` |
| `opponent-avatar` | `<img>` | `src`, `alt`, `className`, `style.opacity`, `style.borderColor` |
| `opponent-name` | text node | `textContent`, `className`, `style.color` |
| `serch` *(sic)* | text node | `innerHTML` → `"● Online"`, `style.color` |
| `matchmaking-status` | any | `style.display = "none"` |
| `back-button`, `back-button-ai`, `back-button-remote` | any | `classList.add("disabled-link")` |
| `ai_butin` *(sic)* | any | `classList.add("disabled-div")` |

#### The avatar swap — what it actually does

`handleGameConfig:387-422` exchanges the *content* of `#r-palyer`/`#r-name` with
`#opponent-avatar`/`#opponent-name` whenever `String(userId) != String(paddles.left.playerId)` — i.e.
whenever the server has assigned the local user to `paddles.right` for this match. Both pairs must
already exist in the DOM when `game_config` arrives, or the swap silently half-applies.

**`#r-palyer`/`#r-name` and `#opponent-avatar`/`#opponent-name` are fixed screen positions, not fixed
identities.** The recovered `getremotepage()` template has `r-palyer` before `opponent-avatar` in
source order, so in an ordinary left-to-right flex row `r-palyer` is the LEFT slot and `opponent-avatar`
is the RIGHT slot — always, regardless of any swap. What the swap moves is *which player's data* sits in
each slot. The same template seeds `r-palyer`/`r-name` with the **logged-in user's own** avatar/username
server-side (`<img id="r-palyer" src="${this.user.avatar}">`), so by construction the LEFT slot starts
as "me". The swap's whole purpose is to keep "my identity" visually aligned with my actual canvas paddle
side: when I'm `paddles.right`, it relocates my data from the LEFT slot into the RIGHT slot (and the
opponent's data the other way), so my avatar always sits above the paddle I'm actually controlling.

Two consequences that are easy to get wrong:

1. **`#r-palyer`/`#r-name` must be seeded with the real logged-in user's avatar/username, not left
   empty.** The swap only has valid data to relocate if this slot starts populated — leaving it empty
   produces exactly the "inverted player" bug: the swap fires whenever the server assigns the user to
   `paddles.right`, and with nothing in `r-palyer` to move, the human's name/avatar goes blank on
   whichever slot it lands in instead of relocating correctly.
2. **After a swap, `r-palyer`'s mirrored value is not necessarily "the local user".** A React variable
   name like `selfName` bound to `#r-name` is a mirror of *whatever is currently in that DOM node*, which
   can be the opponent's name post-swap. Any "is this the logged-in user" check must compare the
   mirrored *value* against the known username, never assume it from which DOM id it came from. The same
   goes for bot detection in AI matches (below) — check content, never a fixed side.

The AI match page (`getaipage()`) never actually declared `id="r-palyer"`/`id="opponent-avatar"` at all —
it showed a static, unlabelled "PongBot 3000" div. So for AI mode there is no legacy behaviour to match
beyond reusing that name as the opponent-slot placeholder; `document.getElementById` simply returned
`null` there in the old app and the swap's null-checks (`if (rImg && lImg)`) no-opped. Once real ids are
rendered (as this rebuild does, uniformly across all three modes), the swap *does* fire for AI matches
too — so the bot's identity can end up in either slot depending on which paddle side the server assigns
the human. Badge whichever slot currently reads the bot sentinel name, not a fixed side.

Note the misspellings — `r-palyer`, `serch`, `ai_butin` are the literal ids in the source and must be
reproduced exactly.

### Score element

`handleGameUpdate(msg, scoreElementId)` writes `innerHTML = "3 - 5"` into the id passed by the caller
(default `local-score`). We pass an explicit id per screen. This element is a ceded subtree — the
scoreboard's visual chrome must wrap it, not live inside it.

### Global side-effects

- `showGameOverOverlay` appends `#game-over-overlay` to `document.body` with inline styles at
  `z-index: 9999`, injects a `<style>` into `<head>` with `fadeIn`/`slideDown`/`pulse`/`confetti`
  keyframes, and **auto-redirects after 3000ms** via `history.pushState` + `navigateCallback(path)`.
  The redirect target is `dashboard/game/${gameType}`.
- `setupNavigationHandlers` binds `popstate` and `beforeunload` on `window`, and a click handler on the
  back-button id it is given.
- Keyboard input is bound on `document` (`keydown`/`keyup`), W/S and Arrow keys.

**Consequence:** legacy owns the win/lose overlay for local/AI/remote games and owns the post-game
navigation. The design spec's custom result overlay would double up with it. We keep legacy's overlay
as the source of truth and style around it rather than competing.

---

## `game_tournament_handler.ts`

### Ceded subtrees

| Element | Behaviour |
|---|---|
| `#game-container` | Cleared, then `<canvas id="game-canvas">` appended — **note the different canvas id** vs. `game-id` in `game_shared.ts` |
| `#big-bracket-content` | `innerHTML` ← full bracket markup using `.card-base` |
| `#lobby-main-area` | `innerHTML` ← VICTORY / ELIMINATED / CHAMPION panels |
| `#ready-overlay` | `innerHTML` ← waiting text or a `#final-ready-btn` button; also `style.display` toggled `flex`/`none` |

### View toggling

`showView(id)` / `hideView(id)` add and remove the Tailwind classes `hidden` and `flex`:

| id | Role |
|---|---|
| `view-bracket` | Bracket reveal screen |
| `view-game` | Match screen |

Both must exist in the DOM simultaneously, start hidden, and be toggled *only* by legacy. React must
not control their visibility.

`#view-bracket` must contain an `<h1>` — `document.querySelector("#view-bracket h1")` is set to
`"GRAND FINAL"` with a non-null assertion at `:287`. **A missing `h1` throws.**

### Ceded attributes

| id | Element | Mutated |
|---|---|---|
| `game-p1-avatar`, `game-p2-avatar` | `<img>` | `src` — accessed with `!` non-null assertion, **must exist** |
| `game-p1-name`, `game-p2-name` | text | `textContent` — non-null assertion |
| `game-round-label` | text | `textContent` ← `"SEMI-FINAL"` / `"GRAND FINAL"` |
| `bracket-timer` | text | `textContent` ← countdown seconds |
| `tournament-score` | text | `textContent` ← `"3 - 5"` |

`#final-ready-btn` is created *by legacy inside* `#ready-overlay` and bound via `btn.onclick` after a
100ms `setTimeout`. It must be styleable by class only: `.btn-primary`.

### Global side-effects

- Binds `keydown`/`keyup` on `window` (not `document` — differs from `game_shared.ts`).
- Binds `popstate` on `window`.
- Calls `alert()` on `tournament_canceled`.
- `tournament_finish` navigates after 5000ms via `navigateCallback`.

---

## `friend_invite_handler.ts`

Appends a `.friend-invite-modal` element to `document.body` and queries inside it by id. Entirely
class-driven, so it is fully stylable from our stylesheet — but the class names are fixed:

```
.friend-invite-modal      .friend-invite-overlay    .friend-invite-content
.friend-invite-close      .friend-invite-header     .friend-invite-title
.friend-invite-body       .friend-invite-avatar     .friend-invite-message
.friend-invite-username   .friend-invite-text       .friend-invite-actions
.friend-invite-btn        .friend-invite-decline    .friend-invite-accept
.friend-invite-timer
```

Ids queried within: `#invite-accept-btn`, `#invite-decline-btn`, `#invite-close-btn`, `#invite-countdown`.
It also uses the Tailwind utility `text-3xl` inline, so Tailwind must not purge it — it is listed in
the safelist.

30-second auto-decline countdown. Clicking `.friend-invite-overlay` declines.

---

## `auth-42-intra.ts`

The only module with a clean seam. We call the static methods and skip `create42IntraButton`
(which builds its own DOM):

- `Auth42Handler.initiateLogin(redirectUrl)` — sets `window.location.href`
- `initAuth42()` — reads `?token=` / `?user=` from the URL, writes `jwt_token` + `user_data` to
  `localStorage`, strips the query string via `replaceState`

`create42IntraButton` is **not used** — our Landing screen renders its own button and calls
`initiateLogin` directly.

---

## `game_soket.ts` / `chat_soket.ts`

`game_soket.ts` is a clean singleton over a raw `WebSocket` to `/ws?token=…`. Wrapped by
`useGameSocket`. Note `addMessageListener` has no dedupe — every listener must be paired with
`removeMessageListener` on unmount or handlers stack up across route changes.

`chat_soket.ts` is **effectively dead code**: it opens a raw `WebSocket` to a hardcoded
`ws://0.0.0.0:3011/socket.io`, which is neither proxied by `nginx.conf` nor a valid Socket.IO
handshake. The real chat transport is Socket.IO connected to same-origin with
`path: '/chat/socket.io'`. We preserve `chat_soket.ts` untouched as instructed but do not call it;
`useChatSocket` uses Socket.IO, matching what the old `main.ts` actually did.

### Chat Socket.IO protocol

Recovered from the deleted `chat/chat.ts` — the only record of these names. Getting one wrong is
silent: messages go nowhere and nothing errors.

| Direction | Event | Payload |
|---|---|---|
| emit | `join-room` | `{ chatRoomId }` |
| emit | `leave-room` | `{ chatRoomId }` |
| emit | `send-message` | `{ chatRoomId, content }` |
| receive | **`message`** | `{ id, content, senderId, sender: { username, avatar }, timestamp \| created_at, type, chatRoomId, metadata }` |
| receive | `friend-status-change` | `{ userId, status }` |
| receive | `user-status-change` | `{ userId, status }` |
| receive | `friend-request` / `friend-request-sent` / `friend-request-updated` / `friend-added` | varies |
| receive | `room-created` / `room-deleted` | `{ roomId }` |

The inbound message event is **`message`**, not `new-message`. The author is nested under `sender`,
so it must be flattened before rendering.

---

## Friend-invite match flow

`friend_invite_handler.ts` sends `accept_invite` with `{ roomId, from }` over the **game** socket and
then calls the navigation callback with the room id. The server pairs both players itself and pushes
`game_config`.

The client must therefore **not** send `join_random` when a `?room=` query parameter is present — that
would enter the random matchmaking queue and pair the player with a stranger instead of their friend.
`MatchScreen` treats `?room=` as "already joined, wait for `game_config`".

The old `main.ts` never read `?room=` at all, and its `getFriendsgamePage()` wired
`start-local-game` / `join_local` / `local-score` handlers onto markup that declared
`start-remote-game` / `remote-score` — the ids and handlers did not match. That page was broken; this
rebuild does not reproduce the bug.

---

## Router constraint

Legacy calls `navigateCallback(path)` with **path strings that have no leading slash**:

```
"dashboard/game"   "dashboard/game/ai"   "dashboard/game/local"
"dashboard/game/remote"   "dashboard/game/tournament"   "home"
```

and independently calls `history.pushState({}, "", "/" + path)` *before* invoking the callback. It also
binds its own `popstate` listeners that call the same callback.

**This rules out React Router**, which would fight legacy for ownership of `history`. We use a small
custom router store whose `navigate(path)` accepts exactly this string shape and tolerates being
called after legacy has already pushed state. `stores/router.store.ts` exposes `loadPage(path)` with
the precise `(path: string) => void` signature legacy expects.

---

## Game-service HTTP API — verified against source, not guessed

This is not a legacy-DOM concern, but it belongs in the same "things that fail silently" document.
`services/game.service.ts`'s tournament and match-history functions were originally built from URL
strings grepped out of the old `main.ts`, with no reference client and no read of the backend handler —
unlike chat/friends, which were ported verbatim from the real, working `chat-api.ts`/`friends-api.ts`.
Every field name guessed that way (`id` vs `tournamentId`, `name` vs `title`, `player1Id` vs `p1`,
`opponent.username` vs a bare id string, `maxPlayers` which doesn't exist, `status: 'running'` which
isn't a real value...) was wrong, and each one failed silently or produced swapped scores/results rather
than an error. The actual shapes, read from
`services/game-service/src/game/tournament.ts`, `services/game-service/src/route/gameModelRoutes.ts`,
`services/game-service/src/model/gameModels.ts` and `services/game-service/prisma/schema.prisma`:

- `Tournament`: `{ tournamentId: string; title: string; status: 'waiting'|'semifinals'|'final'|'finished'|'canceled'; players: string[]; winner: string | null }`.
  `players` is a bare array of raw player-id strings — never a joined user object. Bracket size is
  hardcoded to 4 in the join route; there is no `maxPlayers` field.
- `POST /tournaments/create` body `{ title? }` (no `maxPlayers`), response `{ message, tournamentId }`,
  `201`. The creator is auto-added to `players` server-side — do not also call join after create.
- `POST /tournaments/join` body `{ tournamentId }` only — `playerId` comes from the JWT, not the body.
- `GET /tournaments` returns a bare array (only `waiting` tournaments); `GET /tournaments/:id` a bare
  object.
- Prisma `Match` row: `{ id, gameId, p1: string, p2: string, status, mode, difficulty, winner: string | null, p1Score, p2Score, createdAt }`.
  No nested opponent object, no `eloDelta`. `GET /matches/user/:id` returns a bare array of these.
- `GET /matches/user/:id/stats` returns `{ total, wins, losses, winRate, avgScore }` where `winRate` is a
  0–100 percentage, not a fraction — `game.service.ts` normalises it.

Since `players`/`p1`/`p2`/`winner` are raw ids with no joined user data, both the tournament bracket
preview and the match-history table resolve display names via `hooks/usePlayerNames.ts`, which mirrors
legacy's `resolveUser` pattern (call auth-service per id, cache, fall back to `Player <id prefix>` on
failure) rather than assuming the game-service ever supplies one.

The JWT signs `userId` from an INTEGER column but the `players` array is typed `string[]`, so runtime
values are numbers passed through JSON — compare with `String(a) === String(b)`, never `===` directly,
when matching a player id against `user.id`.

## CSS classes legacy depends on

Defined in `src/styles/legacy.css`, and safelisted in `tailwind.config.js` so purging cannot remove
them:

| Class | Used by |
|---|---|
| `.disabled-link` | `game_shared.ts` back buttons |
| `.disabled-div` | `game_shared.ts` AI difficulty selector |
| `.card-base` | `game_tournament_handler.ts` bracket cards |
| `.btn-primary` | `game_tournament_handler.ts` final-ready button |
| `.hidden` / `.flex` | `showView` / `hideView` (Tailwind core) |
| `.friend-invite-*` | `friend_invite_handler.ts` |

Legacy-injected markup also uses these Tailwind utilities, which are safelisted for the same reason:
`text-3xl`, `text-4xl`, `text-5xl`, `text-8xl`, `animate-pulse`, `text-emerald-400`, `text-red-400`,
`text-yellow-400`, `border-emerald-500`, `border-yellow-400`, `text-gray-300`, `text-gray-400`,
`text-gray-500`, `text-gray-700`, `border-gray-600`.
