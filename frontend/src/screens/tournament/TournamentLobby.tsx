import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTournamentListener,
  setupTournamentGameListeners,
  cleanupTournamentMatch,
} from '../../game_tournament_handler.js';
import { setupTournamentNavigationHandlers, cleanupTournamentPage } from '../../game_shared.js';
import { initgameSocket } from '../../game_soket.js';
import { LegacyHtml } from '@/components/game/LegacyDom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/AppShell';
import { useAuthStore } from '@/stores/auth.store';
import { loadPage, navigate, useRouterStore } from '@/stores/router.store';
import { gameService } from '@/services/game.service';
import { toast } from '@/stores/ui.store';
import { buildLobbyHtml } from './lobbyContract';

/**
 * Tournament lobby.
 *
 * The entire match/bracket surface is ceded to `game_tournament_handler.ts` —
 * see lobbyContract.ts for why. This component's job is narrow:
 *   1. render the contract DOM once,
 *   2. attach the legacy listener with the right tournament id,
 *   3. tear down cleanly on unmount, including leaving the tournament.
 *
 * The tournament id is read from `activeTournamentId` in localStorage, which is
 * where the legacy module also looks (and which it clears on `popstate` and
 * `tournament_canceled`).
 */
export function TournamentLobby() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? 0;
  const params = useRouterStore((state) => state.params);

  const tournamentId = useMemo(
    () => params.get('id') ?? localStorage.getItem('activeTournamentId') ?? '',
    [params],
  );

  const [leaving, setLeaving] = useState(false);
  const lobbyHtml = useMemo(() => buildLobbyHtml(), []);
  const wired = useRef(false);

  useEffect(() => {
    if (userId === 0 || tournamentId === '' || wired.current) return;
    wired.current = true;

    initgameSocket();
    localStorage.setItem('activeTournamentId', tournamentId);

    // Legacy expects the contract nodes to already exist — LegacyHtml injects
    // them during its own mount effect, which runs before this one because it
    // is a child. Ordering here is load-bearing.
    const listener = createTournamentListener(userId, tournamentId, loadPage);
    setupTournamentGameListeners(listener);
    setupTournamentNavigationHandlers(userId, tournamentId, loadPage);

    return () => {
      cleanupTournamentMatch();
      cleanupTournamentPage();
      wired.current = false;
    };
  }, [userId, tournamentId]);

  const handleLeave = async (): Promise<void> => {
    setLeaving(true);
    try {
      if (tournamentId) await gameService.leaveTournament(tournamentId);
    } catch {
      // Leaving is best-effort; the server also drops us on disconnect.
    } finally {
      localStorage.removeItem('activeTournamentId');
      sessionStorage.removeItem('inTournamentLobby');
      setLeaving(false);
      navigate('dashboard/game/tournament');
    }
  };

  if (tournamentId === '') {
    return (
      <div>
        <PageHeader title="Tournament lobby" />
        <div className="rounded-xl border border-border bg-bg-card p-10 text-center">
          <p className="text-sm text-content-secondary">
            No active tournament. Join or create one to enter the lobby.
          </p>
          <Button className="mt-4" onClick={() => navigate('dashboard/game/tournament')}>
            Back to tournaments
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <PageHeader
        title="Tournament lobby"
        description="Stay on this page — leaving forfeits your place in the bracket."
        action={
          <div className="flex items-center gap-3">
            <Badge tone="amber" mono>
              #{String(tournamentId).slice(0, 8)}
            </Badge>
            <Button variant="danger" size="sm" onClick={handleLeave} loading={leaving}>
              Leave tournament
            </Button>
          </div>
        }
      />

      {/* Everything below is owned by game_tournament_handler.ts, including
          the waiting placeholder inside #lobby-main-area. */}
      <LegacyHtml html={lobbyHtml} />
    </div>
  );
}

/** Re-export so callers can surface join errors consistently. */
export async function joinTournamentAndEnter(tournamentId: string): Promise<void> {
  try {
    await gameService.joinTournament(tournamentId);
    localStorage.setItem('activeTournamentId', tournamentId);
    navigate('dashboard/game/tournament/lobby');
  } catch (error) {
    toast.error('Could not join tournament', error instanceof Error ? error.message : undefined);
  }
}
