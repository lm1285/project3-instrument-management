import fs from 'fs'
import path from 'path'

type AuditRecord = {
  id: string
  user_id?: string
  username?: string
  role?: string
  action: string
  module: string
  target_id?: string
  payload_json?: any
  ip?: string
  user_agent?: string
  timestamp: string
}

type AuditFile = { logs: AuditRecord[] }

const dataDir = path.resolve(__dirname, '../../data')
const filePath = path.join(dataDir, 'audit_logs.json')

function ensureFile(): AuditFile {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({ logs: [] }, null, 2))
  const raw = fs.readFileSync(filePath, 'utf-8')
  try { return JSON.parse(raw) as AuditFile } catch { return { logs: [] } }
}

function saveFile(f: AuditFile) { fs.writeFileSync(filePath, JSON.stringify(f, null, 2)) }

function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2)}` }

export function logAudit(params: Omit<AuditRecord, 'id' | 'timestamp'>) {
  const f = ensureFile()
  const rec: AuditRecord = { id: genId(), timestamp: new Date().toISOString(), ...params }
  f.logs.push(rec)
  saveFile(f)
  return rec
}

export function queryAudits(filter: { user_id?: string; module?: string; action?: string; start?: string; end?: string; page?: number; pageSize?: number }) {
  const f = ensureFile()
  let logs = f.logs
  if (filter.user_id) logs = logs.filter(l => l.user_id === filter.user_id)
  if (filter.module) logs = logs.filter(l => l.module === filter.module)
  if (filter.action) logs = logs.filter(l => l.action === filter.action)
  if (filter.start) logs = logs.filter(l => l.timestamp >= filter.start!)
  if (filter.end) logs = logs.filter(l => l.timestamp <= filter.end!)
  const page = Number(filter.page || 1)
  const pageSize = Number(filter.pageSize || 20)
  const total = logs.length
  const rows = logs.slice((page - 1) * pageSize, page * pageSize)
  return { total, rows }
}

export function exportAuditsCSV(limit = 1000) {
  const f = ensureFile()
  const logs = f.logs.slice(-limit)
  const headers = ['id','timestamp','user_id','username','role','action','module','target_id','ip','user_agent']
  const lines = logs.map(l => headers.map(h => JSON.stringify((l as any)[h] ?? '')).join(',')).join('\n')
  return [headers.join(','), lines].join('\n')
}

export function cleanAudits() {
  saveFile({ logs: [] })
  return { success: true }
}