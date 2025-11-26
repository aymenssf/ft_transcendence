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
  createRemoteGameListener,
  handleGameConfig,
  fetchUserDetails
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
  private friend: User = {username:"", passworde:"",email:"", avatar:"../images/avatre/1jpg",usernametournament : "" ,id:0};
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
    "dashboard/game/tournament/lobby",
    "dashboard/game/friend_game"
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
    "dashboard/game/tournament/lobby",
    "dashboard/game/friend_game"
  ];

constructor(containerId: string) {
  this.currentPage = "home";
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Container #${containerId} not found`);
  this.container = el;
  this.init();

  (async () => {
    try {
      const auth42Result = await initAuth42();
      if (auth42Result) {
        console.log('✅ 42 intra authentication successful!');
        console.log('   User:', auth42Result.user);

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

        initgameSocket();
        initFriendInviteListener((roomId) => {
          this.navigateTo(`/dashboard/game/friend/${roomId}`);
        });

        await this.connectGlobalSocket();

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

    await this.connectGlobalSocket();

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

    await this.connectGlobalSocket();
  } catch (err) {
    console.warn('checkAuth failed', err);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_data');
    this.setLoggedIn(false);
  }
}

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
      console.log('Global Socket.IO connected');
    });

    this.globalSocket.on('disconnect', () => {
      console.log('Global Socket.IO disconnected');
    });

    this.globalSocket.on('connect_error', (error: any) => {
      console.warn('Global Socket.IO connection error:', error.message);
    });

    this.globalSocket.on('friend-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      if (this.chatManager) {
        this.chatManager.handleFriendStatusChange(data.userId, data.status);
      }

      if (this.friendsManager) {
        this.friendsManager.handleFriendStatusChange(data.userId, data.status);
      }
    });

    this.globalSocket.on('user-status-change', (data: { userId: number; status: 'online' | 'offline' }) => {
      if (this.chatManager) {
        this.chatManager.handleFriendStatusChange(data.userId, data.status);
      }

      if (this.friendsManager) {
        this.friendsManager.handleFriendStatusChange(data.userId, data.status);
      }
    });

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

    this.globalSocket.on('game-invitation', (data: any) => {
      if (data.targetUserId && data.targetUserId !== this.user?.id) {
        return;
      }

      const currentPage = window.location.pathname;

      if (currentPage.includes('/friends') && this.friendsManager) {
        this.friendsManager.handleGameInvitation(data);
      } else if (currentPage.includes('/chat') && this.chatManager) {
        this.chatManager.handleGameInvitation(data);
      } else if (this.friendsManager) {
        this.friendsManager.handleGameInvitation(data);
      } else if (this.chatManager) {
        this.chatManager.handleGameInvitation(data);
      }
    });

    this.globalSocket.on('game-invite-accepted', (data: any) => {
      if (data.senderId && data.senderId !== this.user?.id) {
        return;
      }

      if (data.gameRoomId) {
        if (this.friendsManager) {
          this.friendsManager.handleGameInviteAccepted(data);
        } else if (this.chatManager) {
          this.chatManager.handleGameInviteAccepted(data);
        } else {
          alert('Your game invitation was accepted! Redirecting to game...');
          setTimeout(() => {
            window.location.href = `/dashboard/game/remote?room=${data.gameRoomId}`;
          }, 500);
        }
      }
    });

    this.globalSocket.on('game-invite-declined', (data: any) => {
      if (data.senderId && data.senderId !== this.user?.id) {
        return;
      }

      alert('Your game invitation was declined');
    });

  } catch (error) {
    console.error('Failed to connect global socket:', error);
  }
}


private disconnectGlobalSocket(): void {
  if (this.globalSocket) {
    this.globalSocket.disconnect();
    this.globalSocket = null;
    console.log('🔌 Global socket disconnected');
  }
}

public async performLogout(): Promise<void> {
  this.disconnectGlobalSocket();

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

    if (isDashboardPage) {
      this.updateActiveNavLink();
    }

    console.log(`📄 Loaded page: ${page}`);
  }

  private updateActiveNavLink(): void {
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
      link.classList.remove('active');
    });

    const currentPath = `/${this.currentPage}`;
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath) {
        link.classList.add('active');
      }
    });
  }


private toggleSidebar(): void {
  const sidebar = document.getElementById('dashboard-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar) {
    sidebar.classList.toggle('open');
  }

  if (overlay) {
    overlay.classList.toggle('show');
  }
}


private renderDashboardLayout(): void {
  this.container.innerHTML = `
<div class="layout-wrapper">

      <button id="sidebar-toggle" class="mobile-toggle-btn">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <aside class="layout-sidebar" id="dashboard-sidebar">

        <div id="logo-btn" class="sidebar-header">
          <img src="../images/logo.svg" alt="PONG" class="sidebar-logo-img">
          <h2 class="text-xl font-bold tracking-wider text-white">PONG GAME</h2>
        </div>

        <nav class="sidebar-nav">
          ${this.renderNavLink('/dashboard', 'dashboard', 'Dashboard')}
          ${this.renderNavLink('/dashboard/game', 'game', 'Game Mode')}
          ${this.renderNavLink('/dashboard/chat', 'chat', 'Chat')}
          ${this.renderNavLink('/dashboard/friends', 'friends', 'Friends')}
          ${this.renderNavLink('/dashboard/settings', 'settings', 'Settings')}
        </nav>

        <div class="sidebar-footer">
           <div class="relative">
             <button id="user-menu-btn" class="user-profile-btn">
               <img class="sidebar-user-img" src="${this.user.avatar}">
               <div class="flex-1 text-left overflow-hidden">
                 <p class="text-base font-bold text-white truncate">${this.user.username || "Player"}</p>
                 <div class="flex items-center gap-2 mt-0.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p class="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Online</p>
                 </div>
               </div>
             </button>

             <div id="user-dropdown" class="hidden absolute bottom-full left-0 w-full mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50">
               <button id="logout-btn" class="btn-danger">
                 <span>Logout</span>
               </button>
             </div>
           </div>
        </div>
      </aside>

      <main class="layout-main" id="dashboard-main-content">
         <div class="content-wrapper h-full w-full"></div>
      </main>
    </div>
  `;

  this.contentContainer = document.querySelector('#dashboard-main-content .content-wrapper');
  this.setupDashboardEvents();
    this.updateActiveNavLink();
}

private renderNavLink(href: string, icon: string, text: string): string {
  return `
    <a href="${href}" class="nav-item nav-link" data-page="${icon}">
      <img src="../images/${icon}.svg" alt="${text}">
      <span class="text-base font-semibold">${text}</span>
    </a>
  `;
}

