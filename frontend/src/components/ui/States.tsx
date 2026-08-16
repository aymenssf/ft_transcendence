import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-lg bg-bg-elevated',
        'after:absolute after:inset-0 after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/[0.04] after:to-transparent',
        className,
      )}
    />
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 aria-hidden className={cn('h-5 w-5 animate-spin text-accent-primary', className)} />
    </span>
  );
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-14', className)}>
      <Spinner />
      <p className="text-sm text-content-secondary">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-bg-elevated text-content-muted">
        {icon ?? <Inbox aria-hidden className="h-5 w-5" />}
      </div>
      <div>
        <h3 className="font-heading text-sm font-bold text-content-primary">{title}</h3>
        {description ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-content-secondary">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent-red/35 bg-accent-red/10 text-accent-red">
        <AlertTriangle aria-hidden className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-heading text-sm font-bold text-content-primary">{title}</h3>
        {message ? (
          <p className="mx-auto mt-1 max-w-sm text-sm text-content-secondary">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} icon={<RefreshCw aria-hidden className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Renders the right state for an async read. Keeps every screen's
 * loading/error/empty handling identical without a wrapper component per list.
 */
export function AsyncBoundary<T>({
  state,
  onRetry,
  loading,
  empty,
  isEmpty,
  children,
}: {
  state: { data: T | null; loading: boolean; error: string | null };
  onRetry?: () => void;
  loading?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
}) {
  if (state.loading && state.data === null) return <>{loading ?? <LoadingState />}</>;
  if (state.error) return <ErrorState message={state.error} {...(onRetry && { onRetry })} />;
  if (state.data === null) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  if (isEmpty?.(state.data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(state.data)}</>;
}
