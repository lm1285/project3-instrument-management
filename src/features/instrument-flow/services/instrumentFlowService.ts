// 导入类型定义
import type { Instrument } from '../types';
import apiClient from '../../../services/apiClient';
import { mapApiResponseToInstrument } from '../../../utils/instrumentMapping';
import {
  buildQueryString,
  mapFlowInstrumentList,
  mapFlowRecordsResponse,
} from './instrumentFlowServiceUtils';

interface InstrumentFlowRecord {
  id: string;
  instrument_id: string;
  operation_type: string;
  operator: string;
  department: string;
  purpose: string;
  operation_time: string;
  notes?: string;
}

interface Reservation {
  id: string;
  instrument_id: string;
  user_id: string;
  reservation_time: string;
  start_time: string;
  end_time: string;
  purpose: string;
  status: string;
}

// 模拟延迟
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 由统一 apiClient 负责 GET 缓存与在途去重

// 真实API调用函数
async function fetchAPI<T>(endpoint: string, options?: (RequestInit & { disableCache?: boolean })): Promise<T> {
  await delay(300);
  const method = String(options?.method || 'GET').toUpperCase();
  if (method === 'GET') {
    const res = await apiClient.get(endpoint, { disableCache: options?.disableCache });
    return (res.data as T);
  } else if (method === 'POST') {
    const body = options?.body ? JSON.parse(options.body as any) : undefined;
    const res = await apiClient.post(endpoint, body);
    return (res.data as T);
  } else if (method === 'PUT') {
    const body = options?.body ? JSON.parse(options.body as any) : undefined;
    const res = await apiClient.put(endpoint, body);
    return (res.data as T);
  } else if (method === 'PATCH') {
    const body = options?.body ? JSON.parse(options.body as any) : undefined;
    const res = await apiClient.patch(endpoint, body);
    return (res.data as T);
  } else if (method === 'DELETE') {
    const res = await apiClient.delete(endpoint);
    return (res.data as T);
  }
  const res = await apiClient.get(endpoint);
  return (res.data as T);
}

// 使用真实API获取数据

// 获取仪器列表
export async function getInstruments(params?: {
  search?: string;
  flow_status?: string;
  status?: string;
  department?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: any[]; total: number }> {
  await delay(300);
  
  try {
    const queryParams = buildQueryString({
      searchKeyword: params?.search,
      inOutStatus: params?.flow_status,
      status: params?.status,
      department: params?.department,
      type: params?.type,
      page: params?.page ? String(params.page) : undefined,
      pageSize: params?.pageSize ? String(params.pageSize) : undefined,
      scope: 'flow',
    });
    const response = await fetchAPI<any>(`/instruments${queryParams}`, {
      method: 'GET',
      disableCache: true,
    });
    return mapFlowInstrumentList(response);
  } catch (error) {
    console.error('获取仪器列表失败:', error);
    throw error;
  }
}
// 获取单个仪器详情
export async function getInstrumentDetail(id: string): Promise<Instrument> {
  try {
    const instrumentData = await fetchAPI<Instrument>(`/instruments/${id}`);
    // 处理仪器数据，转换型号规格
    return mapApiResponseToInstrument(instrumentData);
  } catch (error) {
    console.error('获取仪器详情失败:', error);
    throw error;  // 重新抛出错误，让调用方处理
  }
}

// 出库操作
export async function checkOutInstrument(id: string, data: {
  operator: string;
  department?: string;
  purpose?: string;
  expected_return_time?: string;
  notes?: string;
  borrower?: string;
}): Promise<Instrument> {
  await delay(400);

  if (!data.department || !data.purpose) {
    console.warn('[CheckOut] Optional department or purpose missing in request data:', data);
  }
  
  const result = await fetchAPI<Instrument>(`/flow/instrument-flows/${id}/check-out`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      department: data.department || '',
      purpose: data.purpose || '',
      expected_return_time: data.expected_return_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }),
  });
  
  // 处理返回的仪器数据，转换型号规格
  return mapApiResponseToInstrument(result);
}

// 借用操作
export async function borrowInstrument(id: string, data: {
  borrower: string;
  notes?: string;
}): Promise<Instrument> {
  await delay(400);
  
  const result = await fetchAPI<Instrument>(`/flow/instrument-flows/${id}/borrow`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  return mapApiResponseToInstrument(result);
}

// 入库操作
export async function checkInInstrument(id: string, data: {
  operator: string;
  location?: string;
  condition?: number;
  usage_time?: number;
  notes?: string;
  capacityPercent?: number;
  capacityValue?: number;
  isConsumed?: boolean;
  borrower?: string;
}): Promise<Instrument> {
  await delay(400);
  
  const result = await fetchAPI<Instrument>(`/flow/instrument-flows/${id}/check-in`, {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      location: data.location || '',
      condition: data.condition || 5
    }),
  });
  
  // 处理返回的仪器数据，转换型号规格
  return mapApiResponseToInstrument(result);
}

