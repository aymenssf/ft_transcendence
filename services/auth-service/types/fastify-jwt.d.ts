import "@fastify/jwt";
import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    jwt: {
      sign(payload: unknown, options?: unknown): string;
    };
  }
}
