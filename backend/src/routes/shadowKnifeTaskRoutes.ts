import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';
import shadowKnifeTaskService from '../services/shadowKnifeTaskService';

const router = express.Router();

const getWebhookKey = () => String(process.env.SHADOW_KNIFE_WEBHOOK_KEY || '').trim();

const getClientIp = (req: express.Request) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket.remoteAddress || '';
};

const isLocalRequest = (req: express.Request) => {
  const ip = getClientIp(req);
  if (!ip) {
    return false;
  }

  return (
    ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1'
    || ip.startsWith('::ffff:127.0.0.1')
  );
};

const requireWorkbenchWebhookAccess: express.RequestHandler = (req, res, next) => {
  const configuredKey = getWebhookKey();
  const requestKey = String(
    req.headers['x-shadow-knife-key']
    || req.headers['x-api-key']
    || req.query.key
    || req.body?.key
    || '',
  ).trim();

  if (configuredKey) {
    if (requestKey === configuredKey) {
      next();
      return;
    }

    res.status(401).json({ success: false, message: '影刀联动密钥无效' });
    return;
  }

  if (isLocalRequest(req)) {
    next();
    return;
  }

  res.status(403).json({ success: false, message: '仅允许本机影刀联动，或配置 SHADOW_KNIFE_WEBHOOK_KEY 后通过密钥访问' });
};

const getScope = (req: express.Request) => {
  const user = (req as any).user || {};
  return {
    username: user.username || '',
    department: String(user.department || '').trim(),
    includeAllDepartments: Boolean(user.is_system_admin),
  };
};

router.post('/workbench/sync', requireWorkbenchWebhookAccess, async (req, res) => {
  try {
    const operator = String(req.body?.operator || req.headers['x-shadow-knife-operator'] || 'shadow-knife-webhook').trim();
    const data = await shadowKnifeTaskService.syncWorkbenchPayload(req.body || {}, operator);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '影刀联动同步失败' });
  }
});

router.use(authMiddleware);

router.get('/tasks', checkPermission('shadow_knife:task:view'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await shadowKnifeTaskService.listTasks({
      page: Number(req.query.page || 1),
      pageSize: Number(req.query.pageSize || 20),
      search: String(req.query.search || ''),
      department: scope.includeAllDepartments ? String(req.query.department || '') : scope.department,
      includeAllDepartments: scope.includeAllDepartments,
    });

    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '查询失败' });
  }
});

router.post('/tasks', checkPermission('shadow_knife:task:add'), async (req, res) => {
  try {
    const scope = getScope(req);
    const payload = scope.includeAllDepartments ? (req.body || {}) : { ...(req.body || {}), department: scope.department };
    const data = await shadowKnifeTaskService.createTask(payload, scope.username, scope.department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '创建失败' });
  }
});

router.put('/tasks/:id', checkPermission('shadow_knife:task:edit'), async (req, res) => {
  try {
    const scope = getScope(req);
    const payload = scope.includeAllDepartments ? (req.body || {}) : { ...(req.body || {}), department: scope.department };
    const data = await shadowKnifeTaskService.updateTask(req.params.id, payload, scope.username, scope.department);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '更新失败' });
  }
});

router.delete('/tasks/:id', checkPermission('shadow_knife:task:delete'), async (req, res) => {
  try {
    const scope = getScope(req);
    const data = await shadowKnifeTaskService.deleteTask(req.params.id, scope.department, scope.includeAllDepartments);
    res.json({ success: true, data });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : '删除失败' });
  }
});

export default router;
