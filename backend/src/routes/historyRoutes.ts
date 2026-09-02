import express from 'express'
import dbConfig from '../config/dbConfig'
import instrumentService from '../services/instrumentService'

// Helper to ensure end date includes the whole day
const ensureEndOfDay = (dateStr: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr + 'T23:59:59.999Z';
  }
  return dateStr;
};

const router = express.Router()

router.get('/usage', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const start = String(req.query.start || '').trim()
    const end = ensureEndOfDay(String(req.query.end || '').trim())
    const actionsParam = String(req.query.actions || 'use,out').split(',').map(s => s.trim()).filter(Boolean)
    
    // Map English action codes to Chinese database values
    const actionMap: Record<string, string> = {
      'use': '使用',
      'out': '出库',
      'in': '入库'
    }
    
    const actions = actionsParam.map(a => actionMap[a] || a)

    const type = String(req.query.type || '').trim()
    const types = String(req.query.types || '').split(',').map(s => s.trim()).filter(Boolean)
    const dept = String(req.query.dept || '').trim()
    const user = String(req.query.user || '').trim()
    const page = parseInt(String(req.query.page || '1')) || 1
    const pageSize = parseInt(String(req.query.pageSize || '20')) || 20
    const sortParam = String(req.query.sort || 'timestamp').trim()
    // Whitelist allowed sort columns to prevent SQL injection and errors
    const allowedSorts = ['timestamp', 'action', 'operator', 'name', 'model', 'managementNumber', 'type', 'department', 'usageAmount']
    const sort = allowedSorts.includes(sortParam) ? sortParam : 'timestamp'
    
    const direction = String(req.query.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
    const where: string[] = []
    const params: any[] = []
    if (start) { where.push('r.timestamp >= ?'); params.push(start) }
    if (end) { where.push('r.timestamp <= ?'); params.push(end) }
    if (actions.length) { where.push(`r.action IN (${actions.map(() => '?').join(',')})`); params.push(...actions) }
    if (types.length) { where.push(`i.type IN (${types.map(() => '?').join(',')})`); params.push(...types) }
    else if (type) { where.push('i.type = ?'); params.push(type) }
    if (dept) { where.push('(i.department = ? OR i.location = ?)'); params.push(dept, dept) }
    if (user) { where.push('r.operator = ?'); params.push(user) }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : ''
    
    // Log the query for debugging
    console.log('[History] Query:', { start, end, actions, type, dept, user, sort, direction });
    
    const totalRow = await db.get(`SELECT COUNT(1) as c FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId ${whereSql}`, params)
    let total = Number((totalRow as any)?.c || 0)
    const offset = Math.max(0, (page - 1) * pageSize)
    let query = `
      SELECT r.id, r.instrumentId, i.name, i.model, i.type, i.department, i.managementNumber, i.unit, r.action, r.operator, r.details, r.timestamp, r.usageAmount
      FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId
      ${whereSql}
      ORDER BY ${sort} ${direction}
      LIMIT ? OFFSET ?
    `
    console.log('[History] SQL:', query.replace(/\s+/g, ' '));
    params.push(pageSize, offset)
    const rows = await db.all(query, params)
    let data = (rows || []).map((r: any) => {
      let delta = r.usageAmount
      let unit = r.unit || null
      let remarks = ''
      try {
        const d = r.details ? JSON.parse(r.details) : {}
        if (delta === null || delta === undefined) delta = d.delta ?? d.usageAmount ?? d.capacityValue ?? null
        unit = d.unit ?? unit
        remarks = d.remarks ?? ''
      } catch {}
      return { 
        id: r.id, 
        instrumentId: r.instrumentId, 
        name: r.name, 
        model: r.model, 
        managementNumber: r.managementNumber,
        type: r.type, 
        department: r.department, 
        action: r.action, 
        operator: r.operator, 
        delta, 
        unit, 
        remarks,
        time: r.timestamp 
      }
    })
    
    // Remove mock logic
    
    res.status(200).json({ success: true, data, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取使用明细失败', error: String(e) })
  }
})

router.get('/usage/summary', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const start = String(req.query.start || '').trim()
    const end = ensureEndOfDay(String(req.query.end || '').trim())
    const actions = String(req.query.actions || 'use,out').split(',').map(s => s.trim()).filter(Boolean)
    const groupBy = String(req.query.groupBy || 'name')
    const where: string[] = []
    const params: any[] = []
    if (start) { where.push('r.timestamp >= ?'); params.push(start) }
    if (end) { where.push('r.timestamp <= ?'); params.push(end) }
    if (actions.length) { where.push(`r.action IN (${actions.map(() => '?').join(',')})`); params.push(...actions) }
    const whereSql = where.length ? ('WHERE ' + where.join(' AND ')) : ''
    const rows = await db.all(`
      SELECT ${groupBy === 'model' ? 'i.model as k' : groupBy === 'department' ? 'i.department as k' : groupBy === 'user' ? 'r.operator as k' : 'i.name as k'}, COUNT(1) as cnt
      FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId
      ${whereSql}
      GROUP BY k
      ORDER BY cnt DESC
    `, params)
    let data = (rows || []).map((r: any) => ({ key: r.k || '-', count: Number(r.cnt || 0) }))
    
    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取使用汇总失败', error: String(e) })
  }
})

