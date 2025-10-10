import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import socketioServer from 'fastify-socket.io';
import loadSharedDb from '../loadSharedDb.js';
import { config } from './config/index.js';
import { authenticateJWT } from './middleware/auth.js';
import { initializeSocketIO } from './socket/handler.js';
import { registerRoutes } from './routes/index.js';

const app = Fastify({
  logger: true,
});

// Initialize database
const db = await loadSharedDb();

// Register plugins
await app.register(cors, config.cors);
await app.register(jwt, {
  secret: config.jwt.secret,
});
await app.register(socketioServer as any, {
  cors: config.socketio.cors,
});

// Decorate Fastify instance with custom properties
app.decorate('db', db);
app.decorate('authenticate', authenticateJWT);

// Initialize Socket.IO
initializeSocketIO(app);

// Register routes
await registerRoutes(app);

// Start server
const start = async () => {
  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    app.log.info(`Chat Service running on port ${config.server.port}`);
    app.log.info('Database: SQLite (shared via Prisma)');
    app.log.info('Socket.IO: Enabled with JWT authentication');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
