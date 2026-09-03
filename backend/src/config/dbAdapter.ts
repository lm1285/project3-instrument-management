import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export interface RunResult {
  lastID?: number;
  changes?: number;
}

export interface DatabaseAdapter {
  init(): Promise<void>;
  close(): Promise<void>;
  all<T = any[]>(sql: string, params?: any): Promise<T>;
  get<T = any>(sql: string, params?: any): Promise<T | undefined>;
  run(sql: string, params?: any): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(action: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
  getImplementation(): any; // Return underlying DB instance if needed
}

export class SqliteAdapter implements DatabaseAdapter {
  private db: Database | null = null;
  private config: { filename: string };

  constructor(config: { filename: string }) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.db = await open({
      filename: this.config.filename,
      driver: sqlite3.Database
    });
    // WAL allows concurrent readers while a transfer task is writing. The
    // busy timeout prevents transient SQLITE_BUSY errors from surfacing as
    // 30 second HTTP timeouts in production.
    await this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 15000; PRAGMA synchronous = NORMAL;');
    await this.db.run('PRAGMA foreign_keys = ON');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  async transaction<T>(action: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Check if we are already in a transaction? 
    // SQLite doesn't support nested transactions natively easily, 
    // but for now let's assume simple transactions.
    
    await this.db.run('BEGIN TRANSACTION');
    try {
      // For SQLite, we can just reuse the same adapter/db instance 
      // because the connection is exclusive for the transaction in a single-connection scenario
      // or we just pass 'this' if we don't need a special transaction object wrapper
      // However, to be safe and consistent, we can just pass 'this'.
      const result = await action(this);
      await this.db.run('COMMIT');
      return result;
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async all<T = any[]>(sql: string, params?: any): Promise<T> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.all<T>(sql, params);
  }

  async get<T = any>(sql: string, params?: any): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get<T>(sql, params);
  }

  async run(sql: string, params?: any): Promise<RunResult> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.run(sql, params);
    return {
      lastID: result.lastID,
      changes: result.changes
    };
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.exec(sql);
  }

  getImplementation() {
    return this.db;
  }
}
