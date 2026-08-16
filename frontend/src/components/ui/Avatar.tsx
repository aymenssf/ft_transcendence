import { useState } from 'react';
import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';
import type { PresenceStatus } from '@/types';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-28 w-28 text-3xl',
} as const;

const DOT_SIZES = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
  xl: 'h-6 w-6',
} as const;

const STATUS_STYLES: Record<PresenceStatus, string> = {
  online: 'bg-accent-green shadow-glow-green',
  offline: 'bg-content-muted',
  'in-game': 'bg-accent-amber shadow-glow-amber',
};

export interface AvatarProps {
  src?: string | undefined;
  name: string;
  size?: keyof typeof SIZES;
  status?: PresenceStatus | undefined;
  className?: string;
  ring?: boolean;
}

export function Avatar({
  src,
  name,
  size = 'md',
  status,
  className,
  ring = false,
}: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={cn('relative shrink-0', className)}>
      {showImage ? (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className={cn(
            'rounded-full object-cover',
            SIZES[size],
            ring ? 'ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-primary' : 'border border-border-accent',
          )}
        />
      ) : (
        <div
          aria-hidden
          className={cn(
            'flex items-center justify-center rounded-full font-heading font-bold',
            'bg-bg-elevated text-content-secondary',
            SIZES[size],
            ring ? 'ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-primary' : 'border border-border-accent',
          )}
        >
          {initials(name)}
        </div>
      )}

      {status ? (
        <span
          role="status"
          aria-label={status === 'in-game' ? 'In game' : status === 'online' ? 'Online' : 'Offline'}
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-bg-primary',
            DOT_SIZES[size],
            STATUS_STYLES[status],
            status === 'online' && 'animate-status-pulse',
          )}
        />
      ) : null}
    </div>
  );
}
