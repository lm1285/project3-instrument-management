import React from 'react';
import { usePermission } from '../../../hooks/usePermission';

interface PermissionGuardProps {
  /**
   * The permission(s) required to render the children.
   * If an array is provided, the behavior depends on `requireAll`.
   */
  permission: string | string[];
  
  /**
   * The content to render if the user has permission.
   */
  children: React.ReactNode;
  
  /**
   * Optional content to render if the user does not have permission.
   * Defaults to null.
   */
  fallback?: React.ReactNode;
  
  /**
   * If true and `permission` is an array, all permissions are required.
   * If false (default), at least one permission is required.
   */
  requireAll?: boolean;
}

/**
 * A component that conditionally renders its children based on user permissions.
 * 
 * Usage:
 * ```tsx
 * <PermissionGuard permission="system:user:add">
 *   <Button>Add User</Button>
 * </PermissionGuard>
 * ```
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({ 
  permission, 
  children, 
  fallback = null,
  requireAll = false
}) => {
  const { hasPermission } = usePermission();

  const permissions = Array.isArray(permission) ? permission : [permission];
  
  if (permissions.length === 0) {
    return <>{children}</>;
  }

  const hasAccess = requireAll
    ? permissions.every(p => hasPermission(p))
    : permissions.some(p => hasPermission(p));

  if (hasAccess) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
