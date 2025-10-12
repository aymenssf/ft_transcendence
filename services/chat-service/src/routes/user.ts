import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface BlockUserBody {
  blockedId: number;
}

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/users', {
    preHandler: [app.authenticate]
  }, async (request: any, reply) => {
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

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      const existing = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: blockedId
          }
        }
      });

      if (existing) {
        await prisma.$disconnect();
        return reply.status(400).send({ message: 'User already blocked' });
      }

      const block = await prisma.block.create({
        data: {
          blockerId: userId,
          blockedId: blockedId
        }
      });

      await prisma.$disconnect();

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

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

      await prisma.block.delete({
        where: {
          blockerId_blockedId: {
            blockerId: userId,
            blockedId: blockedId
          }
        }
      });

      await prisma.$disconnect();

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

      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();

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

      await prisma.$disconnect();

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
}
