import { prisma } from '@ft/shared-database';

export interface SimpleGameDB {
  findUserById(id: number): Promise<any>;
  getAllUsers(): Promise<any[]>;
  
  testConnection(): Promise<boolean>;
  
  close(): void;
}

function createSimpleGameDB(): SimpleGameDB {
  return {
    async findUserById(id: number) {
      return await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          created_at: true
        }
      });
    },

    async getAllUsers() {
      return await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          avatar: true,
          created_at: true
        }
      });
    },

    async testConnection(): Promise<boolean> {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch (error) {
        console.error('Database connection test failed:', error);
        return false;
      }
    },

    close() {
    }
  };
}

export default async function loadSharedDb(): Promise<SimpleGameDB> {
  return createSimpleGameDB();
}