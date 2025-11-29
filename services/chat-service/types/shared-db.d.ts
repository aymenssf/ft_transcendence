declare module '../../Shared_dataBase/db-connection.js' {
    interface User {
      id: number;
      username: string;
      email: string;
      avatar?: string;
      created_at?: string;
    }

    interface Message {
      id: number;
      sender_id: number;
      receiver_id?: number;
      room_id?: number;
      content: string;
      created_at: string;
    }

    interface ChatRoom {
      id: number;
      name: string;
      type: 'private' | 'group';
      created_at: string;
    }

    interface Database {
      findUserById(id: number): Promise<User | undefined>;
      findUserByUsername(username: string): Promise<User | undefined>;

      createMessage(senderId: number, content: string, receiverId?: number, roomId?: number): Promise<Message>;

      createChatRoom(name: string, type: 'private' | 'group'): Promise<ChatRoom>;

      ensureGeneralRoom(): Promise<any>;
      joinGeneralRoom(userId: number): Promise<void>;

      close(): void;
    }

    const db: Database;
    export default db;
  }
