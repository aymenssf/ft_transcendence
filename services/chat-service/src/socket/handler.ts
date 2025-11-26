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
  app.io.on('connection', async (socket: Socket) => {
    // Support both 'userId' and 'id' fields from JWT
    const userId = socket.user?.userId || socket.user?.id;

    if (userId) {
      socket.join(socket.id);
      onlineUsers.set(userId, socket.id);
      app.log.info(`User ${userId} connected with socket ${socket.id}`);

      // Update user status to online in database
      try {
        await app.db.updateUserStatus(userId, 'online');
        // Auto-join user to General room
        // @ts-ignore - joinGeneralRoom added to ChatDB interface
        if (typeof app.db.joinGeneralRoom === 'function') {
          // @ts-ignore
          await app.db.joinGeneralRoom(userId);
        }
      } catch (error: any) {
        app.log.error(`Failed to update user status for user ${userId}:`, error);
      }

      // Broadcast online users count
      app.io.emit('online-users-count', onlineUsers.size);

      // Get user info and broadcast user is online
      try {
        const user = await app.db.findUserById(userId);
        socket.broadcast.emit('user-status-change', {
          userId,
          status: 'online',
          username: user?.username,
          avatar: user?.avatar
        });

        // Notify friends specifically (if they are online)
        try {
          const friendIds = await app.db.getFriendIds(userId);
          app.log.info(`User ${userId} has ${friendIds.length} friends, notifying them of online status`);
          for (const fid of friendIds)
          {
            const sid = onlineUsers.get(fid);
            if (sid) {
              app.log.info(`  → Notifying friend ${fid} (socket ${sid}) that user ${userId} is online`);
              app.io.to(sid).emit('friend-status-change', { userId, status: 'online' });
            } else {
              app.log.info(`  → Friend ${fid} is offline, skipping notification`);
            }
          }
        } catch (e: any) {
          app.log.warn('Failed notifying friends about online status', e);
        }
      } catch (error: any) {
        app.log.error(`Failed to get user info for user ${userId}:`, error);
      }
    }

    // Register all socket events
    registerSocketEvents(app, socket);

    // Handle disconnect
    socket.on('disconnect', async () => {
      if (userId) {
        onlineUsers.delete(userId);
        app.log.info(`User ${userId} disconnected`);

        // Update user status to offline in database
        try {
          await app.db.updateUserStatus(userId, 'offline');
        } catch (error: any) {
          app.log.error(`Failed to update user status for user ${userId}:`, error);
        }

        // Broadcast updated online users count
        app.io.emit('online-users-count', onlineUsers.size);

        // Notify user is offline
        socket.broadcast.emit('user-status-change', {
          userId,
          status: 'offline'
        });

        // Notify friends specifically (if they are online)
        try {
          const friendIds = await app.db.getFriendIds(userId);
          app.log.info(`User ${userId} disconnected, has ${friendIds.length} friends, notifying them of offline status`);
          for (const fid of friendIds) {
            const sid = onlineUsers.get(fid);
            if (sid) {
              app.log.info(`  → Notifying friend ${fid} (socket ${sid}) that user ${userId} is offline`);
              app.io.to(sid).emit('friend-status-change', { userId, status: 'offline' });
            }
          }
        } catch (e: any) {
          app.log.warn('Failed notifying friends about offline status', e);
        }
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