router.get('/consumption', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const start = String(req.query.start || '').trim()
    const end = ensureEndOfDay(String(req.query.end || '').trim())
    const dept = String(req.query.dept || '').trim()
    const user = String(req.query.user || '').trim()
    const page = parseInt(String(req.query.page || '1')) || 1
    const pageSize = parseInt(String(req.query.pageSize || '20')) || 20
    const where: string[] = []
    const params: any[] = []
    const types = String(req.query.types || '').split(',').map(s => s.trim()).filter(Boolean)
    if (types.length) {
      where.push(`i.type IN (${types.map(() => '?').join(',')})`)
      params.push(...types)
    } else {
      where.push("i.type = '标准物质'")
    }
    if (start) { where.push('r.timestamp >= ?'); params.push(start) }
    if (end) { where.push('r.timestamp <= ?'); params.push(end) }
    where.push("r.action IN ('consume','use')")
    if (dept) { where.push('(i.department = ? OR i.location = ?)'); params.push(dept, dept) }
    if (user) { where.push('r.operator = ?'); params.push(user) }
    const whereSql = 'WHERE ' + where.join(' AND ')
    const totalRow = await db.get(`SELECT COUNT(1) as c FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId ${whereSql}`, params)
    let total = Number((totalRow as any)?.c || 0)
    const offset = Math.max(0, (page - 1) * pageSize)
    let query = `
      SELECT r.id, r.instrumentId, i.name, i.model, i.unit, r.operator, r.details, r.timestamp
      FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId
      ${whereSql}
      ORDER BY r.timestamp DESC
      LIMIT ? OFFSET ?
    `
    params.push(pageSize, offset)
    const rows = await db.all(query, params)
    let data = (rows || []).map((r: any) => {
      let delta = null
      let unit = r.unit || null
      try {
        const d = r.details ? JSON.parse(r.details) : {}
        delta = d.delta ?? null
        unit = d.unit ?? unit
      } catch {}
      return { id: r.id, instrumentId: r.instrumentId, name: r.name, model: r.model, operator: r.operator, delta, unit, time: r.timestamp }
    })
    
    res.status(200).json({ success: true, data, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取消耗明细失败', error: String(e) })
  }
})

router.get('/consumption/summary', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const start = String(req.query.start || '').trim()
    const end = ensureEndOfDay(String(req.query.end || '').trim())
    const groupBy = String(req.query.groupBy || 'name')
    const where: string[] = []
    const params: any[] = []
    const types = String(req.query.types || '').split(',').map(s => s.trim()).filter(Boolean)
    if (types.length) {
      where.push(`i.type IN (${types.map(() => '?').join(',')})`)
      params.push(...types)
    } else {
      where.push("i.type = '标准物质'")
    }
    if (start) { where.push('r.timestamp >= ?'); params.push(start) }
    if (end) { where.push('r.timestamp <= ?'); params.push(end) }
    where.push("r.action IN ('consume','use')")
    const whereSql = 'WHERE ' + where.join(' AND ')
    const rows = await db.all(`
      SELECT ${groupBy === 'department' ? 'i.department as k' : groupBy === 'user' ? 'r.operator as k' : 'i.name as k'}, r.details, i.unit
      FROM flow_records r LEFT JOIN instruments i ON i.id = r.instrumentId
      ${whereSql}
    `, params)
    const agg: Record<string, { sum: number, unit: string }> = {}
    for (const r of rows || []) {
      let delta = 0
      let unit = r.unit || null
      try {
        const d = r.details ? JSON.parse(r.details) : {}
        if (d.delta !== undefined && d.delta !== null) delta = Number(d.delta) || 0
        unit = d.unit ?? unit
      } catch {}
      const k = r.k || '-'
      if (!agg[k]) agg[k] = { sum: 0, unit: unit }
      agg[k].sum += delta
      if (!agg[k].unit && unit) agg[k].unit = unit
    }
    let data = Object.keys(agg).map(k => ({ key: k, total: Number(agg[k].sum.toFixed(4)), unit: agg[k].unit || '' }))
    
    res.status(200).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取消耗汇总失败', error: String(e) })
  }
})

