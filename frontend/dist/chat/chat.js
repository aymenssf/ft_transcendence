/**
 * Chat Module - Main chat functionality
 * Connects to backend via Socket.IO and manages all chat operations
 */
import { ChatUI } from './chat-ui.js';
import { ChatAPI } from './chat-api.js';
export class ChatManager {
    constructor(containerId) {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.authToken = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.ui = new ChatUI(containerId);
        this.api = new ChatAPI();
        this.authToken = localStorage.getItem('jwt_token');
    }
    /**
     * Start up the chat system
     */
    async init(user) {
        this.currentUser = user;
        try {
            if (typeof io === 'undefined') {
                throw new Error('Socket.IO library not loaded. Please refresh the page.');
            }
            this.setupUIHandlers();
            await this.connectSocket();
            await this.loadFriends();
            await this.loadFriendRequests();
            await this.loadChatRooms();
        }
        catch (error) {
            console.error('❌ Chat initialization failed:', error);
            this.ui.showError('Failed to initialize chat: ' + error.message);
        }
    }
    /**
     * Connect to chat Socket.IO server
     */
    async connectSocket() {
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
            this.socket.on('message', (data) => {
                this.handleNewMessage(data);
            });
            this.socket.on('disconnect', () => {
                this.ui.updateConnectionStatus(false);
                this.attemptReconnect();
            });
            this.socket.on('connect_error', (error) => {
                console.error('❌ Socket.IO connection error:', error);
                console.error('Connection details:', {
                    url: socketUrl,
                    path: socketOptions.path,
                    transports: socketOptions.transports
                });
                reject(error);
            });
            // Friend-related events
            this.socket.on('friend-status-change', (data) => {
                console.log('Friend status changed:', data);
                this.ui.updateFriendStatus(data.userId, data.status);
            });
            this.socket.on('friend-request', async (data) => {
                console.log('New friend request received:', data);
                this.ui.showNotification(`${data.senderUsername || 'Someone'} sent you a friend request`);
                await this.loadFriendRequests();
            });
            this.socket.on('friend-request-updated', async (data) => {
                console.log('Friend request updated:', data);
                await this.loadFriendRequests();
                if (data.status === 'accepted') {
                    await this.loadFriends();
                }
            });
            this.socket.on('friend-added', async (data) => {
                console.log('New friend added:', data);
                this.ui.showSuccess(`You are now friends with ${data.friend?.username || 'user'}`);
                await this.loadFriends();
            });
            // Room-related events
            this.socket.on('room-created', async (data) => {
                await this.loadChatRooms();
                this.ui.showNotification(`New room "${data.room?.name}" created!`);
            });
            this.socket.on('room-deleted', async (data) => {
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
    handleSocketMessage(data) {
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
        }
        catch (error) {
            console.error('Error handling socket message:', error);
        }
    }
    /**
     * Wire up all UI button clicks and input handlers
     */
    setupUIHandlers() {
        this.ui.onSendMessage((message) => {
            this.sendMessage(message);
        });
        this.ui.onUserSelect((userId) => {
            this.startDirectMessage(userId);
        });
        this.ui.onRoomSelect((roomId) => {
            this.joinRoom(roomId);
        });
        this.ui.onSearch((query) => {
            this.searchUsers(query);
        });
        this.ui.onGameInvite((userId) => {
            this.sendGameInvitation(userId);
        });
        this.ui.onBlockUser((userId) => {
            this.blockUser(userId);
        });
        this.ui.onUnblockUser((userId) => {
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
        this.ui.onSendFriendRequest(async (username) => {
            await this.sendFriendRequest(username);
        });
        this.ui.onAcceptFriendRequest(async (requestId) => {
            await this.acceptFriendRequest(requestId);
        });
        this.ui.onDeclineFriendRequest(async (requestId) => {
            await this.declineFriendRequest(requestId);
        });
        this.ui.onCreateRoom(async (name, type, password) => {
            await this.createRoom(name, type, password);
        });
        this.ui.onDeleteRoom(async () => {
            await this.deleteRoom();
        });
    }
    /**
     * Load friends list
     */
    async loadFriends() {
        try {
            const friends = await this.api.getFriends();
            this.ui.renderFriendsList(friends, this.currentUser?.id || 0);
        }
        catch (error) {
            console.error('Failed to load friends:', error);
            this.ui.showError('Failed to load friends');
        }
    }
    /**
     * Load friend requests
     */
    async loadFriendRequests() {
        try {
            const requests = await this.api.getPendingRequests();
            this.ui.updateFriendRequestsBadge(requests.length);
        }
        catch (error) {
            console.error('Failed to load friend requests:', error);
        }
    }
    /**
     * Show friend requests modal
     */
    async showFriendRequests() {
        try {
            const requests = await this.api.getPendingRequests();
            this.ui.showFriendRequestsModal(requests);
            this.ui.updateFriendRequestsBadge(requests.length);
        }
        catch (error) {
            console.error('Failed to load friend requests:', error);
            this.ui.showError('Failed to load friend requests');
        }
    }
    /**
     * Show add friend modal
     */
    async showAddFriend() {
        try {
            const users = await this.api.getUsers();
            this.ui.showAddFriendModal(users);
        }
        catch (error) {
            console.error('Failed to load users:', error);
            this.ui.showError('Failed to load users');
        }
    }
    /**
     * Send friend request
     */
    async sendFriendRequest(username) {
        try {
            await this.api.sendFriendRequest(username);
            this.ui.showSuccess(`Friend request sent to ${username}`);
        }
        catch (error) {
            console.error('Failed to send friend request:', error);
            this.ui.showError(error.message || 'Failed to send friend request');
        }
    }
    /**
     * Accept friend request
     */
    async acceptFriendRequest(requestId) {
        try {
            await this.api.respondToFriendRequest(requestId, true);
            this.ui.showSuccess('Friend request accepted!');
            await this.loadFriends();
            await this.loadFriendRequests();
        }
        catch (error) {
            console.error('Failed to accept friend request:', error);
            this.ui.showError('Failed to accept friend request');
        }
    }
    /**
     * Decline friend request
     */
    async declineFriendRequest(requestId) {
        try {
            await this.api.respondToFriendRequest(requestId, false);
            this.ui.showSuccess('Friend request declined');
            await this.loadFriendRequests();
        }
        catch (error) {
            console.error('Failed to decline friend request:', error);
            this.ui.showError('Failed to decline friend request');
        }
    }
    /**
     * Load chat rooms
     */
    async loadChatRooms() {
        try {
            const rooms = await this.api.getChatRooms();
            this.ui.renderChatRoomsList(rooms);
        }
        catch (error) {
            console.error('Failed to load chat rooms:', error);
            this.ui.showError('Failed to load chat rooms');
        }
    }
    /**
     * Create a new room
     */
    async createRoom(name, type, password) {
        try {
            const room = await this.api.createRoom(name, type, password);
            this.ui.showSuccess(`Room "${name}" created successfully!`);
            await this.loadChatRooms();
            // Auto-join the created room
            await this.joinRoom(room.id, room);
        }
        catch (error) {
            console.error('Failed to create room:', error);
            this.ui.showError('Failed to create room: ' + error.message);
        }
    }
    /**
     * Delete current room
     */
    async deleteRoom() {
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
        }
        catch (error) {
            console.error('Failed to delete room:', error);
            this.ui.showError('Failed to delete room: ' + error.message);
        }
    }
    /**
     * Start direct message with user
     */
    async startDirectMessage(userId) {
        try {
            const chatRoom = await this.api.createPrivateChat(userId);
            await this.joinRoom(chatRoom.id, chatRoom);
        }
        catch (error) {
            console.error('Failed to start DM:', error);
            this.ui.showError('Failed to start conversation');
        }
    }
    /**
     * Join a chat room
     */
    async joinRoom(roomId, roomData) {
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
            const isUserMember = roomData?.members?.some((m) => m.userId === this.currentUser?.id || m.user?.id === this.currentUser?.id);
            // If not a member and it's a public/protected room, join first
            if (!isUserMember && roomData?.type !== 'private') {
                try {
                    let password;
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
                }
                catch (joinError) {
                    // If already a member, that's fine, continue
                    if (joinError.message?.includes('Already a member')) {
                        // Continue silently
                    }
                    else if (joinError.message?.includes('Incorrect password')) {
                        this.ui.showError('Incorrect password');
                        return;
                    }
                    else {
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
            let targetUserId;
            let avatarUrl;
            let isBlocked = false;
            if (roomData?.type === 'private' && roomData.members) {
                // For private chats, show the other user's name and avatar
                const otherMember = roomData.members.find((m) => m.userId !== this.currentUser?.id || m.user?.id !== this.currentUser?.id);
                if (otherMember?.user) {
                    roomName = otherMember.user.username;
                    targetUserId = otherMember.user.id || otherMember.userId;
                    avatarUrl = otherMember.user.avatar;
                    // Check if user is blocked
                    if (targetUserId) {
                        try {
                            const blockedUsers = await this.api.getBlockedUsers();
                            isBlocked = blockedUsers.some((u) => u.id === targetUserId);
                        }
                        catch (error) {
                            console.error('Failed to check block status:', error);
                        }
                    }
                }
            }
            // Update UI
            this.currentRoom = roomData || { id: roomId, name: roomName, type: 'public', members: [] };
            this.ui.showChatArea(true);
            // Pass room context to setChatTitle for proper button visibility and avatar
            this.ui.setChatTitle(roomName, targetUserId, roomData?.type, roomData?.ownerId || roomData?.owner?.id, this.currentUser?.id, avatarUrl, isBlocked);
            this.ui.renderMessages(messages, this.currentUser?.id || 0);
        }
        catch (error) {
            console.error('Failed to join room:', error);
            this.ui.showError('Failed to join room: ' + error.message);
        }
    }
    /**
     * Send a message
     */
    sendMessage(content) {
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
    handleNewMessage(data) {
        const message = {
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
        }
        else {
            // Show notification for other rooms
            this.ui.showNotification(`New message from ${message.senderName}`);
        }
    }
    /**
     * Handle user joined
     */
    handleUserJoined(data) {
        console.log(`User ${data.username} joined`);
        // User joined room - could show notification
    }
    /**
     * Handle user left
     */
    handleUserLeft(data) {
        console.log(`User ${data.username} left`);
        // User left room - could show notification
    }
    /**
     * Handle game invitation
     */
    handleGameInvitation(data) {
        this.ui.showGameInviteNotification(data);
    }
    /**
     * Handle typing indicator
     */
    handleTyping(data) {
        if (data.chatRoomId === this.currentRoom?.id) {
            this.ui.showTypingIndicator(data.username);
        }
    }
    /**
     * Send game invitation
     */
    async sendGameInvitation(userId) {
        try {
            await this.api.sendGameInvite(userId);
            this.ui.showSuccess('Game invitation sent!');
        }
        catch (error) {
            console.error('Failed to send game invite:', error);
            this.ui.showError(error.message || 'Failed to send game invitation');
        }
    }
    /**
     * Block user
     */
    async blockUser(userId) {
        try {
            await this.api.blockUser(userId);
            this.ui.showSuccess('User blocked successfully');
            // Reload friends list and current room to update button states
            await this.loadFriends();
            if (this.currentRoom) {
                await this.joinRoom(this.currentRoom.id, this.currentRoom);
            }
        }
        catch (error) {
            console.error('Failed to block user:', error);
            this.ui.showError(error.message || 'Failed to block user');
        }
    }
    /**
     * Unblock user
     */
    async unblockUser(userId) {
        try {
            await this.api.unblockUser(userId);
            this.ui.showSuccess('User unblocked successfully');
            // Reload friends list and current room to update button states
            await this.loadFriends();
            if (this.currentRoom) {
                await this.joinRoom(this.currentRoom.id, this.currentRoom);
            }
        }
        catch (error) {
            console.error('Failed to unblock user:', error);
            this.ui.showError(error.message || 'Failed to unblock user');
        }
    }
    /**
     * Search users
     */
    async searchUsers(query) {
        // Search is now handled in add friend modal
        // This method can be removed or repurposed
    }
    /**
     * Leave current room
     */
    leaveCurrentRoom() {
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
    attemptReconnect() {
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
     * Cleanup and disconnect
     */
    destroy() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.ui.destroy();
    }
}
