import { create } from 'zustand';
import type { PresenceStatus } from '@/types';

/**
 * Live presence, fed by the chat Socket.IO events `friend-status-change` and
 * `user-status-change`. Kept separate from the friends list so a status ping
 * does not force a re-render of every friend card.
 */
interface PresenceState {
  statuses: Record<number, PresenceStatus>;
  setStatus: (userId: number, status: PresenceStatus) => void;
  setMany: (entries: Array<{ userId: number; status: PresenceStatus }>) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},

  setStatus: (userId, status) =>
    set((state) => ({ statuses: { ...state.statuses, [userId]: status } })),

  setMany: (entries) =>
    set((state) => {
      const next = { ...state.statuses };
      for (const entry of entries) next[entry.userId] = entry.status;
      return { statuses: next };
    }),

  reset: () => set({ statuses: {} }),
}));

export const usePresence = (userId: number | undefined): PresenceStatus =>
  usePresenceStore((state) => (userId ? (state.statuses[userId] ?? 'offline') : 'offline'));
