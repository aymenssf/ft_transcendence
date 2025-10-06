import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ChatMessage {
  id: number;
  content: string;
  userId: number;
  chatRoomId: number;
  created_at: Date; 
  user?: {
    id: number;
    username: string;
    avatar?: string | null;
  };
}

export interface ChatRoom {
  id: number;
  name?: string | null;
  type: string;
  ownerId: number;
  created_at: Date;
  owner?: {
    id: number;
    username: string;
  };
}

export interface ChatDB {
  findUserById(id: number): Promise<any>;
  findUserByUsername(username: string): Promise<any>;
  
  createChatRoom(name: string | null, type: string, ownerId: number): Promise<ChatRoom>;
  findChatRoomById(id: number): Promise<ChatRoom | null>;
  getChatRoomsByUser(userId: number): Promise<ChatRoom[]>;
  
  createMessage(content: string, userId: number, chatRoomId: number): Promise<ChatMessage>;
  getMessagesByChatRoom(chatRoomId: number, limit?: number): Promise<ChatMessage[]>;
  
  close(): void;
}

function createChatDB(): ChatDB {
  return {
    // User operations
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

    async findUserByUsername(username: string) {
      return await prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          created_at: true
        }
      });
    },

    async createChatRoom(name: string | null, type: string, ownerId: number): Promise<ChatRoom> {
      return await prisma.chatRoom.create({
        data: {
          name,
          type,
          ownerId
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
    },

    async findChatRoomById(id: number): Promise<ChatRoom | null> {
      return await prisma.chatRoom.findUnique({
        where: { id },
        include: {
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
    },

    async getChatRoomsByUser(userId: number): Promise<ChatRoom[]> {
      return await prisma.chatRoom.findMany({
        where: { ownerId: userId },
        include: {
          owner: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });
    },

    async createMessage(content: string, userId: number, chatRoomId: number): Promise<ChatMessage> {
      throw new Error("Message model not implemented in schema yet");
    },

    async getMessagesByChatRoom(chatRoomId: number, limit = 50): Promise<ChatMessage[]> {
      throw new Error("Message model not implemented in schema yet");
    },

    close() {
      prisma.$disconnect();
    }
  };
}

export default async function loadSharedDb(): Promise<ChatDB> {
  return createChatDB();
}