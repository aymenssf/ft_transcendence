import { Bot, Swords, Trophy, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useRouterStore, type Route } from '@/stores/router.store';
import { cn } from '@/lib/cn';

interface ModeCard {
  route: Route;
  title: string;
  description: string;
  icon: typeof Bot;
  tone: 'violet' | 'cyan' | 'green' | 'amber';
  tag: string;
}

const MODES: readonly ModeCard[] = [
  {
    route: 'dashboard/game/remote',
    title: 'Ranked Match',
    description: 'Queue up and get paired with a live opponent.',
    icon: Swords,
    tone: 'cyan',
    tag: 'Online',
  },
  {
    route: 'dashboard/game/ai',
    title: 'Versus AI',
    description: 'Practise against the machine at three difficulty levels.',
    icon: Bot,
    tone: 'violet',
    tag: 'Practice',
  },
  {
    route: 'dashboard/game/local',
    title: 'Local Match',
    description: 'Two players sharing one keyboard.',
    icon: Users,
    tone: 'green',
    tag: 'Couch',
  },
  {
    route: 'dashboard/game/tournament',
    title: 'Tournament',
    description: 'Four players, semi-finals and a grand final.',
    icon: Trophy,
    tone: 'amber',
    tag: 'Bracket',
  },
] as const;

const TONE_STYLES = {
  violet: 'text-accent-primary group-hover:shadow-glow-violet border-accent-primary/30',
  cyan: 'text-accent-cyan group-hover:shadow-glow-cyan border-accent-cyan/30',
  green: 'text-accent-green group-hover:shadow-glow-green border-accent-green/30',
  amber: 'text-accent-amber group-hover:shadow-glow-amber border-accent-amber/30',
} as const;

export function GameHub() {
  const navigate = useRouterStore((state) => state.navigate);

  return (
    <div>
      <PageHeader title="Choose your match" description="Four ways to play. Pick one and go." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((mode, index) => {
          const Icon = mode.icon;
          return (
            <motion.button
              key={mode.route}
              type="button"
              onClick={() => navigate(mode.route)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'group flex flex-col items-start gap-3 rounded-xl border border-border bg-bg-card p-5 text-left',
                'transition-colors duration-hover ease-out hover:border-border-accent hover:bg-bg-elevated',
              )}
            >
              <div className="flex w-full items-start justify-between">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl border bg-bg-secondary',
                    'transition-shadow duration-hover ease-out',
                    TONE_STYLES[mode.tone],
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <Badge tone={mode.tone}>{mode.tag}</Badge>
              </div>

              <div>
                <h3 className="font-heading text-base font-bold text-content-primary">
                  {mode.title}
                </h3>
                <p className="mt-1 text-sm text-content-secondary">{mode.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
