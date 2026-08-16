import { Crown, Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { BracketSlot, MatchSlotStatus } from '@/types';

const STATUS_TONE: Record<MatchSlotStatus, 'neutral' | 'cyan' | 'green'> = {
  pending: 'neutral',
  live: 'cyan',
  done: 'green',
};

const STATUS_LABEL: Record<MatchSlotStatus, string> = {
  pending: 'Pending',
  live: 'Live',
  done: 'Done',
};

/**
 * Four-player bracket on a plain CSS Grid — no bracket library.
 * Two semi-final columns feed a final column; connectors are drawn with
 * bordered pseudo-columns so the layout stays responsive from 1024px up.
 */
export function Bracket({
  slots,
  champion,
}: {
  slots: readonly BracketSlot[];
  champion?: { name: string; avatar?: string } | null;
}) {
  const semis = slots.filter((slot) => slot.round !== 'final');
  const final = slots.find((slot) => slot.round === 'final') ?? null;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[1fr_56px_1fr] items-center gap-y-6">
        <div className="flex flex-col gap-6">
          {semis.map((slot) => (
            <MatchSlot key={slot.id} slot={slot} />
          ))}
        </div>

        <Connector />

        <div className="flex flex-col gap-4">
          {final ? <MatchSlot slot={final} emphasis /> : <PlaceholderSlot label="Grand Final" />}
          {champion ? <ChampionCard name={champion.name} avatar={champion.avatar} /> : null}
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div aria-hidden className="relative h-full min-h-[180px]">
      <div className="absolute left-0 top-1/4 h-1/2 w-1/2 rounded-l-lg border-y border-l border-border-accent" />
      <div className="absolute right-0 top-1/2 h-px w-1/2 bg-border-accent" />
    </div>
  );
}

function MatchSlot({ slot, emphasis = false }: { slot: BracketSlot; emphasis?: boolean }) {
  const isLive = slot.status === 'live';

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-card p-4 transition-colors duration-hover ease-out',
        isLive
          ? 'animate-glow-pulse-cyan border-accent-cyan/50'
          : 'border-border hover:border-border-accent',
        emphasis && !isLive && 'border-accent-amber/35',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-content-secondary">
          {slot.label}
        </span>
        <Badge tone={STATUS_TONE[slot.status]}>{STATUS_LABEL[slot.status]}</Badge>
      </div>

      <div className="space-y-2">
        <PlayerRow
          player={slot.p1}
          score={slot.scoreP1}
          won={slot.status === 'done' && slot.winnerId !== undefined && slot.winnerId === slot.p1?.id}
        />
        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <span className="font-heading text-[10px] font-bold text-content-muted">VS</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <PlayerRow
          player={slot.p2}
          score={slot.scoreP2}
          won={slot.status === 'done' && slot.winnerId !== undefined && slot.winnerId === slot.p2?.id}
        />
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  score,
  won,
}: {
  player: BracketSlot['p1'];
  score?: number | undefined;
  won: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <div className="h-8 w-8 rounded-full border border-dashed border-border-accent" />
        <span className="text-sm text-content-muted">Awaiting player</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2 py-1.5',
        won && 'bg-accent-green/8',
        player.isMe && 'ring-1 ring-inset ring-accent-primary/40',
      )}
    >
      <Avatar src={player.avatar} name={player.name} size="xs" />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          won ? 'font-semibold text-accent-green' : 'text-content-primary',
        )}
      >
        {player.name}
        {player.isMe ? <span className="ml-1.5 text-xs text-accent-primary">you</span> : null}
      </span>
      {score !== undefined ? (
        <span className="font-mono text-sm font-bold tabular-nums text-content-primary">
          {score}
        </span>
      ) : null}
    </div>
  );
}

function PlaceholderSlot({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-accent bg-bg-card/50 p-6 text-center">
      <Trophy aria-hidden className="mx-auto h-5 w-5 text-content-muted" />
      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-content-muted">
        {label}
      </p>
    </div>
  );
}

function ChampionCard({ name, avatar }: { name: string; avatar?: string }) {
  return (
    <div className="rounded-xl border border-[#ffc400]/45 bg-[#ffc400]/8 p-5 text-center shadow-glow-gold">
      <Crown aria-hidden className="mx-auto h-6 w-6 text-[#ffc400]" />
      <p className="mt-2 text-xs font-bold uppercase tracking-widest text-[#ffc400]">Champion</p>
      <div className="mt-3 flex flex-col items-center gap-2">
        <Avatar src={avatar} name={name} size="lg" />
        <p className="font-heading text-lg font-bold text-content-primary">{name}</p>
      </div>
    </div>
  );
}
