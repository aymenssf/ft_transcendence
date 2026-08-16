/**
 * Runtime endpoints.
 *
 * Vite bakes `import.meta.env` at BUILD time, but docker-compose supplies
 * `env_file` at RUN time — so `VITE_*` values are empty inside the container
 * unless they are passed as build args. Every default here is therefore a
 * same-origin relative path, which is exactly what the immutable `nginx.conf`
 * already proxies. Env vars act purely as overrides for non-nginx setups.
 *
 * nginx.conf route map (do not drift from this):
 *   /api/         -> auth-service:3010
 *   /chat/        -> chat-service:3011   (HTTP API + Socket.IO)
 *   /tournaments/ -> game-service:3012
 *   /ws           -> game-service:3012   (raw WebSocket)
 *   /avatar/      -> auth-service:3010
 */

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

export const env = {
  /** Auth service, proxied. Used for login, profile, avatar upload, 2FA. */
  authApi: str(import.meta.env.VITE_AUTH_API_URL, '/api'),

  /** Chat service HTTP API. Owns friends, blocks, rooms and messages. */
  chatApi: str(import.meta.env.VITE_CHAT_API_URL, '/chat/api'),

  /** Game service HTTP API. Owns tournaments and match history. */
  gameApi: str(import.meta.env.VITE_GAME_API_URL, '/tournaments'),

  /** Socket.IO path for the chat service. Matches nginx `location /chat/`. */
  chatSocketPath: str(import.meta.env.VITE_CHAT_SOCKET_PATH, '/chat/socket.io'),

  /** Socket.IO origin — same-origin by default. */
  get chatSocketUrl(): string {
    const configured = import.meta.env.VITE_CHAT_SOCKET_URL;
    if (typeof configured === 'string' && configured.length > 0) return configured;
    return `${window.location.protocol}//${window.location.host}`;
  },

  isDev: import.meta.env.DEV,
} as const;

/** localStorage keys, centralised so the legacy modules and the new app agree. */
export const STORAGE_KEYS = {
  /** Read directly by game_soket.ts, game_shared.ts and friend_invite_handler.ts. */
  token: 'jwt_token',
  /** Written by auth-42-intra.ts on OAuth callback. */
  user: 'user_data',
  sidebarCollapsed: 'ui:sidebar-collapsed',
} as const;