// 使用操作
export async function useInstrument(id: string, data: {
  purpose: string;
  usage_time?: number;
  notes?: string;
}): Promise<Instrument> {
  await delay(400);
  
  try {
    const result = await fetchAPI<Instrument>(`/flow/instrument-flows/${id}/use`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    // 处理返回的仪器数据，转换型号规格
    return mapApiResponseToInstrument(result);
  } catch (error) {
    console.error('使用仪器失败:', error);
    throw error;
  }
}

// 清除记录操作
export async function clearTodayRecord(instrumentId: string, keepBasicData: boolean): Promise<boolean> {
  await delay(300);
  try {
  const records = await fetchAPI<any>(`/flow/instrument/${instrumentId}?limit=20`, { method: 'GET', disableCache: true });
    const rows: any[] = Array.isArray(records) ? records : Array.isArray((records || {}).data) ? (records || {}).data : [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecord = rows.find(r => (r.timestamp || '').startsWith(todayStr));
    if (!todayRecord) {
      return false;
    }
    await fetchAPI<void>(`/flow/records/${todayRecord.id}?keepBasicData=${keepBasicData ? 'true' : 'false'}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('清除今日记录失败:', error);
    throw error;
  }
}

// 清除最近一条记录
export async function clearLatestRecord(instrumentId: string, keepBasicData: boolean): Promise<boolean> {
  await delay(200);
  try {
  const resp = await fetchAPI<any>(`/flow/instrument/${instrumentId}?limit=1`, { method: 'GET', disableCache: true });
    const rows: any[] = Array.isArray(resp) ? resp : Array.isArray((resp || {}).data) ? (resp || {}).data : [];
    const latest = rows.length > 0 ? rows[0] : null;
    if (!latest?.id) return false;
    await fetchAPI<void>(`/flow/records/${latest.id}?keepBasicData=${keepBasicData ? 'true' : 'false'}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error('清除最近记录失败:', error);
    throw error;
  }
}

// 重置仪器状态操作
export async function resetInstrumentStatus(id: string): Promise<Instrument> {
  await delay(300);
  
  try {
    const result = await fetchAPI<Instrument>(`/flow/instrument-flows/${id}/reset`, {
      method: 'POST'
    });
    
    // 处理返回的仪器数据，转换型号规格
    return mapApiResponseToInstrument(result);
  } catch (error) {
    console.error('重置仪器状态失败:', error);
    throw error;
  }
}

// 获取仪器流动记录
export async function getInstrumentFlowRecords(params?: {
  instrument_id?: string;
  operation_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: InstrumentFlowRecord[]; total: number }> {
  await delay(300);
  
  try {
    const queryParams = buildQueryString({
      instrumentId: params?.instrument_id,
      action: params?.operation_type,
      startDate: params?.start_date,
      endDate: params?.end_date,
      page: params?.page ? String(params.page) : undefined,
      limit: params?.pageSize ? String(params.pageSize) : undefined,
    });
    const result = await fetchAPI<any>(`/flow/records${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      disableCache: true
    });
    return mapFlowRecordsResponse(result);
  } catch (error) {
    console.error('获取仪器流动记录失败:', error);
    throw error;
  }
}

// 获取预约列表
export async function getReservations(params?: {
  instrument_id?: string;
  user_id?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Reservation[]; total: number }> {
  await delay(300);
  
  try {
    const queryParams = buildQueryString(
      params
        ? {
            instrument_id: params.instrument_id,
            user_id: params.user_id,
            status: params.status,
            page: params.page ? String(params.page) : undefined,
            pageSize: params.pageSize ? String(params.pageSize) : undefined,
          }
        : undefined,
    );
    return await fetchAPI<{ data: Reservation[]; total: number }>(`/flow/reservations${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
      // GET请求不需要body
    });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    throw error;
  }
}

// 获取系统配置数据（部门、操作员、位置等）
export async function getSystemConfig(): Promise<{
  departments: string[];
  operators: string[];
  locations: string[];
  purposes: string[];
}> {
  await delay(200);  
  try {
    return await fetchAPI<{
      departments: string[];
      operators: string[];
      locations: string[];
      purposes: string[];
    }>('/flow/system-config');
  } catch (error) {
    console.error('获取系统配置失败，使用默认配置:', error);
    // 返回默认配置，而不是抛出错误
    return {
      departments: ['化验室', '研发部', '质量部', '生产部', '设备部'],
      operators: ['张三', '李四', '王五', '赵六', '钱七'],
      locations: ['A楼1层', 'A楼2层', 'B楼1层', 'B楼2层', '仓库'],
      purposes: ['常规检测', '研发测试', '质量控制', '校准', '维修']
    };
  }
}

// 导出Excel
export async function exportInstrumentsExcel(params?: {
  search?: string;
  flow_status?: string;
}): Promise<Blob> {
  await delay(500);
  
  try {
    const blob = await apiClient.download('/instruments/export', { method: 'POST', data: params })
    return blob
  } catch (error) {
    console.error('导出Excel失败:', error);
    throw error;
  }
}
