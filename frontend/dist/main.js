import "./game_soket.js";
import { initgameSocket, sendMessage } from "./game_soket.js";
import { initchatSocket, onChatMessage } from "./chat_soket.js";
import { cleanupGame, addCleanupListener, setupNavigationHandlers, setupGameListeners, createLocalGameListener, createAIGameListener, createRemoteGameListener } from "./game_shared.js";
console.log("start Pong game");
let gameid = "";
let ctx = null;
let gameConfig;
let gameState;
class AppRouter {
    constructor(containerId) {
        this.contentContainer = null;
        this.isLoggedIn = false;
        this.currentUser = null;
        this.postLoginRedirect = null;
        this.user = { username: "", passworde: "", email: "", avatar: "../images/avatre/1jpg", usernametournament: "", id: 0 };
        this.allpages = [
            "/",
            "home",
            "login",
            "register",
            "dashboard",
            "dashboard/chat",
            "dashboard/friends",
            "dashboard/status",
            "dashboard/stats",
            "dashboard/settings",
            "dashboard/game",
            "dashboard/game/ai",
            "dashboard/game/local",
            "dashboard/game/remote",
            "dashboard/game/Tournament"
        ];
        this.publicPages = ["/", "home", "login", "register"];
        this.protectedPages = [
            "/",
            "dashboard",
            "dashboard/chat",
            "dashboard/friends",
            "dashboard/status",
            "dashboard/stats",
            "dashboard/settings",
            "dashboard/game",
            "dashboard/game/ai",
            "dashboard/game/local",
            "dashboard/game/remote",
            "dashboard/game/Tournament"
        ];
        this.currentPage = "home";
        const el = document.getElementById(containerId);
        if (!el)
            throw new Error(`Container #${containerId} not found`);
        this.container = el;
        this.init();
        (async () => {
            try {
                await this.checkAuth();
            }
            catch (e) {
                // ignore
            }
            const initialPath = window.location.pathname || "/";
            await this.navigateTo(initialPath, false);
        })();
    }
    async performLogin(username, password) {
        try {
            const res = await fetch("/api/auth/login", {
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
            if (usernameFromResp)
                this.currentUser = usernameFromResp;
            this.setLoggedIn(true);
            initgameSocket();
            //  initchatSocket();
            // Populate local user object from backend response
            const respUser = data.user ?? data;
            if (respUser && typeof respUser === "object") {
                this.user = {
                    username: (respUser.username ?? respUser.name ?? ""),
                    passworde: password,
                    email: (respUser.email ?? ""),
                    avatar: (respUser.avatar ?? "../images/avatre/1.jpg"),
                    usernametournament: (respUser.usernametournament ?? name),
                    id: Number(respUser.id ?? 0),
                };
                this.currentUser = (respUser.username ?? this.user.username);
                // Fix default avatar
                if (this.user.avatar === "avatar/default_avatar/default_avatar.jpg") {
                    this.user.avatar = "../images/avatre/1.jpg";
                }
                // NEW: Store user data in localStorage for persistence
                localStorage.setItem('user_data', JSON.stringify(this.user));
            }
            console.log(`User avatar: ${this.user.avatar}`);
            console.log(`Is logged in: ${this.isLoggedIn}, user: ${this.currentUser}`);
            const redirect = this.postLoginRedirect || "/dashboard";
            this.postLoginRedirect = null;
            await this.navigateTo(redirect, true);
            return true;
        }
        catch (err) {
            console.error('performLogin error', err);
            alert('Login error');
            return false;
        }
    }
    async fetchUserDetails(userId) {
        try {
            const token = localStorage.getItem('jwt_token');
            if (!token)
                return;
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
            // Update user object with backend data
            if (userData) {
                this.user = {
                    username: userData.username || this.currentUser || '',
                    passworde: "",
                    email: userData.email || '',
                    avatar: userData.avatar || '../images/avatre/1.jpg',
                    usernametournament: userData.usernametournament ?? name,
                    id: userData.id || 0
                };
                // Fix default avatar path
                if (this.user.avatar === 'avatar/default_avatar/default_avatar.jpg') {
                    this.user.avatar = '../images/avatars/1.jpg';
                }
                console.log('User details fetched:', this.user);
            }
        }
        catch (error) {
            console.error('Error fetching user details:', error);
        }
    }
    // Update checkAuth to load from localStorage
    async checkAuth() {
        try {
            const token = localStorage.getItem('jwt_token');
            if (!token) {
                this.setLoggedIn(false);
                return;
            }
            const payload = this.decodeJWT(token);
            if (!payload || this.isTokenExpired(payload)) {
                localStorage.removeItem('jwt_token');
                localStorage.removeItem('user_data'); // Clean up user data too
                this.setLoggedIn(false);
                return;
            }
            this.currentUser = payload.username || null;
            this.setLoggedIn(true);
            initgameSocket();
            // initchatSocket();
            // NEW: Load user data from localStorage
            const storedUserData = localStorage.getItem('user_data');
            if (storedUserData) {
                try {
                    this.user = JSON.parse(storedUserData);
                    console.log('Loaded user data from localStorage:', this.user);
                }
                catch (e) {
                    console.warn('Failed to parse stored user data');
                }
            }
            else if (payload.userId) {
                // Fallback: fetch from backend if not in localStorage
                await this.fetchUserDetails(payload.userId);
            }
        }
        catch (err) {
            console.warn('checkAuth failed', err);
            localStorage.removeItem('jwt_token');
            localStorage.removeItem('user_data');
            this.setLoggedIn(false);
        }
    }
    // Update logout to clear user data
    async performLogout() {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_data'); // NEW: Clear user data
        console.log("logout");
        this.setLoggedIn(false);
        this.currentUser = null;
        // Reset user object
        this.user = { username: "", passworde: "", email: "", avatar: "../images/avatars/1.jpg", usernametournament: "", id: 0 };
        this.navigateTo('home');
    }
    decodeJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join(''));
            return JSON.parse(jsonPayload);
        }
        catch (e) {
            return null;
        }
    }
    isTokenExpired(payload) {
        if (!payload.exp)
            return false;
        const now = Math.floor(Date.now() / 1000);
        return payload.exp < now;
    }
    async navigateTo(path, pushState = true) {
        let normalizedPath = path.replace(/^\/|\/$/g, "");
        console.log(this.isLoggedIn);
        // Handle root path "/" - redirect to home or dashboard based on login status
        if (normalizedPath === "") {
            if (!this.isLoggedIn) {
                console.warn(`⚠️ Not logged in, redirecting to home.`);
                this.currentPage = "home";
                this.loadPage("home");
                if (pushState)
                    history.pushState(null, "", "/home");
                return;
            }
            else {
                console.warn(`⚠️ Logged in, redirecting to dashboard.`);
                this.currentPage = "dashboard";
                this.loadPage("dashboard");
                if (pushState)
                    history.pushState(null, "", "/dashboard");
                return;
            }
        }
        // Check if the path exists in the list of all available pages
        if (!this.allpages.includes(`${normalizedPath}`)) {
            console.warn(`⚠️ Page not found: ${path}`);
            this.currentPage = "404";
            this.loadPage("404");
            return;
        }
        const isPublic = this.publicPages.includes(`/${normalizedPath}`);
        // Check for protected pages and handle login if necessary
        console.log(`page: ${normalizedPath} is logdin : ${this.isLoggedIn}`);
        if (this.protectedPages.includes(`${normalizedPath}`) && !this.isLoggedIn) {
            await this.checkAuth();
            if (!this.isLoggedIn) {
                this.postLoginRedirect = path;
                if (pushState)
                    history.pushState(null, "", "/login");
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
    setLoggedIn(value) {
        this.isLoggedIn = value;
    }
    init() {
        document.addEventListener("click", (e) => {
            const target = e.target.closest(".nav-link");
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
    loadPage(page) {
        const pageData = this.getPageData(page);
        const dashboardPages = [
            "dashboard",
            "dashboard/game",
            "dashboard/chat",
            "dashboard/friends",
            "dashboard/status",
            "dashboard/stats",
            "dashboard/settings",
        ];
        const isDashboardPage = dashboardPages.includes(page);
        // If switching between dashboard and non-dashboard layout, render full page
        if (isDashboardPage && !this.contentContainer) {
            this.renderDashboardLayout();
        }
        else if (!isDashboardPage && this.contentContainer) {
            this.contentContainer = null;
            this.container.innerHTML = pageData.content;
        }
        // Update only the content area if we have a content container
        if (this.contentContainer) {
            this.contentContainer.innerHTML = pageData.content;
            // this.updateSidebarActive(page);
        }
        else {
            this.container.innerHTML = pageData.content;
        }
        if (pageData.init) {
            pageData.init();
        }
        // Wire logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.performLogout();
            });
        }
        // Setup sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebarToggle && sidebar && overlay) {
            const toggleSidebar = () => {
                const sidebar = document.getElementById('dashboard-sidebar');
                const overlay = document.getElementById('sidebar-overlay');
                const body = document.body;
                if (sidebar) {
                    sidebar.classList.toggle('open');
                }
                if (overlay) {
                    overlay.classList.toggle('active');
                }
                body.classList.toggle('sidebar-open');
            };
            // Add event listeners with null checks
            const toggleButton = document.getElementById('sidebar-toggle');
            const overlay = document.getElementById('sidebar-overlay');
            if (toggleButton) {
                toggleButton.addEventListener('click', toggleSidebar);
            }
            if (overlay) {
                overlay.addEventListener('click', toggleSidebar);
            }
            // Close sidebar when clicking nav links (optional)
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach((link) => {
                link.addEventListener('click', () => {
                    if (window.innerWidth <= 1024) {
                        toggleSidebar();
                    }
                });
            });
        }
        console.log(`📄 Loaded page: ${page}`);
    }
    // Render the dashboard layout once, then only update content
    renderDashboardLayout() {
        console.log(`user info :`, this.user);
        this.container.innerHTML = `
<div class="dashboard-wrapper">

      <!-- Sidebar Overlay (Mobile) -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- Sidebar Brand -->
      <div class="sidebar-brand">
        <img src="../images/logo.svg" alt="PONG Logo">
        <h2>PONG Game</h2>
      </div>

      <!-- User Avatar Section (Top Right) -->
      <div class="sidebar-username">
        <div class="user-avatar-container">
          <img class="user-avatar" src="${this.user.avatar}">
          <span class="header-username">${this.user.username || "Player"}</span>
        </div>
        <button id="logout-btn" class="logout-btn">🚪 Logout</button>
      </div>

      <!-- Sidebar (Fixed) -->
      <aside class="sidebar-card" id="dashboard-sidebar">
        <nav class="sidebar-nav">
          <a href="/dashboard" class="nav-link nav-links" data-page="dashboard" style="display: flex; align-items: center;">
            <img src="../images/dashboard.svg" alt="Dashboard" width="24" height="24" style="margin-right: 8px;">
            Dashboard
          </a>
          <a href="/dashboard/game" class="nav-link nav-links" data-page="game" style="display: flex; align-items: center;">
            <img src="../images/game.svg" alt="Game" width="24" height="24" style="margin-right: 8px;">
            Game
          </a>
          <a href="/dashboard/chat" class="nav-link nav-links" data-page="chat" style="display: flex; align-items: center;">
            <img src="../images/chat.svg" alt="Chat" width="24" height="24" style="margin-right: 8px;">
            Chat
          </a>
          <a href="/dashboard/friends" class="nav-link nav-links" data-page="friends" style="display: flex; align-items: center;">
            <img src="../images/friends.svg" alt="Friends" width="24" height="24" style="margin-right: 8px;">
            Friends
          </a>
          <a href="/dashboard/status" class="nav-link nav-links" data-page="status" style="display: flex; align-items: center;">
            <img src="../images/status.svg" alt="Status" width="24" height="24" style="margin-right: 8px;">
            Status
          </a>
          <a href="/dashboard/stats" class="nav-link nav-links" data-page="stats" style="display: flex; align-items: center;">
            <img src="../images/stats.svg" alt="Stats" width="24" height="24" style="margin-right: 8px;">
            Stats
          </a>
          <a href="/dashboard/settings" class="nav-link nav-links" data-page="settings" style="display: flex; align-items: center;">
            <img src="../images/settings.svg" alt="Settings" width="24" height="24" style="margin-right: 8px;">
            Settings
          </a>
        </nav>
      </aside>

      <!-- Main Content Area (ONLY ONE) -->
      <main class="dashboard-content" id="dashboard-main-content">
        <div class="content-wrapper">
          <!-- Content will be injected here -->
        </div>
      </main>
    </div>
  `;
        this.contentContainer = document.getElementById('dashboard-main-content');
        // Setup the logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.performLogout();
            });
        }
        // Add event listener to toggle user dropdown menu
        const userMenuToggle = document.getElementById('user-menu-toggle');
        const userDropdown = document.getElementById('user-dropdown');
        if (userMenuToggle && userDropdown) {
            userMenuToggle.addEventListener('click', () => {
                userDropdown.classList.toggle('show');
            });
        }
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (userDropdown && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
        console.log(`📄 Loaded dashboard layout`);
    }
    getPageData(page) {
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
            case "dashboard/stats":
                return this.getStatsPage();
            case "dashboard/chat":
                return this.getChatPage();
            case "dashboard/friends":
                return this.getFriendsPage();
            case "dashboard/status":
                return this.getStatusPage();
            case "dashboard/game/ai":
                return this.getaipage();
            case "dashboard/game/local":
                return this.getlocalpage();
            // case "dashboard/game/Tournament":
            //   return this.gettournamentpage();
            case "dashboard/game/remote":
                return this.getremotepage();
            default:
                return this.get404Page();
        }
    }
    // ==============================
    // PAGES - Now return only content, not full layout
    // ==============================
    getHomePage() {
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
    getGamePage() {
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
            <a href="dashboard/game/tournament" class="mode-btn">Play</a>
          </div>
        </div>
      </section>
    `,
            init: () => console.log("🎮 Game mode selection loaded"),
        };
    }
    getremotepage() {
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
            <img src="${this.user.avatar || '../images/avatars/1.jpg'}" alt="Player" style="width:120px;height:120px;border-radius:50%;border:4px solid #10b981;box-shadow:0 4px 12px rgba(16,185,129,0.3);" onerror="this.src='../images/avatars/1.jpg'">
            <div style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#e5e7eb;">${this.currentUser || 'Player'}</div>
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
            <img id="opponent-avatar" src="../images/avatars/unknown.jpg" alt="Opponent" style="width:120px;height:120px;border-radius:50%;border:4px solid #6b7280;opacity:0.5;box-shadow:0 4px 12px rgba(107,114,128,0.3);" onerror="this.src='../images/avatars/2.jpg'">
            <div id="opponent-name" style="margin-top:1rem; font-weight:700; font-size:1.1rem; color:#9ca3af;">Waiting...</div>
            <div style="font-size:0.875rem; color:#6b7280; margin-top:0.25rem;">Searching...</div>
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
                setupNavigationHandlers(this.user.id, "back-button-remote", (path) => this.loadPage(path));
                const startButton = document.getElementById('start-remote-game');
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
                setupGameListeners(remoteListener, 'remote-score', this.user.id, (path) => this.loadPage(path), false, true);
            }
        };
    }
    getlocalpage() {
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
                setupNavigationHandlers(this.user.id, "back-button", (path) => this.loadPage(path));
                const startButton = document.getElementById('start-local-game');
                if (startButton) {
                    const startHandler = () => {
                        sendMessage("join_local", {});
                    };
                    startButton.addEventListener('click', startHandler);
                    addCleanupListener(() => startButton.removeEventListener('click', startHandler));
                }
                const localListener = createLocalGameListener(this.user.id);
                setupGameListeners(localListener, 'local-score', this.user.id, (path) => this.loadPage(path), false, false);
            }
        };
    }
    getaipage() {
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
            <div style="margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between; padding:1rem; background:#1f2937; border-radius:0.5rem;">
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
                setupNavigationHandlers(this.user.id, "back-button-ai", (path) => this.loadPage(path));
                const startButton = document.getElementById('start-ai-game');
                const difficultySelect = document.getElementById('ai-difficulty');
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
                setupGameListeners(aiListener, 'ai-score', this.user.id, (path) => this.loadPage(path), true, false);
            }
        };
    }
    getLoginPage() {
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
                        const username = document.getElementById("username").value;
                        const password = document.getElementById("password").value;
                        (async () => {
                            await this.performLogin(username, password);
                        })();
                    });
                }
            },
        };
    }
    getRegisterPage() {
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
      <input type="usernameTournament" id="usernameTournament" placeholder="usernameTournament" class="input-field">
      <button type="submit" class="submit-btn">Register</button>
    </form>
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
                const form = document.getElementById('register-form');
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const username = document.getElementById('new-username').value;
                        const email = document.getElementById('email').value;
                        const password = document.getElementById('new-password').value;
                        const usernameTournament = document.getElementById('usernameTournament').value;
                        try {
                            const res = await fetch("/api/auth/register", {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ username, email, password, usernameTournament }),
                            });
                            if (!res.ok) {
                                const err = await res.json().catch(() => ({ error: 'Register failed' }));
                                alert(err.error || 'Register failed');
                                return;
                            }
                            await this.performLogin(username, password);
                        }
                        catch (err) {
                            console.error(err);
                            alert('Registration error');
                        }
                    });
                }
            },
        };
    }
    get404Page() {
        return {
            title: "404 - Page Not Found",
            content: `
        <section class="max-w-lg mx-auto px-6 py-20 text-center">
          <h1 class="text-4xl font-bold text-red-600 mb-6">404</h1>
          <p class="text-gray-600 mb-6">Oops! The page you are looking for does not exist.</p>
          <a href="/home" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold nav-links">Go Home</a>
        </section>
      `,
        };
    }
    async updateUserProfile(updates) {
        // Ensure updates carry an id (fallback to current user id)
        const u = updates;
        if ((!u.id || u.id === 0) && this.user && this.user.id) {
            u.id = this.user.id;
        }
        // If there's no JWT but we have stored credentials, try to re-login to obtain a token
        const existingToken = localStorage.getItem('jwt_token');
        const usernameForLogin = (u.name || u.username || this.currentUser || this.user.username);
        const passwordForLogin = (this.user && this.user.passworde) ? this.user.passworde : undefined;
        if (!existingToken && usernameForLogin && passwordForLogin) {
            console.log('No JWT found — attempting to re-login to obtain a fresh token');
            try {
                await this.performLogin(usernameForLogin, passwordForLogin);
            }
            catch (err) {
                console.warn('Re-login attempt failed', err);
                // proceed; the request below will fail if there's truly no token
            }
        }
        try {
            const token = localStorage.getItem('jwt_token');
            if (!token) {
                alert('Please log in first');
                return false;
            }
            const response = await fetch('/api/auth/user/update', {
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
            // ✅ Store new token if backend sends it
            console.log("try to JWT updated");
            if (data.token) {
                localStorage.setItem('jwt_token', data.token);
            }
            // ✅ Update user info in localStorage
            if (data.user) {
                localStorage.setItem('user_data', JSON.stringify(data.user));
                // Update the current app state
                this.user = data.user;
                console.log(`updated user: `, this.user);
                this.currentUser = data.user.username;
                alert('Profile updated successfully!');
            }
            // ✅ Optionally refresh view to show changes
            await this.navigateTo(this.currentPage, false);
            return true;
        }
        catch (error) {
            console.error('Update profile error:', error);
            alert('An error occurred while updating profile');
            return false;
        }
    }
    // Updated Settings Page with functional form
    getSettingsPage() {
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
    Choose Your Avatar
  </label>

<div id="avatar-options">
  <img src="../images/avatars/1.jpg" alt="Avatar 1" class="avatar-option" data-value="../images/avatars/1.jpg">
  <img src="../images/avatars/2.jpg" alt="Avatar 2" class="avatar-option" data-value="../images/avatars/2.jpg">
  <img src="../images/avatars/3.jpg" alt="Avatar 3" class="avatar-option" data-value="../images/avatars/3.jpg">
  <img src="../images/avatars/4.jpg" alt="Avatar 4" class="avatar-option" data-value="../images/avatars/4.jpg">
</div>

  <!-- Hidden field to send selected avatar path -->
  <input type="hidden" id="settings-avatar" name="avatar" value="${this.user.avatar || ''}" />

  <small style="color: #6b7280; font-size: 0.875rem;">
    Current:
    <img src="${this.user.avatar || './images/avatars/avatar1.png'}"
         alt="Current Avatar"
         style="width: 40px; height: 40px; border-radius: 50%; vertical-align: middle; margin-left: 0.5rem;">
  </small>
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
                const form = document.getElementById('settings-form');
                const statusDiv = document.getElementById('settings-status');
                const avatarOptions = document.querySelectorAll(".avatar-option");
                const avatarInput = document.getElementById("settings-avatar");
                const profileAvatar = document.querySelector('.user-avatar'); // main avatar in UI
                // --- Avatar selection logic ---
                if (avatarOptions && avatarInput) {
                    avatarOptions.forEach(option => {
                        option.addEventListener("click", () => {
                            // Remove selection from others
                            avatarOptions.forEach(o => o.classList.remove("selected"));
                            // Mark clicked one as selected
                            option.classList.add("selected");
                            // Update hidden input value
                            avatarInput.value = option.dataset.value || "";
                            // Optionally update live avatar preview
                            if (profileAvatar)
                                profileAvatar.src = avatarInput.value;
                        });
                    });
                    // Pre-select current avatar
                    const currentAvatar = avatarInput.value;
                    avatarOptions.forEach(o => {
                        if (o.dataset.value === currentAvatar)
                            o.classList.add("selected");
                    });
                }
                // --- Form submission logic ---
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        // Get form values
                        const username = document.getElementById('settings-username').value.trim();
                        const email = document.getElementById('settings-email').value.trim();
                        const tournament = document.getElementById('settings-tournament').value.trim();
                        const avatar = avatarInput?.value.trim() || "";
                        // Build update object (only include changed fields)
                        const updates = {};
                        if (username && username !== this.currentUser)
                            updates.username = username;
                        if (email && email !== this.user.email)
                            updates.email = email;
                        if (tournament)
                            updates.usernameTournament = tournament;
                        if (avatar && avatar !== this.user.avatar)
                            updates.avatar = avatar;
                        // Check if any changes were made
                        if (Object.keys(updates).length === 0) {
                            statusDiv.style.display = 'block';
                            statusDiv.style.background = '#fef3c7';
                            statusDiv.style.color = '#92400e';
                            statusDiv.textContent = '⚠️ No changes detected';
                            return;
                        }
                        // Show loading state
                        statusDiv.style.display = 'block';
                        statusDiv.style.background = '#dbeafe';
                        statusDiv.style.color = '#1e40af';
                        statusDiv.textContent = '⏳ Updating profile...';
                        // Call update method
                        const success = await this.updateUserProfile(updates);
                        if (success) {
                            // Update local state
                            if (updates.username)
                                this.currentUser = updates.username;
                            if (updates.email)
                                this.user.email = updates.email;
                            if (updates.usernameTournament)
                                this.user.usernametournament = updates.usernameTournament;
                            if (updates.avatar) {
                                this.user.avatar = updates.avatar;
                                if (profileAvatar)
                                    profileAvatar.src = updates.avatar; // update avatar in UI
                            }
                            statusDiv.style.background = '#d1fae5';
                            statusDiv.style.color = '#065f46';
                            statusDiv.textContent = '✅ Profile updated successfully!';
                        }
                        else {
                            statusDiv.style.background = '#fee2e2';
                            statusDiv.style.color = '#991b1b';
                            statusDiv.textContent = '❌ Failed to update profile. Please try again.';
                        }
                    });
                }
            }
        };
    }
    getDashboardPage() {
        return {
            title: "PONG Game - Dashboard",
            content: `
        <div class="content-card">
          <h2>Welcome back, ${this.user.username || 'Player'}! 👋</h2>
          <p>Ready to play some Pong? Check out your stats below.</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <h3>Games Played</h3>
            <div class="stat-value">42</div>
          </div>
          <div class="stat-card">
            <h3>Win Rate</h3>
            <div class="stat-value">68%</div>
          </div>
          <div class="stat-card">
            <h3>Current Rank</h3>
            <div class="stat-value">#15</div>
          </div>
          <div class="stat-card">
            <h3>Online Friends</h3>
            <div class="stat-value">5</div>
          </div>
        </div>

        <div class="content-card">
          <h2>Recent Activity</h2>
          <p>No recent games. Start playing to see your activity here!</p>
        </div>
      `,
            init: () => console.log("📊 Dashboard page loaded"),
        };
    }
    getStatsPage() {
        return {
            title: "PONG Game - Stats",
            content: `
      <div class="content-card">
        <h2>📈 Your Statistics</h2>
        <div class="stats-grid" style="margin-top: 1.5rem;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 1.5rem; border-radius: 0.75rem;">
            <h3 style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Wins</h3>
            <div style="font-size: 2rem; font-weight: 700;">28</div>
          </div>
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 1.5rem; border-radius: 0.75rem;">
            <h3 style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Losses</h3>
            <div style="font-size: 2rem; font-weight: 700;">14</div>
          </div>
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 1.5rem; border-radius: 0.75rem;">
            <h3 style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Best Streak</h3>
            <div style="font-size: 2rem; font-weight: 700;">7</div>
          </div>
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 1.5rem; border-radius: 0.75rem;">
            <h3 style="font-size: 0.875rem; opacity: 0.9; margin-bottom: 0.5rem;">Avg Score</h3>
            <div style="font-size: 2rem; font-weight: 700;">4.2</div>
          </div>
        </div>
      </div>
    `,
            init: () => console.log("📈 Stats page loaded"),
        };
    }
    getChatPage() {
        return {
            title: "PONG Game - Chat",
            content: `
<div class="content-card flex h-[80vh] gap-4">

  <!-- SIDEBAR: USER LIST -->
  <div class="w-64 bg-gray-900 text-gray-100 rounded-xl p-4 flex flex-col">

    <h2 class="text-xl font-bold mb-4">💬 Chats</h2>

    <!-- Search Bar -->
    <input
      id="chat-search"
      class="w-full p-2 rounded-md bg-gray-800 text-gray-200 mb-3"
      placeholder="Search user..."
    />

    <!-- USER LIST -->
    <div id="chat-user-list" class="flex-1 overflow-y-auto space-y-2">

      <!-- Example user item (dynamic in JS) -->
      <!--
      <div class="p-2 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700"
           data-user-id="546479405">
        <div class="flex items-center gap-2">
          <img src="../images/avatars/1.jpg" class="w-10 h-10 rounded-full">
          <div>
            <div class="font-semibold">ybahij</div>
            <div class="text-xs text-gray-400">Online</div>
          </div>
        </div>
      </div>
      -->

    </div>

  </div>

  <!-- MAIN CHAT WINDOW -->
  <div class="flex-1 bg-white rounded-xl p-4 flex flex-col">

    <!-- Chat Header -->
    <div id="chat-header" class="flex items-center justify-between mb-4 border-b pb-3 hidden">
      <div class="flex items-center gap-3">
        <img id="chat-user-avatar" class="w-12 h-12 rounded-full" src="">
        <div>
          <div id="chat-username" class="text-lg font-semibold"></div>
          <button id="chat-view-profile" class="text-sm text-blue-600 hover:underline">
            View Profile
          </button>
        </div>
      </div>

      <div class="flex gap-2">
        <button id="chat-block-btn" class="px-3 py-1 bg-red-500 text-white rounded-md text-sm">
          Block
        </button>

        <button id="chat-invite-btn" class="px-3 py-1 bg-green-600 text-white rounded-md text-sm">
          Invite to Game
        </button>
      </div>
    </div>

    <!-- Chat Messages Area -->
    <div id="chat-messages"
         class="flex-1 overflow-y-auto bg-gray-100 p-4 rounded-md space-y-3">
    </div>

    <!-- Message Input -->
    <div id="chat-message-box" class="flex gap-2 mt-4 hidden">
      <input id="chat-input"
             class="flex-1 p-3 rounded-md border"
             placeholder="Type your message..."/>
      <button id="chat-send"
              class="px-4 py-2 bg-blue-600 text-white rounded-md">
        Send
      </button>
    </div>

  </div>
</div>

    `,
            init: () => {
                console.log("💬 Chat page loaded");
                // Initialize WebSocket only ONCE
                const socket = initchatSocket();
                // UI references
                const userList = document.getElementById("chat-user-list");
                const chatHeader = document.getElementById("chat-header");
                const messageBox = document.getElementById("chat-messages");
                const chatInput = document.getElementById("chat-input");
                const sendBtn = document.getElementById("chat-send");
                const messageSection = document.getElementById("chat-message-box");
                const usernameLabel = document.getElementById("chat-username");
                const avatarImg = document.getElementById("chat-user-avatar");
                let currentChatUser = null; // Active DM target
                // -------------------------------------------------------
                // 1️⃣ FETCH USER LIST (from your backend /api/users/all)
                // -------------------------------------------------------
                fetch("/api/users/all", {
                    headers: { Authorization: `Bearer ${localStorage.getItem("jwt_token")}` },
                })
                    .then(res => res.json())
                    .then(users => {
                    userList.innerHTML = "";
                    console.log('users:', users);
                    console.log('Is array?', Array.isArray(users));
                    users.forEach((user) => {
                        if (user.id === JSON.parse(localStorage.getItem("user")).id)
                            return; // skip self
                        const div = document.createElement("div");
                        div.className = "p-2 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700";
                        div.dataset.userId = user.id;
                        div.innerHTML = `
          <div class="flex items-center gap-2">
            <img src="${user.avatar}" class="w-10 h-10 rounded-full" />
            <div>
              <div class="font-semibold">${user.username}</div>
              <div class="text-xs text-gray-400">Online</div>
            </div>
          </div>
        `;
                        // Click to open DM
                        div.onclick = () => {
                            currentChatUser = user;
                            // update header UI
                            chatHeader.classList.remove("hidden");
                            messageSection.classList.remove("hidden");
                            usernameLabel.textContent = user.username;
                            avatarImg.src = user.avatar;
                            // clear chat display & load conversation
                            messageBox.innerHTML = "";
                            loadConversation(user.id);
                        };
                        userList.appendChild(div);
                    });
                });
                // -------------------------------------------------------
                // 2️⃣ SEND MESSAGE
                // -------------------------------------------------------
                sendBtn.onclick = () => {
                    if (!chatInput.value.trim() || !currentChatUser)
                        return;
                    const message = {
                        type: "dm",
                        to: currentChatUser.id,
                        message: chatInput.value,
                    };
                    socket.send(JSON.stringify(message));
                    // Add my own message to UI
                    appendMessage("me", chatInput.value);
                    chatInput.value = "";
                };
                // -------------------------------------------------------
                // 3️⃣ RECEIVE MESSAGE
                // -------------------------------------------------------
                onChatMessage((msg) => {
                    if (msg.type === "dm") {
                        // only show messages from the currently opened chat
                        if (!currentChatUser || msg.from !== currentChatUser.id)
                            return;
                        appendMessage("them", msg.message);
                    }
                });
                // -------------------------------------------------------
                // Helper: Append Message to UI
                // -------------------------------------------------------
                function appendMessage(sender, text) {
                    const bubble = document.createElement("div");
                    bubble.className =
                        sender === "me"
                            ? "text-right"
                            : "text-left";
                    bubble.innerHTML = `
      <div class="inline-block px-3 py-2 rounded-lg mb-1 ${sender === 'me'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-300 text-black'}">
        ${text}
      </div>
    `;
                    messageBox.appendChild(bubble);
                    messageBox.scrollTop = messageBox.scrollHeight;
                }
                // -------------------------------------------------------
                // Load conversation history (optional)
                // -------------------------------------------------------
                function loadConversation(userId) {
                    fetch(`/api/chat/history/${userId}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("jwt_token")}` },
                    })
                        .then(res => res.json())
                        .then(messages => {
                        messages.forEach((msg) => {
                            appendMessage(msg.fromMe ? "me" : "them", msg.message);
                        });
                    });
                }
            }
        };
    }
    getFriendsPage() {
        return {
            title: "PONG Game - Friends",
            content: `
      <div class="content-card">
        <h2>👥 Friends</h2>
        <div style="margin-top: 1rem;">
          <div style="display: flex; align-items: center; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 0.5rem;">
            <div style="width: 40px; height: 40px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 1rem;">JD</div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #111827;">John Doe</div>
              <div style="font-size: 0.875rem; color: #10b981;">● Online</div>
            </div>
            <button style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Challenge</button>
          </div>
        </div>
      </div>
    `,
            init: () => console.log("👥 Friends page loaded"),
        };
    }
    getStatusPage() {
        return {
            title: "PONG Game - Status",
            content: `
      <div class="content-card">
        <h2>📊 System Status</h2>
        <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem;">
            <span style="color: #374151; font-weight: 500;">Server Status</span>
            <span style="color: #10b981; font-weight: 600;">● Online</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem;">
            <span style="color: #374151; font-weight: 500;">Active Players</span>
            <span style="color: #111827; font-weight: 600;">127</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem;">
            <span style="color: #374151; font-weight: 500;">Active Games</span>
            <span style="color: #111827; font-weight: 600;">34</span>
          </div>
        </div>
      </div>
    `,
            init: () => console.log("📊 Status page loaded"),
        };
    }
}
// ==========================
// Initialize App
// ==========================
document.addEventListener("DOMContentLoaded", () => {
    new AppRouter("app-container");
});
