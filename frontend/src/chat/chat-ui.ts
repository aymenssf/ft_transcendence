/**
 * Chat UI Module - All rendering and DOM updates for chat interface
 */

import { ChatMessage, ChatRoom, User, GameInvite } from './types.js';

export class ChatUI {
  private container: HTMLElement;
  private messageHandlers: Map<string, Function> = new Map();

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.render();
  }

  /**
   * Render initial chat UI structure with Tailwind classes
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="flex h-[calc(100vh-8rem)] bg-gray-800/70 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl mt-20">
        <!-- Sidebar -->
        <aside class="w-80 bg-gray-900/50 border-r border-gray-700/50 flex flex-col">
          <!-- Search -->
          <div class="p-4 border-b border-gray-700/50">
            <h3 class="text-emerald-400 text-lg font-bold mb-3 flex items-center gap-2">
              💬 Chats
            </h3>
            <input
              type="text"
              id="chat-search-input"
              class="w-full px-4 py-2 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all"
              placeholder="Search user..."
            />
          </div>

          <!-- Friends Section -->
          <div class="border-b border-gray-700/50 max-h-[300px] overflow-y-auto">
            <div class="flex items-center justify-between px-4 py-3 text-gray-400 text-sm font-semibold uppercase">
              <span>👥 Friends</span>
              <div class="flex gap-2">
                <button id="friend-requests-btn" class="relative p-1 hover:text-emerald-400 transition-colors" title="Friend Requests">
                  📬
                  <span id="friend-requests-badge" class="hidden absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">0</span>
                </button>
                <button id="add-friend-btn" class="p-1 hover:text-emerald-400 transition-colors" title="Add Friend">➕</button>
              </div>
            </div>
            <div id="chat-friends-list" class="px-2">
              <!-- Friends will be rendered here -->
            </div>
          </div>

          <!-- Chat Rooms -->
          <div class="border-b border-gray-700/50 flex-1 overflow-y-auto">
            <div class="flex items-center justify-between px-4 py-3 text-gray-400 text-sm font-semibold uppercase">
              <span>💬 Rooms</span>
              <button id="create-room-btn" class="p-1 hover:text-emerald-400 transition-colors" title="Create Room">➕</button>
            </div>
            <div id="chat-rooms-list" class="px-2">
              <!-- Rooms will be rendered here -->
            </div>
          </div>
        </aside>

        <!-- Main Chat Area -->
        <main class="flex-1 flex flex-col bg-gray-800/30">
          <!-- No chat selected -->
          <div id="no-chat-selected" class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="text-6xl mb-4">💬</div>
              <h2 class="text-2xl font-bold text-white mb-2">Select a chat</h2>
              <p class="text-gray-400">Choose a user or room to start messaging</p>
            </div>
          </div>

          <!-- Active Chat -->
          <div id="active-chat-container" class="hidden flex-1 flex flex-col">
            <!-- Chat Header -->
            <header class="bg-gray-900/50 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="relative">
                  <img id="chat-avatar" class="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover" src="" alt="">
                  <span id="chat-status-dot" class="hidden absolute -bottom-1 -right-1 text-sm">🟢</span>
                </div>
                <div>
                  <h3 id="chat-title" class="text-white font-bold text-lg">Chat Title</h3>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button id="chat-view-profile-btn" class="hidden px-3 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-colors text-sm">
                  👤 Profile
                </button>
                <button id="chat-game-invite-btn" class="hidden px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 hover:from-emerald-500/30 hover:to-blue-500/30 text-emerald-400 rounded-lg transition-all border border-emerald-500/30 hover:border-emerald-500/50 hover:scale-105 active:scale-95 font-medium text-sm shadow-lg">
                  <span class="flex items-center gap-2">
                    <span class="text-lg">🎮</span>
                    <span>Invite to Game</span>
                  </span>
                </button>
                <button id="chat-block-user-btn" class="hidden px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm border border-red-500/30">
                  🚫 Block
                </button>
                <button id="chat-delete-room-btn" class="hidden px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm border border-red-500/30">
                  🗑️ Delete Room
                </button>
                <button id="chat-leave-btn" class="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm border border-red-500/30">
                  Leave
                </button>
              </div>
            </header>

            <!-- Messages Container -->
            <div id="messages-container" class="flex-1 overflow-y-auto p-6 space-y-4">
              <!-- Messages will be rendered here -->
            </div>

            <!-- Typing Indicator -->
            <div id="typing-indicator" class="hidden px-6 py-2 text-gray-400 text-sm">
              <span class="inline-flex gap-1">
                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
              </span>
              <span id="typing-user" class="ml-2"></span> is typing...
            </div>

            <!-- Message Input -->
            <div class="bg-gray-900/50 border-t border-gray-700/50 p-4 flex gap-3">
              <input
                type="text"
                id="message-input"
                class="flex-1 px-4 py-3 bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all"
                placeholder="Type your message..."
              />
              <button id="send-message-btn" class="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-all hover:scale-105 active:scale-95">
                Send ▶️
              </button>
            </div>
          </div>
        </main>



        <!-- Toast Notifications -->
        <div id="toast-container" class="fixed top-20 right-4 z-50 flex flex-col gap-2">
          <!-- Toasts will be rendered here -->
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    // Message send
    const sendBtn = document.getElementById('send-message-btn');
    const messageInput = document.getElementById('message-input') as HTMLInputElement;

    sendBtn?.addEventListener('click', () => {
      const message = messageInput?.value.trim();
      if (message) {
        this.messageHandlers.get('sendMessage')?.(message);
      }
    });

    messageInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message) {
          this.messageHandlers.get('sendMessage')?.(message);
        }
      }
    });

    // Search
    const searchInput = document.getElementById('chat-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
      // Filter both friends and rooms
      this.filterFriendsList(query);
      this.filterRoomsList(query);
    });

    // Refresh users
    document.getElementById('refresh-users-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('refreshUsers')?.();
    });

    // Leave room
    document.getElementById('chat-leave-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('leaveRoom')?.();
    });

    // View profile button in chat header
    document.getElementById('chat-view-profile-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('chat-view-profile-btn');
      const userId = btn?.getAttribute('data-user-id');
      if (userId) {
        this.showUserProfile(parseInt(userId));
      }
    });

    // Game invitation button in chat header
    document.getElementById('chat-game-invite-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('chat-game-invite-btn');
      const userId = btn?.getAttribute('data-user-id');
      if (userId) {
        this.messageHandlers.get('gameInvite')?.(parseInt(userId));
      }
    });

    // Block/Unblock user button in chat header
    document.getElementById('chat-block-user-btn')?.addEventListener('click', () => {
      const btn = document.getElementById('chat-block-user-btn');
      const userId = btn?.getAttribute('data-user-id');
      const action = btn?.getAttribute('data-action');
      if (userId) {
        if (action === 'unblock') {
          this.messageHandlers.get('unblockUser')?.(parseInt(userId));
        } else {
          this.messageHandlers.get('blockUser')?.(parseInt(userId));
        }
      }
    });

    // Delete room button in chat header
    document.getElementById('chat-delete-room-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
        this.messageHandlers.get('deleteRoom')?.();
      }
    });

    // Friend requests button
    document.getElementById('friend-requests-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('showFriendRequests')?.();
    });

    // Add friend button
    document.getElementById('add-friend-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('showAddFriend')?.();
    });

    // Create room button
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
      this.showCreateRoomModal();
    });
  }

  /**
   * Render friends list
   */
  async renderFriendsList(friends: User[], currentUserId: number): Promise<void> {
    const container = document.getElementById('chat-friends-list');
    if (!container) return;

    // Store for search filtering
    this.allFriends = friends;
    this.currentUserId = currentUserId;
    await this.filterFriendsList('');
  }

    async filterFriendsList(query: string): Promise<void> {
    const container = document.getElementById('chat-friends-list');
    if (!container) return;

    let friends = this.allFriends;

    if (query) {
      friends = friends.filter(friend =>
        friend.username.toLowerCase().includes(query)
      );
    }

    if (friends.length === 0) {
      container.innerHTML = query
        ? `<div class="p-4 text-center text-gray-400 text-sm">No friends found matching "${this.escapeHtml(query)}"</div>`
        : `<div class="p-4 text-center text-gray-400 text-sm">No friends yet 😢<br><span class="text-xs">Click ➕ to add friends</span></div>`;
      return;
    }

    let blockedUserIds: number[] = [];
    try {
      const blockedUsersResponse = await fetch('/chat/api/users/blocked', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }
      });
      if (blockedUsersResponse.ok) {
        const { blockedUsers } = await blockedUsersResponse.json();
        blockedUserIds = blockedUsers.map((block: any) => block.blocked.id);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }

    container.innerHTML = friends
      .map(friend => {
        const isOnline = friend.status === 'online';
        const statusDot = isOnline ? '🟢' : '⚫';
        const statusText = isOnline ? 'Online' : 'Offline';
        const statusColor = isOnline ? 'text-emerald-400' : 'text-gray-500';
        const isBlocked = blockedUserIds.includes(friend.id);

        return `
          <div class="flex items-center gap-3 p-3 mb-2 bg-gray-800/40 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-all group border border-transparent hover:border-emerald-500/30" data-friend-id="${friend.id}" data-action="message-friend" data-user-id="${friend.id}">
            <div class="relative">
              <img class="w-10 h-10 rounded-full border-2 ${isOnline ? 'border-emerald-500' : 'border-gray-600'} object-cover" src="${friend.avatar || '/images/avatars/1.jpg'}" alt="${friend.username}">
              <span class="absolute bottom-0 right-0 text-sm">${statusDot}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-white font-medium truncate">${this.escapeHtml(friend.username)}</div>
            </div>
          </div>
        `;
      }).join('');

    // Click on friend card to open chat
    container.querySelectorAll('[data-action="message-friend"]').forEach(card => {
      card.addEventListener('click', (e) => {
        const userId = parseInt((card as HTMLElement).dataset.userId || '0');
        this.messageHandlers.get('userSelect')?.(userId);
      });
    });
  }

  /**
   * Update friend requests badge
   */
  updateFriendRequestsBadge(count: number): void {
    const badge = document.getElementById('friend-requests-badge');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count.toString();
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  /**
   * Show friend requests modal
   */
  showFriendRequestsModal(requests: any[]): void {
    const existingModal = document.getElementById('friend-requests-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'friend-requests-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-emerald-400">Friend Requests</h3>
          <button id="close-requests-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div class="space-y-3 max-h-96 overflow-y-auto">
          ${requests.length === 0 ? `
            <div class="text-center text-gray-400 py-8">
              No pending requests
            </div>
          ` : requests.map(req => `
            <div class="bg-gray-700/50 rounded-lg p-4 flex items-center gap-3">
              <img class="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover" src="${req.sender?.avatar || '/images/avatars/1.jpg'}" alt="${req.sender?.username}">
              <div class="flex-1">
                <div class="text-white font-medium">${this.escapeHtml(req.sender?.username || 'Unknown')}</div>
                <div class="text-gray-400 text-sm">Wants to be friends</div>
              </div>
              <div class="flex gap-2">
                <button class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm" data-action="accept-request" data-request-id="${req.id}">
                  ✓ Accept
                </button>
                <button class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm" data-action="decline-request" data-request-id="${req.id}">
                  ✗ Decline
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal handlers
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('close-requests-modal')?.addEventListener('click', () => modal.remove());

    // Accept/Decline handlers
    modal.querySelectorAll('[data-action="accept-request"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const requestId = parseInt((e.target as HTMLElement).dataset.requestId || '0');
        this.messageHandlers.get('acceptFriendRequest')?.(requestId);
        modal.remove();
      });
    });

    modal.querySelectorAll('[data-action="decline-request"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const requestId = parseInt((e.target as HTMLElement).dataset.requestId || '0');
        this.messageHandlers.get('declineFriendRequest')?.(requestId);
        modal.remove();
      });
    });
  }

  /**
   * Show add friend modal
   */
  showAddFriendModal(users: User[]): void {
    const existingModal = document.getElementById('add-friend-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'add-friend-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-emerald-400">Add Friend</h3>
          <button id="close-add-friend-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <input
          type="text"
          id="add-friend-search"
          class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 mb-4"
          placeholder="Search username..."
        />
        <div id="add-friend-results" class="space-y-2 max-h-96 overflow-y-auto">
          <div class="text-center text-gray-400 py-8">
            Type to search users...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal handlers
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    document.getElementById('close-add-friend-modal')?.addEventListener('click', () => modal.remove());

    // Search handler
    const searchInput = document.getElementById('add-friend-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      if (query.length < 2) {
        const results = document.getElementById('add-friend-results');
        if (results) {
          results.innerHTML = '<div class="text-center text-gray-400 py-8">Type at least 2 characters...</div>';
        }
        return;
      }

      const filtered = users.filter(u => u.username.toLowerCase().includes(query));
      this.renderAddFriendResults(filtered);
    });
  }

  /**
   * Render add friend search results
   */
  private renderAddFriendResults(users: User[]): void {
    const container = document.getElementById('add-friend-results');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-400 py-8">No users found</div>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="bg-gray-700/50 rounded-lg p-3 flex items-center gap-3">
        <img class="w-10 h-10 rounded-full border-2 border-gray-600 object-cover" src="${user.avatar || '/images/avatars/1.jpg'}" alt="${user.username}">
        <div class="flex-1">
          <div class="text-white font-medium">${this.escapeHtml(user.username)}</div>
        </div>
        <div class="flex gap-2">
          <button class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm" data-action="send-request" data-username="${user.username}">
            ➕ Add
          </button>
          <button class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm" data-action="block-user" data-user-id="${user.id}" title="Block">
            🚫 Block
          </button>
        </div>
      </div>
    `).join('');

    // Attach send request handlers
    container.querySelectorAll('[data-action="send-request"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const username = (e.target as HTMLElement).dataset.username || '';
        this.messageHandlers.get('sendFriendRequest')?.(username);
        document.getElementById('add-friend-modal')?.remove();
      });
    });

    // Attach block handlers
    container.querySelectorAll('[data-action="block-user"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
        if (confirm('Are you sure you want to block this user?')) {
          this.messageHandlers.get('blockUser')?.(userId);
          document.getElementById('add-friend-modal')?.remove();
        }
      });
    });
  }

  /**
   * Update friend online status
   */
  updateFriendStatus(userId: number, status: 'online' | 'offline'): void {
    const friendsList = document.getElementById('chat-friends-list');
    if (!friendsList) return;

    const friendElement = friendsList.querySelector(`[data-friend-id="${userId}"]`);
    if (!friendElement) return;

    const isOnline = status === 'online';
    const statusDot = isOnline ? '🟢' : '⚫';
    const statusText = isOnline ? 'Online' : 'Offline';
    const statusColor = isOnline ? 'text-emerald-400' : 'text-gray-500';

    // Update avatar border
    const avatar = friendElement.querySelector('img');
    if (avatar) {
      avatar.classList.remove('border-emerald-500', 'border-gray-600');
      avatar.classList.add(isOnline ? 'border-emerald-500' : 'border-gray-600');
    }

    // Update status dot
    const dotSpan = friendElement.querySelector('.absolute.bottom-0.right-0');
    if (dotSpan) {
      dotSpan.textContent = statusDot;
    }

    // Update status text
    const statusDiv = friendElement.querySelector('.text-xs:last-child');
    if (statusDiv) {
      statusDiv.className = `${statusColor} text-xs`;
      statusDiv.textContent = statusText;
    }
  }

  /**
   * Update block button state
   */
  updateBlockButton(isBlocked: boolean): void {
    const blockBtn = document.getElementById('chat-block-user-btn');
    if (!blockBtn) return;

    if (isBlocked) {
      blockBtn.innerHTML = '✓ Unblock';
      blockBtn.setAttribute('data-action', 'unblock');
      blockBtn.className = 'px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm border border-emerald-500/30';
    } else {
      blockBtn.innerHTML = '🚫 Block';
      blockBtn.setAttribute('data-action', 'block');
      blockBtn.className = 'px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm border border-red-500/30';
    }
  }

  /**
   * Render users list
   */
  renderUserList(users: User[], currentUserId: number): void {
    const container = document.getElementById('chat-users-list');
    if (!container) return;

    container.innerHTML = users
      .filter(user => user.id !== currentUserId)
      .map(user => `
        <div class="flex items-center gap-3 p-3 mb-2 bg-gray-800/40 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-all group border border-transparent hover:border-emerald-500/30" data-user-id="${user.id}">
          <img class="w-10 h-10 rounded-full border-2 border-emerald-500 object-cover" src="${user.avatar || '/images/avatars/1.jpg'}" alt="${user.username}">
          <div class="flex-1 min-w-0">
            <div class="text-white font-medium truncate">${this.escapeHtml(user.username)}</div>
            <div class="text-emerald-400 text-xs">● Online</div>
          </div>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button class="p-1.5 hover:bg-emerald-500/20 rounded transition-colors text-lg" data-action="message" data-user-id="${user.id}" title="Message">💬</button>
            <button class="p-1.5 hover:bg-emerald-500/20 rounded transition-colors text-lg" data-action="invite" data-user-id="${user.id}" title="Invite to Game">🎮</button>
            <button class="p-1.5 hover:bg-red-500/20 rounded transition-colors text-lg" data-action="block" data-user-id="${user.id}" title="Block">🚫</button>
          </div>
        </div>
      `).join('');

    // Attach action handlers
    container.querySelectorAll('[data-action="message"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
        this.messageHandlers.get('userSelect')?.(userId);
      });
    });

    container.querySelectorAll('[data-action="invite"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
        this.messageHandlers.get('gameInvite')?.(userId);
      });
    });

    container.querySelectorAll('[data-action="block"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
        if (confirm('Are you sure you want to block this user?')) {
          this.messageHandlers.get('blockUser')?.(userId);
        }
      });
    });
  }

  /**
   * Store all rooms for filtering
   */
  private allRooms: ChatRoom[] = [];
  private allFriends: User[] = [];
  private currentUserId: number = 0;

  /**
   * Render chat rooms list
   */
  renderChatRoomsList(rooms: ChatRoom[]): void {
    // Store all rooms for filtering
    this.allRooms = rooms;
    this.filterRoomsList('');
  }

  /**
   * Filter rooms list based on search query
   */
  filterRoomsList(query: string): void {
    const container = document.getElementById('chat-rooms-list');
    if (!container) {
      console.error('❌ chat-rooms-list container not found!');
      return;
    }

    // Filter out private rooms (they should only appear when opening from friends list)
    let publicRooms = this.allRooms.filter(room => room.type !== 'private');

    // Apply search filter if query exists
    if (query) {
      publicRooms = publicRooms.filter(room =>
        room.name.toLowerCase().includes(query)
      );
    }

    if (publicRooms.length === 0) {
      container.innerHTML = query
        ? `<div class="p-4 text-center text-gray-400 text-sm">No rooms found matching "${this.escapeHtml(query)}"</div>`
        : `<div class="p-4 text-center text-gray-400 text-sm">No public rooms yet</div>`;
      return;
    }

    container.innerHTML = publicRooms.map(room => {
      const icon = room.type === 'public' ? '🌐' : '️';
      return `
        <div class="flex items-center gap-3 p-3 mb-2 bg-gray-800/40 hover:bg-gray-700/50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-emerald-500/30" data-room-id="${room.id}">
          <div class="text-2xl">${icon}</div>
          <div class="flex-1 min-w-0">
            <div class="text-white font-medium truncate">${this.escapeHtml(room.name || 'Chat Room')}</div>
            <div class="text-gray-400 text-xs">${room.members?.length || 0} members</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach room selection handlers
    container.querySelectorAll('[data-room-id]').forEach(item => {
      item.addEventListener('click', (e) => {
        const roomId = parseInt((e.currentTarget as HTMLElement).dataset.roomId || '0');
        this.messageHandlers.get('roomSelect')?.(roomId);
      });
    });
  }

  /**
   * Render messages
   */
  renderMessages(messages: ChatMessage[], currentUserId: number): void {
    const container = document.getElementById('messages-container');
    if (!container) return;

    container.innerHTML = messages.map(msg =>
      this.createMessageHTML(msg, currentUserId)
    ).join('');

    this.attachGameInviteHandlers();
    this.scrollToBottom();
  }

  /**
   * Add single message
   */
  addMessage(message: ChatMessage, currentUserId: number): void {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const messageHTML = this.createMessageHTML(message, currentUserId);
    container.insertAdjacentHTML('beforeend', messageHTML);
    this.attachGameInviteHandlers();
    this.scrollToBottom();
  }

  /**
   * Attach event handlers to game invitation buttons
   */
  private attachGameInviteHandlers(): void {
    // Accept buttons
    document.querySelectorAll('.game-invite-accept-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = e.target as HTMLButtonElement;
        const invitationId = parseInt(target.getAttribute('data-invitation-id') || '0');
        if (invitationId) {
          await this.acceptGameInvitation(invitationId);
          // Disable buttons after click
          target.disabled = true;
          target.textContent = '✓ Accepted';
        }
      });
    });

    // Decline buttons
    document.querySelectorAll('.game-invite-decline-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const target = e.target as HTMLButtonElement;
        const invitationId = parseInt(target.getAttribute('data-invitation-id') || '0');
        if (invitationId) {
          await this.declineGameInvitation(invitationId);
          // Disable buttons after click
          target.disabled = true;
          target.textContent = '✗ Declined';
        }
      });
    });
  }

  /**
   * Accept game invitation from chat message
   */
  private async acceptGameInvitation(invitationId: number): Promise<void> {
    try {
      const response = await fetch('/chat/api/game/accept', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invitationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept invitation');
      }

      const data = await response.json();
      this.showSuccess('Redirecting to game...');

      // Redirect to game with room ID
      setTimeout(() => {
        window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
      }, 1000);
    } catch (error) {
      console.error('Failed to accept game invitation:', error);
      this.showError((error as Error).message || 'Failed to accept game invitation');
    }
  }

  /**
   * Decline game invitation from chat message
   */
  private async declineGameInvitation(invitationId: number): Promise<void> {
    try {
      const response = await fetch('/chat/api/game/decline', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invitationId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to decline invitation');
      }

      this.showSuccess('Game invitation declined');
    } catch (error) {
      console.error('Failed to decline game invitation:', error);
      this.showError((error as Error).message || 'Failed to decline game invitation');
    }
  }

  /**
   * Create message HTML with Tailwind classes
   */
  private createMessageHTML(message: ChatMessage, currentUserId: number): string {
    const isOwn = message.senderId === currentUserId;
    const time = this.formatTime(message.timestamp);

    // Ensure we have safe values to display
    const senderName = message.senderName || 'Unknown';
    const senderAvatar = message.senderAvatar || '/images/avatars/1.jpg';
    const content = message.content || '';

    // Handle game invitation messages
    if (message.type === 'game_invitation') {
      try {
        const metadata = typeof message.metadata === 'string'
          ? JSON.parse(message.metadata)
          : message.metadata;

        const invitationId = metadata?.invitationId;

        if (isOwn) {
          // Sender view - show that you sent an invitation
          return `
            <div class="flex justify-end">
              <div class="max-w-md">
                <div class="bg-emerald-500/20 border border-emerald-500/50 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="text-2xl">🎮</span>
                    <span class="font-semibold">Game Invitation</span>
                  </div>
                  <p class="text-sm opacity-80">You invited ${this.escapeHtml(metadata?.targetUsername || 'someone')} to play</p>
                </div>
                <div class="text-right text-gray-400 text-xs mt-1 px-2">${time}</div>
              </div>
            </div>
          `;
        } else {
          // Receiver view - show accept/decline buttons
          return `
            <div class="flex justify-start">
              <div class="flex gap-2 max-w-md">
                <img class="w-8 h-8 rounded-full border-2 border-emerald-500 object-cover flex-shrink-0" src="${senderAvatar}" alt="${senderName}">
                <div>
                  <div class="text-emerald-400 text-sm font-medium mb-1">${this.escapeHtml(senderName)}</div>
                  <div class="bg-gradient-to-r from-emerald-500/20 to-blue-500/20 border border-emerald-500/50 text-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-2xl">🎮</span>
                      <span class="font-semibold">Game Invitation</span>
                    </div>
                    <p class="text-sm mb-3">Would you like to play?</p>
                    <div class="flex gap-2" data-invitation-id="${invitationId}">
                      <button
                        class="game-invite-accept-btn flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
                        data-invitation-id="${invitationId}"
                      >
                        ✓ Accept
                      </button>
                      <button
                        class="game-invite-decline-btn flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                        data-invitation-id="${invitationId}"
                      >
                        ✗ Decline
                      </button>
                    </div>
                  </div>
                  <div class="text-gray-400 text-xs mt-1 px-2">${time}</div>
                </div>
              </div>
            </div>
          `;
        }
      } catch (error) {
        console.error('Error parsing game invitation metadata:', error);
      }
    }

    // Regular text messages
    if (isOwn) {
      return `
        <div class="flex justify-end">
          <div class="max-w-md">
            <div class="bg-emerald-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg">
              <p class="break-words">${this.escapeHtml(content)}</p>
            </div>
            <div class="text-right text-gray-400 text-xs mt-1 px-2">${time}</div>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="flex justify-start">
          <div class="flex gap-2 max-w-md">
            <img class="w-8 h-8 rounded-full border-2 border-gray-600 object-cover flex-shrink-0" src="${senderAvatar}" alt="${senderName}">
            <div>
              <div class="text-emerald-400 text-sm font-medium mb-1">${this.escapeHtml(senderName)}</div>
              <div class="bg-gray-700/50 text-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg">
                <p class="break-words">${this.escapeHtml(content)}</p>
              </div>
              <div class="text-gray-400 text-xs mt-1 px-2">${time}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Show/hide chat area
   */
  showChatArea(show: boolean): void {
    const noChat = document.getElementById('no-chat-selected');
    const activeChat = document.getElementById('active-chat-container');

    if (noChat) noChat.style.display = show ? 'none' : 'flex';
    if (activeChat) activeChat.classList.toggle('hidden', !show);
  }

  /**
   * Set chat title/header with avatar
   */
  setChatTitle(title: string, targetUserId?: number, roomType?: 'public' | 'private' | 'protected', roomOwnerId?: number, currentUserId?: number, avatarUrl?: string, isBlocked?: boolean, userStatus?: 'online' | 'offline'): void {
    const chatTitle = document.getElementById('chat-title');
    const chatAvatar = document.getElementById('chat-avatar') as HTMLImageElement;
    const statusDot = document.getElementById('chat-status-dot');

    if (chatTitle) {
      chatTitle.textContent = title;
    }

    // Handle avatar visibility and source
    if (chatAvatar) {
      if (roomType === 'private' && avatarUrl) {
        // Private chat - show user avatar
        chatAvatar.src = avatarUrl;
        chatAvatar.classList.remove('hidden');
      } else {
        // Public/Protected room - hide avatar
        chatAvatar.classList.add('hidden');
      }
    }

    // Handle status dot
    if (statusDot) {
      if (roomType === 'private') {
        statusDot.classList.remove('hidden');
        statusDot.textContent = userStatus === 'online' ? '🟢' : '⚫';
      } else {
        statusDot.classList.add('hidden');
      }
    }

    // Get action buttons
    const profileBtn = document.getElementById('chat-view-profile-btn');
    const gameInviteBtn = document.getElementById('chat-game-invite-btn');
    const blockBtn = document.getElementById('chat-block-user-btn');
    const deleteBtn = document.getElementById('chat-delete-room-btn');

    // First, hide all buttons by default
    if (profileBtn) profileBtn.classList.add('hidden');
    if (gameInviteBtn) gameInviteBtn.classList.add('hidden');
    if (blockBtn) blockBtn.classList.add('hidden');
    if (deleteBtn) deleteBtn.classList.add('hidden');

    // Show/hide buttons based on room type
    if (roomType === 'private' && targetUserId) {
      // Private chat - show user action buttons
      if (profileBtn) {
        profileBtn.classList.remove('hidden');
        profileBtn.setAttribute('data-user-id', targetUserId.toString());
      }
      if (gameInviteBtn) {
        gameInviteBtn.classList.remove('hidden');
        gameInviteBtn.setAttribute('data-user-id', targetUserId.toString());
      }
      if (blockBtn) {
        blockBtn.classList.remove('hidden');
        blockBtn.setAttribute('data-user-id', targetUserId.toString());
        // Change button text and handler based on block status
        if (isBlocked) {
          blockBtn.innerHTML = '✓ Unblock';
          blockBtn.setAttribute('data-action', 'unblock');
        } else {
          blockBtn.innerHTML = '🚫 Block';
          blockBtn.setAttribute('data-action', 'block');
        }
      }
    } else if (roomType === 'public' || roomType === 'protected') {
      // Public/Protected room - only show delete button to room owner (but not for General room)
      if (deleteBtn && roomOwnerId && currentUserId && roomOwnerId === currentUserId && title !== 'General') {
        deleteBtn.classList.remove('hidden');
      }
    }
  }

  /**
   * Update block button status (for syncing with friends list)
   */
  updateBlockButtonStatus(userId: number, isBlocked: boolean): void {
    const blockBtn = document.getElementById('chat-block-user-btn');
    if (blockBtn && blockBtn.getAttribute('data-user-id') === userId.toString()) {
      if (isBlocked) {
        blockBtn.innerHTML = '✓ Unblock';
        blockBtn.setAttribute('data-action', 'unblock');
      } else {
        blockBtn.innerHTML = '🚫 Block';
        blockBtn.setAttribute('data-action', 'block');
      }
    }
  }

  /**
   * Show user profile modal
   */
  async showUserProfile(userId: number): Promise<void> {
    try {
      // Fetch profile data
      const response = await fetch(`/chat/api/users/${userId}/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      const profile = data.user || data;

      // Check if user is blocked
      const blockedUsersResponse = await fetch('/chat/api/users/blocked', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });
      const { blockedUsers } = await blockedUsersResponse.json();
      const isBlocked = blockedUsers.some((block: any) => block.blocked.id === userId);

      // Remove any existing modal
      const existingModal = document.getElementById('user-profile-modal');
      if (existingModal) existingModal.remove();

      // Format date
      const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Create modal
      const modal = document.createElement('div');
      modal.id = 'user-profile-modal';
      modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-2xl font-bold text-emerald-400">User Profile</h3>
            <button id="close-profile-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
          </div>

          <div class="flex flex-col items-center mb-6">
            <img
              src="${profile.avatar || '/images/avatars/1.jpg'}"
              alt="${profile.username}"
              class="w-32 h-32 rounded-full border-4 border-emerald-500/50 mb-4 object-cover"
            />
            <h4 class="text-2xl font-bold text-white mb-1">${this.escapeHtml(profile.username)}</h4>
            ${profile.is_42_user ? '<span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full border border-blue-500/30">42 Student</span>' : ''}
          </div>

          <div class="space-y-3 bg-gray-900/50 rounded-lg p-4 border border-gray-700/50">
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Username:</span>
              <span class="text-white font-medium">${this.escapeHtml(profile.username)}</span>
            </div>
            ${profile.usernameTournament ? `
              <div class="flex justify-between items-center">
                <span class="text-gray-400">Tournament Name:</span>
                <span class="text-white font-medium">${this.escapeHtml(profile.usernameTournament)}</span>
              </div>
            ` : ''}
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Member Since:</span>
              <span class="text-white font-medium">${joinDate}</span>
            </div>
          </div>

          <div class="mt-6 flex gap-2">
            <button id="profile-send-message-btn" class="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium">
              💬 Send Message
            </button>
            <button id="profile-block-btn" class="px-4 py-2 ${isBlocked ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30'} rounded-lg transition-colors border" data-user-id="${userId}" data-action="${isBlocked ? 'unblock' : 'block'}">
              ${isBlocked ? '✓ Unblock' : '🚫 Block'}
            </button>
            <button id="profile-close-btn" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close handlers
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      document.getElementById('close-profile-modal')?.addEventListener('click', () => modal.remove());
      document.getElementById('profile-close-btn')?.addEventListener('click', () => modal.remove());

      // Send message handler
      document.getElementById('profile-send-message-btn')?.addEventListener('click', () => {
        modal.remove();
        this.messageHandlers.get('userSelect')?.(userId);
      });

      // Block/Unblock handler
      document.getElementById('profile-block-btn')?.addEventListener('click', () => {
        const action = isBlocked ? 'unblock' : 'block';
        modal.remove();
        if (action === 'unblock') {
          this.messageHandlers.get('unblockUser')?.(userId);
        } else {
          this.messageHandlers.get('blockUser')?.(userId);
        }
      });

    } catch (error) {
      console.error('Failed to load profile:', error);
      this.showError('Failed to load user profile');
    }
  }

  /**
   * Show create room modal
   */
  showCreateRoomModal(): void {
    // Remove any existing modal
    const existingModal = document.getElementById('create-room-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'create-room-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-emerald-400">Create Chat Room</h3>
          <button id="close-create-room-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-gray-400 text-sm mb-2">Room Name</label>
            <input
              type="text"
              id="room-name-input"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Enter room name..."
              maxlength="50"
            />
          </div>

          <div>
            <label class="block text-gray-400 text-sm mb-2">Room Type</label>
            <select
              id="room-type-select"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="public">🌐 Public - Anyone can join</option>
              <option value="protected">🔒 Protected - Requires password</option>
            </select>
          </div>

          <div id="password-field" class="hidden">
            <label class="block text-gray-400 text-sm mb-2">Password</label>
            <input
              type="password"
              id="room-password-input"
              class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Enter room password..."
              maxlength="50"
            />
          </div>

          <div class="flex gap-2 mt-6">
            <button id="create-room-submit-btn" class="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium">
              Create Room
            </button>
            <button id="create-room-cancel-btn" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Toggle password field based on room type
    const typeSelect = document.getElementById('room-type-select') as HTMLSelectElement;
    const passwordField = document.getElementById('password-field');

    typeSelect?.addEventListener('change', () => {
      if (typeSelect.value === 'protected') {
        passwordField?.classList.remove('hidden');
      } else {
        passwordField?.classList.add('hidden');
      }
    });

    // Close handlers
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.getElementById('close-create-room-modal')?.addEventListener('click', () => modal.remove());
    document.getElementById('create-room-cancel-btn')?.addEventListener('click', () => modal.remove());

    // Submit handler
    document.getElementById('create-room-submit-btn')?.addEventListener('click', () => {
      const nameInput = document.getElementById('room-name-input') as HTMLInputElement;
      const typeSelect = document.getElementById('room-type-select') as HTMLSelectElement;
      const passwordInput = document.getElementById('room-password-input') as HTMLInputElement;

      const name = nameInput?.value.trim();
      const type = typeSelect?.value as 'public' | 'protected';
      const password = passwordInput?.value;

      if (!name) {
        this.showError('Please enter a room name');
        return;
      }

      if (type === 'protected' && !password) {
        this.showError('Please enter a password for protected room');
        return;
      }

      modal.remove();
      this.messageHandlers.get('createRoom')?.(name, type, password);
    });
  }

  /**
   * Show password prompt for protected rooms
   */
  async showPasswordPrompt(roomName: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Remove any existing modal
      const existingModal = document.getElementById('password-prompt-modal');
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = 'password-prompt-modal';
      modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-emerald-400">Protected Room</h3>
            <button id="close-password-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
          </div>

          <div class="space-y-4">
            <p class="text-gray-300">
              "${this.escapeHtml(roomName)}" is a protected room. Please enter the password to join.
            </p>

            <div>
              <label class="block text-gray-400 text-sm mb-2">Password</label>
              <input
                type="password"
                id="room-password-prompt-input"
                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Enter password..."
                maxlength="50"
              />
            </div>

            <div class="flex gap-2 mt-6">
              <button id="password-submit-btn" class="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium">
                Join Room
              </button>
              <button id="password-cancel-btn" class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const passwordInput = document.getElementById('room-password-prompt-input') as HTMLInputElement;

      // Focus on input
      setTimeout(() => passwordInput?.focus(), 100);

      // Close handlers
      const closeModal = () => {
        modal.remove();
        resolve(null);
      };

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      document.getElementById('close-password-modal')?.addEventListener('click', closeModal);
      document.getElementById('password-cancel-btn')?.addEventListener('click', closeModal);

      // Submit handler
      const submitPassword = () => {
        const password = passwordInput?.value;
        if (!password) {
          this.showError('Please enter a password');
          return;
        }
        modal.remove();
        resolve(password);
      };

      document.getElementById('password-submit-btn')?.addEventListener('click', submitPassword);
      passwordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitPassword();
      });
    });
  }

  /**
   * Update connection status
   */


  /**
   * Show typing indicator
   */
  showTypingIndicator(username: string): void {
    const indicator = document.getElementById('typing-indicator');
    const userSpan = document.getElementById('typing-user');

    if (!indicator || !userSpan) return;

    userSpan.textContent = username;
    indicator.classList.remove('hidden');

    // Hide after 3 seconds
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 3000);
  }

  /**
   * Show game invite notification
   */
  showGameInviteNotification(invite: GameInvite): void {
    const notification = document.getElementById('game-invite-notification');
    const message = document.getElementById('game-invite-message');

    if (!notification || !message) return;

    message.textContent = `${invite.senderUsername} invited you to play Pong!`;
    notification.classList.remove('hidden');

    // Auto-hide after 30 seconds
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 30000);
  }

  /**
   * Show notification toast
   */
  showNotification(message: string): void {
    this.showToast(message, 'info');
  }

  /**
   * Show success toast
   */
  showSuccess(message: string): void {
    this.showToast(message, 'success');
  }

  /**
   * Show error toast
   */
  showError(message: string): void {
    this.showToast(message, 'error');
  }

  /**
   * Show toast message with Tailwind
   */
  private showToast(message: string, type: 'info' | 'success' | 'error'): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const colors = {
      info: 'bg-blue-500',
      success: 'bg-emerald-500',
      error: 'bg-red-500'
    };

    const toast = document.createElement('div');
    toast.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transform transition-all duration-300 translate-x-full opacity-0`;
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Clear message input
   */
  clearMessageInput(): void {
    const input = document.getElementById('message-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  /**
   * Scroll to bottom of messages
   */
  private scrollToBottom(): void {
    const container = document.getElementById('messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Format timestamp
   */
  private formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Event handler registration
   */
  onSendMessage(handler: (message: string) => void): void {
    this.messageHandlers.set('sendMessage', handler);
  }

  onUserSelect(handler: (userId: number) => void): void {
    this.messageHandlers.set('userSelect', handler);
  }

  onRoomSelect(handler: (roomId: number) => void): void {
    this.messageHandlers.set('roomSelect', handler);
  }

  onSearch(handler: (query: string) => void): void {
    this.messageHandlers.set('search', handler);
  }

  onGameInvite(handler: (userId: number) => void): void {
    this.messageHandlers.set('gameInvite', handler);
  }

  onBlockUser(handler: (userId: number) => void): void {
    this.messageHandlers.set('blockUser', handler);
  }

  onUnblockUser(handler: (userId: number) => void): void {
    this.messageHandlers.set('unblockUser', handler);
  }

  onLeaveRoom(handler: () => void): void {
    this.messageHandlers.set('leaveRoom', handler);
  }

  onShowFriendRequests(handler: () => void): void {
    this.messageHandlers.set('showFriendRequests', handler);
  }

  onShowAddFriend(handler: () => void): void {
    this.messageHandlers.set('showAddFriend', handler);
  }

  onSendFriendRequest(handler: (username: string) => void): void {
    this.messageHandlers.set('sendFriendRequest', handler);
  }

  onAcceptFriendRequest(handler: (requestId: number) => void): void {
    this.messageHandlers.set('acceptFriendRequest', handler);
  }

  onDeclineFriendRequest(handler: (requestId: number) => void): void {
    this.messageHandlers.set('declineFriendRequest', handler);
  }

  onCreateRoom(handler: (name: string, type: 'public' | 'protected', password?: string) => void): void {
    this.messageHandlers.set('createRoom', handler);
  }

  onDeleteRoom(handler: () => void): void {
    this.messageHandlers.set('deleteRoom', handler);
  }

  /**
   * Update user status indicator in chat header
   */
  updateUserStatus(status: 'online' | 'offline'): void {
    const statusDot = document.querySelector('#chat-header .status-indicator');
    if (statusDot) {
      // Remove existing status classes
      statusDot.classList.remove('bg-emerald-500', 'bg-gray-400');

      // Add appropriate status class
      if (status === 'online') {
        statusDot.classList.add('bg-emerald-500');
      } else {
        statusDot.classList.add('bg-gray-400');
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.container.innerHTML = '';
    this.messageHandlers.clear();
  }
}
