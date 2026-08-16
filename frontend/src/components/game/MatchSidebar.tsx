import { Bot, Swords, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AiDifficulty, MatchMode } from '@/screens/game/matchContract';

const DIFFICULTIES: readonly AiDifficulty[] = ['easy', 'medium', 'hard'];

/**
 * AI difficulty selector.
 *
 * The wrapper id is `ai_butin` — misspelled in the legacy source, and
 * `createAIGameListener` adds `disabled-div` to that exact id once the match is
 * joined. Do not "fix" the spelling. See DOM_CONTRACT.md.
 */
export function DifficultyPicker({
  value,
  onChange,
  disabled,
}: {
  value: AiDifficulty;
  onChange: (value: AiDifficulty) => void;
  disabled: boolean;
}) {
  return (
    <div id="ai_butin" className="rounded-xl border border-border bg-bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-secondary">
        Difficulty
      </p>
      <div role="radiogroup" aria-label="AI difficulty" className="grid grid-cols-3 gap-2">
        {DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            disabled={disabled}
            onClick={() => onChange(level)}
            className={cn(
              'rounded-lg border px-2 py-2 text-xs font-semibold capitalize',
              'transition-colors duration-hover ease-out disabled:cursor-not-allowed disabled:opacity-50',
              value === level
                ? 'border-accent-primary bg-accent-primary/12 text-accent-primary'
                : 'border-border bg-bg-secondary text-content-secondary hover:border-border-accent hover:text-content-primary',
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MatchPanel({
  mode,
  joined,
  isInviteMatch = false,
  searchState,
  onJoin,
}: {
  mode: MatchMode;
  joined: boolean;
  /** Arrived from an accepted friend invite: the server pairs us, we only wait. */
  isInviteMatch?: boolean;
  searchState: string;
  onJoin: () => void;
}) {
  const Icon = mode === 'ai' ? Bot : mode === 'remote' ? Swords : Users;

  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/12 text-accent-primary">
          <Icon aria-hidden className="h-4 w-4" />
        </span>
        <div>
          <p className="font-heading text-sm font-bold text-content-primary">
            {isInviteMatch ? 'Friendly match' : mode === 'remote' ? 'Matchmaking' : 'Match'}
          </p>
          {mode === 'remote' && joined && !isInviteMatch ? (
            <p className="font-mono text-xs text-content-secondary">{searchState || 'Searching…'}</p>
          ) : null}
        </div>
      </div>

      {isInviteMatch ? (
        <p className="text-sm text-content-secondary">
          Your opponent invited you directly — the server is setting the match up. The Start button
          unlocks in a moment.
        </p>
      ) : joined ? (
        <p className="text-sm text-content-secondary">
          {mode === 'remote'
            ? 'Looking for an opponent. The Start button unlocks once the server pairs you.'
            : 'Connected. Press Start below when you are ready.'}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-content-secondary">
            {mode === 'remote'
              ? 'Join the queue to be paired with a live opponent.'
              : 'Connect to the game server to begin.'}
          </p>
          <button
            type="button"
            onClick={onJoin}
            className={cn(
              'w-full rounded-xl bg-gradient-hero px-4 py-2.5 font-heading text-sm font-bold text-[#06060c]',
              'transition-all duration-hover ease-out hover:-translate-y-px hover:shadow-glow-violet',
            )}
          >
            {mode === 'remote' ? 'Find match' : 'Connect'}
          </button>
        </>
      )}
    </div>
  );
}

export function ControlsCard({ mode }: { mode: MatchMode }) {
  const rows =
    mode === 'local'
      ? [
          { player: 'Left paddle', keys: 'W / S' },
          { player: 'Right paddle', keys: '↑ / ↓' },
        ]
      : [{ player: 'Your paddle', keys: 'W / S' }];

  return (
    <div className="rounded-xl border border-border bg-bg-card p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-secondary">
        Controls
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.player} className="flex items-center justify-between text-sm">
            <span className="text-content-secondary">{row.player}</span>
            <kbd className="rounded-md border border-border-accent bg-bg-secondary px-2 py-1 font-mono text-xs text-content-primary">
              {row.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
