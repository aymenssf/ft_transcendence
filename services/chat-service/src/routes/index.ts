import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { userRoutes } from './user.js';
import { chatroomRoutes } from './chatroom.js';

export async function registerRoutes(app: FastifyInstance) {
  await healthRoutes(app);
  await userRoutes(app);
  await chatroomRoutes(app);
}
