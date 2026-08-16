import { create } from 'zustand';

/**
 * A deliberately small router.
 *
 * React Router is NOT used here. The immutable legacy modules own `history`
 * themselves: `game_shared.ts` and `game_tournament_handler.ts` call
 * `history.pushState(...)` and then invoke a `navigateCallback(path)` with a
 * LEADING-SLASH-FREE path ("dashboard/game/ai"), and they bind their own
 * `popstate` listeners. A router that also owned history would fight them.
 *
 * `loadPage` below matches the `(path: string) => void` signature legacy expects
 * and tolerates being called after legacy has already pushed the URL.
 * See DOM_CONTRACT.md § Router constraint.
 */

export type Route =
  | 'home'
  | 'login'
  | 'dashboard'
  | 'dashboard/profile'
  | 'dashboard/chat'
  | 'dashboard/friends'
  | 'dashboard/settings'
  | 'dashboard/game'
  | 'dashboard/game/ai'
  | 'dashboard/game/local'
  | 'dashboard/game/remote'
  | 'dashboard/game/tournament'
  | 'dashboard/game/tournament/lobby'
  | 'dashboard/game/friend_game';

export const ROUTES: readonly Route[] = [
  'home',
  'login',
  'dashboard',
  'dashboard/profile',
  'dashboard/chat',
  'dashboard/friends',
  'dashboard/settings',
  'dashboard/game',
  'dashboard/game/ai',
  'dashboard/game/local',
  'dashboard/game/remote',
  'dashboard/game/tournament',
  'dashboard/game/tournament/lobby',
  'dashboard/game/friend_game',
] as const;

export const PUBLIC_ROUTES: readonly Route[] = ['home', 'login'] as const;

/** Strip slashes and fall back to a known route. */
export function normalisePath(input: string): Route {
  const cleaned = input.replace(/^\/+/, '').replace(/\/+$/, '').split('?')[0] ?? '';
  if (cleaned === '') return 'home';
  const match = ROUTES.find((route) => route === cleaned);
  return match ?? 'home';
}

export function isPublicRoute(route: Route): boolean {
  return PUBLIC_ROUTES.includes(route);
}

interface RouterState {
  route: Route;
  /** Query params captured at navigation time, e.g. `?room=abc` for invites. */
  params: URLSearchParams;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  /**
   * Legacy entry point. Same signature legacy modules are handed as
   * `loadPageCallback` / `navigateCallback`. Does NOT touch history, because
   * legacy has already called `pushState` before invoking it.
   */
  loadPage: (path: string) => void;
  syncFromLocation: () => void;
}

export const useRouterStore = create<RouterState>((set, get) => ({
  route: normalisePath(window.location.pathname),
  params: new URLSearchParams(window.location.search),

  navigate: (path, options) => {
    const route = normalisePath(path);
    const url = `/${route}`;

    if (options?.replace) {
      window.history.replaceState({}, '', url);
    } else if (window.location.pathname !== url) {
      window.history.pushState({}, '', url);
    }

    if (get().route !== route) {
      set({ route, params: new URLSearchParams(window.location.search) });
    }
  },

  loadPage: (path) => {
    const route = normalisePath(path);
    set({ route, params: new URLSearchParams(window.location.search) });
  },

  syncFromLocation: () => {
    set({
      route: normalisePath(window.location.pathname),
      params: new URLSearchParams(window.location.search),
    });
  },
}));

/**
 * Stable, non-reactive navigate for use inside effects and legacy callbacks.
 * Reading through `getState` avoids adding the store as an effect dependency.
 */
export const navigate = (path: string, options?: { replace?: boolean }): void =>
  useRouterStore.getState().navigate(path, options);

export const loadPage = (path: string): void => useRouterStore.getState().loadPage(path);
