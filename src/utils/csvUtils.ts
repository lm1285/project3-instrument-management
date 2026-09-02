/**
 * CSV工具函数集合 - 使用通用导入导出工具的包装器
 * 提供向后兼容的CSV数据处理功能
 */

import { ExportUtils } from './exportUtils';
import { ImportUtils } from './importUtils';

/**
 * 将对象数组转换为CSV字符串
 * @param data 数据对象数组
 * @param columns 列配置，用于指定字段名和标题
 * @returns CSV格式字符串
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  columns?: { key: string; title: string }[]
): string {
  if (!data || data.length === 0) {
    return '';
  }
  
  // 使用轻量级实现保持向后兼容性（返回字符串）
  const csvColumns = columns || Object.keys(data[0]).map(key => ({ key, title: key }));
  const headers = csvColumns.map(col => col.title);
  const csvContent = [headers.join(',')];
  
  data.forEach(row => {
    const rowData = csvColumns.map(col => {
      const value = row[col.key];
      let cellValue = value === null || value === undefined ? '' : String(value);
      
      if (cellValue.includes(',') || cellValue.includes('"') || cellValue.includes('\n')) {
        cellValue = `"${cellValue.replace(/"/g, '""')}"`;
      }
      
      return cellValue;
    });
    
    csvContent.push(rowData.join(','));
  });
  
  return csvContent.join('\n');
}

/**
 * 将CSV字符串解析为对象数组 - 使用ImportUtils
 * @param csv CSV格式字符串
 * @param headers 可选的标题行，如果不提供则使用CSV的第一行
 * @returns 对象数组
 */
export async function parseCSV<T extends Record<string, any>>(csv: string, headers?: string[]): Promise<T[]> {
  // 创建临时Blob对象
  const blob = new Blob([csv], { type: 'text/csv' });
  const file = new File([blob], 'temp.csv', { type: 'text/csv' });
  
  try {
    // 使用ImportUtils解析CSV
    const result = await ImportUtils.importFromCSV(file, !headers);
    
    // 如果提供了自定义标题，重命名属性
    if (headers && result.length > 0) {
      const originalHeaders = Object.keys(result[0]);
      return result.map(row => {
        const newRow: T = {} as T;
        originalHeaders.forEach((originalHeader, index) => {
          if (index < headers.length) {
            newRow[headers[index] as keyof T] = row[originalHeader] as any;
          }
        });
        return newRow;
      });
    }
    
    return result as T[];
  } catch (error) {
    console.error('CSV解析失败:', error);
    return [];
  }
}

/**
 * 将对象数组导出为CSV文件并下载 - 使用ExportUtils
 * @param data 数据对象数组
 * @param filename 文件名（不含扩展名）
 * @param columns 列配置，用于指定字段名和标题
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: string; title: string }[]
): void {
  // 转换列配置格式以匹配ExportUtils
  const exportColumns = columns?.map(col => ({
    title: col.title,
    dataIndex: col.key
  }));
  
  // 使用ExportUtils导出CSV
  ExportUtils.export({
    data,
    format: 'csv',
    filename: filename,
    columns: exportColumns,

  });
}

/**
 * 从File对象读取并解析CSV数据 - 使用ImportUtils
 * @param file CSV文件对象
 * @returns Promise，解析后的对象数组
 */
export async function readCSVFile<T extends Record<string, any>>(file: File): Promise<T[]> {
  try {
    // 使用ImportUtils导入CSV文件
    const result = await ImportUtils.import<T>({
      file,
      format: 'csv',
      hasHeaders: true
    });
    
    return result.successData;
  } catch (error) {
    console.error('读取CSV文件失败:', error);
    throw new Error('读取CSV文件失败');
  }
}

export default {
  convertToCSV,
  parseCSV,
  exportToCSV,
  readCSVFile
};