/**
 * 导出工具
 * 提供统一的数据导出功能，支持Excel、CSV等格式
 */
// @ts-nocheck
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
// @ts-check

/**
 * 导出配置接口
 */
export interface ExportConfig<T = any> {
  /** 数据源 */
  data: T[];
  /** 导出文件名 */
  filename?: string;
  /** 导出格式 */
  format?: 'excel' | 'csv' | 'json';
  /** 列配置 */
  columns?: ExportColumnConfig[];
  /** 是否包含标题行 */
  includeHeaders?: boolean;
  /** 自定义导出处理器 */
  customProcessor?: (data: T[]) => Blob;
}

/**
 * 导出列配置接口
 */
export interface ExportColumnConfig {
  /** 列标题 */
  title: string;
  /** 数据字段 */
  dataIndex: string;
  /** 自定义渲染函数 */
  render?: (value: any, record: any, index: number) => string;
  /** 列宽（Excel格式） */
  width?: number;
  /** 数据类型 */
  type?: 'string' | 'number' | 'boolean' | 'date' | 'object';
}

/**
 * 导出工具类
 */
export class ExportUtils {
  /**
   * 执行导出
   */
  static export<T = any>(config: ExportConfig<T>): void {
    const {
      data,
      filename = 'export',
      format = 'excel',
      columns,
      includeHeaders = true,
      customProcessor,
    } = config;

    try {
      // 如果提供了自定义处理器
      if (customProcessor) {
        const blob = customProcessor(data);
        saveAs(blob, `${filename}${this.getFileExtension(format)}`);
        return;
      }

      // 根据格式执行不同的导出逻辑
      switch (format) {
        case 'excel':
          this.exportToExcel(data, filename, columns, includeHeaders);
          break;
        case 'csv':
          this.exportToCSV(data, filename, columns, includeHeaders);
          break;
        case 'json':
          this.exportToJSON(data, filename);
          break;
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      throw error;
    }
  }

  /**
   * 导出为Excel
   */
  static exportToExcel<T = any>(
    data: T[],
    filename: string,
    columns?: ExportColumnConfig[],
    includeHeaders: boolean = true
  ): void {
    try {
      // 准备导出数据
      const exportData = this.prepareExportData(data, columns);
      
      // 创建工作簿
      const wb = XLSX.utils.book_new();
      
      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(exportData.data, {
        header: exportData.headers,
        skipHeader: !includeHeaders,
      });
      
      // 设置列宽
      if (columns && columns.length > 0) {
        const colWidths = columns.map(col => ({
          wch: col.width || 20, // 默认宽度20
        }));
        ws['!cols'] = colWidths;
      }
      
      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // 导出文件
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      saveAs(blob, `${filename}.xlsx`);
    } catch (error) {
      console.error('导出Excel失败:', error);
      throw error;
    }
  }

  /**
   * 导出为CSV
   */
  static exportToCSV<T = any>(
    data: T[],
    filename: string,
    columns?: ExportColumnConfig[],
    includeHeaders: boolean = true
  ): void {
    try {
      // 准备导出数据
      const exportData = this.prepareExportData(data, columns);
      
      // 转换为CSV字符串
      const csvContent = this.convertToCSV(exportData.data, exportData.headers, includeHeaders);
      
      // 创建Blob并下载
      const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${filename}.csv`);
    } catch (error) {
      console.error('导出CSV失败:', error);
      throw error;
    }
  }
  
  /**
   * 将对象数组转换为CSV字符串（内部使用）
   */
  private static convertToCSV(data: any[], headers?: string[], includeHeaders: boolean = true): string {
    if (!data || data.length === 0) {
      return '';
    }
    
    // 如果没有指定列配置，使用第一个对象的所有键作为列
    const csvHeaders = headers || Object.keys(data[0]);
    const csvContent: string[] = [];
    
    // 添加标题行
    if (includeHeaders) {
      csvContent.push(csvHeaders.map(col => this.escapeCSVField(col)).join(','));
    }
    
    // 生成数据行
    data.forEach(row => {
      const rowData = csvHeaders.map(col => {
        const value = row[col];
        return this.escapeCSVField(value === null || value === undefined ? '' : String(value));
      });
      
      csvContent.push(rowData.join(','));
    });
    
    return csvContent.join('\n');
  }
  
  /**
   * 转义CSV字段（内部使用）
   */
  private static escapeCSVField(value: string): string {
    // 如果值包含逗号、引号或换行符，需要用引号包裹并转义内部的引号
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * 导出为JSON
   */
  static exportToJSON<T = any>(data: T[], filename: string): void {
    try {
      // 转换为JSON字符串
      const jsonContent = JSON.stringify(data, null, 2);
      
      // 创建Blob并下载
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      saveAs(blob, `${filename}.json`);
    } catch (error) {
      console.error('导出JSON失败:', error);
      throw error;
    }
  }

  /**
   * 准备导出数据
   */
  private static prepareExportData<T = any>(
    data: T[],
    columns?: ExportColumnConfig[]
  ): {
    headers: string[];
    data: Record<string, any>[];
  } {
    // 如果没有提供列配置，自动从数据中提取
    if (!columns || columns.length === 0) {
      return this.autoDetectColumns(data);
    }

    // 使用提供的列配置
    const headers = columns.map(col => col.title);
    const processedData = data.map((record, index) => {
      const row: Record<string, any> = {};
      
      columns!.forEach((col) => {
        const value = this.getNestedValue(record, col.dataIndex);
        const displayValue = col.render 
          ? col.render(value, record, index) 
          : this.formatValue(value, col.type);
        
        row[col.title] = displayValue;
      });
      
      return row;
    });

    return { headers, data: processedData };
  }

  /**
   * 自动检测列
   */
  private static autoDetectColumns<T = any>(
    data: T[]
  ): {
    headers: string[];
    data: Record<string, any>[];
  } {
    if (!data || data.length === 0) {
      return { headers: [], data: [] };
    }

    // 获取所有唯一的键
    const allKeys = new Set<string>();
    data.forEach(record => {
      if (typeof record === 'object' && record !== null) {
        Object.keys(record).forEach(key => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);
    const processedData = data.map(record => {
      const row: Record<string, any> = {};
      headers.forEach(header => {
        const value = record[header as keyof T];
        row[header] = this.formatValue(value);
      });
      return row;
    });

    return { headers, data: processedData };
  }

  /**
   * 获取嵌套属性值
   */
  private static getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        return result;
      }
      result = result[key];
    }
    
    return result;
  }

  /**
   * 格式化值
   */
  private static formatValue(value: any, type?: string): any {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type || typeof value) {
      case 'boolean':
        return value ? '是' : '否';
      case 'date':
        return this.formatDate(value);
      case 'object':
        try {
          return JSON.stringify(value);
        } catch (e) {
          return '[对象]';
        }
      default:
        return String(value);
    }
  }

  /**
   * 格式化日期
   */
  private static formatDate(date: any): string {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * 获取文件扩展名
   */
  private static getFileExtension(format: string): string {
    switch (format) {
      case 'excel':
        return '.xlsx';
      case 'csv':
        return '.csv';
      case 'json':
        return '.json';
      default:
        return '';
    }
  }
}

// 导出默认实例
export default ExportUtils;