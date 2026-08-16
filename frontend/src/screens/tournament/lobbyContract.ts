/**
 * The tournament lobby's DOM, as a single raw HTML string.
 *
 * Unlike the match screens, almost the whole lobby is ceded to
 * `game_tournament_handler.ts`: it toggles `hidden`/`flex` classes on the two
 * view containers, rewrites `#big-bracket-content`, `#lobby-main-area` and
 * `#ready-overlay` with innerHTML, and dereferences the player nodes with
 * non-null assertions. Rendering any of it as React elements would mean React
 * resetting classes legacy had just toggled.
 *
 * So: React owns the page frame, this string owns everything inside it.
 * Tailwind still picks these classes up — its scanner reads raw file text, and
 * this file matches the `content` glob.
 *
 * Required ids (all dereferenced by the legacy module):
 *   view-bracket (+ a descendant h1), big-bracket-content, bracket-timer,
 *   view-game, game-round-label, game-p1-avatar, game-p1-name,
 *   game-p2-avatar, game-p2-name, tournament-score, game-container,
 *   ready-overlay, lobby-main-area
 */
export function buildLobbyHtml(): string {
  return `
<!--
  The waiting placeholder lives INSIDE #lobby-main-area on purpose. The legacy
  module replaces this node's innerHTML wholesale with its VICTORY / ELIMINATED
  / CHAMPION panels, so the placeholder is removed for free at exactly the right
  moment. A sibling React placeholder would need a MutationObserver, and that
  observer would attach to null — sibling effects run in tree order, so a React
  sibling rendered before this block cannot see #lobby-main-area yet.
-->
<div id="lobby-main-area" class="min-h-[420px] w-full">
  <div class="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-bg-card px-6 py-16 text-center">
    <span class="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-amber/35 bg-accent-amber/10 text-accent-amber text-xl">⧗</span>
    <div>
      <h3 class="font-heading text-base font-bold text-content-primary">Waiting for players</h3>
      <p class="mt-1 max-w-sm text-sm text-content-secondary">The bracket is revealed automatically once four players have joined.</p>
    </div>
  </div>
</div>

<!-- Bracket reveal. showView/hideView toggle .hidden and .flex on this node. -->
<div id="view-bracket" class="hidden fixed inset-0 z-50 flex-col items-center justify-center gap-10 bg-[#06060c]/95 backdrop-blur-md p-6">
  <h1 class="font-heading text-4xl font-bold tracking-tight text-gradient">SEMI-FINALS</h1>
  <div id="big-bracket-content" class="flex items-center justify-center"></div>
  <div class="flex items-center gap-3 text-content-secondary">
    <span class="text-sm uppercase tracking-widest">Starting in</span>
    <span id="bracket-timer" class="font-mono text-3xl font-bold text-accent-cyan">8</span>
  </div>
</div>

<!-- Match view. Also toggled by showView/hideView. -->
<div id="view-game" class="hidden fixed inset-0 z-40 flex-col items-center justify-center gap-5 bg-bg-primary p-6">
  <div id="game-round-label" class="font-heading text-sm font-bold uppercase tracking-[0.2em] text-accent-amber">SEMI-FINAL</div>

  <div class="flex w-full max-w-4xl items-center justify-between gap-6 rounded-2xl border border-border bg-bg-card px-6 py-4">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <img id="game-p1-avatar" src="" alt="" class="h-11 w-11 shrink-0 rounded-full border border-border-accent object-cover" />
      <span id="game-p1-name" class="truncate font-heading text-sm font-bold text-content-primary"></span>
    </div>

    <div id="tournament-score" class="shrink-0 font-mono text-5xl font-bold tabular-nums text-content-primary">0 - 0</div>

    <div class="flex min-w-0 flex-1 flex-row-reverse items-center gap-3 text-right">
      <img id="game-p2-avatar" src="" alt="" class="h-11 w-11 shrink-0 rounded-full border border-border-accent object-cover" />
      <span id="game-p2-name" class="truncate font-heading text-sm font-bold text-content-primary"></span>
    </div>
  </div>

  <div class="relative aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-2xl border border-border-accent bg-[#06060c] shadow-glow-violet">
    <!-- Ceded: legacy clears this and appends <canvas id="game-canvas">. -->
    <div id="game-container" class="absolute inset-0"></div>

    <!-- Ceded: legacy sets style.display and rewrites innerHTML (may inject #final-ready-btn). -->
    <div id="ready-overlay" class="absolute inset-0 hidden items-center justify-center bg-[#06060c]/85 backdrop-blur-sm"></div>
  </div>

  <p class="text-xs text-content-muted">Use <kbd class="rounded border border-border-accent bg-bg-secondary px-1.5 py-0.5 font-mono">W</kbd> and <kbd class="rounded border border-border-accent bg-bg-secondary px-1.5 py-0.5 font-mono">S</kbd> to move</p>
</div>
`;
}
