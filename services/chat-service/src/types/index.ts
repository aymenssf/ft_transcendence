import { Server as SocketIOServer, Socket as SocketIOSocket } from 'socket.io';
import { FastifyInstance as OriginalFastifyInstance } from 'fastify';

// Database interface
export interface Database {
  findUserById(id: number): Promise<any>;
  createChatRoom(name: string, type: string, ownerId: number): Promise<any>;
  findChatRoomById(id: number): Promise<any>;
  getChatRoomsByUser(userId: number): Promise<any[]>;
}

// JWT Payload interface
export interface JWTPayload {
  id: number;
  username: string;
  email: string;
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
