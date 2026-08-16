/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_CHAT_API_URL?: string;
  readonly VITE_GAME_API_URL?: string;
  readonly VITE_CHAT_SOCKET_URL?: string;
  readonly VITE_CHAT_SOCKET_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
