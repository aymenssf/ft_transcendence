import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'violet' | 'cyan' | 'green' | 'red' | 'amber' | 'gold';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-bg-elevated text-content-secondary border-border-accent',
  violet: 'bg-accent-primary/12 text-accent-primary border-accent-primary/35',
  cyan: 'bg-accent-cyan/12 text-accent-cyan border-accent-cyan/35',
  green: 'bg-accent-green/12 text-accent-green border-accent-green/35',
  red: 'bg-accent-red/12 text-accent-red border-accent-red/35',
  amber: 'bg-accent-amber/12 text-accent-amber border-accent-amber/35',
  gold: 'bg-[#ffc400]/12 text-[#ffc400] border-[#ffc400]/40',
};

export function Badge({
  tone = 'neutral',
  mono = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  mono?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
        mono && 'font-mono tabular-nums',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Win / Loss pill used in match tables. */
export function ResultBadge({ result }: { result: 'win' | 'loss' | 'draw' }) {
  if (result === 'draw') return <Badge tone="neutral">D</Badge>;
  return (
    <Badge tone={result === 'win' ? 'green' : 'red'}>{result === 'win' ? 'W' : 'L'}</Badge>
  );
}

/** ELO chip that degrades to an em dash when the backend omits the field. */
export function EloBadge({ elo }: { elo?: number | undefined }) {
  if (elo === undefined || elo === null || !Number.isFinite(elo)) {
    return (
      <Badge tone="neutral" mono className="text-content-muted" >
        <span title="Rating not reported by the server">ELO —</span>
      </Badge>
    );
  }
  return (
    <Badge tone="violet" mono>
      ELO {Math.round(elo)}
    </Badge>
  );
}
