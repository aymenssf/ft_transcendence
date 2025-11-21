/**
 * Chat API Module - Makes HTTP requests to chat backend
 */
export class ChatAPI {
    constructor() {
        this.CHAT_API_URL = '/chat/api';
        this.AUTH_API_URL = '/api/auth';
    }
    getAuthHeaders() {
        const token = localStorage.getItem('jwt_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    }
    // ==================== FRIENDS MANAGEMENT ====================
    /**
     * Get friends list
     */
    async getFriends() {
        const response = await fetch(`${this.CHAT_API_URL}/friends`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch friends');
        }
        const data = await response.json();
        return data.friends || [];
    }
    /**
     * Get pending friend requests (received)
     */
    async getPendingRequests() {
        const response = await fetch(`${this.CHAT_API_URL}/friends/requests`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch pending requests');
        }
        const data = await response.json();
        return data.requests || [];
    }
    /**
     * Send friend request by username
     */
    async sendFriendRequest(username) {
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
    /**
     * Accept or decline friend request
     */
    async respondToFriendRequest(requestId, accept) {
        const response = await fetch(`${this.CHAT_API_URL}/friends/respond`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ requestId, accept })
        });
        if (!response.ok) {
            throw new Error('Failed to respond to friend request');
        }
    }
    // ==================== USER MANAGEMENT ====================
    /**
     * Get all users (for search)
     */
    async getUsers() {
        const response = await fetch(`${this.CHAT_API_URL}/users`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        return data.users || [];
    }
    /**
     * Search users
     */
    async searchUsers(query) {
        const response = await fetch(`${this.CHAT_API_URL}/users/search?q=${encodeURIComponent(query)}`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to search users');
        }
        const data = await response.json();
        return data.users || [];
    }
    /**
     * Get chat rooms
     */
    async getChatRooms() {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch chat rooms');
        }
        const data = await response.json();
        return data.chatRooms || [];
    }
    /**
     * Start a private chat with someone
     */
    async createPrivateChat(targetUserId) {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                type: 'private',
                targetUserId
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create private chat');
        }
        const data = await response.json();
        return data.chatRoom;
    }
    /**
     * Get room messages
     */
    async getRoomMessages(roomId) {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms/${roomId}/messages`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch messages');
        }
        const data = await response.json();
        const messages = data.messages || [];
        // Transform messages to ensure they have the correct structure
        return messages.map((msg) => ({
            id: msg.id,
            content: msg.content || '',
            senderId: msg.senderId,
            senderName: msg.sender?.username || 'Unknown',
            senderAvatar: msg.sender?.avatar || '/images/avatars/1.jpg',
            timestamp: msg.created_at || new Date().toISOString(),
            type: msg.type || 'text',
            chatRoomId: msg.chatRoomId
        }));
    }
    /**
     * Make a new chat room
     */
    async createRoom(name, type, password) {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                name,
                type,
                password: type === 'protected' ? password : undefined
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create room');
        }
        const data = await response.json();
        return data.chatRoom;
    }
    /**
     * Join a chat room
     */
    async joinRoom(roomId, password) {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms/${roomId}/join`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ password })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to join room');
        }
    }
    /**
     * Delete a chat room
     */
    async deleteRoom(roomId) {
        const response = await fetch(`${this.CHAT_API_URL}/chatrooms/${roomId}`, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete room');
        }
    }
    /**
     * Send game invitation
     */
    async sendGameInvite(targetUserId) {
        const response = await fetch(`${this.CHAT_API_URL}/game/invite`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({
                targetUserId: targetUserId
            })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to send game invitation');
        }
    }
    /**
     * Get user profile by ID
     */
    async getUserProfile(userId) {
        const response = await fetch(`${this.AUTH_API_URL}/user/${userId}`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        return await response.json();
    }
    /**
     * Block user
     */
    async blockUser(blockedId) {
        const response = await fetch(`${this.CHAT_API_URL}/users/block`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ blockedId })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to block user');
        }
    }
    /**
     * Unblock user
     */
    async unblockUser(blockedId) {
        const response = await fetch(`${this.CHAT_API_URL}/users/unblock`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ blockedId })
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to unblock user');
        }
    }
    /**
     * Get blocked users
     */
    async getBlockedUsers() {
        const response = await fetch(`${this.CHAT_API_URL}/users/blocked`, {
            headers: this.getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch blocked users');
        }
        const data = await response.json();
        return data.blockedUsers || [];
    }
}
