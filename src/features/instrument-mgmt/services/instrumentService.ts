import * as XLSX from 'xlsx';
import type { Instrument } from '../types';
import apiClient from '../../../services/apiClient';
import { messageService } from '../../../services/messageService';
import {
  CSV_FIELD_MAP,
  INSTRUMENT_FIELD_MAPPINGS,
  InstrumentStatus,
} from '../../../constants/instrument';
import {
  determineInstrumentType,
  mapApiResponseToInstrument,
  mapBackendToFrontend,
  mapFrontendToBackend,
  processInstrumentDates,
  safeFormatDate,
  transformDataForBackend,
} from '../../../utils/instrumentMapping';
import {
  buildFailureResult,
  mapInstrumentListResponse,
  mapSeedInstrumentResponse,
  toErrorMessage,
} from './instrumentServiceUtils';

export {
  INSTRUMENT_FIELD_MAPPINGS,
  mapFrontendToBackend,
  mapBackendToFrontend,
  mapApiResponseToInstrument,
  safeFormatDate,
};

export const mapDataToFrontend = (data: any): Partial<Instrument> => {
  return mapBackendToFrontend(data) as unknown as Partial<Instrument>;
};

export const fetchInstruments = async (): Promise<Instrument[]> => {
  try {
    const res = await apiClient.get('/instruments', {
      params: { page: 1, pageSize: 1000 },
      disableCache: true,
      cache: 'no-store',
    });
    return mapInstrumentListResponse(res.data);
  } catch (error) {
    console.error('加载数据失败:', error);
    return [];
  }
};

export const addInstrumentHistoryRecord = async (
  instrumentId: string,
  data: {
    type: string;
    operator: string;
    detail: string;
    timestamp?: string;
  },
): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await apiClient.post('/flow/record', {
      instrumentId,
      action: data.type,
      operator: data.operator,
      details: {
        notes: data.detail,
        manualDate: data.timestamp,
      },
    });

    if (res.success) {
      return { success: true };
    }

    return buildFailureResult(res.message || '添加记录失败');
  } catch (error) {
    console.error('添加历史记录失败:', error);
    return buildFailureResult(toErrorMessage(error, '添加记录失败'));
  }
};

export const getInstruments = async () => {
  try {
    const instruments = await fetchInstruments();
    return {
      success: true,
      data: instruments,
      message: '获取仪器列表成功',
    };
  } catch (error) {
    console.error('获取仪器列表失败:', error);
    return {
      success: false,
      data: [],
      message: toErrorMessage(error, '获取仪器列表失败'),
    };
  }
};

export const getInstrumentById = async (
  id: string,
): Promise<{ success: boolean; data?: Instrument; message?: string }> => {
  try {
    const res = await apiClient.get(`/instruments/${id}`);
    if (res.success && res.data) {
      return { success: true, data: mapApiResponseToInstrument(res.data) };
    }
    return buildFailureResult(res.message || '获取仪器详情失败');
  } catch (error) {
    console.error(`获取仪器 ${id} 失败:`, error);
    return buildFailureResult('获取仪器详情失败');
  }
};

export const deleteInstrument = async (id: string): Promise<boolean> => {
  try {
    const res = await apiClient.delete(`/instruments/${id}`);
    return !!res.success;
  } catch (error) {
    console.error('删除操作失败:', error);
    return false;
  }
};

export const batchDeleteInstruments = async (
  ids: string[],
): Promise<{ success: boolean; message?: string; deletedCount?: number }> => {
  try {
    const res = await apiClient.post('/instruments/batch/delete', { ids });
    if (res.success) {
      return {
        success: true,
        message: res.message,
        deletedCount: (res.data as any)?.deletedCount ?? res.deletedCount,
      };
    }

    return buildFailureResult(res.message || '删除请求失败');
  } catch (error) {
    console.error('批量删除操作失败:', error);
    return buildFailureResult(`批量删除失败: ${toErrorMessage(error, '未知错误')}`);
  }
};

export const batchImportInstruments = async (
  instruments: Omit<Instrument, 'id'>[],
): Promise<{ success: boolean; count?: number; message?: string }> => {
  try {
    const res = await apiClient.post('/instruments/batch', instruments);
    return {
      success: !!res.success,
      count: (res.data as any)?.successCount ?? (Array.isArray(res.data) ? res.data.length : undefined),
    };
  } catch (error) {
    console.error('导入失败:', error);
    return buildFailureResult('导入失败，请检查文件格式并重试');
  }
};

export const seedInstruments = async (
  count: number = 20,
): Promise<{ success: boolean; count?: number; data?: Instrument[]; message?: string }> => {
  try {
    const res = await apiClient.post('/instruments/seed', { count });
    if (!res.success) {
      return buildFailureResult(res.message || '生成测试数据失败');
    }
    const { mapped, count: resultCount } = mapSeedInstrumentResponse(res.data);
    return { success: true, count: resultCount, data: mapped };
  } catch (error) {
    console.error('生成测试数据失败:', error);
    return buildFailureResult(`生成测试数据失败: ${toErrorMessage(error, '未知错误')}`);
  }
};

export const parseCSVToInstruments = (csvContent: string): Omit<Instrument, 'id'>[] => {
  const lines = csvContent.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((header) => header.trim());
  const instruments: Instrument[] = [];
  const fieldMap: { [key: string]: keyof Instrument } = CSV_FIELD_MAP as any;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    const instrument: Partial<Instrument> = {
      purchaseDate: new Date().toLocaleDateString(),
    };

    values.forEach((value, index) => {
      if (index < headers.length) {
        const header = headers[index];
        const field = fieldMap[header];
        if (field) {
          instrument[field] = value.trim() as any;
        }
      }
    });

    if (!instrument.status) instrument.status = InstrumentStatus.IN_USE;
    if (!instrument.inOutStatus) instrument.inOutStatus = '在库中';
    if (!instrument.quantity) instrument.quantity = 1;
    instrument.type = determineInstrumentType(instrument) as any;

    instruments.push(instrument as Instrument);
  }

  return instruments;
};

