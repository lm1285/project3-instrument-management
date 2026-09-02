/**
 * 导入工具
 * 提供统一的文件导入功能，支持Excel、CSV等格式
 */
import * as XLSX from 'xlsx';

/**
 * 导入配置接口
 */
export interface ImportConfig<T = any> {
  /** 文件对象 */
  file: File;
  /** 导入格式 */
  format?: 'excel' | 'csv' | 'json';
  /** 列映射配置 */
  columnMapping?: Record<string, string>;
  /** 是否有标题行 */
  hasHeaders?: boolean;
  /** 自定义解析器 */
  customParser?: (file: File) => Promise<T[]>;
  /** 数据验证函数 */
  validator?: (record: any) => boolean;
  /** 数据转换函数 */
  transformer?: (record: any) => T;
  /** 批量处理大小 */
  batchSize?: number;
}

/**
 * 导入结果接口
 */
export interface ImportResult<T = any> {
  /** 成功导入的数据 */
  successData: T[];
  /** 导入失败的数据 */
  failedData: any[];
  /** 错误信息 */
  errors: string[];
  /** 总行数 */
  totalRows: number;
  /** 成功行数 */
  successRows: number;
  /** 失败行数 */
  failedRows: number;
}

/**
 * 导入工具类
 */
export class ImportUtils {
  /**
   * 执行导入
   */
  static async import<T = any>(config: ImportConfig<T>): Promise<ImportResult<T>> {
    const {
      file,
      format,
      columnMapping,
      hasHeaders = true,
      customParser,
      validator,
      transformer,
      batchSize = 1000,
    } = config;

    try {
      // 验证文件
      if (!this.validateFile(file, format)) {
        throw new Error(`不支持的文件格式: ${file.name}`);
      }

      // 如果提供了自定义解析器
      if (customParser) {
        const rawData = await customParser(file);
        return this.processImportData(rawData, validator, transformer);
      }

      // 根据文件扩展名或指定格式确定导入方法
      const importFormat = format || this.detectFileFormat(file.name);
      let rawData: any[] = [];

      switch (importFormat) {
        case 'excel':
          rawData = await this.importFromExcel(file, hasHeaders);
          break;
        case 'csv':
          rawData = await this.importFromCSV(file, hasHeaders);
          break;
        case 'json':
          rawData = await this.importFromJSON(file);
          break;
        default:
          throw new Error(`不支持的导入格式: ${importFormat}`);
      }

      // 应用列映射
      const mappedData = columnMapping
        ? this.applyColumnMapping(rawData, columnMapping)
        : rawData;

      // 处理导入数据（验证和转换）
      return this.processImportData(mappedData, validator, transformer, batchSize);
    } catch (error) {
      console.error('导入失败:', error);
      return {
        successData: [],
        failedData: [],
        errors: [error instanceof Error ? error.message : '导入失败'],
        totalRows: 0,
        successRows: 0,
        failedRows: 0,
      };
    }
  }

