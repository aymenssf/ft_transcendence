declare module '../../Shared_dataBase/prismaClient.js' {
  import { PrismaClient } from '@prisma/client';
  
  export const prisma: PrismaClient;
  export default prisma;
}