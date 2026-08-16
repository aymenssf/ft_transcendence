import { useMemo, useState } from 'react';
import { ArrowUpDown, Swords } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, signedDelta } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { ResultBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { usePlayerNames } from '@/hooks/usePlayerNames';
import type { Match } from '@/types';

type SortKey = 'playedAt' | 'opponent' | 'result';

/** Sortable match history. Used by both the dashboard and the profile screen. */
export function MatchHistoryTable({
  matches,
  sortable = true,
  limit,
}: {
  matches: readonly Match[];
  sortable?: boolean;
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('playedAt');
  const [ascending, setAscending] = useState(false);

  // game-service never joins user data onto a match row (opponentId is a raw
  // id string) — resolve display names/avatars the same way legacy's
  // resolveUser did. See usePlayerNames.ts.
  const players = usePlayerNames(matches.map((m) => m.opponentId));
  const opponentLabel = (match: Match): string =>
    players[match.opponentId]?.name ?? `Player ${match.opponentId.slice(0, 4)}`;

  const rows = useMemo(() => {
    const sorted = [...matches].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'playedAt') {
        comparison = new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime();
      } else if (sortKey === 'opponent') {
        comparison = opponentLabel(a).localeCompare(opponentLabel(b));
      } else {
        comparison = a.result.localeCompare(b.result);
      }
      return ascending ? comparison : -comparison;
    });
    return limit === undefined ? sorted : sorted.slice(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, sortKey, ascending, limit, players]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Swords aria-hidden className="h-5 w-5" />}
        title="No matches yet"
        description="Play your first match and it will show up here."
      />
    );
  }

  const toggleSort = (key: SortKey): void => {
    if (!sortable) return;
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(false);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <HeaderCell
              label="Opponent"
              sortable={sortable}
              active={sortKey === 'opponent'}
              onClick={() => toggleSort('opponent')}
            />
            <HeaderCell
              label="Result"
              sortable={sortable}
              active={sortKey === 'result'}
              onClick={() => toggleSort('result')}
            />
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-secondary">
              Score
            </th>
            <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-secondary">
              ELO
            </th>
            <HeaderCell
              label="Date"
              sortable={sortable}
              active={sortKey === 'playedAt'}
              onClick={() => toggleSort('playedAt')}
            />
          </tr>
        </thead>

        <tbody>
          {rows.map((match) => {
            const name = opponentLabel(match);
            const avatar = players[match.opponentId]?.avatar;

            return (
            <tr
              key={String(match.id)}
              className="border-b border-border last:border-0 transition-colors duration-hover hover:bg-bg-elevated"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar src={avatar} name={name} size="xs" />
                  <span className="truncate font-medium text-content-primary">
                    {name}
                  </span>
                </div>
              </td>

              <td className="px-4 py-3">
                <ResultBadge result={match.result} />
              </td>

              <td className="px-4 py-3 font-mono tabular-nums text-content-primary">
                {match.scoreSelf} – {match.scoreOpponent}
              </td>

              <td
                className={cn(
                  'px-4 py-3 font-mono tabular-nums',
                  match.eloDelta === undefined
                    ? 'text-content-muted'
                    : match.eloDelta > 0
                      ? 'text-accent-green'
                      : match.eloDelta < 0
                        ? 'text-accent-red'
                        : 'text-content-secondary',
                )}
              >
                {signedDelta(match.eloDelta)}
              </td>

              <td className="px-4 py-3 text-content-secondary">{formatDate(match.playedAt)}</td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({
  label,
  sortable,
  active,
  onClick,
}: {
  label: string;
  sortable: boolean;
  active: boolean;
  onClick: () => void;
}) {
  if (!sortable) {
    return (
      <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-content-secondary">
        {label}
      </th>
    );
  }

  return (
    <th scope="col" className="px-4 py-3">
      <button
        type="button"
        onClick={onClick}
        aria-label={`Sort by ${label}`}
        className={cn(
          'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide',
          'transition-colors duration-hover hover:text-content-primary',
          active ? 'text-accent-primary' : 'text-content-secondary',
        )}
      >
        {label}
        <ArrowUpDown aria-hidden className="h-3 w-3" />
      </button>
    </th>
  );
}
