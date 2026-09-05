import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { queryAudits, exportAuditsCSV, cleanAudits, logAudit } from '../services/auditService'
import { checkPermission } from '../middleware/permission'
import { createDiagnosticBundle } from '../services/diagnosticLogService'

const router = Router()

router.use(authMiddleware)

router.get('/', checkPermission('system:audit:view'), async (req, res, next) => {
  const { user_id, module, action, request_id, start, end, page, pageSize } = req.query as any
  try {
    const result = await queryAudits({ user_id, module, action, request_id, start, end, page: Number(page), pageSize: Number(pageSize) })
    res.json({ success: true, data: result })
  } catch (error) { next(error) }
})

router.get('/export.csv', checkPermission('system:audit:export'), async (req, res, next) => {
  try {
    const { user_id, module, action, request_id, start, end } = req.query as any
    const csv = await exportAuditsCSV({ user_id, module, action, request_id, start, end })
    void logAudit({
      user_id: String((req as any).user?.userId ?? ''),
      username: (req as any).user?.username,
      role: (req as any).user?.role,
      action: 'audit.export_csv',
      module: 'system_audit',
      payload_json: { request_id: request_id || null, start: start || null, end: end || null },
      request_id: (req as any).requestId,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"')
    res.send(csv)
  } catch (error) { next(error) }
})

router.get('/diagnostic.zip', checkPermission('system:audit:export'), async (req, res, next) => {
  try {
    const { request_id, start, end, hours, maxBytes } = req.query as any
    const bundle = await createDiagnosticBundle({ request_id, start, end, hours: Number(hours), maxBytes: Number(maxBytes) })
    void logAudit({
      user_id: String((req as any).user?.userId ?? ''),
      username: (req as any).user?.username,
      role: (req as any).user?.role,
      action: 'audit.download_diagnostic_bundle',
      module: 'system_audit',
      payload_json: { request_id: request_id || null, start: start || null, end: end || null, hours: Number(hours) || 24 },
      request_id: (req as any).requestId,
      ip: req.ip,
      user_agent: req.get('user-agent'),
    })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(bundle.filename)}`)
    res.setHeader('X-Diagnostic-Log-Bytes', String(bundle.buffer.length))
    res.send(bundle.buffer)
  } catch (error) { next(error) }
})

router.delete('/', checkPermission('system:audit:clean'), async (_req, res, next) => {
  try {
    const result = await cleanAudits()
    res.json({ success: true, data: result })
  } catch (error) { next(error) }
})

export default router
