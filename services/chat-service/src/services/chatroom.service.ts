import type { Database } from '../types/index.js';

export class ChatRoomService {
  constructor(private db: Database) {}

  async createChatRoom(name: string, type: string, ownerId: number) {
    return await this.db.createChatRoom(name, type, ownerId);
  }

  async getChatRoomById(id: number) {
    return await this.db.findChatRoomById(id);
  }

  async getChatRoomsByUser(userId: number) {
    return await this.db.getChatRoomsByUser(userId);
  }

  async checkUserInRoom(userId: number, chatRoomId: number): Promise<boolean> {
    // TODO: Implement this method in the database layer
    // For now, return true
    return true;
  }
}
