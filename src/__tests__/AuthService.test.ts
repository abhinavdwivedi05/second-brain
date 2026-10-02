import { AuthService } from '@/services/api/auth';
import { apiClient, getStoredToken, setStoredToken, removeStoredToken, TOKEN_STORAGE_KEY } from '@/services/api/client';

describe('AuthService and ApiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('token storage helpers work correctly with localStorage', () => {
    expect(getStoredToken()).toBeNull();
    setStoredToken('test_jwt_token_123');
    expect(getStoredToken()).toBe('test_jwt_token_123');
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('test_jwt_token_123');
    removeStoredToken();
    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  test('AuthService.login sends POST to /api/v1/auth/login and stores JWT', async () => {
    const mockPost = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_abc',
      token_type: 'bearer',
    });

    const res = await AuthService.login('test@example.com', 'password123');

    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
      username: 'test@example.com',
      password: 'password123',
    });
    expect(res.access_token).toBe('fake_jwt_token_abc');
    expect(getStoredToken()).toBe('fake_jwt_token_abc');
  });

  test('AuthService.getMe calls GET /api/v1/auth/me', async () => {
    const mockProfile = {
      id: 'u-1',
      name: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://avatar.url',
      role: 'Engineer',
      storageUsedBytes: 0,
      storageLimitBytes: 1000,
      aiCreditsRemaining: 100,
      aiCreditsTotal: 100,
    };

    const mockGet = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockProfile);

    const profile = await AuthService.getMe();

    expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(profile.email).toBe('test@example.com');
  });

  test('AuthService.signup sends POST to /api/v1/auth/signup', async () => {
    const mockUser = {
      id: 'u-2',
      name: 'New User',
      email: 'new@example.com',
      avatarUrl: '',
      role: 'User',
      storageUsedBytes: 0,
      storageLimitBytes: 1000,
      aiCreditsRemaining: 100,
      aiCreditsTotal: 100,
    };

    const mockPost = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockUser);

    const user = await AuthService.signup('New User', 'new@example.com', 'pwd');

    expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/signup', {
      name: 'New User',
      email: 'new@example.com',
      password: 'pwd',
    });
    expect(user.id).toBe('u-2');
  });

  test('AuthService.logout removes token from storage', () => {
    setStoredToken('active_token');
    expect(AuthService.hasToken()).toBe(true);
    AuthService.logout();
    expect(AuthService.hasToken()).toBe(false);
    expect(getStoredToken()).toBeNull();
  });
});
