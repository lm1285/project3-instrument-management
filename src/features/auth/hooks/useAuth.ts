import { useState, useEffect, useCallback } from 'react';
import { loginApi, logoutApi, getCurrentUser, User } from '../services/authService';
import { AUTH_SESSION_CHANGED_EVENT, clearSession, endSession, isSessionActive, recordSessionActivity } from '../services/sessionService';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

// 优化useAuth钩子，减少不必要的渲染和函数重新创建
const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
  });

  // 使用useCallback缓存checkAuthStatus函数
  const checkAuthStatus = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setAuthState({
          isAuthenticated: true,
          user,
          loading: false,
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
        });
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    }
  }, []);

  // 检查本地存储中的认证状态
  useEffect(() => {
    checkAuthStatus();
    
    // Listen for global auth update events (e.g. from permission updates)
    const handleAuthUpdate = () => {
      checkAuthStatus();
    };
    window.addEventListener('auth:user-updated', handleAuthUpdate);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthUpdate);
    
    return () => {
      window.removeEventListener('auth:user-updated', handleAuthUpdate);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, handleAuthUpdate);
    };
  }, [checkAuthStatus]);

  useEffect(() => {
    const checkSession = () => {
      if (localStorage.getItem('token') && !isSessionActive()) {
        endSession('登录已超时，请重新登录');
      }
    };
    const recordActivity = () => {
      if (!recordSessionActivity()) checkSession();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'token' || event.key === 'auth_session') checkAuthStatus();
    };
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'focus'];

    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    document.addEventListener('visibilitychange', recordActivity);
    window.addEventListener('storage', handleStorage);
    const timer = window.setInterval(checkSession, 10_000);

    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      document.removeEventListener('visibilitychange', recordActivity);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(timer);
    };
  }, [checkAuthStatus]);

  // 登录函数 - 优化错误处理和状态更新
  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 调用登录API
      const response = await loginApi({ username, password });
      
      if (response.success && response.user) {
        // 存储用户信息到本地存储
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // 更新认证状态
        setAuthState({
          isAuthenticated: true,
          user: response.user,
          loading: false,
        });
        
        return { success: true };
      } else {
        return { success: false, error: response.error || '登录失败' };
      }
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, error: '登录过程中发生错误' };
    }
  }, []);

  // 登出函数 - 优化性能和错误处理
  const logout = useCallback(async () => {
    try {
      // 调用登出API
      await logoutApi();
    } catch (error) {
      console.error('登出API调用失败:', error);
      // 即使API调用失败，也要继续清除本地状态
    } finally {
      // 清除本地存储的用户信息
      clearSession();
      // 更新认证状态
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
  };
};

export default useAuth;
