import { PrismaClient } from '@prisma/client';
import crypto from "crypto";

// Export prisma so other modules (e.g., user_update) can reuse the same instance
export const prisma = new PrismaClient();

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password: string;
  avatar?: string | null;
  is_42_user?: boolean;
  created_at?: Date;
}

export interface DB {
  createUser(
    username: string,
    email: string,
    password: string
  ): Promise<{ id: number; username: string; email: string }>;
  findUserByUsername(username: string): Promise<UserRow | undefined>;
  findEmailByEmail(email: string): Promise<UserRow | undefined>;
  close(): void;
}

export interface SubscribeInput {
  username: string;
  email: string;
  password: string;
  avatar?: string | null;
}

export interface PublicUser {
  id: number;
  username: string;
  email: string;
  avatar?: string | null;
  created_at?: Date;
}

export interface SecureDB extends DB {
  subscribe(input: SubscribeInput): Promise<PublicUser>;
}

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateUsername(u: string) {
  if (!u)
    throw new ValidationError("Username is required and cannot be empty");
  if (u.length < 3 || u.length > 20)
    throw new ValidationError("Username must be between 3 and 20 characters");
  if (!/^[a-zA-Z0-9_]+$/.test(u))
    throw new ValidationError("Username can only contain letters, numbers, and underscores");
}

export function validateEmail(e: string) {
  if (!e)
    throw new ValidationError("Email is required and cannot be empty");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new ValidationError("Email is not valid");
}

export function validatePassword(p: string) {
  if (!p)
    throw new ValidationError("Password is required and cannot be empty");
  if (p.length < 8)
    throw new ValidationError("Password must be at least 8 characters long");
  if (!/[A-Z]/.test(p))
    throw new ValidationError("Password must contain at least one uppercase letter");
  if (!/[a-z]/.test(p))
    throw new ValidationError("Password must contain at least one lowercase letter");
  if (!/[0-9]/.test(p))
    throw new ValidationError("Password must contain at least one number");
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const bcrypt = await import("bcrypt").then(m => m.default || m);
    if (typeof bcrypt.hash === "function") {
      return await bcrypt.hash(password, 12);
    }
    throw new Error("bcrypt hash function not found");
  } catch {
    const salt = crypto.randomBytes(16).toString("hex");
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$1$${salt}$${derivedKey.toString("hex")}`);
      });
    });
  }
}

function createPrismaDB(): SecureDB {
  return {
    async createUser(username: string, email: string, password: string) {
      const user = await prisma.user.create({
        data: { username, email, password },
        select: { id: true, username: true, email: true }
      });
      return user;
    },

    async findUserByUsername(username: string): Promise<UserRow | undefined> {
      const user = await prisma.user.findUnique({
        where: { username }
      });
      return user || undefined;
    },

    async findEmailByEmail(email: string): Promise<UserRow | undefined> {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      return user || undefined;
    },

    async subscribe(input: SubscribeInput): Promise<PublicUser> {
      const { username, email, password, avatar = null } = input;
      
      validateUsername(username);
      validateEmail(email);
      validatePassword(password);

      const existingUser = await prisma.user.findUnique({
        where: { username }
      });
      if (existingUser) 
        throw new ValidationError("Username already exists");

      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });
      if (existingEmail) 
        throw new ValidationError("Email already exists");

      const hashedPassword = await hashPassword(password);

      try {
        const user = await prisma.user.create({
          data: {
            username,
            email,
            password: hashedPassword,
            avatar
          },
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            created_at: true
          }
        });
        return user;
      } catch (err: any) {
        if (err.code === 'P2002') {
          const field = err.meta?.target?.[0];
          if (field === 'username')
            throw new ValidationError("Username already exists");
          if (field === 'email')
            throw new ValidationError("Email already exists");
        }
        throw err;
      }
    },

    close() {
      prisma.$disconnect();
    }
  };
}

export default async function loadSharedDb(): Promise<SecureDB> {
  return createPrismaDB();
}