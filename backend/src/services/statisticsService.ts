import dbConfig from '../config/dbConfig';
import { v4 as uuidv4 } from 'uuid';

/**
 * Statistics Service
 * Handles data aggregation and statistical analysis
 */
class StatisticsService {
  
  /**
   * Get instrument distribution by specified field
   */
  async getDistribution(field: 'status' | 'type' | 'department') {
    const db = dbConfig.getConnection();
    let query = '';
    let params: any[] = [];

    // Map frontend fields to database columns
    const columnMap: Record<string, string> = {
      status: 'instrumentStatus', // or 'status' depending on which is primary
      type: 'type',
      department: 'department' // Assuming department column exists, otherwise need to check schema
    };

    const dbColumn = columnMap[field] || field;

    if (field === 'status') {
       // For status, we might want to coalesce instrumentStatus and status
       const innerQuery = "SELECT COALESCE(NULLIF(instrumentStatus, ''), NULLIF(status, ''), '未知') as name FROM instruments";
       query = `
         SELECT name, COUNT(*) as value
         FROM (${innerQuery}) as sub
         WHERE name IS NOT NULL
         GROUP BY name
       `;
    } else {
      const innerQuery = `SELECT COALESCE(NULLIF(${dbColumn}, ''), '未知') as name FROM instruments`;
      query = `
        SELECT name, COUNT(*) as value
        FROM (${innerQuery}) as sub
        GROUP BY name
      `;
    }

    const rows = await db.all(query);
    return rows;
  }

  /**
   * Get general statistics (total, in stock, etc.)
   */
  async getGeneralStats() {
    const db = dbConfig.getConnection();
    
    const totalQuery = 'SELECT COUNT(*) as count FROM instruments';
    const inStockQuery = "SELECT COUNT(*) as count FROM instruments WHERE storageStatus = '入库' OR storageStatus = '在库中'";
    const outStockQuery = "SELECT COUNT(*) as count FROM instruments WHERE storageStatus = '已出库' OR storageStatus = '外出使用'";
    // Assuming 'department' column exists for department count, or we count distinct departments
    const deptQuery = 'SELECT COUNT(DISTINCT department) as count FROM instruments WHERE department IS NOT NULL AND department != \'\'';

    const [totalRes, inStockRes, outStockRes, deptRes] = await Promise.all([
      db.get(totalQuery),
      db.get(inStockQuery),
      db.get(outStockQuery),
      db.get(deptQuery)
    ]);

    return {
      totalCount: totalRes?.count || 0,
      inStockCount: inStockRes?.count || 0,
      outStockCount: outStockRes?.count || 0,
      deptCount: deptRes?.count || 0
    };
  }

