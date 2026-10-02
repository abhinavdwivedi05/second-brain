import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthView } from '@/components/auth/AuthView';
import { apiClient, getStoredToken } from '@/services/api/client';

describe('AuthView and AuthContext Flow', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('renders Sign In form by default with email and password fields', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <AuthView />
        </AuthProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('Second Brain')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
  });

  test('can switch to Create Account form and shows full name field', () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <AuthView />
        </AuthProvider>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

    expect(screen.getByPlaceholderText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  test('handles login failure and shows backend error message', async () => {
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Invalid email or password.'));

    render(
      <ThemeProvider>
        <AuthProvider>
          <AuthView />
        </AuthProvider>
      </ThemeProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'wrong@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'wrongpass' },
    });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
  });

  test('handles successful login and stores token in localStorage', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      access_token: 'valid_jwt_token_xyz',
      token_type: 'bearer',
    });
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      id: 'usr-123',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: '',
      role: 'Engineer',
      storageUsedBytes: 0,
      storageLimitBytes: 1000,
      aiCreditsRemaining: 100,
      aiCreditsTotal: 100,
    });

    render(
      <ThemeProvider>
        <AuthProvider>
          <AuthView />
        </AuthProvider>
      </ThemeProvider>
    );

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), {
      target: { value: 'correctpassword' },
    });

    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(getStoredToken()).toBe('valid_jwt_token_xyz');
    });
  });
});
