import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';
import lengthShadowLinkageService from '../services/lengthShadowLinkageService';

const router = express.Router();

router.use(authMiddleware);

const getScope = (req: express.Request) => {
  const user = (req as any).user || {};
  return {
    department: String(user.department || '').trim(),
    includeAllDepartments: Boolean(user.is_system_admin),
  };
};

router.get('/rules', checkPermission('shadow_knife:rule:view'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await lengthShadowLinkageService.listRules(
      Number(req.query.page || 1),
      Number(req.query.pageSize || 20),
      String(req.query.search || ''),
      scope.includeAllDepartments ? String(req.query.department || '') : scope.department,
      scope.includeAllDepartments,
    );
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '查询失败' });
  }
});

router.post('/rules', checkPermission('shadow_knife:rule:add'), async (req, res) => {
  try {
    const scope = getScope(req);
    const payload = scope.includeAllDepartments ? (req.body || {}) : { ...(req.body || {}), department: scope.department };
    const data = await lengthShadowLinkageService.createRule(payload, scope.department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '创建失败' });
  }
});

router.put('/rules/:id', checkPermission('shadow_knife:rule:edit'), async (req, res) => {
  try {
    const scope = getScope(req);
    const payload = scope.includeAllDepartments ? (req.body || {}) : { ...(req.body || {}), department: scope.department };
    const data = await lengthShadowLinkageService.updateRule(req.params.id, payload, scope.department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '更新失败' });
  }
});

router.delete('/rules/:id', checkPermission('shadow_knife:rule:delete'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await lengthShadowLinkageService.deleteRule(req.params.id, scope.department, scope.includeAllDepartments);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '删除失败' });
  }
});

router.post('/rules/bulk-delete', checkPermission('shadow_knife:rule:delete'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await lengthShadowLinkageService.bulkDelete(
      req.body?.ids || [],
      scope.department,
      scope.includeAllDepartments,
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '批量删除失败' });
  }
});

router.post('/rules/bulk-import', checkPermission('shadow_knife:rule:import'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await lengthShadowLinkageService.bulkImport(req.body?.items || [], scope.department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '导入失败' });
  }
});

router.post('/query', checkPermission('shadow_knife:rule:view'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await lengthShadowLinkageService.queryRules(req.body || {}, scope.department, scope.includeAllDepartments);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '查询联动规则失败' });
  }
});

export default router;
