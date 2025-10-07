
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import loadSharedDb from "./loadSharedDb.js";

const app: FastifyInstance = Fastify({
    logger: true,
  });

const db = await loadSharedDb();

await app.register(cors);
await app.register(jwt, {
  secret: process.env.JWT_SECRET || "transcendence-secret-key",
});

app.decorate("authenticate", async function(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Health check
app.get('/health', async (request, reply) => {
    return { 
      status: 'ok', 
      service: 'chat-service', 
      timestamp: new Date().toISOString() 
    };
  });
  
// Database connection test
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
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        created_at: true
      }
    });
    
    await prisma.$disconnect();
    
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

// Test endpoint: Create a test chat room
app.post('/test/chatroom', async (request: FastifyRequest<{
  Body: { name: string; type: string; ownerId: number }
}>, reply) => {
  try {
    const { name, type, ownerId } = request.body;
    
    // First check if the user exists
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

// Test endpoint: Get chat rooms by user
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

// Test endpoint: Get a specific chat room
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