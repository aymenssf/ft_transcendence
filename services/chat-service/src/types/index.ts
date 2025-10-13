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
