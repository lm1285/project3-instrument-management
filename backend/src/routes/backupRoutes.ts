import express from 'express';
import backupService from '../services/backupService';
import { authMiddleware as auth } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';

const router = express.Router();

router.use(auth);

// 下载备份
router.get('/download/:filename', checkPermission('system:backup:view'), async (req, res) => {
    try {
      const { filename } = req.params;
      const backupPath = backupService.getBackupPath(filename);
      
      res.download(backupPath, filename, (err) => {
        if (err) {
          console.error('下载文件失败:', err);
          if (!res.headersSent) {
             res.status(404).json({ success: false, message: '文件不存在或无法下载' });
          }
        }
      });
    } catch (error) {
      console.error('下载备份请求失败:', error);
      res.status(500).json({ success: false, message: '下载失败' });
    }
  });

// 获取备份列表
router.get('/', checkPermission('system:backup:view'), async (req, res) => {
  try {
    const backups = await backupService.getBackups();
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份列表失败'
    });
  }
});

// 创建备份
router.post('/', checkPermission('system:backup:create'), async (req, res) => {
  try {
    const backup = await backupService.createBackup();
    res.json({
      success: true,
      message: '备份创建成功',
      data: backup
    });
  } catch (error) {
    console.error('创建备份失败:', error);
    res.status(500).json({
      success: false,
      message: '创建备份失败'
    });
  }
});

// 恢复备份
router.post('/restore/:filename', checkPermission('system:backup:restore'), async (req, res) => {
  try {
    const { filename } = req.params;
    await backupService.restoreBackup(filename);
    res.json({
      success: true,
      message: '数据恢复成功'
    });
  } catch (error) {
    console.error('恢复备份失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复备份失败'
    });
  }
});

// 删除备份
router.delete('/:filename', checkPermission('system:backup:delete'), async (req, res) => {
  try {
    const { filename } = req.params;
    await backupService.deleteBackup(filename);
    res.json({
      success: true,
      message: '备份删除成功'
    });
  } catch (error) {
    console.error('删除备份失败:', error);
    res.status(500).json({
      success: false,
      message: '删除备份失败'
    });
  }
});

export default router;
