import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import JSZip from 'jszip';
import { exportAuditsCSV } from './auditService';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);
const DEFAULT_HOURS = 24;
const MAX_HOURS = 168;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIT_BYTES = 2 * 1024 * 1024;
const LOG_FILENAME = /\.log(?:\.\d+)?$/i;

export type DiagnosticLogFilter = {
  request_id?: string;
  start?: string;
  end?: string;
  hours?: number;
  maxBytes?: number;
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

async function readTail(filePath: string, maxBytes: number): Promise<Buffer> {
  const stats = await fs.promises.stat(filePath);
  const length = Math.min(stats.size, maxBytes);
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, stats.size - length));
    return buffer;
  } finally {
    await handle.close();
  }
}

function filterLogContent(content: string, requestId?: string): string {
  if (!requestId) return content;
  return content.split(/\r?\n/).filter((line) => line.includes(requestId)).join('\n');
}

async function collectFileLogs(requestId: string | undefined, maxBytes: number) {
  const configuredDir = process.env.LOG_DIR;
  const candidates = [
    configuredDir ? path.resolve(configuredDir) : null,
    path.resolve(__dirname, '../../logs'),
    path.resolve(process.cwd(), 'logs'),
  ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);
  const entries: Array<{ name: string; content: string; bytes: number }> = [];
  const inspectedDirectories: string[] = [];
  let remaining = Math.min(MAX_TOTAL_BYTES, maxBytes);

  for (const directory of candidates) {
    if (!fs.existsSync(directory) || remaining <= 0) continue;
    inspectedDirectories.push(directory);
    let names: string[];
    try { names = await fs.promises.readdir(directory); } catch { continue; }
    for (const name of names.sort()) {
      if (!LOG_FILENAME.test(name) || remaining <= 0) continue;
      const filePath = path.join(directory, name);
      try {
        const stats = await fs.promises.lstat(filePath);
        if (!stats.isFile()) continue;
        const content = filterLogContent((await readTail(filePath, Math.min(MAX_FILE_BYTES, remaining))).toString('utf8'), requestId);
        if (!content) continue;
        const bytes = Buffer.byteLength(content);
        entries.push({ name: `application/${name}`, content, bytes });
        remaining -= bytes;
      } catch (error) {
        logger.warn('diagnostic.log_read_failed', { file: filePath, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  return { entries, inspectedDirectories };
}

async function collectJournal(requestId: string | undefined, hours: number, maxBytes: number) {
  try {
    const result = await execFileAsync('journalctl', [
      '-u', process.env.SYSTEMD_UNIT_NAME || 'wzglpt-backend.service',
      '--since', `${hours} hours ago`, '--no-pager', '--output=short-iso',
    ], { timeout: 5000, maxBuffer: Math.min(maxBytes, MAX_TOTAL_BYTES) });
    const content = filterLogContent(result.stdout, requestId);
    return { content: content ? content.slice(-maxBytes) : '', status: content ? 'included' : 'empty' };
  } catch (error) {
    return { content: '', status: 'unavailable', detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function createDiagnosticBundle(filter: DiagnosticLogFilter): Promise<{ buffer: Buffer; filename: string }> {
  const requestId = typeof filter.request_id === 'string' ? filter.request_id.trim().slice(0, 128) || undefined : undefined;
  const hours = boundedNumber(filter.hours, DEFAULT_HOURS, 1, MAX_HOURS);
  const maxBytes = boundedNumber(filter.maxBytes, DEFAULT_MAX_BYTES, 64 * 1024, MAX_TOTAL_BYTES);
  const zip = new JSZip();
  const fileLogResult = await collectFileLogs(requestId, maxBytes);
  const fileLogs = fileLogResult.entries;
  let consumed = fileLogs.reduce((total, item) => total + item.bytes, 0);
  for (const item of fileLogs) zip.file(item.name, item.content);

  let journalResult: Awaited<ReturnType<typeof collectJournal>> = { content: '', status: 'not_checked' };
  if (consumed < maxBytes) {
    journalResult = await collectJournal(requestId, hours, maxBytes - consumed);
    if (journalResult.content) {
      zip.file('application/systemd-journal.log', journalResult.content);
      consumed += Buffer.byteLength(journalResult.content);
    }
  }

  const rawAuditCsv = await exportAuditsCSV({
    request_id: requestId,
    start: filter.start,
    end: filter.end,
  }, 10_000);
  const auditCsv = Buffer.byteLength(rawAuditCsv) > MAX_AUDIT_BYTES
    ? `${rawAuditCsv.slice(0, MAX_AUDIT_BYTES)}\n[truncated: audit export limit]\n`
    : rawAuditCsv;
  zip.file('audit/audit_logs.csv', auditCsv);
  zip.file('manifest.json', JSON.stringify({
    generated_at: new Date().toISOString(),
    request_id: requestId || null,
    time_window_hours: hours,
    max_uncompressed_bytes: maxBytes,
    included_log_bytes: consumed,
    log_sources: [
      ...fileLogs.map((item) => item.name),
      ...(journalResult.content ? ['application/systemd-journal.log'] : []),
    ],
    log_source_status: {
      file_logs: fileLogs.length ? 'included' : fileLogResult.inspectedDirectories.length ? 'empty' : 'directory_missing',
      inspected_directories: fileLogResult.inspectedDirectories,
      systemd_journal: journalResult.status,
      systemd_journal_detail: journalResult.detail,
    },
    note: 'Application logs are tail-limited. Use request_id to correlate Nginx, application, and audit records.',
  }, null, 2));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const suffix = requestId ? `_${requestId.slice(0, 16)}` : '';
  return { buffer, filename: `diagnostic_logs_${new Date().toISOString().replace(/[:.]/g, '-')}${suffix}.zip` };
}
