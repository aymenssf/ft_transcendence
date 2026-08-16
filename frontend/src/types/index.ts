/** Shared domain types. Mirrors what the auth / chat / game services return. */

export type PresenceStatus = 'online' | 'offline' | 'in-game';

export interface User {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  usernameTournament?: string;
  is_42_user?: boolean;
  provider?: string;
  status?: PresenceStatus;
  /**
   * Not currently returned by any backend endpoint. The UI renders an em dash
   * when it is absent — see the ELO note in README-FRONTEND.md.
   */
  elo?: number;
  twoFactorEnabled?: boolean;
}

export interface UserStats {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  avgScore: number;
  elo?: number;
}

export type MatchResult = 'win' | 'loss' | 'draw';

/**
 * `opponentId` is the raw id string game-service stores on the match row
 * (`p1`/`p2` in the Prisma `Match` model) — the service never joins user data,
 * so there is no name/avatar here. Resolve those in the UI via
 * `usePlayerNames`, the same way legacy's `resolveUser` did.
 */
export interface Match {
  id: number | string;
  opponentId: string;
  result: MatchResult;
  scoreSelf: number;
  scoreOpponent: number;
  playedAt: string;
  mode?: 'local' | 'ai' | 'remote' | 'tournament';
  eloDelta?: number;
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'declined';
  created_at?: string;
  sender?: User;
  receiver?: User;
}

export interface ChatMessage {
  id: number | string;
  content: string;
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  type?: 'text' | 'game_invitation' | 'system';
  chatRoomId?: number;
  metadata?: string | Record<string, unknown>;
}

export interface ChatRoom {
  id: number;
  name: string;
  type: 'public' | 'private' | 'protected';
  members: Array<{ userId: number; role?: string; user?: User }>;
  created_at?: string;
  _count?: { members: number };
}

/** A private room flattened into the shape the conversation list renders. */
export interface Conversation {
  room: ChatRoom;
  peer: User | null;
  lastMessage: ChatMessage | null;
  unread: number;
}

export type TournamentStatus = 'waiting' | 'semifinals' | 'final' | 'finished' | 'canceled';

/**
 * Matches game-service's actual `Tournament` shape exactly
 * (services/game-service/src/utils/types.ts). `players` is a bare array of raw
 * player-id strings — there is no nested user object and no `maxPlayers`
 * field; the bracket size is hardcoded to 4 in the join route.
 */
export interface Tournament {
  tournamentId: string;
  title: string;
  status: TournamentStatus;
  players: string[];
  winner: string | null;
}

export type MatchSlotStatus = 'pending' | 'live' | 'done';

export interface BracketSlot {
  id: string;
  round: 'semi-1' | 'semi-2' | 'final';
  label: string;
  p1: { id?: number; name: string; avatar?: string; isMe?: boolean } | null;
  p2: { id?: number; name: string; avatar?: string; isMe?: boolean } | null;
  scoreP1?: number;
  scoreP2?: number;
  status: MatchSlotStatus;
  winnerId?: number;
}

/** Discriminant-free async envelope used by every data-fetching hook. */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
