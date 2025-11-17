import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
// import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@ft/shared-database';
import { AuthError, verifyPassword } from "./registered_users.js";
import { updateUserHandler, type UpdateUserBody } from './user_update.js';
import { validateUsername, validateEmail, validatePassword, ValidationError, hashPassword } from './loadSharedDb.js';

const DEFAULT_AVATAR_REL = 'avatar/default_avatar/default_avatar.jpg';
// Instantiate Prisma client (singleton per module)
// const prisma = new PrismaClient();

interface RegisterBody { username: string; email: string; password: string; avatar?: string | null; usernameTournament?: string }
interface LoginBody { username: string; email: string; password: string }


export function registerControllers(app: FastifyInstance) 
{
  const randomUserId = () => crypto.randomInt(1, 2147483647);

  app.post("/register", async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => { 
    const { username, email, password, avatar = null } = request.body;
    try {
      validateUsername(username);
      // tournament username: validate (use provided or default to username)
      const tUsernameInput = (request.body as any).usernameTournament as string | undefined;
      const tUsername = (typeof tUsernameInput === 'string' && tUsernameInput.trim() !== '') ? tUsernameInput : username;
      // validate tournament username via loadSharedDb validator
      try {
        const { validateTournamentUsername } = await import('./loadSharedDb.js');
        validateTournamentUsername(tUsername);
      } catch (e) {
        throw new ValidationError((e as any)?.message || 'Invalid tournament username');
      }
      validateEmail(email);
      validatePassword(password);

      // Check existing user/email (explicit for user-friendly messages)
      const existingUser = await prisma.user.findUnique({ where: { username } });
      if (existingUser)  
        throw new ValidationError('Username already exists');
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) 
        throw new ValidationError('Email already exists');
      const existingTournament = await prisma.user.findUnique({ where: { usernameTournament: tUsername } });
      if (existingTournament)
        throw new ValidationError('Tournament username already exists');

      const hashedPassword = await hashPassword(password);

      const avatarValue = (typeof avatar === 'string' && avatar.trim() !== '')
        ? avatar
        : DEFAULT_AVATAR_REL;
        
      // Create user with random integer ID, retry on rare ID collision
      let user: { id: number; username: string; email: string; avatar: string | null; created_at: Date };
      for (let attempt = 0; ; attempt++) {
        const id = randomUserId();
        try {
          user = await prisma.user.create({
            data: { id, username, email, password: hashedPassword, avatar: avatarValue, usernameTournament: tUsername },
            select: { id: true, username: true, email: true, avatar: true, usernameTournament: true, created_at: true }
          }) as any;
          break;
        } catch (err: any) {
          // P2002 unique constraint violation could be on id (collision) or username/email
          if (err?.code === 'P2002' && err?.meta?.target && Array.isArray(err.meta.target) && err.meta.target.includes('id')) {
            if (attempt < 5) continue; // try a few times with new random id
          }
          throw err;
        }
      }
      
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

      // Ensure avatar present (fallback to default)
      const rawAvatar = (user as any).avatar;
      const avatarValue = (typeof rawAvatar === 'string' && rawAvatar.trim() !== '')
        ? rawAvatar
        : DEFAULT_AVATAR_REL;

      // Optionally persist default avatar if it was missing
      if (!rawAvatar || (typeof rawAvatar === 'string' && rawAvatar.trim() === '')) {
        try {
          await prisma.user.update({ where: { id: user.id }, data: { avatar: avatarValue } });
        } catch {}
      }

      const token = app.jwt.sign({
        userId: user.id,
        username: user.username,
        email: user.email,
        avatar: avatarValue,
        usernameTournament: (user as any).usernameTournament ?? null,
        provider: 'local',
      }, { expiresIn: '7d' });
      reply.header('Authorization', `Bearer ${token}`);
      return reply.send({
        token,
        token_type: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: avatarValue,
          usernameTournament: (user as any).usernameTournament ?? null,
        },
      });
    } catch (err: any) {
      if (err instanceof AuthError) 
        return reply.status(err.status).send({ error: err.message });
      request.log.error({ err }, 'Login error');
      return reply.code(500).send({ error: 'Login failed' });
    }
  });

  // GET /me - Get current authenticated user profile
  app.get("/me", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Verify JWT token
      const decoded = await request.jwtVerify() as any;
      
      // Fetch user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          usernameTournament: true,
          created_at: true,
          is_42_user: true
          // Don't include password!
        }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Ensure avatar has a value
      const avatarValue = (typeof user.avatar === 'string' && user.avatar.trim() !== '')
        ? user.avatar
        : DEFAULT_AVATAR_REL;

      return reply.send({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: avatarValue,
        usernameTournament: user.usernameTournament,
        created_at: user.created_at,
        is_42_user: user.is_42_user
      });
    } catch (err: any) {
      if (err.name === 'UnauthorizedError' || err.message?.includes('token')) {
        return reply.status(401).send({ error: 'Unauthorized - Invalid or expired token' });
      }
      request.log.error({ err }, 'Get user profile error');
      return reply.status(500).send({ error: 'Failed to fetch user profile' });
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
