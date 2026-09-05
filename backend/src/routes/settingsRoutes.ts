import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { getEffectiveSettings, getGlobalSettings, setGlobalSettings, getUserSettings, setUserSettings } from '../services/settingsService';
import maintenanceService from '../services/maintenanceService';
import { logAudit } from '../services/auditService';
import dbConfig from '../config/dbConfig';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    const s = await getEffectiveSettings(String(user.userId));
    res.json({ success: true, data: s || {} });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

router.put('/', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'unauthorized' });
    await setUserSettings(String(user.userId), req.body);
    void logAudit({ user_id: String(user.userId), username: user.username, role: user.role, action: 'settings.update', module: 'system', payload_json: req.body, request_id: (req as any).requestId, ip: req.ip, user_agent: req.get('user-agent') });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

router.get('/global', async (_req, res) => {
  try {
    const data = await getGlobalSettings();
    res.json({ success: true, data: data || {} });
  } catch (error: any) {
    console.error('Get global settings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

router.put('/global', requireAdmin, async (req, res) => {
  try {
    await setGlobalSettings(req.body);
    
    // Apply maintenance settings if present
    if (req.body && req.body.maintenance) {
      if (req.body.maintenance.cache) {
        maintenanceService.updateAutoCleanTask(req.body.maintenance.cache);
      }
      if (req.body.maintenance.database && req.body.maintenance.database.indexOptimization) {
        maintenanceService.updateAutoAnalyzeTask(req.body.maintenance.database.indexOptimization);
      }
    }

    const user = (req as any).user;
    void logAudit({ user_id: String(user?.userId || ''), username: user?.username, role: user?.role, action: 'settings.update.global', module: 'system', payload_json: req.body, request_id: (req as any).requestId, ip: req.ip, user_agent: req.get('user-agent') });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Update global settings error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

router.get('/database', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    const db = dbConfig.getConnection();
    await db.get('SELECT 1');
    dbStatus = 'connected';
  } catch {}
  res.json({ success: true, data: { path: (() => { try { return dbConfig.getDbPath(); } catch { return '' } })(), status: dbStatus } });
});

router.put('/database', requireAdmin, async (req, res) => {
  res.status(501).json({ success: false, error: 'Database path configuration is not supported at runtime.' });
});

export default router;
