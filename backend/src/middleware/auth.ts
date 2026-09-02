import { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../services/authService';
import { getUserByUsername } from '../services/userService';

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers['authorization'] as string | undefined;
  // console.log('[Auth] Headers:', req.headers);
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  // console.log('[Auth] Token:', token ? token.substring(0, 20) + '...' : 'none');
  let user = token ? getUserFromToken(token) : null;
  
  // Refresh permissions from DB if user exists
  if (user && user.username) {
    try {
      const freshUser = getUserByUsername(user.username);
      if (freshUser) {
        user = {
          ...user,
          role: freshUser.role,
          permissions: freshUser.permissions,
          is_system_admin: freshUser.is_system_admin,
          department: freshUser.department || '',
        };
      }
    } catch (err) {
      console.error('Error refreshing user permissions:', err);
      // Fallback to token user if DB refresh fails
    }
  }

  // console.log('[Auth] User decoded:', user ? user.username : 'null');
  (req as any).user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  // Allow if role is 'admin', or '管理员' (legacy/localized), or if explicitly marked as system admin
  if (!user || (user.role !== 'admin' && user.role !== '管理员' && !user.is_system_admin)) {
    return res.status(403).json({ success: false, error: 'forbidden' });
  }
  next();
}
