// Socket.IO is loaded from CDN in index.html
declare const io: any;

import {game_start, listenForInputLocal} from "./game.js";
import "./game_soket.js"
import {initgameSocket, sendMessage, removeMessageListener, addMessageListener } from "./game_soket.js"
import {initchatSocket, onChatMessage} from "./chat_soket.js"
import {
  cleanupGame,
  addCleanupListener,
  setupNavigationHandlers,
  setupGameListeners,
  createLocalGameListener,
  createAIGameListener,
  createRemoteGameListener
} from "./game_shared.js";
import { ChatManager } from "./chat/index.js";
import { FriendsManager } from "./friends/index.js";
import { initAuth42, Auth42Handler, create42IntraButton } from './auth-42-intra.js';
import {
  createTournamentListener,
  cleanupTournamentMatch,
  setupTournamentGameListeners
} from "./game_tournament_handler.js"

import {
  initFriendInviteListener,
  cleanupFriendInviteListener,
  sendFriendInvite
} from "./friend_invite_handler.js";

console.log("start Pong game");

let gameid = "";
interface Page {
  title: string;
  content: string;
  init?(): void;
}

let ctx : CanvasRenderingContext2D | null = null;
let gameConfig : any;
let gameState: any;
let user_list: any;

interface User {
  username: string;
  passworde : string;
  email: string;
  avatar : string;
  usernametournament : string;
  id: number;
}

interface user_state {
  avgScore: string,
  losses: string,
  total: string,
  winRate: string,
  wins: string,
}

class AppRouter {
  private currentPage: string;
  private container: HTMLElement;
  private contentContainer: HTMLElement | null = null;
  private isLoggedIn: boolean = false;
  private currentUser: string | null = null;
  private postLoginRedirect: string | null = null;
  private user: User = {username:"", passworde:"",email:"", avatar:"../images/avatre/1jpg",usernametournament : "" ,id:0};
  private chatManager: ChatManager | null = null;
  private friendsManager: FriendsManager | null = null;
  private globalSocket: any = null;
  private allpages = [
    "/",
    "home",
    "login",
    "register",
    "dashboard",
    "dashboard/chat",
    "dashboard/friends",
    "dashboard/settings",
    "dashboard/game",
    "dashboard/game/ai",
    "dashboard/game/local",
    "dashboard/game/remote",
    "dashboard/game/tournament",
    "dashboard/game/tournament/lobby"
  ]
  private publicPages = ["/","home", "login", "register"];
  private protectedPages = [
    "/",
    "dashboard",
    "dashboard/chat",
    "dashboard/friends",
    "dashboard/settings",
    "dashboard/game",
    "dashboard/game/ai",
    "dashboard/game/local",
    "dashboard/game/remote",
    "dashboard/game/tournament",
    "dashboard/game/tournament/lobby"
  ];

constructor(containerId: string) {
  this.currentPage = "home";
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Container #${containerId} not found`);
  this.container = el;
  this.init();

  (async () => {
    try {
      // ✅ Handle 42 OAuth callback first
      const auth42Result = await initAuth42();
      if (auth42Result) {
        console.log('✅ 42 intra authentication successful!');
        console.log('   User:', auth42Result.user);

        // Set logged in state
        this.setLoggedIn(true);
        this.currentUser = auth42Result.user.username;
        this.user = {
          username: auth42Result.user.username,
          passworde: '',
          email: auth42Result.user.email,
          avatar: auth42Result.user.avatar,
          usernametournament: auth42Result.user.usernameTournament || auth42Result.user.username,
          id: auth42Result.user.id
        };
        
        // Initialize game socket
        initgameSocket();
        initFriendInviteListener((roomId) => {
          this.navigateTo(`/dashboard/game/friend/${roomId}`);
        });

        // Redirect to dashboard
        await this.navigateTo('/dashboard', true);
        return;
      }

      await this.checkAuth();
      if (this.isLoggedIn) {
        initFriendInviteListener((roomId) => {
          this.navigateTo(`/dashboard/game/friend/${roomId}`);
        });
      }
    } catch (e) {
      console.error('Auth initialization error:', e);
    }
    const initialPath = window.location.pathname || "/";
    await this.navigateTo(initialPath, false);
  })();
}

private async performLogin(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      alert(err.error || 'Login failed');
      return false;
    }

    const data = await res.json();

    if (data.token) {
      localStorage.setItem('jwt_token', data.token);
    }

    const usernameFromResp = data.user?.username || data.username ||
                             (typeof data.user === 'string' ? data.user : null);
    if (usernameFromResp) this.currentUser = usernameFromResp;

    this.setLoggedIn(true);
     initgameSocket();

    const respUser = data.user ?? data;
    if (respUser && typeof respUser === "object") {
      this.user = {
        username: (respUser.username ?? respUser.name ?? "") as string,
        passworde : "password",
        email: (respUser.email ?? "") as string,
        avatar: (respUser.avatar ?? "../images/avatre/1.jpg") as string,
        usernametournament : (respUser.usernametournament ?? name),
        id: Number(respUser.id ?? 0),
      };
      this.currentUser = (respUser.username ?? this.user.username) as string;

      if (this.user.avatar === "avatar/default_avatar/default_avatar.jpg") {
        this.user.avatar = "../images/avatrs/1.jpg";
      }

      localStorage.setItem('user_data', JSON.stringify(this.user));
    }

    console.log(`User avatar: ${this.user.avatar}`);
    console.log(`Is logged in: ${this.isLoggedIn}, user: ${this.currentUser}`);

    const redirect = this.postLoginRedirect || "/dashboard";
    this.postLoginRedirect = null;
    await this.navigateTo(redirect, true);
    return true;
  } catch (err) {
    console.error('performLogin error', err);
    alert('Login error');
    return false;
  }
}

private async fetchUserDetails(userId: number): Promise<void> {
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;

    const response = await fetch(`/api/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('Failed to fetch user details');
      return;
    }

    const userData = await response.json();

    if (userData) {
      this.user = {
        username: userData.username || this.currentUser || '',
        passworde : "",
        email: userData.email || '',
        avatar: userData.avatar || '../images/avatre/1.jpg',
        usernametournament : userData.usernametournament ?? name,
        id: userData.id || 0
      };

      if (this.user.avatar === 'avatar/default_avatar/default_avatar.jpg') {
        this.user.avatar = '../images/avatars/1.jpg';
      }

      console.log('User details fetched:', this.user);
    }
  } catch (error) {
    console.error('Error fetching user details:', error);
  }
}

private async checkAuth(): Promise<void> {
  try {
    const token = localStorage.getItem('jwt_token');

    if (!token) {
      this.setLoggedIn(false);
      return;
    }

    const payload = this.decodeJWT(token);

    if (!payload || this.isTokenExpired(payload)) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_data');
      this.setLoggedIn(false);
      return;
    }

    this.currentUser = payload.username || null;
    this.setLoggedIn(true);
    initgameSocket();

    const storedUserData = localStorage.getItem('user_data');
    if (storedUserData) {
      try {
        this.user = JSON.parse(storedUserData);
        console.log('Loaded user data from localStorage:', this.user);
      } catch (e) {
        console.warn('Failed to parse stored user data');
      }
    } else if (payload.userId) {
      await this.fetchUserDetails(payload.userId);
    }
  } catch (err) {
    console.warn('checkAuth failed', err);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    this.setLoggedIn(false);
  }
}

/**
 * Connect to global Socket.IO for real-time updates
 */
private async connectGlobalSocket(): Promise<void> {
  if (typeof io === 'undefined') {
    console.warn('Socket.IO library not loaded');
    return;
  }

  const token = localStorage.getItem('jwt_token');
  if (!token) {
    console.warn('No auth token available for socket connection');
    return;
  }

  try {
    const socketUrl = `${window.location.protocol}//${window.location.host}`;
    const socketOptions = {
      path: '/chat/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    };

    this.globalSocket = io(socketUrl, socketOptions);

    this.globalSocket.on('connect', () => {
      console.log('✅ Global Socket.IO connected');
    });

    this.globalSocket.on('disconnect', () => {
      console.log('❌ Global Socket.IO disconnected');
    });

    this.globalSocket.on('connect_error', (error: any) => {
      console.warn('⚠️ Global Socket.IO connection error:', error.message);
    });

    // Listen for friend status changes globally
    this.globalSocket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👥 [GLOBAL] Friend status changed:', data);
      
      // Update in chat manager if active
      if (this.chatManager) {
        console.log('   → Updating chat manager');
        this.chatManager.handleFriendStatusChange(data.userId, data.status);
      }
      
      // Update in friends manager if active
      if (this.friendsManager) {
        console.log('   → Updating friends manager');
        this.friendsManager.handleFriendStatusChange(data.userId, data.status);
      }
    });

    // Also listen for generic user-status-change event
    this.globalSocket.on('user-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      console.log('👤 [GLOBAL] User status changed:', data);
      
      // Update in chat manager if active
      if (this.chatManager) {
        this.chatManager.handleFriendStatusChange(data.userId, data.status);
      }
      
      // Update in friends manager if active
      if (this.friendsManager) {
        this.friendsManager.handleFriendStatusChange(data.userId, data.status);
      }
    });

    // Listen for other global events
    this.globalSocket.on('friend-request', (data: any) => {
      console.log('📬 Friend request received:', data);
      if (this.chatManager) this.chatManager.handleFriendRequest(data);
      if (this.friendsManager) this.friendsManager.handleFriendRequest(data);
    });

    this.globalSocket.on('friend-added', (data: any) => {
      console.log('✅ Friend added:', data);
      if (this.chatManager) this.chatManager.handleFriendAdded(data);
      if (this.friendsManager) this.friendsManager.handleFriendAdded(data);
    });

  } catch (error) {
    console.error('Failed to connect global socket:', error);
  }
}

