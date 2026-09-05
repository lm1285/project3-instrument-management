import { startServer } from './app';
import dbConfig from './config/dbConfig';
import backupService from './services/backupService';
import maintenanceService from './services/maintenanceService';
import { registerScheduledTask } from './utils/scheduler';
import oneClickTransferService from './services/oneClickTransferService';
import { initializeAuditStorage, pruneAudits } from './services/auditService';
import { logger } from './utils/logger';

logger.info('server.initializing');

async function initializeDatabase() {
  await dbConfig.init();
  await initializeAuditStorage();
  logger.info('database.initialized', { path: dbConfig.getDbPath() });
}

function startHttpServer() {
  startServer();
}

async function initializeMaintenanceTasks() {
  await maintenanceService.initAutoTask();
}

function registerBackgroundTasks() {
  registerScheduledTask({
    name: 'auto-backup-check',
    intervalMs: 60 * 60 * 1000,
    runOnStart: true,
    startDelayMs: 10_000,
    run: async () => {
      await backupService.checkAndRunAutoBackup();
    },
  });

  registerScheduledTask({
    name: 'audit-log-retention',
    intervalMs: 24 * 60 * 60 * 1000,
    runOnStart: true,
    startDelayMs: 20_000,
    run: async () => {
      const result = await pruneAudits();
      if (result.deleted > 0) logger.info('audit.retention_pruned', result);
    },
  });

  registerScheduledTask({
    name: 'one-click-transfer-cleanup',
    intervalMs: 24 * 60 * 60 * 1000,
    runOnStart: true,
    startDelayMs: 15_000,
    run: async () => {
      const count = await oneClickTransferService.cleanupExpired();
      if (count > 0) console.log(`Cleaned ${count} expired one-click transfer tasks`);
    },
  });

}

async function initializeApp() {
  try {
    await initializeDatabase();
    startHttpServer();
    await initializeMaintenanceTasks();
    registerBackgroundTasks();
  } catch (error) {
    logger.error('server.initialization_failed', error);
    process.exit(1);
  }
}

void initializeApp();

process.on('unhandledRejection', (reason) => {
  logger.error('process.unhandled_rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('process.uncaught_exception', error);
  process.exit(1);
});
