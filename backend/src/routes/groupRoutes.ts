import express from 'express'
import dbConfig from '../config/dbConfig'

const router = express.Router()

// 名称分组统计
router.get('/instruments/groups', async (req, res) => {
  try {
    const by = (req.query.by as string) || 'name'
    if (by !== 'name') return res.status(400).json({ success: false, message: '不支持的分组方式' })
    const db = dbConfig.getConnection()
    const rows = await db.all(`
      SELECT i.name AS name,
             COUNT(1) AS count,
             COALESCE(n.status, 'pending') AS status
      FROM instruments i
      LEFT JOIN name_usage_settings n ON i.name = n.name
      GROUP BY i.name
      ORDER BY count DESC`)
    res.status(200).json({ success: true, data: rows })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取分组失败', error: String(e) })
  }
})

// 名称分级与状态
router.patch('/groups/:name/usage-category', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const { usageCategory, thresholdPercent, markCompleted } = req.body || {}
    const db = dbConfig.getConnection()
    const now = new Date().toISOString()
    await db.run(
      `INSERT INTO name_usage_settings (name, usageCategory, thresholdPercent, updatedAt)
       VALUES (@p0, @p1, @p2, @p3)
       ON CONFLICT(name) DO UPDATE SET
       usageCategory = excluded.usageCategory,
       thresholdPercent = excluded.thresholdPercent,
       updatedAt = excluded.updatedAt;`,
      [name, usageCategory || null, thresholdPercent ?? null, now]
    )
    if (markCompleted) {
      await db.run(`UPDATE name_usage_settings SET status='completed' WHERE name=?`, [name])
    }
    try {
      const rows = await db.all('SELECT id FROM instruments WHERE name = ?', [name])
      const { default: flowService } = await import('../services/flowService')
      await flowService.batchRecordFlow((rows || []).map((r: any) => ({ instrumentId: r.id, action: 'usageCategory.update' as any, operator: '系统', details: { name, usageCategory, thresholdPercent, markCompleted: !!markCompleted } })))
    } catch {}
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新名称分级失败', error: String(e) })
  }
})

router.delete('/groups/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const db = dbConfig.getConnection()
    await db.run(`DELETE FROM name_usage_settings WHERE name = ?`, [name])
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '删除失败', error: String(e) })
  }
})

router.patch('/groups/:name/stock-thresholds', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const { promptPercent, importantPercent, emergencyPercent } = req.body || {}
    const db = dbConfig.getConnection()
    const now = new Date().toISOString()
    await db.run(
      `INSERT INTO name_usage_settings (name, promptPercent, importantPercent, emergencyPercent, updatedAt)
       VALUES (@p0, @p1, @p2, @p3, @p4)
       ON CONFLICT(name) DO UPDATE SET
       promptPercent = excluded.promptPercent,
       importantPercent = excluded.importantPercent,
       emergencyPercent = excluded.emergencyPercent,
       updatedAt = excluded.updatedAt;`,
      [name, promptPercent ?? null, importantPercent ?? null, emergencyPercent ?? null, now]
    )
    try {
      const rows = await db.all('SELECT id FROM instruments WHERE name = ?', [name])
      const { default: flowService } = await import('../services/flowService')
      await flowService.batchRecordFlow((rows || []).map((r: any) => ({ instrumentId: r.id, action: 'stockThresholds.update' as any, operator: '系统', details: { name, promptPercent, importantPercent, emergencyPercent } })))
    } catch {}
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新库存阈值失败', error: String(e) })
  }
})

// 范围分级（占位，前端演示使用）
router.patch('/groups/:groupId/ranges/usage-category', async (_req, res) => {
  try {
    res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新范围分级失败', error: String(e) })
  }
})

