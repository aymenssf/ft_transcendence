/**
 * Per-mode DOM contract configuration.
 *
 * Every id here is read by `game_shared.ts`. Changing one silently breaks the
 * corresponding game mode at runtime — there is no build-time link between
 * these strings and the legacy module. See DOM_CONTRACT.md.
 */

export type MatchMode = 'local' | 'ai' | 'remote';

export interface MatchContract {
  mode: MatchMode;
  /** `sendMessage` type used to enter the queue. */
  joinMessage: string;
  /** Cloned + replaced by `handleGameConfig`. Must live in a ceded subtree. */
  startButtonId: string;
  /** `setupNavigationHandlers` binds click; listeners add `disabled-link`. */
  backButtonId: string;
  /** `handleGameUpdate` writes `"3 - 5"` here. */
  scoreElementId: string;
  isAI: boolean;
  isRemote: boolean;
  title: string;
  subtitle: string;
}

export const MATCH_CONTRACTS: Record<MatchMode, MatchContract> = {
  local: {
    mode: 'local',
    joinMessage: 'join_local',
    startButtonId: 'start-local-game',
    backButtonId: 'back-button',
    scoreElementId: 'local-score',
    isAI: false,
    isRemote: false,
    title: 'Local Match',
    subtitle: 'Two players, one keyboard. W / S on the left, arrows on the right.',
  },
  ai: {
    mode: 'ai',
    joinMessage: 'join_ai-opponent',
    startButtonId: 'start-ai-game',
    backButtonId: 'back-button-ai',
    scoreElementId: 'ai-score',
    isAI: true,
    isRemote: false,
    title: 'AI Match',
    subtitle: 'Face the machine. Use W / S to move your paddle.',
  },
  remote: {
    mode: 'remote',
    joinMessage: 'join_random',
    startButtonId: 'start-remote-game',
    backButtonId: 'back-button-remote',
    scoreElementId: 'remote-score',
    isAI: false,
    isRemote: true,
    title: 'Ranked Match',
    subtitle: 'Matched against a live opponent. Use W / S to move.',
  },
};

export type AiDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Sentinel opponent name for AI matches. The old `getaipage()` template never
 * actually wired `opponent-avatar`/`opponent-name` with ids at all (it used a
 * static, unlabelled div reading "PongBot 3000") — so there is no legacy
 * behaviour to match here beyond reusing its name. Any side whose mirrored
 * name equals this constant gets bot styling, checked by value rather than by
 * a fixed left/right position because `handleGameConfig`'s avatar swap can
 * move this sentinel to either side. See MatchScreen.tsx.
 */
export const BOT_NAME = 'PongBot 3000';

/** Placeholder the server hasn't overwritten yet; matches legacy's default. */
export const WAITING_OPPONENT = 'Waiting...';

/**
 * The opponent-slot placeholder for a mode, before any socket message resolves
 * a real opponent. Exported so `MatchScreen` can detect "still just the seed"
 * vs. "the real opponent arrived" without duplicating this mapping.
 */
export function getOpponentSeed(mode: MatchMode): string {
  if (mode === 'ai') return BOT_NAME;
  if (mode === 'remote') return WAITING_OPPONENT;
  return 'Player 2';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The interactive nodes legacy takes ownership of, as a raw HTML string.
 *
 * These cannot be React elements: `handleGameConfig` calls
 * `cloneNode(true)` + `replaceChild` on the start button, which would strand
 * React's reference to the original node. Injected once by `LegacyHtml`.
 *
 * `.legacy-cta` carries `background: … !important` (see legacy.css) so that the
 * inline `style.background = "#10b981"` legacy applies on ready cannot override
 * the design system's gradient.
 */
export function buildInteractiveHtml(contract: MatchContract): string {
  return `
    <div class="flex flex-wrap items-center justify-center gap-3">
      <button
        id="${contract.startButtonId}"
        type="button"
        class="legacy-cta"
      >Start match</button>
      <a
        id="${contract.backButtonId}"
        href="/dashboard/game"
        class="legacy-back"
      >Leave match</a>
    </div>
  `;
}

/**
 * Contract elements that legacy mutates but that we re-render ourselves from
 * mirrored values. Rendered into the visually-hidden host.
 *
 * `r-palyer`, `serch` and `ai_butin` are misspelled in the legacy source; the
 * spellings here must match it exactly.
 *
 * `r-palyer`/`r-name` MUST be seeded with the current user's own avatar/name,
 * not left empty. The recovered `getremotepage()` template did exactly this
 * server-side (`<img id="r-palyer" src="${this.user.avatar}">`), and
 * `handleGameConfig`'s left/right swap only has valid data to move when this
 * slot starts populated — leaving it empty is what caused the "inverted
 * player" bug: the swap fires whenever the server assigns the local user to
 * `paddles.right`, and with nothing in `r-palyer` to swap, the human's own
 * name/avatar goes blank on that side instead of moving correctly.
 *
 * `opponent-avatar`/`opponent-name` get a mode-specific placeholder so the
 * swap always has two valid sides to exchange, matching each mode's original
 * default text (`getremotepage()` seeded "Waiting..."):
 *   - local: "Player 2" (no server-known identity for the second local player)
 *   - ai: the bot sentinel, so it renders with bot styling from first paint
 *   - remote: "Waiting..." — replaced by `createRemoteGameListener` once
 *     `random_opponent_found` resolves the real opponent
 */
export function buildHiddenContractHtml(
  contract: MatchContract,
  self: { name: string; avatar: string },
): string {
  const opponentSeed = getOpponentSeed(contract.mode);

  // The score span is seeded EMPTY, not with "0 - 0". `useLegacyScore` regexes
  // this node, so a seeded score would read as a live match from first render —
  // which would make `matchStarted` true immediately and skip the SEARCHING and
  // READY overlays entirely. game_shared.ts only ever writes to this element,
  // never reads it, so leaving it blank is safe.
  return `
    <span id="${contract.scoreElementId}"></span>
    <img id="r-palyer" src="${escapeHtml(self.avatar)}" alt="${escapeHtml(self.name)}" />
    <span id="r-name">${escapeHtml(self.name)}</span>
    <img id="opponent-avatar" src="" alt="${escapeHtml(opponentSeed)}" />
    <span id="opponent-name">${escapeHtml(opponentSeed)}</span>
    <span id="serch">● Searching</span>
    <div id="matchmaking-status"></div>
  `;
}
