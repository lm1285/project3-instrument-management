import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { checkPermission } from '../middleware/permission'
import statisticsService from '../services/statisticsService'

const router = Router()

router.use(authMiddleware)

/**
 * @route GET /api/statistics/general
 * @desc Get general statistics (total, in stock, etc.)
 */
router.get('/general', async (req, res) => {
  try {
    const data = await statisticsService.getGeneralStats();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch general stats' });
  }
});

/**
 * @route GET /api/statistics/distribution
 * @desc Get instrument distribution
 */
router.get('/distribution', async (req, res) => {
  try {
    const { groupBy } = req.query;
    if (!groupBy || !['status', 'type', 'department'].includes(String(groupBy))) {
      return res.status(400).json({ success: false, error: 'Invalid groupBy parameter' });
    }
    const data = await statisticsService.getDistribution(String(groupBy) as 'status' | 'type' | 'department');
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch distribution' });
  }
});

/**
 * @route GET /api/statistics/growth-trend
 * @desc Get instrument growth trend
 */
router.get('/growth-trend', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Missing date range' });
    }
    const data = await statisticsService.getGrowthTrend(
        String(startDate), 
        String(endDate), 
        (String(type) === 'day' ? 'day' : 'month')
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch growth trend' });
  }
});

/**
 * @route GET /api/statistics/trends
 * @desc Get usage trends
 */
router.get('/trends', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Missing date range' });
    }
    const data = await statisticsService.getUsageTrends(
        String(startDate), 
        String(endDate), 
        (String(type) === 'day' ? 'day' : 'month')
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch trends' });
  }
});

/**
 * @route GET /api/statistics/top-used
 * @desc Get top used instruments
 */
router.get('/top-used', async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit)) || 10;
    const data = await statisticsService.getTopUsedInstruments(limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch top used' });
  }
});

/**
 * @route GET /api/statistics/flow-stats
 * @desc Get daily flow stats
 */
router.get('/flow-stats', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Missing date range' });
    }
    const data = await statisticsService.getDailyFlowStats(String(startDate), String(endDate));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch flow stats' });
  }
});

/**
 * @route GET /api/statistics/heatmap
 * @desc Get usage heatmap data
 */
router.get('/heatmap', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: 'Missing date range' });
    }
    const data = await statisticsService.getUsageHeatmap(String(startDate), String(endDate));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch heatmap' });
  }
});

/**
 * @route GET /api/statistics/recent
 * @desc Get recent usage records
 */
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(String(req.query.limit)) || 20;
        const data = await statisticsService.getRecentUsage(limit);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch recent usage' });
    }
});

/**
 * @route GET /api/statistics/lims-records
 * @desc Get LIMS usage records
 */
router.get('/lims-records', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '1')) || 1;
    const pageSize = parseInt(String(req.query.pageSize || '20')) || 20;
    const keyword = String(req.query.keyword || '').trim();
    
    const result = await statisticsService.getLimsUsageRecords({ page, pageSize, keyword });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch LIMS records' });
  }
});

router.post('/export', checkPermission('stats:usage:export'), async (req, res) => {
  try {
    const { dimension, filters, format } = req.body || {}
    if (!format || ['excel', 'csv', 'json'].indexOf(format) === -1) {
      return res.status(400).json({ success: false, error: 'invalid format' })
    }
    // TODO: Implement actual export logic using statisticsService
    const result = { ok: true, dimension: dimension || 'usage', filters: filters || {}, format };
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'export failed' });
  }
})

export default router
