import { useEffect } from 'react';
import {
  initFriendInviteListener,
  cleanupFriendInviteListener,
} from '../friend_invite_handler.js';
import { navigate } from '@/stores/router.store';

/**
 * Wraps the immutable `friend_invite_handler.ts`.
 *
 * That module renders its own modal into `document.body` and owns the whole
 * accept/decline interaction; we only supply the navigation callback and
 * guarantee teardown. Its markup is restyled in `styles/legacy.css`.
 *
 * Mount once, at app level — mounting per screen would register duplicate
 * listeners on the game socket.
 */
export function useFriendInvites(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    initFriendInviteListener((roomId: string) => {
      // Legacy hands us the room id; the remote match screen reads it from the
      // query string, which is also what the old main.ts did.
      window.history.pushState({}, '', `/dashboard/game/remote?room=${roomId}`);
      navigate('dashboard/game/remote');
    });

    return () => cleanupFriendInviteListener();
  }, [enabled]);
}
