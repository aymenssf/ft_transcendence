import { motion } from 'framer-motion';
import { Auth42Handler } from '../../auth-42-intra.js';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PongBackdrop } from '@/components/landing/PongBackdrop';
import { cn } from '@/lib/cn';

/**
 * Login. Split out from the former combined Landing/Login screen — `/home` now
 * carries the marketing splash, `/login` is this focused card.
 *
 * Auth is delegated entirely to the immutable `auth-42-intra.ts`:
 * `initiateLogin` performs a full-page redirect to the 42 OAuth endpoint, and
 * `App` calls `initAuth42()` on boot to consume the callback. We deliberately
 * do NOT use `create42IntraButton`, which builds its own unstyled DOM.
 */
export function LoginScreen() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="noise-overlay relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary px-6">
      <PongBackdrop reducedMotion={reducedMotion} />

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass relative z-10 w-full max-w-md rounded-2xl p-10 text-center shadow-glow-violet"
      >
        <h1 className="font-heading text-4xl font-bold tracking-tight">
          <span className="text-gradient">ft_</span>
          <span className="text-content-primary">transcendence</span>
        </h1>

        <p className="mt-3 text-sm text-content-secondary">The Ultimate Pong Experience</p>

        <div aria-hidden className="my-8 h-px bg-gradient-to-r from-transparent via-border-accent to-transparent" />

        <button
          type="button"
          onClick={() => Auth42Handler.initiateLogin('/dashboard')}
          className={cn(
            'group flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-hero px-6 py-3.5',
            'font-heading text-sm font-bold text-[#06060c]',
            'transition-all duration-hover ease-out hover:-translate-y-0.5 hover:shadow-glow-violet',
          )}
        >
          <Logo42 />
          Login with 42
        </button>

        <p className="mt-6 text-xs text-content-muted">
          You&rsquo;ll be redirected to the 42 intranet to authorise access.
        </p>
      </motion.div>
    </div>
  );
}

function Logo42() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 128 128"
      className="h-4 w-4 fill-current transition-transform duration-hover group-hover:scale-110"
    >
      <path d="M60.5 4.5H45.2L4.5 45.2v15.3h40.7V4.5zM4.5 68.2v15.3h40.7v40.7h15.3V68.2H4.5zM68.2 45.2 108.9 4.5h-15.3L52.9 45.2v15.3h40.7v40.7h15.3V45.2H68.2z" />
    </svg>
  );
}
