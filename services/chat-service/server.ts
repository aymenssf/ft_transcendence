import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import loadSharedDb from "./loadSharedDb.js";

const app: FastifyInstance = Fastify({
    logger: true,
  });

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

app.get('/health', async (request, reply) => {
    return { 
      status: 'ok', 
      service: 'chat-service', 
      timestamp: new Date().toISOString() 
    };
  });
  
  app.get('/db-test', async (request, reply) => {
    try {
      return { 
        status: 'ok', 
        message: 'Database connected and tables initialized' 
      };
    } catch (error) {
      reply.status(500).send({ 
        status: 'error', 
        message: 'Database connection failed' 
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
      app.log.info("Auth Service running on port 3011");
      app.log.info("Database: SQLite (shared)");
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  
  start();