private setupDashboardEvents() {
  const toggleButton = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('dashboard-sidebar');

  if (toggleButton && overlay) {
    toggleButton.addEventListener('click', () => this.toggleSidebar());
    overlay.addEventListener('click', () => this.toggleSidebar());
  }

  if (sidebar) {
    let mouseLeaveTimeout: ReturnType<typeof setTimeout> | null = null;

    sidebar.addEventListener('mouseenter', () => {
      if (mouseLeaveTimeout) {
        clearTimeout(mouseLeaveTimeout);
        mouseLeaveTimeout = null;
      }
    });

    sidebar.addEventListener('mouseleave', () => {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop && sidebar.classList.contains('open')) {
        mouseLeaveTimeout = setTimeout(() => {
          this.toggleSidebar();
        }, 300);
      }
    });
  }

  const userMenuBtn = document.getElementById("user-menu-btn");
  const userDropdown = document.getElementById("user-dropdown");
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener("click", (e) => { e.stopPropagation(); userDropdown.classList.toggle("hidden"); });
    document.addEventListener("click", () => { userDropdown.classList.add("hidden"); });
  }
  const logoBtn = document.getElementById("logo-btn");
    if (logoBtn) {
    logoBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (sidebar?.classList.contains('open')) {
        this.toggleSidebar();
      }
      await this.navigateTo('/dashboard');
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) { logoutBtn.addEventListener("click", async (e) => { e.preventDefault(); await this.performLogout(); }); }
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
       case "dashboard/game/friend_game":
        return this.getFriendsgamePage();
      default:
        return this.get404Page();
    }
  }




private getHomePage(): Page {
  return {
    title: "PONG Game - Home",
    content: `
      <nav class="public-navbar">
        <div class="flex items-center gap-3">
          <img src="./images/logo.svg" alt="Pong Logo" class="h-10 w-10">
          <span class="text-xl font-bold text-white tracking-wider">PONG GAME</span>
        </div>
        <div class="flex gap-4">
          <a href="/login" class="btn-secondary py-2 px-6 text-sm">Login</a>
          <a href="/register" class="btn-primary py-2 px-6 text-sm">Register</a>
        </div>
      </nav>

      <section class="hero-section">
        <div class="text-center max-w-3xl mx-auto mb-16 mt-10">
          <h1 class="text-hero">Welcome to <span class="text-gradient">PONG</span></h1>
          <p class="text-gray-400 text-xl mb-10 leading-relaxed">The ultimate real-time multiplayer experience.</p>
          <div class="flex flex-wrap justify-center gap-6">
            <a href="/register" class="btn-primary text-lg px-8 py-4">Get Started</a>
            <a href="/login" class="btn-secondary text-lg px-8 py-4">Sign In</a>
          </div>
        </div>

        <div class="features-grid">
          <div class="feature-card">
            <div class="bg-gray-900 p-4 rounded-full mb-6 border border-gray-700"><img src="./images/online-svg.svg" class="w-12 h-12 opacity-80" /></div>
            <h3 class="text-xl font-bold text-white mb-3">Play Online</h3>
            <p class="text-gray-400">Challenge friends or random opponents.</p>
          </div>
          <div class="feature-card">
            <div class="bg-gray-900 p-4 rounded-full mb-6 border border-gray-700"><img src="./images/leader-borde.svg" class="w-12 h-12 opacity-80" /></div>
            <h3 class="text-xl font-bold text-white mb-3">Leaderboards</h3>
            <p class="text-gray-400">Track your rank and compete for the top.</p>
          </div>
          <div class="feature-card">
            <div class="bg-gray-900 p-4 rounded-full mb-6 border border-gray-700"><img src="./images/chat.svg" class="w-12 h-12 opacity-80" /></div>
            <h3 class="text-xl font-bold text-white mb-3">Social Hub</h3>
            <p class="text-gray-400">Chat and connect with players worldwide.</p>
          </div>
        </div>
      </section>
    `,
    init: () => console.log("🏠 Home page loaded"),
  };
}

