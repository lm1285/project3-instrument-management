import express from 'express';
import { authMiddleware } from '../middleware/auth';
import instrumentService from '../services/instrumentService';
import flowService from '../services/flowService';
import { createStructuredInstrumentLogDetails } from '../services/instrumentLogService';
import { InstrumentFormData } from '../types/instrument';

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const filters: Record<string, string> = {};
    Object.entries(req.query).forEach(([key, value]) => {
      if (
        key !== 'page' &&
        key !== 'pageSize' &&
        key !== 'search' &&
        key !== 'searchKeyword' &&
        value !== undefined
      ) {
        filters[key] = value as string;
      }
    });

    const params = {
      page: parseInt(req.query.page as string, 10) || 1,
      pageSize: parseInt(req.query.pageSize as string, 10) || 10,
      searchKeyword: (req.query.searchKeyword as string) || (req.query.search as string),
      filters,
    };

    const result = await instrumentService.getAll(params);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/available-frequency', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const pageSize = parseInt(String(req.query.pageSize || '50'), 10) || 50;
    const rawStatus = String(req.query.status || '').toLowerCase();
    const status =
      rawStatus === 'completed' ? 'completed' : rawStatus === 'pending' ? 'pending' : undefined;

    const result = await instrumentService.getAvailableForFrequencyPaged(page, pageSize, status as any);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取频率预警列表失败', error: String(error) });
  }
});

router.get('/available-frequency/stream', async (req, res) => {
  const page = parseInt(String(req.query.page || '1'), 10) || 1;
  const pageSize = parseInt(String(req.query.pageSize || '50'), 10) || 50;
  const rawStatus = String(req.query.status || '').toLowerCase();
  const status =
    rawStatus === 'completed' ? 'completed' : rawStatus === 'pending' ? 'pending' : undefined;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  let timer: NodeJS.Timeout | undefined;

  const send = async () => {
    try {
      const result = await instrumentService.getAvailableForFrequencyPaged(page, pageSize, status as any);
      res.write(`data: ${JSON.stringify({ success: true, ...result })}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ success: false, message: '获取失败' })}\n\n`);
    }
  };

  await send();
  timer = setInterval(send, 1000);
  req.on('close', () => {
    if (timer) clearInterval(timer);
  });
});

router.get('/by-keys', async (req, res) => {
  try {
    const mnRaw = String(req.query.managementNumbers || '').trim();
    const snRaw = String(req.query.serialNumbers || '').trim();
    const managementNumbers = mnRaw ? mnRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const serialNumbers = snRaw ? snRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const list = await instrumentService.getByKeys(managementNumbers, serialNumbers);
    res.status(200).json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, message: '批量查询失败', error: String(error) });
  }
});

