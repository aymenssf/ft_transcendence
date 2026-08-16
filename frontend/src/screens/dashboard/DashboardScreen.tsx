import { Flame, Gamepad2, Percent, Swords, Trophy, TrendingDown, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { EloBadge } from '@/components/ui/Badge';
import { AsyncBoundary, EmptyState, Skeleton } from '@/components/ui/States';
import { MatchHistoryTable } from '@/components/dashboard/MatchHistoryTable';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/auth.store';
import { usePresenceStore } from '@/stores/presence.store';
import { navigate } from '@/stores/router.store';
import { gameService } from '@/services/game.service';
import { chatService } from '@/services/chat.service';
import { sendFriendInvite } from '../../friend_invite_handler.js';
import { toast } from '@/stores/ui.store';
import { percent } from '@/lib/format';
import type { Match, User, UserStats } from '@/types';

export function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? 0;
  const statuses = usePresenceStore((state) => state.statuses);

  const stats = useAsync<UserStats>(
    (signal) => gameService.getStats(userId, signal),
    [userId],
    { enabled: userId > 0 },
  );

  const matches = useAsync<Match[]>(
    (signal) => gameService.getMatches(userId, signal),
    [userId],
    { enabled: userId > 0 },
  );

  const friends = useAsync<User[]>((signal) => chatService.getFriends(signal), []);

  const onlineFriends = (friends.data ?? []).filter(
    (friend) => statuses[friend.id] === 'online' || friend.status === 'online',
  );

  const challenge = (friend: User): void => {
    sendFriendInvite(String(friend.id));
    toast.info('Challenge sent', `Waiting for ${friend.username} to respond.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome back, ${user?.username ?? 'player'}`} />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-border-accent bg-bg-card p-8"
        aria-label="Quick play"
      >
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-primary/12 blur-3xl"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <h3 className="font-heading text-2xl font-bold text-content-primary">Ready to play?</h3>
            <p className="mt-1.5 max-w-md text-sm text-content-secondary">
              Jump into a ranked match, or gather four players for a tournament bracket.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={() => navigate('dashboard/game/remote')}
              icon={<Swords aria-hidden className="h-4 w-4" />}
            >
              Quick match
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('dashboard/game/tournament')}
              icon={<Trophy aria-hidden className="h-4 w-4" />}
            >
              Tournament
            </Button>
          </div>
        </div>
      </motion.section>

      <section aria-label="Your statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wins"
          value={stats.data?.wins ?? 0}
          tone="green"
          loading={stats.loading}
          icon={<Flame aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Losses"
          value={stats.data?.losses ?? 0}
          tone="red"
          loading={stats.loading}
          icon={<TrendingDown aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Win rate"
          value={stats.data ? percent(stats.data.winRate) : '—'}
          tone="cyan"
          loading={stats.loading}
          icon={<Percent aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="ELO"
          value={stats.data?.elo ?? '—'}
          tone="violet"
          loading={stats.loading}
          icon={<Gamepad2 aria-hidden className="h-3.5 w-3.5" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Recent matches" className="rounded-xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="font-heading text-sm font-bold text-content-primary">Recent matches</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('dashboard/profile')}>
              View all
            </Button>
          </div>

          <AsyncBoundary
            state={matches}
            onRetry={matches.reload}
            loading={
              <div className="space-y-3 p-5">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            }
            isEmpty={(list) => list.length === 0}
          >
            {(list) => <MatchHistoryTable matches={list} limit={6} sortable={false} />}
          </AsyncBoundary>
        </section>

        <section aria-label="Online friends" className="rounded-xl border border-border bg-bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="font-heading text-sm font-bold text-content-primary">Online friends</h3>
            <span className="font-mono text-xs text-content-secondary">
              {onlineFriends.length}
            </span>
          </div>

          <AsyncBoundary
            state={friends}
            onRetry={friends.reload}
            loading={
              <div className="space-y-3 p-5">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            }
          >
            {() =>
              onlineFriends.length === 0 ? (
                <EmptyState
                  icon={<Users aria-hidden className="h-5 w-5" />}
                  title="Nobody online"
                  description="Your friends will appear here when they come online."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('dashboard/friends')}>
                      Find friends
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {onlineFriends.slice(0, 8).map((friend) => (
                    <li key={friend.id} className="flex items-center gap-3 p-4">
                      <Avatar src={friend.avatar} name={friend.username} size="sm" status="online" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-content-primary">
                          {friend.username}
                        </p>
                        <EloBadge elo={friend.elo} />
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => challenge(friend)}>
                        Challenge
                      </Button>
                    </li>
                  ))}
                </ul>
              )
            }
          </AsyncBoundary>
        </section>
      </div>
    </div>
  );
}
