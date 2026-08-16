import { useMemo, useState } from 'react';
import { Plus, Trophy, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Bracket } from '@/components/tournament/Bracket';
import { AsyncBoundary, EmptyState, Skeleton } from '@/components/ui/States';
import { useAsync, useAction } from '@/hooks/useAsync';
import { usePlayerNames } from '@/hooks/usePlayerNames';
import { gameService } from '@/services/game.service';
import { navigate } from '@/stores/router.store';
import { toast } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import type { BracketSlot, Tournament } from '@/types';

const MAX_PLAYERS = 4;

export function TournamentScreen() {
  const user = useAuthStore((state) => state.user);
  const [preview, setPreview] = useState<Tournament | null>(null);

  const tournaments = useAsync<Tournament[]>((signal) => gameService.listTournaments(signal), []);

  const create = useAction(async () => {
    const created = await gameService.createTournament();
    // The creator is auto-added to `players` server-side, so this navigates
    // straight into the lobby without a separate join call.
    localStorage.setItem('activeTournamentId', created.tournamentId);
    navigate('dashboard/game/tournament/lobby');
  });

  const join = useAction(async (tournamentId: string) => {
    await gameService.joinTournament(tournamentId);
    localStorage.setItem('activeTournamentId', tournamentId);
    navigate('dashboard/game/tournament/lobby');
  });

  const handleCreate = async (): Promise<void> => {
    const result = await create.run();
    if (result === undefined && create.error) {
      toast.error('Could not create tournament', create.error);
    }
  };

  const handleJoin = async (tournament: Tournament): Promise<void> => {
    const result = await join.run(tournament.tournamentId);
    if (result === undefined && join.error) {
      toast.error('Could not join tournament', join.error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        description="Four players. Two semi-finals. One grand final."
        action={
          <Button
            onClick={handleCreate}
            loading={create.pending}
            icon={<Plus aria-hidden className="h-4 w-4" />}
          >
            Create tournament
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section aria-label="Open tournaments" className="rounded-xl border border-border bg-bg-card">
          <div className="border-b border-border p-5">
            <h3 className="font-heading text-sm font-bold text-content-primary">Open lobbies</h3>
          </div>

          <AsyncBoundary
            state={tournaments}
            onRetry={tournaments.reload}
            loading={
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            }
            isEmpty={(list) => list.length === 0}
            empty={
              <EmptyState
                icon={<Trophy aria-hidden className="h-5 w-5" />}
                title="No open tournaments"
                description="Create one and invite three friends to fill the bracket."
                action={
                  <Button size="sm" variant="secondary" onClick={handleCreate} loading={create.pending}>
                    Create tournament
                  </Button>
                }
              />
            }
          >
            {(list) => (
              <ul className="divide-y divide-border">
                {list.map((tournament) => {
                  const playerCount = tournament.players.length;
                  const isFull = playerCount >= MAX_PLAYERS;
                  const alreadyIn = tournament.players.some((p) => String(p) === String(user?.id));

                  return (
                    <li key={tournament.tournamentId}>
                      <div
                        className="flex w-full items-center gap-3 p-4 text-left transition-colors duration-hover hover:bg-bg-elevated"
                        onMouseEnter={() => setPreview(tournament)}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-amber/12 text-accent-amber">
                          <Trophy aria-hidden className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-heading text-sm font-bold text-content-primary">
                            {tournament.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-content-secondary">
                            <Users aria-hidden className="h-3 w-3" />
                            <span className="font-mono">
                              {playerCount}/{MAX_PLAYERS}
                            </span>
                            <Badge tone={tournament.status === 'waiting' ? 'green' : 'neutral'}>
                              {tournament.status}
                            </Badge>
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant={alreadyIn ? 'secondary' : 'primary'}
                          disabled={isFull && !alreadyIn}
                          loading={join.pending}
                          onClick={() => handleJoin(tournament)}
                        >
                          {alreadyIn ? 'Rejoin' : isFull ? 'Full' : 'Join'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </AsyncBoundary>
        </section>

        <section aria-label="Bracket preview" className="rounded-xl border border-border bg-bg-card p-5">
          <h3 className="mb-5 font-heading text-sm font-bold text-content-primary">
            {preview ? preview.title : 'Bracket preview'}
          </h3>
          <BracketPreview tournament={preview} meId={user?.id} />
          <p className="mt-5 text-xs text-content-muted">
            The live bracket, countdowns and match view are driven by the game service once the
            tournament starts.
          </p>
        </section>
      </div>
    </div>
  );
}

/**
 * `tournament.players` is a bare array of raw player-id strings — game-service
 * never joins user data — so names/avatars are resolved here the same way
 * legacy's `resolveUser` did.
 */
function BracketPreview({ tournament, meId }: { tournament: Tournament | null; meId: number | undefined }) {
  const players = usePlayerNames(tournament?.players ?? []);

  const slots = useMemo<BracketSlot[]>(() => {
    const ids = tournament?.players ?? [];

    const toPlayer = (index: number): BracketSlot['p1'] => {
      const id = ids[index];
      if (id === undefined) return null;

      const resolved = players[id];
      const mapped: NonNullable<BracketSlot['p1']> = {
        name: resolved?.name ?? `Player ${id.slice(0, 4)}`,
      };
      if (resolved?.avatar) mapped.avatar = resolved.avatar;
      if (meId !== undefined && String(id) === String(meId)) mapped.isMe = true;
      return mapped;
    };

    return [
      { id: 'semi-1', round: 'semi-1', label: 'Semi-final 1', p1: toPlayer(0), p2: toPlayer(1), status: 'pending' },
      { id: 'semi-2', round: 'semi-2', label: 'Semi-final 2', p1: toPlayer(2), p2: toPlayer(3), status: 'pending' },
      { id: 'final', round: 'final', label: 'Grand Final', p1: null, p2: null, status: 'pending' },
    ];
  }, [tournament, players, meId]);

  return <Bracket slots={slots} />;
}
