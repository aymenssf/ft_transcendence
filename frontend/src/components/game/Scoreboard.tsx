import { Bot } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pad2 } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

/**
 * The designed scoreboard. Values are mirrored out of the hidden legacy score
 * element by `useLegacyScore`, so legacy keeps writing `"3 - 5"` into the DOM
 * node it owns while this renders the spec's `03 — 05` treatment.
 *
 * Left = the local user (`r-palyer`/`r-name`), right = the other player
 * (`opponent-avatar`/`opponent-name`) — this must match the physical DOM order
 * legacy's avatar-swap logic was built against. See MatchScreen.tsx and
 * DOM_CONTRACT.md.
 */
export function Scoreboard({
  leftName,
  leftAvatar,
  leftIsBot = false,
  leftIsSelf = false,
  rightName,
  rightAvatar,
  rightIsBot = false,
  rightIsSelf = false,
  leftScore,
  rightScore,
  live = false,
}: {
  leftName: string;
  leftAvatar?: string | undefined;
  leftIsBot?: boolean;
  /** Whether this slot currently holds the logged-in user's own identity. */
  leftIsSelf?: boolean;
  rightName: string;
  rightAvatar?: string | undefined;
  rightIsBot?: boolean;
  rightIsSelf?: boolean;
  leftScore: number | null;
  rightScore: number | null;
  live?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 rounded-2xl border border-border bg-bg-card px-6 py-4',
        live && 'border-accent-cyan/40 shadow-glow-cyan',
      )}
    >
      <PlayerTag name={leftName} avatar={leftAvatar} isBot={leftIsBot} isSelf={leftIsSelf} align="left" />

      <div className="flex shrink-0 items-center gap-3" role="status" aria-live="polite">
        <span className="font-mono text-5xl font-bold tabular-nums text-content-primary">
          {leftScore === null ? '00' : pad2(leftScore)}
        </span>
        <span aria-hidden className="font-mono text-3xl text-content-muted">
          —
        </span>
        <span className="font-mono text-5xl font-bold tabular-nums text-content-primary">
          {rightScore === null ? '00' : pad2(rightScore)}
        </span>
        <span className="sr-only">
          {leftName} {leftScore ?? 0}, {rightName} {rightScore ?? 0}
        </span>
      </div>

      <PlayerTag name={rightName} avatar={rightAvatar} isBot={rightIsBot} isSelf={rightIsSelf} align="right" />
    </div>
  );
}

function PlayerTag({
  name,
  avatar,
  isBot,
  isSelf,
  align,
}: {
  name: string;
  avatar?: string | undefined;
  isBot: boolean;
  isSelf: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      {isBot ? (
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-primary/40 bg-accent-primary/12 text-accent-primary"
        >
          <Bot className="h-5 w-5" />
        </span>
      ) : (
        <Avatar src={avatar} name={name} size="md" />
      )}

      <div className="min-w-0">
        <p
          className={cn(
            'flex items-center gap-1.5 truncate font-heading text-sm font-bold text-content-primary',
            align === 'right' && 'flex-row-reverse',
          )}
        >
          {name}
        </p>
        {isBot ? (
          <Badge tone="violet" className="mt-0.5">
            BOT
          </Badge>
        ) : isSelf ? (
          <p className="text-xs text-content-secondary">You</p>
        ) : null}
      </div>
    </div>
  );
}
