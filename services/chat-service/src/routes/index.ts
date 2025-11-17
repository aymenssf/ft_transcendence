import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { userRoutes } from './user.js';
import { chatroomRoutes } from './chatroom.js';
import { gameRoutes } from './game.js';
import { tournamentRoutes } from './tournament.js';
import { friendsRoutes } from './friends.js';

export async function registerRoutes(app: FastifyInstance) {
  await healthRoutes(app);
  await userRoutes(app);
  await chatroomRoutes(app);
  await gameRoutes(app);
  await tournamentRoutes(app);
  await friendsRoutes(app);
}
