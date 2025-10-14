import Fastify, { fastify } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { registerControllers } from "./controler.js";
import { GoogleAuthRoutes } from "./src/routes/google-auth.routes.js";

async function bootstrap() {
  const app = Fastify({ logger: true });

 await app.register(cors, {
    origin: '*', // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });


  await app.register(jwt, {
    secret: process.env.JWT_SECRET as string
  });



await app.register(GoogleAuthRoutes);


  registerControllers(app);
  app.get('/test', async (_req, _reply) => {
    return { ok: true, service: 'auth-service', status: 'running' };
  });
  // Serve default avatars and any uploaded avatars from /avatar
  await app.register((fastifyStatic as any), {
    root: path.resolve(process.cwd(), 'avatar'),
    prefix: '/avatar/',
  } as any);
  try {
    await app.listen({ port: 3010, host: "0.0.0.0" });
    app.log.info("Auth Service running on port 3010");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
