import { AnimatePresence, motion } from 'framer-motion';
import {
  Gamepad2,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/stores/ui.store';
import { useRouterStore, type Route } from '@/stores/router.store';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem {
  route: Route;
  label: string;
  icon: typeof LayoutDashboard;
  /** Routes that should also light this item up. */
  matches?: readonly string[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { route: 'dashboard', label: 'Home', icon: LayoutDashboard },
  {
    route: 'dashboard/game',
    label: 'Play',
    icon: Gamepad2,
    matches: ['dashboard/game/ai', 'dashboard/game/local', 'dashboard/game/remote', 'dashboard/game/friend_game'],
  },
  {
    route: 'dashboard/game/tournament',
    label: 'Tournament',
    icon: Trophy,
    matches: ['dashboard/game/tournament/lobby'],
  },
  { route: 'dashboard/chat', label: 'Chat', icon: MessageSquare },
  { route: 'dashboard/friends', label: 'Friends', icon: Users },
  { route: 'dashboard/profile', label: 'Profile', icon: User },
  { route: 'dashboard/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggle = useUiStore((state) => state.toggleSidebar);
  const route = useRouterStore((state) => state.route);
  const navigate = useRouterStore((state) => state.navigate);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('home');
  };

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-bg-secondary',
        'transition-[width] duration-panel ease-in-out',
        collapsed ? 'w-16' : 'w-[220px]',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        {collapsed ? (
          <div
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-hero font-heading text-sm font-bold text-[#06060c]"
          >
            ft
          </div>
        ) : (
          <span className="font-heading text-lg font-bold">
            <span className="text-gradient">ft_</span>
            <span className="text-content-primary">transcendence</span>
          </span>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = route === item.route || item.matches?.includes(route) === true;
          const Icon = item.icon;

          return (
            <li key={item.route}>
              <button
                type="button"
                onClick={() => navigate(item.route)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'group relative flex w-full items-center rounded-lg py-2.5 text-sm font-medium',
                  'transition-colors duration-hover ease-out',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                  isActive
                    ? 'bg-accent-primary/10 text-content-primary'
                    : 'text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-accent-primary shadow-glow-violet"
                  />
                ) : null}

                <Icon
                  aria-hidden
                  className={cn(
                    'h-[18px] w-[18px] shrink-0 transition-colors duration-hover',
                    isActive && 'text-accent-primary drop-shadow-[0_0_6px_rgba(108,99,255,0.8)]',
                  )}
                />

                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-1 border-t border-border p-2">
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          title={collapsed ? 'Log out' : undefined}
          className={cn(
            'flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-content-secondary',
            'transition-colors duration-hover ease-out hover:bg-accent-red/10 hover:text-accent-red',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3',
          )}
        >
          <LogOut aria-hidden className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-content-muted',
            'transition-colors duration-hover ease-out hover:bg-bg-elevated hover:text-content-primary',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <>
              <PanelLeftClose aria-hidden className="h-[18px] w-[18px] shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
