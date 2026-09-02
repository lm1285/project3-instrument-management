import { FlowRecord, Reservation, FlowAction } from '../types/flow';
import instrumentService from './instrumentService';
import dbConfig from '../config/dbConfig';
import { DatabaseAdapter } from '../config/dbAdapter';
import siteMessageService from './siteMessageService';

/**
 * 仪器流程管理服务
 * 负责处理仪器的出入库、使用等操作
 * 使用SQLite数据库存储
 */
class FlowService {
  /**
   * 生成唯一ID
   */
  private generateUniqueId(): string {
    return `FLOW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录仪器流程操作
   */
  async recordFlow(instrumentId: string, action: FlowAction, operator: string, details?: any, dbOverride?: DatabaseAdapter): Promise<FlowRecord> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      // 验证仪器是否存在
      const instrument = await instrumentService.getById(instrumentId, db);
      if (!instrument) {
        throw new Error('仪器不存在');
      }

      // 允许使用手动指定的时间（用于补录历史记录）
      const now = (details && details.manualDate) 
        ? details.manualDate 
        : new Date().toISOString();

      const id = this.generateUniqueId();

      // 如果是入库操作且有capacityPercent，计算并补充capacityValue
      if (action === '入库' && details && typeof details === 'object') {
        const d = details;
        if (d.capacityPercent !== undefined && d.capacityPercent !== null && (d.capacityValue === undefined || d.capacityValue === null)) {
           const current = Number(instrument.currentCapacity ?? 0);
           const initial = Number(instrument.initialCapacity ?? 0);
           const baseline = (instrument.currentCapacity !== undefined && instrument.currentCapacity !== null) 
             ? current 
             : (initial > 0 ? initial : current);
           
           // 如果不是100%（未使用），计算新容量
           if (Number(d.capacityPercent) !== 100) {
               const calculatedValue = baseline * (Number(d.capacityPercent) / 100);
               d.capacityValue = Number(calculatedValue.toFixed(2));
           }
        }
      }

      // 补充单位信息
      if (details && typeof details === 'object' && !details.unit && instrument.unit) {
        details.unit = instrument.unit;
      }
      
      // 确定数据库记录的动作名称
      let dbAction = action;
      if (action === '入库' && details) {
          const d = typeof details === 'string' ? JSON.parse(details) : details;
          // 如果已用完，或者容量发生变化（不是100%），记录为"使用"
          if (d.isConsumed || (d.capacityPercent !== undefined && Number(d.capacityPercent) !== 100)) {
              dbAction = '使用';
          }
      }

      // 补充出库时的当前容量记录
      if (action === '出库') {
          // 确保details是对象
          if (!details || typeof details !== 'object') {
              details = {};
          }
          // 记录当前容量（出库前的容量）
          if (details.capacityValue === undefined || details.capacityValue === null) {
              details.capacityValue = instrument.currentCapacity;
          }
          if (details.usageAmount === undefined || details.usageAmount === null) {
              details.usageAmount = instrument.currentCapacity;
          }
      }

      // 将details转换为JSON字符串
      const detailsJson = typeof details === 'object' ? JSON.stringify(details) : (details || '{}');

      // 保存流程记录到数据库
      await db.run(
        `INSERT INTO flow_records (id, instrumentId, instrumentName, instrumentManagementNumber, action, operator, details, timestamp, usageAmount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, instrumentId, instrument.name, instrument.managementNumber || '', dbAction, operator, detailsJson, now, (details as any)?.usageAmount ?? (details as any)?.capacityValue ?? null]
      );

      // 更新仪器状态
      let newStatus: string;
      let newInOutStatus: string;
      let newCapacity: number | undefined;

