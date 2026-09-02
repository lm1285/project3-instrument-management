import { Router } from 'express'
import { authMiddleware } from '../middleware/auth'
import { queryAudits, exportAuditsCSV, cleanAudits } from '../services/auditService'

const router = Router()

router.use(authMiddleware)

router.get('/', (req, res) => {
  const { user_id, module, action, start, end, page, pageSize } = req.query as any
  const result = queryAudits({ user_id, module, action, start, end, page: Number(page), pageSize: Number(pageSize) })
  res.json({ success: true, data: result })
})

router.get('/export.csv', (_req, res) => {
  const csv = exportAuditsCSV(2000)
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="audit_logs.csv"')
  res.send(csv)
})

router.delete('/', (_req, res) => {
  const result = cleanAudits()
  res.json(result)
})

export default router
