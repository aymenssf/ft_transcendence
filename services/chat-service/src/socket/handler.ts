import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { Socket } from 'socket.io';
import { registerSocketEvents } from './events.js';

// In-memory map for tracking online users
export const onlineUsers = new Map<number, string>();

export function setupSocketAuthentication(app: FastifyInstance) {
  app.io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token;

      app.log.info(`Socket authentication attempt, token present: ${!!token}`);

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token using Fastify's jwt.verify
      const decoded = await app.jwt.verify(token) as any;

      app.log.info(`JWT decoded:`, decoded);

      // Attach user payload to socket
      socket.user = decoded as any;

      next();
    } catch (error: any) {
      app.log.error(`Socket authentication error:`, error);
      next(new Error('Authentication error: Invalid token'));
    }
  });
}

export function setupSocketConnection(app: FastifyInstance) {
  app.io.on('connection', (socket: Socket) => {
    // Support both 'userId' and 'id' fields from JWT
    const userId = socket.user?.userId || socket.user?.id;

    if (userId) {
      // Add user to online users map
      onlineUsers.set(userId, socket.id);
      app.log.info(`User ${userId} connected with socket ${socket.id}`);

      // Broadcast online users count
      app.io.emit('online-users-count', onlineUsers.size);

      // Notify user is online
      socket.broadcast.emit('user-online', { userId });
    }

    // Register all socket events
    registerSocketEvents(app, socket);

    // Handle disconnect
    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        app.log.info(`User ${userId} disconnected`);

        // Broadcast updated online users count
        app.io.emit('online-users-count', onlineUsers.size);

        // Notify user is offline
        socket.broadcast.emit('user-offline', { userId });
      }
    });
  });
}

export function initializeSocketIO(app: FastifyInstance) {
  app.ready().then(() => {
    setupSocketAuthentication(app);
    setupSocketConnection(app);
    app.log.info('Socket.IO initialized successfully');
  });
}
