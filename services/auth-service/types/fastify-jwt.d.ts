// Augment Fastify instance for jwt plugin typings
import "@fastify/jwt";
import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    jwt: {
      sign(payload: unknown, options?: unknown): string;
      // you can add verify() etc if you use them
    };
  }
}
