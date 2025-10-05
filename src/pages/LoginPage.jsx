import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/LoginPage.css'

function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    
    // 简单的登录验证逻辑（实际应用中应该连接后端API）
    if (username && password) {
      // 登录成功后跳转到主页面
      navigate('/main')
    } else {
      setError('请输入用户名和密码')
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">标准器/物质管理系统</h2>
        <p className="login-subtitle">请登录您的账号</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              className="form-input"
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="form-label">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="form-input"
              autoComplete="current-password"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-button">
            登录
          </button>
        </form>
        
        <div className="login-footer">
          <p>&copy; 2025 标准器/物质管理系统</p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage