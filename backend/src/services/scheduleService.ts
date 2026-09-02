import dbConfig from '../config/dbConfig';

/**
 * 下场安排服务
 */
class ScheduleService {
  /**
   * 生成唯一ID
   */
  private generateUniqueId(): string {
    return `SCHEDULE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取下场安排数据
   */
  async getScheduleData(name: string = 'default'): Promise<any> {
    try {
      const db = dbConfig.getConnection();
      const record = await db.get(
        'SELECT * FROM schedule_table WHERE name = ?',
        [name]
      );
      
      if (record) {
        return {
          ...JSON.parse(record.data),
          id: record.id,
          updatedAt: record.updatedAt,
          updatedBy: record.updatedBy
        };
      }
      
      return null;
    } catch (error) {
      console.error('获取下场安排数据失败:', error);
      throw new Error('获取下场安排数据失败');
    }
  }

  /**
   * 保存下场安排数据
   */
  async saveScheduleData(data: any, name: string = 'default', updatedBy: string = 'system'): Promise<any> {
    try {
      const db = dbConfig.getConnection();
      const now = new Date().toISOString();
      
      // 检查是否已存在
      const existing = await db.get(
        'SELECT id FROM schedule_table WHERE name = ?',
        [name]
      );
      
      const scheduleData = {
        columns: data.columns || [],
        rows: data.rows || [],
        spans: data.spans || {},
        colWidths: data.colWidths || {},
        savedAt: now
      };
      
      if (existing) {
        // 更新现有记录
        await db.run(
          'UPDATE schedule_table SET data = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
          [JSON.stringify(scheduleData), updatedBy, now, existing.id]
        );
        
        return {
          ...scheduleData,
          id: existing.id,
          updatedAt: now,
          updatedBy
        };
      } else {
        // 创建新记录
        const id = this.generateUniqueId();
        await db.run(
          'INSERT INTO schedule_table (id, name, data, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [id, name, JSON.stringify(scheduleData), updatedBy, now]
        );
        
        return {
          ...scheduleData,
          id,
          updatedAt: now,
          updatedBy
        };
      }
    } catch (error) {
      console.error('保存下场安排数据失败:', error);
      throw new Error('保存下场安排数据失败');
    }
  }

  /**
   * 删除下场安排数据
   */
  async deleteScheduleData(name: string = 'default'): Promise<boolean> {
    try {
      const db = dbConfig.getConnection();
      const result = await db.run(
        'DELETE FROM schedule_table WHERE name = ?',
        [name]
      );
      
      return (result.changes || 0) > 0;
    } catch (error) {
      console.error('删除下场安排数据失败:', error);
      throw new Error('删除下场安排数据失败');
    }
  }

  /**
   * 获取所有下场安排数据列表
   */
  async getAllScheduleData(): Promise<any[]> {
    try {
      const db = dbConfig.getConnection();
      const records = await db.all(
        'SELECT * FROM schedule_table ORDER BY updatedAt DESC'
      );
      
      return records.map(record => ({
        id: record.id,
        name: record.name,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
        ...JSON.parse(record.data)
      }));
    } catch (error) {
      console.error('获取所有下场安排数据失败:', error);
      throw new Error('获取所有下场安排数据失败');
    }
  }
}

export default new ScheduleService();