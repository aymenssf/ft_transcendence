import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useRouterStore } from '@/stores/router.store';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Authenticated layout: fixed sidebar + sticky header + animated content well.
 *
 * The page transition is keyed on the route so each screen mounts fresh. This
 * matters beyond aesthetics — the Game and Tournament screens must fully
 * unmount so their legacy cleanup effects run before the next screen builds its
 * DOM contract nodes.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const route = useRouterStore((state) => state.route);
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="min-w-0 flex-1 px-6 py-6">
          <motion.div
            key={route}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-[1600px]"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

/** Consistent page heading used across screens. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-heading text-2xl font-bold text-content-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-content-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
