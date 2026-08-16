import { useEffect, useState } from 'react';
import { authService } from '@/services/auth.service';

export interface ResolvedPlayer {
  name: string;
  avatar?: string;
}

/**
 * Neither the tournament (`players: string[]`) nor the match-history
 * (`p1`/`p2` string columns) endpoints join user data — game-service only
 * ever stores raw ids. This mirrors legacy's `resolveUser` helper in
 * `game_tournament_handler.ts`: resolve each id via auth-service, falling back
 * to `Player <id prefix>` on failure, and cache across the session so the
 * bracket preview and every match table share one set of lookups instead of
 * refetching the same ids repeatedly.
 */
const cache = new Map<string, ResolvedPlayer>();
const inflight = new Map<string, Promise<ResolvedPlayer>>();

function fallbackName(id: string): ResolvedPlayer {
  return { name: `Player ${id.slice(0, 4)}` };
}

async function resolveOne(id: string): Promise<ResolvedPlayer> {
  const cached = cache.get(id);
  if (cached) return cached;

  const pending = inflight.get(id);
  if (pending) return pending;

  const numericId = Number(id);
  const promise = (
    Number.isFinite(numericId)
      ? authService.getUser(numericId)
      : Promise.reject(new Error('non-numeric id'))
  )
    .then((user) => {
      const resolved: ResolvedPlayer = { name: user.username, ...(user.avatar && { avatar: user.avatar }) };
      cache.set(id, resolved);
      return resolved;
    })
    .catch(() => {
      const resolved = fallbackName(id);
      cache.set(id, resolved);
      return resolved;
    })
    .finally(() => inflight.delete(id));

  inflight.set(id, promise);
  return promise;
}

/** Resolves raw player ids into `{ name, avatar }`, keyed by id-as-string. */
export function usePlayerNames(
  ids: ReadonlyArray<string | number | null | undefined>,
): Record<string, ResolvedPlayer> {
  const unique = Array.from(
    new Set(ids.filter((id): id is string | number => id !== null && id !== undefined).map(String)),
  );
  const key = unique.slice().sort().join(',');

  const [resolved, setResolved] = useState<Record<string, ResolvedPlayer>>({});

  useEffect(() => {
    if (unique.length === 0) return;

    let cancelled = false;
    Promise.all(unique.map(async (id) => [id, await resolveOne(id)] as const)).then((entries) => {
      if (!cancelled) setResolved((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
    // `unique` is derived fresh every render from `ids`; `key` is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return resolved;
}

/** Synchronous fallback for render paths that can't wait on the hook's effect. */
export function playerFallback(id: string | number): ResolvedPlayer {
  return fallbackName(String(id));
}
