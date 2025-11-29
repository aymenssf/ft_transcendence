import { User, FriendRequest } from './types.js';

export class FriendsUI {
  private container: HTMLElement;
  private messageHandlers: Map<string, Function> = new Map();
  private allFriends: User[] = [];
  private currentUserId: number = 0;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="flex flex-col h-[calc(100vh-8rem)] bg-gray-800/70 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl mt-20">
        <!-- Header -->
        <div class="bg-gray-900/50 border-b border-gray-700/50 p-3 md:p-6">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 md:mb-4">
            <h2 class="text-2xl md:text-3xl font-bold text-emerald-400">👥 Friends</h2>
            <div class="flex items-center gap-2 md:gap-3 flex-wrap">
              <button id="friend-requests-btn" class="relative px-3 py-1.5 md:px-4 md:py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white rounded-lg transition-colors flex items-center gap-1 md:gap-2 text-xs md:text-sm" title="Friend Requests">
                <span class="hidden sm:inline">📬 Requests</span>
                <span class="sm:hidden">📬</span>
                <span id="friend-requests-badge" class="hidden bg-red-500 text-white text-xs rounded-full px-2 py-0.5">0</span>
              </button>
              <button id="add-friend-btn" class="px-3 py-1.5 md:px-4 md:py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-1 md:gap-2 text-xs md:text-sm" title="Add Friend">
                <span class="hidden sm:inline">➕ Add Friend</span>
                <span class="sm:hidden">➕</span>
              </button>
            </div>
          </div>

          <!-- Search -->
          <input
            type="text"
            id="friends-search-input"
            class="w-full px-3 md:px-4 py-2 text-sm md:text-base bg-gray-800/80 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/50 transition-all"
            placeholder="Search friends..."
          />
        </div>

        <!-- Friends List -->
        <div class="flex-1 overflow-y-auto p-3 md:p-6">
          <div id="friends-list-container" class="space-y-2 md:space-y-3">
            <!-- Friends will be rendered here -->
            <div class="text-center text-gray-400 py-12">
              <div class="text-5xl mb-4">👥</div>
              <p>Loading friends...</p>
            </div>
          </div>
        </div>

        <!-- Connection Status -->
        <div id="connection-status" class="hidden bg-red-500/20 border-t border-red-500/50 px-4 py-2 text-center text-red-400 text-sm">
          ⚠️ Disconnected from server
        </div>
      </div>
    `;

    this.setupSearchHandler();
  }

  private setupSearchHandler(): void {
    const searchInput = document.getElementById('friends-search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase();
      this.filterFriendsList(query);
    });

    // Setup button handlers
    document.getElementById('friend-requests-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('showFriendRequests')?.();
    });

    document.getElementById('add-friend-btn')?.addEventListener('click', () => {
      this.messageHandlers.get('showAddFriend')?.();
    });
  }

  async renderFriendsList(friends: User[], currentUserId: number): Promise<void> {
    this.allFriends = friends;
    this.currentUserId = currentUserId;
    await this.filterFriendsList('');
  }

  async filterFriendsList(query: string): Promise<void> {
    const container = document.getElementById('friends-list-container');
    if (!container) return;

    let friends = this.allFriends;

    console.log('🔍 Filtering friends list, total friends:', friends.length);
    friends.forEach(f => {
      console.log(`   → ${f.username}: status = ${f.status}`);
    });

    if (query) {
      friends = friends.filter(friend =>
        friend.username.toLowerCase().includes(query)
      );
    }

    if (friends.length === 0) {
      container.innerHTML = query
        ? `<div class="text-center text-gray-400 py-12">
             <div class="text-5xl mb-4">🔍</div>
             <p>No friends found matching "${this.escapeHtml(query)}"</p>
           </div>`
        : `<div class="text-center text-gray-400 py-12">
             <div class="text-5xl mb-4">😢</div>
             <p class="text-lg mb-2">No friends yet</p>
             <p class="text-sm">Click "Add Friend" to get started!</p>
           </div>`;
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
        console.log(`   → Rendering ${friend.username}: status='${friend.status}', isOnline=${isOnline}`);
        const statusDot = isOnline ? '🟢' : '⚫';
        const statusText = isOnline ? 'Online' : 'Offline';
        const statusColor = isOnline ? 'text-emerald-400' : 'text-gray-500';
        const isBlocked = blockedUserIds.includes(friend.id);

        return `
          <div class="bg-gray-800/50 hover:bg-gray-700/50 rounded-xl p-3 md:p-4 transition-all border border-gray-700/50 hover:border-emerald-500/30 group">
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <div class="flex items-center gap-3 w-full sm:w-auto">
                <div class="relative">
                  <img
                    class="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 ${isOnline ? 'border-emerald-500' : 'border-gray-600'} object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    src="${friend.avatar || '/images/avatars/1.jpg'}"
                    alt="${friend.username}"
                    onerror="this.src='/images/avatars/1.jpg'"
                    data-action="view-profile"
                    data-user-id="${friend.id}"
                    title="View Profile"
                  >
                  <span class="absolute bottom-0 right-0 text-sm md:text-lg">${statusDot}</span>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="text-white font-semibold text-base md:text-lg truncate">${this.escapeHtml(friend.username)}</div>
                  <div class="${statusColor} text-xs md:text-sm font-medium">${statusText}</div>
                </div>
              </div>

