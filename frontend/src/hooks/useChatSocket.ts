import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import { getToken } from '@/lib/http';
import { usePresenceStore } from '@/stores/presence.store';
import { useUiStore } from '@/stores/ui.store';

/**
 * The real chat transport.
 *
 * Deliberately NOT built on the immutable `chat_soket.ts`: that module opens a
 * raw WebSocket to a hardcoded `ws://0.0.0.0:3011/socket.io`, which is neither
 * proxied by nginx.conf nor a valid Socket.IO handshake — it is dead code. The
 * previous `main.ts` also ignored it and used Socket.IO directly, which is what
 * this reproduces. See DOM_CONTRACT.md.
 *
 * One shared connection per session, module-scoped so every screen reuses it.
 */

let socket: Socket | null = null;
let refCount = 0;

export function getChatSocket(): Socket | null {
  return socket;
}

function connect(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket) return socket;

  socket = io(env.chatSocketUrl, {
    path: env.chatSocketPath,
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10_000,
  });

  socket.on('connect_error', (error: Error) => {
    console.warn('Chat socket connection error:', error.message);
  });

  return socket;
}

export function disconnectChatSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  refCount = 0;
}

/**
 * Opens the shared connection and wires the global presence + notification
 * events. Mount once, high in the tree.
 */
export function useChatSocketConnection(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const active = connect();
    if (!active) return;
    refCount += 1;

    const setStatus = usePresenceStore.getState().setStatus;
    const { pushNotification } = useUiStore.getState();

    const onFriendStatus = (data: { userId: number; status: 'online' | 'offline' }): void => {
      setStatus(data.userId, data.status);
    };

    const onUserStatus = (data: { userId: number; status: 'online' | 'offline' }): void => {
      setStatus(data.userId, data.status);
    };

    const onFriendRequest = (data: { senderUsername?: string }): void => {
      pushNotification({
        title: 'New friend request',
        description: data?.senderUsername ? `from ${data.senderUsername}` : undefined,
      });
    };

    const onFriendAdded = (data: { username?: string }): void => {
      pushNotification({
        title: 'Friend request accepted',
        description: data?.username ? `You and ${data.username} are now friends` : undefined,
      });
    };

    active.on('friend-status-change', onFriendStatus);
    active.on('user-status-change', onUserStatus);
    active.on('friend-request', onFriendRequest);
    active.on('friend-added', onFriendAdded);

    return () => {
      active.off('friend-status-change', onFriendStatus);
      active.off('user-status-change', onUserStatus);
      active.off('friend-request', onFriendRequest);
      active.off('friend-added', onFriendAdded);
      refCount = Math.max(0, refCount - 1);
    };
  }, [enabled]);
}

/** Subscribe to a single chat event for the lifetime of a component. */
export function useChatEvent<T>(event: string, handler: (payload: T) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const active = socket ?? connect();
    if (!active) return;

    const stable = (payload: T): void => handlerRef.current(payload);
    active.on(event, stable);
    return () => {
      active.off(event, stable);
    };
  }, [event]);
}

/** Emit on the shared socket; no-op when disconnected. */
export function emitChat(event: string, payload?: unknown): void {
  const active = socket ?? connect();
  active?.emit(event, payload);
}
