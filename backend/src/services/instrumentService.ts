import {
  Instrument,
  InstrumentFormData,
  InstrumentPageResponse,
  InstrumentQueryParams,
  mapBackendToFrontend,
  mapFrontendToBackend,
} from '../types/instrument';
import dbConfig from '../config/dbConfig';
import { DatabaseAdapter } from '../config/dbAdapter';
import mergeService from './mergeService';
import flowService from './flowService';

class InstrumentService {
  private generateUniqueId(): string {
    return `INS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async getAll(params: InstrumentQueryParams): Promise<InstrumentPageResponse> {
    try {
      const { searchKeyword, filters = {}, page = 1, pageSize = 10 } = params;
      const db = dbConfig.getConnection();

      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      let query = `SELECT
        instruments.*,
        mg.name as mergeGroupName,
        mg.model as mergeGroupModel,
        mg.measurementRange as mergeGroupMeasurementRange,
        (SELECT MAX(timestamp) FROM flow_records fr
           WHERE fr.instrumentId = instruments.id
             AND fr.action = '出库'
        ) AS lastCheckoutTime,
        (SELECT MAX(timestamp) FROM flow_records fr
           WHERE fr.instrumentId = instruments.id
             AND fr.action IN ('入库', '使用')
        ) AS lastCheckinOrUseTime,
        (SELECT operator FROM flow_records fr
           WHERE fr.instrumentId = instruments.id
             AND fr.action IN ('出库', '入库', '使用', '借用', '预约')
           ORDER BY timestamp DESC
        ) AS lastOperator,
        (SELECT action FROM flow_records fr
           WHERE fr.instrumentId = instruments.id
             AND fr.action != '状态更新'
           ORDER BY timestamp DESC
        ) AS lastAction,
        (SELECT MAX(timestamp) FROM flow_records fr
           WHERE fr.instrumentId = instruments.id
             AND fr.action IN ('出库', '入库', '使用', '借用', '预约')
        ) AS lastFlowTime
      FROM instruments
      LEFT JOIN merge_groups mg ON instruments.mergeGroupId = mg.id
      WHERE 1=1`;

      const paramsArray: any[] = [];
      const scope = (params as any)?.filters?.scope;

      if (scope === 'flow') {
        query += ` AND (instruments.instrumentStatus IS NULL OR instruments.instrumentStatus NOT IN ('停用', '已使用'))
                   AND (instruments.status IS NULL OR instruments.status NOT IN ('停用', '已使用'))`;
      }

      if (searchKeyword) {
        const searchTerm = `%${searchKeyword.toLowerCase()}%`;
        query += ` AND (
          LOWER(instruments.name) LIKE ? OR
          LOWER(instruments.model) LIKE ? OR
          LOWER(instruments.managementNumber) LIKE ? OR
          LOWER(instruments.factoryNumber) LIKE ? OR
          LOWER(instruments.measurementRange) LIKE ? OR
          LOWER(mg.name) LIKE ?
        )`;
        paramsArray.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (key === 'scope') {
          return;
        }

        if (value && typeof value === 'string' && value !== '全部' && value !== 'all') {
          let dbField = key;
          if (key === 'status') dbField = 'instruments.instrumentStatus';
          if (key === 'inOutStatus') dbField = 'instruments.storageStatus';
          if (key === 'location') dbField = 'instruments.storageLocation';
          if (!dbField.includes('.')) dbField = `instruments.${dbField}`;

          query += ` AND LOWER(${dbField}) = LOWER(?)`;
          paramsArray.push(value);
        }
      });

      if (scope === 'flow' && !searchKeyword) {
        query += ` AND (
          instruments.storageStatus IN ('已出库', '外出使用', '借用')
          OR
          (SELECT MAX(timestamp) FROM flow_records fr
             WHERE fr.instrumentId = instruments.id
               AND fr.action IN ('出库', '入库', '使用', '借用', '预约')
          ) >= '${startIso}'
        )`;
      }

      const countQuery = `SELECT COUNT(*) as total FROM (${query}) as subquery`;
      const countResult = await db.get(countQuery, paramsArray);
      const total = countResult?.total || 0;

      if (scope === 'flow' && !searchKeyword) {
        query += ` ORDER BY (SELECT MAX(timestamp) FROM flow_records fr WHERE fr.instrumentId = instruments.id) DESC`;
      } else {
        query += ' ORDER BY instruments.createdAt DESC';
      }

      query += ' LIMIT ? OFFSET ?';
      paramsArray.push(pageSize, (page - 1) * pageSize);

      const rows = await db.all(query, paramsArray);
      const frontendData = rows.map((instrument: any) => {
        const isCompletedCycle = ['已入库', '在库中'].includes(instrument.storageStatus);
        const lastFlowTime = new Date(instrument.lastFlowTime || 0).getTime();
        const startOfTodayTime = new Date(startIso).getTime();

        if (isCompletedCycle && lastFlowTime < startOfTodayTime) {
          instrument.lastCheckoutTime = null;
          instrument.lastCheckinOrUseTime = null;
          instrument.lastOperator = null;
          instrument.lastAction = null;
          instrument.lastBorrower = null;
        }

        return mapBackendToFrontend(instrument);
      });

      return {
        data: frontendData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error('获取仪器列表失败:', error);
      throw new Error('获取仪器列表失败');
    }
  }

  async getById(id: string, dbOverride?: DatabaseAdapter): Promise<Instrument | null> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      const instrument = await db.get('SELECT * FROM instruments WHERE id = ?', [id]);
      return instrument ? mapBackendToFrontend(instrument) : null;
    } catch (error) {
      console.error(`获取仪器ID ${id} 失败:`, error);
      throw new Error('获取仪器失败');
    }
  }

  async getByKeys(managementNumbers: string[], serialNumbers: string[]): Promise<Instrument[]> {
    const db = dbConfig.getConnection();
    const mn = (managementNumbers || []).filter(Boolean);
    const sn = (serialNumbers || []).filter(Boolean);
    const clauses: string[] = [];
    const params: any[] = [];

    if (mn.length) {
      clauses.push(`managementNumber IN (${mn.map(() => '?').join(',')})`);
      params.push(...mn);
    }

    if (sn.length) {
      clauses.push(`serialNumber IN (${sn.map(() => '?').join(',')})`);
      params.push(...sn);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' OR ')}` : '';
    const rows = await db.all(`SELECT * FROM instruments ${where}`.trim(), params);
    return rows || [];
  }