              <div class="flex gap-1.5 md:gap-2 flex-wrap w-full sm:w-auto sm:ml-auto">
                <button
                  class="px-2 py-1.5 md:px-4 md:py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors border border-emerald-500/30 flex items-center gap-1 text-xs md:text-sm font-medium whitespace-nowrap"
                  data-action="invite-game"
                  data-user-id="${friend.id}"
                  title="Play Game"
                >
                  <span class="hidden sm:inline">🎮 Game</span>
                  <span class="sm:hidden">🎮</span>
                </button>
                <button
                  class="px-2 py-1.5 md:px-4 md:py-2 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded-lg transition-colors border border-gray-500/30 flex items-center gap-1 text-xs md:text-sm font-medium whitespace-nowrap"
                  data-action="remove-friend"
                  data-user-id="${friend.id}"
                  title="Remove Friend"
                >
                  <span class="hidden sm:inline">❌ Remove</span>
                  <span class="sm:hidden">❌</span>
                </button>
                <button
                  class="px-2 py-1.5 md:px-4 md:py-2 rounded-lg transition-colors border flex items-center gap-1 text-xs md:text-sm font-medium whitespace-nowrap ${
                    isBlocked
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30'
                  }"
                  data-action="${isBlocked ? 'unblock' : 'block'}-user"
                  data-user-id="${friend.id}"
                  title="${isBlocked ? 'Unblock' : 'Block'}"
                >
                  <span class="hidden sm:inline">${isBlocked ? '✓ Unblock' : '🚫 Block'}</span>
                  <span class="sm:hidden">${isBlocked ? '✓' : '🚫'}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

    // Attach event handlers
    container.querySelectorAll('[data-action="view-profile"]').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).dataset.userId || '0');
        this.showUserProfile(userId);
      });
    });

    container.querySelectorAll('[data-action="invite-game"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).closest('button')?.dataset.userId || '0');
        this.messageHandlers.get('gameInvite')?.(userId);
      });
    });

    container.querySelectorAll('[data-action="remove-friend"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).closest('button')?.dataset.userId || '0');
        this.messageHandlers.get('removeFriend')?.(userId);
      });
    });

    container.querySelectorAll('[data-action="block-user"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).closest('button')?.dataset.userId || '0');
        this.messageHandlers.get('blockUser')?.(userId);
      });
    });

    container.querySelectorAll('[data-action="unblock-user"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = parseInt((e.target as HTMLElement).closest('button')?.dataset.userId || '0');
        this.messageHandlers.get('unblockUser')?.(userId);
      });
    });
  }

  updateFriendStatus(userId: number, status: 'online' | 'offline'): void {
    console.log(`[FriendsUI] Updating friend ${userId} to ${status}`);
    const friend = this.allFriends.find(f => f.id === userId);
    if (friend) {
      console.log(`   → Found friend: ${friend.username}, updating status`);
      friend.status = status;
      this.filterFriendsList('');
    } else {
      console.warn(`   → Friend ${userId} not found in list`);
    }
  }

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

  showFriendRequestsModal(requests: FriendRequest[]): void {
    const existingModal = document.getElementById('friend-requests-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'friend-requests-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-emerald-400">📬 Friend Requests</h3>
          <button id="close-requests-modal" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <div class="space-y-3 max-h-96 overflow-y-auto">
          ${requests.length === 0 ? `
            <div class="text-center text-gray-400 py-8">
              <div class="text-5xl mb-3">📭</div>
              <p>No pending requests</p>
            </div>
          ` : requests.map(req => `
            <div class="bg-gray-700/50 rounded-lg p-4 flex items-center gap-3">
              <img
                class="w-12 h-12 rounded-full border-2 border-emerald-500 object-cover"
                src="${req.sender?.avatar || '/images/avatars/1.jpg'}"
                alt="${req.sender?.username}"
                onerror="this.src='/images/avatars/1.jpg'"
              >
              <div class="flex-1">
                <div class="text-white font-medium">${this.escapeHtml(req.sender?.username || 'Unknown')}</div>
                <div class="text-gray-400 text-sm">Wants to be friends</div>
              </div>
              <div class="flex gap-2">
                <button
                  class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
                  data-action="accept-request"
                  data-request-id="${req.id}"
                >
                  ✓ Accept
                </button>
                <button
                  class="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                  data-action="decline-request"
                  data-request-id="${req.id}"
                >
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

  showAddFriendModal(users: User[]): void {
    const existingModal = document.getElementById('add-friend-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'add-friend-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-emerald-400">➕ Add Friend</h3>
          <button id="close-add-friend-modal" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
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

      const filtered = users.filter(u =>
        u.username.toLowerCase().includes(query) && u.id !== this.currentUserId
      );
      this.renderAddFriendResults(filtered);
    });
  }

  private renderAddFriendResults(users: User[]): void {
    const container = document.getElementById('add-friend-results');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<div class="text-center text-gray-400 py-8">No users found</div>';
      return;
    }

    container.innerHTML = users.map(user => `
      <div class="bg-gray-700/50 rounded-lg p-3 flex items-center gap-3">
        <img
          class="w-10 h-10 rounded-full border-2 border-gray-600 object-cover"
          src="${user.avatar || '/images/avatars/1.jpg'}"
          alt="${user.username}"
          onerror="this.src='/images/avatars/1.jpg'"
        >
        <div class="flex-1">
          <div class="text-white font-medium">${this.escapeHtml(user.username)}</div>
        </div>
        <button
          class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
          data-action="send-request"
          data-username="${user.username}"
        >
          ➕ Add
        </button>
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
  }

  updateConnectionStatus(connected: boolean): void {
    const status = document.getElementById('connection-status');
    if (!status) return;

    if (connected) {
      status.classList.add('hidden');
    } else {
      status.classList.remove('hidden');
    }
  }

  showSuccess(message: string): void {
    this.showNotification(message, 'success');
  }

  showError(message: string): void {
    this.showNotification(message, 'error');
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    const existing = document.getElementById('friends-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'friends-notification';
    notification.className = `fixed top-24 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
      type === 'success'
        ? 'bg-emerald-500 text-white'
        : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
            <h3 class="text-2xl font-bold text-emerald-400">Friend Profile</h3>
            <button id="close-profile-modal" class="text-gray-400 hover:text-white text-2xl">×</button>
          </div>

          <div class="flex flex-col items-center mb-6">
            <img
              src="${profile.avatar || '/images/avatars/1.jpg'}"
              alt="${profile.username}"
              class="w-32 h-32 rounded-full border-4 border-emerald-500/50 mb-4 object-cover"
              onerror="this.src='/images/avatars/1.jpg'"
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
            <button id="profile-close-btn" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
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

    } catch (error) {
      console.error('Failed to load user profile:', error);
      this.showError('Failed to load profile');
    }
  }

  onGameInvite(handler: (userId: number) => void): void {
    this.messageHandlers.set('gameInvite', handler);
  }

  onRemoveFriend(handler: (userId: number) => void): void {
    this.messageHandlers.set('removeFriend', handler);
  }

  onBlockUser(handler: (userId: number) => void): void {
    this.messageHandlers.set('blockUser', handler);
  }

  onUnblockUser(handler: (userId: number) => void): void {
    this.messageHandlers.set('unblockUser', handler);
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

  destroy(): void {
    this.container.innerHTML = '';
    this.messageHandlers.clear();
  }
}
