
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import socketioServer from "fastify-socket.io";
import { Socket } from "socket.io";
import loadSharedDb from "./loadSharedDb.js";

const app: FastifyInstance = Fastify({
    logger: true,
  });

const db = await loadSharedDb();

const onlineUsers = new Map<number, string>();

await app.register(cors);
await app.register(jwt, {
  secret: process.env.JWT_SECRET as string,
});

await app.register(socketioServer as any, {
  cors: {
    origin: "*",
    credentials: true
  }
});

app.decorate("authenticate", async function(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

app.ready().then(() => {
  app.io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = await app.jwt.verify(token) as any;

      socket.user = decoded as any;

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  app.io.on('connection', (socket: Socket) => {
    const userId = socket.user?.id;

    if (userId) {
      onlineUsers.set(userId, socket.id);
      app.log.info(`User ${userId} connected with socket ${socket.id}`);

      app.io.emit('online-users-count', onlineUsers.size);

      socket.broadcast.emit('user-online', { userId });
    }

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(userId);
        app.log.info(`User ${userId} disconnected`);

        app.io.emit('online-users-count', onlineUsers.size);

        socket.broadcast.emit('user-offline', { userId });
      }
    });

    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      app.log.info(`User ${userId} joined room ${roomId}`);
      socket.to(roomId).emit('user-joined-room', { userId, roomId });
    });

    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId);
      app.log.info(`User ${userId} left room ${roomId}`);
      socket.to(roomId).emit('user-left-room', { userId, roomId });
    });

    socket.on('send-message', async (data: { roomId: string; content: string }) => {
      try {
        const { roomId, content } = data;

        app.io.to(roomId).emit('new-message', {
          roomId,
          content,
          senderId: userId,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('typing', (roomId: string) => {
      socket.to(roomId).emit('user-typing', { userId, roomId });
    });

    socket.on('stop-typing', (roomId: string) => {
      socket.to(roomId).emit('user-stop-typing', { userId, roomId });
    });
  });
});

app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      service: 'chat-service',
      timestamp: new Date().toISOString()
    };
  });

app.get('/db-test', async (request, reply) => {
  try {
    const user = await db.findUserById(1);
    return {
      status: 'ok',
      message: 'Database connected successfully',
      sampleUser: user
    };
  } catch (error: any) {
    reply.status(500).send({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

app.get('/test/users', async (request, reply) => {
  try {
    const { prisma } = await import('@ft/shared-database');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        created_at: true
      }
    });

    return {
      status: 'success',
      count: users.length,
      users
    };
  } catch (error: any) {
    reply.status(500).send({
      status: 'error',
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

app.post('/test/chatroom', async (request: FastifyRequest<{
  Body: { name: string; type: string; ownerId: number }
}>, reply) => {
  try {
    const { name, type, ownerId } = request.body;

    const user = await db.findUserById(ownerId);
    if (!user) {
      return reply.status(404).send({
        status: 'error',
        message: 'User not found'
      });
    }

    const chatRoom = await db.createChatRoom(name, type, ownerId);

    return {
      status: 'success',
      message: 'Chat room created successfully',
      chatRoom
    };
  } catch (error: any) {
    reply.status(500).send({
      status: 'error',
      message: 'Failed to create chat room',
      error: error.message
    });
  }
});

app.get('/test/chatrooms/:userId', async (request: FastifyRequest<{
  Params: { userId: string }
}>, reply) => {
  try {
    const userId = parseInt(request.params.userId);

    if (isNaN(userId)) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid user ID'
      });
    }

    const chatRooms = await db.getChatRoomsByUser(userId);

    return {
      status: 'success',
      count: chatRooms.length,
      chatRooms
    };
  } catch (error: any) {
    reply.status(500).send({
      status: 'error',
      message: 'Failed to fetch chat rooms',
      error: error.message
    });
  }
});

app.get('/test/chatroom/:id', async (request: FastifyRequest<{
  Params: { id: string }
}>, reply) => {
  try {
    const id = parseInt(request.params.id);

    if (isNaN(id)) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid chat room ID'
      });
    }

    const chatRoom = await db.findChatRoomById(id);

    if (!chatRoom) {
      return reply.status(404).send({
        status: 'error',
        message: 'Chat room not found'
      });
    }

    return {
      status: 'success',
      chatRoom
    };
  } catch (error: any) {
    reply.status(500).send({
      status: 'error',
      message: 'Failed to fetch chat room',
      error: error.message
    });
  }
});

app.get('/protected', {
  preHandler: [app.authenticate]
}, async (request: any, reply) => {
  return {
    message: 'This is a protected route',
    user: request.user
  };
});

const start = async () => {
  try {
    await app.listen({ port: 3011, host: "0.0.0.0" });
    app.log.info("Chat Service running on port 3011");
    app.log.info("Database: SQLite (shared via Prisma)");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