  /**
   * 从Excel导入
   */
  static async importFromExcel(file: File, hasHeaders: boolean = true): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('无法读取文件内容'));
            return;
          }

          // 解析Excel文件
          const workbook = XLSX.read(data, { type: 'array' });
          
          // 获取第一个工作表
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // 转换为JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: hasHeaders ? 1 : 0,
            raw: false,
            defval: '',
          });

          if (hasHeaders && Array.isArray(jsonData) && jsonData.length > 0) {
            // 如果有标题行，使用第一行作为标题
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1) as any[];
            
            const result = rows.map(row => {
              const record: Record<string, any> = {};
              headers.forEach((header, index) => {
                if (header) { // 只处理非空标题
                  record[header] = row[index] !== undefined ? row[index] : '';
                }
              });
              return record;
            });
            
            resolve(result);
          } else {
            resolve(jsonData as any[]);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 从CSV导入
   */
  static async importFromCSV(file: File, hasHeaders: boolean = true): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          if (!data) {
            reject(new Error('无法读取文件内容'));
            return;
          }

          // 解析CSV
          const parsedData = this.parseCSV(data);
          
          if (hasHeaders && parsedData.length > 0) {
            // 使用第一行作为标题
            const headers = parsedData[0];
            const rows = parsedData.slice(1);
            
            const result = rows.map(row => {
              const record: Record<string, any> = {};
              headers.forEach((header, index) => {
                if (header) { // 只处理非空标题
                  record[header] = row[index] !== undefined ? row[index] : '';
                }
              });
              return record;
            });
            
            resolve(result);
          } else {
            resolve(parsedData);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 从JSON导入
   */
  static async importFromJSON(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result as string;
          if (!data) {
            reject(new Error('无法读取文件内容'));
            return;
          }

          // 解析JSON
          const jsonData = JSON.parse(data);
          
          // 确保返回数组
          if (Array.isArray(jsonData)) {
            resolve(jsonData);
          } else {
            resolve([jsonData]);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 处理导入数据（验证和转换）
   */
  private static processImportData<T = any>(
    data: any[],
    validator?: (record: any) => boolean,
    transformer?: (record: any) => T,
    batchSize: number = 1000
  ): ImportResult<T> {
    const result: ImportResult<T> = {
      successData: [],
      failedData: [],
      errors: [],
      totalRows: data.length,
      successRows: 0,
      failedRows: 0,
    };

    // 批量处理数据
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      batch.forEach((record, index) => {
        try {
          // 验证数据
          if (validator && !validator(record)) {
            result.failedData.push(record);
            result.failedRows++;
            return;
          }

          // 转换数据
          const transformedData = transformer ? transformer(record) : (record as T);
          result.successData.push(transformedData);
          result.successRows++;
        } catch (error) {
          result.failedData.push(record);
          result.failedRows++;
          const errorMsg = error instanceof Error ? error.message : '数据处理失败';
          result.errors.push(`第${i + index + 1}行: ${errorMsg}`);
        }
      });
    }

    return result;
  }

  /**
   * 应用列映射
   */
  private static applyColumnMapping(data: any[], mapping: Record<string, string>): any[] {
    return data.map(record => {
      const mappedRecord: Record<string, any> = {};
      
      // 映射列名
      Object.keys(mapping).forEach(sourceKey => {
        const targetKey = mapping[sourceKey];
        if (record[sourceKey] !== undefined) {
          mappedRecord[targetKey] = record[sourceKey];
        }
      });
      
      // 保留未映射的列
      Object.keys(record).forEach(key => {
        if (!Object.values(mapping).includes(key) && !Object.keys(mapping).includes(key)) {
          mappedRecord[key] = record[key];
        }
      });
      
      return mappedRecord;
    });
  }

  /**
   * 验证文件格式
   */
  private static validateFile(file: File, format?: string): boolean {
    const validFormats = ['excel', 'csv', 'json'];
    const fileExtension = this.getFileExtension(file.name).toLowerCase();
    
    // 如果指定了格式，验证文件扩展名是否匹配
    if (format) {
      if (!validFormats.includes(format)) {
        return false;
      }
      
      const allowedExtensions = this.getAllowedExtensions(format);
      return allowedExtensions.includes(fileExtension);
    }
    
    // 否则，检查是否是支持的文件类型
    for (const validFormat of validFormats) {
      const allowedExtensions = this.getAllowedExtensions(validFormat);
      if (allowedExtensions.includes(fileExtension)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 检测文件格式
   */
  private static detectFileFormat(filename: string): string {
    const extension = this.getFileExtension(filename).toLowerCase();
    
    if (['.xlsx', '.xls', '.xlsm', '.xlsb'].includes(extension)) {
      return 'excel';
    } else if (extension === '.csv') {
      return 'csv';
    } else if (extension === '.json') {
      return 'json';
    }
    
    throw new Error(`无法识别的文件格式: ${filename}`);
  }

  /**
   * 获取文件扩展名
   */
  private static getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex > -1 ? filename.substring(lastDotIndex) : '';
  }
  
  /**
   * 解析CSV字符串（内部使用）
   */
  private static parseCSV(csv: string): string[][] {
    const lines = csv.split(/\r?\n/).filter(line => line.trim());
    const result: string[][] = [];
    
    for (const line of lines) {
      const values: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = i + 1 < line.length ? line[i + 1] : undefined;
        
        // 处理引号逻辑
        if (char === '"' && nextChar === '"') {
          // 两个连续的引号表示一个引号字符
          currentValue += '"';
          i++; // 跳过下一个引号
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // 如果遇到逗号且不在引号内，保存当前值并重置
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // 保存最后一个值
      values.push(currentValue.trim());
      
      if (values.length > 0) {
        result.push(values);
      }
    }
    
    return result;
  }

  /**
   * 获取指定格式允许的扩展名
   */
  private static getAllowedExtensions(format: string): string[] {
    switch (format) {
      case 'excel':
        return ['.xlsx', '.xls', '.xlsm', '.xlsb'];
      case 'csv':
        return ['.csv'];
      case 'json':
        return ['.json'];
      default:
        return [];
    }
  }

  /**
   * 创建导入模板
   */
  static createImportTemplate<T = any>(
    sampleData: T[],
    filename: string = 'import-template.xlsx'
  ): void {
    try {
      if (sampleData.length === 0) {
        throw new Error('样本数据不能为空');
      }

      // 创建工作簿
      const wb = XLSX.utils.book_new();
      
      // 创建工作表
      const ws = XLSX.utils.json_to_sheet(sampleData);
      
      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      
      // 导出文件
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('创建导入模板失败:', error);
      throw error;
    }
  }
}

// 导出默认实例
export default ImportUtils;