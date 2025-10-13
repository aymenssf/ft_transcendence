import { prisma } from '@ft/shared-database';

export interface ChatMessage {
  id: number;
  content: string;
  type?: string;
  metadata?: string | null;
  userId: number;
  chatRoomId: number;
  created_at: Date;
  user?: {
    id: number;
    username: string;
    avatar?: string | null;
  };
}

export interface GameInvitation {
  id: number;
  senderId: number;
  receiverId: number;
  chatRoomId?: number | null;
  status: string;
  gameRoomId?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TournamentNotification {
  id: number;
  userId: number;
  tournamentId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  created_at: Date;
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

  createMessage(content: string, userId: number, chatRoomId: number, type?: string, metadata?: string): Promise<ChatMessage>;
  getMessagesByChatRoom(chatRoomId: number, userId: number, limit?: number): Promise<ChatMessage[]>;

  // Blocking
  isUserBlocked(blockerId: number, blockedId: number): Promise<boolean>;

  // Game invitations
  createGameInvitation(senderId: number, receiverId: number, chatRoomId?: number): Promise<GameInvitation>;
  getGameInvitationById(id: number): Promise<GameInvitation | null>;
  updateGameInvitationStatus(id: number, status: string, gameRoomId?: string): Promise<GameInvitation>;
  getUserGameInvitations(userId: number, status?: string): Promise<GameInvitation[]>;

  // Tournament notifications
  createTournamentNotification(userId: number, tournamentId: number, title: string, message: string, type: string): Promise<TournamentNotification>;
  getUserTournamentNotifications(userId: number, unreadOnly?: boolean): Promise<TournamentNotification[]>;
  markNotificationAsRead(id: number): Promise<void>;

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

    async createMessage(content: string, userId: number, chatRoomId: number, type: string = 'text', metadata?: string): Promise<ChatMessage> {
      return await prisma.message.create({
        data: {
          content,
          senderId: userId,
          chatRoomId,
          type,
          metadata
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        }
      }) as any;
    },

    async getMessagesByChatRoom(chatRoomId: number, userId: number, limit = 50): Promise<ChatMessage[]> {
      // Get list of blocked users
      const blockedUsers = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true }
      });

      const blockedIds = blockedUsers.map((b: any) => b.blockedId);

      // Fetch messages excluding blocked users
      return await prisma.message.findMany({
        where: {
          chatRoomId,
          senderId: {
            notIn: blockedIds
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: {
          created_at: 'asc'
        },
        take: limit
      }) as any;
    },

    // Blocking
    async isUserBlocked(blockerId: number, blockedId: number): Promise<boolean> {
      const block = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId,
            blockedId
          }
        }
      });
      return !!block;
    },

    // Game invitations
    async createGameInvitation(senderId: number, receiverId: number, chatRoomId?: number): Promise<GameInvitation> {
      return await prisma.gameInvitation.create({
        data: {
          senderId,
          receiverId,
          chatRoomId,
          status: 'pending'
        }
      }) as any;
    },

    async getGameInvitationById(id: number): Promise<GameInvitation | null> {
      return await prisma.gameInvitation.findUnique({
        where: { id },
        include: {
          sender: {
            select: {
              id: true,
              username: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true
            }
          }
        }
      }) as any;
    },

    async updateGameInvitationStatus(id: number, status: string, gameRoomId?: string): Promise<GameInvitation> {
      return await prisma.gameInvitation.update({
        where: { id },
        data: {
          status,
          gameRoomId
        }
      }) as any;
    },

    async getUserGameInvitations(userId: number, status?: string): Promise<GameInvitation[]> {
      return await prisma.gameInvitation.findMany({
        where: {
          receiverId: userId,
          ...(status && { status })
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              avatar: true
            }
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      }) as any;
    },

    // Tournament notifications
    async createTournamentNotification(userId: number, tournamentId: number, title: string, message: string, type: string): Promise<TournamentNotification> {
      return await prisma.tournamentNotification.create({
        data: {
          userId,
          tournamentId,
          title,
          message,
          type
        }
      }) as any;
    },

    async getUserTournamentNotifications(userId: number, unreadOnly: boolean = false): Promise<TournamentNotification[]> {
      return await prisma.tournamentNotification.findMany({
        where: {
          userId,
          ...(unreadOnly && { isRead: false })
        },
        orderBy: {
          created_at: 'desc'
        }
      }) as any;
    },

    async markNotificationAsRead(id: number): Promise<void> {
      await prisma.tournamentNotification.update({
        where: { id },
        data: { isRead: true }
      });
    },

    close() {
      // No need to disconnect shared prisma instance
    }
  };
}

export default async function loadSharedDb(): Promise<ChatDB> {
  return createChatDB();
}