// 获取已使用仪器记录（容量用尽）
router.get('/used', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const page = parseInt(String(req.query.page || '1')) || 1
    const pageSize = parseInt(String(req.query.pageSize || '20')) || 20
    const keyword = String(req.query.keyword || '').trim()
    const type = String(req.query.type || '').trim()
    const dept = String(req.query.dept || '').trim()
    
    const where: string[] = ["(i.instrumentStatus = '已使用' OR i.status = '已使用')"]
    const params: any[] = []
    
    if (keyword) {
      where.push('(i.name LIKE ? OR i.model LIKE ? OR i.managementNumber LIKE ?)')
      const k = `%${keyword}%`
      params.push(k, k, k)
    }

    if (type && type !== '全部') {
      where.push('i.type = ?')
      params.push(type)
    }

    if (dept) {
      where.push('(i.department = ? OR i.location = ?)')
      params.push(dept, dept)
    }
    
    const whereSql = 'WHERE ' + where.join(' AND ')
    
    const totalRow = await db.get(`SELECT COUNT(1) as c FROM instruments i ${whereSql}`, params)
    const total = Number((totalRow as any)?.c || 0)
    
    const offset = Math.max(0, (page - 1) * pageSize)
    
    // 获取最后使用时间 (latest '使用' or 'consume' or 'out' action, or '入库' with isConsumed)
    const rows = await db.all(`
      SELECT i.id, i.name, i.model, i.managementNumber, i.initialCapacity, i.remarks, i.unit,
             (SELECT MAX(timestamp) FROM flow_records f WHERE f.instrumentId = i.id AND (f.action IN ('使用', 'consume') OR (f.action = '入库' AND f.details LIKE '%"isConsumed":true%'))) as lastUsageTime
      FROM instruments i
      ${whereSql}
      ORDER BY lastUsageTime DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, offset])
    
    res.status(200).json({ success: true, data: rows, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取已使用记录失败', error: String(e) })
  }
})

// 获取已停用仪器记录
router.get('/disabled', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const page = parseInt(String(req.query.page || '1')) || 1
    const pageSize = parseInt(String(req.query.pageSize || '20')) || 20
    const keyword = String(req.query.keyword || '').trim()
    const type = String(req.query.type || '').trim()
    const dept = String(req.query.dept || '').trim()
    const user = String(req.query.user || '').trim()
    const start = String(req.query.start || '').trim()
    const end = ensureEndOfDay(String(req.query.end || '').trim())
    
    const where: string[] = ["(i.instrumentStatus = '停用' OR i.status = '停用')"]
    const params: any[] = []
    
    if (keyword) {
      where.push('(i.name LIKE ? OR i.model LIKE ? OR i.managementNumber LIKE ?)')
      const k = `%${keyword}%`
      params.push(k, k, k)
    }

    if (type && type !== '全部') {
      where.push('i.type = ?')
      params.push(type)
    }

    if (dept) {
      where.push('(i.department = ? OR i.location = ?)')
      params.push(dept, dept)
    }

    if (user) {
      where.push('i.disabler LIKE ?')
      params.push(`%${user}%`)
    }

    if (start) {
      where.push('i.disableTime >= ?')
      params.push(start)
    }

    if (end) {
      where.push('i.disableTime <= ?')
      params.push(end)
    }
    
    const whereSql = 'WHERE ' + where.join(' AND ')
    
    const totalRow = await db.get(`SELECT COUNT(1) as c FROM instruments i ${whereSql}`, params)
    const total = Number((totalRow as any)?.c || 0)
    
    const offset = Math.max(0, (page - 1) * pageSize)
    
    let query = `
      SELECT i.id, i.name, i.model, i.managementNumber, i.disableTime, i.disableReason, i.disabler,
             i.instrumentStatus, i.storageStatus, i.status, i.inOutStatus, i.remarks
      FROM instruments i
      ${whereSql}
      ORDER BY i.disableTime DESC
      LIMIT ? OFFSET ?
    `
    params.push(pageSize, offset)
    const rows = await db.all(query, params)
    
    res.status(200).json({ success: true, data: rows, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, message: '获取停用记录失败', error: String(e) })
  }
})

// PUT /usage/:id/remarks - Update flow record remarks
router.put('/usage/:id/remarks', async (req, res) => {
  try {
    const { remarks } = req.body
    const db = dbConfig.getConnection()
    const row = await db.get('SELECT details FROM flow_records WHERE id = ?', [req.params.id])
    let details: any = {}
    if (row && row.details) {
      try { details = JSON.parse(row.details) } catch {}
    }
    details.remarks = remarks
    await db.run('UPDATE flow_records SET details = ? WHERE id = ?', [JSON.stringify(details), req.params.id])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新备注失败', error: String(e) })
  }
})

// PUT /used/:id/remarks - Update instrument remarks (Used record)
router.put('/used/:id/remarks', async (req, res) => {
  try {
    const { remarks } = req.body
    const db = dbConfig.getConnection()
    await db.run('UPDATE instruments SET remarks = ? WHERE id = ?', [remarks, req.params.id])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新备注失败', error: String(e) })
  }
})

// PUT /disabled/:id - Update instrument status and remarks
router.put('/disabled/:id', async (req, res) => {
  try {
    const { status, inOutStatus, remarks } = req.body
    
    const updateData: any = {}
    if (status) updateData.instrumentStatus = status
    if (inOutStatus) updateData.storageStatus = inOutStatus
    if (remarks !== undefined) updateData.remarks = remarks
    
    if (Object.keys(updateData).length > 0) {
        await instrumentService.update(req.params.id, updateData)
    }
    
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新失败', error: String(e) })
  }
})

// DELETE /usage/:id - Delete flow record
router.delete('/usage/:id', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    const result = await db.run('DELETE FROM flow_records WHERE id = ?', [req.params.id])
    if (result.changes === 0) {
        // Try to see if it exists but failed to delete? No, if changes is 0 it means not found.
        // But for user, "success" is fine if it's gone.
        // However, let's log it.
        console.warn(`DELETE /usage/${req.params.id} - No rows deleted`)
    }
    res.json({ success: true })
  } catch (e) {
    console.error(`DELETE /usage/${req.params.id} failed:`, e)
    res.status(500).json({ success: false, message: '删除失败', error: String(e) })
  }
})

// DELETE /used/:id - Delete instrument (Used record)
router.delete('/used/:id', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    await db.run('DELETE FROM instruments WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (e) {
    console.error(`DELETE /used/${req.params.id} failed:`, e)
    res.status(500).json({ success: false, message: '删除失败', error: String(e) })
  }
})

// DELETE /disabled/:id - Delete instrument (Disabled record)
router.delete('/disabled/:id', async (req, res) => {
  try {
    const db = dbConfig.getConnection()
    await db.run('DELETE FROM instruments WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (e) {
    console.error(`DELETE /disabled/${req.params.id} failed:`, e)
    res.status(500).json({ success: false, message: '删除失败', error: String(e) })
  }
})

// PUT /disabled/:id - Update instrument status
router.put('/disabled/:id', async (req, res) => {
  try {
    const { status, inOutStatus } = req.body
    
    const updateData: any = {}
    if (status) updateData.instrumentStatus = status
    if (inOutStatus) updateData.storageStatus = inOutStatus
    
    if (Object.keys(updateData).length > 0) {
        await instrumentService.update(req.params.id, updateData)
    }
    
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: '更新失败', error: String(e) })
  }
})

export default router
