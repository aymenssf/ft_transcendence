import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MatchMode } from '@/screens/game/matchContract';

export type OverlayState = 'idle' | 'searching' | 'ready' | 'playing';

/**
 * Pre-match state overlay drawn over the canvas frame.
 *
 * Scope note: this covers WAITING / READY only. The end-of-match YOU WIN /
 * YOU LOSE overlay is produced by `game_shared.ts`'s `showGameOverOverlay`,
 * which appends its own fixed-position element to <body>, injects its own
 * keyframes, and auto-navigates after 3s. Rendering a competing React overlay
 * would stack two result screens, so we restyle theirs in legacy.css instead.
 * See DOM_CONTRACT.md § Global side-effects.
 */
export function MatchOverlay({ state, mode }: { state: OverlayState; mode: MatchMode }) {
  const content = getContent(state, mode);
  if (!content) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-[#06060c]/72 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-3 px-6 text-center"
      >
        {content.spinner ? (
          <Loader2 aria-hidden className="h-7 w-7 animate-spin text-accent-cyan" />
        ) : null}

        <p
          className={cn(
            'font-heading text-4xl font-bold tracking-tight',
            content.tone,
            state === 'ready' && 'animate-glow-pulse-cyan rounded-xl px-6 py-2',
          )}
        >
          {content.title}
        </p>

        {content.subtitle ? (
          <p className="max-w-xs text-sm text-content-secondary">{content.subtitle}</p>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

function getContent(
  state: OverlayState,
  mode: MatchMode,
): { title: string; subtitle?: string; tone: string; spinner?: boolean } | null {
  switch (state) {
    case 'idle':
      return {
        title: 'WAITING…',
        subtitle:
          mode === 'remote'
            ? 'Join the queue to find an opponent.'
            : 'Connect to the game server to begin.',
        tone: 'text-content-secondary',
      };
    case 'searching':
      return {
        title: 'SEARCHING…',
        subtitle: 'Pairing you with an available opponent.',
        tone: 'text-accent-cyan',
        spinner: true,
      };
    case 'ready':
      return {
        title: 'READY?',
        subtitle: 'Press Start below to begin the match.',
        tone: 'text-accent-green',
      };
    case 'playing':
      return null;
    default:
      return null;
  }
}
