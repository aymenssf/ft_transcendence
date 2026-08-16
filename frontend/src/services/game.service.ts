import { env } from '@/lib/env';
import { http } from '@/lib/http';
import { toNumber } from '@/lib/format';
import type { Match, Tournament, UserStats } from '@/types';

/**
 * Game-service endpoints, proxied through nginx `location /tournaments/`.
 *
 * Note the doubled segment in the URLs (`/tournaments/tournaments/...`): nginx
 * strips `/tournaments/` and forwards the rest to game-service, which serves its
 * own `/tournaments` router. This is load-bearing, not a typo.
 *
 * Every shape below is read directly from the game-service source
 * (services/game-service/src/game/tournament.ts,
 * services/game-service/src/route/gameModelRoutes.ts,
 * services/game-service/src/model/gameModels.ts) — not inferred from grepped
 * URLs. An earlier pass here guessed field names from the chat/friends
 * pattern and every guess was wrong (tournamentId vs id, players as plain id
 * strings vs objects, p1/p2 vs player1Id/player2Id, ...).
 */
export const gameService = {
  getStats(userId: number, signal?: AbortSignal): Promise<UserStats> {
    return http
      .get<RawStats>(`${env.gameApi}/matches/user/${userId}/stats`, signal)
      .then(normaliseStats);
  },

  /** Bare array of Prisma `Match` rows — not wrapped in `{ matches: [...] }`. */
  getMatches(userId: number, signal?: AbortSignal): Promise<Match[]> {
    return http
      .get<RawMatch[]>(`${env.gameApi}/matches/user/${userId}`, signal)
      .then((list) => list.map((raw) => normaliseMatch(raw, userId)));
  },

  /** Bare array; only WAITING tournaments are returned by the server. */
  listTournaments(signal?: AbortSignal): Promise<Tournament[]> {
    return http.get<Tournament[]>(`${env.gameApi}/tournaments`, signal);
  },

  getTournament(tournamentId: string, signal?: AbortSignal): Promise<Tournament> {
    return http.get<Tournament>(`${env.gameApi}/tournaments/${tournamentId}`, signal);
  },

  /**
   * Body is `{ title? }` — no `maxPlayers` (the bracket is hardcoded to 4 in
   * the join route). `playerId` is read from the JWT server-side, not the
   * body. The creator is auto-added to `players`, so no separate join call is
   * needed after creating.
   */
  createTournament(payload: { title?: string } = {}): Promise<{ message: string; tournamentId: string }> {
    return http.post(`${env.gameApi}/tournaments/create`, payload);
  },

  joinTournament(
    tournamentId: string,
  ): Promise<{ message: string; tournamentId: string; numPlayers: number }> {
    return http.post(`${env.gameApi}/tournaments/join`, { tournamentId });
  },

  leaveTournament(tournamentId: string): Promise<{ message: string }> {
    return http.post(`${env.gameApi}/tournaments/leave`, { tournamentId });
  },
};

interface RawStats {
  wins?: string | number;
  losses?: string | number;
  total?: string | number;
  winRate?: string | number;
  avgScore?: string | number;
  elo?: string | number;
}

/** Prisma `Match` row, verbatim — see prisma/schema.prisma `model Match`. */
interface RawMatch {
  id?: number;
  gameId?: string;
  p1?: string | null;
  p2?: string | null;
  status?: string;
  mode?: string;
  difficulty?: string | null;
  winner?: string | null;
  p1Score?: number;
  p2Score?: number;
  createdAt?: string;
}

/**
 * The stats endpoint returns numeric fields as strings, and `winRate` as a
 * 0-100 percentage (`getUserStats` in gameModels.ts does `wins/total*100`).
 * Normalise to a fraction so `percent()` always renders correctly.
 */
function normaliseStats(raw: RawStats): UserStats {
  const wins = toNumber(raw?.wins);
  const losses = toNumber(raw?.losses);
  const total = toNumber(raw?.total, wins + losses);

  let winRate = toNumber(raw?.winRate, total > 0 ? wins / total : 0);
  if (winRate > 1) winRate = winRate / 100;

  const stats: UserStats = {
    wins,
    losses,
    total,
    winRate,
    avgScore: toNumber(raw?.avgScore),
  };

  // ELO is not currently emitted by any backend route. Only surface it when the
  // field genuinely arrives, so the UI can show "—" rather than a fake 0.
  if (raw?.elo !== undefined && raw.elo !== null) stats.elo = toNumber(raw.elo);

  return stats;
}

/**
 * `p1`/`p2`/`winner` are raw player-id strings — game-service never joins user
 * data. Resolve display names in the UI via `usePlayerNames`.
 */
function normaliseMatch(raw: RawMatch, userId: number): Match {
  const userIdStr = String(userId);
  const isPlayer1 = String(raw.p1) === userIdStr;

  const scoreSelf = toNumber(isPlayer1 ? raw.p1Score : raw.p2Score);
  const scoreOpponent = toNumber(isPlayer1 ? raw.p2Score : raw.p1Score);
  const opponentId = String(isPlayer1 ? raw.p2 : raw.p1);

  let result: Match['result'] = 'draw';
  if (raw.winner !== undefined && raw.winner !== null) {
    result = String(raw.winner) === userIdStr ? 'win' : 'loss';
  } else if (scoreSelf !== scoreOpponent) {
    result = scoreSelf > scoreOpponent ? 'win' : 'loss';
  }

  const match: Match = {
    id: raw.id ?? raw.gameId ?? `${raw.p1}-${raw.p2}-${raw.createdAt ?? ''}`,
    opponentId,
    result,
    scoreSelf,
    scoreOpponent,
    playedAt: raw.createdAt ?? '',
  };

  if (raw.mode) match.mode = raw.mode as Match['mode'];

  return match;
}
