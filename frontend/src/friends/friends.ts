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

  async init(user: User): Promise<void> {
    this.currentUser = user;

    try {
      if (!this.authToken) {
        throw new Error('Authentication required. Please log in again.');
      }

      this.setupUIHandlers();
      
      await this.loadFriends();
      await this.loadFriendRequests();

      console.log('✅ Friends Manager initialized (using global socket)');
    } catch (error) {
      console.error('❌ Friends initialization failed:', error);
      const errorMessage = (error as Error).message || 'Unknown error occurred';
      this.ui.showError('Failed to initialize friends: ' + errorMessage);
    }
  }

  private async connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socketUrl = `${window.location.protocol}//${window.location.host}`;

      const socketOptions = {
        path: '/chat/socket.io',
        auth: {
          token: this.authToken
        },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      };

      this.socket = io(socketUrl, socketOptions);

      this.socket.on('connect', () => {
        console.log('✅ Socket.IO connected for friends');
        this.reconnectAttempts = 0;
        this.ui.updateConnectionStatus(true);
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket.IO disconnected');
        this.ui.updateConnectionStatus(false);
        this.attemptReconnect();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Socket.IO connection error:', error);
        console.error('Connection details:', {
          url: socketUrl,
          path: socketOptions.path,
          transports: socketOptions.transports,
          hasToken: !!this.authToken
        });
        const errorMessage = error?.message || error?.description || 'Unable to connect to server';
        reject(new Error(errorMessage));
      });

      this.socket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
        console.log('Friend status changed:', data);
        this.ui.updateFriendStatus(data.userId, data.status);
      });

      this.socket.on('friend-request', async (data: any) => {
        console.log('New friend request received:', data);
        this.ui.showSuccess(`${data.sender?.username || 'Someone'} sent you a friend request!`);
        await this.loadFriendRequests();
      });

      this.socket.on('friend-request-updated', async (data: any) => {
        console.log('Friend request updated:', data);
        if (data.status === 'accepted') {
          await this.loadFriends();
        }
        await this.loadFriendRequests();
      });

      // Listen for new friend added
      this.socket.on('friend-added', async (data: { type: string; friend: User }) => {
        console.log('New friend added:', data);
        this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}!`);
        await this.loadFriends();
      });

      // Listen for game invitations
      this.socket.on('game-invitation', (data: any) => {
        console.log('Game invitation received:', data);
        this.showGameInvitation(data);
      });
    });
  }

  /**
   * Attempt to reconnect socket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }
  }

  /**
   * Setup UI event handlers
   */
  private setupUIHandlers(): void {
    this.ui.onGameInvite((userId: number) => {
      this.sendGameInvitation(userId);
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
      this.ui.showError('Failed to send game invitation');
    }
  }

  /**
   * Show game invitation notification
   */
  private showGameInvitation(data: any): void {
    const sender = data.sender?.username || 'Someone';
    
    const notification = document.createElement('div');
    notification.className = 'fixed top-24 right-4 bg-gray-800 border border-emerald-500 rounded-lg p-4 shadow-2xl z-50 max-w-sm';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <img 
          class="w-12 h-12 rounded-full border-2 border-emerald-500" 
          src="${data.sender?.avatar || '/images/avatars/1.jpg'}" 
          alt="${sender}"
          onerror="this.src='/images/avatars/1.jpg'"
        >
        <div class="flex-1">
          <div class="text-white font-semibold">${sender}</div>
          <div class="text-gray-400 text-sm">wants to play a game!</div>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="accept-game-invite" class="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium">
          ✓ Accept
        </button>
        <button id="decline-game-invite" class="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium">
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
    notification.querySelector('#accept-game-invite')?.addEventListener('click', () => {
      clearTimeout(timeout);
      notification.remove();
      this.ui.showSuccess('Redirecting to game...');
      // Redirect to game with the invitation details
      window.location.href = `/dashboard/game?invite=${data.inviteId || ''}`;
    });

    // Decline handler
    notification.querySelector('#decline-game-invite')?.addEventListener('click', () => {
      clearTimeout(timeout);
      notification.remove();
      this.ui.showSuccess('Game invitation declined');
    });
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
   * Cleanup
   */
  destroy(): void {
    // Note: Don't disconnect socket here - it's managed globally in main.ts
    if (this.socket) {
      // Only disconnect if this manager created its own socket
      this.socket.disconnect();
      this.socket = null;
    }
    this.ui.destroy();
  }
}
