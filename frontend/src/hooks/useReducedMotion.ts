import { useEffect, useState } from 'react';

/**
 * Tracks `prefers-reduced-motion`. The CSS layer already neutralises
 * animations; this hook lets JS-driven motion (Framer Motion variants, the
 * landing-screen ball) opt out too.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent): void => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
