import axios, { AxiosError } from 'axios';
import crypto from 'node:crypto';

export interface User42Profile {
  id: number;
  login: string;
  email: string;
  image: {
    versions: {
      large: string;
      medium: string;
      small: string;
    };
  };
  first_name: string;
  last_name: string;
  displayname: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export class Auth42Service {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authBaseUrl = 'https://api.intra.42.fr/oauth';
  private readonly apiBaseUrl = 'https://api.intra.42.fr/v2';
  
  private stateStore = new Map<string, { timestamp: number; data?: any }>();

  constructor() 
  {
    this.clientId = process.env['FORTYTWO_UID'] as string;
    this.clientSecret = process.env['FORTYTWO_SECRET'] as string;
    const baseUrl = process.env['AUTH_SERVICE_URL'];

    if (!this.clientId || !this.clientSecret) 
      throw new Error('42 OAuth credentials not found in environment variables');
    if (!baseUrl)
      throw new Error('AUTH_SERVICE_URL not found in environment variables');

    // Ensure we have exactly one slash between base URL and path
    this.redirectUri = `${baseUrl.replace(/\/+$/, '')}/auth/42/callback`;

    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  generateAuthUrl(additionalData?: any): { url: string; state: string } 
  {
    const state = this.generateSecureState();
    
    this.stateStore.set(state, {
      timestamp: Date.now(),
      data: additionalData
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state: state,
      scope: 'public'
    });

    const url = `${this.authBaseUrl}/authorize?${params.toString()}`;
    
    return { url, state };
  }

  validateState(state: string): { valid: boolean; data?: any } 
  {
    const stateData = this.stateStore.get(state);
    
    if (!stateData) 
      return { valid: false };

    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) 
    {
      this.stateStore.delete(state);
      return { valid: false };
    }

    this.stateStore.delete(state);
    return { valid: true, data: stateData.data };
  }

  async exchangeCodeForToken(code: string): Promise<TokenResponse> 
  {
    try 
    {
      const response = await axios.post(
        `${this.authBaseUrl}/token`,
        {
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: code,
          redirect_uri: this.redirectUri
        },
        {
          headers: 
          {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status !== 200) 
        throw new Error(`Token exchange failed with status: ${response.status}`);

      return response.data as TokenResponse;
    } 
    catch (error) 
    {
      if (axios.isAxiosError(error)) 
      {
        const axiosError = error as AxiosError<any>;
        throw new Error(`42 API Error: ${axiosError.response?.data?.error_description || axiosError.message}`);
      }
      throw error;
    }
  }

  async getUserProfile(accessToken: string): Promise<User42Profile> 
  {
    try 
    {
      const response = await axios.get(
        `${this.apiBaseUrl}/me`,
        {
          headers: 
          {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.status !== 200) 
        throw new Error(`Profile fetch failed with status: ${response.status}`);

      return response.data as User42Profile;
    } 
    catch (error) 
    {
      if (axios.isAxiosError(error)) 
      {
        const axiosError = error as AxiosError<any>;
        if (axiosError.response?.status === 401) 
          throw new Error('Invalid or expired access token');
        throw new Error(`42 API Error: ${axiosError.response?.data?.error || axiosError.message}`);
      }
      throw error;
    }
  }

  async validateAccessToken(accessToken: string): Promise<boolean> 
  {
    try 
    {
      await this.getUserProfile(accessToken);
      return true;
    } 
    catch (error) 
    {
      return false;
    }
  }

  private generateSecureState(): string 
  {
    return crypto.randomBytes(32).toString('hex');
  }

  private cleanupExpiredStates(): void 
  {
    const now = Date.now();
    const expiredStates: string[] = [];

    for (const [state, data] of this.stateStore.entries()) 
    {
      if (now - data.timestamp > 15 * 60 * 1000) 
        expiredStates.push(state);
    }

    expiredStates.forEach(state => this.stateStore.delete(state));
  }

  getStateStats(): { total: number; expired: number } 
  {
    const now = Date.now();
    let expired = 0;

    for (const [, data] of this.stateStore.entries()) 
    {
      if (now - data.timestamp > 15 * 60 * 1000) 
        expired++;
    }

    return {
      total: this.stateStore.size,
      expired };
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }
}

export const auth42Service = new Auth42Service();
