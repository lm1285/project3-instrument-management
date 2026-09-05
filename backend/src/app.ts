import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import dbConfig from './config/dbConfig';
import { APP_ROUTE_REGISTRATIONS } from './config/appRoutes';
import { isDisabledApiPath } from './config/moduleAvailability';
import { operationAudit, requestContext } from './middleware/requestLogging';
import { logger } from './utils/logger';

dotenv.config();

const app = express();

function getStaticOptions() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return isDevelopment
    ? { maxAge: 0, etag: false }
    : { maxAge: '1d', etag: true };
}

function registerBaseMiddleware(application: express.Express) {
  // Only trust the local reverse proxy, never arbitrary forwarding headers.
  application.set('trust proxy', 'loopback');
  application.use(requestContext);
  application.use(operationAudit);
  application.use(compression());
  application.use(express.static(path.join(__dirname, '../public'), getStaticOptions()));
  application.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  application.options('*', cors());
  application.use(express.json({ limit: '50mb' }));
  application.use(express.urlencoded({ extended: true, limit: '50mb' }));
}

function registerHealthRoutes(application: express.Express) {
  application.get('/', (_req, res) => {
    res.status(200).json({
      message: 'Instrument management backend service',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        instruments: '/api/instruments',
      },
    });
  });

  const healthCheck = async (_req: express.Request, res: express.Response) => {
    let dbStatus = 'disconnected';

    try {
      const db = dbConfig.getConnection();
      await db.get('SELECT 1');
      dbStatus = 'connected';
    } catch {}

    res.status(200).json({
      status: 'ok',
      message: 'Server is running',
      dbStatus,
      timestamp: new Date().toISOString(),
    });
  };

  application.get('/health', healthCheck);
  application.get('/api/health', healthCheck);
}

function registerApiRoutes(application: express.Express) {
  application.use((req, res, next) => {
    if (isDisabledApiPath(req.path)) {
      return res.status(503).json({
        success: false,
        code: 'MODULE_DISABLED',
        message: '该模块暂未启用，当前仅开放一键转送及系统管理功能',
      });
    }
    return next();
  });
  APP_ROUTE_REGISTRATIONS.forEach(({ mountPath, router }) => {
    application.use(mountPath, router);
  });
}

function registerErrorHandler(application: express.Express) {
  application.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('http.unhandled_exception', err, {
      request_id: (req as any).requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0] || req.path,
      user_id: (req as any).user?.userId ?? (req as any).user?.id,
      username: (req as any).user?.username,
    });
    res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      request_id: (req as any).requestId,
      error: process.env.NODE_ENV === 'production' ? {} : err,
    });
  });
}

registerBaseMiddleware(app);
registerHealthRoutes(app);
registerApiRoutes(app);
registerErrorHandler(app);

const startServer = () => {
  try {
    const port = Number(process.env.PORT || 3002);

    app.listen(port, '0.0.0.0', () => {
      logger.info('server.listening', {
        port,
        health_check: `http://localhost:${port}/health`,
        api_root: `http://localhost:${port}${process.env.API_PREFIX || '/api'}`,
      });
    });
  } catch (error) {
    logger.error('server.start_failed', error);
    process.exit(1);
  }
};

export { app, startServer };
