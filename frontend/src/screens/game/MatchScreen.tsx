import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  cleanupGame,
  setupGameListeners,
  setupNavigationHandlers,
  createLocalGameListener,
  createAIGameListener,
  createRemoteGameListener,
} from '../../game_shared.js';
import { initgameSocket, sendMessage } from '../../game_soket.js';
import {
  CanvasFrame,
  LegacyContractHost,
  LegacyHtml,
  useHasClass,
  useLegacyScore,
  useMirroredAttribute,
  useMirroredText,
} from '@/components/game/LegacyDom';
import { Scoreboard } from '@/components/game/Scoreboard';
import { ControlsCard, DifficultyPicker, MatchPanel } from '@/components/game/MatchSidebar';
import { MatchOverlay, type OverlayState } from '@/components/game/MatchOverlay';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/auth.store';
import { loadPage, useRouterStore } from '@/stores/router.store';
import {
  BOT_NAME,
  MATCH_CONTRACTS,
  WAITING_OPPONENT,
  buildHiddenContractHtml,
  buildInteractiveHtml,
  getOpponentSeed,
  type AiDifficulty,
  type MatchMode,
} from './matchContract';

/**
 * One screen serving all three non-tournament game modes.
 *
 * The lifecycle is dictated entirely by `game_shared.ts`:
 *   mount -> socket -> listeners -> navigation handlers -> join message
 *   unmount -> cleanupGame (which also tells the server we left)
 *
 * The join message is deliberately sent from an effect that runs AFTER the
 * legacy contract nodes are in the DOM, because `game_config` can arrive on the
 * very next tick and `handleGameConfig` dereferences those nodes immediately.
 */
