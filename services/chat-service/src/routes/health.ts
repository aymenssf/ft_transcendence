import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
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
      const db = app.db;
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
}