  async getAvailableForFrequencyPaged(
    page: number = 1,
    pageSize: number = 50,
    status?: 'pending' | 'completed',
  ): Promise<{ data: Instrument[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const db = dbConfig.getConnection();
    const suggRows: Array<{ members_json: string }> = await db.all(
      `SELECT members_json FROM merge_suggestions WHERE status = 'pending'`,
    );

    const excludeManagementNumbers: string[] = [];
    const excludeSerialNumbers: string[] = [];

    for (const row of suggRows || []) {
      try {
        const members: any[] = JSON.parse(row?.members_json || '[]');
        for (const member of members) {
          const managementNumber = String(member?.managementNumber || '');
          const serialNumber = String(member?.serialNumber || '');
          if (managementNumber) excludeManagementNumbers.push(managementNumber);
          if (serialNumber) excludeSerialNumbers.push(serialNumber);
        }
      } catch {}
    }

    const filters: string[] = [];
    const params: any[] = [];
    filters.push(`LOWER(i.type) = LOWER('标准物质')`);
    filters.push(
      `(LOWER(i.instrumentStatus) IN (LOWER('使用中'), LOWER('超期使用')) OR LOWER(i.status) IN (LOWER('使用中'), LOWER('超期使用')))`,
    );

    if (excludeManagementNumbers.length) {
      filters.push(
        `(i.managementNumber IS NULL OR i.managementNumber NOT IN (${excludeManagementNumbers
          .map(() => '?')
          .join(',')}))`,
      );
      params.push(...excludeManagementNumbers);
    }

    if (excludeSerialNumbers.length) {
      filters.push(
        `(i.serialNumber IS NULL OR i.serialNumber NOT IN (${excludeSerialNumbers.map(() => '?').join(',')}))`,
      );
      params.push(...excludeSerialNumbers);
    }

    if (status === 'pending') {
      filters.push(`COALESCE(n.status, 'pending') = 'pending'`);
    } else if (status === 'completed') {
      filters.push(`COALESCE(n.status, 'pending') = 'completed'`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countRow = await db.get(
      `SELECT COUNT(*) as total FROM instruments i LEFT JOIN name_usage_settings n ON i.name = n.name ${where}`.trim(),
      params,
    );
    const total = Number((countRow as any)?.total || 0);
    const offset = Math.max(0, (page - 1) * pageSize);

    let dataQuery = `SELECT i.* FROM instruments i LEFT JOIN name_usage_settings n ON i.name = n.name ${where} ORDER BY i.updatedAt DESC`;
    const dataParams = [...params];
    dataQuery += ' LIMIT ? OFFSET ?';
    dataParams.push(pageSize, offset);

    const rows = await db.all(dataQuery, dataParams);
    const data = (rows || []).map((instrument: any) => mapBackendToFrontend(instrument));
    const totalPages = Math.ceil(total / Math.max(1, pageSize));

    return { data, total, page, pageSize, totalPages };
  }

  async getByManagementNumber(managementNumber: string, dbOverride?: DatabaseAdapter): Promise<Instrument | null> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      const instrument = await db.get('SELECT * FROM instruments WHERE managementNumber = ?', [managementNumber]);
      return instrument ? mapBackendToFrontend(instrument) : null;
    } catch (error) {
      console.error(`获取管理编号 ${managementNumber} 失败:`, error);
      throw new Error('获取仪器失败');
    }
  }

  private async _createSingle(instrumentData: InstrumentFormData, dbOverride?: DatabaseAdapter): Promise<Instrument> {
    const db = dbOverride || dbConfig.getConnection();

    if (instrumentData.managementNumber) {
      const existing = await this.getByManagementNumber(instrumentData.managementNumber, db);
      if (existing) {
        throw new Error(`管理编号 ${instrumentData.managementNumber} 已存在`);
      }
    }

    const now = new Date().toISOString();
    const id = this.generateUniqueId();
    const data = mapFrontendToBackend(instrumentData);

    const columns = [
      'id',
      'type',
      'name',
      'model',
      'factoryNumber',
      'managementNumber',
      'manufacturer',
      'measurementRange',
      'measurementUncertainty',
      'traceabilityMethod',
      'calibrationDate',
      'recalibrationDate',
      'cycle',
      'traceabilityAgency',
      'traceabilityCertificate',
      'department',
      'storageLocation',
      'instrumentStatus',
      'storageStatus',
      'remarks',
      'currentCapacity',
      'unit',
      'initialCapacity',
      'excludeFromAutoGroup',
      'mergeGroupId',
      'attachment',
      'enableDate',
      'metrologicalParameterRange',
      'acceptanceDate',
      'purchaseDate',
      'purchasePerson',
      'disableReason',
      'disabler',
      'disableTime',
      'groupName',
      'groupModel',
      'groupMeasurementRange',
      'alertLevel',
      'alertMode',
      'serialNumber',
      'measureRange',
      'uncertainty',
      'nextCalibrationDate',
      'calibrationCycle',
      'calibrationInstitution',
      'location',
      'status',
      'inOutStatus',
      'certificateNumber',
      'createdAt',
      'updatedAt',
    ];

    const placeholders = columns.map(() => '?').join(', ');
    const values = [
      id,
      data.type || '通用',
      data.name || '',
      data.model || '',
      data.factoryNumber || '',
      data.managementNumber || '',
      data.manufacturer || '',
      data.measurementRange || '',
      data.measurementUncertainty || '',
      data.traceabilityMethod || '',
      data.calibrationDate || '',
      data.recalibrationDate || '',
      data.cycle || '12',
      data.traceabilityAgency || '',
      data.traceabilityCertificate || '',
      data.department || '',
      data.storageLocation || '',
      data.instrumentStatus || '正常',
      data.storageStatus || '在库中',
      data.remarks || '',
      data.currentCapacity ?? null,
      data.unit || '',
      instrumentData.initialCapacity ?? data.currentCapacity ?? null,
      (instrumentData as any)?.excludeFromAutoGroup ? 1 : 0,
      data.mergeGroupId ?? null,
      data.attachment || '',
      data.enableDate || '',
      data.metrologicalParameterRange || '',
      data.acceptanceDate || '',
      data.purchaseDate || '',
      data.purchasePerson || '',
      data.disableReason || '',
      data.disabler || '',
      data.disableTime || '',
      data.groupName ?? null,
      data.groupModel ?? null,
      data.groupMeasurementRange ?? null,
      data.alertLevel ?? null,
      data.alertMode ?? null,
      data.factoryNumber || '',
      data.measurementRange || '',
      data.measurementUncertainty || '',
      data.recalibrationDate || '',
      data.cycle || '12',
      data.traceabilityAgency || '',
      data.storageLocation || '',
      data.instrumentStatus || '正常',
      data.storageStatus || '在库中',
      data.traceabilityCertificate || '',
      now,
      now,
    ];

    await db.run(`INSERT INTO instruments (${columns.join(',')}) VALUES (${placeholders})`, values);

    const created = await this.getById(id, db);
    if (!created) {
      throw new Error('创建仪器后无法获取');
    }

    return created;
  }

  async create(instrumentData: InstrumentFormData): Promise<Instrument> {
    try {
      if (instrumentData.quantity && instrumentData.quantity > 1 && instrumentData.splitRecord) {
        const db = dbConfig.getConnection();
        const count = instrumentData.quantity;
        const baseManagementNumber = instrumentData.managementNumber;

        return await db.transaction(async (txDb) => {
          const createdInstruments: Instrument[] = [];

          for (let i = 0; i < count; i += 1) {
            const singleData = { ...instrumentData };
            if (baseManagementNumber) {
              singleData.managementNumber = `${baseManagementNumber}-${i + 1}`;
            }
            delete singleData.quantity;
            delete singleData.splitRecord;

            const created = await this._createSingle(singleData, txDb);
            createdInstruments.push(created);
          }

          return createdInstruments[0];
        });
      }

      return this._createSingle(instrumentData);
    } catch (error) {
      console.error('创建仪器失败:', error);
      throw error instanceof Error ? error : new Error('创建仪器失败');
    }
  }

  async update(
    id: string,
    instrumentData: Partial<InstrumentFormData>,
    options?: { skipLog?: boolean },
    dbOverride?: DatabaseAdapter,
  ): Promise<Instrument | null> {
    try {
      const db = dbOverride || dbConfig.getConnection();
      const existingInstrument = await this.getById(id, db);
      if (!existingInstrument) {
        return null;
      }

      if (
        instrumentData.managementNumber &&
        instrumentData.managementNumber !== (existingInstrument as any).managementNumber
      ) {
        const existing = await this.getByManagementNumber(instrumentData.managementNumber, db);
        if (existing && existing.id !== id) {
          throw new Error('管理编号已存在');
        }
      }

      const mappedData = mapFrontendToBackend(instrumentData);
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      const addField = (condition: boolean, fields: string | string[], values: any | any[]) => {
        if (!condition) return;
        if (Array.isArray(fields)) {
          updateFields.push(...fields);
        } else {
          updateFields.push(fields);
        }
        if (Array.isArray(values)) {
          updateValues.push(...values);
        } else {
          updateValues.push(values);
        }
      };

      addField(mappedData.name !== undefined, 'name = ?', mappedData.name);
      addField(mappedData.type !== undefined, 'type = ?', mappedData.type);
      addField(mappedData.model !== undefined, 'model = ?', mappedData.model);
      addField(
        mappedData.factoryNumber !== undefined,
        ['factoryNumber = ?', 'serialNumber = ?'],
        [mappedData.factoryNumber, mappedData.factoryNumber],
      );
      addField(mappedData.managementNumber !== undefined, 'managementNumber = ?', mappedData.managementNumber);
      addField(mappedData.manufacturer !== undefined, 'manufacturer = ?', mappedData.manufacturer);
      addField(
        mappedData.measurementRange !== undefined,
        ['measurementRange = ?', 'measureRange = ?'],
        [mappedData.measurementRange, mappedData.measurementRange],
      );
      addField(
        mappedData.measurementUncertainty !== undefined,
        ['measurementUncertainty = ?', 'uncertainty = ?'],
        [mappedData.measurementUncertainty, mappedData.measurementUncertainty],
      );
      addField(mappedData.traceabilityMethod !== undefined, 'traceabilityMethod = ?', mappedData.traceabilityMethod);
      addField(mappedData.calibrationDate !== undefined, 'calibrationDate = ?', mappedData.calibrationDate);
      addField(
        mappedData.recalibrationDate !== undefined,
        ['recalibrationDate = ?', 'nextCalibrationDate = ?'],
        [mappedData.recalibrationDate, mappedData.recalibrationDate],
      );
      addField(mappedData.cycle !== undefined, ['cycle = ?', 'calibrationCycle = ?'], [mappedData.cycle, mappedData.cycle]);
      addField(
        mappedData.traceabilityAgency !== undefined,
        ['traceabilityAgency = ?', 'calibrationInstitution = ?'],
        [mappedData.traceabilityAgency, mappedData.traceabilityAgency],
      );
      addField(mappedData.traceabilityCertificate !== undefined, ['traceabilityCertificate = ?', 'certificateNumber = ?'], [mappedData.traceabilityCertificate, mappedData.traceabilityCertificate]);
      addField(mappedData.department !== undefined, 'department = ?', mappedData.department);
      addField(
        mappedData.storageLocation !== undefined,
        ['storageLocation = ?', 'location = ?'],
        [mappedData.storageLocation, mappedData.storageLocation],
      );
      addField(
        mappedData.instrumentStatus !== undefined,
        ['instrumentStatus = ?', 'status = ?'],
        [mappedData.instrumentStatus, mappedData.instrumentStatus],
      );
      addField(
        mappedData.storageStatus !== undefined,
        ['storageStatus = ?', 'inOutStatus = ?'],
        [mappedData.storageStatus, mappedData.storageStatus],
      );
      addField(mappedData.remarks !== undefined, 'remarks = ?', mappedData.remarks);
      addField(mappedData.currentCapacity !== undefined, 'currentCapacity = ?', mappedData.currentCapacity);
      addField(mappedData.unit !== undefined, 'unit = ?', mappedData.unit);
      addField(instrumentData.initialCapacity !== undefined, 'initialCapacity = ?', instrumentData.initialCapacity);
      addField(mappedData.groupName !== undefined, 'groupName = ?', mappedData.groupName);
      addField(mappedData.groupModel !== undefined, 'groupModel = ?', mappedData.groupModel);
      addField(mappedData.groupMeasurementRange !== undefined, 'groupMeasurementRange = ?', mappedData.groupMeasurementRange);
      addField((instrumentData as any)?.excludeFromAutoGroup !== undefined, 'excludeFromAutoGroup = ?', (instrumentData as any)?.excludeFromAutoGroup ? 1 : 0);
      addField(mappedData.alertLevel !== undefined, 'alertLevel = ?', mappedData.alertLevel);
      addField(mappedData.alertMode !== undefined, 'alertMode = ?', mappedData.alertMode);
      addField(mappedData.mergeGroupId !== undefined, 'mergeGroupId = ?', mappedData.mergeGroupId || null);
      addField(mappedData.attachment !== undefined, 'attachment = ?', mappedData.attachment);
      addField(mappedData.enableDate !== undefined, 'enableDate = ?', mappedData.enableDate);
      addField(mappedData.metrologicalParameterRange !== undefined, 'metrologicalParameterRange = ?', mappedData.metrologicalParameterRange);
      addField(mappedData.acceptanceDate !== undefined, 'acceptanceDate = ?', mappedData.acceptanceDate);
      addField(mappedData.purchaseDate !== undefined, 'purchaseDate = ?', mappedData.purchaseDate);
      addField(mappedData.purchasePerson !== undefined, 'purchasePerson = ?', mappedData.purchasePerson);
      addField(mappedData.disableReason !== undefined, 'disableReason = ?', mappedData.disableReason);
      addField(mappedData.disabler !== undefined, 'disabler = ?', mappedData.disabler);
      addField(mappedData.disableTime !== undefined, 'disableTime = ?', mappedData.disableTime);

      if (updateFields.length === 0) {
        return existingInstrument;
      }

      updateFields.push('updatedAt = ?');
      updateValues.push(new Date().toISOString(), id);

      const result = await db.run(
        `UPDATE instruments SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues,
      );

      if ((result?.changes ?? 0) <= 0) {
        return null;
      }

      const updated = await this.getById(id, db);

      try {
        if ((updated as any)?.name) {
          await mergeService.resyncByName((updated as any).name);
        }
        mergeService.invalidateLiveCache();
      } catch {}

      try {
        if (!options?.skipLog && updated) {
          const fieldsToCheck = [
            'name',
            'type',
            'model',
            'serialNumber',
            'managementNumber',
            'manufacturer',
            'measureRange',
            'uncertainty',
            'traceabilityMethod',
            'calibrationDate',
            'nextCalibrationDate',
            'calibrationCycle',
            'traceabilityCertificate',
            'calibrationInstitution',
            'department',
            'location',
            'status',
            'inOutStatus',
            'remarks',
            'currentCapacity',
            'unit',
            'groupName',
            'groupModel',
            'groupMeasureRange',
            'excludeFromAutoGroup',
            'alertLevel',
            'alertMode',
            'mergeGroupId',
          ];

          for (const field of fieldsToCheck) {
            const prevVal = (existingInstrument as any)?.[field];
            const nextVal = (updated as any)?.[field];
            if (String(prevVal ?? '') !== String(nextVal ?? '')) {
              await flowService.recordFlow(
                id,
                '状态更新' as any,
                '系统',
                { field, from: prevVal ?? '', to: nextVal ?? '' },
                db,
              );
            }
          }
        }
      } catch {}

      return updated;
    } catch (error) {
      console.error(`更新仪器ID ${id} 失败:`, error);
      throw error instanceof Error ? error : new Error('更新仪器失败');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const db = dbConfig.getConnection();

      return await db.transaction(async (txDb) => {
        const existing = await txDb.get('SELECT id FROM instruments WHERE id = ?', [id]);
        if (!existing) {
          return false;
        }

        await txDb.run('DELETE FROM flow_records WHERE instrumentId = ?', [id]);
        await txDb.run('DELETE FROM reservations WHERE instrumentId = ?', [id]);
        await txDb.run('DELETE FROM alerts WHERE instrumentId = ?', [id]);
        await txDb.run('DELETE FROM merge_group_member_backups WHERE instrumentId = ?', [id]);

        const result = await txDb.run('DELETE FROM instruments WHERE id = ?', [id]);
        return (result?.changes ?? 0) > 0;
      });
    } catch (error) {
      console.error(`删除仪器ID ${id} 失败:`, error);
      throw new Error('删除仪器失败');
    }
  }

  async batchCreate(instrumentsData: InstrumentFormData[]): Promise<Instrument[]> {
    try {
      const createdInstruments: Instrument[] = [];

      for (const data of instrumentsData) {
        const mappedData = mapFrontendToBackend(data);

        if (mappedData.managementNumber && (data as any).quantity && (data as any).quantity > 1) {
          for (let i = 0; i < (data as any).quantity; i += 1) {
            const batchData = { ...mappedData };
            if (/\d+$/.test(mappedData.managementNumber)) {
              const baseNumber = mappedData.managementNumber.match(/^(.*?)(\d+)$/)!;
              batchData.managementNumber =
                baseNumber[1] + (parseInt(baseNumber[2], 10) + i).toString().padStart(baseNumber[2].length, '0');
            } else {
              batchData.managementNumber = `${mappedData.managementNumber}-${i + 1}`;
            }

            const instrument = await this.create(batchData as InstrumentFormData);
            createdInstruments.push(instrument);
          }
        } else {
          const instrument = await this.create(mappedData as InstrumentFormData);
          createdInstruments.push(instrument);
        }
      }

      return createdInstruments;
    } catch (error) {
      console.error('批量创建仪器失败:', error);
      throw error instanceof Error ? error : new Error('批量创建仪器失败');
    }
  }

  async batchDelete(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const db = dbConfig.getConnection();

      return await db.transaction(async (txDb) => {
        if (!ids || ids.length === 0) {
          throw new Error('未提供有效的删除ID列表');
        }

        const normalizedIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
        if (normalizedIds.length === 0) {
          throw new Error('未提供有效的删除ID列表');
        }

        const placeholders = normalizedIds.map(() => '?').join(',');
        const existingRows = await txDb.all(
          `SELECT id FROM instruments WHERE id IN (${placeholders})`,
          normalizedIds,
        );
        const existingIds = (existingRows || []).map((row: any) => String(row.id));

        if (existingIds.length === 0) {
          return { success: false, deletedCount: 0 };
        }

        const existingPlaceholders = existingIds.map(() => '?').join(',');

        await txDb.run(`DELETE FROM flow_records WHERE instrumentId IN (${existingPlaceholders})`, existingIds);
        await txDb.run(`DELETE FROM reservations WHERE instrumentId IN (${existingPlaceholders})`, existingIds);
        await txDb.run(`DELETE FROM alerts WHERE instrumentId IN (${existingPlaceholders})`, existingIds);
        await txDb.run(
          `DELETE FROM merge_group_member_backups WHERE instrumentId IN (${existingPlaceholders})`,
          existingIds,
        );

        const result = await txDb.run(`DELETE FROM instruments WHERE id IN (${existingPlaceholders})`, existingIds);
        const deletedCount = result?.changes ?? 0;

        return {
          success: deletedCount > 0,
          deletedCount,
        };
      });
    } catch (error) {
      console.error('批量删除仪器失败:', error);
      throw new Error('批量删除仪器失败');
    }
  }

  async search(params: any): Promise<Instrument[]> {
    try {
      const { keyword, instrumentStatus, storageStatus, department, page = 1, pageSize = 10 } = params;
      const db = dbConfig.getConnection();

      const queryConditions: string[] = [];
      const queryParams: any[] = [];

      if (keyword) {
        const searchTerm = `%${keyword.toLowerCase()}%`;
        queryConditions.push(`(
          LOWER(name) LIKE ? OR
          LOWER(model) LIKE ? OR
          LOWER(factoryNumber) LIKE ? OR
          LOWER(managementNumber) LIKE ? OR
          LOWER(manufacturer) LIKE ? OR
          LOWER(serialNumber) LIKE ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (instrumentStatus) {
        queryConditions.push('(instrumentStatus = ? OR status = ?)');
        queryParams.push(instrumentStatus, instrumentStatus);
      }

      if (storageStatus) {
        queryConditions.push('(storageStatus = ? OR inOutStatus = ?)');
        queryParams.push(storageStatus, storageStatus);
      }

      if (department) {
        queryConditions.push('department = ?');
        queryParams.push(department);
      }

      let query = 'SELECT * FROM instruments';
      if (queryConditions.length > 0) {
        query += ` WHERE ${queryConditions.join(' AND ')}`;
      }

      query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
      queryParams.push(pageSize, (page - 1) * pageSize);

      const instruments = await db.all(query, queryParams);
      return instruments.map((instrument: any) => mapBackendToFrontend(instrument));
    } catch (error) {
      console.error('搜索仪器失败:', error);
      throw new Error('搜索仪器失败');
    }
  }
}

export default new InstrumentService();
