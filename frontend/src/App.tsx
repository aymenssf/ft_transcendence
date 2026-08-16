import { useEffect } from 'react';
import { initAuth42 } from './auth-42-intra.js';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { Toaster } from '@/components/ui/Toaster';
import { LoadingState } from '@/components/ui/States';
import { useAuthStore } from '@/stores/auth.store';
import { isPublicRoute, useRouterStore } from '@/stores/router.store';
import { useChatSocketConnection } from '@/hooks/useChatSocket';
import { useFriendInvites } from '@/hooks/useFriendInvites';
import { useEnsureGameSocket } from '@/hooks/useGameSocket';

import { HomeScreen } from '@/screens/landing/HomeScreen';
import { LoginScreen } from '@/screens/landing/LoginScreen';
import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { GameHub } from '@/screens/game/GameHub';
import { AiMatchScreen, LocalMatchScreen, RemoteMatchScreen } from '@/screens/game/MatchScreen';
import { TournamentScreen } from '@/screens/tournament/TournamentScreen';
import { TournamentLobby } from '@/screens/tournament/TournamentLobby';
import { ChatScreen } from '@/screens/chat/ChatScreen';
import { FriendsScreen } from '@/screens/friends/FriendsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';

export function App() {
  const status = useAuthStore((state) => state.status);
  const hydrate = useAuthStore((state) => state.hydrate);
  const refresh = useAuthStore((state) => state.refresh);

  const route = useRouterStore((state) => state.route);
  const navigate = useRouterStore((state) => state.navigate);
  const syncFromLocation = useRouterStore((state) => state.syncFromLocation);

  const authenticated = status === 'authenticated';

  /**
   * Boot: consume a 42 OAuth callback if one is in the URL, then hydrate from
   * localStorage. `initAuth42` writes jwt_token/user_data and strips the query
   * string itself, so hydrate must run after it resolves.
   */
  useEffect(() => {
    let cancelled = false;

    void initAuth42()
      .catch(() => null)
      .then((result) => {
        if (cancelled) return;
        hydrate();
        if (result) navigate('dashboard', { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [hydrate, navigate]);

  /** Keep the store in step with browser back/forward, including legacy pushes. */
  useEffect(() => {
    const onPopState = (): void => syncFromLocation();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [syncFromLocation]);

  /** Refresh the cached profile once per authenticated session. */
  useEffect(() => {
    if (authenticated) void refresh();
  }, [authenticated, refresh]);

  /** Route guard. */
  useEffect(() => {
    if (status === 'idle') return;
    if (!authenticated && !isPublicRoute(route)) navigate('home', { replace: true });
    if (authenticated && isPublicRoute(route)) navigate('dashboard', { replace: true });
  }, [authenticated, route, status, navigate]);

  // Global connections, mounted once for the whole session.
  useChatSocketConnection(authenticated);
  useFriendInvites(authenticated);
  useEnsureGameSocket();

  if (status === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary">
        <LoadingState label="Starting up…" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {authenticated ? (
        <AppShell>{renderRoute(route)}</AppShell>
      ) : route === 'login' ? (
        <LoginScreen />
      ) : (
        <HomeScreen />
      )}
      <Toaster />
    </ErrorBoundary>
  );
}

function renderRoute(route: string) {
  switch (route) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'dashboard/profile':
      return <ProfileScreen />;
    case 'dashboard/chat':
      return <ChatScreen />;
    case 'dashboard/friends':
      return <FriendsScreen />;
    case 'dashboard/settings':
      return <SettingsScreen />;
    case 'dashboard/game':
      return <GameHub />;
    case 'dashboard/game/ai':
      return <AiMatchScreen />;
    case 'dashboard/game/local':
      return <LocalMatchScreen />;
    case 'dashboard/game/remote':
    case 'dashboard/game/friend_game':
      return <RemoteMatchScreen />;
    case 'dashboard/game/tournament':
      return <TournamentScreen />;
    case 'dashboard/game/tournament/lobby':
      return <TournamentLobby />;
    default:
      return <DashboardScreen />;
  }
}
