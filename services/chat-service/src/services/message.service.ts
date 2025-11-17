import type { Database } from '../types/index.js';

export class MessageService {
  constructor(private db: Database) {}

  async createMessage(senderId: number, chatRoomId: number, content: string) {
    // TODO: Implement this method in the database layer
    return {
      id: Date.now(),
      senderId,
      chatRoomId,
      content,
      created_at: new Date()
    };
  }

  async getRoomMessages(chatRoomId: number, limit: number = 50) {
    // TODO: Implement this method in the database layer
    return [];
  }
}