private getFriendsgamePage(): Page {
  return {
    title: "Friends Match",
    content: `
      <div class="page-container">

        <div class="flex items-center gap-6">
          <a href="/dashboard/friends" id="back-button-friend" class="btn-secondary px-6 py-2">← Back</a>
          <h2 class="text-3xl font-bold text-white">Friends Match</h2>
        </div>

        <div class="game-stage">

          <div class="player-panel">
            <div class="relative">
              <img id="r-palyer" src="${this.user.avatar || '../images/avatars/1.jpg'}"
                   alt="Player" class="player-avatar-lg border-emerald-500 shadow-emerald-500/20">
              <div class="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-gray-900 rounded-full"></div>
            </div>
            <div class="text-center mb-2">
              <div id="r-name" class="player-name">${this.currentUser || 'Player'}</div>
              <div class="text-emerald-400 text-sm font-bold mt-1">YOU</div>
            </div>
            <div class="status-badge-online">ONLINE</div>
          </div>

          <div class="game-center-area">

            <div class="game-controls-bar justify-center">
              <div class="text-4xl font-mono font-bold text-white tracking-widest flex items-center gap-6">
                <div>Score: <span id="friend-score" style="color:#fbbf24;">0 - 0</span></div>
              </div>
            </div>

            <div id="game-container" class="game-canvas-box">
               <div id="game-placeholder-text" class="text-gray-500 text-sm flex flex-col items-center gap-2">
                  <span class="text-4xl animate-pulse">🔗</span>
                  <span>Waiting for friend to connect...</span>
               </div>
            </div>

            <div class="w-full flex flex-col items-center gap-4">

              <button id="friend-action-btn" class="btn-primary w-full md:w-auto md:px-16 text-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all duration-300">
                ENTER LOBBY
              </button>

              <div class="text-xs text-gray-500 font-mono bg-gray-800 px-3 py-1 rounded border border-gray-700">
                Controls: [W] / [S]
              </div>
            </div>
          </div>

          <div class="player-panel">
            <div class="relative">
              <img id="friend-avatar" src="../images/avatars/unknown.jpg"
                   class="w-32 h-32 rounded-full border-4 border-gray-600 object-cover shadow-lg mb-2 opacity-50">
            </div>

            <div class="text-center mb-2">
              <div id="friend-name" class="player-name text-gray-500">Waiting...</div>
              <div class="text-blue-400 text-sm font-bold mt-1">FRIEND</div>
            </div>

            <div id="friend-status-badge" class="status-badge-waiting">PENDING</div>
          </div>

        </div>
      </div>
    `,
    init: () => {
      console.log("👥 Friend Game Page Loaded");

      const friendRoomId = localStorage.getItem('friend_room_id');
      if (!friendRoomId) {
        alert("No active friend match found.");
        this.navigateTo('/dashboard/friends');
        return;
      }

      cleanupGame(this.user.id, false);
      setupNavigationHandlers(this.user.id, "back-button-friend", (path) => this.loadPage(path));

      const actionBtn = document.getElementById('friend-action-btn') as HTMLButtonElement;
      const friendNameEl = document.getElementById('friend-name');
      const friendAvatarEl = document.getElementById('friend-avatar') as HTMLImageElement;
      const friendStatusBadge = document.getElementById('friend-status-badge');
      const placeholderText = document.getElementById('game-placeholder-text');

      if (actionBtn) {
        const joinHandler = () => {
          actionBtn.innerText = 'WAITING FOR CONFIG...';
          actionBtn.disabled = true;
          actionBtn.classList.add('opacity-50', 'cursor-wait');

          sendMessage("join_friend_match", { roomId: friendRoomId });
        };
        actionBtn.onclick = joinHandler;
      }

      const friendGameListener = async (msg: any) => {

        if (msg.type === "game_config") {
            console.log("✅ Game Config Received!");

            handleGameConfig(msg, this.user.id, "friend-action-btn", false, true);

            if(placeholderText) placeholderText.style.display = 'none';

            const p1Id = msg.payload.paddles.left.playerId;
            const p2Id = msg.payload.paddles.right.playerId;

            const friendId = (String(p1Id) === String(this.user.id)) ? p2Id : p1Id;

            if (friendId) {
                const friendData = await fetchUserDetails(friendId);
                if (friendData) {
                    if(friendNameEl) {
                        friendNameEl.innerText = friendData.username;
                        friendNameEl.classList.remove('text-gray-500');
                        friendNameEl.classList.add('text-white');
                    }
                    if(friendAvatarEl) {
                        friendAvatarEl.src = friendData.avatar;
                        friendAvatarEl.classList.remove('opacity-50', 'border-gray-600');
                        friendAvatarEl.classList.add('border-blue-500');
                    }
                    if(friendStatusBadge) {
                        friendStatusBadge.innerText = "CONNECTED";
                        friendStatusBadge.className = "status-badge-online !text-blue-400 !border-blue-500/30 !bg-blue-500/10";
                    }
                }
            }

            if (actionBtn) {
                const newBtn = actionBtn.cloneNode(true) as HTMLButtonElement;
                actionBtn.parentNode?.replaceChild(newBtn, actionBtn);

                newBtn.innerHTML = "<span>⚔️</span> I AM READY";
                newBtn.className = "btn-primary w-full md:w-auto md:px-16 text-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all duration-300";
                newBtn.disabled = false;

                newBtn.onclick = () => {
                    console.log("🚀 Sending Ready Signal");
                    sendMessage("player_ready", { gameId: msg.payload.gameId, playerId: String(this.user.id) });

                    newBtn.innerText = "WAITING FOR START...";
                    newBtn.disabled = true;
                    newBtn.classList.add('opacity-50', 'cursor-not-allowed');
                };
            }
        }

        if (msg.type === "game_start") {
            console.log("🎮 Friend Game Started!");
            const btn = document.getElementById('friend-action-btn');
            if (btn) btn.style.display = 'none';
        }
      };

      setupGameListeners(
        friendGameListener,
        'friend-score',
        this.user.id,
        (path: string) => this.loadPage(path),
        false,
        true
      );
    },
  };
}
private getTournamentLobbyPage(): Page {
  return {
    title: "Tournament Lobby",
    content: `
      <div class="lobby-wrapper">

        <div class="lobby-inner">
            <div class="flex items-center justify-between mb-6 shrink-0">
              <button id="leave-tournament-btn" class="back-button">← Leave Lobby</button>
              <h2 class="text-xl font-bold text-white tracking-wide">🏆 TOURNAMENT LOBBY</h2>
              <div class="w-[120px]"></div>
            </div>

            <div class="lobby-grid">
              <div class="lobby-sidebar-panel">
                <div class="p-4 border-b border-gray-700 bg-gray-850 flex justify-between items-center">
                   <h3 class="font-bold text-gray-200">Players</h3>
                   <span id="player-count-display" class="text-emerald-400 font-mono">0/4</span>
                </div>
                <div id="bracket-container" class="lobby-player-list"></div>
              </div>

              <div class="lobby-main-panel" id="lobby-main-area">
                <div class="text-center p-8">
                  <div class="inline-block p-6 rounded-full bg-gray-800 mb-6 animate-pulse border border-gray-600">
                    <span class="text-5xl">⏳</span>
                  </div>
                  <h2 class="text-3xl font-bold text-white mb-2">Waiting for Players</h2>
                  <p class="text-gray-500">The bracket will generate automatically when 4 players join.</p>
                </div>
              </div>
            </div>
        </div>

        <div id="view-bracket" class="tournament-overlay hidden">
             <h1 class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-12 tracking-widest uppercase drop-shadow-lg">SEMI-FINALS</h1>

             <div id="big-bracket-content" class="w-full max-w-6xl px-4 flex justify-center"></div>

             <div class="mt-16 text-gray-400 text-2xl animate-pulse">
                Next match starting in <span id="bracket-timer" class="text-white font-bold text-3xl ml-2">...</span>
             </div>
        </div>

        <div id="view-game" class="tournament-overlay hidden">

            <div class="absolute top-0 w-full h-24 bg-gray-900/95 border-b border-gray-800 flex justify-between items-center px-12">
               <div class="text-white font-bold text-2xl tracking-wider" id="game-round-label">MATCH</div>
               <div class="px-10 py-3 bg-gray-800 rounded-full border border-gray-700">
                  <span class="font-mono text-4xl font-bold text-emerald-400 tracking-widest" id="tournament-score">0 - 0</span>
               </div>
               <div class="w-[100px]"></div>
            </div>

            <div id="ready-overlay" class="absolute inset-0 z-[210] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
               <div id="game-match-info" class="flex items-center gap-16 mb-12"></div>
               <button id="game-ready-btn" class="btn-primary text-2xl px-12 py-6 shadow-emerald-500/30 animate-pulse">
                 I AM READY! ⚔️
               </button>
            </div>

            <div class="game-board-wrapper">

               <div class="game-player-left">
                  <img id="game-p1-avatar" class="w-24 h-24 rounded-full border-4 border-blue-500 shadow-lg object-cover bg-gray-800">
                  <span id="game-p1-name" class="text-lg font-bold text-white bg-gray-900 px-4 py-1 rounded border border-gray-700">P1</span>
               </div>

               <div id="game-container" class="game-canvas"></div>

               <div class="game-player-right">
                  <img id="game-p2-avatar" class="w-24 h-24 rounded-full border-4 border-red-500 shadow-lg object-cover bg-gray-800">
                  <span id="game-p2-name" class="text-lg font-bold text-white bg-gray-900 px-4 py-1 rounded border border-gray-700">P2</span>
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
      const bracketEl = document.getElementById("bracket-container")!;
      const leaveBtn = document.getElementById("leave-tournament-btn")!;

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
               <div class="lobby-player-item">
                   <img src="${p.avatar}" class="w-8 h-8 rounded-full bg-gray-600 object-cover border border-gray-500">
                   <span class="text-gray-200 text-sm font-medium truncate">${p.username}</span>
               </div>
           `).join('');

           const slotsLeft = 4 - players.length;
           if (slotsLeft > 0) {
               const emptySlots = Array(slotsLeft).fill(0).map((_, i) => `
                   <div class="lobby-empty-slot">
                       <div class="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">${i + 1 + players.length}</div>
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
                  if (playerCountEl) playerCountEl.innerText = `${pList.length}/4`;
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
       if(leaveBtn) leaveBtn.onclick = handleLeave;

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
<div class="w-full h-full p-4 lg:p-8">

        <div class="flex items-center gap-6 mb-8">
          <a href="/dashboard/game" id="back-button-tournament" class="nav-link px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-base font-medium transition-colors">← Back</a>
          <h2 class="text-3xl font-bold text-white">Tournaments</h2>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full">
          <div class="xl:col-span-1">
            <div class="bg-gray-800/40 rounded-2xl border border-gray-700 p-8 h-full">
              <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
                 <span>➕</span> Create New
              </h3>

              <div class="space-y-6">
                <div>
                  <label class="block text-sm text-gray-400 uppercase font-semibold mb-2">Tournament Name</label>
                  <input id="tournament-title-input" type="text" placeholder="e.g. Champions Cup" maxlength="20"
                         class="w-full bg-gray-900/40 border border-gray-600 rounded-xl px-5 py-4 text-white text-lg focus:border-emerald-500 focus:outline-none transition-colors" />
                </div>

                <button id="create-tournament-btn" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-emerald-900/20">
                  Create & Join
                </button>
                <p class="text-sm text-center text-gray-500">Max 4 players per tournament</p>
              </div>
            </div>
          </div>

          <div class="xl:col-span-2">
            <div class="bg-gray-800/40 rounded-2xl border border-gray-700 p-8 h-[600px] flex flex-col">
              <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-white">Active Lobbies</h3>
                <button id="refresh-tournaments-btn" class="text-base text-emerald-400 hover:text-emerald-300 font-medium px-4 py-2 rounded hover:bg-gray-700 transition-colors">
                  🔄 Refresh List
                </button>
              </div>

              <div id="tournaments-list" class="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                <div id="tournaments-loading" class="text-center py-20 text-gray-500 text-lg">
                  Loading tournaments...
                </div>
                <div id="tournaments-empty" class="hidden text-center py-20 text-gray-500 flex flex-col items-center justify-center h-full">
                  <span class="text-6xl mb-4 opacity-50">🏜️</span>
                  <span class="text-lg">No active tournaments found.</span>
                </div>
                <div id="tournaments-container"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
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

           if (tournaments.length === 0) { emptyState.style.display = "flex"; return; }

           tournaments.forEach((t: any) => {
             const card = document.createElement("div");
             card.className = "bg-gray-900/50 hover:bg-gray-900 border border-gray-700 p-5 rounded-xl flex justify-between items-center transition-all group";

             let count = 0;
             if (t.numPlayers !== undefined) count = t.numPlayers;
             else if (Array.isArray(t.players)) count = t.players.length;

             card.innerHTML = `
               <div class="flex items-center gap-6">
                 <div class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl">🏆</div>
                 <div>
                   <div class="text-gray-200 font-bold text-lg group-hover:text-white">${t.title}</div>
                   <div class="text-sm text-gray-500">Players: <span class="${count >= 4 ? 'text-red-400' : 'text-emerald-400'} font-bold">${count}/4</span></div>
                 </div>
               </div>
             `;

             const joinBtn = document.createElement("button");
             joinBtn.innerText = count >= 4 ? "Full" : "Join Lobby";
             joinBtn.className = count >= 4
               ? "px-6 py-3 text-sm font-bold bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed"
               : "px-6 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-md";

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
           } else { alert("Failed"); createBtn.disabled = false; createBtn.innerText = "Create & Join"; }
         } catch { createBtn.disabled = false; createBtn.innerText = "Create & Join"; }
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
    title: "Select Mode",
    content: `
    <div class="page-container">
      <div>
        <h1 class="text-title-lg">Select Game Mode</h1>
        <p class="text-subtitle">Choose how you want to play</p>
      </div>

      <div class="game-mode-grid">

        <a href="dashboard/game/ai" class="game-mode-card nav-link">
          <div class="game-mode-icon-bg">
             <img src="./images/ai-game.svg" class="game-mode-img" />
          </div>
          <h3 class="game-card-title">Play vs AI</h3>
          <p class="game-card-desc">Train against the computer</p>
        </a>

        <a href="dashboard/game/local" class="game-mode-card nav-link">
          <div class="game-mode-icon-bg">
             <img src="./images/local.svg" class="game-mode-img" />
          </div>
          <h3 class="game-card-title">Local PvP</h3>
          <p class="game-card-desc">2 Players on one device</p>
        </a>

        <a href="dashboard/game/remote" class="game-mode-card nav-link">
          <div class="game-mode-icon-bg">
             <img src="./images/remote-game.svg" class="game-mode-img" />
          </div>
          <h3 class="game-card-title">Online Match</h3>
          <p class="game-card-desc">Find a random opponent</p>
        </a>

        <a href="dashboard/game/tournament" class="game-mode-card nav-link">
           <div class="game-mode-icon-bg">
             <img src="./images/tournament.svg" class="game-mode-img" />
          </div>
          <h3 class="game-card-title">Tournament</h3>
          <p class="game-card-desc">Join a bracket & win</p>
        </a>

      </div>
    </div>
    `,
    init: () => console.log("🎮 Game mode selection loaded"),
  };
}


private getremotepage(): Page {
  return {
    title: "PONG Game - Online Match",
    content: `
      <div class="page-container">

        <div class="flex items-center gap-6">
          <a href="/dashboard/game" id="back-button-remote" class="btn-secondary px-6 py-2">← Back</a>
          <h2 class="text-3xl font-bold text-white">Online Match</h2>
        </div>

        <div class="game-stage">

          <div class="player-panel">
            <div class="relative">
              <img id="r-palyer" src="${this.user.avatar || '../images/avatars/1.jpg'}"
                   alt="Player" class="player-avatar-lg border-emerald-500 shadow-emerald-500/20">
              <div class="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-gray-900 rounded-full"></div>
            </div>
            <div class="text-center mb-2">
              <div id="r-name" class="player-name">${this.currentUser || 'Player'}</div>
              <div class="text-emerald-400 text-sm font-bold mt-1">YOU</div>
            </div>
            <div class="status-badge-online">ONLINE</div>
          </div>

          <div class="game-center-area">

            <div class="game-controls-bar justify-center">
              <div class="text-4xl font-mono font-bold text-white tracking-widest flex items-center gap-6">
                <div>Score: <span id="remote-score" style="color:#fbbf24;">0 - 0</span></div>
              </div>
            </div>

            <div id="game-container" class="game-canvas-box">
               <div class="text-gray-600 text-sm">Find an opponent to start</div>
            </div>

            <div class="w-full flex flex-col items-center gap-4">

              <button id="start-remote-game" class="btn-primary w-full md:w-auto md:px-16 text-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all duration-300">
                <span>🌐</span> FIND OPPONENT
              </button>

              <div id="matchmaking-status" class="hidden items-center gap-2 text-yellow-400 bg-gray-800 px-4 py-2 rounded-full border border-yellow-500/30 animate-pulse">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span class="text-xs font-bold tracking-wide">SEARCHING...</span>
              </div>

              <div class="text-xs text-gray-500 font-mono bg-gray-800 px-3 py-1 rounded border border-gray-700">
                Controls: [W] / [S]
              </div>
            </div>
          </div>

          <div class="player-panel">
            <div class="relative">
              <img id="opponent-avatar" src="../images/avatars/1.jpg" alt="Opponent"
                   class="hidden w-32 h-32 rounded-full border-4 border-blue-500 object-cover shadow-lg mb-2">

              <div id="opponent-placeholder" class="opponent-placeholder">?</div>
            </div>

            <div class="text-center mb-2">
              <div id="opponent-name" class="player-name text-gray-500">Waiting...</div>
              <div class="text-blue-400 text-sm font-bold mt-1">OPPONENT</div>
            </div>

            <div id="serch" class="status-badge-waiting">WAITING</div>
          </div>

        </div>
      </div>
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
      const opponentPlaceholder = document.getElementById('opponent-placeholder');
      const searchStatusText = document.getElementById('serch');

      if (startButton) {
        const startHandler = () => {
          startButton.innerText = 'CANCEL SEARCH';
          startButton.classList.replace('btn-primary', 'btn-secondary');

          if (matchmakingStatus) matchmakingStatus.classList.remove('hidden');
          if (matchmakingStatus) matchmakingStatus.classList.add('flex');

          if (opponentPlaceholder) opponentPlaceholder.classList.add('searching-pulse');

          if (searchStatusText) {
            searchStatusText.innerText = "SEARCHING...";
            searchStatusText.classList.remove('status-badge-waiting');
            searchStatusText.classList.add('text-yellow-400', 'border-yellow-500/30', 'bg-yellow-500/10');
          }

          sendMessage("join_random", {});
        };
        startButton.addEventListener('click', startHandler);
        addCleanupListener(() => startButton.removeEventListener('click', startHandler));
      }

      const remoteListener = createRemoteGameListener(this.user.id);

      const uiAwareListener = (data: any) => {
         remoteListener(data);

         // When game/match starts
         if (data.type === 'game_start' || data.type === 'match_found') {
             const matchmakingStatus = document.getElementById('matchmaking-status');
             const opponentPlaceholder = document.getElementById('opponent-placeholder');
             const opponentAvatar = document.getElementById('opponent-avatar');
             const searchStatusText = document.getElementById('serch');

             // ✅ UPDATE BUTTON TO READY STATE
             if (startButton) {
               startButton.innerHTML = '<span>⚔️</span> I AM READY';
               startButton.disabled = false;
               startButton.classList.replace('btn-secondary', 'btn-primary'); // Switch back to primary color
               // Note: Any 'Ready' click logic needs to be attached here or handled by the existing listener
             }

             if(matchmakingStatus) matchmakingStatus.classList.add('hidden');
             if(opponentPlaceholder) opponentPlaceholder.classList.add('hidden');
             if(opponentAvatar) opponentAvatar.classList.remove('hidden');

             if(searchStatusText) {
                 searchStatusText.innerText = "CONNECTED";
                 searchStatusText.className = "status-badge-online !text-blue-400 !border-blue-500/30 !bg-blue-500/10";
             }
         }
      };

      setupGameListeners(
        uiAwareListener,
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
      <div class="page-container">

        <div class="flex items-center gap-6">
          <a href="/dashboard/game" id="back-button" class="btn-secondary px-6 py-2">← Back</a>
          <h2 class="text-3xl font-bold text-white">Local PvP</h2>
        </div>

        <div class="game-stage">

          <div class="player-panel">
            <div class="relative">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-6xl font-bold text-white shadow-lg shadow-blue-500/30 border-4 border-gray-800 mb-4">
                1
              </div>
            </div>
            <div class="text-center mb-4">
              <div class="player-name">Player 1</div>
              <div class="text-blue-400 text-sm font-bold mt-1">WASD Controls</div>
            </div>

            <div class="flex gap-2">
              <div class="flex flex-col items-center gap-1">
                <span class="w-8 h-8 flex items-center justify-center bg-gray-700 rounded border border-gray-600 font-mono text-sm font-bold text-white shadow-md">W</span>
                <span class="text-[10px] text-gray-500 uppercase font-bold">Up</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="w-8 h-8 flex items-center justify-center bg-gray-700 rounded border border-gray-600 font-mono text-sm font-bold text-white shadow-md">S</span>
                <span class="text-[10px] text-gray-500 uppercase font-bold">Down</span>
              </div>
            </div>
          </div>

          <div class="game-center-area">

            <div class="game-controls-bar justify-center">
              <div class="text-4xl font-mono font-bold text-white tracking-widest flex items-center gap-4">
                <div><span id="local-score" style="color:#fbbf24;">0 - 0</span></div>
              </div>
            </div>

            <div id="game-container" class="game-canvas-box">
               <div class="text-gray-600 text-sm">Press Start to Load Game</div>
            </div>

            <div class="w-full flex flex-col items-center gap-2">
              <button id="start-local-game" class="btn-primary w-full md:w-auto md:px-16 text-lg shadow-blue-500/20">
                ▶️ START MATCH
              </button>
              <p class="text-xs text-gray-500">Local multiplayer on the same device</p>
            </div>
          </div>

          <div class="player-panel">
            <div class="relative">
              <div class="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-6xl font-bold text-white shadow-lg shadow-red-500/30 border-4 border-gray-800 mb-4">
                2
              </div>
            </div>
            <div class="text-center mb-4">
              <div class="player-name">Player 2</div>
              <div class="text-red-400 text-sm font-bold mt-1">Arrow Controls</div>
            </div>

            <div class="flex gap-2">
              <div class="flex flex-col items-center gap-1">
                <span class="w-8 h-8 flex items-center justify-center bg-gray-700 rounded border border-gray-600 font-mono text-sm font-bold text-white shadow-md">↑</span>
                <span class="text-[10px] text-gray-500 uppercase font-bold">Up</span>
              </div>
              <div class="flex flex-col items-center gap-1">
                <span class="w-8 h-8 flex items-center justify-center bg-gray-700 rounded border border-gray-600 font-mono text-sm font-bold text-white shadow-md">↓</span>
                <span class="text-[10px] text-gray-500 uppercase font-bold">Down</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `,
    init: () => {
      console.log("🎮 Local page loaded");
      cleanupGame(this.user.id, false);

      setupNavigationHandlers(
        this.user.id,
        "back-button",
        (path: string) => this.loadPage(path)
      );

      const startButton = document.getElementById('start-local-game') as HTMLButtonElement;

      if (startButton) {
        const startHandler = () => {
          startButton.innerText = '⚔️ Game Running';
          startButton.disabled = true;
          startButton.classList.add('opacity-50', 'cursor-not-allowed', 'scale-95');

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
      <div class="page-container">

        <div class="flex items-center gap-6">
          <a href="/dashboard/game" id="back-button-ai" class="btn-secondary px-6 py-2">← Back</a>
          <h2 class="text-3xl font-bold text-white">VS Artificial Intelligence</h2>
        </div>

        <div class="game-stage">

          <div class="player-panel">
            <div class="relative">
              <img src="${this.user.avatar || '../images/avatars/1.jpg'}" alt="Player" class="player-avatar-lg border-emerald-500 shadow-emerald-500/20">
              <div class="absolute bottom-2 right-2 w-6 h-6 bg-emerald-500 border-4 border-gray-900 rounded-full"></div>
            </div>
            <div class="text-center">
              <div class="player-name">${this.currentUser || 'Player'}</div>
              <div class="text-emerald-400 text-sm font-bold mt-1">Human</div>
            </div>
            <div class="player-status text-emerald-400 border-emerald-500/30 bg-emerald-500/10">READY</div>
          </div>

          <div class="game-center-area">

            <div class="game-controls-bar">

              <div id="ai-difficulty-wrapper" class="flex items-center gap-4 transition-opacity duration-500">
                <label class="text-gray-400 text-sm font-bold">DIFFICULTY:</label>
                <select id="ai-difficulty" class="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-1 text-sm focus:border-emerald-500 outline-none">
                  <option value="easy">🟢 Easy</option>
                  <option value="medium" selected>🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>
              </div>

              <div class="text-3xl font-mono font-bold text-white tracking-widest flex-1 text-center">
              <div><span id="ai-score" style="color:#fbbf24;">0 - 0</span></div>
              </div>

              <div class="text-xs text-gray-500 font-mono bg-black/30 px-3 py-1 rounded">
                [W] UP / [S] DOWN
              </div>
            </div>

            <div id="game-container" class="game-canvas-box">
               <div class="text-gray-600 text-sm">Press Start to Load Game</div>
            </div>

            <button id="start-ai-game" class="btn-primary w-full md:w-auto md:px-12 text-lg shadow-emerald-500/20 transition-all duration-500">
              🤖 START MATCH
            </button>
          </div>

          <div class="player-panel">
            <div class="relative">
              <div class="player-avatar-lg ai-avatar-glow border-purple-500">🤖</div>
            </div>
            <div class="text-center">
              <div class="player-name">PongBot 3000</div>
              <div class="text-purple-400 text-sm font-bold mt-1">CPU</div>
            </div>
            <div class="player-status text-purple-400 border-purple-500/30 bg-purple-500/10">WAITING</div>
          </div>

        </div>
      </div>
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
      const difficultyWrapper = document.getElementById('ai-difficulty-wrapper'); // ✅ Get the wrapper

      if (startButton) {
        const startHandler = () => {
          const difficulty = difficultySelect?.value || 'medium';

          startButton.innerText = '🎮 Game Running';
          startButton.disabled = true;
          startButton.classList.add('opacity-50', 'cursor-not-allowed', 'scale-95');

          if (difficultyWrapper) {
            difficultyWrapper.style.display = 'none';
          }

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
      <nav class="public-navbar">
        <div class="flex items-center gap-3">
          <img src="./images/logo.svg" class="h-8 w-8">
          <span class="font-bold text-white tracking-wider">PONG</span>
        </div>
        <a href="/register" class="text-sm font-bold text-emerald-400 hover:text-emerald-300">Create Account →</a>
      </nav>

      <section class="auth-section">
        <div class="auth-card">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p class="text-gray-400">Sign in to your account</p>
          </div>

          <form id="login-form" class="space-y-6">
            <input type="text" id="username" placeholder="Username" class="input-std" />
            <input type="password" id="password" placeholder="Password" class="input-std" />
            <button type="submit" class="btn-primary w-full justify-center">Sign In</button>
          </form>

          <div id="login-42-container" class="w-full mt-6"></div>

          <div class="mt-8 text-center border-t border-gray-700 pt-6">
            <p class="text-gray-400 mb-4">Don't have an account?</p>
            <a href="/register" class="btn-secondary w-full">Create Account</a>
          </div>

          <div class="mt-4 text-center">
            <a href="/" class="text-xs text-gray-500 hover:text-white transition-colors">← Back to Home</a>
          </div>
        </div>
      </section>
    `,
    init: () => {
      // ... (Keep your existing init logic unchanged) ...
      console.log("🔑 Login page loaded");
      const form = document.getElementById("login-form");
      if (form) {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const username = (document.getElementById("username") as HTMLInputElement).value;
          const password = (document.getElementById("password") as HTMLInputElement).value;
          (async () => { await this.performLogin(username, password); })();
        });
      }

      const container = document.getElementById('login-42-container');
      if (container) {
        const divider = document.createElement('div');
        // Using the class we added to style.css
        divider.className = "auth-divider";
        // Or manual tailwind if you didn't add that class:
        // divider.className = "flex items-center my-4 w-full";
        divider.innerHTML = `<div class="flex-grow h-px bg-gray-700"></div><span class="px-3 text-gray-500 text-sm font-bold">OR</span><div class="flex-grow h-px bg-gray-700"></div>`;
        container.appendChild(divider);

        create42IntraButton(container, {
          text: 'Sign in with 42 Intra',
          onClick: () => {
            console.log('🚀 Starting 42 intra OAuth login...');
            Auth42Handler.initiateLogin('/dashboard');
          }
        });
      }
    },
  };
}

  private getRegisterPage(): Page {
    return {
      title: "PONG Game - Register",
      content: `
      <nav class="public-navbar">
        <div class="flex items-center gap-3">
          <img src="./images/logo.svg" class="h-8 w-8"><span class="font-bold text-white">PONG</span>
        </div>
        <a href="/login" class="text-sm font-bold text-emerald-400">Sign In →</a>
      </nav>

      <section class="auth-section">
        <div class="auth-card">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p class="text-gray-400">Join the arena today</p>
          </div>

          <form id="register-form" class="space-y-5">
            <input type="text" id="new-username" placeholder="Username" required class="input-std">
            <input type="email" id="email" placeholder="Email Address" required class="input-std">
            <input type="password" id="new-password" placeholder="Password" required class="input-std">
            <input type="text" id="usernameTournament" placeholder="Tournament Name (Optional)" class="input-std">

            <div class="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
               <img id="avatar-preview" src="/avatar/default_avatar/default_avatar.jpg" class="w-16 h-16 rounded-full object-cover border-2 border-gray-600">
               <div class="flex flex-col gap-2">
                  <label for="avatar-upload" class="btn-secondary text-xs py-2 px-4">Choose Image</label>
                  <input type="file" id="avatar-upload" accept="image/*" class="hidden">
                  <button type="button" id="remove-avatar" class="hidden text-xs text-red-400 underline">Remove</button>
               </div>
            </div>

            <button type="submit" class="btn-primary w-full justify-center">Register</button>
          </form>

          <div id="register-42-container" class="mt-6"></div>
          <div class="mt-6 text-center">
             <p class="text-gray-400 text-sm">Have an account? <a href="/login" class="text-emerald-400 hover:underline">Sign In</a></p>
             <div class="mt-4"><a href="/" class="text-xs text-gray-500 hover:text-white">← Home</a></div>
          </div>
        </div>
      </section>
      `,
      init: () => {
        console.log("📝 Register page loaded");

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
      <div class="page-container">
        <h2 class="text-title-lg">Account Settings</h2>

        <form id="settings-form" class="settings-grid">

          <div class="xl:col-span-2 card-base space-y-6">
            <h3 class="text-xl font-bold text-white border-b border-gray-700 pb-4">Profile Details</h3>
            <div>
              <label class="text-label">Username</label>
              <input type="text" id="settings-username" value="${this.user.username}" class="input-std">
            </div>
            <div>
              <label class="text-label">Email</label>
              <input type="email" id="settings-email" value="${this.user.email}" class="input-std">
            </div>
            <div>
              <label class="text-label">Tournament Name</label>
              <input type="text" id="settings-tournament" placeholder="Display Name" class="input-std">
            </div>
            <button type="submit" class="btn-primary w-full mt-4">Save Changes</button>
            <div id="settings-status" class="hidden text-center p-3 rounded-lg mt-2 font-bold"></div>
          </div>

          <div class="xl:col-span-1 card-base flex flex-col items-center">
            <h3 class="text-xl font-bold text-white border-b border-gray-700 pb-4 w-full mb-6">Avatar</h3>

            <img id="settings-current-avatar" src="${this.user.avatar}" class="settings-avatar-preview">

            <input type="file" id="settings-avatar-file" class="hidden">
            <button type="button" id="settings-choose-avatar-btn" class="btn-secondary w-full">Upload New</button>

            <div id="settings-avatar-preview-container" class="hidden w-full mt-4 flex items-center justify-between bg-gray-900 p-2 rounded-lg border border-emerald-500">
               <div class="flex items-center gap-2">
                 <img id="settings-upload-preview" src="" class="w-8 h-8 rounded-full object-cover">
                 <span class="text-xs text-emerald-400">New image selected</span>
               </div>
               <button type="button" id="settings-remove-avatar-btn" class="text-red-400 hover:text-red-300 text-lg font-bold px-2">×</button>
            </div>

            <div class="w-full border-t border-gray-700 my-6"></div>
            <p class="text-gray-400 text-sm mb-2">Or select default:</p>

            <div id="avatar-options" class="avatar-selection-grid">
               <img src="../images/avatars/1.jpg" class="avatar-thumb" data-value="../images/avatars/1.jpg">
               <img src="../images/avatars/2.jpg" class="avatar-thumb" data-value="../images/avatars/2.jpg">
               <img src="../images/avatars/3.jpg" class="avatar-thumb" data-value="../images/avatars/3.jpg">
               <img src="../images/avatars/4.jpg" class="avatar-thumb" data-value="../images/avatars/4.jpg">
            </div>

            <input type="hidden" id="settings-avatar" value="${this.user.avatar}">
          </div>

        </form>
      </div>
    `,
    init: () => {
      console.log("⚙️ Settings page loaded");

      const form = document.getElementById('settings-form') as HTMLFormElement;
      const statusDiv = document.getElementById('settings-status') as HTMLDivElement;

      // ✅ FIX: Select by '.avatar-thumb' to match HTML/CSS
      const avatarOptions = document.querySelectorAll<HTMLImageElement>(".avatar-thumb");
      const avatarInput = document.getElementById("settings-avatar") as HTMLInputElement;
      const currentAvatarImg = document.getElementById('settings-current-avatar') as HTMLImageElement;

      // Upload Elements
      const fileInput = document.getElementById('settings-avatar-file') as HTMLInputElement;
      const chooseBtn = document.getElementById('settings-choose-avatar-btn') as HTMLButtonElement;
      const removeBtn = document.getElementById('settings-remove-avatar-btn') as HTMLButtonElement;
      const previewContainer = document.getElementById('settings-avatar-preview-container') as HTMLDivElement;
      const uploadPreviewImg = document.getElementById('settings-upload-preview') as HTMLImageElement;

      let uploadedAvatarPath: string | null = null;

      // 1. Handle File Upload
      if (chooseBtn && fileInput) {
        chooseBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', async (e) => {
          const target = e.target as HTMLInputElement;
          const file = target.files?.[0];
          if (!file) return;

          const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (!validTypes.includes(file.type)) { alert('Invalid file type'); return; }
          if (file.size > 5 * 1024 * 1024) { alert('Max size 5MB'); return; }

          // Show mini preview
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result && uploadPreviewImg) {
              uploadPreviewImg.src = e.target.result as string;
              previewContainer.classList.remove('hidden');
            }
          };
          reader.readAsDataURL(file);

          // Upload immediately
          const formData = new FormData();
          formData.append('avatar', file);

          try {
            const token = localStorage.getItem('jwt_token');
            const response = await fetch('/api/upload-avatar', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            uploadedAvatarPath = data.avatar;
            console.log('✅ Avatar uploaded:', uploadedAvatarPath);

            // Remove selection from defaults
            avatarOptions.forEach(o => o.classList.remove("selected"));

            // Update main preview
            if(currentAvatarImg) currentAvatarImg.src = uploadedAvatarPath!;

          } catch (error) {
            console.error(error);
            alert('Failed to upload avatar.');
          }
        });

        // Remove uploaded file
        if (removeBtn) {
          removeBtn.addEventListener('click', () => {
            fileInput.value = '';
            previewContainer.classList.add('hidden');
            uploadedAvatarPath = null;
            // Revert preview to current user avatar
            if(currentAvatarImg) currentAvatarImg.src = this.user.avatar;
          });
        }
      }

      // 2. Handle Default Avatar Selection
      if (avatarOptions && avatarInput) {
        // Highlight current avatar on load
        avatarOptions.forEach(o => {
            if(o.dataset.value === this.user.avatar) o.classList.add('selected');
        });

        avatarOptions.forEach(option => {
          option.addEventListener("click", () => {
            // Remove selected class from all
            avatarOptions.forEach(o => o.classList.remove("selected"));
            // Add to clicked
            option.classList.add("selected");

            // Update hidden input
            const newVal = option.dataset.value || "";
            avatarInput.value = newVal;

            // Update visual preview
            currentAvatarImg.src = newVal;

            // Clear upload if exists
            if (uploadedAvatarPath) {
              uploadedAvatarPath = null;
              fileInput.value = '';
              previewContainer.classList.add('hidden');
            }
          });
        });
      }

      // 3. Handle Form Submit
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          const username = (document.getElementById('settings-username') as HTMLInputElement).value.trim();
          const email = (document.getElementById('settings-email') as HTMLInputElement).value.trim();
          const tournament = (document.getElementById('settings-tournament') as HTMLInputElement).value.trim();

          // Decide which avatar to use
          let finalAvatar = '';
          if (uploadedAvatarPath) {
            finalAvatar = uploadedAvatarPath;
          } else {
            finalAvatar = avatarInput.value;
          }

          const updates: any = {};
          if (username && username !== this.currentUser) updates.username = username;
          if (email && email !== this.user.email) updates.email = email;
          if (tournament) updates.usernameTournament = tournament;
          // Only add avatar to updates if it is different
          if (finalAvatar && finalAvatar !== this.user.avatar) updates.avatar = finalAvatar;

          // UI Feedback
          if (Object.keys(updates).length === 0) {
            statusDiv.classList.remove('hidden', 'bg-green-500/20', 'text-green-400', 'bg-blue-500/20', 'text-blue-400');
            statusDiv.classList.add('block', 'bg-yellow-500/20', 'text-yellow-400');
            statusDiv.textContent = '⚠️ No changes detected';
            return;
          }

          statusDiv.classList.remove('hidden', 'bg-yellow-500/20', 'text-yellow-400', 'bg-red-500/20', 'text-red-400');
          statusDiv.classList.add('block', 'bg-blue-500/20', 'text-blue-400');
          statusDiv.textContent = '⏳ Updating profile...';

          const success = await this.updateUserProfile(updates);

          if (success) {
            // Update local state
            if (updates.username) this.currentUser = updates.username;
            if (updates.email) this.user.email = updates.email;
            if (updates.usernameTournament) this.user.usernametournament = updates.usernameTournament;
            if (updates.avatar) {
              this.user.avatar = updates.avatar;
              // Update sidebar avatar immediately if element exists
              const sidebarAvatar = document.querySelector('.sidebar-user-img') as HTMLImageElement;
              if(sidebarAvatar) sidebarAvatar.src = updates.avatar;
            }

            // Cleanup UI
            uploadedAvatarPath = null;
            fileInput.value = '';
            previewContainer.classList.add('hidden');

            statusDiv.classList.remove('bg-blue-500/20', 'text-blue-400');
            statusDiv.classList.add('bg-green-500/20', 'text-green-400');
            statusDiv.textContent = '✅ Profile updated successfully!';
          } else {
            statusDiv.classList.remove('bg-blue-500/20', 'text-blue-400');
            statusDiv.classList.add('bg-red-500/20', 'text-red-400');
            statusDiv.textContent = '❌ Failed to update profile.';
          }
        });
      }
    }
  };
}



private getDashboardPage(): Page {
  return {
    title: "Dashboard",
    content: `
      <div class="page-container">
        <div class="card-base">
          <h2 class="text-title-lg">Hello, ${this.user.username || 'Player'}</h2>
          <p class="text-subtitle">Welcome back to the arena.</p>
        </div>
        <div class="stats-grid">
          <div class="stat-card"><h3 class="text-label">Played</h3><div class="text-5xl font-bold text-white" id="total">-</div></div>
          <div class="stat-card"><h3 class="text-label">Wins</h3><div class="text-5xl font-bold text-emerald-400" id="wins">-</div></div>
          <div class="stat-card"><h3 class="text-label">Losses</h3><div class="text-5xl font-bold text-red-400" id="losses">-</div></div>
          <div class="stat-card"><h3 class="text-label">Avg</h3><div class="text-5xl font-bold text-blue-400" id="avgScore">-</div></div>
        </div>
        <div class="card-base">
          <h2 class="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-4">Match History</h2>
          <div id="match-history">Loading...</div>
        </div>
      </div>
    `,
    init: () => { this.fetchAndDisplayStats(); this.fetchAndDisplayMatchHistory(); },
  };
}



private modeAvatars: Record<string, string> = {
    tournament: "../images/tournament.svg",
    random: "../images/remote-game.svg",
    ai_opponent: "../images/ai-game.svg",
    friend: "../images/game.svg",
    default: "../images/game.svg"
};


private async fetchAndDisplayMatchHistory() {
    const container = document.getElementById("match-history") as HTMLElement;

    try {
        const res = await fetch(`/tournaments/matches/user/${this.user.id}`);
        if (!res.ok) {
            container.innerHTML = "Failed to load match history.";
            return;
        }

        const matches = await res.json();

        if (!matches.length) {
            container.innerHTML = "No matches played yet.";
            return;
        }

        matches.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        container.innerHTML = matches.map((m: any) => {
            const youAreP1 = m.p1 === String(this.user.id);
            const yourScore = youAreP1 ? m.p1Score : m.p2Score;
            const opponentScore = youAreP1 ? m.p2Score : m.p1Score;
            const result = m.winner === String(this.user.id) ? "WIN" : "LOSS";
            const mode = m.mode || "unknown";
            const avatarSrc = this.modeAvatars[mode] || this.modeAvatars.default;

            return `
                <div class="match-item ${result === "WIN" ? "win" : "loss"}">

                    <div class="flex items-center gap-3">
                        <img
                            src="${avatarSrc}"
                            class="w-10 h-10 opacity-90"
                        />

                        <div class="flex flex-col">
                            <strong class="text-lg">${result}</strong>
                            <span class="text-sm text-gray-300">${mode.toUpperCase()}</span>
                        </div>
                    </div>

                    <div class="mt-2 text-gray-200">
                        Score: ${yourScore} : ${opponentScore}
                    </div>

                    <small class="text-gray-400 mt-1 block">${new Date(m.createdAt).toLocaleString()}</small>

                </div>
            `;
        }).join("");

    } catch (e) {
        console.error("Error loading match history:", e);
        container.innerHTML = "Error loading match history.";
    }
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

        (document.getElementById("avgScore") as HTMLElement).innerHTML = String(data.avgScore || 'N/A');
        (document.getElementById("losses") as HTMLElement).innerHTML = String(data.losses || 'N/A');
        (document.getElementById("total") as HTMLElement).innerHTML = String(data.total || 'N/A');
        (document.getElementById("wins") as HTMLElement).innerHTML = String(data.wins || 'N/A');

    } catch (e) {
        console.error("Error fetching stats:", e);
    }
}



private getChatPage(): Page {
  return {
    title: "PONG Game - Chat",
    content: `
      <div class="app-container">
         <div id="chat-app-container" class="w-full h-full bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl"></div>
      </div>
    `,
    init: async () => {
      console.log("💬 Chat page loaded");

      // Ensure global socket is connected
      if (!this.globalSocket || !this.globalSocket.connected) {
        console.log('🔌 Global socket not connected, connecting now...');
        await this.connectGlobalSocket();
      }

      // Cleanup previous chat instance if exists
      if (this.chatManager) {
        this.chatManager.destroy();
        this.chatManager = null;
      }

      // Initialize new chat manager with global socket
      this.chatManager = new ChatManager('chat-app-container');
      this.chatManager.init({
        id: this.user.id,
        username: this.user.username,
        email: this.user.email,
        avatar: this.user.avatar
      }, this.globalSocket).catch(err => {
        console.error('Failed to initialize chat:', err);
      });
    }
  };
}


private getFriendsPage(): Page {
  return {
    title: "PONG Game - Friends",
    content: `
      <div class="app-container">
         <div id="friends-app-container" class="w-full h-full bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl"></div>
      </div>
    `,
    init: async () => {
      console.log("👥 Friends page loaded");

      // Ensure global socket is connected
      if (!this.globalSocket || !this.globalSocket.connected) {
        console.log('🔌 Global socket not connected, connecting now...');
        await this.connectGlobalSocket();
      }

      // Cleanup previous instance
      if (this.friendsManager) {
        this.friendsManager.destroy();
        this.friendsManager = null;
      }

      // Initialize Friends Manager with global socket
      this.friendsManager = new FriendsManager('friends-app-container');
      this.friendsManager.init({
        id: this.user.id,
        username: this.user.username,
        email: this.user.email,
        avatar: this.user.avatar
      }, this.globalSocket).catch(error => {
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
