import apiClient, { handleApiError } from '../../../services/apiClient';
import { ALL_PERMISSIONS } from '../constants/permissions';
import { clearSession, ensureSession, startSession } from './sessionService';

interface LoginRequest {
  username: string;
  password: string;
}

export interface User {
  id?: string;
  username: string;
  role?: string;
  permissions?: string[];
  is_system_admin?: boolean;
  department?: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

interface ChangePasswordRequest {
  username: string;
  oldPassword: string;
  newPassword: string;
}

const MOCK_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    is_system_admin: true,
    permissions: ALL_PERMISSIONS,
  },
  { username: 'user', password: 'user123', role: 'user' },
  { username: 'manager', password: 'manager123', role: 'manager' },
];

export const loginApi = async (credentials: LoginRequest): Promise<LoginResponse> => {
  // End the previous account before attempting a new login. This also
  // notifies ApiClient to drop all user-scoped/in-flight GET responses.
  clearSession();

  try {
    const resp = await apiClient.post<{
      token?: string;
      user?: User;
      access_token?: string;
      jwt?: string;
      authToken?: string;
    }>('/auth/login', credentials);

    if (!resp.success) {
      return { success: false, error: resp.message || '登录失败' };
    }

    const data = resp.data as any;
    const token = data?.token || data?.access_token || data?.jwt || data?.authToken;

    if (token) {
      localStorage.setItem('token', token);
    }

    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      startSession(data.user);
    }

    return {
      success: true,
      token,
      user: data?.user,
    };
  } catch (error: any) {
    if (error?.statusCode) {
      return { success: false, error: handleApiError(error) };
    }

    const mockUser = MOCK_USERS.find(
      (user) => user.username === credentials.username && user.password === credentials.password,
    );

    if (mockUser) {
      const mockToken = `mock_token_${Date.now()}`;
      const mockUserInfo = {
        username: mockUser.username,
        role: mockUser.role,
        is_system_admin: (mockUser as any).is_system_admin,
        permissions: (mockUser as any).permissions,
      };

      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(mockUserInfo));
      startSession(mockUserInfo);

      return { success: true, token: mockToken, user: mockUserInfo };
    }

    return { success: false, error: '用户名或密码错误' };
  }
};

export const logoutApi = async (): Promise<boolean> => {
  try {
    await apiClient.post('/auth/logout');
  } catch (_) {
  } finally {
    clearSession();
  }

  return true;
};

export const changePasswordApi = async (
  data: ChangePasswordRequest,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const resp = await apiClient.post('/auth/change-password', data);
    if (!resp.success) {
      return { success: false, error: resp.message || '修改密码失败' };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: handleApiError(error) };
  }
};

export const getCurrentUser = async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const storedUser = JSON.parse(localStorage.getItem('user') || 'null') as User | null;
    if (!storedUser || !ensureSession(storedUser)) {
      clearSession();
      return null;
    }

    const resp = await apiClient.get('/auth/user', { disableCache: true });

    if (resp.success && resp.data?.user) {
      const user = resp.data.user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    }

    throw new Error('返回的用户数据无效');
  } catch (error) {
    console.warn('会话已失效或 Token 无效:', error);
    clearSession();
    return null;
  }
};