      switch (action) {
        case '出库':
          newStatus = instrument.instrumentStatus || '';
          newInOutStatus = '已出库';
          break;
        case '入库':
          newStatus = instrument.instrumentStatus || '';
          newInOutStatus = '在库中';
          
          if (details) {
            // 解析 details（如果是字符串）
            const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;
            
            if (detailsObj.isConsumed) {
              newStatus = '已使用';
              newInOutStatus = '已消耗'; // 已用完则改为已消耗
              newCapacity = 0;
            } else if (detailsObj.capacityValue !== undefined && detailsObj.capacityValue !== null && detailsObj.capacityValue !== '') {
              newCapacity = Number(detailsObj.capacityValue);
            } else if (detailsObj.capacityPercent !== undefined && detailsObj.capacityPercent !== null && detailsObj.capacityPercent !== '') {
               // 如果是100%，则不修改容量
               if (Number(detailsObj.capacityPercent) === 100) {
                   // 不修改 newCapacity
               } else {
                   const current = Number(instrument.currentCapacity ?? 0);
                   const initial = Number(instrument.initialCapacity ?? 0);
                   const baseline = (instrument.currentCapacity !== undefined && instrument.currentCapacity !== null) 
                     ? current 
                     : (initial > 0 ? initial : current);
                   
                   newCapacity = baseline * (Number(detailsObj.capacityPercent) / 100);
               }
            }
          }
          break;
        case '使用':
          newStatus = '已使用';
          newInOutStatus = instrument.storageStatus || '';
          break;
        case '预约':
          // 预约不改变仪器状态
          newStatus = instrument.instrumentStatus || '';
          newInOutStatus = instrument.storageStatus || '';
          break;
        case '报废':
          newStatus = instrument.instrumentStatus || '';
          newInOutStatus = '在库中';
          break;
        default:
          newStatus = instrument.instrumentStatus || '';
          newInOutStatus = instrument.storageStatus || '';
      }

      // 更新仪器状态
      const updateData: any = {
        status: newStatus,
        inOutStatus: newInOutStatus
      };
      
      if (newCapacity !== undefined) {
        updateData.currentCapacity = newCapacity;
      }

      await instrumentService.update(instrumentId, updateData, { skipLog: true }, db);

      // 发送站内信通知（如果是标准物质使用/消耗）
      if (action === '入库' && details) {
          const d = typeof details === 'string' ? JSON.parse(details) : details;
          if (d.isConsumed || (d.capacityPercent !== undefined && Number(d.capacityPercent) !== 100)) {
               const title = d.isConsumed ? '标准物质已用完' : '标准物质使用记录';
               const content = `仪器/标准物质 "${instrument.name}" (${instrument.managementNumber || '-'}) ${d.isConsumed ? '已用完' : `已使用，剩余 ${d.capacityPercent}% (${newCapacity?.toFixed(2)}${instrument.unit || ''})`}. 操作人: ${operator}`;
               
               // 发送给管理员、负责人、设备管理员
               await siteMessageService.broadcastToRoles(['admin', 'principal', 'device_manager', '管理员', '负责人', '设备管理员'], title, content, 'info', undefined, instrumentId);
          }
      }

      // 返回创建的记录

