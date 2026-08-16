import { motion } from 'framer-motion';
import { ArrowRight, Gamepad2, MessageSquare, Trophy } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PongBackdrop } from '@/components/landing/PongBackdrop';
import { navigate } from '@/stores/router.store';
import { cn } from '@/lib/cn';

interface Feature {
  icon: typeof Gamepad2;
  title: string;
  description: string;
  tone: 'violet' | 'amber' | 'cyan';
}

const FEATURES: readonly Feature[] = [
  {
    icon: Gamepad2,
    title: 'Real-time multiplayer',
    description: 'Fast-paced Pong over WebSockets — local, versus AI, or ranked online.',
    tone: 'violet',
  },
  {
    icon: Trophy,
    title: 'Tournaments',
    description: 'Four-player brackets with live semi-finals and a grand final.',
    tone: 'amber',
  },
  {
    icon: MessageSquare,
    title: 'Live chat',
    description: 'Message friends, get challenged, and jump straight into a match.',
    tone: 'cyan',
  },
] as const;

const TONE_STYLES = {
  violet: 'border-accent-primary/30 text-accent-primary bg-accent-primary/10',
  amber: 'border-accent-amber/30 text-accent-amber bg-accent-amber/10',
  cyan: 'border-accent-cyan/30 text-accent-cyan bg-accent-cyan/10',
} as const;

/**
 * Marketing splash. Split out from the former combined Landing/Login screen —
 * this carries the pitch, `/login` carries the focused 42 auth card.
 */
export function HomeScreen() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="noise-overlay relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg-primary px-6 py-16">
      <PongBackdrop reducedMotion={reducedMotion} />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-3xl text-center"
      >
        <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-gradient">ft_</span>
          <span className="text-content-primary">transcendence</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-lg text-content-secondary">
          The Ultimate Pong Experience — real-time matches, tournaments, and a live community, all
          in one dark, cinematic client.
        </p>

        <button
          type="button"
          onClick={() => navigate('login')}
          className={cn(
            'group mx-auto mt-8 flex items-center justify-center gap-2.5 rounded-xl bg-gradient-hero px-8 py-3.5',
            'font-heading text-sm font-bold text-[#06060c]',
            'transition-all duration-hover ease-out hover:-translate-y-0.5 hover:shadow-glow-violet',
          )}
        >
          Get Started
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-hover group-hover:translate-x-0.5"
          />
        </button>
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3"
      >
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.title}
              className="glass rounded-2xl p-6 text-left transition-transform duration-hover ease-out hover:-translate-y-1"
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl border',
                  TONE_STYLES[feature.tone],
                )}
              >
                <Icon aria-hidden className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-heading text-sm font-bold text-content-primary">
                {feature.title}
              </h3>
              <p className="mt-1.5 text-sm text-content-secondary">{feature.description}</p>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
