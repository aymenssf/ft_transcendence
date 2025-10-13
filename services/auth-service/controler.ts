import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
// import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@ft/shared-database';
import { AuthError, verifyPassword } from "./registered_users.js";
import { updateUserHandler, type UpdateUserBody } from './user_update.js';
import { validateUsername, validateEmail, validatePassword, ValidationError, hashPassword } from './loadSharedDb.js';

// Instantiate Prisma client (singleton per module)
// const prisma = new PrismaClient();

interface RegisterBody { username: string; email: string; password: string; avatar?: string | null }
interface LoginBody { username: string; email: string; password: string }


export function registerControllers(app: FastifyInstance) 
{
  app.get("/test", async (_req, reply) => {
    reply.code(200).send({ ok: true, service: "auth-service", status: "running" });
  });

  app.post("/register", async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => { 
    const { username, email, password, avatar = null } = request.body;
    try {
      validateUsername(username);
      validateEmail(email);
      validatePassword(password);

      // Check existing user/email (explicit for user-friendly messages)
      const existingUser = await prisma.user.findUnique({ where: { username } });
      if (existingUser)  
        throw new ValidationError('Username already exists');
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) 
        throw new ValidationError('Email already exists');

      const hashedPassword = await hashPassword(password);

      const user = await prisma.user.create({
        data: { username, email, password: hashedPassword, avatar },
        select: { id: true, username: true, email: true, avatar: true, created_at: true }
      });

      request.log.info({ userId: user.id }, 'New user created');
      return reply.send({ message: 'User registered successfully', user });
    } catch (err: any) {
      if (err?.name === 'ValidationError') 
        return reply.status(400).send({ error: err.message });
      // Prisma unique constraint
      if (err?.code === 'P2002') 
      {
        const field = err.meta?.target?.[0];
        if (field === 'username')  
          return reply.status(400).send({ error: 'Username already exists' });
        if (field === 'email') 
          return reply.status(400).send({ error: 'Email already exists' });
      }
      request.log.error({ err }, 'Register error');
      return reply.code(500).send({ error: 'Registration failed' });
    }
  });

  app.post("/login", async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    try {
      const { username, email, password } = request.body;
      if ((!username && !email) || !password) 
        throw new AuthError('Invalid credentials');

      let user = null as any;
      if (username) 
      {
        user = await prisma.user.findUnique({ where: { username } });
        if (!user) 
          throw new AuthError('Invalid username');  
      } 
      else if (email) 
      {
        user = await prisma.user.findUnique({ where: { email } });
        if (!user) 
          throw new AuthError('Invalid email');  
      }

      const isValid = await verifyPassword(user.password, password);
      if (!isValid) 
        throw new AuthError('Invalid password');

      const token = app.jwt.sign({ userId: user.id, username: user.username }, { expiresIn: '7d' });
      reply.header('Authorization', `Bearer ${token}`);
      return reply.send({
        token,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: (user as any).avatar ?? null,
        },
      });
    } catch (err: any) {
      if (err instanceof AuthError) 
        return reply.status(err.status).send({ error: err.message });
      request.log.error({ err }, 'Login error');
      return reply.code(500).send({ error: 'Login failed' });
    }
  });

  // Update current authenticated user (depends on user_update.ts logic)
  app.put("/user/update", async (request: FastifyRequest<{ Body: UpdateUserBody }>, reply: FastifyReply) => {
    try {
      await (request as any).jwtVerify();
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return updateUserHandler(request as any, reply);
  });

  // Graceful shutdown to release Prisma connections
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
export default { registerControllers, AuthError };