// 频率视图-合并组确认（不影响合并建议表），根据勾选成员将其迁移到单条数据的已完成，剩余组成员迁移为待处理或拆分
router.patch('/groups/:groupId/frequency/approve', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const groupId = decodeURIComponent(String(req.params.groupId || ''))
    const members: string[] = Array.isArray((req.body || {}).members) ? (req.body as any).members.map((k: any) => String(k)) : []
    const row: any = await db.get('SELECT members_json FROM merge_suggestions WHERE id = ?', [groupId])
    const list: any[] = JSON.parse(row?.members_json || '[]')
    const selected = list.filter((m: any, idx: number) => {
      const key = (m.managementNumber || m.serialNumber || `${idx}`)
      return members.includes(String(key))
    })
    const remaining = list.filter((m: any, idx: number) => {
      const key = (m.managementNumber || m.serialNumber || `${idx}`)
      return !members.includes(String(key))
    })
    if (selected.length <= 0) {
      return res.status(200).json({ success: true })
    }
    if (selected.length === 1) {
      const nm = String(selected[0]?.name || '').trim()
      if (nm) {
        await db.run(
          `INSERT INTO name_usage_settings (name, status, updatedAt)
           VALUES (@p0, 'completed', @p1)
           ON CONFLICT(name) DO UPDATE SET
           status = excluded.status,
           updatedAt = excluded.updatedAt;`,
          [nm, new Date().toISOString()]
        )
      }
    } else {
      const gname = String(selected[0]?.name || '').trim()
      if (gname) {
        await db.run(
          `INSERT INTO name_usage_settings (name, status, updatedAt)
           VALUES (@p0, 'completed', @p1)
           ON CONFLICT(name) DO UPDATE SET
           status = excluded.status,
           updatedAt = excluded.updatedAt;`,
          [gname, new Date().toISOString()]
        )
      }
    }
    if (remaining.length === 1) {
      const nm = String(remaining[0]?.name || '').trim()
      if (nm) {
        await db.run(
          `INSERT INTO name_usage_settings (name, status, updatedAt)
           VALUES (@p0, 'pending', @p1)
           ON CONFLICT(name) DO UPDATE SET
           status = excluded.status,
           updatedAt = excluded.updatedAt;`,
          [nm, new Date().toISOString()]
        )
      }
    }
    return res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '频率确认失败', error: String(e) })
  }
})

// 频率视图-合并组取消/排除（不影响合并建议表），按勾选成员迁移到单条数据待处理；在特殊场景时剩余成员迁移为待处理
router.patch('/groups/:groupId/frequency/exclude', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const groupId = decodeURIComponent(String(req.params.groupId || ''))
    const members: string[] = Array.isArray((req.body || {}).members) ? (req.body as any).members.map((k: any) => String(k)) : []
    const row: any = await db.get('SELECT members_json FROM merge_suggestions WHERE id = ?', [groupId])
    const list: any[] = JSON.parse(row?.members_json || '[]')
    const selected = list.filter((m: any, idx: number) => {
      const key = (m.managementNumber || m.serialNumber || `${idx}`)
      return members.includes(String(key))
    })
    const remaining = list.filter((m: any, idx: number) => {
      const key = (m.managementNumber || m.serialNumber || `${idx}`)
      return !members.includes(String(key))
    })
    for (const m of selected) {
      const nm = String(m?.name || '').trim()
      if (nm) {
        await db.run(
          `INSERT INTO name_usage_settings (name, status, updatedAt)
           VALUES (@p0, 'pending', @p1)
           ON CONFLICT(name) DO UPDATE SET
           status = excluded.status,
           updatedAt = excluded.updatedAt;`,
          [nm, new Date().toISOString()]
        )
      }
    }
    if (remaining.length === 1) {
      const nm = String(remaining[0]?.name || '').trim()
      if (nm) {
        await db.run(
          `INSERT INTO name_usage_settings (name, status, updatedAt)
           VALUES (@p0, 'pending', @p1)
           ON CONFLICT(name) DO UPDATE SET
           status = excluded.status,
           updatedAt = excluded.updatedAt;`,
          [nm, new Date().toISOString()]
        )
      }
    }
    return res.status(200).json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '频率取消失败', error: String(e) })
  }
})

export default router