import express from 'express';
import maintenanceService from '../services/maintenanceService';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';

const router = express.Router();

// 所有路由都需要管理员权限 (暂使用 authenticateToken)
router.use(authMiddleware);

router.post('/cache/clear', checkPermission('system:maintenance:clean_cache'), async (req, res) => {
  try {
    await maintenanceService.clearCache();
    res.json({ success: true, message: '缓存清理成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/database/analyze', checkPermission('system:maintenance:analyze_index'), async (req, res) => {
  try {
    await maintenanceService.analyzeDatabase();
    res.json({ success: true, message: '数据库优化完成' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/database/check', checkPermission('system:maintenance:view'), async (req, res) => {
  try {
    const result = await maintenanceService.checkIntegrity();
    res.json({ success: true, message: '完整性检查完成', data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/logs/prune', checkPermission('system:maintenance:edit'), async (req, res) => {
  try {
    await maintenanceService.pruneLogs();
    res.json({ success: true, message: '日志清理完成' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/slow-queries', checkPermission('system:maintenance:view'), async (req, res) => {
  try {
    const logs = await maintenanceService.getSlowQueries();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
