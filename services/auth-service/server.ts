import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { registerControllers } from "./controler.js";

async function bootstrap() {
  const app = Fastify({ logger: true });
  await app.register(cors);
await app.register(jwt, { 
    secret: process.env.JWT_SECRET as string
  });  
  registerControllers(app);
  try {
    await app.listen({ port: 3010, host: "0.0.0.0" });
    app.log.info("Auth Service running on port 3010");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();