export function MatchScreen({ mode }: { mode: MatchMode }) {
  const contract = MATCH_CONTRACTS[mode];
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? 0;

  /**
   * A `?room=` param means we arrived from an accepted friend invite.
   * `friend_invite_handler.ts` has already sent `accept_invite`, and the server
   * pairs both players itself — so this screen must NOT send `join_random`,
   * which would drop the player into the queue with a stranger. It just waits
   * for `game_config`.
   */
  const roomId = useRouterStore((state) => state.params.get('room'));
  const isInviteMatch = roomId !== null && roomId !== '';

  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [joined, setJoined] = useState(isInviteMatch);
  const joinedRef = useRef(isInviteMatch);

  const interactiveHtml = useMemo(() => buildInteractiveHtml(contract), [contract]);
  const hiddenHtml = useMemo(
    () => buildHiddenContractHtml(contract, { name: user?.username ?? 'You', avatar: user?.avatar ?? '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contract, user?.username, user?.avatar],
  );

  // Mirrored legacy state -> React state.
  const score = useLegacyScore(contract.scoreElementId);
  const opponentName = useMirroredText('opponent-name');
  const opponentAvatar = useMirroredAttribute('opponent-avatar', 'src');
  const selfName = useMirroredText('r-name');
  const selfAvatar = useMirroredAttribute('r-palyer', 'src');
  const searchState = useMirroredText('serch');
  const matchLeft = useHasClass(contract.backButtonId, 'disabled-link');

  const matchStarted = score.left !== null;
  // For remote mode the opponent slot starts on the "Waiting..." placeholder
  // and only becomes the real opponent once `random_opponent_found` resolves
  // it — check against the seed, not mere presence, since the slot is never
  // empty after the seeding fix.
  const opponentFound = contract.mode !== 'remote' || opponentName !== WAITING_OPPONENT;

  /**
   * Wire the legacy listeners exactly once per mount. `setupGameListeners`
   * registers its own teardown via `addCleanupListener`, which `cleanupGame`
   * drains — so the unmount path is a single call.
   */
  useEffect(() => {
    if (userId === 0) return;

    initgameSocket();

    const listener =
      contract.mode === 'ai'
        ? createAIGameListener(userId)
        : contract.mode === 'remote'
          ? createRemoteGameListener(userId)
          : createLocalGameListener(userId);

    setupGameListeners(
      listener,
      contract.scoreElementId,
      userId,
      loadPage,
      contract.isAI,
      contract.isRemote,
    );

    setupNavigationHandlers(userId, contract.backButtonId, loadPage);

    return () => {
      cleanupGame(userId);
      joinedRef.current = false;
    };
  }, [userId, contract]);

  const join = (): void => {
    if (joinedRef.current || userId === 0) return;
    joinedRef.current = true;
    setJoined(true);

    sendMessage(contract.joinMessage, contract.mode === 'ai' ? { difficulty } : {});
  };

  const overlayState: OverlayState = !joined
    ? 'idle'
    : matchStarted
      ? 'playing'
      : opponentFound
        ? 'ready'
        : 'searching';

  // The r-palyer DOM node renders on screen-LEFT, opponent-avatar on
  // screen-RIGHT — fixed, matching the physical DOM order of the recovered
  // getremotepage() template. What is NOT fixed is which identity currently
  // sits in which node: handleGameConfig's avatar swap exchanges their
  // contents whenever the server assigns the local user to paddles.right, so
  // that "my" identity tracks my actual canvas paddle side. `selfName` mirrors
  // whatever is currently in r-palyer — after a swap that can be the
  // opponent's name, not mine. So "which side is me" and "which side is the
  // bot" are both determined by comparing content, never by a fixed side.
  const leftLabel = selfName || user?.username || 'You';
  const rightLabel = opponentName || getOpponentSeed(contract.mode);
  const leftIsBot = leftLabel === BOT_NAME;
  const rightIsBot = rightLabel === BOT_NAME;
  const leftIsSelf = user?.username !== undefined && leftLabel === user.username;
  const rightIsSelf = user?.username !== undefined && rightLabel === user.username;

  return (
    <div className="relative">
      {/* Contract nodes legacy mutates; mirrored above, never shown directly. */}
      <LegacyContractHost html={hiddenHtml} />

      <PageHeader
        title={contract.title}
        description={contract.subtitle}
        action={
          matchLeft ? (
            <Badge tone="amber">Match in progress</Badge>
          ) : isInviteMatch ? (
            <Badge tone="green">Friendly match</Badge>
          ) : (
            <Badge tone={contract.mode === 'remote' ? 'cyan' : 'violet'}>
              {contract.mode === 'remote' ? 'Ranked' : contract.mode === 'ai' ? 'Practice' : 'Couch co-op'}
            </Badge>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Scoreboard
            leftName={leftLabel}
            leftAvatar={selfAvatar ?? user?.avatar}
            leftIsBot={leftIsBot}
            leftIsSelf={leftIsSelf}
            rightName={rightLabel}
            rightAvatar={opponentAvatar ?? undefined}
            rightIsBot={rightIsBot}
            rightIsSelf={rightIsSelf}
            leftScore={score.left}
            rightScore={score.right}
            live={matchStarted}
          />

          <div className="relative">
            <CanvasFrame />
            <AnimatePresence>
              {overlayState !== 'playing' ? (
                <MatchOverlay state={overlayState} mode={contract.mode} />
              ) : null}
            </AnimatePresence>
          </div>

          {/* Ceded subtree: legacy clones and rebinds the start button. */}
          <LegacyHtml html={interactiveHtml} className="legacy-actions" />
        </div>

        <aside className="space-y-4">
          {contract.mode === 'ai' ? (
            <DifficultyPicker
              value={difficulty}
              onChange={setDifficulty}
              disabled={joined}
            />
          ) : null}

          <MatchPanel
            mode={contract.mode}
            joined={joined}
            isInviteMatch={isInviteMatch}
            searchState={searchState}
            onJoin={join}
          />

          <ControlsCard mode={contract.mode} />
        </aside>
      </div>
    </div>
  );
}

/** Route wrappers, so the router table stays declarative. */
export const LocalMatchScreen = () => <MatchScreen mode="local" />;
export const AiMatchScreen = () => <MatchScreen mode="ai" />;
export const RemoteMatchScreen = () => <MatchScreen mode="remote" />;
