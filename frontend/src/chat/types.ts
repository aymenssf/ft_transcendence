/**
 * Chat Type Definitions
 */

export interface User {
  id: number;
  username: string;
  email?: string;
  avatar?: string;
  status?: 'online' | 'offline' | 'away';
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: 'pending' | 'accepted' | 'declined';
  sender?: User;
  receiver?: User;
  created_at?: string;
}

export interface ChatMessage {
  id: number | string;
  content: string;
  senderId: number;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  type?: 'text' | 'game_invitation' | 'system';
  chatRoomId?: number;
  metadata?: string | { invitationId?: number; targetUserId?: number; targetUsername?: string; [key: string]: any };
}

export interface ChatRoom {
  id: number;
  name: string;
  type: 'public' | 'private' | 'protected';
  members: Array<{
    userId: number;
    role?: string;
    user?: User;
  }>;
  created_at?: string;
  _count?: {
    members: number;
  };
}

export interface GameInvite {
  id: number;
  senderId: number;
  senderUsername: string;
  targetId: number;
  gameRoomId?: string;
  status?: 'pending' | 'accepted' | 'declined';
  created_at?: string;
}

export interface TypingIndicator {
  userId: number;
  username: string;
  chatRoomId: number;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting?: boolean;
  error?: string;
}
