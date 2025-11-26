
declare const io: any;

import { ChatMessage, ChatRoom, User, GameInvite } from './types.js';
import { ChatUI } from './chat-ui.js';
import { ChatAPI } from './chat-api.js';

export class ChatManager {
  private socket: any = null;
  private ui: ChatUI;
  private api: ChatAPI;
  private currentUser: User | null = null;
  private currentRoom: ChatRoom | null = null;
  private authToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private cachedBlockStatuses: Map<number, boolean> = new Map(); // Cache block statuses

  constructor(containerId: string) {
    this.ui = new ChatUI(containerId);
    this.api = new ChatAPI();
    this.authToken = localStorage.getItem('jwt_token');
  }

  async init(user: User, globalSocket?: any): Promise<void> {
    this.currentUser = user;

    try {
      this.setupUIHandlers();

      await this.loadFriends();
      await this.loadFriendRequests();
      await this.loadChatRooms();

      if (typeof io !== 'undefined') {
        try {
          await this.connectSocket();
        } catch (error) {
          console.warn('⚠️ Chat socket connection failed:', error);
        }
      }

      if (globalSocket) {
        this.setupGlobalSocketListeners(globalSocket);
      }

      console.log('✅ Chat Manager initialized');
    } catch (error) {
      console.error('❌ Chat initialization failed:', error);
      this.ui.showError('Failed to initialize chat: ' + (error as Error).message);
    }
  }

