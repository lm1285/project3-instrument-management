import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import dbConfig from '../config/dbConfig';
import { logger } from '../utils/logger';

type AuditRecord = {
  id: string;
  user_id?: string;
  username?: string;
  role?: string;
  action: string;
  module: string;
  target_id?: string;
  payload_json?: unknown;
  ip?: string;
  user_agent?: string;
  request_id?: string;
  timestamp: string;
};

type AuditFilter = {
  user_id?: string;
  request_id?: string;
  module?: string;
  action?: string;
  start?: string;
  end?: string;
  page?: number;
  pageSize?: number;
};

const dataDir = path.resolve(__dirname, '../../data');
const legacyFilePath = path.join(dataDir, 'audit_logs.json');
const MAX_AUDIT_PAYLOAD_BYTES = 16 * 1024;
const MAX_AUDIT_STRING_LENGTH = 4 * 1024;
const REDACTED_KEY = /password|passwd|token|authorization|cookie|secret|api.?key|signature/i;

function sanitizePayload(value: unknown, depth = 0): unknown {
  if (depth >= 6) return '[truncated: maximum nesting depth]';
  if (typeof value === 'string') {
    return value.length > MAX_AUDIT_STRING_LENGTH
      ? `${value.slice(0, MAX_AUDIT_STRING_LENGTH)}...[truncated]`
      : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizePayload(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [key, REDACTED_KEY.test(key) ? '[redacted]' : sanitizePayload(item, depth + 1)]));
  }
  return String(value);
}

function toStoredPayload(payload: unknown): string | null {
  if (payload === undefined) return null;
  const serialized = JSON.stringify(sanitizePayload(payload));
  if (serialized.length <= MAX_AUDIT_PAYLOAD_BYTES) return serialized;
  return JSON.stringify({ truncated: true, preview: serialized.slice(0, MAX_AUDIT_STRING_LENGTH) });
}

function toAuditRecord(row: any): AuditRecord {
  let payload: unknown;
  if (row.payload_json) {
    try { payload = JSON.parse(row.payload_json); } catch { payload = row.payload_json; }
  }
  return { ...row, payload_json: payload };
}

function buildWhere(filter: AuditFilter) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  for (const [field, value] of Object.entries({
    user_id: filter.user_id,
    request_id: filter.request_id,
    module: filter.module,
    action: filter.action,
  })) {
    if (value) {
      clauses.push(`${field} = ?`);
      params.push(value);
    }
  }
  if (filter.start) { clauses.push('timestamp >= ?'); params.push(filter.start); }
  if (filter.end) { clauses.push('timestamp <= ?'); params.push(filter.end); }
  return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function initializeAuditStorage(): Promise<void> {
  if (!fs.existsSync(legacyFilePath)) return;
  const db = dbConfig.getConnection();
  const migrationName = 'audit_logs.json-to-sqlite-v1';
  const migration = await db.get<{ name: string }>('SELECT name FROM audit_log_migrations WHERE name = ?', [migrationName]);
  if (migration) return;

  try {
    const raw = await fs.promises.readFile(legacyFilePath, 'utf-8');
    const legacy = JSON.parse(raw) as { logs?: AuditRecord[] };
    const logs = Array.isArray(legacy.logs) ? legacy.logs : [];
    await db.transaction(async (adapter) => {
      for (const record of logs) {
        if (!record?.action || !record?.module) continue;
        await adapter.run(
          `INSERT OR IGNORE INTO audit_logs
           (id, user_id, username, role, action, module, target_id, payload_json, ip, user_agent, request_id, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id || randomUUID(), record.user_id ?? null, record.username ?? null, record.role ?? null,
            record.action, record.module, record.target_id ?? null, toStoredPayload(record.payload_json),
            record.ip ?? null, record.user_agent ?? null, record.request_id ?? null,
            record.timestamp || new Date().toISOString(),
          ],
        );
      }
      await adapter.run('INSERT INTO audit_log_migrations (name, completed_at) VALUES (?, ?)', [migrationName, new Date().toISOString()]);
    });
    logger.info('audit.legacy_imported', { record_count: logs.length });
  } catch (error) {
    logger.error('audit.legacy_import_failed', error, { file: legacyFilePath });
    throw error;
  }
}

export async function logAudit(params: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<void> {
  const record: AuditRecord = { id: randomUUID(), timestamp: new Date().toISOString(), ...params };
  try {
    await dbConfig.getConnection().run(
      `INSERT INTO audit_logs
       (id, user_id, username, role, action, module, target_id, payload_json, ip, user_agent, request_id, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id, record.user_id ?? null, record.username ?? null, record.role ?? null,
        record.action, record.module, record.target_id ?? null, toStoredPayload(record.payload_json),
        record.ip ?? null, record.user_agent ?? null, record.request_id ?? null, record.timestamp,
      ],
    );
  } catch (error) {
    // Auditing must never turn a completed business operation into a 500 response.
    logger.error('audit.write_failed', error, { action: record.action, module: record.module, request_id: record.request_id });
  }
}

export async function queryAudits(filter: AuditFilter) {
  const db = dbConfig.getConnection();
  const { where, params } = buildWhere(filter);
  const page = Math.max(1, Number(filter.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filter.pageSize) || 20));
  const total = (await db.get<{ total: number }>(`SELECT COUNT(*) AS total FROM audit_logs${where}`, params))?.total ?? 0;
  const rows = await db.all<any[]>(
    `SELECT id, user_id, username, role, action, module, target_id, payload_json, ip, user_agent, request_id, timestamp
     FROM audit_logs${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return { total, rows: rows.map(toAuditRecord) };
}

function toCsvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportAuditsCSV(filter: AuditFilter, limit = 2000): Promise<string> {
  const db = dbConfig.getConnection();
  const { where, params } = buildWhere(filter);
  const rows = await db.all<any[]>(
    `SELECT id, timestamp, user_id, username, role, action, module, target_id, ip, user_agent, request_id
     FROM audit_logs${where} ORDER BY timestamp DESC LIMIT ?`,
    [...params, Math.min(10_000, Math.max(1, limit))],
  );
  const headers = ['id', 'timestamp', 'user_id', 'username', 'role', 'action', 'module', 'target_id', 'ip', 'user_agent', 'request_id'];
  return [headers.join(','), ...rows.map((row) => headers.map((header) => toCsvCell(row[header])).join(','))].join('\n');
}

export async function cleanAudits(): Promise<{ deleted: number }> {
  const result = await dbConfig.getConnection().run('DELETE FROM audit_logs');
  return { deleted: result.changes ?? 0 };
}

export async function pruneAudits(retentionDays = Number(process.env.AUDIT_RETENTION_DAYS || 180)): Promise<{ deleted: number; retentionDays: number }> {
  const days = Math.min(3650, Math.max(1, Number.isFinite(retentionDays) ? Math.floor(retentionDays) : 180));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await dbConfig.getConnection().run('DELETE FROM audit_logs WHERE timestamp < ?', [cutoff]);
  return { deleted: result.changes ?? 0, retentionDays: days };
}
