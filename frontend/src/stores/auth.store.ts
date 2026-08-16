import { create } from 'zustand';
import { STORAGE_KEYS } from '@/lib/env';
import { authService } from '@/services/auth.service';
import type { User } from '@/types';

/** Auth-42-intra.ts writes `user_data` as JSON on OAuth callback. */
function readStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && 'id' in parsed) return parsed as User;
    return null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'anonymous';
  error: string | null;

  hydrate: () => void;
  setUser: (user: User) => void;
  patchUser: (patch: Partial<User>) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  status: 'idle',
  error: null,

  hydrate: () => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    const user = readStoredUser();
    set({
      token,
      user,
      status: token && user ? 'authenticated' : 'anonymous',
      error: null,
    });
  },

  setUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    set({ user, status: 'authenticated' });
  },

  patchUser: (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(next));
    set({ user: next });
  },

  /** Re-reads the profile from auth-service so avatar/username stay in sync. */
  refresh: async () => {
    const current = get().user;
    if (!current) return;
    try {
      const fresh = await authService.getUser(current.id);
      if (fresh && typeof fresh.id === 'number') {
        localStorage.setItem(STORAGE_KEYS.user, JSON.stringify({ ...current, ...fresh }));
        set({ user: { ...current, ...fresh } });
      }
    } catch {
      // Keep the cached profile — a stale username beats an empty shell.
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, token: null, status: 'anonymous', error: null });
  },
}));

/** Non-reactive accessor for effects and legacy bridges. */
export const currentUserId = (): number | null => useAuthStore.getState().user?.id ?? null;
