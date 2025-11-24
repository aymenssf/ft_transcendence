/**
 * Chat Module - Main chat functionality
 * Connects to backend via Socket.IO and manages all chat operations
 */

// Socket.IO is loaded from CDN in index.html
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

  constructor(containerId: string) {
    this.ui = new ChatUI(containerId);
    this.api = new ChatAPI();
    this.authToken = localStorage.getItem('jwt_token');
  }

  /**
   * Start up the chat system
   */
  async init(user: User): Promise<void> {
    this.currentUser = user;

    try {
      this.setupUIHandlers();
      
      // Load data
      await this.loadFriends();
      await this.loadFriendRequests();
      await this.loadChatRooms();

      // Try to connect socket for chat-specific events (messages, rooms, etc)
      if (typeof io !== 'undefined') {
        try {
          await this.connectSocket();
        } catch (error) {
          console.warn('⚠️ Chat socket connection failed:', error);
          // Continue anyway - basic functionality works with global socket
        }
      }
      
      console.log('✅ Chat Manager initialized');
    } catch (error) {
      console.error('❌ Chat initialization failed:', error);
      this.ui.showError('Failed to initialize chat: ' + (error as Error).message);
    }
  }

  /**
   * Connect to chat Socket.IO server
   */
  private async connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // In production with NGINX, we connect through /chat/ proxy
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
        this.ui.updateConnectionStatus(true);
        resolve();
      });

      this.socket.on('message', (data: any) => {
        this.handleNewMessage(data);
      });

      this.socket.on('disconnect', () => {
        this.ui.updateConnectionStatus(false);
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

      // Friend-related events
      this.socket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
        console.log('Friend status changed:', data);
        this.ui.updateFriendStatus(data.userId, data.status);
      });

      this.socket.on('friend-request', async (data: any) => {
        console.log('New friend request received:', data);
        this.ui.showNotification(`${data.senderUsername || 'Someone'} sent you a friend request`);
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

      // Room-related events
      this.socket.on('room-created', async (data: any) => {
        await this.loadChatRooms();
        this.ui.showNotification(`New room "${data.room?.name}" created!`);
      });

      this.socket.on('room-deleted', async (data: { roomId: number }) => {
        // If user is in the deleted room, leave it
        if (this.currentRoom && this.currentRoom.id === data.roomId) {
          this.currentRoom = null;
          this.ui.showChatArea(false);
          // this.ui.showNotification('This room has been deleted');
        }

        // Refresh room list
        await this.loadChatRooms();
      });
    });
  }

  /**
   * Handle incoming Socket.IO messages
   */
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
          this.handleGameInvitation(data);
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

  /**
   * Wire up all UI button clicks and input handlers
   */
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
   * Load chat rooms
   */
  private async loadChatRooms(): Promise<void> {
    try {
      const rooms = await this.api.getChatRooms();
      this.ui.renderChatRoomsList(rooms);
    } catch (error) {
      console.error('Failed to load chat rooms:', error);
      this.ui.showError('Failed to load chat rooms');
    }
  }

  /**
   * Create a new room
   */
  private async createRoom(name: string, type: 'public' | 'protected', password?: string): Promise<void> {
    try {
      const room = await this.api.createRoom(name, type, password);
      this.ui.showSuccess(`Room "${name}" created successfully!`);
      await this.loadChatRooms();
      // Auto-join the created room
      await this.joinRoom(room.id, room);
    } catch (error) {
      console.error('Failed to create room:', error);
      this.ui.showError('Failed to create room: ' + (error as Error).message);
    }
  }

  /**
   * Delete current room
   */
  private async deleteRoom(): Promise<void> {
    if (!this.currentRoom) {
      this.ui.showError('No room selected');
      return;
    }

    try {
      await this.api.deleteRoom(this.currentRoom.id);
      this.ui.showSuccess(`Room deleted successfully`);

      // Clear current room and UI
      this.currentRoom = null;
      this.ui.showChatArea(false);

      // Reload room list
      await this.loadChatRooms();
    } catch (error) {
      console.error('Failed to delete room:', error);
      this.ui.showError('Failed to delete room: ' + (error as Error).message);
    }
  }

  /**
   * Start direct message with user
   */
  private async startDirectMessage(userId: number): Promise<void> {
    try {
      const chatRoom = await this.api.createPrivateChat(userId);
      await this.joinRoom(chatRoom.id, chatRoom);
    } catch (error) {
      console.error('Failed to start DM:', error);
      this.ui.showError('Failed to start conversation');
    }
  }

  /**
   * Join a chat room
   */
  private async joinRoom(roomId: number, roomData?: ChatRoom): Promise<void> {
    try {
      // Leave current room if exists
      if (this.currentRoom && this.socket) {
        this.socket.emit('leave-room', {
          chatRoomId: this.currentRoom.id
        });
      }

      // Get room data if not provided
      if (!roomData) {
        const rooms = await this.api.getChatRooms();
        roomData = rooms.find(r => r.id === roomId);
      }

      // Check if user is a member
      const isUserMember = roomData?.members?.some((m: any) =>
        m.userId === this.currentUser?.id || m.user?.id === this.currentUser?.id
      );

      // If not a member and it's a public/protected room, join first
      if (!isUserMember && roomData?.type !== 'private') {
        try {
          let password: string | undefined;

          // If protected room, prompt for password
          if (roomData?.type === 'protected') {
            const enteredPassword = await this.ui.showPasswordPrompt(roomData.name);
            if (!enteredPassword) {
              // User cancelled
              return;
            }
            password = enteredPassword;
          }

          await this.api.joinRoom(roomId, password);

          // Refresh room data to get updated member list
          const rooms = await this.api.getChatRooms();
          roomData = rooms.find(r => r.id === roomId);
        } catch (joinError: any) {
          // If already a member, that's fine, continue
          if (joinError.message?.includes('Already a member')) {
            // Continue silently
          } else if (joinError.message?.includes('Incorrect password')) {
            this.ui.showError('Incorrect password');
            return;
          } else {
            throw joinError;
          }
        }
      }

      // Load messages (now user should be a member)
      const messages = await this.api.getRoomMessages(roomId);

      // Join new room via Socket.IO
      if (this.socket) {
        this.socket.emit('join-room', {
          chatRoomId: roomId
        });
      }

      // Determine room name, target user ID, and avatar
      let roomName = roomData?.name || 'Chat';
      let targetUserId: number | undefined;
      let avatarUrl: string | undefined;
      let isBlocked = false;

      if (roomData?.type === 'private' && roomData.members) {
        // For private chats, show the other user's name and avatar
        const otherMember = roomData.members.find((m: any) =>
          m.userId !== this.currentUser?.id || m.user?.id !== this.currentUser?.id
        );
        if (otherMember?.user) {
          roomName = otherMember.user.username;
          targetUserId = otherMember.user.id || otherMember.userId;
          avatarUrl = otherMember.user.avatar;

          // Check if user is blocked
          if (targetUserId) {
            try {
              const blockedUsers = await this.api.getBlockedUsers();
              isBlocked = blockedUsers.some((u: any) => u.id === targetUserId);
            } catch (error) {
              console.error('Failed to check block status:', error);
            }
          }
        }
      }

      // Update UI
      this.currentRoom = roomData || { id: roomId, name: roomName, type: 'public', members: [] };
      this.ui.showChatArea(true);

      // Pass room context to setChatTitle for proper button visibility and avatar
      this.ui.setChatTitle(
        roomName,
        targetUserId,
        roomData?.type,
        (roomData as any)?.ownerId || (roomData as any)?.owner?.id,
        this.currentUser?.id,
        avatarUrl,
        isBlocked
      );

      this.ui.renderMessages(messages, this.currentUser?.id || 0);

    } catch (error) {
      console.error('Failed to join room:', error);
      this.ui.showError('Failed to join room: ' + (error as Error).message);
    }
  }

  /**
   * Send a message
   */
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

  /**
   * Handle new incoming message
   */
  private handleNewMessage(data: any): void {
    const message: ChatMessage = {
      id: data.id,
      content: data.content,
      senderId: data.senderId,
      senderName: data.sender?.username || 'Unknown',
      senderAvatar: data.sender?.avatar || '',
      timestamp: data.created_at || new Date().toISOString(),
      type: data.type || 'text'
    };

    // Only show if in current room
    if (data.chatRoomId === this.currentRoom?.id) {
      this.ui.addMessage(message, this.currentUser?.id || 0);
    } else {
      // Show notification for other rooms
      this.ui.showNotification(`New message from ${message.senderName}`);
    }
  }

  /**
   * Handle user joined
   */
  private handleUserJoined(data: any): void {
    console.log(`User ${data.username} joined`);
    // User joined room - could show notification
  }

  /**
   * Handle user left
   */
  private handleUserLeft(data: any): void {
    console.log(`User ${data.username} left`);
    // User left room - could show notification
  }

  /**
   * Handle game invitation
   */
  private handleGameInvitation(data: GameInvite): void {
    this.ui.showGameInviteNotification(data);
  }

  /**
   * Handle typing indicator
   */
  private handleTyping(data: any): void {
    if (data.chatRoomId === this.currentRoom?.id) {
      this.ui.showTypingIndicator(data.username);
    }
  }

  /**
   * Send game invitation
   */
  private async sendGameInvitation(userId: number): Promise<void> {
    try {
      await this.api.sendGameInvite(userId);
      this.ui.showSuccess('Game invitation sent!');
    } catch (error) {
      console.error('Failed to send game invite:', error);
      this.ui.showError((error as Error).message || 'Failed to send game invitation');
    }
  }

  /**
   * Block user
   */
  private async blockUser(userId: number): Promise<void> {
    try {
      await this.api.blockUser(userId);
      this.ui.showSuccess('User blocked successfully');

      // Reload friends list and current room to update button states
      await this.loadFriends();
      if (this.currentRoom) {
        await this.joinRoom(this.currentRoom.id, this.currentRoom);
      }
    } catch (error: any) {
      console.error('Failed to block user:', error);
      this.ui.showError(error.message || 'Failed to block user');
    }
  }

  /**
   * Unblock user
   */
  private async unblockUser(userId: number): Promise<void> {
    try {
      await this.api.unblockUser(userId);
      this.ui.showSuccess('User unblocked successfully');

      // Reload friends list and current room to update button states
      await this.loadFriends();
      if (this.currentRoom) {
        await this.joinRoom(this.currentRoom.id, this.currentRoom);
      }
    } catch (error: any) {
      console.error('Failed to unblock user:', error);
      this.ui.showError(error.message || 'Failed to unblock user');
    }
  }

  /**
   * Search users
   */
  private async searchUsers(query: string): Promise<void> {
    // Search is now handled in add friend modal
    // This method can be removed or repurposed
  }

  /**
   * Leave current room
   */
  private leaveCurrentRoom(): void {
    if (this.currentRoom && this.socket) {
      this.socket.emit('leave-room', {
        chatRoomId: this.currentRoom.id
      });
    }

    this.currentRoom = null;
    this.ui.showChatArea(false);
  }

  /**
   * Attempt to reconnect Socket.IO
   */
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

  /**
   * Handle friend status change from global socket
   */
  handleFriendStatusChange(userId: number, status: 'online' | 'offline'): void {
    this.ui.updateFriendStatus(userId, status);
  }

  /**
   * Handle friend request from global socket
   */
  async handleFriendRequest(data: any): Promise<void> {
    this.ui.showNotification(`${data.senderUsername || 'Someone'} sent you a friend request`);
    await this.loadFriendRequests();
  }

  /**
   * Handle friend added from global socket
   */
  async handleFriendAdded(data: any): Promise<void> {
    this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}`);
    await this.loadFriends();
  }

  /**
   * Cleanup and disconnect
   */
  destroy(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.ui.destroy();
  }
}
