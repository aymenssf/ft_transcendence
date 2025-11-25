declare const io: any;

import { User, FriendRequest } from './types.js';
import { FriendsUI } from './friends-ui.js';
import { FriendsAPI } from './friends-api.js';

export class FriendsManager {
  private socket: any = null;
  private ui: FriendsUI;
  private api: FriendsAPI;
  private currentUser: User | null = null;
  private authToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(containerId: string) {
    this.ui = new FriendsUI(containerId);
    this.api = new FriendsAPI();
    this.authToken = localStorage.getItem('jwt_token');
  }

  async init(user: User, globalSocket?: any): Promise<void> {
    this.currentUser = user;

    try {
      if (!this.authToken) {
        throw new Error('Authentication required. Please log in again.');
      }

      this.setupUIHandlers();
      
      await this.loadFriends();
      await this.loadFriendRequests();

      // Store reference to global socket if provided
      if (globalSocket) {
        this.socket = globalSocket;
        console.log('✅ Friends Manager using global socket');
        
        // Setup listeners on the global socket
        this.setupSocketListeners();
      } else {
        console.warn('⚠️ No global socket provided to FriendsManager');
      }

      console.log('✅ Friends Manager initialized');
    } catch (error) {
      console.error('❌ Friends initialization failed:', error);
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      this.ui.showError('Failed to initialize friends: ' + errorMessage);
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) {
      console.warn('⚠️ Cannot setup socket listeners: socket not available');
      return;
    }

    console.log('📡 Setting up FriendsManager socket listeners');

    // Clean up any existing listeners first to prevent duplicates
    this.cleanupSocketListeners();

    // Listen for friend status changes
    this.socket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👥 [FriendsManager Socket] Friend status changed:', data);
      this.ui.updateFriendStatus(data.userId, data.status);
    });

    // Listen for friend requests
    this.socket.on('friend-request', async (data: any) => {
      console.log('📬 [FriendsManager Socket] Friend request received:', data);
      this.ui.showSuccess(`${data.sender?.username || 'Someone'} sent you a friend request!`);
      await this.loadFriendRequests();
    });

    // Listen for friend request sent confirmation (for sender)
    this.socket.on('friend-request-sent', async (data: any) => {
      console.log('📤 [FriendsManager Socket] Friend request sent confirmation:', data);
      // Reload friend requests to show the outgoing request
      await this.loadFriendRequests();
    });

    // Listen for friend request updates
    this.socket.on('friend-request-updated', async (data: any) => {
      console.log('📝 [FriendsManager Socket] Friend request updated:', data);
      if (data.status === 'accepted') {
        await this.loadFriends();
      }
      await this.loadFriendRequests();
    });

    // Listen for new friends added
    this.socket.on('friend-added', async (data: { type: string; friend: User }) => {
      console.log('✅ [FriendsManager Socket] New friend added:', data);
      this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}!`);
      await this.loadFriends();
    });

    // Listen for friend removed
    this.socket.on('friend-removed', async (data: { userId: number }) => {
      console.log('❌ [FriendsManager Socket] Friend removed:', data);
      this.ui.showError('A friend has been removed from your list');
      await this.loadFriends();
    });

    // Listen for user status changes (general)
    this.socket.on('user-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👤 [FriendsManager Socket] User status changed:', data);
      this.ui.updateFriendStatus(data.userId, data.status);
    });

    // Listen for game invitations
    this.socket.on('game-invitation', (data: any) => {
      console.log('🎮 [FriendsManager Socket] Game invitation received:', data);
      this.showGameInvitation(data);
    });

    // Listen for game invite accepted
    this.socket.on('game-invite-accepted', (data: any) => {
      console.log('✅ [FriendsManager Socket] Game invite accepted:', data);
      this.handleGameInviteAccepted(data);
    });

    // Listen for game invite declined
    this.socket.on('game-invite-declined', (data: any) => {
      console.log('❌ [FriendsManager Socket] Game invite declined:', data);
      this.ui.showError('Your game invitation was declined');
    });

    console.log('✅ FriendsManager socket listeners registered');
  }

  /**
   * Cleanup socket listeners (called when switching pages or logging out)
   */
  private cleanupSocketListeners(): void {
    if (!this.socket) return;

    console.log('🧹 Cleaning up FriendsManager socket listeners');

    // Remove all listeners that this manager added
    this.socket.off('friend-status-change');
    this.socket.off('friend-request');
    this.socket.off('friend-request-sent');
    this.socket.off('friend-request-updated');
    this.socket.off('friend-added');
    this.socket.off('friend-removed');
    this.socket.off('user-status-change');
    this.socket.off('game-invitation');
    this.socket.off('game-invite-accepted');
    this.socket.off('game-invite-declined');
  }

  /**
   * Setup UI event handlers
   */
  private setupUIHandlers(): void {
    this.ui.onGameInvite((userId: number) => {
      this.sendGameInvitation(userId);
    });

    this.ui.onRemoveFriend((userId: number) => {
      this.removeFriend(userId);
    });

    this.ui.onBlockUser((userId: number) => {
      this.blockUser(userId);
    });

    this.ui.onUnblockUser((userId: number) => {
      this.unblockUser(userId);
    });

    this.ui.onShowFriendRequests(async () => {
      await this.showFriendRequests();
    });

    this.ui.onShowAddFriend(async () => {
      await this.showAddFriend();
    });

    this.ui.onSendFriendRequest(async (username: string) => {
      await this.sendFriendRequest(username);
    });

    this.ui.onAcceptFriendRequest(async (requestId: number) => {
      await this.acceptFriendRequest(requestId);
    });

    this.ui.onDeclineFriendRequest(async (requestId: number) => {
      await this.declineFriendRequest(requestId);
    });
  }

  /**
   * Load friends list
   */
  private async loadFriends(): Promise<void> {
    try {
      const friends = await this.api.getFriends();
      this.ui.renderFriendsList(friends, this.currentUser?.id || 0);
    } catch (error) {
      console.error('Failed to load friends:', error);
      this.ui.showError('Failed to load friends');
    }
  }

  /**
   * Load friend requests
   */
  private async loadFriendRequests(): Promise<void> {
    try {
      const requests = await this.api.getPendingRequests();
      this.ui.updateFriendRequestsBadge(requests.length);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  }

  /**
   * Show friend requests modal
   */
  private async showFriendRequests(): Promise<void> {
    try {
      const requests = await this.api.getPendingRequests();
      this.ui.showFriendRequestsModal(requests);
      this.ui.updateFriendRequestsBadge(requests.length);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
      this.ui.showError('Failed to load friend requests');
    }
  }

  /**
   * Show add friend modal
   */
  private async showAddFriend(): Promise<void> {
    try {
      const users = await this.api.getUsers();
      this.ui.showAddFriendModal(users);
    } catch (error) {
      console.error('Failed to load users:', error);
      this.ui.showError('Failed to load users');
    }
  }

  /**
   * Send friend request
   */
  private async sendFriendRequest(username: string): Promise<void> {
    try {
      await this.api.sendFriendRequest(username);
      this.ui.showSuccess(`Friend request sent to ${username}`);
    } catch (error) {
      console.error('Failed to send friend request:', error);
      this.ui.showError((error as Error).message || 'Failed to send friend request');
    }
  }

  /**
   * Accept friend request
   */
  private async acceptFriendRequest(requestId: number): Promise<void> {
    try {
      await this.api.respondToFriendRequest(requestId, true);
      this.ui.showSuccess('Friend request accepted!');
      await this.loadFriends();
      await this.loadFriendRequests();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
      this.ui.showError('Failed to accept friend request');
    }
  }

  /**
   * Decline friend request
   */
  private async declineFriendRequest(requestId: number): Promise<void> {
    try {
      await this.api.respondToFriendRequest(requestId, false);
      this.ui.showSuccess('Friend request declined');
      await this.loadFriendRequests();
    } catch (error) {
      console.error('Failed to decline friend request:', error);
      this.ui.showError('Failed to decline friend request');
    }
  }

  /**
   * Remove a friend
   */
  private async removeFriend(userId: number): Promise<void> {
    // Find the friend's username
    const friend = this.ui['allFriends'].find((f: any) => f.id === userId);
    const friendName = friend?.username || 'this user';
    
    // Confirm before removing
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
      return;
    }

    try {
      await this.api.removeFriend(userId);
      this.ui.showSuccess(`${friendName} has been removed from your friends`);
      await this.loadFriends();
    } catch (error) {
      console.error('Failed to remove friend:', error);
      this.ui.showError('Failed to remove friend');
    }
  }

  /**
   * Block a user
   */
  private async blockUser(userId: number): Promise<void> {
    try {
      await this.api.blockUser(userId);
      this.ui.showSuccess('User blocked');
      await this.loadFriends();
    } catch (error) {
      console.error('Failed to block user:', error);
      this.ui.showError('Failed to block user');
    }
  }

  /**
   * Unblock a user
   */
  private async unblockUser(userId: number): Promise<void> {
    try {
      await this.api.unblockUser(userId);
      this.ui.showSuccess('User unblocked');
      await this.loadFriends();
    } catch (error) {
      console.error('Failed to unblock user:', error);
      this.ui.showError('Failed to unblock user');
    }
  }

  /**
   * Send game invitation
   */
  private async sendGameInvitation(userId: number): Promise<void> {
    try {
      await this.api.sendGameInvitation(userId);
      this.ui.showSuccess('Game invitation sent!');
    } catch (error) {
      console.error('Failed to send game invitation:', error);
      this.ui.showError((error as Error).message || 'Failed to send game invitation');
    }
  }

  /**
   * Show game invitation notification when received
   */
  private showGameInvitation(data: any): void {
    console.log('🎮 Showing game invitation from:', data.senderUsername);
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-24 right-4 bg-gray-800 border border-emerald-500 rounded-lg p-4 shadow-2xl z-50 max-w-sm animate-slide-in';
    notification.innerHTML = `
      <div class="flex items-center gap-3 mb-3">
        <div class="text-4xl">🎮</div>
        <div class="flex-1">
          <div class="text-white font-semibold">${this.escapeHtml(data.senderUsername || 'Someone')}</div>
          <div class="text-gray-400 text-sm">wants to play a game!</div>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="accept-game-invite-${data.id}" class="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium">
          ✓ Accept
        </button>
        <button id="decline-game-invite-${data.id}" class="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium">
          ✗ Decline
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 30 seconds
    const timeout = setTimeout(() => {
      notification.remove();
    }, 30000);

    // Accept handler
    document.getElementById(`accept-game-invite-${data.id}`)?.addEventListener('click', async () => {
      clearTimeout(timeout);
      notification.remove();
      await this.acceptGameInvitation(data.id);
    });

    // Decline handler
    document.getElementById(`decline-game-invite-${data.id}`)?.addEventListener('click', async () => {
      clearTimeout(timeout);
      notification.remove();
      await this.declineGameInvitation(data.id);
    });
  }

  /**
   * Accept game invitation
   */
  private async acceptGameInvitation(invitationId: number): Promise<void> {
    try {
      const response = await fetch('/chat/api/game/accept', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invitationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept invitation');
      }

      const data = await response.json();
      this.ui.showSuccess('Redirecting to game...');
      
      // Redirect to game with room ID
      setTimeout(() => {
        window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
      }, 1000);
    } catch (error) {
      console.error('Failed to accept game invitation:', error);
      this.ui.showError((error as Error).message || 'Failed to accept game invitation');
    }
  }

  /**
   * Decline game invitation
   */
  private async declineGameInvitation(invitationId: number): Promise<void> {
    try {
      const response = await fetch('/chat/api/game/decline', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invitationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to decline invitation');
      }

      this.ui.showSuccess('Game invitation declined');
    } catch (error) {
      console.error('Failed to decline game invitation:', error);
      this.ui.showError((error as Error).message || 'Failed to decline game invitation');
    }
  }

  /**
   * Handle when your game invitation is accepted by the other user
   */
  handleGameInviteAccepted(data: any): void {
    console.log('🎉 Game invitation accepted! Room:', data.gameRoomId);
    this.ui.showSuccess('Your invitation was accepted! Redirecting to game...');
    
    setTimeout(() => {
      window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
    }, 1000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle friend status change from global socket
   */
  handleFriendStatusChange(userId: number, status: 'online' | 'offline'): void {
    console.log(`[FriendsManager] Updating friend ${userId} status to ${status}`);
    this.ui.updateFriendStatus(userId, status);
  }

  /**
   * Handle friend request from global socket
   */
  async handleFriendRequest(data: any): Promise<void> {
    this.ui.showSuccess(`${data.sender?.username || 'Someone'} sent you a friend request!`);
    await this.loadFriendRequests();
  }

  /**
   * Handle friend added from global socket
   */
  async handleFriendAdded(data: any): Promise<void> {
    this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}!`);
    await this.loadFriends();
  }

  /**
   * Handle game invitation received
   */
  async handleGameInvitation(data: any): Promise<void> {
    console.log('🎮 FriendsManager: Handling game invitation:', data);
    
    const { id, senderId, senderUsername } = data;
    
    // Show notification modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
        <h3 class="text-xl font-bold mb-4">🎮 Game Invitation</h3>
        <p class="mb-6">${senderUsername} invited you to play a game!</p>
        <div class="flex gap-4">
          <button id="accept-game-btn" class="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">
            Accept
          </button>
          <button id="decline-game-btn" class="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded">
            Decline
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const removeModal = () => modal.remove();
    
    modal.querySelector('#accept-game-btn')?.addEventListener('click', async () => {
      removeModal();
      try {
        const result = await this.api.acceptGameInvitation(id);
        console.log('✅ Game invitation accepted:', result);
        window.location.hash = `#dashboard/game/friend_game?room=${result.gameRoomId}`;
      } catch (error) {
        console.error('❌ Failed to accept game invitation:', error);
        this.ui.showError('Failed to accept game invitation');
      }
    });
    
    modal.querySelector('#decline-game-btn')?.addEventListener('click', async () => {
      removeModal();
      try {
        await this.api.declineGameInvitation(id);
        console.log('❌ Game invitation declined');
      } catch (error) {
        console.error('❌ Failed to decline game invitation:', error);
      }
    });
  }

  /**
   * Handle game invite declined
   */
  async handleGameInviteDeclined(data: any): Promise<void> {
    console.log('❌ FriendsManager: Game invite declined');
    this.ui.showError('Game invitation was declined');
  }

  /**
   * Cleanup
   */
  destroy(): void {
    console.log('🧹 Destroying FriendsManager');
    
    // Clean up socket listeners (but don't disconnect - it's managed globally)
    this.cleanupSocketListeners();
    
    // Clear socket reference (don't disconnect it)
    this.socket = null;
    
    // Destroy UI
    this.ui.destroy();
  }
}
