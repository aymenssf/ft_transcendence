// Helper to dynamically load the shared SQLite DB regardless of runtime location (TS vs compiled dist)
import { URL } from "url";
import crypto from "crypto";

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password: string;
  avatar?: string | null;
  is_42_user?: 0 | 1 | boolean;
  created_at?: string;
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
  created_at?: string;
}

export interface SecureDB extends DB {
  subscribe(input: SubscribeInput): Promise<PublicUser>;
}

class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function validateUsername(u: string) {
  if (!u)
    throw new ValidationError("Username is required and cannot be empty");
  if (u.length < 3 || u.length > 20)
    throw new ValidationError("Username must be between 3 and 20 characters");
  if (!/^[a-zA-Z0-9_]+$/.test(u))
    throw new ValidationError("Username can only contain letters, numbers, and underscores");
}

function validateEmail(e: string) {
  if (!e)
    throw new ValidationError("Email is required and cannot be empty");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new ValidationError("Email is not valid");
}

function validatePassword(p: string) {
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

// Hashes a password using bcrypt if available, otherwise falls back to scrypt
async function hashPassword(password: string): Promise<string> {
  // Try to use bcrypt first
  try {
    const bcrypt = await import("bcrypt").then(m => m.default || m);
    if (typeof bcrypt.hash === "function") {
      return await bcrypt.hash(password, 12);
      // Use bcrypt with 12 salt rounds
    }
    throw new Error("bcrypt hash function not found");
  } catch {
    // If bcrypt is not available, use Node's built-in scrypt
    const salt = crypto.randomBytes(16).toString("hex");
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt$1$${salt}$${derivedKey.toString("hex")}`);
        // Store the salt and hash together for verification later
      });
    });
  }
}

function wrapSecure(db: any): SecureDB {
  if (db.__secureWrapped) 
    return db as SecureDB; // Avoid double wrapping
  const secure : SecureDB = Object.assign(db, {
    async subscribe(input: SubscribeInput): Promise<PublicUser> {
      const { username, email, password, avatar = null } = input;
      validateUsername(username);
      validateEmail(email);
      validatePassword(password);

      const existingUser = await db.findUserByUsername(username);
      if (existingUser) 
        throw new ValidationError("Username already exists");
      const existingEmail = await db.findEmailByEmail(email);
      if (existingEmail) 
        throw new ValidationError("Email already exists");

      const hashedPassword = await hashPassword(password);

      const insertResult: PublicUser = await new Promise((resolve, reject) => {
        const sql = "INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)";
        db.db.run(sql, [username, email, hashedPassword, avatar], function (this: any, err: any){
          if (err)
          {
            if (err.code === "SQLITE_CONSTRAINT") 
            {
              if (/users\.username/.test(err.message))
                return reject(new ValidationError("Username already exists"));
              if (/users\.email/.test(err.message))
                return reject(new ValidationError("Email already exists"));
            }
            return reject(err);
          }
          const newId = this.lastID;
          db.db.get(
            "SELECT id, username, email, avatar, created_at FROM users WHERE id = ?", 
            [newId],
            (gErr: any, row: any) => {
              if (gErr) 
                return reject(gErr);
              resolve(row as PublicUser);
            }
          );
        });
      });
      return insertResult;
    },
  }); 
  (secure as any).__secureWrapped = true;
  return secure
}

export default async function loadSharedDb(): Promise<SecureDB> {
  // Try path that works in local TS (from services/auth-service/server.ts)
  const candidates = [
    // Works when running TS directly (tsx) from services/auth-service/server.ts
    "../../Shared_dataBase/database/db-connection.js",
    // Works when running compiled JS from services/auth-service/dist/server.js
    "../../../Shared_dataBase/database/db-connection.js",
  ];

  let lastErr: unknown;
  for (const rel of candidates) {
    try {
      const mod = await import(new URL(rel, import.meta.url).href);
  return wrapSecure(mod.default);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Failed to load shared DB module from any candidate path");
}