export const readExcelFile = async (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        resolve(jsonData);
      } catch {
        reject(new Error('Excel文件解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取错误'));
    reader.readAsArrayBuffer(file);
  });
};

export const parseExcelToInstruments = (data: any[][]): Omit<Instrument, 'id'>[] => {
  if (!data || data.length === 0) return [];

  const headers = data[0].map((h: any) => String(h).trim());
  const instruments: Instrument[] = [];
  const fieldMap: { [key: string]: keyof Instrument } = CSV_FIELD_MAP as any;

  let startIndex = 1;
  if (data.length > 1) {
    const secondRowFirstCell = String(data[1]?.[0] || '');
    if (
      secondRowFirstCell.includes('说明') ||
      secondRowFirstCell.includes('符号使用') ||
      secondRowFirstCell.includes('HTML')
    ) {
      startIndex = 2;
    }
  }

  for (let i = startIndex; i < data.length; i += 1) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    if (row.every((cell: any) => !cell)) continue;

    const instrument: Partial<Instrument> = {
      purchaseDate: new Date().toLocaleDateString(),
    };

    row.forEach((value: any, index: number) => {
      if (index < headers.length) {
        const header = headers[index];
        const field = fieldMap[header];
        if (field) {
          instrument[field] = String(value || '').trim() as any;
        }
      }
    });

    if (!instrument.name) {
      instrument.name = `未命名仪器(Excel行 ${i + 1})`;
    }
    if (!instrument.status) instrument.status = InstrumentStatus.IN_USE;
    if (!instrument.inOutStatus) instrument.inOutStatus = '在库中';
    if (!instrument.quantity) instrument.quantity = 1;
    instrument.type = determineInstrumentType(instrument) as any;

    instruments.push(instrument as Instrument);
  }

  return instruments;
};

export const readCSVFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('文件读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取错误'));
    reader.readAsText(file);
  });
};

export async function getInstrumentHistory(
  instrumentId: string,
  limit: number = 50,
): Promise<Array<{ id: string; timestamp: string; type: string; operator: string; detail: string; details?: any }>> {
  try {
    const response = await apiClient.get(`/flow/instrument/${instrumentId}`, {
      params: { limit },
    });

    const data = Array.isArray(response.data) ? response.data : response.data?.data || [];

    return data.map((item: any) => ({
      id: item.id,
      timestamp: item.timestamp || item.operation_time,
      type: item.actionType || item.type || item.operation_type || item.action,
      operator: item.operator,
      details: item,
      detail: item.summary || item.details?.notes || item.detail || item.notes || '',
    }));
  } catch (error) {
    console.error('获取仪器历史记录失败:', error);
    return [];
  }
}

export const updateInstrument = async (
  id: string,
  instrumentData: Partial<Instrument>,
): Promise<{ success: boolean; message?: string; data?: Instrument; reason?: string; status?: number }> => {
  try {
    const processedData = processInstrumentDates(instrumentData);
    const transformedData = transformDataForBackend(processedData);
    const filteredData = Object.fromEntries(
      Object.entries(transformedData).filter(([_, value]) => value !== undefined),
    );

    const res = await apiClient.put(`/instruments/${id}`, filteredData);
    if (!res.success) {
      return {
        success: false,
        message: res.message || '更新失败',
        reason: (res.data as any)?.reason,
        status: (res.data as any)?.status,
      };
    }

    const mappedResult = mapApiResponseToInstrument(res.data);

    if (mappedResult.status === InstrumentStatus.USED) {
      messageService.addMessage({
        title: '仪器状态更新',
        content: `此条仪器已被已使用，请注意查看: ${mappedResult.name} (${mappedResult.model || '-'})`,
        type: 'info',
        source: 'instrument',
        relatedId: mappedResult.id,
      });
    } else if (mappedResult.status === InstrumentStatus.STOPPED) {
      messageService.addMessage({
        title: '仪器状态更新',
        content: `此条仪器已被停用，请注意查看: ${mappedResult.name} (${mappedResult.model || '-'})`,
        type: 'warning',
        source: 'instrument',
        relatedId: mappedResult.id,
      });
    }

    return {
      success: true,
      data: mappedResult,
    };
  } catch (error) {
    const status = (error as any)?.statusCode;
    const data = (error as any)?.data;
    const backendMsg = (data && (data.message || data.error)) || undefined;
    const reason =
      (data && data.reason) ||
      (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : undefined);
    const msg = backendMsg || (error instanceof Error ? error.message : '未知错误');
    return { success: false, message: `更新失败: ${msg}`, reason, status };
  }
};

export const addInstrument = async (
  instrumentData: Omit<Instrument, 'id'>,
): Promise<{ success: boolean; message?: string; data?: Instrument }> => {
  try {
    const processedData = processInstrumentDates(instrumentData);
    const transformedData = transformDataForBackend(processedData);
    const filteredData = Object.fromEntries(
      Object.entries(transformedData).filter(([_, value]) => value !== undefined),
    );

    const res = await apiClient.post('/instruments', filteredData);
    if (!res.success) {
      return { success: false, message: res.message || '添加失败' };
    }

    const mappedResult = mapApiResponseToInstrument(res.data);
    return {
      success: true,
      data: mappedResult,
    };
  } catch (error) {
    console.error('添加操作失败:', error);
    return { success: false, message: `添加失败: ${toErrorMessage(error, '未知错误')}` };
  }
};
