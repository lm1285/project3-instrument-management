import { startServer } from './app';
import dbConfig from './config/dbConfig';
import backupService from './services/backupService';
import maintenanceService from './services/maintenanceService';
import { registerScheduledTask } from './utils/scheduler';
import oneClickTransferService from './services/oneClickTransferService';

console.log('Starting instrument management backend...');

async function initializeDatabase() {
  await dbConfig.init();
  console.log('Database initialized');
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
    console.error('Application initialization failed', error);
    process.exit(1);
  }
}

void initializeApp();
