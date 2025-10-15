import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import { FastifyInstance as OriginalFastifyInstance } from 'fastify';

// Database interface
export interface Database {
  findUserById(id: number): Promise<any>;
  findUserByUsername(username: string): Promise<any>;

  createChatRoom(name: string | null, type: string, ownerId: number): Promise<any>;
  findChatRoomById(id: number): Promise<any>;
  getChatRoomsByUser(userId: number): Promise<any[]>;

  createMessage(content: string, userId: number, chatRoomId: number, type?: string, metadata?: string): Promise<any>;
  getMessagesByChatRoom(chatRoomId: number, userId: number, limit?: number): Promise<any[]>;
  getMessagesByChatRoomPaginated(chatRoomId: number, userId: number, limit?: number, offset?: number): Promise<any[]>;

  // User status management
  getUserStatus(userId: number): Promise<string>;
  updateUserStatus(userId: number, status: string): Promise<void>;
  getOnlineUsers(): Promise<any[]>;

  // Unread messages
  getUnreadMessageCount(userId: number, chatRoomId: number): Promise<number>;
  getAllUnreadCounts(userId: number): Promise<any[]>;
  incrementUnreadCount(userId: number, chatRoomId: number, messageId: number): Promise<void>;
  markMessagesAsRead(userId: number, chatRoomId: number): Promise<void>;

  // Blocking
  isUserBlocked(blockerId: number, blockedId: number): Promise<boolean>;

  // Game invitations
  createGameInvitation(senderId: number, receiverId: number, chatRoomId?: number): Promise<any>;
  getGameInvitationById(id: number): Promise<any>;
  updateGameInvitationStatus(id: number, status: string, gameRoomId?: string): Promise<any>;
  getUserGameInvitations(userId: number, status?: string): Promise<any[]>;

  // Tournament notifications
  createTournamentNotification(userId: number, tournamentId: number, title: string, message: string, type: string): Promise<any>;
  getUserTournamentNotifications(userId: number, unreadOnly?: boolean): Promise<any[]>;
  markNotificationAsRead(id: number): Promise<void>;

  close(): void;
}

// JWT Payload interface
export interface JWTPayload {
  id?: number;        // Used by Google OAuth
  userId?: number;    // Used by regular login
  username: string;
  email?: string;
  [key: string]: any;
}

// Extend Socket with user property
declare module 'socket.io' {
  interface Socket {
    user?: JWTPayload;
  }
}

// Extend Fastify instance
declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    db: Database;
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

// Socket event payloads
export interface JoinRoomPayload {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

export interface TypingPayload {
  roomId: string;
}

// Response types
export interface ApiResponse<T = any> {
  status: 'success' | 'error' | 'ok';
  message?: string;
  data?: T;
  error?: string;
}

// User status types
export type UserStatus = 'online' | 'offline' | 'in-game';

export interface UserStatusInfo {
  userId: number;
  status: UserStatus;
  username?: string;
  avatar?: string;
  lastSeen?: Date;
}

// Unread message types
export interface UnreadMessageInfo {
  userId: number;
  chatRoomId: number;
  unreadCount: number;
  lastMessageId?: number | null;
  updated_at: Date;
}

// Message history types
export interface MessageHistoryQuery {
  chatRoomId: number;
  limit?: number;
  offset?: number;
}

export interface MessageHistoryResponse {
  messages: any[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Socket event types
export interface TypingEvent {
  userId: number;
  roomId: string;
}

export interface UserStatusChangeEvent {
  userId: number;
  status: UserStatus;
  username?: string;
  avatar?: string;
}

export interface UnreadCountUpdateEvent {
  chatRoomId: number;
  unreadCount: number;
}
