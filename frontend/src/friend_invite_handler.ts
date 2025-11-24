// friend_invite_handler.ts
import { addMessageListener, removeMessageListener, sendMessage } from "./game_soket.js";

interface FriendInvite {
  type: "friend_invite";
  from: string;
  roomId: string;
  fromUsername?: string;
  fromAvatar?: string;
}

let inviteListener: ((msg: any) => void) | null = null;
let activeInviteModal: HTMLDivElement | null = null;

/**
 * Fetch user details for the invite
 */
async function fetchInviterDetails(userId: string): Promise<{ username: string; avatar: string }> {
  try {
    const token = localStorage.getItem('jwt_token');
    const res = await fetch(`/api/auth/user/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      return {
        username: data.username || `Player ${userId.substring(0, 4)}`,
        avatar: data.avatar || '../images/avatars/unknown.jpg'
      };
    }
  } catch (error) {
    console.error('Failed to fetch inviter details:', error);
  }

  return {
    username: `Player ${userId.substring(0, 4)}`,
    avatar: '../images/avatars/unknown.jpg'
  };
}

/**
 * Create and show the invite modal
 */
function showInviteModal(invite: FriendInvite, username: string, avatar: string, onAccept: () => void, onDecline: () => void) {
  // Remove existing modal if any
  if (activeInviteModal) {
    activeInviteModal.remove();
  }

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'friend-invite-modal';
  modal.innerHTML = `
    <div class="friend-invite-overlay"></div>
    <div class="friend-invite-content">
      <!-- Close Button -->
      <button class="friend-invite-close" id="invite-close-btn">✕</button>

      <!-- Header -->
      <div class="friend-invite-header">
        <span class="text-3xl">🎮</span>
        <h2 class="friend-invite-title">Game Invitation</h2>
      </div>

      <!-- Inviter Info -->
      <div class="friend-invite-body">
        <img src="${avatar}" alt="${username}" class="friend-invite-avatar">
        <div class="friend-invite-message">
          <span class="friend-invite-username">${username}</span>
          <span class="friend-invite-text">wants to play with you!</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="friend-invite-actions">
        <button class="friend-invite-btn friend-invite-decline" id="invite-decline-btn">
          ❌ Decline
        </button>
        <button class="friend-invite-btn friend-invite-accept" id="invite-accept-btn">
          ✅ Accept
        </button>
      </div>

      <!-- Auto-decline timer -->
      <div class="friend-invite-timer">
        Auto-declining in <span id="invite-countdown">30</span>s...
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  activeInviteModal = modal;

  // Setup button handlers
  const acceptBtn = modal.querySelector('#invite-accept-btn') as HTMLButtonElement;
  const declineBtn = modal.querySelector('#invite-decline-btn') as HTMLButtonElement;
  const closeBtn = modal.querySelector('#invite-close-btn') as HTMLButtonElement;

  const cleanup = () => {
    modal.remove();
    activeInviteModal = null;
    clearInterval(countdownInterval);
  };

  acceptBtn.onclick = () => {
    cleanup();
    onAccept();
  };

  declineBtn.onclick = () => {
    cleanup();
    onDecline();
  };

  closeBtn.onclick = () => {
    cleanup();
    onDecline();
  };

  // Click outside to close
  const overlay = modal.querySelector('.friend-invite-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => {
      cleanup();
      onDecline();
    });
  }

  // Auto-decline countdown
  let countdown = 30;
  const countdownEl = modal.querySelector('#invite-countdown');
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdownEl) countdownEl.textContent = String(countdown);

    if (countdown <= 0) {
      cleanup();
      onDecline();
    }
  }, 1000);
}

/**
 * Initialize the friend invite listener
 */
export function initFriendInviteListener(navigateToGame?: (roomId: string) => void) {
  // Remove existing listener if any
  if (inviteListener) {
    removeMessageListener(inviteListener);
  }

  inviteListener = async (msg: any) => {
    if (msg.type === "friend_invite") {
      console.log("📨 Received friend invite:", msg);

      const invite: FriendInvite = msg;

      // Fetch inviter details
      const { username, avatar } = await fetchInviterDetails(invite.from);

      // Show invite modal
      showInviteModal(
        invite,
        username,
        avatar,
        // On Accept
        () => {
          console.log("✅ Accepted invite to room:", invite.roomId);

          // Send acceptance to server
          sendMessage("accept_invite", {
            roomId: invite.roomId,
            from: invite.from
          });

          // Navigate to game if callback provided
          if (navigateToGame) {
            navigateToGame(invite.roomId);
          }
        },
        // On Decline
        () => {
          console.log("❌ Declined invite from:", invite.from);

          // Send decline to server
          sendMessage("decline_invite", {
            roomId: invite.roomId,
            from: invite.from
          });
        }
      );
    }
  };

  addMessageListener(inviteListener);
  console.log("👂 Friend invite listener initialized");
}

/**
 * Cleanup function
 */
export function cleanupFriendInviteListener() {
  if (inviteListener) {
    removeMessageListener(inviteListener);
    inviteListener = null;
  }

  if (activeInviteModal) {
    activeInviteModal.remove();
    activeInviteModal = null;
  }

  console.log("🧹 Friend invite listener cleaned up");
}

/**
 * Send a friend invite
 */
export function sendFriendInvite(friendUserId: string) {
  sendMessage("send_invite", { to: friendUserId });
  console.log("📤 Sent invite to:", friendUserId);
}