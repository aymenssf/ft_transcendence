import { URL } from "url";

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

export default async function loadSharedDb(): Promise<DB> {
  const candidates = [
    "../../Shared_dataBase/database/db-connection.js",
    "../../../Shared_dataBase/database/db-connection.js",
  ];

  let lastErr: unknown;
  for (const rel of candidates) {
    try {
      const mod = await import(new URL(rel, import.meta.url).href);
      return mod.default as DB;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Failed to load shared DB module from any candidate path");
}
