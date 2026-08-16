import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EloBadge } from '@/components/ui/Badge';
import { navigate } from '@/stores/router.store';
import type { PresenceStatus, User } from '@/types';

const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  'in-game': 'In game',
  offline: 'Offline',
};

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: 'text-accent-green',
  'in-game': 'text-accent-amber',
  offline: 'text-content-muted',
};

export function FriendCard({
  friend,
  status,
  onChallenge,
  onRemove,
}: {
  friend: User;
  status: PresenceStatus;
  onChallenge: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-bg-card p-4',
        'transition-colors duration-hover ease-out hover:border-border-accent hover:bg-bg-elevated',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar src={friend.avatar} name={friend.username} size="md" status={status} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-bold text-content-primary">
            {friend.username}
          </p>
          <p className={cn('text-xs', STATUS_COLOR[status])}>{STATUS_LABEL[status]}</p>
        </div>
      </div>

      <EloBadge elo={friend.elo} />

      <div className="mt-auto flex gap-2">
        <Button size="sm" variant="secondary" onClick={onChallenge} className="flex-1">
          Challenge
        </Button>
        <Button size="sm" variant="ghost" onClick={() => navigate('dashboard/chat')}>
          Message
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          aria-label={`Remove ${friend.username}`}
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}
