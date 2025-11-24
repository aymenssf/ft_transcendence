import { User, FriendRequest } from './types.js';

export class FriendsAPI {
  private CHAT_API_URL = '/chat/api';


  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('jwt_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async getFriends(): Promise<User[]> {
    const response = await fetch(`${this.CHAT_API_URL}/friends`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch friends');
    }

    const data = await response.json();
    return data.friends || [];
  }


  async getPendingRequests(): Promise<FriendRequest[]> {
    const response = await fetch(`${this.CHAT_API_URL}/friends/requests`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending requests');
    }

    const data = await response.json();
    return data.requests || [];
  }

  async sendFriendRequest(username: string): Promise<void> {
    const response = await fetch(`${this.CHAT_API_URL}/friends/request`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ receiverUsername: username })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send friend request');
    }
  }

  async respondToFriendRequest(requestId: number, accept: boolean): Promise<void> {
    const response = await fetch(`${this.CHAT_API_URL}/friends/respond`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ requestId, accept })
    });

    if (!response.ok) {
      throw new Error('Failed to respond to friend request');
    }
  }

  async getUsers(): Promise<User[]> {
    const response = await fetch(`${this.CHAT_API_URL}/users`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const data = await response.json();
    return data.users || [];
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await fetch(`${this.CHAT_API_URL}/users/search?q=${encodeURIComponent(query)}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to search users');
    }

    const data = await response.json();
    return data.users || [];
  }

  async blockUser(userId: number): Promise<void> {
    const response = await fetch(`${this.CHAT_API_URL}/users/block`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ blockedId: userId })
    });

    if (!response.ok) {
      throw new Error('Failed to block user');
    }
  }

  async unblockUser(userId: number): Promise<void> {
    const response = await fetch(`${this.CHAT_API_URL}/users/unblock`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ blockedId: userId })
    });

    if (!response.ok) {
      throw new Error('Failed to unblock user');
    }
  }

  async getBlockedUsers(): Promise<number[]> {
    try {
      const response = await fetch(`${this.CHAT_API_URL}/users/blocked`, {
        headers: this.getAuthHeaders()
      });
      
      if (response.ok) {
        const { blockedUsers } = await response.json();
        return blockedUsers.map((block: any) => block.blocked.id);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }
    return [];
  }


  async sendGameInvitation(receiverId: number): Promise<void> {
    const response = await fetch(`${this.CHAT_API_URL}/game/invite`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ targetUserId: receiverId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send game invitation');
    }
  }
}
