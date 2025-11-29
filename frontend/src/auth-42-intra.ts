export interface User42Data {
  id: number;
  username: string;
  email: string;
  avatar: string;
  usernameTournament?: string;
  is_42_user: boolean;
  provider: string;
}

export interface Auth42Response {
  success: boolean;
  user: User42Data;
  token: string;
  expiresIn: number;
}

export class Auth42Handler {
  private static readonly AUTH_ENDPOINT = '/api/auth/42';
  private static readonly CALLBACK_ENDPOINT = '/api/auth/42/callback';
  private static readonly STATUS_ENDPOINT = '/api/auth/42/status';

  static initiateLogin(redirectUrl?: string): void {
    const params = new URLSearchParams();
    if (redirectUrl) {
      params.append('redirect_url', redirectUrl);
    }

    const url = `${this.AUTH_ENDPOINT}?${params.toString()}`;
    console.log('🚀 Redirecting to 42 intra OAuth:', url);
    
    window.location.href = url;
  }

  static async handleCallback(): Promise<Auth42Response | null> {
    const urlParams = new URLSearchParams(window.location.search);
    
    const token = urlParams.get('token');
    const userStr = urlParams.get('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr)) as User42Data;
        
        localStorage.setItem('jwt_token', token);
        localStorage.setItem('user_data', JSON.stringify(user));

        console.log('✅ 42 intra authentication successful!');
        console.log('   User:', user.username);
        console.log('   Avatar:', user.avatar);

        window.history.replaceState({}, document.title, window.location.pathname);

        return {
          success: true,
          user,
          token,
          expiresIn: 7 * 24 * 60 * 60
        };
      } catch (error) {
        console.error('❌ Failed to parse OAuth callback data:', error);
        return null;
      }
    }

    const error = urlParams.get('error');
    if (error) {
      console.error('❌ OAuth error:', error);
      const errorDescription = urlParams.get('error_description');
      alert(`Login failed: ${errorDescription || error}`);
      return null;
    }

    return null;
  }

  static async checkAuthStatus(): Promise<boolean> {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) return false;

      const response = await fetch(this.STATUS_ENDPOINT, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_data');
        return false;
      }

      const data = await response.json();
      return data.authenticated === true;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return false;
    }
  }

  static getCurrentUser(): User42Data | null {
    try {
      const userStr = localStorage.getItem('user_data');
      if (!userStr) return null;
      
      return JSON.parse(userStr) as User42Data;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  static getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  static async logout(): Promise<void> {
    try {
      const token = this.getToken();
      if (token) {
        await fetch('/api/auth/42/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user_data');
      console.log('🚪 Logged out from 42 intra');
    }
  }
}

export function create42IntraButton(
  container: HTMLElement,
  options: {
    text?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration>;
    onClick?: () => void;
  } = {}
): HTMLButtonElement {
  const button = document.createElement('button');
  
  button.textContent = options.text || '🎓 Sign in with 42 intra';
  button.className = options.className || 'btn-42-intra';
  
  if (options.style) {
    Object.assign(button.style, options.style);
  } else {
    Object.assign(button.style, {
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #00babc 0%, #00d9ff 100%)',
      color: 'white',
      border: 'none',
      borderRadius: '0.5rem',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 12px rgba(0, 186, 188, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      width: '100%',
      marginTop: '1rem'
    });
  }

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 6px 20px rgba(0, 186, 188, 0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 4px 12px rgba(0, 186, 188, 0.3)';
  });

  button.addEventListener('click', () => {
    if (options.onClick) {
      options.onClick();
    } else {
      Auth42Handler.initiateLogin('/dashboard');
    }
  });

  container.appendChild(button);
  return button;
}

export async function initAuth42(): Promise<Auth42Response | null> {
  console.log('🔍 Checking for 42 OAuth callback...');
  const authResult = await Auth42Handler.handleCallback();
  
  if (authResult) {
    console.log('✅ 42 OAuth callback handled successfully');
    console.log('   Redirecting to dashboard...');
  }
  
  return authResult;
}

export default Auth42Handler;
