import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/http';
import type { AsyncState } from '@/types';

/**
 * Every async read in the app goes through here, so loading / error / empty
 * states are uniform and abort correctly on unmount or dependency change.
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {},
): AsyncState<T> & { reload: () => void } {
  const { enabled = true } = options;

  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });

  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setState((previous) => ({ ...previous, loading: true, error: null }));

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ data: null, loading: false, error: errorMessage(error) });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}

/** Imperative async action with loading + error tracking, for mutations. */
export function useAction<Args extends unknown[], R>(
  action: (...args: Args) => Promise<R>,
): {
  run: (...args: Args) => Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const actionRef = useRef(action);
  actionRef.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: Args): Promise<R | undefined> => {
    setPending(true);
    setError(null);
    try {
      const result = await actionRef.current(...args);
      return result;
    } catch (cause: unknown) {
      if (mounted.current) setError(errorMessage(cause));
      return undefined;
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { run, pending, error, clearError };
}
