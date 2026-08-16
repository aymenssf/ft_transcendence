import { env } from '@/lib/env';
import { http } from '@/lib/http';
import type { ChatMessage, ChatRoom, FriendRequest, User } from '@/types';

/**
 * Ported from the previous `src/chat/chat-api.ts`. Endpoint paths and response
 * envelopes are unchanged — only the transport (shared `http` client), error
 * handling and typing are new.
 */
export const chatService = {
  getFriends(signal?: AbortSignal): Promise<User[]> {
    return http
      .get<{ friends?: User[] }>(`${env.chatApi}/friends`, signal)
      .then((data) => data?.friends ?? []);
  },

  getPendingRequests(signal?: AbortSignal): Promise<FriendRequest[]> {
    return http
      .get<{ requests?: FriendRequest[] }>(`${env.chatApi}/friends/requests`, signal)
      .then((data) => data?.requests ?? []);
  },

  sendFriendRequest(receiverUsername: string): Promise<void> {
    return http.post<void>(`${env.chatApi}/friends/request`, { receiverUsername });
  },

  respondToFriendRequest(requestId: number, accept: boolean): Promise<void> {
    return http.post<void>(`${env.chatApi}/friends/respond`, { requestId, accept });
  },

  removeFriend(friendId: number): Promise<void> {
    return http.delete<void>(`${env.chatApi}/friends/${friendId}`);
  },

  getUsers(signal?: AbortSignal): Promise<User[]> {
    return http
      .get<{ users?: User[] }>(`${env.chatApi}/users`, signal)
      .then((data) => data?.users ?? []);
  },

  searchUsers(query: string, signal?: AbortSignal): Promise<User[]> {
    return http
      .get<{ users?: User[] }>(
        `${env.chatApi}/users/search?q=${encodeURIComponent(query)}`,
        signal,
      )
      .then((data) => data?.users ?? []);
  },

  getChatRooms(signal?: AbortSignal): Promise<ChatRoom[]> {
    return http
      .get<{ chatRooms?: ChatRoom[] }>(`${env.chatApi}/chatrooms`, signal)
      .then((data) => data?.chatRooms ?? []);
  },

  createPrivateChat(targetUserId: number): Promise<ChatRoom> {
    return http
      .post<{ chatRoom: ChatRoom }>(`${env.chatApi}/chatrooms`, { type: 'private', targetUserId })
      .then((data) => data.chatRoom);
  },

  getRoomMessages(roomId: number, signal?: AbortSignal): Promise<ChatMessage[]> {
    return http
      .get<{ messages?: RawMessage[] }>(`${env.chatApi}/chatrooms/${roomId}/messages`, signal)
      .then((data) => (data?.messages ?? []).map(normaliseMessage));
  },

  sendGameInvite(targetUserId: number): Promise<void> {
    return http.post<void>(`${env.chatApi}/game/invite`, { targetUserId });
  },

  acceptGameInvite(invitationId: number): Promise<{ gameRoomId?: string }> {
    return http.post<{ gameRoomId?: string }>(`${env.chatApi}/game/accept`, { invitationId });
  },

  declineGameInvite(invitationId: number): Promise<void> {
    return http.post<void>(`${env.chatApi}/game/decline`, { invitationId });
  },

  blockUser(blockedId: number): Promise<void> {
    return http.post<void>(`${env.chatApi}/users/block`, { blockedId });
  },

  unblockUser(blockedId: number): Promise<void> {
    return http.post<void>(`${env.chatApi}/users/unblock`, { blockedId });
  },

  getBlockedUsers(signal?: AbortSignal): Promise<User[]> {
    return http
      .get<{ blockedUsers?: User[] }>(`${env.chatApi}/users/blocked`, signal)
      .then((data) => data?.blockedUsers ?? []);
  },

  getUserProfile(userId: number, signal?: AbortSignal): Promise<User> {
    return http.get<User>(`${env.chatApi}/users/${userId}/profile`, signal);
  },
};

interface RawMessage {
  id: number | string;
  content?: string;
  senderId: number;
  sender?: { username?: string; avatar?: string };
  created_at?: string;
  type?: ChatMessage['type'];
  chatRoomId?: number;
  metadata?: string | Record<string, unknown>;
}

/** The service returns a nested `sender`; the UI wants it flattened. */
function normaliseMessage(raw: RawMessage): ChatMessage {
  return {
    id: raw.id,
    content: raw.content ?? '',
    senderId: raw.senderId,
    senderName: raw.sender?.username ?? 'Unknown',
    senderAvatar: raw.sender?.avatar,
    timestamp: raw.created_at ?? new Date().toISOString(),
    type: raw.type ?? 'text',
    chatRoomId: raw.chatRoomId,
    metadata: raw.metadata,
  };
}
