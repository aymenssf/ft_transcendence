import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './States';

export type StatTone = 'default' | 'green' | 'red' | 'cyan' | 'violet';

const TONES: Record<StatTone, string> = {
  default: 'text-content-primary',
  green: 'text-accent-green',
  red: 'text-accent-red',
  cyan: 'text-accent-cyan',
  violet: 'text-accent-primary',
};

/**
 * Compact metric tile. `value` is rendered in JetBrains Mono with tabular
 * figures so a row of tiles stays aligned as numbers change.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'default',
  loading = false,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-card p-4',
        'transition-colors duration-hover ease-out hover:border-border-accent',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon ? <span className="text-content-muted">{icon}</span> : null}
        <span className="text-xs font-semibold uppercase tracking-wide text-content-secondary">
          {label}
        </span>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className={cn('mt-1.5 font-mono text-2xl font-bold tabular-nums', TONES[tone])}>
          {value}
        </p>
      )}
    </div>
  );
}
