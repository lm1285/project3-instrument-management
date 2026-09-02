import dbConfig from '../config/dbConfig';
import fs from 'fs';
import path from 'path';
import { getGlobalSettings } from './settingsService';

class MaintenanceService {
  private autoCleanInterval: NodeJS.Timeout | null = null;
  private autoAnalyzeInterval: NodeJS.Timeout | null = null;

  /**
   * 初始化自动清理任务
   */
  async initAutoTask() {
    try {
      const settings = await getGlobalSettings();
      if (settings && settings.maintenance) {
        if (settings.maintenance.cache) {
          this.updateAutoCleanTask(settings.maintenance.cache);
        }
        if (settings.maintenance.database && settings.maintenance.database.indexOptimization) {
          this.updateAutoAnalyzeTask(settings.maintenance.database.indexOptimization);
        }
      }
    } catch (e) {
      console.error('初始化自动清理任务失败:', e);
    }
  }

  /**
   * 更新自动清理任务
   */
  updateAutoCleanTask(cacheSettings: any) {
    if (this.autoCleanInterval) {
      clearInterval(this.autoCleanInterval);
      this.autoCleanInterval = null;
    }

    if (cacheSettings.autoClean && cacheSettings.cleanInterval > 0) {
      console.log(`[Maintenance] 启用自动清理缓存，间隔: ${cacheSettings.cleanInterval}小时`);
      const ms = cacheSettings.cleanInterval * 60 * 60 * 1000;
      this.autoCleanInterval = setInterval(() => {
        this.clearCache().catch(e => console.error('自动清理缓存失败:', e));
      }, ms);
    } else {
      console.log('[Maintenance] 自动清理缓存已禁用');
    }
  }

  /**
   * 更新自动分析索引任务
   */
  updateAutoAnalyzeTask(optimizationSettings: any) {
    if (this.autoAnalyzeInterval) {
      clearInterval(this.autoAnalyzeInterval);
      this.autoAnalyzeInterval = null;
    }

    if (optimizationSettings.autoAnalyze) {
      console.log('[Maintenance] 启用自动数据库优化（每日）');
      // Default to 24 hours
      const ms = 24 * 60 * 60 * 1000;
      this.autoAnalyzeInterval = setInterval(() => {
        this.analyzeDatabase().catch(e => console.error('自动优化数据库失败:', e));
      }, ms);
    } else {
      console.log('[Maintenance] 自动数据库优化已禁用');
    }
  }

  /**
   * 清理系统缓存
   * 实际上对于SQLite和当前架构，主要是清理临时文件或内存缓存
   */
  async clearCache(): Promise<void> {
    // 模拟清理过程
    console.log('正在清理系统缓存...');
    
    // 如果有临时上传目录，可以清理
    const tempDir = path.join(__dirname, '../../temp');
    if (fs.existsSync(tempDir)) {
      try {
        const files = await fs.promises.readdir(tempDir);
        for (const file of files) {
          // 只清理超过1小时的临时文件
          const filePath = path.join(tempDir, file);
          const stats = await fs.promises.stat(filePath);
          if (Date.now() - stats.mtimeMs > 3600000) {
             await fs.promises.unlink(filePath);
          }
        }
      } catch (e) {
        console.error('清理临时文件失败:', e);
      }
    }
    
    // 如果有Redis，这里会调用Redis flush
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * 数据库优化
   * 运行 SQLite 优化
   */
  async analyzeDatabase(): Promise<void> {
    const db = dbConfig.getConnection();
    console.log('正在优化数据库...');
    
      // SQLite optimization
      // ANALYZE gathers statistics about tables and indices and stores them in sqlite_stat1
      try {
        await db.run('ANALYZE');
        // VACUUM rebuilds the database file, repacking it into a minimal amount of disk space
        // await db.run('VACUUM'); // Optional, but heavier
        console.log('SQLite statistics updated.');
      } catch (e) {
        console.error('SQLite optimization failed:', e);
      }
  }

  /**
   * 数据库完整性检查
   */
  async checkIntegrity(): Promise<string> {
    const db = dbConfig.getConnection();
    console.log('正在检查数据库完整性...');
    
      try {
        // SQLite integrity check
        const result = await db.get('PRAGMA integrity_check');
        if (result && result.integrity_check === 'ok') {
            return 'ok';
        }
        return `Integrity check failed: ${JSON.stringify(result)}`;
      } catch (e) {
        return `error: ${e}`;
      }
  }

  /**
   * 清理/轮转日志文件
   */
  async pruneLogs(): Promise<void> {
    console.log('正在清理日志文件...');
    // 模拟日志清理 (实际应删除 logs/ 目录下过期的 .log 文件)
    const logsDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logsDir)) {
      try {
        const files = await fs.promises.readdir(logsDir);
        for (const file of files) {
          // 清理超过30天的日志
          const filePath = path.join(logsDir, file);
          const stats = await fs.promises.stat(filePath);
          if (Date.now() - stats.mtimeMs > 30 * 24 * 3600 * 1000) {
             await fs.promises.unlink(filePath);
          }
        }
      } catch (e) {
        console.error('清理日志失败:', e);
      }
    }
    return new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * 获取慢查询日志 (模拟)
   */
  async getSlowQueries(): Promise<any[]> {
    // 实际项目中应读取日志文件或查询性能表
    return [
      {
        id: 1,
        query: 'SELECT * FROM instruments WHERE type = "standard" AND ...',
        duration: 1250,
        timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
      },
      {
        id: 2,
        query: 'SELECT count(*) FROM history_logs',
        duration: 850,
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      }
    ];
  }
}

export default new MaintenanceService();
