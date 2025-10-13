import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';

interface CreateChatRoomBody {
  name?: string;
  type: 'public' | 'private' | 'protected';
  password?: string;
  targetUserId?: number;
}

interface JoinChatRoomBody {
  password?: string;
}

export async function chatroomRoutes(app: FastifyInstance) {
  app.get('/api/chatrooms', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const { prisma } = await import('@ft/shared-database');

      const chatRooms = await prisma.chatRoom.findMany({
        where: {
          members: {
            some: { userId: userId }
          }
        },
        include: {
          _count: {
            select: {
              members: true,
              messages: true
            }
          },
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return { chatRooms };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch chat rooms',
        error: error.message
      });
    }
  });

  app.post('/api/chatrooms', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;
      const { name, type, password, targetUserId } = request.body as CreateChatRoomBody;

      if (!type || !['public', 'private', 'protected'].includes(type)) {
        return reply.status(400).send({ message: 'Invalid room type' });
      }

      if (type === 'private' && !targetUserId) {
        return reply.status(400).send({ message: 'Target user ID required for private chat' });
      }

      if (type === 'protected' && !password) {
        return reply.status(400).send({ message: 'Password required for protected chat' });
      }

      const { prisma } = await import('@ft/shared-database');

      if (type === 'private' && targetUserId) {
        const existingChat = await prisma.chatRoom.findFirst({
          where: {
            type: 'private',
            AND: [
              { members: { some: { userId: userId } } },
              { members: { some: { userId: targetUserId } } }
            ]
          }
        });

        if (existingChat) {
          return reply.status(400).send({
            message: 'A private chat already exists with this user',
            chatRoom: existingChat
          });
        }
      }

      let hashedPassword = null;
      if (type === 'protected' && password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const roomName = name || (type === 'private' ? 'Private Chat' : `${type} Room`);

      const chatRoom = await prisma.chatRoom.create({
        data: {
          name: roomName,
          type: type,
          ownerId: userId,
          password: hashedPassword,
          members: {
            create: [
              { userId: userId, role: 'owner' },
              ...(targetUserId ? [{ userId: targetUserId, role: 'member' }] : [])
            ]
          }
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true
                }
              }
            }
          },
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });      return {
        message: 'Chat room created successfully',
        chatRoom
      };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to create chat room',
        error: error.message
      });
    }
  });

  app.post('/api/chatrooms/:id/join', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;
      const { password } = request.body as JoinChatRoomBody;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      const { prisma } = await import('@ft/shared-database');

      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        include: {
          members: true
        }
      });

      if (!chatRoom) {        return reply.status(404).send({ message: 'Chat room not found' });
      }

      const isMember = chatRoom.members.some((m: any) => m.userId === userId);
      if (isMember) {        return reply.status(400).send({ message: 'Already a member of this room' });
      }

      if (chatRoom.type === 'protected') {
        if (!password || !chatRoom.password) {          return reply.status(400).send({ message: 'Password required' });
        }

        const passwordMatch = await bcrypt.compare(password, chatRoom.password);
        if (!passwordMatch) {          return reply.status(401).send({ message: 'Incorrect password' });
        }
      }

      if (chatRoom.type === 'private') {        return reply.status(403).send({ message: 'Cannot join private rooms' });
      }

      await prisma.chatRoomMember.create({
        data: {
          chatRoomId: roomId,
          userId: userId,
          role: 'member'
        }
      });      return { message: 'Joined chat room successfully' };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to join chat room',
        error: error.message
      });
    }
  });

  app.get('/api/chatrooms/:id/messages', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      const { prisma } = await import('@ft/shared-database');

      const membership = await prisma.chatRoomMember.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId: roomId,
            userId: userId
          }
        }
      });

      if (!membership) {        return reply.status(403).send({ message: 'Not a member of this chat room' });
      }

      // Get blocked users to filter messages
      const blockedUsers = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true }
      });

      const blockedIds = blockedUsers.map((b: any) => b.blockedId);

      const messages = await prisma.message.findMany({
        where: {
          chatRoomId: roomId,
          senderId: {
            notIn: blockedIds
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: {
          created_at: 'asc'
        }
      });      return { messages };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch messages',
        error: error.message
      });
    }
  });

  // Get chat room members
  app.get('/api/chatrooms/:id/members', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      const { prisma } = await import('@ft/shared-database');

      // Check if user is a member
      const membership = await prisma.chatRoomMember.findUnique({
        where: {
          chatRoomId_userId: {
            chatRoomId: roomId,
            userId: userId
          }
        }
      });

      if (!membership) {        return reply.status(403).send({ message: 'Not a member of this chat room' });
      }

      // Get all members
      const members = await prisma.chatRoomMember.findMany({
        where: { chatRoomId: roomId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar: true,
              email: true
            }
          }
        },
        orderBy: {
          joinedAt: 'asc'
        }
      });
      return { members };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch chat room members',
        error: error.message
      });
    }
  });
}
