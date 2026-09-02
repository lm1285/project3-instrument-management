import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth';

export function requireTemplatePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'authentication_required' });
    }

    if (user.role === 'admin' || user.is_system_admin || user.username === 'admin') {
      return next();
    }

    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (permissions.includes(permission)) {
      return next();
    }

    return res.status(403).json({ success: false, error: 'template_permission_denied' });
  };
}

export { authMiddleware };
