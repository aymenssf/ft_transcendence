import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/auth.store';
import { useRouterStore, type Route } from '@/stores/router.store';
import { useUiStore } from '@/stores/ui.store';

const TITLES: Partial<Record<Route, string>> = {
  dashboard: 'Dashboard',
  'dashboard/profile': 'Profile',
  'dashboard/chat': 'Chat',
  'dashboard/friends': 'Friends',
  'dashboard/settings': 'Settings',
  'dashboard/game': 'Play',
  'dashboard/game/ai': 'AI Match',
  'dashboard/game/local': 'Local Match',
  'dashboard/game/remote': 'Ranked Match',
  'dashboard/game/friend_game': 'Friendly Match',
  'dashboard/game/tournament': 'Tournament',
  'dashboard/game/tournament/lobby': 'Tournament Lobby',
};

export function TopBar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const route = useRouterStore((state) => state.route);
  const navigate = useRouterStore((state) => state.navigate);

  const notifications = useUiStore((state) => state.notifications);
  const markRead = useUiStore((state) => state.markNotificationsRead);
  const [bellOpen, setBellOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('home');
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-bg-primary/85 px-6 backdrop-blur-md">
      <h1 className="font-heading text-lg font-bold text-content-primary">
        {TITLES[route] ?? 'Dashboard'}
      </h1>

      <div className="flex items-center gap-2">
        <DropdownMenu.Root
          open={bellOpen}
          onOpenChange={(open) => {
            setBellOpen(open);
            if (open && unread > 0) markRead();
          }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              className={cn(
                'relative rounded-lg p-2 text-content-secondary',
                'transition-colors duration-hover ease-out hover:bg-bg-elevated hover:text-content-primary',
              )}
            >
              <Bell aria-hidden className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-red px-1 font-mono text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-80 overflow-hidden rounded-xl border border-border-accent bg-bg-card shadow-card"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="font-heading text-sm font-bold text-content-primary">Notifications</p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-content-muted">
                      You&rsquo;re all caught up.
                    </p>
                  ) : (
                    notifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-border px-4 py-3 last:border-0"
                      >
                        <p className="text-sm font-medium text-content-primary">
                          {notification.title}
                        </p>
                        {notification.description ? (
                          <p className="mt-0.5 text-xs text-content-secondary">
                            {notification.description}
                          </p>
                        ) : null}
                        <p className="mt-1 font-mono text-[10px] text-content-muted">
                          {formatRelative(notification.at)}
                        </p>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className={cn(
                'flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2.5',
                'transition-colors duration-hover ease-out hover:bg-bg-elevated',
              )}
            >
              <Avatar src={user?.avatar} name={user?.username ?? '?'} size="sm" status="online" />
              <span className="hidden text-sm font-medium text-content-primary lg:block">
                {user?.username ?? 'Player'}
              </span>
              <ChevronDown aria-hidden className="h-3.5 w-3.5 text-content-muted" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-52 overflow-hidden rounded-xl border border-border-accent bg-bg-card p-1 shadow-card"
            >
              <MenuItem
                icon={<UserIcon aria-hidden className="h-4 w-4" />}
                onSelect={() => navigate('dashboard/profile')}
              >
                Profile
              </MenuItem>
              <MenuItem
                icon={<Settings aria-hidden className="h-4 w-4" />}
                onSelect={() => navigate('dashboard/settings')}
              >
                Settings
              </MenuItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <MenuItem
                icon={<LogOut aria-hidden className="h-4 w-4" />}
                onSelect={handleLogout}
                danger
              >
                Log out
              </MenuItem>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  children,
  onSelect,
  danger = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none',
        'transition-colors duration-hover',
        danger
          ? 'text-content-secondary data-[highlighted]:bg-accent-red/10 data-[highlighted]:text-accent-red'
          : 'text-content-secondary data-[highlighted]:bg-bg-elevated data-[highlighted]:text-content-primary',
      )}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}
