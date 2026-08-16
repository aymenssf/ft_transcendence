import { env, STORAGE_KEYS } from '@/lib/env';
import { http } from '@/lib/http';
import type { User } from '@/types';

/**
 * Auth-service endpoints, proxied through nginx `location /api/`.
 * The 42 OAuth handshake itself lives in the immutable `auth-42-intra.ts`.
 */
export const authService = {
  /** Current user, resolved by id. `/api/user/:id` -> auth-service `/user/:id`. */
  getUser(userId: number, signal?: AbortSignal): Promise<User> {
    return http.get<User>(`${env.authApi}/user/${userId}`, signal);
  },

  /** `/api/users/update` is mapped by nginx to auth-service `/user/update`. */
  updateProfile(payload: { username?: string; usernameTournament?: string }): Promise<User> {
    return http.post<User>(`${env.authApi}/users/update`, payload);
  },

  uploadAvatar(file: File): Promise<{ avatar: string }> {
    const form = new FormData();
    form.append('avatar', file);
    return http.upload<{ avatar: string }>(`${env.authApi}/upload-avatar`, form);
  },

  /**
   * 2FA. The auth-service exposes these under /2fa/*; if a given deployment has
   * not enabled the module the calls surface as a 404 and the Settings screen
   * shows an explicit "not available" state rather than a broken toggle.
   */
  enableTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    return http.post<{ qrCode: string; secret: string }>(`${env.authApi}/2fa/enable`);
  },

  verifyTwoFactor(code: string): Promise<{ success: boolean }> {
    return http.post<{ success: boolean }>(`${env.authApi}/2fa/verify`, { code });
  },

  disableTwoFactor(): Promise<{ success: boolean }> {
    return http.post<{ success: boolean }>(`${env.authApi}/2fa/disable`);
  },

  deleteAccount(): Promise<void> {
    return http.delete<void>(`${env.authApi}/user/delete`);
  },

  /** Best-effort server-side logout; local state is cleared regardless. */
  async logout(): Promise<void> {
    try {
      await http.post(`${env.authApi}/auth/42/logout`);
    } catch {
      // A failed logout call must never trap the user in a signed-in shell.
    } finally {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
    }
  },
};