/**
 * Disconnect global Socket.IO
 */
private disconnectGlobalSocket(): void {
  if (this.globalSocket) {
    this.globalSocket.disconnect();
    this.globalSocket = null;
    console.log('🔌 Global socket disconnected');
  }
}

public async performLogout(): Promise<void> {
  // Disconnect global socket first (will trigger offline status)
  this.disconnectGlobalSocket();
  
  // Cleanup managers
  if (this.chatManager) {
    this.chatManager.destroy();
    this.chatManager = null;
  }
  
  if (this.friendsManager) {
    this.friendsManager.destroy();
    this.friendsManager = null;
  }
  
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user_data');
  cleanupFriendInviteListener();
  console.log("logout");
  this.setLoggedIn(false);
  this.currentUser = null;
  this.user = {username:"",passworde: "",  email:"", avatar:"../images/avatars/1.jpg", usernametournament: "",id:0};
  this.navigateTo('home');
}

private decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}


private isTokenExpired(payload: any): boolean {
  if (!payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}


private async navigateTo(path: string, pushState: boolean = true): Promise<void> {
  let normalizedPath = path.replace(/^\/|\/$/g, "");
  console.log(this.isLoggedIn);
  if (normalizedPath === "") {
    if (!this.isLoggedIn) {
      console.warn(`⚠️ Not logged in, redirecting to home.`);
      this.currentPage = "home";
      this.loadPage("home");
      if (pushState) history.pushState(null, "", "/home");
      return;
    } else {
      console.warn(`⚠️ Logged in, redirecting to dashboard.`);
      this.currentPage = "dashboard";
      this.loadPage("dashboard");
      if (pushState) history.pushState(null, "", "/dashboard");
      return;
    }
  }

  if (!this.allpages.includes(`${normalizedPath}`)) {
    console.warn(`⚠️ Page not found: ${path}`);
    this.currentPage = "404";
    this.loadPage("404");
    return;
  }

  const isPublic = this.publicPages.includes(`/${normalizedPath}`);

  console.log(`page: ${normalizedPath} is logdin : ${this.isLoggedIn}`);

  if (this.protectedPages.includes(`${normalizedPath}`) && !this.isLoggedIn) {
    await this.checkAuth();
    if (!this.isLoggedIn) {
      this.postLoginRedirect = path;
      if (pushState) history.pushState(null, "", "/login");
      this.currentPage = "login";
      this.loadPage("login");
      return;
    }
  }
  if (this.publicPages.includes(`${normalizedPath}`) && this.isLoggedIn)
      normalizedPath = "dashboard";

  if (pushState) {
    history.pushState(null, "", `/${normalizedPath}`);
  }
  this.currentPage = normalizedPath;
  this.loadPage(normalizedPath);
}




  public setLoggedIn(value: boolean): void {
    this.isLoggedIn = value;
  }

  private init(): void {
    document.addEventListener("click", (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".nav-link") as HTMLElement | null;
      if (target) {
        e.preventDefault();
        const href = target.getAttribute("href");
        if (href) {
          (async () => {
            await this.navigateTo(href);
          })();
        }
      }
    });

    window.addEventListener("popstate", () => {
      const path = window.location.pathname || "/";
      (async () => await this.navigateTo(path, false))();
    });
  }

  private loadPage(page: string): void {
    const pageData = this.getPageData(page);
    const dashboardPages = [
      "dashboard",
      "dashboard/game",
      "dashboard/chat",
      "dashboard/friends",
      "dashboard/settings",
    ];

    const isDashboardPage = dashboardPages.includes(page);

    if (isDashboardPage && !this.contentContainer) {
      this.renderDashboardLayout();
    } else if (!isDashboardPage && this.contentContainer) {
      this.contentContainer = null;
      this.container.innerHTML = pageData.content;
    }

    if (this.contentContainer) {
      this.contentContainer.innerHTML = pageData.content;
    } else {
      this.container.innerHTML = pageData.content;
    }

    if (pageData.init) {
      pageData.init();
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.performLogout();
      });
    }

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('dashboard-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    // if (sidebarToggle && sidebar && overlay) {
    // const toggleSidebar = (): void => {
    //     const sidebar: HTMLElement | null = document.getElementById('dashboard-sidebar');
    //     const overlay: HTMLElement | null = document.getElementById('sidebar-overlay');
    //     const body: HTMLElement = document.body;

    //     if (sidebar) {
    //         sidebar.classList.toggle('open');
    //     }
    //     if (overlay) {
    //         overlay.classList.toggle('active');
    //     }
    //     body.classList.toggle('sidebar-open');
    // };

    // const toggleButton: HTMLElement | null = document.getElementById('sidebar-toggle');
    // const overlay: HTMLElement | null = document.getElementById('sidebar-overlay');

    // if (toggleButton) {
    //     toggleButton.addEventListener('click', toggleSidebar);
    // }

    // if (overlay) {
    //     overlay.addEventListener('click', toggleSidebar);
    // }

    // const navLinks: NodeListOf<Element> = document.querySelectorAll('.nav-link');
    // navLinks.forEach((link: Element) => {
    //     link.addEventListener('click', () => {
    //         if (window.innerWidth <= 1024) {
    //             toggleSidebar();
    //         }
    //     });
    // });
    // }

    console.log(`📄 Loaded page: ${page}`);
  }

private toggleSidebar(): void {
    const sidebar: HTMLElement | null = document.getElementById('dashboard-sidebar');
    const overlay: HTMLElement | null = document.getElementById('sidebar-overlay');
    const body: HTMLElement = document.body;

    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}


private renderDashboardLayout(): void {
  console.log(`user info:`, this.user);
  this.container.innerHTML = `
    <div class="dashboard-wrapper">

      <!-- Mobile Sidebar Toggle Button -->
      <button id="sidebar-toggle" class="sidebar-toggle lg:hidden">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <!-- Sidebar Overlay (Mobile) - Click to close -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- Sidebar Brand (Top Left) -->
      <div class="sidebar-brand">
        <img src="../images/logo.svg" alt="PONG Logo">
        <h2>PONG Game</h2>
      </div>

      <!-- User Avatar Section (Top Right) -->
      <div class="sidebar-username">
        <div class="user-avatar-container">
          <img class="user-avatar_D" src="${this.user.avatar}">
          <span class="header-username">${this.user.username || "Player"}</span>
        </div>
        <button id="logout-btn" class="logout-btn">🚪 Logout</button>
      </div>

      <!-- Sidebar (Collapsible on mobile) -->
      <aside class="sidebar-card" id="dashboard-sidebar">
        <nav class="sidebar-nav">
          <a href="/dashboard" class="nav-link nav-links" data-page="dashboard">
            <img src="../images/dashboard.svg" alt="Dashboard" width="24" height="24" style="margin-right: 8px;">
            Dashboard
          </a>
          <a href="/dashboard/game" class="nav-link nav-links" data-page="game">
            <img src="../images/game.svg" alt="Game" width="24" height="24" style="margin-right: 8px;">
            Game
          </a>
          <a href="/dashboard/chat" class="nav-link nav-links" data-page="chat">
            <img src="../images/chat.svg" alt="Chat" width="24" height="24" style="margin-right: 8px;">
            Chat
          </a>
          <a href="/dashboard/friends" class="nav-link nav-links" data-page="friends">
            <img src="../images/friends.svg" alt="Friends" width="24" height="24" style="margin-right: 8px;">
            Friends
          </a>
          <a href="/dashboard/settings" class="nav-link nav-links" data-page="settings">
            <img src="../images/settings.svg" alt="Settings" width="24" height="24" style="margin-right: 8px;">
            Settings
          </a>
        </nav>
      </aside>

      <!-- Main Content Area -->
      <main class="dashboard-content" id="dashboard-main-content">
        <div class="content-wrapper"></div>
      </main>

    </div>
  `;

  this.contentContainer = document.getElementById('dashboard-main-content');

  // Setup logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.performLogout();
    });
  }

  // Setup sidebar toggle
  const toggleButton = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  const navLinks = document.querySelectorAll('.nav-links');

  if (toggleButton && overlay) {
    // Toggle on button click
    toggleButton.addEventListener('click', () => this.toggleSidebar());

    // Close on overlay click
    overlay.addEventListener('click', () => this.toggleSidebar());

    // Close sidebar when clicking nav links on mobile
    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          this.toggleSidebar();
        }
      });
    });
  }

  console.log(`📄 Loaded dashboard layout`);
}

  private getPageData(page: string): Page {
    console.log(`page is ${page}`);
    switch (page) {
      case "home":
        return this.getHomePage();
      case "dashboard/game":
        return this.getGamePage();
      case "login":
        return this.getLoginPage();
      case "register":
        return this.getRegisterPage();
      case "dashboard":
        return this.getDashboardPage();
      case "dashboard/settings":
        return this.getSettingsPage();
      case "dashboard/chat":
        return this.getChatPage();
      case "dashboard/friends":
        return this.getFriendsPage();
      case "dashboard/game/ai":
        return this.getaipage();
      case "dashboard/game/local":
        return this.getlocalpage();
      case "dashboard/game/tournament":
        return this.gettournamentpage();
      case "dashboard/game/remote":
        return this.getremotepage();
      case "dashboard/game/tournament/lobby":
        return this.getTournamentLobbyPage();
      default:
        return this.get404Page();
    }
  }




