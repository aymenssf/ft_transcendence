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

export interface UnreadMessage {
  userId: number;
  chatRoomId: number;
  unreadCount: number;
  lastMessageId?: number | null;
  updated_at: Date;
}

export interface ChatDB {
  findUserById(id: number): Promise<any>;
  findUserByUsername(username: string): Promise<any>;

  createChatRoom(name: string | null, type: string, ownerId: number): Promise<ChatRoom>;
  findChatRoomById(id: number): Promise<ChatRoom | null>;
  getChatRoomsByUser(userId: number): Promise<ChatRoom[]>;

  createMessage(content: string, userId: number, chatRoomId: number, type?: string, metadata?: string): Promise<ChatMessage>;
  getMessagesByChatRoom(chatRoomId: number, userId: number, limit?: number): Promise<ChatMessage[]>;
  getMessagesByChatRoomPaginated(chatRoomId: number, userId: number, limit?: number, offset?: number): Promise<ChatMessage[]>;

  // User status management
  getUserStatus(userId: number): Promise<string>;
  updateUserStatus(userId: number, status: string): Promise<void>;
  getOnlineUsers(): Promise<any[]>;

  // Unread messages
  getUnreadMessageCount(userId: number, chatRoomId: number): Promise<number>;
  getAllUnreadCounts(userId: number): Promise<UnreadMessage[]>;
  incrementUnreadCount(userId: number, chatRoomId: number, messageId: number): Promise<void>;
  markMessagesAsRead(userId: number, chatRoomId: number): Promise<void>;

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

  // Friends
  sendFriendRequest(senderId: number, receiverId: number): Promise<any>;
  respondFriendRequest(requestId: number, receiverId: number, accept: boolean): Promise<any>;
  getFriendRequests(userId: number): Promise<any[]>;
  getFriends(userId: number): Promise<any[]>;
  getFriendIds(userId: number): Promise<number[]>;

  close(): void;
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

  // Friends (duplicated interface block kept consistent)
  sendFriendRequest(senderId: number, receiverId: number): Promise<any>;
  respondFriendRequest(requestId: number, receiverId: number, accept: boolean): Promise<any>;
  getFriendRequests(userId: number): Promise<any[]>;
  getFriends(userId: number): Promise<any[]>;
  getFriendIds(userId: number): Promise<number[]>;

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

    async getMessagesByChatRoomPaginated(chatRoomId: number, userId: number, limit = 50, offset = 0): Promise<ChatMessage[]> {
      // Get list of blocked users
      const blockedUsers = await prisma.block.findMany({
        where: { blockerId: userId },
        select: { blockedId: true }
      });

      const blockedIds = blockedUsers.map((b: any) => b.blockedId);

      // Fetch messages excluding blocked users with pagination
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
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      }) as any;
    },

    // User status management
    async getUserStatus(userId: number): Promise<string> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true }
      });
      return user?.status || 'offline';
    },

    async updateUserStatus(userId: number, status: string): Promise<void> {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status,
          lastSeen: new Date()
        }
      });
    },

    async getOnlineUsers(): Promise<any[]> {
      return await prisma.user.findMany({
        where: {
          status: {
            in: ['online', 'in-game']
          }
        },
        select: {
          id: true,
          username: true,
          avatar: true,
          status: true,
          lastSeen: true
        }
      });
    },

    // Unread messages
    async getUnreadMessageCount(userId: number, chatRoomId: number): Promise<number> {
      const unread = await prisma.unreadMessage.findUnique({
        where: {
          userId_chatRoomId: {
            userId,
            chatRoomId
          }
        }
      });
      return unread?.unreadCount || 0;
    },

    async getAllUnreadCounts(userId: number): Promise<UnreadMessage[]> {
      return await prisma.unreadMessage.findMany({
        where: {
          userId,
          unreadCount: {
            gt: 0
          }
        },
        orderBy: {
          updated_at: 'desc'
        }
      }) as any;
    },

    async incrementUnreadCount(userId: number, chatRoomId: number, messageId: number): Promise<void> {
      await prisma.unreadMessage.upsert({
        where: {
          userId_chatRoomId: {
            userId,
            chatRoomId
          }
        },
        update: {
          unreadCount: {
            increment: 1
          },
          lastMessageId: messageId
        },
        create: {
          userId,
          chatRoomId,
          unreadCount: 1,
          lastMessageId: messageId
        }
      });
    },

    async markMessagesAsRead(userId: number, chatRoomId: number): Promise<void> {
      await prisma.unreadMessage.upsert({
        where: {
          userId_chatRoomId: {
            userId,
            chatRoomId
          }
        },
        update: {
          unreadCount: 0
        },
        create: {
          userId,
          chatRoomId,
          unreadCount: 0
        }
      });
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

    // Friends
    async sendFriendRequest(senderId: number, receiverId: number): Promise<any> {
      if (senderId === receiverId) 
        throw new Error('Cannot add yourself');

      // Check existing friendship
      const existingFriend = await prisma.friend.findUnique({
        where: { userId_friendId: { userId: senderId, friendId: receiverId } }
      });
      if (existingFriend) 
        throw new Error('Already friends');
      // Check existing request in either direction
      const existingReq = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId, receiverId, status: 'pending' },
            { senderId: receiverId, receiverId: senderId, status: 'pending' }
          ]
        }
      });
      if (existingReq) 
        return existingReq;

      return await prisma.friendRequest.create({
        data: { senderId, receiverId, status: 'pending' }
      });
    },

    async respondFriendRequest(requestId: number, receiverId: number, accept: boolean): Promise<any> {
      const req = await prisma.friendRequest.findUnique({ where: { id: requestId } });
      if (!req) 
        throw new Error('Request not found');
      if (req.receiverId !== receiverId) 
        throw new Error('Not authorized');
      if (req.status !== 'pending') 
        throw new Error('Request already handled');

      const status = accept ? 'accepted' : 'declined';
      const updated = await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status }
      });

      if (accept) 
      {
        // create bidirectional friendship
        await prisma.friend.create({ data: { userId: req.senderId, friendId: req.receiverId } });
        await prisma.friend.create({ data: { userId: req.receiverId, friendId: req.senderId } });
      }

      return updated;
    },

    async getFriendRequests(userId: number): Promise<any[]> {
      return await prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'pending'
        },
        include: {
          sender: { select: { id: true, username: true, avatar: true } }
        },
        orderBy: { created_at: 'desc' }
      }) as any;
    },

    async getFriends(userId: number): Promise<any[]> {
      const friends = await prisma.friend.findMany({
        where: { userId },
        include: {
          friend: {
            select: { id: true, username: true, avatar: true, status: true, lastSeen: true }
          }
        },
        orderBy: { created_at: 'desc' }
      });
      return friends.map((f: any) => f.friend);
    },

    async getFriendIds(userId: number): Promise<number[]> {
      const rows = await prisma.friend.findMany({
        where: { userId },
        select: { friendId: true }
      });
      return rows.map((r: any) => r.friendId);
    },

    close() {
      // No need to disconnect shared prisma instance
    }
  };
}

export default async function loadSharedDb(): Promise<ChatDB> {
  return createChatDB();
}
