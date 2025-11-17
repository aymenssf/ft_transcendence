import 'fastify';
import { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
