import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logAudit } from '../services/auditService';
import { logger } from '../utils/logger';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;
const DEFAULT_SLOW_REQUEST_MS = 1000;

function getRequestId(req: Request): string {
  const header = req.header('x-request-id');
  return header && REQUEST_ID_PATTERN.test(header) ? header : randomUUID();
}

function getSlowRequestThreshold(): number {
  const configured = Number(process.env.SLOW_REQUEST_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SLOW_REQUEST_MS;
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = getRequestId(req);
  const originalPath = req.originalUrl.split('?')[0] || req.path;
  const startedAt = process.hrtime.bigint();
  const slowRequestMs = getSlowRequestThreshold();

  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const user = (req as any).user;
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const shouldLog = process.env.LOG_ALL_REQUESTS === 'true'
      || isWrite
      || res.statusCode >= 400
      || durationMs >= slowRequestMs;

    if (!shouldLog) return;

    const fields = {
      request_id: requestId,
      method: req.method,
      path: originalPath,
      status_code: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      user_id: user?.userId ?? user?.id,
      username: user?.username,
      response_bytes: Number(res.getHeader('content-length')) || undefined,
    };

    if (res.statusCode >= 500) logger.error('http.request_completed', new Error(`HTTP ${res.statusCode}`), fields);
    else if (res.statusCode >= 400 || durationMs >= slowRequestMs) logger.warn('http.request_completed', fields);
    else logger.info('http.request_completed', fields);
  });

  next();
}

function getOperationModule(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[1] || 'api';
}

function getOperationAction(method: string, path: string): string {
  const segments = path.split('/').filter(Boolean);
  const resource = segments.slice(0, 3).join('/') || 'api';
  return `${method} /${resource}`;
}

function getTargetId(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean);
  const segment = segments[segments.length - 1];
  return segment && /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[A-Za-z]{2,}_[A-Za-z0-9_-]{6,})$/i.test(segment)
    ? segment
    : undefined;
}

export function operationAudit(req: Request, res: Response, next: NextFunction) {
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const requestPath = req.originalUrl.split('?')[0] || req.path;

  res.on('finish', () => {
    const user = (req as any).user;
    if (!isWrite || !user || !requestPath.startsWith('/api/') || requestPath.startsWith('/api/audits')) return;

    void logAudit({
      user_id: String(user.userId ?? user.id ?? ''),
      username: user.username,
      role: user.role,
      action: getOperationAction(req.method, requestPath),
      module: getOperationModule(requestPath),
      target_id: getTargetId(requestPath),
      payload_json: { outcome: res.statusCode < 400 ? 'success' : 'failed', status_code: res.statusCode },
      ip: req.ip,
      user_agent: req.get('user-agent'),
      request_id: (req as any).requestId,
    });
  });

  next();
}
