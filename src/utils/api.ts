import type { ApiResponse } from '../types/common';

export const API_BASE_URL = (() => {
  try {
    const envUrl = (import.meta as any)?.env?.VITE_API_URL;
    if (envUrl) return envUrl;
  } catch {}
  return '/api';
})();

/**
 * 基础API请求函数
 */
async function baseRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 默认配置
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    // 合并选项
    let token = '';
    try { token = localStorage.getItem('token') || localStorage.getItem('authToken') || ''; } catch {}
    
    const requestOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    
    // 发送请求
    const response = await fetch(url, requestOptions);
    
    // 解析响应
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
    
    // 处理响应
    if (!response.ok) {
      // Auto-login retry logic removed
      
      return {
        success: false,
        message: data?.message || data?.error || '请求失败',
        error: data?.error,
        code: response.status,
      };
    }
    
    return {
      success: true,
      data,
      message: data?.message || '请求成功',
    };
  } catch (error) {
    console.error('API请求错误:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
    };
  }
}

/**
 * GET请求
 */
export function get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
  // 构建查询参数
  let queryString = '';
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const paramsString = searchParams.toString();
    if (paramsString) {
      queryString = `?${paramsString}`;
    }
  }
  
  return baseRequest<T>(`${endpoint}${queryString}`, {
    method: 'GET',
  });
}

/**
 * POST请求
 */
export function post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
  return baseRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * PUT请求
 */
export function put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
  return baseRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE请求
 */
export function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return baseRequest<T>(endpoint, {
    method: 'DELETE',
  });
}

/**
 * 批量DELETE请求
 */
export function batchDelete<T>(endpoint: string, ids: string[]): Promise<ApiResponse<T>> {
  return baseRequest<T>(endpoint, {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
}

/**
 * 文件上传请求
 */
export function uploadFile<T>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<ApiResponse<T>> {
  const formData = new FormData();
  formData.append('file', file);
  
  // 添加其他数据
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, String(value));
    });
  }
  
  return baseRequest<T>(endpoint, {
    method: 'POST',
    headers: {}, // 不需要设置Content-Type，浏览器会自动设置
    body: formData,
  });
}

/**
 * 数据库表相关API
 */
export const tableApi = {
  // 获取表格数据
  getTableData: (tableName: string, params?: Record<string, any>) =>
    get<any[]>(`/tables/${tableName}`, params),
  
  // 获取单条记录
  getRecord: (tableName: string, id: string) =>
    get<any>(`/tables/${tableName}/${id}`),
  
  // 添加记录
  addRecord: (tableName: string, data: any) =>
    post<any>(`/tables/${tableName}`, data),
  
  // 更新记录
  updateRecord: (tableName: string, id: string, data: any) =>
    put<any>(`/tables/${tableName}/${id}`, data),
  
  // 删除记录
  deleteRecord: (tableName: string, id: string) =>
    del<any>(`/tables/${tableName}/${id}`),
  
  // 批量删除记录
  batchDeleteRecords: (tableName: string, ids: string[]) =>
    batchDelete<any>(`/tables/${tableName}`, ids),
  
  // 批量添加记录
  batchAddRecords: (tableName: string, records: any[]) =>
    post<any>(`/tables/${tableName}/batch`, { records }),
};

/**
 * 导出API
 */
export default {
  get,
  post,
  put,
  delete: del,
  batchDelete,
  uploadFile,
  tableApi,
};