  private setupGlobalSocketListeners(globalSocket: any): void {
    console.log('📡 Setting up ChatManager global socket listeners');

    this.cleanupGlobalSocketListeners(globalSocket);

    globalSocket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👥 [ChatManager Global] Friend status changed:', data);
      this.ui.updateFriendStatus(data.userId, data.status);
    });

    globalSocket.on('user-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👤 [ChatManager Global] User status changed:', data);
      this.ui.updateFriendStatus(data.userId, data.status);
    });

    console.log('✅ ChatManager global socket listeners registered');
    console.log('   → Note: Game invitation listeners are handled globally in main.ts');
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
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('message', (data: any) => {
        this.handleNewMessage(data);
      });

      this.socket.on('disconnect', () => {
        this.attemptReconnect();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Socket.IO connection error:', error);
        console.error('Connection details:', {
          url: socketUrl,
          path: socketOptions.path,
          transports: socketOptions.transports
        });
        reject(error);
      });

      this.socket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
        console.log('Friend status changed:', data);
        this.ui.updateFriendStatus(data.userId, data.status);
      });

      this.socket.on('friend-request', async (data: any) => {
        console.log('New friend request received:', data);
        this.ui.showNotification(`${data.sender?.username || 'Someone'} sent you a friend request`);
        await this.loadFriendRequests();
      });

      this.socket.on('friend-request-sent', async (data: any) => {
        console.log('Friend request sent confirmation:', data);
        await this.loadFriendRequests();
      });

      this.socket.on('friend-request-updated', async (data: any) => {
        console.log('Friend request updated:', data);
        await this.loadFriendRequests();
        if (data.status === 'accepted') {
          await this.loadFriends();
        }
      });

      this.socket.on('friend-added', async (data: any) => {
        console.log('New friend added:', data);
        this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}`);
        await this.loadFriends();
      });

      this.socket.on('room-created', async (data: any) => {
        await this.loadChatRooms();
        this.ui.showNotification(`New room "${data.room?.name}" created!`);
      });

      this.socket.on('room-deleted', async (data: { roomId: number }) => {
        if (this.currentRoom && this.currentRoom.id === data.roomId) {
          this.currentRoom = null;
          this.ui.showChatArea(false);
        }

        await this.loadChatRooms();
      });
    });
  }

  private handleSocketMessage(data: any): void {
    try {
      switch (data.type) {
        case 'message':
          this.handleNewMessage(data);
          break;
        case 'user_joined':
          this.handleUserJoined(data);
          break;
        case 'user_left':
          this.handleUserLeft(data);
          break;
        case 'game_invitation':
          // Game invitations are now handled via global socket in main.ts
          this.showGameInvitation(data);
          break;
        case 'typing':
          this.handleTyping(data);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling socket message:', error);
    }
  }

  private setupUIHandlers(): void {
    this.ui.onSendMessage((message: string) => {
      this.sendMessage(message);
    });

    this.ui.onUserSelect((userId: number) => {
      this.startDirectMessage(userId);
    });

    this.ui.onRoomSelect((roomId: number) => {
      this.joinRoom(roomId);
    });

    this.ui.onSearch((query: string) => {
      this.searchUsers(query);
    });

    this.ui.onGameInvite((userId: number) => {
      this.sendGameInvitation(userId);
    });

    this.ui.onBlockUser((userId: number) => {
      this.blockUser(userId);
    });

    this.ui.onUnblockUser((userId: number) => {
      this.unblockUser(userId);
    });

    this.ui.onLeaveRoom(() => {
      this.leaveCurrentRoom();
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

    this.ui.onCreateRoom(async (name: string, type: 'public' | 'protected', password?: string) => {
      await this.createRoom(name, type, password);
    });

    this.ui.onDeleteRoom(async () => {
      await this.deleteRoom();
    });
  }

  private async loadFriends(): Promise<void> {
    try {
      const friends = await this.api.getFriends();
      this.ui.renderFriendsList(friends, this.currentUser?.id || 0);
    } catch (error) {
      console.error('Failed to load friends:', error);
      this.ui.showError('Failed to load friends');
    }
  }

  private async loadFriendRequests(): Promise<void> {
    try {
      const requests = await this.api.getPendingRequests();
      this.ui.updateFriendRequestsBadge(requests.length);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  }

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

  private async showAddFriend(): Promise<void> {
    try {
      const users = await this.api.getUsers();
      this.ui.showAddFriendModal(users);
    } catch (error) {
      console.error('Failed to load users:', error);
      this.ui.showError('Failed to load users');
    }
  }

  private async sendFriendRequest(username: string): Promise<void> {
    try {
      await this.api.sendFriendRequest(username);
      this.ui.showSuccess(`Friend request sent to ${username}`);
    } catch (error) {
      console.error('Failed to send friend request:', error);
      this.ui.showError((error as Error).message || 'Failed to send friend request');
    }
  }

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

  private async loadChatRooms(): Promise<void> {
    try {
      const rooms = await this.api.getChatRooms();
      this.ui.renderChatRoomsList(rooms);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      this.ui.showError('Failed to load chat rooms');
    }
  }

  private async createRoom(name: string, type: 'public' | 'protected', password?: string): Promise<void> {
    try {
      const room = await this.api.createRoom(name, type, password);
      this.ui.showSuccess(`Room "${name}" created successfully!`);
      await this.loadChatRooms();
      await this.joinRoom(room.id, room);
    } catch (error) {
      console.error('Failed to create room:', error);
      this.ui.showError('Failed to create room: ' + (error as Error).message);
    }
  }

  private async deleteRoom(): Promise<void> {
    if (!this.currentRoom) {
      this.ui.showError('No room selected');
      return;
    }

    try {
      await this.api.deleteRoom(this.currentRoom.id);
      this.ui.showSuccess(`Room deleted successfully`);

      this.currentRoom = null;
      this.ui.showChatArea(false);

      await this.loadChatRooms();
    } catch (error) {
      console.error('Failed to delete room:', error);
      this.ui.showError('Failed to delete room: ' + (error as Error).message);
    }
  }

  private async startDirectMessage(userId: number): Promise<void> {
    try {
      const chatRoom = await this.api.createPrivateChat(userId);
      await this.joinRoom(chatRoom.id, chatRoom);
    } catch (error) {
      console.error('Failed to start DM:', error);
      this.ui.showError('Failed to start conversation');
    }
  }

  private async joinRoom(roomId: number, roomData?: ChatRoom): Promise<void> {
    try {
      if (this.currentRoom && this.socket) {
        this.socket.emit('leave-room', {
          chatRoomId: this.currentRoom.id
        });
      }

      if (!roomData) {
        const rooms = await this.api.getChatRooms();
        roomData = rooms.find(r => r.id === roomId);
      }

      const isUserMember = roomData?.members?.some((m: any) =>
        m.userId === this.currentUser?.id || m.user?.id === this.currentUser?.id
      );

      if (!isUserMember && roomData?.type !== 'private') {
        try {
          let password: string | undefined;

          if (roomData?.type === 'protected') {
            const enteredPassword = await this.ui.showPasswordPrompt(roomData.name);
            if (!enteredPassword) {
              return;
            }
            password = enteredPassword;
          }

          await this.api.joinRoom(roomId, password);

          const rooms = await this.api.getChatRooms();
          roomData = rooms.find(r => r.id === roomId);
        } catch (joinError: any) {
          if (joinError.message?.includes('Already a member')) {
          } else if (joinError.message?.includes('Incorrect password')) {
            this.ui.showError('Incorrect password');
            return;
          } else {
            throw joinError;
          }
        }
      }

      const messages = await this.api.getRoomMessages(roomId);

      if (this.socket) {
        this.socket.emit('join-room', {
          chatRoomId: roomId
        });
      }

      let roomName = roomData?.name || 'Chat';
      let targetUserId: number | undefined;
      let avatarUrl: string | undefined;
      let userStatus: 'online' | 'offline' = 'offline';
      let isBlocked = false;

      if (roomData?.type === 'private' && roomData.members) {
        const otherMember = roomData.members.find((m: any) =>
          m.userId !== this.currentUser?.id || m.user?.id !== this.currentUser?.id
        );
        if (otherMember?.user) {
          roomName = otherMember.user.username;
          targetUserId = otherMember.user.id || otherMember.userId;
          avatarUrl = otherMember.user.avatar;
          userStatus = (otherMember.user.status === 'online' || otherMember.user.status === 'offline')
            ? otherMember.user.status
            : 'offline';

          if (targetUserId) {
            // Check cached block status first (from pending updates)
            if (this.cachedBlockStatuses.has(targetUserId)) {
              isBlocked = this.cachedBlockStatuses.get(targetUserId) || false;
            } else {
              // Fall back to API if not cached
              try {
                const blockedUsers = await this.api.getBlockedUsers();
                isBlocked = blockedUsers.some((u: any) => u.id === targetUserId);
                this.cachedBlockStatuses.set(targetUserId, isBlocked);
              } catch (error) {
                console.error('Failed to check block status:', error);
              }
            }
          }
        }
      }

      this.currentRoom = roomData || { id: roomId, name: roomName, type: 'public', members: [] };
      this.ui.showChatArea(true);

      this.ui.setChatTitle(
        roomName,
        targetUserId,
        roomData?.type,
        (roomData as any)?.ownerId || (roomData as any)?.owner?.id,
        this.currentUser?.id,
        avatarUrl,
        isBlocked,
        userStatus
      );

      this.ui.renderMessages(messages, this.currentUser?.id || 0);

    } catch (error) {
      console.error('Failed to join room:', error);
      this.ui.showError('Failed to join room: ' + (error as Error).message);
    }
  }

  private sendMessage(content: string): void {
    if (!content.trim() || !this.currentRoom || !this.socket) {
      return;
    }

    const messageData = {
      chatRoomId: this.currentRoom.id,
      content: content.trim()
    };

    this.socket.emit('send-message', messageData);
    this.ui.clearMessageInput();
  }

  private handleNewMessage(data: any): void {
    const message: ChatMessage = {
      id: data.id,
      content: data.content,
      senderId: data.senderId,
      senderName: data.sender?.username || data.senderName || 'Unknown',
      senderAvatar: data.sender?.avatar || data.senderAvatar || '',
      timestamp: data.timestamp || data.created_at || new Date().toISOString(),
      type: data.type || 'text',
      metadata: data.metadata
    };

    if (data.chatRoomId === this.currentRoom?.id) {
      this.ui.addMessage(message, this.currentUser?.id || 0);
    } else {
      this.ui.showNotification(`New message from ${message.senderName}`);
    }
  }

  private handleUserJoined(data: any): void {
    console.log(`User ${data.username} joined`);
  }

  private handleUserLeft(data: any): void {
    console.log(`User ${data.username} left`);
  }

  private handleTyping(data: any): void {
    if (data.chatRoomId === this.currentRoom?.id) {
      this.ui.showTypingIndicator(data.username);
    }
  }

  private async sendGameInvitation(userId: number): Promise<void> {
    console.log('🎮 [ChatManager] Sending game invitation to userId:', userId);
    try {
      await this.api.sendGameInvite(userId);
      console.log('✅ [ChatManager] Game invitation sent successfully');
      this.ui.showSuccess('Game invitation sent!');
    } catch (error) {
      console.error('❌ [ChatManager] Failed to send game invite:', error);
      this.ui.showError((error as Error).message || 'Failed to send game invitation');
    }
  }

  private showGameInvitation(data: any): void {
    if (!data.id) {
      console.error('No invitation ID provided');
      return;
    }

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
        <button id="accept-chat-game-invite-${data.id}" class="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium">
          ✓ Accept
        </button>
        <button id="decline-chat-game-invite-${data.id}" class="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium">
          ✗ Decline
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    const timeout = setTimeout(() => {
      notification.remove();
    }, 30000);

    setTimeout(() => {
      const acceptBtn = notification.querySelector(`#accept-chat-game-invite-${data.id}`) as HTMLButtonElement;
      const declineBtn = notification.querySelector(`#decline-chat-game-invite-${data.id}`) as HTMLButtonElement;

      if (acceptBtn) {
        acceptBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(timeout);
          notification.remove();
          await this.acceptGameInvitation(data.id);
        };
      }

      if (declineBtn) {
        declineBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(timeout);
          notification.remove();
          await this.declineGameInvitation(data.id);
        };
      }
    }, 100);
  }

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

      setTimeout(() => {
        window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
      }, 1000);
    } catch (error) {
      console.error('Failed to accept game invitation:', error);
      this.ui.showError((error as Error).message || 'Failed to accept game invitation');
    }
  }

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

  private processGameInviteAccepted(data: any): void {
    console.log('🎉 [ChatManager] Game invitation accepted! Room:', data.gameRoomId);
    console.log('   → Full data:', JSON.stringify(data, null, 2));

    if (!data.gameRoomId) {
      console.error('❌ No gameRoomId in accepted invite data!');
      this.ui.showError('Failed to get game room ID');
      return;
    }

    this.ui.showSuccess('Your invitation was accepted! Redirecting to game...');

    console.log(`🎮 Redirecting sender to: /dashboard/game/remote?room=${data.gameRoomId}`);
    setTimeout(() => {
      window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
    }, 500);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async blockUser(userId: number): Promise<void> {
    try {
      await this.api.blockUser(userId);
      this.ui.showSuccess('User blocked successfully');

      // Cache the block status
      this.cachedBlockStatuses.set(userId, true);
      this.ui.updateBlockButtonStatus(userId, true);

      await this.loadFriends();

      // Emit event for friends manager to sync
      window.dispatchEvent(new CustomEvent('user-blocked', { detail: { userId, isBlocked: true } }));
    } catch (error: any) {
      console.error('Failed to block user:', error);
      this.ui.showError(error.message || 'Failed to block user');
    }
  }  private async unblockUser(userId: number): Promise<void> {
    try {
      await this.api.unblockUser(userId);
      this.ui.showSuccess('User unblocked successfully');

      // Cache the block status
      this.cachedBlockStatuses.set(userId, false);
      this.ui.updateBlockButtonStatus(userId, false);

      await this.loadFriends();

      // Emit event for friends manager to sync
      window.dispatchEvent(new CustomEvent('user-blocked', { detail: { userId, isBlocked: false } }));
    } catch (error: any) {
      console.error('Failed to unblock user:', error);
      this.ui.showError(error.message || 'Failed to unblock user');
    }
  }  private async searchUsers(query: string): Promise<void> {
  }

  private leaveCurrentRoom(): void {
    if (this.currentRoom && this.socket) {
      this.socket.emit('leave-room', {
        chatRoomId: this.currentRoom.id
      });
    }

    this.currentRoom = null;
    this.ui.showChatArea(false);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.ui.showError('Connection lost. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    console.log(`Reconnecting in ${delay}ms... (Attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connectSocket().catch(console.error);
    }, delay);
  }

  handleFriendStatusChange(userId: number, status: 'online' | 'offline'): void {
    this.ui.updateFriendStatus(userId, status);
  }

  /**
   * Update block status (called from global app-level listener)
   */
  updateBlockStatus(userId: number, isBlocked: boolean): void {
    // Cache the block status
    this.cachedBlockStatuses.set(userId, isBlocked);

    this.ui.updateBlockButtonStatus(userId, isBlocked);
    this.loadFriends(); // Reload friends list
  }

  async handleFriendRequest(data: any): Promise<void> {
    this.ui.showNotification(`${data.senderUsername || 'Someone'} sent you a friend request`);
    await this.loadFriendRequests();
  }

  async handleFriendAdded(data: any): Promise<void> {
    this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}`);
    await this.loadFriends();
  }

  /**
   * Public method to handle game invitation (called from global socket in main.ts)
   */
  handleGameInvitation(data: any): void {
    console.log('🎮 [ChatManager] Handling game invitation:', data);
    console.log('   → Sender ID:', data.senderId);
    console.log('   → Current user ID:', this.currentUser?.id);

    // Don't show invitation notification if current user is the sender
    if (data.senderId === this.currentUser?.id) {
      return;
    }

    this.showGameInvitation(data);
  }

  /**
   * Public method to handle game invite accepted (called from global socket in main.ts)
   */
  handleGameInviteAccepted(data: any): void {
    this.processGameInviteAccepted(data);
  }

  private cleanupGlobalSocketListeners(globalSocket: any): void {
    if (!globalSocket) return;

    globalSocket.off('friend-status-change');
    globalSocket.off('user-status-change');
  }

  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.ui.destroy();
  }
}
