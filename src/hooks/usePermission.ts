import { useCallback } from 'react';
import useAuth from '../features/auth/hooks/useAuth';

/**
 * 权限检查 Hook
 */
export const usePermission = () => {
  const { user } = useAuth();

  /**
   * 检查用户是否拥有指定权限
   * @param permission 权限标识 (例如: 'dashboard:view')
   * @returns boolean
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;

    // Remove hardcoded admin bypass to respect configured permissions
    // If system admin needs bypass, use a specific flag, but for now we follow the permissions list
    if (user.is_system_admin) return true; 

    if (!user.permissions || user.permissions.length === 0) {
      return false;
    }

    // 检查权限
    // 1. 精确匹配
    if (user.permissions.includes(permission)) {
      return true;
    }

    // 2. 父级权限隐含子级权限
    // 恢复此功能以保持与后端一致，并解决拥有父级权限但无法看到子级菜单的问题
    const parts = permission.split(':');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current += (i === 0 ? '' : ':') + parts[i];
      if (user.permissions.includes(current)) {
        return true;
      }
    }

    return false;
  }, [user]);

  return { hasPermission };
};
