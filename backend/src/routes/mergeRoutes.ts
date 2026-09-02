import express from 'express';
import mergeService from '../services/mergeService';

const router = express.Router();

// 获取合并组列表
router.get('/merge-groups', async (req, res) => {
  try {
    const search = req.query.search as string;
    const groups = await mergeService.getGroups(search);
    res.json({ success: true, data: groups });
  } catch (error) {
    console.error('获取合并组失败:', error);
    res.status(500).json({ success: false, message: '获取合并组失败' });
  }
});

// 获取智能合并建议
router.get('/merge-groups/suggestions', async (req, res) => {
  try {
    const type = req.query.type as string;
    const suggestions = await mergeService.getSuggestions(type);
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('获取合并建议失败:', error);
    res.status(500).json({ success: false, message: '获取合并建议失败' });
  }
});

// 获取合并组详情
router.get('/merge-groups/:id', async (req, res) => {
  try {
    const group = await mergeService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: '合并组不存在' });
    }
    res.json({ success: true, data: group });
  } catch (error) {
    console.error('获取合并组详情失败:', error);
    res.status(500).json({ success: false, message: '获取合并组详情失败' });
  }
});

// 创建合并组
router.post('/merge-groups', async (req, res) => {
  try {
    const { name, model, description, measurementRange, type, alertLevel, alertMode } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: '合并组名称不能为空' });
    }
    const group = await mergeService.createGroup({ name, model, description, measurementRange, type, alertLevel, alertMode });
    res.json({ success: true, data: group });
  } catch (error) {
    console.error('创建合并组失败:', error);
    res.status(500).json({ success: false, message: '创建合并组失败' });
  }
});

// 更新合并组
router.put('/merge-groups/:id', async (req, res) => {
  try {
    const { name, model, description, measurementRange, type, alertLevel, alertMode } = req.body;
    const success = await mergeService.updateGroup(req.params.id, { name, model, description, measurementRange, type, alertLevel, alertMode });
    if (success) {
      res.json({ success: true, message: '更新成功' });
    } else {
      res.status(404).json({ success: false, message: '合并组不存在' });
    }
  } catch (error) {
    console.error('更新合并组失败:', error);
    res.status(500).json({ success: false, message: '更新合并组失败' });
  }
});

// 删除合并组
router.delete('/merge-groups/:id', async (req, res) => {
  try {
    const success = await mergeService.deleteGroup(req.params.id);
    if (success) {
      res.json({ success: true, message: '删除成功' });
    } else {
      res.status(404).json({ success: false, message: '合并组不存在' });
    }
  } catch (error) {
    console.error('删除合并组失败:', error);
    res.status(500).json({ success: false, message: '删除合并组失败' });
  }
});

// 添加成员 (Move In)
router.post('/merge-groups/:id/members', async (req, res) => {
  try {
    const { instrumentId, syncAlerts } = req.body;
    if (!instrumentId) {
      return res.status(400).json({ success: false, message: '仪器ID不能为空' });
    }
    
    await mergeService.addMember(req.params.id, instrumentId, syncAlerts);
    res.json({ success: true, message: '添加成员成功' });
  } catch (error) {
    console.error('添加成员失败:', error);
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '添加成员失败' });
  }
});

// 移除成员 (Move Out)
router.delete('/merge-groups/:id/members/:instrumentId', async (req, res) => {
  try {
    // 传入 groupId 以便在 instrument 的 mergeGroupId 已丢失时仍能找到备份
    await mergeService.removeMember(req.params.instrumentId, req.params.id);
    res.json({ success: true, message: '移除成员成功' });
  } catch (error) {
    console.error('移除成员失败:', error);
    res.status(500).json({ success: false, message: '移除成员失败' });
  }
});

// 同步旧版数据
router.post('/merge-groups/sync', async (req, res) => {
  try {
    const count = await mergeService.syncLegacyGroups();
    res.json({ success: true, message: `同步成功，创建了 ${count} 个新组` });
  } catch (error) {
    console.error('同步失败:', error);
    res.status(500).json({ success: false, message: '同步失败' });
  }
});

export default router;
