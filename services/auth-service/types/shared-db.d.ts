declare module "../../Shared_dataBase/database/db-connection.js" {
  export interface UserRow {
    id: number;
    username: string;
    email: string;
    password: string;
    avatar?: string | null;
    is_42_user?: 0 | 1 | boolean;
    created_at?: string;
  }

  interface DB {
    createUser(username: string, email: string, password: string): Promise<{ id: number; username: string; email: string }>;
    findUserByUsername(username: string): Promise<UserRow | undefined>;
    findEmailByEmail(email: string): Promise<UserRow | undefined>;
    close(): void;
  }

  const db: DB;
  export default db;
}

declare module "../../Shared_dataBase/prismaClient.js" {
  import { PrismaClient } from '@prisma/client';
  export const prisma: PrismaClient;
}
