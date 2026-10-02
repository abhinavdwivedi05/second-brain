/**
 * @jest-environment node
 */

import { AuthService } from '@/services/api/auth';
import { apiClient, getStoredToken, removeStoredToken, setStoredToken } from '@/services/api/client';

// Mock localStorage in Node test environment
const mockStorage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
};

describe('Live FastAPI Integration Test against http://127.0.0.1:8000', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    localStorage.clear();
  });

  test('FastAPI health endpoint responds with status ok', async () => {
    const health = await apiClient.get<{ status: string; service: string }>('/api/v1/health');
    expect(health.status).toBe('ok');
    expect(health.service).toBe('second-brain-api');
  });

  test('POST /api/v1/auth/signup, login, and GET /api/v1/auth/me return user profile with Bearer token', async () => {
    const uniqueEmail = `test_live_${Date.now()}@example.com`;
    const password = 'TestSecurePassword123!';
    const name = 'Live Test User';

    // 1. Signup
    const newUser = await AuthService.signup(name, uniqueEmail, password);
    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(uniqueEmail);
    expect(newUser.name).toBe(name);

    // 2. Login
    const tokenRes = await AuthService.login(uniqueEmail, password);
    expect(tokenRes).toBeDefined();
    expect(tokenRes.access_token).toBeDefined();
    expect(typeof tokenRes.access_token).toBe('string');
    expect(getStoredToken()).toBe(tokenRes.access_token);

    // 3. GET /me using the automatically attached Bearer token
    const profile = await AuthService.getMe();
    expect(profile).toBeDefined();
    expect(profile.email).toBe(uniqueEmail);
    expect(profile.name).toBe(name);

    // 4. Logout removes token
    AuthService.logout();
    expect(getStoredToken()).toBeNull();
  });

  test('POST /api/v1/auth/login with wrong password returns 401', async () => {
    await expect(
      AuthService.login('nonexistent_user_xyz@example.com', 'IncorrectPassword!')
    ).rejects.toThrow('Invalid email or password.');
  });
});
