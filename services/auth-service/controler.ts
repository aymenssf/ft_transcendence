import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SecureDB } from "./loadSharedDb.js";
import { AuthError, loginUser } from "./registered_users.js";

interface RegisterBody { username: string; email: string; password: string; avatar?: string | null }
interface LoginBody { username: string; password: string }

export function registerControllers(app: FastifyInstance, db: SecureDB) 
{
  app.get("/test", async (_req, reply) => {
    reply.code(200).send({ ok: true, service: "auth-service", status: "running" });
  });

  app.post("/register", async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
    const { username, email, password, avatar } = request.body;
    try 
    {
      const user = await db.subscribe({ username, email, password, avatar });
      request.log.info({ userId: user.id }, "New user created");
      return reply.send({ message: "User registered successfully", user });
    } 
    catch (err: any) {
      if (err?.name === "ValidationError") 
        return reply.status(400).send({ error: err.message });
      request.log.error({ err }, "Register error");
      return reply.code(500).send({ error: "Registration failed" });
    }
  });

  app.post("/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    try 
    {
      const { username, password } = request.body;
      if (!username || !password) 
        throw new AuthError("Invalid credentials");
      const result = await loginUser({ db, username, password, sign: (payload, options) => app.jwt.sign(payload, options) });
      return reply.send(result);
    } 
    catch (err: any) {
      if (err instanceof AuthError) 
        return reply.status(err.status).send({ error: err.message });
      request.log.error({ err }, "Login error");
      return reply.code(500).send({ error: "Login failed" });
    }
  });
}

export default { registerControllers, AuthError, loginUser };