  /**
   * Get instrument growth trend (cumulative)
   */
  async getGrowthTrend(startDate: string, endDate: string, type: 'month' | 'day' = 'month') {
    const db = dbConfig.getConnection();
    
    let dateFormat = 'yyyy-MM';
    if (type === 'day') {
      dateFormat = 'yyyy-MM-dd';
    }

    // Ensure endDate covers the full day
    const effectiveEndDate = endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate;

    // 1. Get total count before startDate
    const initialCountQuery = `
      SELECT COUNT(*) as count 
      FROM instruments 
      WHERE createdAt < ?
    `;
    const initialRes = await db.get(initialCountQuery, [startDate]);
    let runningTotal = initialRes?.count || 0;

    // 2. Get increments within range
    // SQLite compatible date formatting
    const sqliteFormat = type === 'day' ? '%Y-%m-%d' : '%Y-%m';
    const selectDate = `strftime('${sqliteFormat}', createdAt)`;
    
    const groupBy = selectDate;

    const query = `
      SELECT ${selectDate} as date, COUNT(*) as count
      FROM instruments
      WHERE createdAt BETWEEN ? AND ?
      GROUP BY ${groupBy}
      ORDER BY date ASC
    `;

    const params = [startDate, effectiveEndDate];

    const rows = await db.all(query, params);
    
    // 3. Calculate cumulative with gap filling
    const rowMap = new Map<string, number>();
    rows.forEach((r: any) => rowMap.set(r.date, r.count));

    const result = [];
    
    // Helper to parse date string to local Date object (avoiding timezone issues)
    const parseDate = (str: string) => {
        const [y, m, d] = str.substring(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    // Helper to format date
    const formatDate = (d: Date, t: 'month' | 'day') => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        if (t === 'month') return `${y}-${m}`;
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Use a pointer date
    let current = new Date(start);
    
    // Safety break to prevent infinite loops if dates are invalid
    let loops = 0;
    const maxLoops = 366 * 5; // 5 years max

    while (current <= end && loops < maxLoops) {
        const dateStr = formatDate(current, type);
        const increment = rowMap.get(dateStr) || 0;
        runningTotal += increment;
        
        result.push({
            date: dateStr,
            count: runningTotal,
            increment
        });
        
        // Increment date
        if (type === 'month') {
            current.setDate(1); // Avoid month rollover issues (e.g. Jan 31 -> Feb 28/29)
            current.setMonth(current.getMonth() + 1);
        } else {
            current.setDate(current.getDate() + 1);
        }
        loops++;
    }

    // Handle case where loop didn't run (e.g. invalid dates) but we have data
    if (result.length === 0 && rows.length > 0) {
        // Fallback to just mapping rows if date generation failed
        return rows.map((row: any) => {
             runningTotal += row.count; // This logic is flawed if we reset runningTotal, but better than nothing
             return { date: row.date, count: runningTotal, increment: row.count };
        });
    }
    
    // If result is empty but we have runningTotal (and no rows), return at least start point
    if (result.length === 0 && runningTotal >= 0) {
        let dateStr = startDate;
        if (type === 'month') dateStr = startDate.substring(0, 7);
        return [{ date: dateStr, count: runningTotal, increment: 0 }];
    }
    
    return result;
  }

  /**
   * Get usage trends (monthly/daily)
   */
  async getUsageTrends(startDate: string, endDate: string, type: 'month' | 'day' = 'month') {
    const db = dbConfig.getConnection();
    
    // Ensure endDate covers the full day
    const effectiveEndDate = endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate;

    // Fetch records within range and filter in memory to avoid encoding issues
    const query = `
      SELECT timestamp, action
      FROM flow_records
      WHERE timestamp BETWEEN ? AND ?
    `;

    const rows = await db.all(query, [startDate, effectiveEndDate]);
    
    const dateFormat = type === 'day' ? 10 : 7; // Length of YYYY-MM-DD or YYYY-MM

    const counts = new Map<string, number>();
    
    rows.forEach((row: any) => {
        if (['使用', '出库'].includes(row.action)) {
            const date = row.timestamp.substring(0, dateFormat);
            counts.set(date, (counts.get(date) || 0) + 1);
        }
    });

    const result = Array.from(counts.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  /**
   * Get top used instruments
   */
  async getTopUsedInstruments(limit: number = 10) {
    const db = dbConfig.getConnection();
    
    // Fetch all records and filter in memory
    const query = `
      SELECT instrumentName, action
      FROM flow_records
    `;

    const rows = await db.all(query);
    
    const counts = new Map<string, number>();
    rows.forEach((row: any) => {
        if (['使用', '出库'].includes(row.action)) {
            const name = row.instrumentName || '未知仪器';
            counts.set(name, (counts.get(name) || 0) + 1);
        }
    });

    const result = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
        
    return result;
  }

  /**
   * Get daily flow stats (in vs out)
   */
  async getDailyFlowStats(startDate: string, endDate: string) {
    const db = dbConfig.getConnection();
    
    // Ensure endDate covers the full day
    const effectiveEndDate = endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate;

    const query = `
      SELECT timestamp, action
      FROM flow_records
      WHERE timestamp BETWEEN ? AND ?
    `;
    const rows = await db.all(query, [startDate, effectiveEndDate]);
    
    const stats = new Map<string, { in_count: number, out_count: number }>();
    
    rows.forEach((row: any) => {
        const date = row.timestamp.substring(0, 10); // YYYY-MM-DD
        if (!stats.has(date)) {
            stats.set(date, { in_count: 0, out_count: 0 });
        }
        const stat = stats.get(date)!;
        
        if (['入库'].includes(row.action)) {
            stat.in_count++;
        } else if (['出库', '使用'].includes(row.action)) {
            stat.out_count++;
        }
    });

    const result = [];
    
    // Helper to parse date string to local Date object
    const parseDate = (str: string) => {
        const [y, m, d] = str.substring(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    
    let current = new Date(start);
    let loops = 0;
    const maxLoops = 366 * 5; // 5 years max

    while (current <= end && loops < maxLoops) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const stat = stats.get(dateStr) || { in_count: 0, out_count: 0 };
        result.push({ date: dateStr, ...stat });
        
        current.setDate(current.getDate() + 1);
        loops++;
    }

    if (result.length === 0 && rows.length > 0) {
         return Array.from(stats.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
        
    return result;
  }

  /**
   * Get usage heatmap data (daily counts)
   */
  async getUsageHeatmap(startDate: string, endDate: string) {
    const db = dbConfig.getConnection();
    
    // Ensure endDate covers the full day
    const effectiveEndDate = endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate;

    const query = `
      SELECT timestamp, action
      FROM flow_records
      WHERE timestamp BETWEEN ? AND ?
    `;

    const rows = await db.all(query, [startDate, effectiveEndDate]);
    
    const counts = new Map<string, number>();
    
    rows.forEach((row: any) => {
        if (['使用', '出库'].includes(row.action)) {
            const date = row.timestamp.substring(0, 10); // YYYY-MM-DD
            counts.set(date, (counts.get(date) || 0) + 1);
        }
    });

    const result = Array.from(counts.entries())
        .map(([date, count]) => ({ date, count }));
        
    return result;
  }
  
  /**
   * Get recent usage records
   */
  async getRecentUsage(limit: number = 20) {
      const db = dbConfig.getConnection();
      let query = '';
      query = `
        SELECT * FROM flow_records
        ORDER BY timestamp DESC
        LIMIT ?
      `;
      return await db.all(query, [limit]);
  }

  /**
   * Initialize LIMS usage records table
   */
  async initLimsTable() {
    const db = dbConfig.getConnection();
    await db.run(`
      CREATE TABLE IF NOT EXISTS lims_usage_records (
        id TEXT PRIMARY KEY,
        instrument_id TEXT,
        name TEXT,
        management_number TEXT,
        timestamp TEXT,
        record_type TEXT,
        details TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Add a LIMS usage record
   */
  async addLimsUsageRecord(data: {
    instrumentId: string;
    name: string;
    managementNumber: string;
    recordType: string;
    details?: any;
  }) {
    const db = dbConfig.getConnection();
    // Ensure table exists
    await this.initLimsTable();
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO lims_usage_records (id, instrument_id, name, management_number, timestamp, record_type, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.instrumentId,
      data.name,
      data.managementNumber,
      now,
      data.recordType,
      data.details ? JSON.stringify(data.details) : null,
      now
    ]);
  }

  /**
   * Get LIMS usage records
   */
  async getLimsUsageRecords(params: { page?: number; pageSize?: number; keyword?: string }) {
    const db = dbConfig.getConnection();
    await this.initLimsTable();

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;
    
    let query = `SELECT * FROM lims_usage_records WHERE 1=1`;
    const queryParams: any[] = [];
    
    if (params.keyword) {
      query += ` AND (name LIKE ? OR management_number LIKE ?)`;
      queryParams.push(`%${params.keyword}%`, `%${params.keyword}%`);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    queryParams.push(pageSize, offset);
    
    const countQuery = `SELECT COUNT(*) as total FROM lims_usage_records WHERE 1=1` + 
      (params.keyword ? ` AND (name LIKE ? OR management_number LIKE ?)` : ``);
    
    const [rows, totalRes] = await Promise.all([
      db.all(query, queryParams),
      db.get(countQuery, params.keyword ? [`%${params.keyword}%`, `%${params.keyword}%`] : [])
    ]);
    
    return {
      data: rows,
      total: totalRes?.total || 0,
      page,
      pageSize
    };
  }
}

export default new StatisticsService();
