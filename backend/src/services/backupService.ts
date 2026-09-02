import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import dbConfig from '../config/dbConfig';
import { getGlobalSettings } from './settingsService';

const DATA_DIR = path.join(__dirname, '../../data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// 确保备份目录存在
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export interface BackupFile {
  filename: string;
  size: number;
  createdAt: string;
  path: string;
}

class BackupService {
  private isBackupFilename(filename: string): boolean {
    return /^backup_[\w.-]+\.(zip|db)$/.test(filename);
  }

  private async collectDataFiles(directory: string, relativeDirectory = ''): Promise<Array<{ path: string; data: Buffer }>> {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const files: Array<{ path: string; data: Buffer }> = [];

    for (const entry of entries) {
      if (entry.name === 'backups' && relativeDirectory === '') continue;

      const fullPath = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        files.push(...await this.collectDataFiles(fullPath, relativePath));
      } else if (entry.isFile()) {
        files.push({ path: relativePath, data: await fs.promises.readFile(fullPath) });
      }
    }

    return files;
  }

  private async removeRestoredData(): Promise<void> {
    const entries = await fs.promises.readdir(DATA_DIR, { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.name !== 'backups')
      .map((entry) => fs.promises.rm(path.join(DATA_DIR, entry.name), { recursive: true, force: true })));
  }

  private getBackupSettings(settings: any) {
    const backup = settings?.backup || {};
    return {
      strategy: backup.strategy === 'auto' ? 'auto' : 'manual',
      autoBackupDays: Math.max(1, Number(backup.autoBackupDays) || 7),
      retentionDays: Math.max(1, Number(backup.retentionDays) || 30),
      maxBackupCount: Math.max(1, Number(backup.maxBackupCount) || 30),
    };
  }

  /**
   * 创建完整业务数据备份（数据库、用户、模板、任务文件及日志等）。
   */
  async createBackup(): Promise<BackupFile> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup_${timestamp}.zip`;
    const backupPath = path.join(BACKUP_DIR, backupFilename);
    const zip = new JSZip();

    // Flush SQLite's write-ahead log before reading the database file.
    try {
      await dbConfig.getConnection().exec('PRAGMA wal_checkpoint(FULL)');
    } catch (error) {
      console.warn('Could not checkpoint database before backup:', error);
    }

    const files = await this.collectDataFiles(DATA_DIR);
    for (const file of files) {
      zip.file(file.path, file.data);
    }

    zip.file('backup-manifest.json', JSON.stringify({
      version: 1,
      createdAt: new Date().toISOString(),
      scope: 'all backend/data business files excluding backups',
    }, null, 2));

    await fs.promises.writeFile(backupPath, await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }));

    await this.applyRetentionPolicy();

    const stats = await fs.promises.stat(backupPath);
    return {
      filename: backupFilename,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      path: backupPath
    };
  }

  /**
   * 获取备份列表
   */
  async getBackups(): Promise<BackupFile[]> {
    if (!fs.existsSync(BACKUP_DIR)) {
      return [];
    }

    const files = await fs.promises.readdir(BACKUP_DIR);
    const backups: BackupFile[] = [];

    for (const file of files) {
      if (this.isBackupFilename(file)) {
        const filePath = path.join(BACKUP_DIR, file);
        try {
            const stats = await fs.promises.stat(filePath);
            backups.push({
              filename: file,
              size: stats.size,
              createdAt: stats.birthtime.toISOString(),
              path: filePath
            });
        } catch (e) {
            console.error(`Error reading backup file ${file}:`, e);
        }
      }
    }

    // 按创建时间倒序排列
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * 恢复备份
   * @param filename 备份文件名
   */
  async restoreBackup(filename: string): Promise<void> {
      const backupPath = this.getBackupPath(filename);
      if (!fs.existsSync(backupPath)) {
          throw new Error('Backup file not found');
      }

      const dbPath = dbConfig.getDbPath();
      
      // Close connection if possible to release lock
      try {
          const db = dbConfig.getConnection();
          await db.close();
      } catch (e) {
          console.warn('Could not close database connection before restore:', e);
      }

      if (filename.endsWith('.db')) {
        await fs.promises.copyFile(backupPath, dbPath);
      } else {
        const zip = await JSZip.loadAsync(await fs.promises.readFile(backupPath));
        const filesToRestore = Object.entries(zip.files).filter(([relativePath, zipEntry]) => {
          if (zipEntry.dir || relativePath === 'backup-manifest.json') return false;
          const normalizedPath = path.normalize(relativePath);
          if (path.isAbsolute(normalizedPath) || normalizedPath.startsWith(`..${path.sep}`) || normalizedPath === '..') {
            throw new Error('Backup contains an invalid file path');
          }
          return true;
        });

        await this.removeRestoredData();

        for (const [relativePath, zipEntry] of filesToRestore) {
          const normalizedPath = path.normalize(relativePath);
          const targetPath = path.join(DATA_DIR, normalizedPath);
          await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
          await fs.promises.writeFile(targetPath, await zipEntry.async('nodebuffer'));
        }
      }
      
      // Re-initialize connection
      await dbConfig.init();
  }

  /**
   * 删除备份
   */
  async deleteBackup(filename: string): Promise<void> {
    const filePath = this.getBackupPath(filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * 检查并运行自动备份
   */
  async checkAndRunAutoBackup(): Promise<void> {
    const settings = this.getBackupSettings(await getGlobalSettings());
    await this.applyRetentionPolicy(settings);
    if (settings.strategy !== 'auto') return;

    const newestBackup = (await this.getBackups())[0];
    const intervalMs = settings.autoBackupDays * 24 * 60 * 60 * 1000;
    if (!newestBackup || Date.now() - new Date(newestBackup.createdAt).getTime() >= intervalMs) {
      await this.createBackup();
    }
  }

  async applyRetentionPolicy(config?: ReturnType<BackupService['getBackupSettings']>): Promise<void> {
    const settings = config || this.getBackupSettings(await getGlobalSettings());
    const backups = await this.getBackups();
    const expiryTime = Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000;
    const expired = backups.filter((backup) => new Date(backup.createdAt).getTime() < expiryTime);
    const retained = backups.filter((backup) => !expired.includes(backup));
    const overLimit = retained.slice(settings.maxBackupCount);

    await Promise.all([...expired, ...overLimit].map((backup) => this.deleteBackup(backup.filename)));
  }

  getBackupPath(filename: string): string {
    if (!this.isBackupFilename(filename)) {
      throw new Error('Invalid backup filename');
    }
    return path.join(BACKUP_DIR, filename);
  }
}

export default new BackupService();
