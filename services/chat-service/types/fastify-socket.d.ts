import 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import type { ChatDB } from '../loadSharedDb.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    db: ChatDB;
  }
}

declare module 'socket.io' {
  interface Socket {
    user?: {
      id: number;
      username: string;
      email: string;
      [key: string]: any;
    };
  }
}
