console.log("start Pong game");

interface Page {
  title: string;
  content: string;
  init?(): void;
}

class AppRouter {
  private currentPage: string;
  private container: HTMLElement;
  private contentContainer: HTMLElement | null = null;
  private isLoggedIn: boolean = false;
  private currentUser: string | null = null;
  private postLoginRedirect: string | null = null;
  private allpages = [
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
    "dashboard/game"
  ]
  private publicPages = ["/","home", "login", "register"];
  private protectedPages = [
    "/",
    "dashboard",
    "dashboard/chat",
    "dashboard/friends",
    "dashboard/status",
    "dashboard/stats",
    "dashboard/settings",
    "dashboard/game",
  ];

constructor(containerId: string) {
  this.currentPage = "home";
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Container #${containerId} not found`);
  this.container = el;
  this.init();

  (async () => {
    try {
      await this.checkAuth();
    } catch (e) {
      // ignore
    }
    const initialPath = window.location.pathname || "/";
    await this.navigateTo(initialPath, false);
  })();
}

private async performLogin(username: string, password: string): Promise<boolean> {
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
    if (usernameFromResp) this.currentUser = usernameFromResp;

    this.setLoggedIn(true);
    console.log(`is it logedin: ${this.isLoggedIn}, user ${this.currentUser}`);
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


public async performLogout(): Promise<void> {

  localStorage.removeItem('jwt_token');
  console.log("logout");
  this.setLoggedIn(false);
  this.currentUser = null;
  this.navigateTo('home');
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
      this.setLoggedIn(false);
      return;
    }

    this.currentUser = payload.username || null;
    this.setLoggedIn(true);
  } catch (err) {
    console.warn('checkAuth failed', err);
    localStorage.removeItem('jwt_token');
    this.setLoggedIn(false);
  }
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
  // Handle root path "/" - redirect to home or dashboard based on login status
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
    console.log("here2");
    if (!this.isLoggedIn) {
      this.postLoginRedirect = path;
      if (pushState) history.pushState(null, "", "/login");
      this.currentPage = "login";
      this.loadPage("login");
      return;
    }
  }

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
      "dashboard/status",
      "dashboard/stats",
      "dashboard/settings",
    ];

    const isDashboardPage = dashboardPages.includes(page);

    // If switching between dashboard and non-dashboard layout, render full page
    if (isDashboardPage && !this.contentContainer) {
      this.renderDashboardLayout();
    } else if (!isDashboardPage && this.contentContainer) {
      this.contentContainer = null;
      this.container.innerHTML = pageData.content;
    }

    // Update only the content area if we have a content container
    if (this.contentContainer) {
      this.contentContainer.innerHTML = pageData.content;
      // this.updateSidebarActive(page);
    } else {
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
    const toggleSidebar = (): void => {
        const sidebar: HTMLElement | null = document.getElementById('dashboard-sidebar');
        const overlay: HTMLElement | null = document.getElementById('sidebar-overlay');
        const body: HTMLElement = document.body;

        if (sidebar) {
            sidebar.classList.toggle('open');
        }
        if (overlay) {
            overlay.classList.toggle('active');
        }
        body.classList.toggle('sidebar-open');
    };

    // Add event listeners with null checks
    const toggleButton: HTMLElement | null = document.getElementById('sidebar-toggle');
    const overlay: HTMLElement | null = document.getElementById('sidebar-overlay');

    if (toggleButton) {
        toggleButton.addEventListener('click', toggleSidebar);
    }

    if (overlay) {
        overlay.addEventListener('click', toggleSidebar);
    }

    // Close sidebar when clicking nav links (optional)
    const navLinks: NodeListOf<Element> = document.querySelectorAll('.nav-link');
    navLinks.forEach((link: Element) => {
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
private renderDashboardLayout(): void {
  this.container.innerHTML = `


 <div class="dashboard-wrapper">

      <!-- Sidebar Overlay (Mobile) -->
      <div class="sidebar-overlay" id="sidebar-overlay"></div>

      <!-- Sidebar Brand -->
        <div class="sidebar-brand">
          <img src="../images/logo.svg" alt="PONG Logo">
          <h2>PONG Game</h2>
        </div>
        <div class="sidebar-username">
          <span class="header-username">${this.currentUser || "Player"}</span>
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
    if (userDropdown && !userDropdown.contains(e.target as Node)) {
      userDropdown.classList.remove('show');
    }
  });

  console.log(`📄 Loaded dashboard layout`);
}


  private getPageData(page: string): Page {
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
      default:
        return this.get404Page();
    }
  }

  // ==============================
  // PAGES - Now return only content, not full layout
  // ==============================

private getHomePage(): Page {
  return {
    title: "PONG Game - Home",
    content: `
<nav class="pong-navbar">
  <div class="navbar-container">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="logo-section nav-Links">
        <img src="./images/logo.svg" alt="Pong Logo" class="logo-img">
        <span class="logo-text">PONG Game</span>
      </div>

      <!-- Navigation Links -->
      <div class="nav-links">
        <a href="/login" class="login-link nav-links nav-link">
          <img src="./images/login.svg" alt="Login Icon" class="login-icon">
          <span class="login-text">Login</span>
        </a>
        <a href="/register" class="register-btn nav-links nav-link">
          Register
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

private getGamePage(): Page {
  return {
    title: "PONG Game - Play",
    content: `
      <section class="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12 bg-gray-900 rounded-2xl shadow-lg max-w-3xl mx-auto">
        <h1 class="text-3xl md:text-4xl font-bold text-greenLight mb-6">🏓 Pong Game</h1>

        <canvas
          id="pong-canvas"
          width="700"
          height="420"
          class="w-full max-w-xl border-4 border-greenLight rounded-xl shadow-2xl bg-gray-800 mb-6"
        ></canvas>

        <div class="flex justify-center space-x-4 mb-6">
          <button
            id="start-btn"
            class="bg-greenLight text-gray-900 px-6 py-2 rounded-lg hover:bg-greenDark font-semibold transition-colors duration-300"
          >
            Start
          </button>
          <button
            id="reset-btn"
            class="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-600 font-semibold transition-colors duration-300"
          >
            Reset
          </button>
        </div>

        <p class="text-gray-300 text-sm md:text-base text-center">
          Use <b>W/S</b> or <b>↑/↓</b> to move your paddle. First to 5 wins!
        </p>
      </section>
    `,
    init: () => console.log("🎮 Game page loaded"),
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
      <div class="logo-section nav-links">
        <img src="./images/logo.svg" alt="Pong Logo" class="logo-img">
        <span class="logo-text">PONG Game</span>
      </div>

      <!-- Navigation Links -->
      <div class="nav-links">
        <a href="/register" class="register-btn nav-link">
          Register
        </a>
      </div>
    </div>
  </div>
</nav>
<section class="login-section">
  <div class="login-card">
    <h1>Welcome Back</h1>
    <p>Sign in to your account</p>

    <form id="login-form">
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
      <div class="logo-section nav-links">
        <img src="./images/logo.svg" alt="Pong Logo" class="logo-img">
        <span class="logo-text">PONG Game</span>
      </div>

      <!-- Navigation Links -->
      <div class="nav-links">
        <a href="/login" class="login-link nav-link">
          <img src="./images/login.svg" alt="Login Icon" class="login-icon">
          <span class="login-text">Login</span>
        </a>
      </div>
    </div>
  </div>
</nav>
<section class="register-section">
  <div class="register-card">
    <h1>Create Account</h1>
    <form id="register-form">
      <input type="text" id="new-username" placeholder="Username" required>
      <input type="email" id="email" placeholder="Email" required>
      <input type="password" id="new-password" placeholder="Password" required>
      <input type="usernameTournament" id="usernameTournament" placeholder="usernameTournament">
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
            const username = (document.getElementById('new-username') as HTMLInputElement).value;
            const email = (document.getElementById('email') as HTMLInputElement).value;
            const password = (document.getElementById('new-password') as HTMLInputElement).value;
            const usernameTournament = (document.getElementById('usernameTournament') as HTMLInputElement).value;
            try {
              const res = await fetch("/api/auth/register", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password,usernameTournament }),
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
          <a href="/home" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold nav-links">Go Home</a>
        </section>
      `,
    };
  }

    private getSettingsPage(): Page {
    return {
      title: "PONG Game - Settings",
      content: `
        <div class="content-card">
          <h2>⚙️ Settings</h2>
          <div style="margin-top: 1.5rem;">
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Username</label>
              <input type="text" value="${this.currentUser || 'Player'}" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; color: #111827;" />
            </div>
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 0.5rem;">Email</label>
              <input type="email" placeholder="player@example.com" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 0.5rem; color: #111827;" />
            </div>
            <button style="padding: 0.75rem 1.5rem; background: #10b981; color: white; border: none; border-radius: 0.5rem; font-weight: 600; cursor: pointer;">
              Save Changes
            </button>
          </div>
        </div>
      `,
      init: () => console.log("⚙️ Settings page loaded"),
    };
  }

  private getDashboardPage(): Page {
    return {
      title: "PONG Game - Dashboard",
      content: `
        <div class="content-card">
          <h2>Welcome back, ${this.currentUser || 'Player'}! 👋</h2>
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


private getStatsPage(): Page {
  return {
    title: "PONG Game - Stats",
    content:  `
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

private getChatPage(): Page {
  return {
    title: "PONG Game - Chat",
    content:  `
      <div class="content-card">
        <h2>💬 Chat</h2>
        <div style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-top: 1rem;">
          <p style="color: #6b7280;">Chat functionality coming soon! Connect with friends and send messages.</p>
        </div>
      </div>
    `,
    init: () => console.log("💬 Chat page loaded"),
  };
}

private getFriendsPage(): Page {
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

private getStatusPage(): Page {
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
