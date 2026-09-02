import { Request, Response, NextFunction } from 'express';

export const checkPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    // Admin bypass
    if (user.role === 'admin' || user.is_system_admin || user.username === 'admin') {
      return next();
    }

    // Check permissions
    const userPerms = user.permissions || [];
    
    // Exact match
    if (userPerms.includes(permission)) {
      return next();
    }
    
    // Hierarchical match (e.g. settings:users matches settings:users:view)
    const parts = permission.split(':');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : ':') + parts[i];
      if (userPerms.includes(current)) {
        return next();
      }
    }

    return res.status(403).json({ success: false, error: '无权访问' });
  };
};
