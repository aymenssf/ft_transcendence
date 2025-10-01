import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcrypt";
import loadSharedDb from "./loadSharedDb.js";

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

const app: FastifyInstance = Fastify({
  logger: true,
});

await app.register(cors);
await app.register(jwt, {
  secret: process.env.JWT_SECRET || "transcendence-secret-key",
});

app.get("/test", async (_request: FastifyRequest, reply: FastifyReply) => {
  reply.code(200).send({ ok: true, service: "auth-service", status: "running" });
});

// Load shared DB once at startup
const db = await loadSharedDb();

app.post("/register", async (
  request: FastifyRequest<{ Body: RegisterBody }>
  ,  reply: FastifyReply
  ) => {
  const { username, email, password } = request.body;
  try {
    const user = await db.subscribe({ username, email, password }); // avatar optional
    request.log.info({ userId: user.id }, "New user created");
    return reply.send({
      message: "User registered successfully",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar ?? null,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    if (err.name === "ValidationError") {
      return reply.status(400).send({ error: err.message });
    }
    request.log.error({ err }, "Register error");
    return reply.code(500).send({ error: "Registration failed" });
  }
});


app.post(
  "/login",
  async (
    request: FastifyRequest<{ Body: LoginBody }>,
    reply: FastifyReply
  ) => {
  const { username, password } = request.body;

  try {
  const user: any = await db.findUserByUsername(username);
    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign(
      { userId: user.id, username: user.username },
      { expiresIn: "7d" }
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    request.log.error({ error }, "Login error");
    return reply.code(500).send({ error: "Login failed" });
  }
}
);

const start = async () => {
  try {
    await app.listen({ port: 3010, host: "0.0.0.0" });
    app.log.info("Auth Service running on port 3010");
    app.log.info("Database: SQLite (shared)");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();