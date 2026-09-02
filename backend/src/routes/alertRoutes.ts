import express from 'express';
import alertService from '../services/alertService';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const threshold = typeof req.body?.threshold === 'number' ? req.body.threshold : parseInt(req.body?.threshold) || 30;
    await alertService.generateAlerts(threshold);
    const list = await alertService.listAlerts();
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '生成预警失败' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await alertService.getAlertStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '获取预警统计失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const level = req.query.level as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
    const sort = (req.query.sort as string | undefined) || 'generatedTime';
    const direction = (req.query.direction as string | undefined) as any;
    const result = await alertService.listAlerts({ level, type, status, page, pageSize, sort, direction });
    res.status(200).json({ success: true, data: result.data, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '获取预警失败' });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body?.status as string;
    const user = req.body?.user as string || '系统操作员';
    await alertService.updateStatus(id, status, user);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '更新状态失败' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await alertService.deleteAlert(req.params.id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '删除预警失败' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const data = await alertService.listHistory();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '获取历史失败' });
  }
});

router.put('/for-instrument/:instrumentId/sync', async (req, res) => {
  try {
    const instrumentId = req.params.instrumentId;
    const threshold = typeof req.body?.threshold === 'number' ? req.body.threshold : parseInt(req.body?.threshold) || 30;
    await alertService.syncAlertsForInstrument(instrumentId, threshold);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: (error as Error).message || '同步预警失败' });
  }
});

export default router;