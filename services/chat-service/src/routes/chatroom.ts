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

      // Fetch rooms in two queries:
      // 1. All public/protected rooms (everyone can see these)
      // 2. Private rooms where user is a member
      const [publicRooms, privateRooms] = await Promise.all([
        // Get all public and protected rooms
        prisma.chatRoom.findMany({
          where: {
            type: {
              in: ['public', 'protected']
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
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true
                  }
                }
              }
            }
          }
        }),
        // Get private rooms where user is a member
        prisma.chatRoom.findMany({
          where: {
            type: 'private',
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
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true
                  }
                }
              }
            }
          }
        })
      ]);

      // Combine both arrays and sort by created_at
      const allRooms = [...publicRooms, ...privateRooms].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Map rooms to include ownerId at top level for easier access
      const roomsWithOwnerId = allRooms.map(room => ({
        ...room,
        ownerId: room.ownerId // Ensure ownerId is at top level
      }));

      return { chatRooms: roomsWithOwnerId };
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

      // Check if users are friends for private chat
      if (type === 'private' && targetUserId) {
        const friendship = await prisma.friend.findUnique({
          where: {
            userId_friendId: {
              userId: userId,
              friendId: targetUserId
            }
          }
        });

        if (!friendship) {
          return reply.status(403).send({
            message: 'You can only create private chats with friends. Send them a friend request first.'
          });
        }
      }

      if (type === 'private' && targetUserId) {
        const existingChat = await prisma.chatRoom.findFirst({
          where: {
            type: 'private',
            AND: [
              { members: { some: { userId: userId } } },
              { members: { some: { userId: targetUserId } } }
            ]
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
        });

        if (existingChat) {
          // Return the existing chat instead of an error
          return reply.status(200).send({
            message: 'Using existing private chat',
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
      });

      // Broadcast room creation to all connected users (only for public/protected rooms)
      if (type === 'public' || type === 'protected') {
        const roomData = {
          room: {
            id: chatRoom.id,
            name: chatRoom.name,
            type: chatRoom.type,
            ownerId: chatRoom.ownerId
          }
        };
        app.io.emit('room-created', roomData);
      }

      return {
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
      const limit = parseInt(request.query.limit) || 50;
      const offset = parseInt(request.query.offset) || 0;

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

      // Use the paginated method from the database
      const messages = await app.db.getMessagesByChatRoomPaginated(roomId, userId, limit, offset);

      // Reverse messages for chronological order (newest first was fetched)
      messages.reverse();

      return {
        messages,
        limit,
        offset,
        hasMore: messages.length === limit
      };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch messages',
        error: error.message
      });
    }
  });

  // Get unread message count for a chat room
  app.get('/api/chatrooms/:id/unread-count', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      const unreadCount = await app.db.getUnreadMessageCount(userId, roomId);

      return {
        chatRoomId: roomId,
        unreadCount
      };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch unread count',
        error: error.message
      });
    }
  });

  // Get all unread counts for user
  app.get('/api/chatrooms/unread-counts', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;

      const unreadCounts = await app.db.getAllUnreadCounts(userId);

      return { unreadCounts };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch unread counts',
        error: error.message
      });
    }
  });

  // Mark messages as read
  app.post('/api/chatrooms/:id/mark-read', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      await app.db.markMessagesAsRead(userId, roomId);

      return {
        message: 'Messages marked as read',
        chatRoomId: roomId
      };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to mark messages as read',
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

  // Delete chat room
  app.delete('/api/chatrooms/:id', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const roomId = parseInt(request.params.id);
      const userId = request.user.id;

      if (isNaN(roomId)) {
        return reply.status(400).send({ message: 'Invalid room ID' });
      }

      const { prisma } = await import('@ft/shared-database');

      // Get the chat room with owner info
      const chatRoom = await prisma.chatRoom.findUnique({
        where: { id: roomId },
        include: {
          members: true
        }
      });

      if (!chatRoom) {
        return reply.status(404).send({ message: 'Chat room not found' });
      }

      // Don't allow deleting the General room
      if (chatRoom.name === 'General') {
        return reply.status(400).send({ message: 'Cannot delete the General room' });
      }

      // Check if user is the owner
      if (chatRoom.ownerId !== userId) {
        return reply.status(403).send({ message: 'Only the room owner can delete this room' });
      }

      // Don't allow deleting private rooms
      if (chatRoom.type === 'private') {
        return reply.status(400).send({ message: 'Cannot delete private chat rooms' });
      }

      // Delete all members first (foreign key constraint)
      await prisma.chatRoomMember.deleteMany({
        where: { chatRoomId: roomId }
      });

      // Delete all messages
      await prisma.message.deleteMany({
        where: { chatRoomId: roomId }
      });

      // Delete the room
      await prisma.chatRoom.delete({
        where: { id: roomId }
      });

      // Broadcast room deletion to all connected users
      app.io.emit('room-deleted', { roomId });

      return { message: 'Chat room deleted successfully' };
    } catch (error: any) {
      console.error('Error deleting chat room:', error);
      reply.status(500).send({
        message: 'Failed to delete chat room',
        error: error.message
      });
    }
  });
}
