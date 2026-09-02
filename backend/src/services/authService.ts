import crypto from 'crypto';
import { getUserByUsername, verifyCredentials } from './userService';

const JWT_SECRET = process.env.JWT_SECRET || 'instrument_mgmt_secret_key_2024';
const NORMAL_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const ADMIN_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

const mockUsers = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin', department: '' },
  { id: 2, username: 'user', password: 'user123', role: 'user', department: '' },
];

const sign = (data: string): string => {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const generateToken = (
  userId: string | number,
  username: string,
  role: string,
  permissions: string[] = [],
  isSystemAdmin = false,
  department = '',
): string => {
  const payload = JSON.stringify({
    userId,
    username,
    role,
    roles: [role],
    permissions,
    is_system_admin: isSystemAdmin,
    department,
    exp: Date.now() + (isSystemAdmin || role === 'admin' ? ADMIN_TOKEN_TTL_MS : NORMAL_TOKEN_TTL_MS),
  });

  const data = Buffer.from(payload)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${sign(data)}`;
};

export const login = async (
  username: string,
  password: string,
): Promise<{
  success: boolean;
  token?: string;
  user?: any;
  error?: string;
}> => {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const fileUser = verifyCredentials(username, password);
    let user: any = null;

    if (fileUser) {
      user = {
        id: fileUser.id,
        username: fileUser.username,
        role: fileUser.role,
        permissions: fileUser.permissions || [],
        is_system_admin: fileUser.is_system_admin,
        department: fileUser.department || '',
      };
    } else {
      const dbUser = getUserByUsername(username);
      if (dbUser) {
        return {
          success: false,
          error: '用户名或密码错误',
        };
      }

      const mockUser = mockUsers.find((item) => item.username === username && item.password === password);
      if (mockUser) {
        user = {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
          permissions: [],
          is_system_admin: false,
          department: mockUser.department,
        };
      }
    }

    if (!user) {
      return {
        success: false,
        error: '用户名或密码错误',
      };
    }

    const token = generateToken(
      user.id,
      user.username,
      user.role,
      user.permissions,
      user.is_system_admin,
      user.department,
    );

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        is_system_admin: user.is_system_admin,
        department: user.department || '',
      },
    };
  } catch (error) {
    console.error('Login service error:', error);
    return {
      success: false,
      error: '登录失败，请稍后重试',
    };
  }
};

export const logout = async (): Promise<boolean> => true;

export const getCurrentUser = async (): Promise<any | null> => {
  const admin = getUserByUsername('admin');
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    permissions: admin.permissions || [],
    is_system_admin: admin.is_system_admin,
    department: admin.department || '',
  };
};

export const validateToken = (token: string): boolean => {
  return !!getUserFromToken(token);
};

export const getUserFromToken = (token: string): any | null => {
  try {
    if (!token || !token.includes('.')) {
      return null;
    }

    const [data, signature] = token.split('.');
    if (!data || !signature) {
      return null;
    }

    if (signature !== sign(data)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'),
    );

    if (payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
