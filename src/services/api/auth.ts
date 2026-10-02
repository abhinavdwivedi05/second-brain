import { apiClient, setStoredToken, removeStoredToken, getStoredToken } from './client';
import { UserProfile } from '@/types';

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export class AuthService {
  /**
   * Authenticate user with email and password.
   * Backend expects { username: email, password: password }.
   */
  static async login(email: string, password: string): Promise<AuthTokenResponse> {
    const data = await apiClient.post<AuthTokenResponse>('/api/v1/auth/login', {
      username: email,
      password: password,
    });

    if (data?.access_token) {
      setStoredToken(data.access_token);
    }

    return data;
  }

  /**
   * Register a new user.
   */
  static async signup(name: string, email: string, password: string): Promise<UserProfile> {
    const user = await apiClient.post<UserProfile>('/api/v1/auth/signup', {
      name,
      email,
      password,
    });

    return user;
  }

  /**
   * Fetch current authenticated user's profile.
   */
  static async getMe(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/api/v1/auth/me');
  }

  /**
   * Clear authentication token from local storage.
   */
  static logout(): void {
    removeStoredToken();
  }

  /**
   * Check if token is present.
   */
  static hasToken(): boolean {
    return !!getStoredToken();
  }
}
