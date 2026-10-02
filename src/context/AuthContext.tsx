'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { AuthService } from '@/services/api/auth';
import { getStoredToken, ApiClientError } from '@/services/api/client';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    setIsLoading(true);
    const storedToken = getStoredToken();

    if (!storedToken) {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    try {
      const profile = await AuthService.getMe();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (err: any) {
      // If 401 Unauthorized, clear invalid/expired token
      if (err instanceof ApiClientError && err.status === 401) {
        AuthService.logout();
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
      } else {
        // Backend unavailable or network error: do not crash
        console.warn('Backend unavailable or session verification failed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const tokenRes = await AuthService.login(email, password);
      setToken(tokenRes.access_token);
      const profile = await AuthService.getMe();
      setUser(profile);
      setIsAuthenticated(true);
    } catch (err) {
      // Clean up token if getMe failed after login
      AuthService.logout();
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.signup(name, email, password);
      // Auto-login upon successful registration
      await login(email, password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    AuthService.logout();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshUser = async (): Promise<void> => {
    if (!token) return;
    try {
      const profile = await AuthService.getMe();
      setUser(profile);
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
