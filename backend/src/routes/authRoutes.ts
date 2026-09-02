import express from 'express';
import { login, logout } from '../services/authService';
import { verifyCredentials, updateUser } from '../services/userService';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * 修改密码接口 (无需登录Token，需验证旧密码)
 * @route POST /api/auth/change-password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '请提供用户名、旧密码和新密码'
      });
    }

    // 验证新密码规则：无空格，最少3位
    if (/\s/.test(newPassword)) {
      return res.status(400).json({ success: false, error: '新密码不得包含空格' });
    }
    if (newPassword.length < 3) {
      return res.status(400).json({ success: false, error: '新密码最少为3位' });
    }

    // 验证旧密码
    const user = verifyCredentials(username, oldPassword);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '用户名或旧密码错误'
      });
    }

    // 更新密码
    updateUser(user.id, { password: newPassword });

    res.status(200).json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error: any) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '修改密码失败，请稍后重试'
    });
  }
});

/**
 * 登录接口
 * @route POST /api/auth/login
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {object} - 登录成功返回token和用户信息
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码不能为空'
      });
    }
    
    // 调用登录服务
    const result = await login(username, password);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(401).json(result);
    }
  } catch (error: any) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '登录失败，请稍后重试'
    });
  }
});

/**
 * 登出接口
 * @route POST /api/auth/logout
 * @returns {object} - 登出成功状态
 */
router.post('/logout', async (req, res) => {
  try {
    await logout();
    res.status(200).json({
      success: true,
      message: '登出成功'
    });
  } catch (error: any) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '登出失败，请稍后重试'
    });
  }
});

/**
 * 获取当前用户信息接口
 * @route GET /api/auth/user
 * @returns {object} - 当前用户信息
 */
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user) {
      res.status(200).json({
        success: true,
        user
      });
    } else {
      res.status(401).json({
        success: false,
        error: '用户未登录'
      });
    }
  } catch (error: any) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      error: error.message || '获取用户信息失败，请稍后重试'
    });
  }
});

export default router;