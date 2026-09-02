import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';
import { createUser, deleteUser, listUsers, updateUser } from '../services/userService';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('system:user:view'), (_req, res) => {
  res.json({ success: true, data: listUsers() });
});

router.post('/', checkPermission('system:user:add'), (req, res) => {
  const { username, password, role, name, department } = req.body || {};

  if (!username || !password || !role) {
    return res.status(400).json({ success: false, error: '缺少必要字段' });
  }

  try {
    const user = createUser(username, password, role, name, department);
    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        name: user.name,
        department: user.department || '',
      },
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || '创建失败' });
  }
});

router.put(
  '/:id',
  authMiddleware,
  (req, res, next) => {
    const { permissions } = req.body || {};
    const hasOtherUpdates = Object.keys(req.body || {}).some((key) => key !== 'permissions' && key !== 'id');
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ success: false, error: '未登录' });
    }

    const hasPerm = (permission: string) => {
      if (user.role === 'admin' || user.is_system_admin || user.username === 'admin') {
        return true;
      }

      const userPerms = user.permissions || [];
      if (userPerms.includes(permission)) {
        return true;
      }

      const parts = permission.split(':');
      let current = '';
      for (let index = 0; index < parts.length - 1; index += 1) {
        current += `${index === 0 ? '' : ':'}${parts[index]}`;
        if (userPerms.includes(current)) {
          return true;
        }
      }

      return false;
    };

    if (permissions && !hasPerm('system:user:perm')) {
      return res.status(403).json({ success: false, error: '无权修改权限' });
    }

    if (hasOtherUpdates && !hasPerm('system:user:edit')) {
      return res.status(403).json({ success: false, error: '无权修改用户信息' });
    }

    return next();
  },
  (req, res) => {
    const id = req.params.id;
    const { username, role, roles, password, permissions, name, department } = req.body || {};

    try {
      const user = updateUser(id, { username, role, roles, password, permissions, name, department });
      return res.json({ success: true, data: user });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || '更新失败' });
    }
  },
);

router.delete('/:id', checkPermission('system:user:delete'), (req, res) => {
  const id = req.params.id;

  try {
    const deleted = deleteUser(id);
    return res.json({ success: true, data: { deleted } });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || '删除失败' });
  }
});

export default router;
