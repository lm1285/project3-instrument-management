import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import dbConfig from './config/dbConfig';
import { APP_ROUTE_REGISTRATIONS } from './config/appRoutes';

dotenv.config();

const app = express();

function getStaticOptions() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return isDevelopment
    ? { maxAge: 0, etag: false }
    : { maxAge: '1d', etag: true };
}

function registerBaseMiddleware(application: express.Express) {
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
      dbPath: (() => {
        try {
          return dbConfig.getDbPath();
        } catch {
          return '';
        }
      })(),
      timestamp: new Date().toISOString(),
    });
  };

  application.get('/health', healthCheck);
  application.get('/api/health', healthCheck);
}

function registerApiRoutes(application: express.Express) {
  APP_ROUTE_REGISTRATIONS.forEach(({ mountPath, router }) => {
    application.use(mountPath, router);
  });
}

function registerErrorHandler(application: express.Express) {
  application.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled application error:', err);
    res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
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
      console.log(`Server listening on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`API root: http://localhost:${port}${process.env.API_PREFIX || '/api'}`);
    });
  } catch (error) {
    console.error('Server failed to start', error);
    process.exit(1);
  }
};

export { app, startServer };