private getHomePage(): Page {
  return {
    title: "PONG Game - Home",
    content: `
<nav class="pong-navbar">
  <div class="navbar-container">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="nav-Links nav-link pong-logo">
        <img src="./images/logo.svg" alt="Pong Logo">
        <span class="logo-text">PONG Game</span>
      </div>
      <div class="nav-link">
        <a href="/login" class="login-btn nav-link">
          <img src="./images/login.svg" alt="Login Icon">
          <span class="login-text">Login</span>
        </a>
        <a href="/register" class="reg-btn nav-link">
          <span class="login-text">Register</span>
        </a>
      </div>
    </div>
  </div>
</nav>

      <section class="home-dashboard">
        <div class="intro-section">
          <h1 class="home-title">Welcome to <span class="highlight">PONG Game</span></h1>
          <p class="home-subtitle">
            The ultimate real-time pong experience. Connect, play, and compete worldwide.
          </p>
          <div class="home-buttons">
            <a href="/register" class="btn-primary nav-link">Get Started</a>
            <a href="/login" class="btn-secondary nav-link">Login</a>
          </div>
        </div>
        <div class="cards-grid">
          <div class="feature-card">
            <img src="./images/online-svg.svg" alt="Online Play" class="card-icon" />
            <h3>Play Online</h3>
            <p>Challenge friends or random opponents in real-time Pong matches.</p>
          </div>
          <div class="feature-card">
            <img src="./images/leader-borde.svg" alt="Trophy" class="card-icon" />
            <h3>Leaderboards</h3>
            <p>Track your rank and compete to reach the top players.</p>
          </div>
          <div class="feature-card">
            <img src="./images/chat.svg" alt="Chat & Social" class="card-icon" />
            <h3>Chat & Social</h3>
            <p>Connect with players worldwide through real-time chat and messaging.</p>
          </div>
        </div>
      </section>
    `,
    init: () => console.log("🏠 Home page loaded"),
    };
  }

