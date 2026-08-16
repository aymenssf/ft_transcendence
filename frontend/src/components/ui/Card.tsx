import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover affordance. Use only when the whole card is interactive. */
  interactive?: boolean;
  glow?: 'none' | 'violet' | 'cyan' | 'green';
}

const GLOWS: Record<NonNullable<CardProps['glow']>, string> = {
  none: '',
  violet: 'shadow-glow-violet border-accent-primary/40',
  cyan: 'shadow-glow-cyan border-accent-cyan/40',
  green: 'shadow-glow-green border-accent-green/40',
};

export function Card({
  interactive = false,
  glow = 'none',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-bg-card shadow-card',
        interactive &&
          'transition-colors duration-hover ease-out hover:border-border-accent hover:bg-bg-elevated',
        GLOWS[glow],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border p-5', className)}>
      <div className="min-w-0">
        <h2 className="font-heading text-base font-bold text-content-primary">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-content-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
