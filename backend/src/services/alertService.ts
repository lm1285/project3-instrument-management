import dbConfig from '../config/dbConfig';

type AlertRecord = {
  id: string;
  instrumentId: string;
  alertType: '超期' | '预到期' | '库存不足';
  generatedTime: string;
  processedStatus?: string;
  processedBy?: string;
  processedTime?: string;
  recalibrationDate?: string;
  remainingDays?: number;
};

const genId = () => `ALERT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function daysDiffFromToday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  // Normalize to start of day to avoid time discrepancies
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - now.getTime()) / (24 * 3600 * 1000));
}

async function generateAlerts(thresholdDays: number = 30) {
  const db = dbConfig.getConnection();
  const instruments = await db.all('SELECT id, name, type, instrumentStatus, status, recalibrationDate, currentCapacity, initialCapacity, alertLevel, model, mergeGroupId FROM instruments');
  const nowIso = new Date().toISOString();

  // Track active alerts to identify which ones to close later
  // Key: `${instrumentId}|${alertType}`
  const activeAlerts = new Set<string>();
  // Track instruments that have already generated a higher priority alert
  const handledInstruments = new Set<string>();

  // Helper function to upsert alert
  const upsertAlert = async (instrumentId: string, alertType: '超期' | '预到期' | '库存不足', recal: string, days: number) => {
      const existing = await db.get('SELECT * FROM alerts WHERE instrumentId = ? AND alertType = ?', [instrumentId, alertType]);
      
      if (existing) {
          let nextStatus = existing.processedStatus || '预警';
          
          // If it's a time-based alert and the recalibration date has changed, reset status to '预警'
          if (alertType !== '库存不足' && existing.recalibrationDate !== recal) {
              nextStatus = '预警';
          }

          // If the alert was previously marked as completed by the system (e.g. because the instrument status changed),
          // and now the condition is met again, we should reactivate it.
          if (existing.processedStatus === '已完成' && (!existing.processedBy || existing.processedBy === 'System')) {
              nextStatus = '预警';
          }
          
          await db.run(
              'UPDATE alerts SET remainingDays = ?, processedStatus = ?, generatedTime = ?, recalibrationDate = ? WHERE id = ?',
              [days, nextStatus, nowIso, recal, existing.id]
          );
      } else {
          await db.run(
              'INSERT INTO alerts (id, instrumentId, alertType, generatedTime, processedStatus, recalibrationDate, remainingDays) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [genId(), instrumentId, alertType, nowIso, '预警', recal, days]
          );
      }
      activeAlerts.add(`${instrumentId}|${alertType}`);
      handledInstruments.add(instrumentId);
  };

  // 1. Priority 1: Overdue (超期)
  for (const inst of instruments) {
    const type = inst.type as string;
    if (!['标准器', '标准物质', '辅助设备'].includes(type)) continue;

    const status = (inst.instrumentStatus as string) || (inst.status as string) || '';
    if (status !== '使用中') continue;

    const recal = inst.recalibrationDate as string;
    const days = daysDiffFromToday(recal);

    if (days === null) continue;

    if (days < 0) {
        await upsertAlert(inst.id, '超期', recal, days);
    }
  }

  // 2. Priority 2: Stock Low (库存不足)
  // Map for Merge Groups: mergeGroupId -> { ids: [], current: 0, initial: 0, alertPercent: number }
  const mergeGroups: Record<string, { ids: string[]; current: number; initial: number; alertPercent: number | null }> = {};

  for (const inst of instruments) {
      // Filter for Stock Check
      const status = (inst.instrumentStatus as string) || (inst.status as string) || '';
      if (!['使用中', '超期使用'].includes(status)) continue;

      let alertSettings: any = {};
      try {
          alertSettings = JSON.parse(inst.alertLevel || '{}');
      } catch (e) {
          alertSettings = {};
      }

      if (!alertSettings.capacity) continue;
      const alertPercent = parseInt(alertSettings.capacity, 10);
      if (isNaN(alertPercent)) continue;

      const initial = Number(inst.initialCapacity) || 0;
      const current = Number(inst.currentCapacity) || 0;

      // If part of a merge group, add to aggregator
      if (inst.mergeGroupId) {
          if (!mergeGroups[inst.mergeGroupId]) {
              mergeGroups[inst.mergeGroupId] = { ids: [], current: 0, initial: 0, alertPercent: alertPercent };
          }
          mergeGroups[inst.mergeGroupId].ids.push(inst.id);
          mergeGroups[inst.mergeGroupId].current += current;
          mergeGroups[inst.mergeGroupId].initial += initial;
          mergeGroups[inst.mergeGroupId].alertPercent = alertPercent;

          // Individual Check (only if not handled)
          if (!handledInstruments.has(inst.id) && initial > 0) {
              const threshold = initial * (alertPercent / 100);
              if (current < threshold) {
                  await upsertAlert(inst.id, '库存不足', '', 0);
              }
          }
      } 
      // Single Instrument Check
      else {
          if (!handledInstruments.has(inst.id) && initial > 0) {
              const threshold = initial * (alertPercent / 100);
              if (current < threshold) {
                  await upsertAlert(inst.id, '库存不足', '', 0);
              }
          }
      }
  }

  // Evaluate Merge Groups (Group Level Check)
  for (const gid in mergeGroups) {
      const group = mergeGroups[gid];
      if (group.initial <= 0) continue;

      const threshold = group.initial * ((group.alertPercent || 0) / 100);
      
      if (group.current < threshold) {
          // Trigger Alert for ALL members of the group (if not handled)
          for (const id of group.ids) {
              if (!handledInstruments.has(id)) {
                  await upsertAlert(id, '库存不足', '', 0);
              }
          }
      }
  }

  // 3. Priority 3: Pre-expiry (预到期)
  for (const inst of instruments) {
    if (handledInstruments.has(inst.id)) continue;

    const type = inst.type as string;
    if (!['标准器', '标准物质', '辅助设备'].includes(type)) continue;

    const status = (inst.instrumentStatus as string) || (inst.status as string) || '';
    if (status !== '使用中') continue;

    const recal = inst.recalibrationDate as string;
    const days = daysDiffFromToday(recal);

    if (days === null) continue;

    let alertSettings: any = {};
    try {
        alertSettings = JSON.parse(inst.alertLevel || '{}');
    } catch (e) {
        alertSettings = {};
    }

    if (alertSettings.time) {
        const settingDays = parseInt(alertSettings.time, 10);
        if (!isNaN(settingDays) && days <= settingDays && days >= 0) {
            await upsertAlert(inst.id, '预到期', recal, days);
        }
    }
  }

  // 4. Cleanup Inactive Alerts
  const openAlerts = await db.all('SELECT id, instrumentId, alertType FROM alerts WHERE processedStatus IS NULL OR processedStatus NOT IN (\'已完成\', \'删除\')');
  
  for (const alert of openAlerts) {
      const key = `${alert.instrumentId}|${alert.alertType}`;
      if (!activeAlerts.has(key)) {
          // Mark as completed since the alert condition no longer applies
          await db.run('UPDATE alerts SET processedStatus = ?, processedBy = ?, processedTime = ? WHERE id = ?', ['已完成', 'System', nowIso, alert.id]);
      }
  }
}

async function listAlerts(filters: { level?: string; type?: string; status?: string; page?: number; pageSize?: number; sort?: string; direction?: 'asc' | 'desc' } = {}) {
  const db = dbConfig.getConnection();
  
  const remainingDaysSql = "CAST(julianday(a.recalibrationDate) - julianday('now') AS INTEGER)";

  let query = `SELECT a.id, a.instrumentId, a.alertType, a.generatedTime, a.processedStatus, a.processedBy, a.processedTime, a.recalibrationDate, ${remainingDaysSql} AS remainingDays, i.name, i.type, i.model, i.factoryNumber as serialNumber, i.managementNumber, i.measurementRange as measureRange, i.currentCapacity, i.initialCapacity, i.unit, i.mergeGroupId FROM alerts a JOIN instruments i ON a.instrumentId = i.id WHERE (a.processedStatus IS NULL OR a.processedStatus NOT IN ('已完成','删除'))`;
  const params: any[] = [];
  if (filters.level && filters.level !== '全部') {
    query += ' AND a.alertType = ?';
    params.push(filters.level);
  }
  if (filters.type && filters.type !== '全部') {
    query += ' AND i.type = ?';
    params.push(filters.type);
  }
  if (filters.status && filters.status !== '全部') {
    if (filters.status === '预警') {
      query += ' AND (a.processedStatus IS NULL OR a.processedStatus = \'预警\')';
    } else {
      query += ' AND a.processedStatus = ?';
      params.push(filters.status);
    }
  }
  const sortField = (() => {
    switch (filters.sort) {
      case 'remainingDays': return 'remainingDays';
      case 'generatedTime': return 'a.generatedTime';
      case 'alertType': return 'a.alertType';
      default: return 'a.generatedTime';
    }
  })();
  const dir = (filters.direction === 'asc' ? 'ASC' : 'DESC');
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));
  const offset = (page - 1) * pageSize;
  
  const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
  const countRes = await db.get(countQuery, params);
  const total = countRes?.total || 0;
  
  query += ` ORDER BY ${sortField} ${dir}`;
  
    query += ' LIMIT ? OFFSET ?';
    params.push(pageSize, offset);
  
  const rows = await db.all(query, params);
  return { data: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async function updateStatus(id: string, status: string, user: string) {
  const db = dbConfig.getConnection();
  const nowIso = new Date().toISOString();
  await db.run('UPDATE alerts SET processedStatus = ?, processedBy = ?, processedTime = ? WHERE id = ?', [status, user, nowIso, id]);
}

async function deleteAlert(id: string) {
  const db = dbConfig.getConnection();
  await db.run('UPDATE alerts SET processedStatus = ? WHERE id = ?', ['删除', id]);
}

async function listHistory() {
  const db = dbConfig.getConnection();
  const rows = await db.all('SELECT a.*, i.name, i.managementNumber FROM alerts a JOIN instruments i ON a.instrumentId = i.id WHERE a.processedStatus IS NOT NULL AND a.processedStatus != \'预警\' ORDER BY a.processedTime DESC');
  return rows;
}

async function getAlertStats() {
  const db = dbConfig.getConnection();
  const rows = await db.all(`
    SELECT alertType, COUNT(*) as count 
    FROM alerts 
    WHERE processedStatus IS NULL OR processedStatus NOT IN ('已完成', '删除') 
    GROUP BY alertType
  `);
  
  const stats = {
    overdue: 0,
    upcoming: 0,
    stockLow: 0
  };

  rows.forEach(r => {
    if (r.alertType === '超期') stats.overdue = r.count;
    else if (r.alertType === '预到期') stats.upcoming = r.count;
    else if (r.alertType === '库存不足') stats.stockLow = r.count;
  });

  return stats;
}

async function syncAlertsForInstrument(instrumentId: string, thresholdDays: number = 30) {
  // For immediate sync after update. 
  // We can reuse generateAlerts but it scans all.
  // For efficiency, we might want to run logic for just ONE instrument.
  // But generateAlerts is fast enough for small DBs. 
  // To be safe and consistent, let's just call generateAlerts(). 
  // The user provided syncAlertsForInstrument implementation in previous code.
  // I will reimplement it to match new logic.
  
  const db = dbConfig.getConnection();
  const inst = await db.get('SELECT id, name, type, instrumentStatus, status, recalibrationDate, currentCapacity, initialCapacity, alertLevel, model FROM instruments WHERE id = ?', [instrumentId]);
  if (!inst) return;

  const nowIso = new Date().toISOString();
  const type = inst.type as string;
  const status = (inst.instrumentStatus as string) || (inst.status as string) || '';
  
  // Check if alert applies
  let activeType: '超期' | '预到期' | '库存不足' | null = null;
  
  // 1. Time Check
  if (['标准器', '标准物质', '辅助设备'].includes(type) && status === '使用中') {
      const recal = inst.recalibrationDate as string;
      const days = daysDiffFromToday(recal);
      if (days !== null) {
          let alertSettings: any = {};
          try { alertSettings = JSON.parse(inst.alertLevel || '{}'); } catch (e) {}
          
          if (days < 0) activeType = '超期';
          else if (alertSettings.time && days <= parseInt(alertSettings.time, 10)) activeType = '预到期';
      }
  }

  // 2. Stock Check (Simplified: Single instrument check only, group check requires global scan)
  // If it's standard material, we might need to check group. 
  // But for sync, maybe single check is enough or we trigger full scan?
  // Let's trigger full scan to be safe about groups.
  await generateAlerts();
}

export default { generateAlerts, listAlerts, updateStatus, deleteAlert, listHistory, syncAlertsForInstrument, getAlertStats };
