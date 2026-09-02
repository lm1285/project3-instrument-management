import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { checkPermission } from '../middleware/permission';
import flowService from '../services/flowService';
import instrumentService from '../services/instrumentService';
import instrumentLogService from '../services/instrumentLogService';
import { FlowRecordQuery } from '../types/flow';

const router = express.Router();
router.use(authMiddleware);

router.get('/system-config', (_req, res) => {
  res.json({
    departments: ['化验室', '研发部', '质量部', '生产部', '设备部'],
    operators: ['张三', '李四', '王五', '赵六', '钱七'],
    locations: ['A楼1层', 'A楼2层', 'B楼1层', 'B楼2层', '仓库'],
    purposes: ['常规检测', '研发测试', '质量控制', '校准', '维修']
  });
});

/**
 * @route POST /api/flow/record
 * @desc 记录仪器流程操作
 */
router.post('/record', async (req, res) => {
  const user = (req as any).user;
  if (!user) {
     return res.status(401).json({ success: false, error: '未登录' });
  }
  try {
    const { instrumentId, action, operator, details } = req.body;
    
    // 优先使用前端传入的operator（非'系统'时），其次使用Token中的真实姓名，最后使用用户名
    const actualOperator = (operator && operator !== '系统' ? operator : null) || user.username || '系统';
    
    if (!instrumentId || !action || !actualOperator) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const normalizedDetails =
      details && typeof details === 'object'
        ? {
            source:
              typeof (details as any).source === 'string' ? (details as any).source : 'manual.log',
            actionType:
              typeof (details as any).actionType === 'string'
                ? (details as any).actionType
                : String(action || ''),
            category:
              typeof (details as any).category === 'string' ? (details as any).category : 'manual',
            ...details,
          }
        : details;

    const flowRecord = await flowService.recordFlow(
      instrumentId,
      action,
      actualOperator,
      normalizedDetails,
    );
    res.status(201).json({ success: true, data: flowRecord });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '记录流程操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/instrument-flows/:id/check-out
 * @desc 出库操作（兼容前端API）
 */
router.post('/instrument-flows/:id/check-out', checkPermission('flow:checkout'), async (req, res) => {
  const user = (req as any).user;
  try {
    const instrumentId = req.params.id;
    const { department, purpose, expected_return_time, notes, borrower } = req.body;
    
    // 使用Token中的用户名
    let actualOperator = user.username || '系统';
    
    // 如果有借用人，拼接到操作人后面
    if (borrower) {
      actualOperator = `${actualOperator} (${borrower})`;
    }
    
    if (!actualOperator) {
      return res.status(400).json({ message: '缺少必要参数: 操作人(operator)' });
    }

    const inst = await instrumentService.getById(instrumentId);
    if (!inst) {
      return res.status(404).json({ success: false, message: '仪器不存在' });
    }
    const status = (inst as any).instrumentStatus || (inst as any).status || '';
    if (status === '停用' || status === '已使用') {
      return res.status(403).json({ success: false, message: `仪器状态为${status}，不得进行出入库操作` });
    }

    const details = {
      department,
      purpose,
      expectedReturnTime: expected_return_time,
      notes,
      borrower: borrower || undefined
    };

    const action = '出库';
    const flowRecord = await flowService.recordFlow(instrumentId, action, actualOperator, details);
    res.status(200).json({ 
      success: true,
      data: { 
        ...flowRecord 
      },
      message: '仪器出库成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '出库操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/instrument-flows/:id/check-in
 * @desc 入库操作（兼容前端API）
 */
router.post('/instrument-flows/:id/check-in', async (req, res) => {
  const user = (req as any).user;
  if (!user) {
     return res.status(401).json({ success: false, error: '未登录' });
  }
  try {
    const instrumentId = req.params.id;
    const { operator, location, condition, usage_time, notes, isConsumed, capacityPercent, capacityValue, borrower } = req.body;
    
    // 使用Token中的真实姓名，或者用户名
    let actualOperator = user.username || '系统';
    
    // 如果有借用人，拼接到操作人后面
    if (borrower) {
      actualOperator = `${actualOperator} (${borrower})`;
    }
    
    if (!actualOperator) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const inst = await instrumentService.getById(instrumentId);
    if (!inst) {
      return res.status(404).json({ success: false, message: '仪器不存在' });
    }
    const status = (inst as any).instrumentStatus || (inst as any).status || '';
    if (status === '停用' || status === '已使用') {
      return res.status(403).json({ success: false, message: `仪器状态为${status}，不得进行出入库操作` });
    }

    const details = {
      location,
      condition,
      usageTime: usage_time,
      notes,
      isConsumed,
      capacityPercent,
      capacityValue,
      operator: operator, // 前端传来的显示名
      borrower: borrower || undefined
    };

    const flowRecord = await flowService.recordFlow(instrumentId, '入库', actualOperator, details);
    res.status(200).json({ 
      success: true,
      data: { 
        ...flowRecord 
      },
      message: '仪器入库成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '入库操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/instrument-flows/:id/borrow
 * @desc 借用操作
 */
router.post('/instrument-flows/:id/borrow', async (req, res) => {
  const user = (req as any).user;
  if (!user) {
     return res.status(401).json({ success: false, error: '未登录' });
  }
  try {
    const instrumentId = req.params.id;
    const { borrower, notes } = req.body;
    
    // 使用Token中的用户名
    let actualOperator = user.username || '系统';
    
    if (!borrower) {
      return res.status(400).json({ message: '缺少必要参数: 借用人(borrower)' });
    }

    const inst = await instrumentService.getById(instrumentId);
    if (!inst) {
      return res.status(404).json({ success: false, message: '仪器不存在' });
    }
    const status = (inst as any).instrumentStatus || (inst as any).status || '';
    if (status === '停用' || status === '已使用') {
      return res.status(403).json({ success: false, message: `仪器状态为${status}，不得进行出入库操作` });
    }

    const details = {
      purpose: '借用',
      borrower,
      notes,
      department: (inst as any).department || ''
    };

    // 借用视为出库的一种
    const action = '出库'; 
    
    const flowRecord = await flowService.recordFlow(instrumentId, action, actualOperator, details);
    res.status(200).json({ 
      success: true,
      data: { 
        ...flowRecord 
      },
      message: '仪器借用成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '借用操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/instrument-flows/:id/use
 * @desc 使用操作（兼容前端API）
 */
router.post('/instrument-flows/:id/use', async (req, res) => {
  const currentUser = (req as any).user;
  if (!currentUser) {
     return res.status(401).json({ success: false, error: '未登录' });
  }
  try {
    const instrumentId = req.params.id;
    const { purpose, usage_time, notes } = req.body;
    
    // 使用Token中的真实姓名，或者用户名
    const actualUser = currentUser.username || '系统';
    
    if (!actualUser || !purpose) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const inst = await instrumentService.getById(instrumentId);
    if (!inst) {
      return res.status(404).json({ success: false, message: '仪器不存在' });
    }
    const status = (inst as any).instrumentStatus || (inst as any).status || '';
    if (status === '停用' || status === '已使用') {
      return res.status(403).json({ success: false, message: `仪器状态为${status}，不得进行出入库操作` });
    }

    const details = {
      purpose,
      usageTime: usage_time,
      notes
    };

    const flowRecord = await flowService.recordFlow(instrumentId, '使用', actualUser, details);
    res.status(200).json({ 
      success: true,
      data: { 
        ...flowRecord 
      },
      message: '仪器使用记录成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '使用操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/instrument-flows/:id/reset
 * @desc 重置仪器状态（兼容前端API）
 */
router.post('/instrument-flows/:id/reset', async (req, res) => {
  try {
    const instrumentId = req.params.id;
    const operator = req.body.operator || 'system';

    const details = {
      reason: '重置仪器状态'
    };

    const flowRecord = await flowService.recordFlow(instrumentId, '入库', operator, details);
    res.status(200).json({ 
      success: true,
      data: { 
        ...flowRecord 
      },
      message: '仪器状态重置成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '重置操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/records
 * @desc 获取所有流程记录（分页）
 */
router.get('/records', async (req, res) => {
  try {
    const queryParams: FlowRecordQuery = {
      instrumentId: req.query.instrumentId as string,
      action: req.query.action as any,
      operator: req.query.operator as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    };

    const result = await flowService.getAllFlowRecords(
      queryParams.page,
      queryParams.limit,
      {
        instrumentId: queryParams.instrumentId,
        action: queryParams.action,
        operator: queryParams.operator,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate
      }
    );

    // 兼容前端的数据格式
    const formattedData = {
      data: result.records.map(record => ({
        id: record.id,
        instrument_id: record.instrumentId,
        operation_type: record.action,
        operator: record.operator,
        department: record.details?.department || '',
        purpose: record.details?.purpose || '',
        operation_time: record.timestamp,
        notes: record.details?.notes || ''
      })),
      total: result.total
    };

    res.status(200).json({ 
      success: true,
      ...formattedData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取流程记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/instrument-flows
 * @desc 获取流程记录（兼容前端API）
 */
router.get('/instrument-flows', async (req, res) => {
  try {
    const params = {
      instrument_id: req.query.instrument_id as string,
      operation_type: req.query.operation_type as string,
      start_date: req.query.start_date as string,
      end_date: req.query.end_date as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    };

    const result = await flowService.getAllFlowRecords(
      params.page,
      params.pageSize,
      {
        instrumentId: params.instrument_id,
        action: params.operation_type as any,
        startDate: params.start_date,
        endDate: params.end_date
      }
    );

    // 转换为前端期望的格式
    const formattedData = {
      data: result.records.map(record => ({
        id: record.id,
        instrument_id: record.instrumentId,
        operation_type: record.action,
        operator: record.operator,
        department: record.details?.department || '',
        purpose: record.details?.purpose || '',
        operation_time: record.timestamp,
        notes: record.details?.notes || ''
      })),
      total: result.total
    };

    res.status(200).json({ 
      success: true,
      ...formattedData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取流程记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/instrument/:instrumentId
 * @desc 获取特定仪器的流程记录
 */
router.get('/instrument/:instrumentId', async (req, res) => {
  try {
    const instrumentId = req.params.instrumentId;
    const limit = parseInt(req.query.limit as string) || 200;
    const actionType = (req.query.actionType as string) || '';
    const keyword = (req.query.keyword as string) || '';
    const startDate = (req.query.startDate as string) || '';
    const endDate = (req.query.endDate as string) || '';

    const records = await instrumentLogService.getInstrumentLogs(instrumentId, {
      limit,
      actionType,
      keyword,
      startDate,
      endDate,
    });
    res.status(200).json({ 
      success: true,
      data: records
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取仪器流程记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/reservation
 * @desc 创建仪器预约
 */
router.post('/reservation', async (req, res) => {
  try {
    const { instrumentId, userId, startTime, endTime, purpose } = req.body;

    if (!instrumentId || !userId || !startTime || !endTime || !purpose) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const reservation = await flowService.createReservation(
      instrumentId,
      userId,
      startTime,
      endTime,
      purpose
    );

    res.status(201).json({ 
      success: true,
      data: reservation,
      message: '预约创建成功'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '创建预约失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/reservations
 * @desc 获取预约列表（兼容前端API）
 */
router.get('/reservations', async (req, res) => {
  try {
    const params = {
      instrument_id: req.query.instrument_id as string,
      user_id: req.query.user_id as string,
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20
    };

    let reservations: any[] = [];
    let total = 0;

    // 根据参数获取预约列表
    if (params.instrument_id) {
      const instrumentReservations = await flowService.getInstrumentReservations(params.instrument_id, true);
      reservations = instrumentReservations;
      total = instrumentReservations.length;
    } else if (params.user_id) {
      const userReservations = await flowService.getUserReservations(params.user_id, true);
      reservations = userReservations;
      total = userReservations.length;
    }

    // 根据状态过滤
    if (params.status) {
      reservations = reservations.filter(r => r.status === params.status);
      total = reservations.length;
    }

    // 简单分页
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    const paginatedReservations = reservations.slice(start, end);

    // 转换为前端期望的格式
    const formattedData = {
      data: paginatedReservations.map(reservation => ({
        id: reservation.id,
        instrument_id: reservation.instrumentId,
        user_id: reservation.userId,
        reservation_time: reservation.createdAt,
        start_time: reservation.startTime,
        end_time: reservation.endTime,
        purpose: reservation.purpose,
        status: reservation.status
      })),
      total: total
    };

    res.status(200).json({ 
      success: true,
      ...formattedData
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取预约列表失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/system-config
 * @desc 获取系统配置（兼容前端API）
 */
router.get('/system-config', async (req, res) => {
  try {
    // 返回模拟的系统配置数据
    const config = {
      departments: ['质检部', '研发部', '生产部', '实验室', '其他'],
      operators: ['张三', '李四', '王五', '赵六', '系统管理员'],
      locations: ['1楼仓库', '2楼实验室A', '2楼实验室B', '3楼研发室', '4楼会议室'],
      purposes: ['日常检测', '研发测试', '校准', '维护', '培训', '其他']
    };

    res.status(200).json({ 
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取系统配置失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/reservations/instrument/:instrumentId
 * @desc 获取特定仪器的预约记录
 */
router.get('/reservations/instrument/:instrumentId', async (req, res) => {
  try {
    const instrumentId = req.params.instrumentId;
    const includePast = req.query.includePast === 'true';

    const reservations = await flowService.getInstrumentReservations(instrumentId, includePast);
    res.status(200).json({ 
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取仪器预约记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/reservations/user/:userId
 * @desc 获取特定用户的预约记录
 */
router.get('/reservations/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const includePast = req.query.includePast === 'true';

    const reservations = await flowService.getUserReservations(userId, includePast);
    res.status(200).json({ 
      success: true,
      data: reservations
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取用户预约记录失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route PUT /api/flow/reservation/:id/cancel
 * @desc 取消预约
 */
router.put('/reservation/:id/cancel', async (req, res) => {
  try {
    const reservationId = req.params.id;
    const success = await flowService.cancelReservation(reservationId);

    if (success) {
      res.status(200).json({ 
        success: true, 
        message: '预约已取消'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: '预约不存在'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '取消预约失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route PUT /api/flow/reservation/:id/complete
 * @desc 完成预约
 */
router.put('/reservation/:id/complete', async (req, res) => {
  try {
    const reservationId = req.params.id;
    const success = await flowService.completeReservation(reservationId);

    if (success) {
      res.status(200).json({ 
        success: true, 
        message: '预约已完成'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        message: '预约不存在'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '完成预约失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/flow/status/:instrumentId
 * @desc 获取仪器的当前状态
 */
router.get('/status/:instrumentId', async (req, res) => {
  try {
    const instrumentId = req.params.instrumentId;
    const status = await flowService.getInstrumentStatus(instrumentId);
    res.status(200).json({ 
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取仪器状态失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/record/batch
 * @desc 批量记录流程操作
 */
router.post('/record/batch', async (req, res) => {
  try {
    const operations = req.body;

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ message: '请提供有效的操作数组' });
    }

    const records = await flowService.batchRecordFlow(operations);
    res.status(201).json({
      success: true,
      message: `成功记录 ${records.length}/${operations.length} 条操作`,
      data: records
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '批量记录操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/check-conflict
 * @desc 检查预约冲突
 */
router.post('/check-conflict', async (req, res) => {
  try {
    const { instrumentId, startTime, endTime, excludeReservationId } = req.body;

    if (!instrumentId || !startTime || !endTime) {
      return res.status(400).json({ message: '缺少必要参数' });
    }

    const conflicts = await flowService.checkReservationConflicts(instrumentId, startTime, endTime);
    
    // 如果提供了排除的预约ID，则过滤掉该预约
    const filteredConflicts = excludeReservationId 
      ? conflicts.filter(c => c.id !== excludeReservationId)
      : conflicts;

    res.status(200).json({
      success: true,
      data: {
        hasConflict: filteredConflicts.length > 0,
        conflicts: filteredConflicts
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '检查冲突失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route DELETE /api/flow/records/:id
 * @desc 清除仪器记录（兼容前端API）
 */
router.delete('/records/:id', async (req, res) => {
  try {
    const recordId = req.params.id;
    if (!recordId) {
      return res.status(400).json({ 
        success: false, 
        message: '记录ID不能为空',
        error: 'Missing record ID'
      });
    }

    const keepBasicData = req.query.keepBasicData === 'true';
    
    // 调用服务层方法清除记录
    const result = await flowService.clearInstrumentRecord(recordId, keepBasicData);

    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: '未找到指定记录',
        error: 'Record not found'
      });
    }

    // 返回成功响应
    res.status(200).json({ 
      success: true, 
      data: { recordId },
      message: '仪器记录已成功清除'
    });
  } catch (error) {
    // 处理错误情况
    console.error('清除仪器记录失败:', error);
    res.status(500).json({ 
      success: false, 
      message: error instanceof Error ? error.message : '清除记录操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route POST /api/flow/export-excel
 * @desc 导出Excel（兼容前端API）
 */
router.post('/export-excel', async (req, res) => {
  try {
    // 从请求体获取导出参数
    const { filters, dateRange, exportFormat } = req.body;
    
    // 参数验证
    if (!exportFormat || ['excel', 'csv'].indexOf(exportFormat) === -1) {
      return res.status(400).json({ 
        success: false, 
        message: '导出格式无效，必须是excel或csv',
        error: 'Invalid export format'
      });
    }
    
    // 调用服务层方法处理导出
    const result = await flowService.exportToExcel(filters, dateRange, exportFormat);
    
    // 返回成功响应，包含导出的文件链接或数据
    res.status(200).json({
      success: true,
      data: result,
      message: '数据导出成功'
    });
  } catch (error) {
    // 处理错误情况
    console.error('导出数据失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '导出数据操作失败',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