      const record = await db.get('SELECT * FROM flow_records WHERE id = ?', [id]);
      if (record && record.details) {
        try {
          record.details = JSON.parse(record.details);
        } catch (e) {
          record.details = {};
        }
      }
      return record as FlowRecord;
    } catch (error) {
      console.error('记录流程操作失败:', error);
      throw error instanceof Error ? error : new Error('记录流程操作失败');
    }
  }

  async batchRecordFlow(records: Array<{ instrumentId: string, action: FlowAction, operator: string, details?: any }>): Promise<FlowRecord[]> {
    const db = dbConfig.getConnection();
    const successRecords: FlowRecord[] = [];

    try {
      return await db.transaction(async (txDb) => {
        for (const rec of records) {
          try {
            // Reuse recordFlow to ensure consistency in status updates
            const record = await this.recordFlow(rec.instrumentId, rec.action, rec.operator, rec.details, txDb);
            successRecords.push(record);
          } catch (e) {
            console.error(`批量记录失败 (ID: ${rec.instrumentId}):`, e);
            // Continue with other records even if one fails? 
            // Usually batch operations might want partial success.
            // If we are in a transaction, typically we want ALL or NOTHING.
            // But here the logic suggests continuing?
            // If we catch exception inside transaction loop and don't rethrow, the transaction continues.
            // But if one fails, do we want to commit others?
            // The original code tried to commit whatever succeeded.
            // But with SQLite transaction, if an error occurs, the transaction might be doomed?
            // "XACT_ABORT" setting usually rolls back everything.
            // In transaction, if we catch error and don't throw, we can proceed?
            // Yes.
          }
        }
        return successRecords;
      });
    } catch (error) {
      console.error('批量记录流程操作失败:', error);
      throw error instanceof Error ? error : new Error('批量记录流程操作失败');
    }
  }

  /**
   * 获取仪器当前状态
   */
  async getInstrumentStatus(instrumentId: string, dbOverride?: DatabaseAdapter): Promise<any> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      const instrument = await instrumentService.getById(instrumentId, db);
      if (!instrument) {
        throw new Error('仪器不存在');
      }
      
      return {
        status: instrument.instrumentStatus,
        storageStatus: instrument.storageStatus,
        currentCapacity: instrument.currentCapacity,
        location: instrument.storageLocation,
        lastCalibrationDate: instrument.calibrationDate,
        nextCalibrationDate: instrument.recalibrationDate
      };
    } catch (error) {
      console.error(`获取仪器状态失败 (ID: ${instrumentId}):`, error);
      throw new Error('获取仪器状态失败');
    }
  }

  /**
   * 获取仪器的流程记录
   */
  async getFlowRecords(instrumentId: string, limit: number = 50, dbOverride?: DatabaseAdapter): Promise<FlowRecord[]> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      let query = 'SELECT * FROM flow_records WHERE instrumentId = ? ORDER BY timestamp DESC';
      const params: any[] = [instrumentId];
      
        query += ' LIMIT ?';
        params.push(limit);

      const records = await db.all(query, params);
      
      // 解析details字段
      return records.map(record => {
        if (record.details) {
          try {
            record.details = JSON.parse(record.details);
          } catch (e) {
            record.details = {};
          }
        }
        return record as FlowRecord;
      });
    } catch (error) {
      console.error('获取流程记录失败:', error);
      throw new Error('获取流程记录失败');
    }
  }

  /**
   * 获取所有流程记录（分页）
   */
  async getAllFlowRecords(page: number = 1, limit: number = 20, filters?: any, dbOverride?: DatabaseAdapter): Promise<{
    records: FlowRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      let query = 'SELECT * FROM flow_records WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as total FROM flow_records WHERE 1=1';
      const params: any[] = [];
      const countParams: any[] = [];

      // 应用过滤条件
      if (filters) {
        if (filters.instrumentId) {
          query += ' AND instrumentId = ?';
          countQuery += ' AND instrumentId = ?';
          params.push(filters.instrumentId);
          countParams.push(filters.instrumentId);
        }
        if (filters.action) {
          query += ' AND action = ?';
          countQuery += ' AND action = ?';
          params.push(filters.action);
          countParams.push(filters.action);
        }
        if (filters.operator) {
          const operatorTerm = `%${filters.operator.toLowerCase()}%`;
          query += ' AND LOWER(operator) LIKE ?';
          countQuery += ' AND LOWER(operator) LIKE ?';
          params.push(operatorTerm);
          countParams.push(operatorTerm);
        }
        if (filters.startDate) {
          query += ' AND timestamp >= ?';
          countQuery += ' AND timestamp >= ?';
          params.push(filters.startDate);
          countParams.push(filters.startDate);
        }
        if (filters.endDate) {
          // 设置为结束日期的最后一刻
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          query += ' AND timestamp <= ?';
          countQuery += ' AND timestamp <= ?';
          params.push(endDate.toISOString());
          countParams.push(endDate.toISOString());
        }
      }

      // 按时间倒序排序
      query += ' ORDER BY timestamp DESC';

      // 分页
      const offset = (page - 1) * limit;
          query += ' LIMIT ? OFFSET ?';
          params.push(limit, offset);

      // 获取总数
      const countResult = await db.get(countQuery, countParams);
      const total = countResult?.total || 0;
      const totalPages = Math.ceil(total / limit);

      // 获取分页记录
      const records = await db.all(query, params);
      
      // 解析details字段
      const processedRecords = records.map(record => {
        if (record.details) {
          try {
            record.details = JSON.parse(record.details);
          } catch (e) {
            record.details = {};
          }
        }
        return record as FlowRecord;
      });

      return {
        records: processedRecords,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      console.error('获取所有流程记录失败:', error);
      throw new Error('获取所有流程记录失败');
    }
  }

  /**
   * 创建仪器预约
   */
  async createReservation(instrumentId: string, userId: string, startTime: string, endTime: string, purpose: string): Promise<Reservation> {
    const db = dbConfig.getConnection();
    
    return await db.transaction(async (txDb) => {
      try {
        // 验证仪器是否存在
        const instrument = await instrumentService.getById(instrumentId, txDb);
        if (!instrument) {
          throw new Error('仪器不存在');
        }

        // 检查时间冲突
        // We need to check conflicts using the transaction connection to see our own uncommitted changes if any (though here we just started)
        // But more importantly to see other committed changes and hold locks if necessary.
        // checkReservationConflicts needs to support dbOverride
        const conflicts = await this.checkReservationConflicts(instrumentId, startTime, endTime, txDb);
        if (conflicts.length > 0) {
          throw new Error('该时间段已有预约');
        }

        const now = new Date().toISOString();
        const id = this.generateUniqueId();

        // 保存预约记录到数据库
        await txDb.run(
          `INSERT INTO reservations (id, instrumentId, instrumentName, userId, startTime, endTime, purpose, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, instrumentId, instrument.name, userId, startTime, endTime, purpose, 'confirmed', now, now]
        );

        // 记录流程操作（为了在操作人列中显示）
        await this.recordFlow(instrumentId, '预约', userId, {
          reservationId: id,
          startTime,
          endTime,
          purpose
        }, txDb);

        // 返回创建的预约
        const reservation = await txDb.get('SELECT * FROM reservations WHERE id = ?', [id]);
        return reservation as Reservation;
      } catch (error) {
        console.error('创建预约失败:', error);
        throw error instanceof Error ? error : new Error('创建预约失败');
      }
    });
  }

  /**
   * 检查预约冲突
   */
  async checkReservationConflicts(instrumentId: string, startTime: string, endTime: string, dbOverride?: DatabaseAdapter): Promise<Reservation[]> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      // 查询时间冲突的预约
      const conflicts = await db.all(
        `SELECT * FROM reservations 
         WHERE instrumentId = ? AND 
               status = 'confirmed' AND 
               ((startTime < ? AND endTime > ?))`,
        [instrumentId, endTime, startTime]
      );
      return conflicts as Reservation[];
    } catch (error) {
      console.error('检查预约冲突失败:', error);
      throw new Error('检查预约冲突失败');
    }
  }

  /**
   * 获取仪器的预约记录
   */
  async getInstrumentReservations(instrumentId: string, includePast: boolean = false, dbOverride?: DatabaseAdapter): Promise<Reservation[]> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      let query = 'SELECT * FROM reservations WHERE instrumentId = ?';
      const params: any[] = [instrumentId];
      
      if (!includePast) {
        query += ' AND endTime >= ?';
        params.push(new Date().toISOString());
      }
      
      query += ' ORDER BY startTime ASC';
      
      const reservations = await db.all(query, params);
      return reservations as Reservation[];
    } catch (error) {
      console.error('获取预约记录失败:', error);
      throw new Error('获取预约记录失败');
    }
  }

  /**
   * 获取用户的预约记录
   */
  async getUserReservations(userId: string, includePast: boolean = false, dbOverride?: DatabaseAdapter): Promise<Reservation[]> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      let query = 'SELECT * FROM reservations WHERE userId = ?';
      const params: any[] = [userId];
      
      if (!includePast) {
        query += ' AND endTime >= ?';
        params.push(new Date().toISOString());
      }
      
      query += ' ORDER BY startTime ASC';
      
      const reservations = await db.all(query, params);
      return reservations as Reservation[];
    } catch (error) {
      console.error('获取用户预约记录失败:', error);
      throw new Error('获取用户预约记录失败');
    }
  }

  /**
   * 取消预约
   */
  async cancelReservation(reservationId: string, dbOverride?: DatabaseAdapter): Promise<boolean> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      
      // 检查预约是否存在
      const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', [reservationId]);
      if (!reservation) {
        throw new Error('预约不存在');
      }

      // 检查是否已经开始
      if (new Date(reservation.startTime) <= new Date()) {
        throw new Error('预约已经开始，无法取消');
      }

      // 更新状态
      await db.run(
        'UPDATE reservations SET status = ?, updatedAt = ? WHERE id = ?',
        ['cancelled', new Date().toISOString(), reservationId]
      );

      return true;
    } catch (error) {
      console.error('取消预约失败:', error);
      throw error instanceof Error ? error : new Error('取消预约失败');
    }
  }

  /**
   * 完成预约
   */
  async completeReservation(reservationId: string, dbOverride?: DatabaseAdapter): Promise<boolean> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      
      // 检查预约是否存在
      const reservation = await db.get('SELECT * FROM reservations WHERE id = ?', [reservationId]);
      if (!reservation) {
        throw new Error('预约不存在');
      }

      // 更新状态
      await db.run(
        'UPDATE reservations SET status = ?, updatedAt = ? WHERE id = ?',
        ['completed', new Date().toISOString(), reservationId]
      );

      return true;
    } catch (error) {
      console.error('完成预约失败:', error);
      throw error instanceof Error ? error : new Error('完成预约失败');
    }
  }

  /**
   * 获取仪器的当前状态
   */
  async clearInstrumentRecord(recordId: string, keepBasicData: boolean = false): Promise<boolean> {
    try {
      console.log(`清除仪器记录: ${recordId}, 保留基础数据: ${keepBasicData}`);
      
      const db = dbConfig.getConnection();
      
      // 执行删除操作
      const result = await db.run('DELETE FROM flow_records WHERE id = ?', [recordId]);
      
      if (!result || (result.changes ?? 0) === 0) {
        console.log(`未找到记录ID: ${recordId}`);
        return false;
      }
      
      // 记录操作日志
      console.log(`清除仪器记录: ${recordId}${keepBasicData ? '，保留基础数据' : ''}`);
      
      return true;
    } catch (error) {
      console.error('清除仪器记录失败:', error);
      throw error instanceof Error ? error : new Error('清除仪器记录失败');
    }
  }

  /**
   * 导出数据
   * @param filters 筛选条件
   * @param dateRange 日期范围
   * @param exportFormat 导出格式
   */
  async exportToExcel(filters: any = {}, dateRange?: { start: string; end: string }, exportFormat: string = 'excel'): Promise<any> {
    try {
      console.log(`导出${exportFormat}数据，筛选条件:`, filters, '日期范围:', dateRange);
      
      const db = dbConfig.getConnection();
      let query = 'SELECT * FROM flow_records WHERE 1=1';
      const params: any[] = [];
      
      // 应用搜索筛选
      if (filters?.search) {
        const searchTerm = `%${filters.search.toLowerCase()}%`;
        query += ` AND (LOWER(instrumentId) LIKE ? OR 
                      LOWER(action) LIKE ? OR 
                      LOWER(operator) LIKE ? OR
                      LOWER(details) LIKE ?)`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }
      
      // 应用其他筛选条件
      if (filters?.status) {
        const statusTerm = `%${filters.status.toLowerCase()}%`;
        query += ' AND LOWER(action) LIKE ?';
        params.push(statusTerm);
      }
      
      // 应用日期范围筛选
      if (dateRange?.start && dateRange?.end) {
        const startDate = new Date(dateRange.start).toISOString();
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        
        query += ' AND timestamp >= ? AND timestamp <= ?';
        params.push(startDate, endDate.toISOString());
      }
      
      // 按时间戳倒序排序
      query += ' ORDER BY timestamp DESC';
      
      // 执行查询
      const records = await db.all(query, params);
      
      // 解析details字段
      const filteredRecords = records.map(record => {
        if (record.details) {
          try {
            record.details = JSON.parse(record.details);
          } catch (e) {
            record.details = {};
          }
        }
        return record;
      });
      
      // 生成文件名
      const fileExtension = exportFormat === 'csv' ? 'csv' : 'xlsx';
      const fileName = `flow_records_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
      
      // 准备导出数据格式
      const exportData = filteredRecords.map(record => ({
        '记录ID': record.id,
        '仪器ID': record.instrumentId,
        '操作类型': record.action,
        '操作人': record.operator,
        '操作时间': new Date(record.timestamp).toLocaleString('zh-CN'),
        '操作详情': record.details || '-'
      }));
      
      // 返回导出数据信息
      return {
        fileName,
        format: exportFormat,
        recordsCount: filteredRecords.length,
        data: exportData,
        // 在实际应用中，可以在这里生成并返回文件流或文件URL
      };
    } catch (error) {
      console.error(`导出${exportFormat}失败:`, error);
      throw error instanceof Error ? error : new Error('导出数据失败');
    }
  }

  /**
   * 处理到期的预约，自动执行出库/入库
   */
  async processDueReservations(): Promise<number> {
    try {
      const db = dbConfig.getConnection();
      const nowIso = new Date().toISOString();
      const dueReservations = await db.all(
        `SELECT * FROM reservations WHERE status = 'confirmed' AND startTime <= ? ORDER BY startTime ASC`,
        [nowIso]
      );
      let processed = 0;
      for (const reservation of dueReservations) {
        const instrumentId = reservation.instrumentId;
        const userId = reservation.userId || 'system';
        const purpose: string = reservation.purpose || '';
        const isCheckIn = /入库/.test(purpose);
        const isCheckOut = /出库/.test(purpose) || (!isCheckIn);
        try {
          await this.recordFlow(
            instrumentId,
            isCheckIn ? ('入库' as FlowAction) : ('出库' as FlowAction),
            userId,
            { reservationId: reservation.id, auto: true, from: 'reservation' }
          );
          await db.run(
            'UPDATE reservations SET status = ?, updatedAt = ? WHERE id = ?',
            ['completed', new Date().toISOString(), reservation.id]
          );
          processed++;
        } catch (e) {
          console.error('自动执行预约失败:', e);
        }
      }
      return processed;
    } catch (error) {
      console.error('处理到期预约失败:', error);
      return 0;
    }
  }
}

export default new FlowService();