private getTournamentLobbyPage(): Page {
    return {
      title: "Tournament Lobby",
      content: `
        <div class="lobby-page">
          <!-- Background -->
          <div class="lobby-bg-blobs">
            <div class="absolute top-[10%] left-[10%] w-96 h-96 bg-emerald-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float1"></div>
            <div class="absolute bottom-[20%] right-[10%] w-80 h-80 bg-purple-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float2"></div>
            <div class="absolute top-[40%] right-[30%] w-72 h-72 bg-cyan-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-float3"></div>
          </div>

          <div class="lobby-container" id="lobby-container">
            <!-- Header -->
            <div class="lobby-header">
              <button id="leave-tournament-btn" class="back-button group">
                <span class="group-hover:-translate-x-1 transition-transform">←</span>
                <span>Leave Lobby</span>
              </button>
              <div class="flex items-center gap-3">
                <span class="text-3xl">🏆</span>
                <h2 class="text-2xl font-bold text-gradient">Tournament Lobby</h2>
              </div>
              <div class="w-[100px] hidden sm:block"></div>
            </div>

            <div class="lobby-layout">
              <!-- LEFT SIDEBAR -->
              <div class="lobby-sidebar">
                <div class="flex items-center justify-between mb-4 border-b border-white/10 pb-4 shrink-0">
                  <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                    👥 <span class="text-gray-200">Players List</span>
                  </h3>
                  <div id="lobby-status" class="lobby-status-badge">Loading...</div>
                </div>
                <div id="bracket-container" class="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar"></div>
              </div>

              <!-- RIGHT MAIN AREA -->
              <div class="lobby-main">

                <!-- 1. WAITING SCREEN -->
                <div id="lobby-waiting-screen" class="lobby-waiting-screen">
                  <div class="relative mb-8">
                    <div class="absolute inset-0 bg-emerald-500/30 rounded-full animate-ping"></div>
                    <div class="lobby-waiting-icon"><span class="text-6xl">⏳</span></div>
                  </div>
                  <h2 class="text-3xl font-bold text-white mb-2">Waiting for Players</h2>
                  <div class="flex items-center gap-3 mb-6">
                    <div class="h-px w-12 bg-gradient-to-r from-transparent to-gray-500"></div>
                    <p id="player-count-display" class="text-2xl font-mono font-bold text-emerald-400">0 / 4 Joined</p>
                    <div class="h-px w-12 bg-gradient-to-l from-transparent to-gray-500"></div>
                  </div>
                  <div class="lobby-info-card">
                    <div class="flex items-start gap-4">
                      <span class="text-2xl">ℹ️</span>
                      <div class="text-left">
                        <h4 class="text-white font-semibold mb-1">Tournament Rules</h4>
                        <p class="text-gray-400 text-sm leading-relaxed">The tournament will automatically start once <strong class="text-emerald-400">4 players</strong> have joined the lobby.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 2. BRACKET VIEW -->
                <div id="view-bracket" class="fullscreen-layer" style="display: none;">
                   <h1 id="bracket-round-title" class="round-title">SEMI-FINALS</h1>
                   <div id="big-bracket-content" class="big-bracket-container"></div>
                   <div class="mt-12 text-gray-400 animate-pulse">
                      Next match starting in <span id="timer-count" class="text-white font-bold">8</span>s...
                   </div>
                </div>

                <!-- 3. GAME VIEW -->
                <div id="view-game" class="fixed inset-0 z-50 bg-gray-900" style="display: none;">

                   <!-- Game Header (Fixed Top-2) -->
                   <div class="absolute top-2 w-full p-4 flex justify-between items-center z-20 pointer-events-none">
                      <div class="text-white font-bold text-xl" id="game-round-label">MATCH</div>
                      <div class="bg-gray-800/80 px-6 py-2 rounded-full border border-white/10 shadow-lg">
                         <span id="tournament-score" class="text-2xl font-mono text-emerald-400 font-bold">0 - 0</span>
                      </div>
                      <div class="w-[100px]"></div>
                   </div>

                   <!-- Ready Overlay -->
                   <div id="ready-overlay" class="ready-overlay flex flex-col gap-8 bg-black/80">
                      <div id="game-match-info" class="flex items-center gap-16 mb-6 scale-110"></div>
                      <button id="game-ready-btn" class="ready-btn-large">I AM READY! ⚔️</button>
                   </div>

                   <!-- Strict Ratio Container (Scaled Down to 700px) -->
                   <div class="game-stage-wrapper">
                      <div class="maintain-aspect-ratio-9-6 max-w-[700px]"> <!-- ✅ Resized here -->

                          <!-- Left Player Info -->
                          <div class="player-info-float left">
                              <img id="game-p1-avatar" src="" class="w-20 h-20 rounded-full border-4 border-gray-600 shadow-lg object-cover">
                              <span id="game-p1-name" class="mt-2 font-bold text-white bg-black/50 px-3 rounded text-center">P1</span>
                          </div>

                          <!-- CANVAS -->
                          <div id="game-container" class="w-full h-full"></div>

                          <!-- Right Player Info -->
                          <div class="player-info-float right">
                              <img id="game-p2-avatar" class="w-20 h-20 rounded-full border-4 border-gray-600 shadow-lg object-cover">
                              <span id="game-p2-name" class="mt-2 font-bold text-white bg-black/50 px-3 rounded text-center">P2</span>
                          </div>

                      </div>
                   </div>

                </div>

              </div>
            </div>
          </div>
        </div>
      `,
      init: () => {
        console.log("🏟️ Tournament Lobby Initialized");
        const tId = localStorage.getItem('activeTournamentId');
        if(!tId) { this.navigateTo("dashboard/game/tournament"); return; }

        cleanupTournamentMatch();
        const popstateHandler = () => {
          cleanupTournamentMatch();
          localStorage.removeItem('activeTournamentId');
          this.navigateTo("dashboard/game/tournament");          
        };
        window.addEventListener("popstate", popstateHandler);

        const playerCountEl = document.getElementById("player-count-display")!;
        const leaveBtn = document.getElementById("leave-tournament-btn")!;
        const bracketEl = document.getElementById("bracket-container")!;

        const resolveUser = async (pid: string | number) => {
            const pidStr = String(pid);
            if (pidStr === String(this.user.id)) {
                return { username: `${this.user.username} (You)`, avatar: this.user.avatar || '../images/avatars/1.jpg' };
            }
            try {
                const res = await fetch(`/api/user/${pidStr}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }});
                if(res.ok) {
                    const d = await res.json();
                    return { username: d.username, avatar: d.avatar || '../images/avatars/unknown.jpg' };
                }
            } catch {}
            return { username: `Player ${pidStr.substring(0,4)}`, avatar: '../images/avatars/unknown.jpg' };
        };

        const updateLobbySidebar = async (playerIds: any[]) => {
            if (!bracketEl) return;
            const promises = playerIds.map(id => resolveUser(id));
            const players = await Promise.all(promises);

            bracketEl.innerHTML = players.map(p => `
                <div class="bg-gray-800/50 p-2 rounded-lg flex items-center gap-3 border border-white/5">
                    <img src="${p.avatar}" class="w-8 h-8 rounded-full border border-emerald-500/30 object-cover">
                    <span class="text-gray-200 text-sm font-medium truncate">${p.username}</span>
                </div>
            `).join('');

            const slotsLeft = 4 - players.length;
            if (slotsLeft > 0) {
                const emptySlots = Array(slotsLeft).fill(0).map(() => `
                    <div class="bg-gray-800/20 p-2 rounded-lg flex items-center gap-3 border border-white/5 border-dashed opacity-50">
                        <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">?</div>
                        <span class="text-gray-500 text-sm italic">Waiting...</span>
                    </div>
                `).join('');
                bracketEl.innerHTML += emptySlots;
            }
        };

        const refreshLobbyData = async () => {
             try {
               const res = await fetch(`/tournaments/tournaments/${tId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}` }});
               if(res.ok) {
                   const d = await res.json();
                   const pList = d.players || [];
                   if (playerCountEl) playerCountEl.innerText = `${pList.length} / 4 Joined`;
                   updateLobbySidebar(pList);
               } else {
                   alert("Tournament expired.");
                   this.navigateTo("dashboard/game/tournament");
               }
            } catch {}
        };

        const handleLeave = async () => {
            if(!confirm("Leave tournament?")) return;
            localStorage.removeItem('activeTournamentId');
            try { await fetch('/tournaments/tournaments/leave', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ tournamentId: tId }) }); } catch {}
            this.navigateTo("dashboard/game/tournament");
        };
        leaveBtn.onclick = handleLeave;

        const tournamentBrain = createTournamentListener(this.user.id, tId, (path) => this.loadPage(path));

        const mainListener = (msg: any) => {
           tournamentBrain(msg);
           if (msg.type === "tournament_player-joined" || msg.type === "tournament_player-left") {
               if (msg.payload.tournamentId === tId) {
                   refreshLobbyData();
               }
           }
        };

        setupTournamentGameListeners(mainListener);
        refreshLobbyData();
      }
    };
  }


  private gettournamentpage(): Page {
    return {
      title: "PONG Game - Tournament",
      content: `
        <div class="tournament-container" style="margin-top:5rem;">
          <div class="game-header">
            <a href="/dashboard/game" id="back-button-tournament" class="back-button nav-link">← Back</a>
            <h2 style="display:inline-block; margin-left:1rem;">🏆 Tournament Mode</h2>
          </div>

          <div style="margin-top:2rem; display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
            <!-- LEFT SIDE: Create -->
            <div style="background:#1f2937; border-radius:0.75rem; padding:2rem;">
              <h3 style="color:#fbbf24; font-size:1.3rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;">➕ Create New Tournament</h3>
              <div>
                <label style="display:block; color:#e5e7eb; margin-bottom:0.5rem; font-weight:600;">Tournament Name</label>
                <input id="tournament-title-input" type="text" placeholder="Enter tournament name..." maxlength="50" style="width:100%; padding:0.75rem; border-radius:0.5rem; border:2px solid #3b82f6; background:#111827; color:#e5e7eb; font-size:1rem; margin-bottom:1.5rem;" />
                <button id="create-tournament-btn" class="btn-primary" style="width:100%; padding:1rem; font-size:1.1rem;">🏆 Create Tournament</button>
                <p style="margin-top:1rem; color:#9ca3af; font-size:0.875rem; text-align:center;">You'll be the first player automatically</p>
              </div>
            </div>

            <!-- RIGHT SIDE: List -->
            <div style="background:#1f2937; border-radius:0.75rem; padding:2rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <h3 style="color:#10b981; font-size:1.3rem; margin:0;">🎮 Available Tournaments</h3>
                <button id="refresh-tournaments-btn" style="padding:0.5rem 1rem; background:#3b82f6; color:white; border:none; border-radius:0.5rem; cursor:pointer; font-size:0.9rem;">🔄 Refresh</button>
              </div>

              <div id="tournaments-list" style="max-height:400px; overflow-y:auto;">
                <div id="tournaments-loading" style="text-align:center; padding:2rem; color:#9ca3af;">
                  <div style="font-size:2rem; margin-bottom:0.5rem;">⏳</div>Loading tournaments...
                </div>
                <div id="tournaments-empty" style="display:none; text-align:center; padding:2rem; color:#9ca3af;">
                  <div style="font-size:2rem; margin-bottom:0.5rem;">🏜️</div>No tournaments available<br><span style="font-size:0.875rem;">Create one to get started!</span>
                </div>
                <div id="tournaments-container"></div>
              </div>
            </div>
          </div>
        </div>

        <style>
          #tournaments-list::-webkit-scrollbar { width: 8px; }
          #tournaments-list::-webkit-scrollbar-track { background: #111827; border-radius: 4px; }
          #tournaments-list::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 4px; }
          #tournaments-list::-webkit-scrollbar-thumb:hover { background: #2563eb; }
        </style>
      `,
      init: () => {
        console.log("🏆 Tournament Selection page loaded");
        cleanupGame(this.user.id, false);
        setupNavigationHandlers(this.user.id, "back-button-tournament", (path) => this.loadPage(path));

        const titleInput = document.getElementById("tournament-title-input") as HTMLInputElement;
        const createBtn = document.getElementById("create-tournament-btn") as HTMLButtonElement;
        const refreshBtn = document.getElementById("refresh-tournaments-btn") as HTMLButtonElement;
        const listContainer = document.getElementById("tournaments-container")!;
        const loadingState = document.getElementById("tournaments-loading")!;
        const emptyState = document.getElementById("tournaments-empty")!;

        const fetchTournaments = async () => {
          try {
            loadingState.style.display = "block"; emptyState.style.display = "none"; listContainer.innerHTML = "";
            const res = await fetch('/tournaments/tournaments', { method: 'GET', headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`, 'Content-Type': 'application/json' }});
            if (!res.ok) throw new Error("Failed");
            const tournaments = await res.json();
            loadingState.style.display = "none";

            if (tournaments.length === 0) { emptyState.style.display = "block"; return; }

            tournaments.forEach((t: any) => {
              const card = document.createElement("div");
              card.style.cssText = `background: #374151; margin-bottom: 1rem; padding: 1rem; border-radius: 0.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid #4b5563; transition: transform 0.2s;`;
              card.onmouseover = () => card.style.transform = "translateX(5px)";
              card.onmouseout = () => card.style.transform = "translateX(0)";

              let count = 0;
              if (t.numPlayers !== undefined) count = t.numPlayers;
              else if (Array.isArray(t.players)) count = t.players.length;

              card.innerHTML = `
                <div>
                  <div style="color: #e5e7eb; font-weight: bold; font-size: 1.1rem;">${t.title}</div>
                  <div style="color: #9ca3af; font-size: 0.9rem;">Players: <span style="color: #10b981;">${count}/4</span></div>
                </div>
              `;

              const joinBtn = document.createElement("button");
              joinBtn.innerText = count >= 4 ? "Full ⛔" : "Join ➡️";
              joinBtn.style.cssText = `background: ${count >= 4 ? '#ef4444' : '#10b981'}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; ${count >= 4 ? 'opacity:0.5;cursor:not-allowed;' : ''}`;

              if (count < 4) {
                joinBtn.onclick = async () => {
                  try {
                    const joinRes = await fetch('/tournaments/tournaments/join', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ tournamentId: t.id || t.tournamentId }) });
                    if (joinRes.ok) {
                      localStorage.setItem('activeTournamentId', t.id || t.tournamentId);
                      this.navigateTo("dashboard/game/tournament/lobby");
                    } else { alert("Failed to join."); fetchTournaments(); }
                  } catch {}
                };
              }
              card.appendChild(joinBtn);
              listContainer.appendChild(card);
            });
          } catch { loadingState.innerHTML = `<span style="color:#ef4444">Failed to load.</span>`; }
        };

        const createTournament = async () => {
          const title = titleInput.value.trim();
          if (!title) { alert("Enter name"); return; }
          createBtn.disabled = true; createBtn.innerText = "Creating...";
          try {
            const res = await fetch('/tournaments/tournaments/create', { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
            if (res.ok) {
              const data = await res.json();
              localStorage.setItem('activeTournamentId', data.tournamentId || data.id);
              this.navigateTo("dashboard/game/tournament/lobby");
            } else { alert("Failed"); createBtn.disabled = false; createBtn.innerText = "🏆 Create Tournament"; }
          } catch { createBtn.disabled = false; createBtn.innerText = "🏆 Create Tournament"; }
        };

        const listListener = (msg: any) => {
          if (["tournament_created", "tournament_deleted", "tournament_player-joined"].includes(msg.type)) fetchTournaments();
        };

        addMessageListener(listListener);
        addCleanupListener(() => removeMessageListener(listListener));
        createBtn.addEventListener("click", createTournament);
        addCleanupListener(() => createBtn.removeEventListener("click", createTournament));
        refreshBtn.addEventListener("click", fetchTournaments);
        addCleanupListener(() => refreshBtn.removeEventListener("click", fetchTournaments));

        fetchTournaments();
      }
    };
  }

private getGamePage(): Page {
  return {
    title: "PONG Game - Select Mode",
    content: `
      <section class="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12 bg-gray-900 rounded-2xl shadow-lg max-w-5xl mx-auto" style="margin-top: 5rem;">
        <h1 class="text-3xl md:text-4xl font-bold text-greenLight mb-10 text-center">
          🏓 Choose Your Game Mode
        </h1>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
          <!-- AI Game -->
          <div class="mode-card group">
            <img src="./images/ai-game.svg" alt="AI Game" class="mode-icon" />
            <h3 class="mode-title">Play vs AI</h3>
            <p class="mode-desc">Challenge a smart AI opponent — great for quick solo fun.</p>
            <a href="dashboard/game/ai" class="mode-btn nav-link">Play</a>
          </div>

          <!-- Local Game -->
          <div class="mode-card group">
            <img src="./images/local.svg" alt="Local Game" class="mode-icon" />
            <h3 class="mode-title">Local Game</h3>
            <p class="mode-desc">Two players on the same computer — perfect for friendly duels.</p>
            <a href="dashboard/game/local" class="mode-btn nav-link">Play</a>
          </div>

          <!-- Remote Game -->
          <div class="mode-card group">
            <img src="./images/remote-game.svg" alt="Online Game" class="mode-icon" />
            <h3 class="mode-title">Online Match</h3>
            <p class="mode-desc">Compete with friends or random players around the world.</p>
            <a href="dashboard/game/remote" class="mode-btn nav-link">Play</a>
          </div>

          <!-- Tournament -->
          <div class="mode-card group">
            <img src="./images/tournament.svg" alt="Tournament" class="mode-icon" />
            <h3 class="mode-title">Tournament</h3>
            <p class="mode-desc">Join tournaments and climb the ranks to prove your skill.</p>
            <a href="dashboard/game/tournament" class="mode-btn nav-link">Play</a>
          </div>
        </div>
      </section>
    `,
    init: () => console.log("🎮 Game mode selection loaded"),
  };
}

