import type { Database } from '../types/index.js';

export class UserService {
  constructor(private db: Database) {}

  async getUserById(id: number) {
    return await this.db.findUserById(id);
  }

  async isUserBlocked(blockerId: number, blockedId: number): Promise<boolean> {
    // TODO: Implement this method in the database layer
    return false;
  }
}
