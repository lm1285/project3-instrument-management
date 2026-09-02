import express from 'express';
import { authMiddleware } from '../middleware/auth';
import scheduleService from '../services/scheduleService';

const router = express.Router();
router.use(authMiddleware);

/**
 * @route GET /api/schedule/table/:name?
 * @desc 获取下场安排数据
 */
router.get('/table/:name?', async (req, res) => {
  try {
    const name = req.params.name || 'default';
    const data = await scheduleService.getScheduleData(name);
    
    res.status(200).json({
      success: true,
      data: data || {
        columns: ['日期', '客户名称', '操作人', '仪器名称', '备注'],
        rows: [],
        spans: {},
        colWidths: {}
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取下场安排数据失败'
    });
  }
});

/**
 * @route POST /api/schedule/table/:name?
 * @desc 保存下场安排数据
 */
router.post('/table/:name?', async (req, res) => {
  try {
    const name = req.params.name || 'default';
    const user = (req as any).user;
    const updatedBy = user?.username || 'system';
    
    const data = await scheduleService.saveScheduleData(req.body, name, updatedBy);
    
    res.status(200).json({
      success: true,
      data,
      message: '保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '保存下场安排数据失败'
    });
  }
});

/**
 * @route GET /api/schedule/tables
 * @desc 获取所有下场安排表
 */
router.get('/tables', async (req, res) => {
  try {
    const tables = await scheduleService.getAllScheduleData();
    
    res.status(200).json({
      success: true,
      data: tables
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '获取所有下场安排表失败'
    });
  }
});

/**
 * @route DELETE /api/schedule/table/:name
 * @desc 删除下场安排表
 */
router.delete('/table/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const result = await scheduleService.deleteScheduleData(name);
    
    if (result) {
      res.status(200).json({
        success: true,
        message: '删除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        message: '表不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '删除下场安排表失败'
    });
  }
});

export default router;