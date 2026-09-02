import React, { memo } from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
}

// 受保护路由组件 - 使用React.memo优化性能
export const ProtectedRoute: React.FC<ProtectedRouteProps> = memo(({ children, permission }) => {
  const { isAuthenticated, loading, user } = useAuth();
  
  // 加载中状态显示加载提示
  if (loading) {
    return <div className="loading">加载中...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasPermission = (requiredPermission: string) => {
    if (user?.is_system_admin) {
      return true;
    }

    const permissions = user?.permissions || [];
    if (permissions.includes(requiredPermission)) {
      return true;
    }

    const parts = requiredPermission.split(':');
    let current = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      current += `${index === 0 ? '' : ':'}${parts[index]}`;
      if (permissions.includes(current)) {
        return true;
      }
    }

    return false;
  };

  // 路由鉴权和权限判断使用同一份认证状态，避免刚登录时出现权限状态不同步。
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
});

// 添加自定义比较函数，避免不必要的重渲染
ProtectedRoute.displayName = 'ProtectedRoute';