router.get('/management/:managementNumber', async (req, res) => {
  try {
    const instrument = await instrumentService.getByManagementNumber(req.params.managementNumber);
    if (instrument) {
      res.status(200).json(instrument);
    } else {
      res.status(404).json({ success: false, message: '仪器不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/search/query', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, message: '搜索关键字不能为空' });
    }

    const results = await instrumentService.search({ keyword: query });
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const instrument = await instrumentService.getById(req.params.id);
    if (instrument) {
      res.status(200).json(instrument);
    } else {
      res.status(404).json({ success: false, message: '仪器不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.post('/', async (req, res) => {
  try {
    const instrumentData: InstrumentFormData = req.body;
    const newInstrument = await instrumentService.create(instrumentData);

    try {
      const currentUser = (req as any).user;
      const bodyOperator = (req.body as any)?.operator;
      const operator =
        (bodyOperator && bodyOperator !== '系统' ? bodyOperator : null) ||
        currentUser?.username ||
        '系统';

      await flowService.recordFlow(
        newInstrument.id,
        '创建' as any,
        operator,
        createStructuredInstrumentLogDetails({
          action: 'create',
          after: newInstrument as any,
          source: 'instrument.form',
          extra: {
            summary: `创建仪器 ${newInstrument.name}${newInstrument.managementNumber ? `（${newInstrument.managementNumber}）` : ''}`,
          },
        }),
      );
    } catch {}

    res.status(201).json(newInstrument);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const instrumentData: Partial<InstrumentFormData> = req.body;
    const beforeInstrument = await instrumentService.getById(req.params.id);
    const success = await instrumentService.update(req.params.id, instrumentData);

    if (success) {
      const updatedInstrument = await instrumentService.getById(req.params.id);
      try {
        const currentUser = (req as any).user;
        const bodyOperator = (req.body as any)?.operator;
        const operator =
          (bodyOperator && bodyOperator !== '系统' ? bodyOperator : null) ||
          currentUser?.username ||
          '系统';

        await flowService.recordFlow(
          req.params.id,
          '编辑' as any,
          operator,
          createStructuredInstrumentLogDetails({
            action: 'update',
            before: beforeInstrument as any,
            after: updatedInstrument as any,
            source: 'instrument.form',
          }),
        );
      } catch {}

      res.status(200).json(updatedInstrument);
    } else {
      res.status(404).json({ success: false, message: '仪器不存在', reason: 'NOT_FOUND' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '服务器错误';
    const reason = /管理编号已存在/.test(String(msg))
      ? 'DUPLICATE_MANAGEMENT_NUMBER'
      : 'UPDATE_FAILED';
    res.status(500).json({ success: false, message: `更新失败: ${msg}`, reason });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const instrumentData: Partial<InstrumentFormData> = req.body;
    const beforeInstrument = await instrumentService.getById(req.params.id);
    const success = await instrumentService.update(req.params.id, instrumentData);

    if (success) {
      const updatedInstrument = await instrumentService.getById(req.params.id);
      try {
        const currentUser = (req as any).user;
        const bodyOperator = (req.body as any)?.operator;
        const operator =
          (bodyOperator && bodyOperator !== '系统' ? bodyOperator : null) ||
          currentUser?.name ||
          currentUser?.username ||
          '系统';

        await flowService.recordFlow(
          req.params.id,
          '编辑' as any,
          operator,
          createStructuredInstrumentLogDetails({
            action: 'update',
            before: beforeInstrument as any,
            after: updatedInstrument as any,
            source: 'instrument.form',
          }),
        );
      } catch {}

      res.status(200).json(updatedInstrument);
    } else {
      res.status(404).json({ success: false, message: '仪器不存在', reason: 'NOT_FOUND' });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : '服务器错误';
    const reason = /管理编号已存在/.test(String(msg))
      ? 'DUPLICATE_MANAGEMENT_NUMBER'
      : 'UPDATE_FAILED';
    res.status(500).json({ success: false, message: `更新失败: ${msg}`, reason });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const instrumentDataList = req.body;

    if (!Array.isArray(instrumentDataList)) {
      return res.status(400).json({ success: false, message: '请求体必须是数组格式' });
    }

    const result = await instrumentService.batchCreate(instrumentDataList);

    try {
      const records = result.map((inst) => ({
        instrumentId: inst.id,
        action: '创建' as any,
        operator: '系统',
        details: { ...inst, method: 'batch_import' },
      }));
      await flowService.batchRecordFlow(records);
    } catch (e) {
      console.error('批量创建日志记录失败:', e);
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.delete('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供有效的仪器ID列表', deletedCount: 0 });
    }

    const result = await instrumentService.batchDelete(ids);
    if (result.success) {
      res.status(200).json({ success: true, message: '批量删除成功', deletedCount: result.deletedCount });
    } else {
      res.status(404).json({ success: false, message: '未找到可删除的仪器', deletedCount: 0 });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误', deletedCount: 0 });
  }
});

router.post('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供有效的仪器ID列表', deletedCount: 0 });
    }

    try {
      await flowService.batchRecordFlow(
        ids.map((id: string) => ({
          instrumentId: id,
          action: '删除' as any,
          operator: '系统',
          details: { batch: true },
        })),
      );
    } catch {}

    const result = await instrumentService.batchDelete(ids);
    if (result.success) {
      res.status(200).json({ success: true, message: '批量删除成功', deletedCount: result.deletedCount });
    } else {
      res.status(404).json({ success: false, message: '未找到可删除的仪器', deletedCount: 0 });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误', deletedCount: 0 });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const beforeInstrument = await instrumentService.getById(req.params.id);

    try {
      const currentUser = (req as any).user;
      const bodyOperator = (req.body as any)?.operator;
      const operator =
        (bodyOperator && bodyOperator !== '系统' ? bodyOperator : null) ||
        currentUser?.name ||
        currentUser?.username ||
        '系统';

      await flowService.recordFlow(
        req.params.id,
        '删除' as any,
        operator,
        createStructuredInstrumentLogDetails({
          action: 'delete',
          before: beforeInstrument as any,
          source: 'instrument.form',
        }),
      );
    } catch {}

    const success = await instrumentService.delete(req.params.id);
    if (success) {
      res.status(200).json({ success: true, message: '删除成功' });
    } else {
      res.status(404).json({ success: false, message: '仪器不存在' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const { count } = req.body || {};
    const n = typeof count === 'number' && count > 0 ? Math.min(count, 200) : 20;

    const types = ['标准器', '标准物质', '辅助设备'];
    const names = ['万用表', 'pH计', '电子秤', '温度计', '压力表', '色谱仪', '光度计', '电导率仪'];
    const models = ['Fluke 87V', 'PH-100', 'HX-200', 'DT-10', 'PG-400', 'GC-7890', 'UV-1800', 'EC-500'];
    const manufacturers = ['Fluke', 'Thermo', 'Agilent', 'Shimadzu', 'Mettler', 'Keysight', 'Hanna', 'Ohaus'];
    const departments = ['理化', '热工'];
    const statuses = ['使用中', '已使用', '停用'];
    const storageStatuses = ['在库中', '已出库'];

    const pad = (num: number, len: number) => String(num).padStart(len, '0');
    const today = new Date();
    const y = today.getFullYear();
    const m = pad(today.getMonth() + 1, 2);
    const d = pad(today.getDate(), 2);

    const data: InstrumentFormData[] = Array.from({ length: n }).map((_, i) => {
      const idx = i % names.length;
      return {
        type: types[i % types.length],
        name: names[idx],
        model: models[idx],
        serialNumber: `${names[idx].slice(0, 2).toUpperCase()}-${y}${m}${d}-${pad(i + 1, 3)}`,
        managementNumber: `M-${y}${m}${d}-${pad(i + 1, 3)}`,
        manufacturer: manufacturers[i % manufacturers.length],
        measureRange: idx === 0 ? '0-1000V' : idx === 1 ? '0-14 pH' : '0-1000 g',
        uncertainty: idx === 0 ? '±0.05%' : idx === 1 ? '±0.02 pH' : '±0.1 g',
        traceabilityMethod: '校准',
        calibrationDate: new Date(Date.now() - (i % 12) * 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        nextCalibrationDate: new Date(Date.now() + ((i % 12) + 6) * 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        calibrationCycle: '12',
        calibrationInstitution: '省计量院',
        traceabilityCertificate: '',
        department: departments[i % departments.length],
        location: `仓库${(i % 3) + 1}`,
        status: statuses[i % statuses.length],
        inOutStatus: storageStatuses[i % storageStatuses.length],
        remarks: '',
      };
    });

    const created = await instrumentService.batchCreate(data);

    try {
      const records = created.map((inst) => ({
        instrumentId: inst.id,
        action: '创建' as any,
        operator: '系统',
        details: { ...inst, method: 'seed' },
      }));
      await flowService.batchRecordFlow(records);
    } catch (e) {
      console.error('Seed 日志记录失败:', e);
    }

    res.status(201).json({ success: true, message: '测试数据生成完成', count: created.length, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : '服务器错误' });
  }
});

export default router;
