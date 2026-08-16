import { useEffect, useRef } from 'react';
import {
  initgameSocket,
  addMessageListener,
  removeMessageListener,
  sendMessage,
} from '../game_soket.js';

/**
 * Wraps the immutable `game_soket.ts` singleton.
 *
 * `addMessageListener` has no dedupe and no auto-teardown — every listener that
 * is added must be removed, or handlers accumulate across route changes and a
 * single `game_update` fans out to stale closures. This hook guarantees the
 * pairing.
 *
 * The listener is held in a ref so callers can pass an inline arrow function
 * without the subscription tearing down and rebuilding on every render.
 */
export function useGameSocket(
  listener?: (msg: unknown) => void,
  options: { enabled?: boolean } = {},
): { send: typeof sendMessage } {
  const { enabled = true } = options;
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    if (!enabled) return;

    initgameSocket();

    const stable = (msg: unknown): void => {
      listenerRef.current?.(msg);
    };

    addMessageListener(stable);
    return () => removeMessageListener(stable);
  }, [enabled]);

  return { send: sendMessage };
}

/** Ensures the socket exists without subscribing to messages. */
export function useEnsureGameSocket(): void {
  useEffect(() => {
    initgameSocket();
  }, []);
}