private getremotepage(): Page {
  return {
    title: "PONG Game - Online Match",
    content: `
      <div class="local-game-container" style="margin-top:5rem;">
        <div class="game-header">
          <a href="/dashboard/game" id="back-button-remote" class="back-button nav-link">← Back</a>
          <h2 style="display:inline-block; margin-left:1rem;">Online Match</h2>
        </div>

        <div class="local-players" style="display:flex; align-items:flex-start; gap:2rem; margin-top:2rem;">
          <!-- Player 1 (You) -->
          <div style="text-align:center; width:180px;">
            <img id="r-palyer" src="${this.user.avatar || '../images/avatars/1.jpg'}" alt="Player" style="width:120px;height:120px;border-radius:50%;border:4px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.3);" onerror="this.src='../images/avatars/1.jpg'">
            <div id="r-name" style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">${this.currentUser || 'Player'}</div>
            <div style="font-size:0.875rem; color:#10b981; margin-top:0.25rem;">● Online</div>
          </div>

          <!-- Game Area -->
          <div style="flex:1;">
            <!-- ✅ Score at TOP -->
            <div style="display:flex; justify-content:center; margin-bottom:1rem; color:#e5e7eb; font-size:1.2rem; font-weight:600;">
              <div>Score: <span id="remote-score" style="color:#fbbf24;">0 - 0</span></div>
            </div>

            <!-- Canvas -->
            <div id="game-container"></div>

            <!-- Button at BOTTOM -->
            <div style="text-align:center; margin-top:1.5rem;">
              <button id="start-remote-game" class="btn-primary" style="padding:1rem 2.5rem; font-size:1.1rem; min-width:250px;">
                🌐 Find Opponent
              </button>
              <div style="margin-top:1rem; color:#9ca3af; font-size:0.95rem;">
                Controls: <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;font-weight:600;">W</kbd> / <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;font-weight:600;">S</kbd>
              </div>
            </div>
          </div>

          <!-- Player 2 (Opponent) -->
          <div style="text-align:center; width:180px;">
            <img id="opponent-avatar" src="../images/avatars/1.jpg" alt="Opponent" style="width:120px;height:120px;border-radius:50%;border:4px solid #6b7280;opacity:0.5;box-shadow:0 4px 12px rgba(107,114,128,0.3);" onerror="this.src='../images/avatars/2.jpg'">
            <div id="opponent-name" style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#9ca3af;">Waiting...</div>
            <div id="serch"style="font-size:0.875rem; color:#6b7280; margin-top:0.25rem;">Searching...</div>
          </div>
        </div>

        <!-- Matchmaking Status -->
        <div id="matchmaking-status" style="display:none; margin-top:2rem; text-align:center; padding:1.5rem; background:#1f2937; border-radius:0.75rem; animation:pulse 2s infinite;">
          <div style="font-size:1.3rem; color:#10b981; margin-bottom:0.5rem; font-weight:600;">
            🔍 Searching for opponent...
          </div>
          <div style="color:#9ca3af; font-size:1rem;">
            This may take a few moments
          </div>
        </div>
      </div>

      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        kbd {
          font-family: monospace;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      </style>
    `,
    init: () => {
      console.log("🌐 Remote game page loaded");
      cleanupGame(this.user.id, false);
      setupNavigationHandlers(
        this.user.id,
        "back-button-remote",
        (path: string) => this.loadPage(path)
      );

      const startButton = document.getElementById('start-remote-game') as HTMLButtonElement;
      const matchmakingStatus = document.getElementById('matchmaking-status');

      if (startButton) {
        const startHandler = () => {
          startButton.innerText = '🔍 Searching...';
          startButton.disabled = true;

          if (matchmakingStatus) {
            matchmakingStatus.style.display = 'block';
          }

          sendMessage("join_random", {});
        };
        startButton.addEventListener('click', startHandler);
        addCleanupListener(() => startButton.removeEventListener('click', startHandler));
      }

      const remoteListener = createRemoteGameListener(this.user.id);
      setupGameListeners(
        remoteListener,
        'remote-score',
        this.user.id,
        (path: string) => this.loadPage(path),
        false,
        true
      );
    }
  };
}

private getlocalpage(): Page {
  return {
    title: "PONG Game - Local Match",
    content: `
      <div class="local-game-container" style="margin-top:5rem;">
        <div class="game-header">
          <a href="dashboard/game" id="back-button" class="back-button nav-link">← Back</a>
          <h2 style="display:inline-block; margin-left:1rem;">Local Match (2 Players)</h2>
        </div>

        <div class="local-players" style="display:flex; align-items:flex-start; gap:2rem; margin-top:2rem;">
          <!-- Player 1 -->
          <div style="text-align:center; width:180px;">
            <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow:0 4px 12px rgba(59,130,246,0.4);">
              <div style="font-size:3rem; font-weight:700; color:white;">1</div>
            </div>
            <div style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">Player 1</div>
            <div style="font-size:0.875rem; color:#3b82f6; margin-top:0.25rem; font-weight:600;">
              <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;margin:0 2px;">W</kbd>
              <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;margin:0 2px;">S</kbd>
            </div>
          </div>

          <!-- Game Area -->
          <div style="flex:1;">
            <!-- ✅ Score at TOP -->
            <div style="display:flex; justify-content:center; margin-bottom:1rem; color:#e5e7eb; font-size:1.2rem; font-weight:600;">
              <div>Score: <span id="local-score" style="color:#fbbf24;">0 - 0</span></div>
            </div>

            <!-- Canvas -->
            <div id="game-container"></div>

            <!-- Button at BOTTOM -->
            <div style="text-align:center; margin-top:1.5rem;">
              <button id="start-local-game" class="btn-primary" style="padding:1rem 2.5rem; font-size:1.1rem; min-width:250px;">
                ▶️ Start Game
              </button>
              <div style="margin-top:1rem; color:#9ca3af; font-size:0.95rem;">
                Local multiplayer on same device
              </div>
            </div>
          </div>

          <!-- Player 2 -->
          <div style="text-align:center; width:180px;">
            <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);display:flex;align-items:center;justify-content:center;margin:0 auto;box-shadow:0 4px 12px rgba(239,68,68,0.4);">
              <div style="font-size:3rem; font-weight:700; color:white;">2</div>
            </div>
            <div style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">Player 2</div>
            <div style="font-size:0.875rem; color:#ef4444; margin-top:0.25rem; font-weight:600;">
              <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;margin:0 2px;">↑</kbd>
              <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;margin:0 2px;">↓</kbd>
            </div>
          </div>
        </div>
      </div>

      <style>
        kbd {
          font-family: monospace;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      </style>
    `,
    init: () => {
      console.log("🎮 Local page loaded");
      cleanupGame(this.user.id, false);

      setupNavigationHandlers(
        this.user.id,
        "back-button",
        (path: string) => this.loadPage(path)
      );

      const startButton = document.getElementById('start-local-game');
      if (startButton) {
        const startHandler = () => {
          sendMessage("join_local", {});
        };
        startButton.addEventListener('click', startHandler);
        addCleanupListener(() => startButton.removeEventListener('click', startHandler));
      }

      const localListener = createLocalGameListener(this.user.id);
      setupGameListeners(
        localListener,
        'local-score',
        this.user.id,
        (path: string) => this.loadPage(path),
        false,
        false
      );
    }
  };
}

