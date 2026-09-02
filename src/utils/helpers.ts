import type { FormatDateFunction, ValidateFunction, DebounceFunction, ThrottleFunction } from '../types/common';

/**
 * 格式化日期为YYYY-MM-DD格式
 */
export const formatDate: FormatDateFunction = (date) => {
  const d = new Date(date);
  
  // 检查是否是有效日期
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * 格式化日期时间
 */
export const formatDateTime = (date: Date | string | number): string => {
  const d = new Date(date);
  
  if (isNaN(d.getTime())) {
    return '';
  }
  
  const dateStr = formatDate(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
};

/**
 * 状态转换
 */
export const formatStatus = (status: string): { text: string; color: string } => {
  const statusMap: Record<string, { text: string; color: string }> = {
    'in_use': { text: '使用中', color: 'blue' },
    'available': { text: '可用', color: 'green' },
    'maintenance': { text: '维护中', color: 'orange' },
    'fault': { text: '故障', color: 'red' },
    'scrapped': { text: '报废', color: 'gray' },
    'in': { text: '在库', color: 'green' },
    'out': { text: '出库', color: 'orange' },
  };
  
  return statusMap[status] || { text: status, color: 'default' };
};

/**
 * 数据验证函数
 */
export const validateRequired: ValidateFunction = (value) => {
  if (!value && value !== 0) {
    return '此项为必填项';
  }
  return true;
};

/**
 * 数字验证
 */
export const validateNumber: ValidateFunction = (value) => {
  if (value && isNaN(Number(value))) {
    return '请输入有效数字';
  }
  return true;
};

/**
 * 邮箱验证
 */
export const validateEmail: ValidateFunction = (value) => {
  if (value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return '请输入有效邮箱地址';
    }
  }
  return true;
};

/**
 * 手机号验证
 */
export const validatePhone: ValidateFunction = (value) => {
  if (value) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(value)) {
      return '请输入有效手机号';
    }
  }
  return true;
};

/**
 * 生成唯一ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * 防抖函数
 */
export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): DebounceFunction<T> => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), wait);
  };
};

/**
 * 节流函数
 */
export const throttle = <T extends (...args: any[]) => any>(func: T, limit: number): ThrottleFunction<T> => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * 深拷贝对象
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }
  
  if (obj instanceof Array) {
    const cloneArr: any[] = [];
    for (let i = 0; i < obj.length; i++) {
      cloneArr[i] = deepClone(obj[i]);
    }
    return cloneArr as any;
  }
  
  if (typeof obj === 'object') {
    const cloneObj: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloneObj[key] = deepClone(obj[key]);
      }
    }
    return cloneObj;
  }
  
  return obj;
};

/**
 * 安全获取嵌套对象属性
 */
export const getNestedProperty = <T extends any>(obj: Record<string, any>, path: string, defaultValue?: T): T | undefined => {
  const keys = path.split('.');
  let result: any = obj;
  
  for (const key of keys) {
    if (result === null || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === undefined ? defaultValue : result as T;
};

/**
 * 格式化数字，自动添加千分位，并保留原输入的小数位数
 */
export const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const strValue = String(value);
  // 检查是否为有效数字字符串
  if (isNaN(Number(strValue))) {
    return strValue;
  }

  const parts = strValue.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
  
  // 格式化整数部分
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  return formattedInteger + decimalPart;
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
};

/**
 * 验证文件类型
 */
export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  const fileType = file.type;
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  return allowedTypes.some(type => 
    fileType === type || (fileExtension && type.includes(fileExtension))
  );
};

/**
 * 验证文件大小
 */
export const validateFileSize = (file: File, maxSizeInMB: number): boolean => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
};