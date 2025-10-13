import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface BlockUserBody {
  blockedId: number;
}

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/users', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
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

      return { users };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch users',
        error: error.message
      });
    }
  });

  app.post('/api/users/block', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { blockedId } = request.body as BlockUserBody;
      const userId = request.user.id;

      if (!blockedId) {
        return reply.status(400).send({ message: 'Blocked user ID is required' });
      }

      if (userId === blockedId) {
        return reply.status(400).send({ message: 'Cannot block yourself' });
      }

      const { prisma } = await import('@ft/shared-database');

      const existing = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: blockedId
          }
        }
      });

      if (existing) {
        return reply.status(400).send({ message: 'User already blocked' });
      }

      const block = await prisma.block.create({
        data: {
          blockerId: userId,
          blockedId: blockedId
        }
      });

      return {
        message: 'User blocked successfully',
        block
      };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to block user',
        error: error.message
      });
    }
  });

  app.post('/api/users/unblock', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { blockedId } = request.body as BlockUserBody;
      const userId = request.user.id;

      if (!blockedId) {
        return reply.status(400).send({ message: 'Blocked user ID is required' });
      }

      const { prisma } = await import('@ft/shared-database');

      await prisma.block.delete({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: blockedId
          }
        }
      });

      return { message: 'User unblocked successfully' };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to unblock user',
        error: error.message
      });
    }
  });

  app.get('/api/users/blocked', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const userId = request.user.id;

      const { prisma } = await import('@ft/shared-database');

      const blocks = await prisma.block.findMany({
        where: { blockerId: userId },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true
            }
          }
        }
      });

      return { blockedUsers: blocks };
    } catch (error: any) {
      reply.status(500).send({
        message: 'Failed to fetch blocked users',
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

  // Get user profile with stats
  app.get('/api/users/:id/profile', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const targetUserId = parseInt(request.params.id);

      if (isNaN(targetUserId)) {
        return reply.status(400).send({ message: 'Invalid user ID' });
      }

      const { prisma } = await import('@ft/shared-database');

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          created_at: true,
          is_42_user: true
        }
      });

      if (!user) {
        return reply.status(404).send({ message: 'User not found' });
      }

      // TODO: Fetch game statistics from game-service
      // For now, return placeholder stats
      const stats = {
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        winRate: 0,
        tournamentWins: 0,
        rank: 'Beginner'
      };

      return {
        user: {
          ...user,
          stats
        }
      };
    } catch (error: any) {
      app.log.error('Error fetching user profile:', error);
      reply.status(500).send({
        message: 'Failed to fetch user profile',
        error: error.message
      });
    }
  });

  // Get online users
  app.get('/api/users/online', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
    try {
      const { onlineUsers } = await import('../socket/handler.js');

      const onlineUserIds = Array.from(onlineUsers.keys());

      if (onlineUserIds.length === 0) {
        return { users: [], count: 0 };
      }

      const { prisma } = await import('@ft/shared-database');

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: onlineUserIds
          }
        },
        select: {
          id: true,
          username: true,
          avatar: true
        }
      });

      return {
        users,
        count: users.length
      };
    } catch (error: any) {
      app.log.error('Error fetching online users:', error);
      reply.status(500).send({
        message: 'Failed to fetch online users',
        error: error.message
      });
    }
  });
}
