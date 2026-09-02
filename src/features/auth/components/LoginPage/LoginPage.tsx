import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { changePasswordApi } from '../../services/authService';
import { consumeSessionEndReason } from '../../services/sessionService';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [cpUsername, setCpUsername] = useState('');
  const [cpOldPassword, setCpOldPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const reason = consumeSessionEndReason();
    if (reason) setError(reason);
  }, []);

  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!username || !password) {
      setError('请输入用户名和密码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await login(username, password);

      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || '登录失败');
      }
    } catch (err) {
      console.error('登录错误:', err);
      setError('登录过程中发生错误');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!cpUsername || !cpOldPassword || !cpNewPassword || !cpConfirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (/\s/.test(cpNewPassword)) {
      setError('新密码不能包含空格');
      return;
    }

    if (cpNewPassword.length < 3) {
      setError('新密码长度不能少于 3 位');
      return;
    }

    if (cpNewPassword !== cpConfirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const result = await changePasswordApi({
        username: cpUsername,
        oldPassword: cpOldPassword,
        newPassword: cpNewPassword,
      });

      if (result.success) {
        setSuccessMsg('密码修改成功，请使用新密码登录');
        window.setTimeout(() => {
          setIsChangingPassword(false);
          setUsername(cpUsername);
          setPassword('');
          setSuccessMsg('');
          setCpUsername('');
          setCpOldPassword('');
          setCpNewPassword('');
          setCpConfirmPassword('');
        }, 1200);
      } else {
        setError(result.error || '修改密码失败');
      }
    } catch {
      setError('请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsChangingPassword((value) => !value);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setCpOldPassword('');
    setCpNewPassword('');
    setCpConfirmPassword('');
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>仪器管理系统 {isChangingPassword ? '密码修改' : '登录'}</h2>
        {error && <div className="error-message">{error}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        {!isChangingPassword ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">用户名</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">密码</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </button>
            <div className="login-link" onClick={toggleMode}>修改密码</div>
          </form>
        ) : (
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label htmlFor="cpUsername">用户名</label>
              <input
                type="text"
                id="cpUsername"
                value={cpUsername}
                onChange={(e) => setCpUsername(e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="cpOldPassword">旧密码</label>
              <input
                type="password"
                id="cpOldPassword"
                value={cpOldPassword}
                onChange={(e) => setCpOldPassword(e.target.value)}
                placeholder="请输入旧密码"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="cpNewPassword">新密码</label>
              <input
                type="password"
                id="cpNewPassword"
                value={cpNewPassword}
                onChange={(e) => setCpNewPassword(e.target.value)}
                placeholder="请输入新密码"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="cpConfirmPassword">确认新密码</label>
              <input
                type="password"
                id="cpConfirmPassword"
                value={cpConfirmPassword}
                onChange={(e) => setCpConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                required
              />
            </div>
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? '提交中...' : '确认修改'}
            </button>
            <div className="login-link secondary" onClick={toggleMode}>返回登录</div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