private getaipage(): Page {
  return {
    title: "PONG Game - AI Match",
    content: `
      <div class="local-game-container" style="margin-top:5rem;">
        <div class="game-header">
          <a href="/dashboard/game" id="back-button-ai" class="back-button nav-link">← Back</a>
          <h2 style="display:inline-block; margin-left:1rem;">Play vs AI</h2>
        </div>

        <div class="local-players" style="display:flex; align-items:flex-start; gap:2rem; margin-top:2rem;">
          <!-- Player -->
          <div style="text-align:center; width:180px;">
            <img src="${this.user.avatar || '../images/avatars/1.jpg'}" alt="Player" style="width:120px;height:120px;border-radius:50%;border:4px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.3);" onerror="this.src='../images/avatars/1.jpg'">
            <div style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">${this.currentUser || 'Player'}</div>
            <div style="font-size:0.875rem; color:#10b981; margin-top:0.25rem;">● Ready</div>
          </div>

          <!-- Game Area -->
          <div style="flex:1;">
            <div style="margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between; padding:1rem; background:#1f2937; border-radius:0.5rem;" id="ai_butin">
              <div>
                <label for="ai-difficulty" style="color:#9ca3af; margin-right:0.75rem; font-weight:600;">Difficulty:</label>
                <select id="ai-difficulty" style="padding:0.5rem 1rem; border-radius:6px; color:#111827; font-weight:600; border:2px solid #3b82f6; cursor:pointer;">
                  <option value="easy">🟢 Easy</option>
                  <option value="medium" selected>🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>
              <div style="color:#9ca3af; font-size:0.9rem;">
                Controls: <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;font-weight:600;">W</kbd> / <kbd style="background:#374151;padding:0.25rem 0.5rem;border-radius:4px;font-weight:600;">S</kbd>
              </div>
            </div>

            <!-- ✅ Score at TOP -->
            <div style="display:flex; justify-content:center; margin-bottom:1rem; color:#e5e7eb; font-size:1.2rem; font-weight:600;">
              <div>Score: <span id="ai-score" style="color:#fbbf24;">0 - 0</span></div>
            </div>

            <!-- Canvas -->
            <div id="game-container"></div>

            <!-- Button at BOTTOM -->
            <div style="text-align:center; margin-top:1.5rem;">
              <button id="start-ai-game" class="btn-primary" style="padding:1rem 2.5rem; font-size:1.1rem; min-width:250px;">
                🤖 Start vs AI
              </button>
            </div>
          </div>

          <!-- AI Opponent -->
          <div style="text-align:center; width:180px;">
            <div style="width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);display:flex;align-items:center;justify-content:center;font-size:3.5rem;margin:0 auto;box-shadow:0 4px 12px rgba(139,92,246,0.4);animation:ai-pulse 2s infinite;">
              🤖
            </div>
            <div style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">AI Opponent</div>
            <div style="font-size:0.875rem; color:#8b5cf6; margin-top:0.25rem;">Adaptive AI</div>
          </div>
        </div>
      </div>

      <style>
        @keyframes ai-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        kbd {
          font-family: monospace;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
      </style>
    `,
    init: () => {
      console.log("🤖 AI Game page loaded");
      cleanupGame(this.user.id, false);

      setupNavigationHandlers(
        this.user.id,
        "back-button-ai",
        (path: string) => this.loadPage(path)
      );

      const startButton = document.getElementById('start-ai-game') as HTMLButtonElement;
      const difficultySelect = document.getElementById('ai-difficulty') as HTMLSelectElement;

      if (startButton) {
        const startHandler = () => {
          const difficulty = difficultySelect?.value || 'medium';
          startButton.innerText = '🔍 Finding AI...';
          startButton.disabled = true;
          sendMessage("join_ai-opponent", { difficulty });
        };
        startButton.addEventListener('click', startHandler);
        addCleanupListener(() => startButton.removeEventListener('click', startHandler));
      }

      const aiListener = createAIGameListener(this.user.id);
      setupGameListeners(
        aiListener,
        'ai-score',
        this.user.id,
        (path: string) => this.loadPage(path),
        true,
        false
      );
    }
  };
}

  private getLoginPage(): Page {
    return {
      title: "PONG Game - Login",
      content: `
<nav class="pong-navbar">
  <div class="navbar-container">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="nav-Links pong-logo">
        <img src="./images/logo.svg" alt="Pong Logo">
        <span class="logo-text">PONG Game</span>
      </div>

      <!-- Navigation Links -->
      <div class="nav-link pong-logo">
        <a href="/register" class="login-btn nav-link">
          <span class="login-text">Register</span>
        </a>
      </div>
    </div>
  </div>
</nav>

<section class="login-section">
  <div class="login-card">
    <h1>Welcome Back</h1>
    <p>Sign in to your account</p>

    <form id="login-form" class="input-form">
      <input type="text" id="username" placeholder="Username" class="input-field" />
      <input type="password" id="password" placeholder="Password" class="input-field" />
      <button type="submit" class="submit-btn">Sign In</button>
    </form>

    <div class="mt-4 nav-link">
      <p>Don’t have an account?</p>
      <a href="/register" class="link-btn nav-link">Create One</a>
    </div>

    <a href="/" class="back-btn nav-link">← Back to Home</a>
  </div>
</section>

      `,
      init: () => {
        console.log("🔑 Login page loaded");
        const form = document.getElementById("login-form");
        if (form) {
          form.addEventListener("submit", (e) => {
            e.preventDefault();
            const username = (document.getElementById("username") as HTMLInputElement).value;
            const password = (document.getElementById("password") as HTMLInputElement).value;
            (async () => {
              await this.performLogin(username, password);
            })();
          });
        }

        // ✅ Add 42 intra button
        const loginCard = document.querySelector('.login-card');
        if (loginCard) {
          // Find the form and insert after it
          const form = document.getElementById('login-form');
          if (form) {
            // Create container for 42 button
            const container = document.createElement('div');
            container.id = 'login-42-container';

            // Add divider
            const divider = document.createElement('div');
            divider.style.cssText = 'margin: 1.5rem 0; text-align: center; color: #9ca3af; font-size: 0.9rem;';
            divider.innerHTML = '— or —';
            container.appendChild(divider);

            // Insert after form
            form.parentNode?.insertBefore(container, form.nextSibling);

            // Add 42 intra button
            create42IntraButton(container, {
              text: '🎓 Sign in with 42 intra',
              onClick: () => {
                console.log('🚀 Starting 42 intra OAuth login...');
                Auth42Handler.initiateLogin('/dashboard');
              }
            });
          }
        }
      },
    };
  }

  private getRegisterPage(): Page {
    return {
      title: "PONG Game - Register",
      content: `
<nav class="pong-navbar">
  <div class="navbar-container">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="nav-Links nav-link pong-logo">
        <img src="./images/logo.svg" alt="Pong Logo">
        <span class="logo-text">PONG Game</span>
      </div>

      <!-- Navigation Links -->
      <div class="nav-link">
        <a href="/login" class="login-btn nav-link">
          <img src="./images/login.svg" alt="Login Icon">
          <span class="login-text">Login</span>
        </a>
      </div>
    </div>
  </div>
</nav>

<section class="register-section">
  <div class="register-card">
    <h1>Create Account</h1>
    <form id="register-form" class="input-form">
      <input type="text" id="new-username" placeholder="Username" required class="input-field">
      <input type="email" id="email" placeholder="Email" required class="input-field">
      <input type="password" id="new-password" placeholder="Password" required class="input-field">
      <input type="text" id="usernameTournament" placeholder="Tournament Username (optional)" class="input-field">

      <!-- Avatar Upload (Optional) -->
      <div style="margin: 1rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; color: #6b7280; font-size: 0.9rem;">
          Profile Picture (optional)
        </label>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img id="avatar-preview" src="/avatar/default_avatar/default_avatar.jpg"
               style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb;">
          <label for="avatar-upload" style="cursor: pointer; padding: 0.5rem 1rem; background: #3b82f6; color: white; border-radius: 0.375rem; font-size: 0.875rem; transition: background 0.2s;">
            Choose Image
          </label>
          <input type="file" id="avatar-upload" accept="image/*" style="display: none;">
          <button type="button" id="remove-avatar" style="display: none; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer;">
            Remove
          </button>
        </div>
        <p style="margin-top: 0.5rem; font-size: 0.75rem; color: #9ca3af;">
          Upload a profile picture or use the default avatar
        </p>
      </div>

      <button type="submit" class="submit-btn">Register</button>
    </form>

    <!-- 42 Intra Button will be inserted here by JavaScript -->
    <div id="register-42-container"></div>

    <p>
      Already have an account?
      <a href="/login" class="nav-link">Sign In</a>
    </p>
    <a href="/" class="back-btn nav-link">← Back to Home</a>
    </div>

</section>

      `,
      init: () => {
        console.log("📝 Register page loaded");

        // Handle avatar upload and preview
        let selectedAvatarFile: File | null = null;
        const avatarUpload = document.getElementById('avatar-upload') as HTMLInputElement;
        const avatarPreview = document.getElementById('avatar-preview') as HTMLImageElement;
        const removeAvatarBtn = document.getElementById('remove-avatar') as HTMLButtonElement;

        if (avatarUpload && avatarPreview && removeAvatarBtn) {
          avatarUpload.addEventListener('change', (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              // Validate file type
              if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
              }
              // Validate file size (max 5MB)
              if (file.size > 5 * 1024 * 1024) {
                alert('Image size must be less than 5MB');
                return;
              }

              selectedAvatarFile = file;

              // Show preview
              const reader = new FileReader();
              reader.onload = (e) => {
                avatarPreview.src = e.target?.result as string;
                removeAvatarBtn.style.display = 'block';
              };
              reader.readAsDataURL(file);
            }
          });

          removeAvatarBtn.addEventListener('click', () => {
            selectedAvatarFile = null;
            avatarPreview.src = '/avatar/default_avatar/default_avatar.jpg';
            avatarUpload.value = '';
            removeAvatarBtn.style.display = 'none';
          });
        }

        const form = document.getElementById('register-form');
        if (form) {
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = (document.getElementById('new-username') as HTMLInputElement).value;
            const email = (document.getElementById('email') as HTMLInputElement).value;
            const password = (document.getElementById('new-password') as HTMLInputElement).value;
            const usernameTournament = (document.getElementById('usernameTournament') as HTMLInputElement).value;
            try {
              let avatarPath = null;

              // Upload avatar first if selected
              if (selectedAvatarFile) {
                const formData = new FormData();
                formData.append('file', selectedAvatarFile);

                const uploadRes = await fetch('/api/upload-avatar', {
                  method: 'POST',
                  body: formData
                });

                if (uploadRes.ok) {
                  const uploadData = await uploadRes.json();
                  avatarPath = uploadData.avatar;
                  console.log('✅ Avatar uploaded:', avatarPath);
                } else {
                  const err = await uploadRes.json();
                  console.warn('Avatar upload failed:', err);
                  alert('Avatar upload failed. Using default avatar.');
                }
              }

              // Register user with avatar path
              const res = await fetch("/api/register", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username,
                  email,
                  password,
                  usernameTournament: usernameTournament || username,
                  avatar: avatarPath
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Register failed' }));
                alert(err.error || 'Register failed');
                return;
              }
              await this.performLogin(username, password);
            } catch (err) {
              console.error(err);
              alert('Registration error');
            }
          });
        }

        // ✅ Add 42 intra button
        const container = document.getElementById('register-42-container');
        if (container) {
          // Add divider
          const divider = document.createElement('div');
          divider.style.cssText = 'margin: 1.5rem 0; text-align: center; color: #9ca3af; font-size: 0.9rem;';
          divider.innerHTML = '— or —';
          container.appendChild(divider);

          // Add 42 intra button
          create42IntraButton(container, {
            text: '🎓 Register with 42 intra',
            onClick: () => {
              console.log('🚀 Starting 42 intra OAuth registration...');
              Auth42Handler.initiateLogin('/dashboard');
            }
          });
        }
      },
    };
  }

  private get404Page(): Page {
    return {
      title: "404 - Page Not Found",
      content: `
        <section class="max-w-lg mx-auto px-6 py-20 text-center">
          <h1 class="text-4xl font-bold text-red-600 mb-6">404</h1>
          <p class="text-gray-600 mb-6">Oops! The page you are looking for does not exist.</p>
          <a href="/home" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold nav-link">Go Home</a>
        </section>
      `,
    };
  }

private async updateUserProfile(updates: User): Promise<boolean> {
  const u = updates as any;
  if ((!u.id || u.id === 0) && this.user && this.user.id) {
    u.id = this.user.id;
  }

  const existingToken = localStorage.getItem('jwt_token');
  const usernameForLogin = (u.name || u.username || this.currentUser || this.user.username) as string | undefined;
  const passwordForLogin = (this.user && this.user.passworde) ? this.user.passworde : undefined;

  if (!existingToken && usernameForLogin && passwordForLogin) {
    console.log('No JWT found — attempting to re-login to obtain a fresh token');
    try {
      await this.performLogin(usernameForLogin, passwordForLogin);
    } catch (err) {
      console.warn('Re-login attempt failed', err);
    }
  }
  try {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      alert('Please log in first');
      return false;
    }

    const response = await fetch('/api/user/update', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Update failed' }));
      alert(error.error || 'Failed to update profile');
      return false;
    }

    const data = await response.json();

    console.log("try to JWT updated")
    if (data.token) {
      localStorage.setItem('jwt_token', data.token);
    }
    if (data.user) {
      localStorage.setItem('user_data', JSON.stringify(data.user));

      this.user = data.user;
      console.log(`updated user: `, this.user);
      this.currentUser = data.user.username;

      alert('Profile updated successfully!');
    }


    await this.navigateTo(this.currentPage, false);
    return true;
  } catch (error) {
    console.error('Update profile error:', error);
    alert('An error occurred while updating profile');
    return false;
  }
}


private getSettingsPage(): Page {
  return {
    title: "PONG Game - Settings",
    content: `
      <div class="content-card" style="margin-top: 5rem;">
        <h2>⚙️ Settings</h2>
        <form id="settings-form" style="margin-top: 1.5rem;">
            <!-- Username -->
          <div style="margin-bottom: 1.5rem;">
            <label for="settings-username" style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Username
              </label>
              <input
                type="text"
                id="settings-username"
                value="${this.user.username || ''}"
                placeholder="Enter username"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; color: #111827;"
              />
            </div>

            <!-- Email -->
          <div style="margin-bottom: 1.5rem;">
            <label for="settings-email" style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
              Email
              </label>
              <input
                type="email"
                id="settings-email"
                value="${this.user.email || ''}"
                placeholder="player@example.com"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; color: #111827;"
              />
            </div>

            <!-- Tournament Username (Optional) -->
          <div style="margin-bottom: 1.5rem;">
            <label for="settings-tournament" style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
                Tournament Username (Optional)
              </label>
              <input
                type="text"
                id="settings-tournament"
                placeholder="Tournament display name"
              style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; color: #111827;"
              />
            </div>

          <!-- Avatar URL (Optional) -->
<div style="margin-bottom: 1.5rem;">
  <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">
    Change Your Avatar
              </label>
  <!-- Current Avatar Display -->
  <div style="margin-bottom: 1rem;">
    <small style="color: #6b7280; font-size: 0.875rem; display: block; margin-bottom: 0.5rem;">
      Current Avatar:
    </small>
    <img id="settings-current-avatar"
         src="${this.user.avatar || '/avatar/default_avatar/default_avatar.jpg'}"
         alt="Current Avatar"
         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #e5e7eb;">
  </div>

  <!-- Upload Custom Avatar -->
  <div style="margin-bottom: 1.5rem;">
    <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem; font-size: 0.9rem;">
      📤 Upload Custom Avatar
    </label>

    <div id="settings-avatar-preview-container" style="display: none; margin-bottom: 1rem;">
      <img id="settings-avatar-preview" src="" alt="Avatar preview"
           style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #10b981;">
      <div style="margin-top: 0.5rem;">
        <small style="color: #059669; font-weight: 600;">✓ New avatar selected</small>
      </div>
    </div>

    <input type="file" id="settings-avatar-file" accept="image/*" style="display: none;">

    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
      <button
        type="button"
        id="settings-choose-avatar-btn"
        style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer; transition: background 0.3s;"
        onmouseover="this.style.background='#2563eb'"
        onmouseout="this.style.background='#3b82f6'"
      >
        📁 Choose Image
      </button>
      <button
        type="button"
        id="settings-remove-avatar-btn"
        style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 0.375rem; font-size: 0.875rem; cursor: pointer; transition: background 0.3s; display: none;"
        onmouseover="this.style.background='#dc2626'"
        onmouseout="this.style.background='#ef4444'"
      >
        ❌ Remove
      </button>
    </div>
    <small style="color: #6b7280; font-size: 0.75rem; display: block; margin-top: 0.5rem;">
      Accepted formats: JPEG, PNG, GIF, WebP. Max size: 5MB
    </small>
  </div>

  <!-- OR divider -->
  <div style="text-align: center; margin: 1.5rem 0; color: #9ca3af; font-weight: 600; font-size: 0.875rem;">
    — OR —
  </div>

  <!-- Predefined Avatars -->
  <div style="margin-bottom: 1rem;">
    <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem; font-size: 0.9rem;">
      🎨 Choose Predefined Avatar
    </label>
    <div id="avatar-options">
      <img src="../images/avatars/1.jpg" alt="Avatar 1" class="avatar-option" data-value="../images/avatars/1.jpg">
      <img src="../images/avatars/2.jpg" alt="Avatar 2" class="avatar-option" data-value="../images/avatars/2.jpg">
      <img src="../images/avatars/3.jpg" alt="Avatar 3" class="avatar-option" data-value="../images/avatars/3.jpg">
      <img src="../images/avatars/4.jpg" alt="Avatar 4" class="avatar-option" data-value="../images/avatars/4.jpg">
    </div>
  </div>

  <!-- Hidden field to send selected avatar path -->
  <input type="hidden" id="settings-avatar" name="avatar" value="${this.user.avatar || ''}" />
</div>

          <!-- Save Button -->
          <button
            type="submit"
            style="padding: 0.75rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: background 0.3s;"
            onmouseover="this.style.background='#059669'"
            onmouseout="this.style.background='#10b981'"
          >
            💾 Save Changes
          </button>

          <!-- Status Message -->
          <div id="settings-status" style="margin-top: 1rem; padding: 0.75rem; border-radius: 0.5rem; display: none;"></div>
          </form>
        </div>
    `,
init: () => {
  console.log("⚙️ Settings page loaded");

  const form = document.getElementById('settings-form') as HTMLFormElement;
  const statusDiv = document.getElementById('settings-status') as HTMLDivElement;
  const avatarOptions = document.querySelectorAll<HTMLImageElement>(".avatar-option");
  const avatarInput = document.getElementById("settings-avatar") as HTMLInputElement;
  const profileAvatar = document.querySelector('.user-avatar') as HTMLImageElement; // main avatar in UI
  // --- Custom Avatar Upload Elements ---
  const fileInput = document.getElementById('settings-avatar-file') as HTMLInputElement;
  const chooseBtn = document.getElementById('settings-choose-avatar-btn') as HTMLButtonElement;
  const removeBtn = document.getElementById('settings-remove-avatar-btn') as HTMLButtonElement;
  const previewContainer = document.getElementById('settings-avatar-preview-container') as HTMLDivElement;
  const previewImg = document.getElementById('settings-avatar-preview') as HTMLImageElement;
  const currentAvatarImg = document.getElementById('settings-current-avatar') as HTMLImageElement;

  let uploadedAvatarPath: string | null = null;

  // --- Custom Avatar Upload Logic ---
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];

      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('❌ Invalid file type. Please upload JPEG, PNG, GIF, or WebP image.');
        fileInput.value = '';
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ File too large. Maximum size is 5MB.');
        fileInput.value = '';
        return;
      }

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          previewImg.src = e.target.result as string;
          previewContainer.style.display = 'block';
          removeBtn.style.display = 'inline-block';
        }
      };
      reader.readAsDataURL(file);

      // Upload file to server
      const formData = new FormData();
      formData.append('avatar', file);

      try {
        const token = localStorage.getItem('jwt_token');
        const response = await fetch('/api/upload-avatar', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();
        uploadedAvatarPath = data.avatar;
        console.log('✅ Avatar uploaded:', uploadedAvatarPath);

        // Clear predefined avatar selection
        avatarOptions.forEach(o => o.classList.remove("selected"));

      } catch (error) {
        console.error('❌ Avatar upload error:', error);
        alert('Failed to upload avatar. Please try again.');
        fileInput.value = '';
        previewContainer.style.display = 'none';
        removeBtn.style.display = 'none';
      }
    });

    // Remove uploaded avatar
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        fileInput.value = '';
        previewContainer.style.display = 'none';
        removeBtn.style.display = 'none';
        uploadedAvatarPath = null;
        console.log('🗑️ Uploaded avatar removed');
      });
    }
  }

  // --- Avatar selection logic (predefined avatars) ---
  if (avatarOptions && avatarInput) {
    avatarOptions.forEach(option => {
      option.addEventListener("click", () => {
        // Remove selection from others
        avatarOptions.forEach(o => o.classList.remove("selected"));
        // Mark clicked one as selected
        option.classList.add("selected");
        // Update hidden input value
        avatarInput.value = option.dataset.value || "";
        // Clear uploaded avatar if predefined is selected
        if (uploadedAvatarPath) {
          uploadedAvatarPath = null;
          fileInput.value = '';
          previewContainer.style.display = 'none';
          removeBtn.style.display = 'none';
        }
        // Optionally update live avatar preview
        if (profileAvatar) profileAvatar.src = avatarInput.value;
      });
    });

    const currentAvatar = avatarInput.value;
    avatarOptions.forEach(o => {
      if (o.dataset.value === currentAvatar) o.classList.add("selected");
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = (document.getElementById('settings-username') as HTMLInputElement).value.trim();
      const email = (document.getElementById('settings-email') as HTMLInputElement).value.trim();
      const tournament = (document.getElementById('settings-tournament') as HTMLInputElement).value.trim();

      // Determine avatar: prioritize uploaded avatar, then predefined selection
      let finalAvatar = '';
      if (uploadedAvatarPath) {
        finalAvatar = uploadedAvatarPath;
      } else if (avatarInput?.value.trim()) {
        finalAvatar = avatarInput.value.trim();
      }

      // Build update object (only include changed fields)
      const updates: any = {};
      if (username && username !== this.currentUser) updates.username = username;
      if (email && email !== this.user.email) updates.email = email;
      if (tournament) updates.usernameTournament = tournament;
      if (finalAvatar && finalAvatar !== this.user.avatar) updates.avatar = finalAvatar;

      if (Object.keys(updates).length === 0) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fef3c7';
        statusDiv.style.color = '#92400e';
        statusDiv.textContent = '⚠️ No changes detected';
        return;
      }
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#dbeafe';
      statusDiv.style.color = '#1e40af';
      statusDiv.textContent = '⏳ Updating profile...';


      const success = await this.updateUserProfile(updates);

      if (success) {
        if (updates.username) this.currentUser = updates.username;
        if (updates.email) this.user.email = updates.email;
        if (updates.usernameTournament) this.user.usernametournament = updates.usernameTournament;
        if (updates.avatar) {
          this.user.avatar = updates.avatar;
          if (profileAvatar) profileAvatar.src = updates.avatar; // update avatar in UI
          if (currentAvatarImg) currentAvatarImg.src = updates.avatar; // update current avatar display
        }

        // Clear uploaded avatar state
        uploadedAvatarPath = null;
        fileInput.value = '';
        previewContainer.style.display = 'none';
        removeBtn.style.display = 'none';

        statusDiv.style.background = '#d1fae5';
        statusDiv.style.color = '#065f46';
        statusDiv.textContent = '✅ Profile updated successfully!';
      } else {
        statusDiv.style.background = '#fee2e2';
        statusDiv.style.color = '#991b1b';
        statusDiv.textContent = '❌ Failed to update profile. Please try again.';
      }
    });
  }
}

  };
}



  private getDashboardPage(): Page {
    return {
      title: "PONG Game - Dashboard",
      content: `
               <div class="content-card">
          <h2>Welcome back, ${this.user.username || 'Player'}! 👋</h2>
          <p>Ready to play some Pong? Check out your stats below.</p>
        </div>

        <!-- The Stat Cards now flow horizontally in a grid -->
        <div class="stats-grid">

          <!-- Stat Card 1 -->
          <div class="stat-card">
            <h3>Games Played</h3>
            <div class="stat-value" id="total">Loading...</div>
          </div>

          <!-- Stat Card 2 -->
          <div class="stat-card">
            <h3>Wins</h3>
            <div class="stat-value" id="wins">Loading...</div>
          </div>

          <!-- Stat Card 3 -->
          <div class="stat-card">
            <h3>Losses</h3>
            <div class="stat-value" id="losses">Loading...</div>
          </div>

           <!-- Stat Card 4 -->
           <div class="stat-card">
            <h3>Average Score</h3>
            <div class="stat-value" id="avgScore">Loading...</div>
          </div>

          <!-- Stat Card 5 (The Graph Card) -->
          <!-- This card takes 2 columns on mobile (col-span-2) but only 1 on larger screens (md:col-span-1) -->
          <div class="stat-card col-span-2 md:col-span-1">
            <h3>Win Rate Visual</h3>
            <div id="winRateGraph" class="mt-4 flex justify-center">
              <!-- SVG will be injected here by TypeScript -->
            </div>
            <div class="text-center mt-2 text-xl font-bold" id="winRateText">Loading...</div>
          </div>

        </div>
      `,
      init: () => {
        console.log("📊 Dashboard page loaded");
        this.fetchAndDisplayStats();
      },
    };
}

private async fetchAndDisplayStats() {
    try {
        const res = await fetch(`/tournaments/matches/user/${this.user.id}/stats`);
        if (!res.ok) {
            console.error("Failed to get user state:", res.statusText);
            return;
        }
        const data = await res.json();
        console.log("User stats fetched:", data);

        // 1. Update text stats (your existing logic)
        (document.getElementById("avgScore") as HTMLElement).innerHTML = String(data.avgScore || 'N/A');
        (document.getElementById("losses") as HTMLElement).innerHTML = String(data.losses || 'N/A');
        (document.getElementById("total") as HTMLElement).innerHTML = String(data.total || 'N/A');
        (document.getElementById("wins") as HTMLElement).innerHTML = String(data.wins || 'N/A');

        // 2. Generate and display the visual graph
        const winRateGraphContainer = document.getElementById("winRateGraph");
        const winRateText = document.getElementById("winRateText");

        if (winRateGraphContainer && winRateText) {
            const winPercentage = parseFloat(data.winRate) || 0; // Assuming winRate is a percentage string like "68%"

            // Clean up the input (if "68%", convert to 68)
            const numericRate = data.winRate.includes('%') ? parseFloat(data.winRate) : data.winRate;

            winRateText.innerHTML = `${numericRate}% Win Rate`;

            // Create and append the SVG element
            const svgGraph = this.createCircleGraph(numericRate);
            winRateGraphContainer.appendChild(svgGraph);
        }

    } catch (e) {
        console.error("Error fetching stats:", e);
    }
}

/**
 * Creates an SVG circular progress bar element dynamically using TypeScript.
 * @param percentage The percentage value (0-100) to display.
 * @returns The SVG element.
 */
private createCircleGraph(percentage: number): SVGElement {
    const size = 120;
    const strokeWidth = 10;
    const radius = (size / 2) - (strokeWidth / 2);
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    // Create the main SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    // Optional: Add Tailwind classes for rotation to start from the top
    svg.classList.add("transform", "-rotate-90");

    // Create the background circle
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("cx", String(size / 2));
    bgCircle.setAttribute("cy", String(size / 2));
    bgCircle.setAttribute("r", String(radius));
    bgCircle.setAttribute("fill", "none");
    bgCircle.setAttribute("stroke", "#e5e7eb"); // Tailwind gray-200
    bgCircle.setAttribute("stroke-width", String(strokeWidth));

    // Create the progress circle
    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("cx", String(size / 2));
    progressCircle.setAttribute("cy", String(size / 2));
    progressCircle.setAttribute("r", String(radius));
    progressCircle.setAttribute("fill", "none");
    progressCircle.setAttribute("stroke", "#10b981"); // Tailwind emerald-500
    progressCircle.setAttribute("stroke-width", String(strokeWidth));
    progressCircle.setAttribute("stroke-dasharray", String(circumference));
    progressCircle.setAttribute("stroke-dashoffset", String(offset));
    progressCircle.setAttribute("stroke-linecap", "round");
    // Optional: Add a subtle transition effect using Tailwind's arbitrary properties (if configured)
    // progressCircle.style.transition = 'stroke-dashoffset 0.5s ease-in-out';

    // Append circles to the SVG
    svg.appendChild(bgCircle);
    svg.appendChild(progressCircle);

    return svg;
}


private getChatPage(): Page {
  return {
    title: "PONG Game - Chat",
    content: `<div id="chat-app-container"></div>`,
    init: () => {
      console.log("💬 Chat page loaded");

      // Cleanup previous chat instance if exists
      if (this.chatManager) {
        this.chatManager.destroy();
        this.chatManager = null;
      }

      // Initialize new chat manager
      this.chatManager = new ChatManager('chat-app-container');
      this.chatManager.init({
        id: this.user.id,
        username: this.user.username,
        email: this.user.email,
        avatar: this.user.avatar
      }).catch(err => {
        console.error('Failed to initialize chat:', err);
      });
    }
  };
}


private getFriendsPage(): Page {
  return {
    title: "PONG Game - Friends",
    content: `
      <div id="friends-app-container"></div>
    `,
    init: async () => {
      console.log("👥 Friends page loaded");
      
      // Cleanup previous instance
      if (this.friendsManager) {
        this.friendsManager.destroy();
        this.friendsManager = null;
      }

      // Initialize Friends Manager
      this.friendsManager = new FriendsManager('friends-app-container');
      this.friendsManager.init({
        id: this.user.id,
        username: this.user.username,
        email: this.user.email,
        avatar: this.user.avatar
      }).catch(error => {
        console.error('Failed to initialize friends:', error);
      });
    },
  };
}



}

// ==========================
// Initialize App
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  new AppRouter("app-container");
});
