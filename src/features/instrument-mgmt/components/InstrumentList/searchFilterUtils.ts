import { Upload } from 'antd';
import type { FilterValues, Instrument } from '../../types';

export const TRACEABILITY_METHOD_OPTIONS = ['送检', '检定', '校准', '检测'];
export const DEPARTMENT_OPTIONS = ['理化', '热工'];
export const INSTRUMENT_STATUS_OPTIONS = ['使用中', '超期使用', '已使用', '停用'];
export const STORAGE_STATUS_OPTIONS = ['已出库', '在库中', '已消耗'];

export function getSearchSuggestions(instruments: Instrument[], query: string) {
  if (!query.trim()) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const uniqueSuggestions = new Set<string>();

  instruments.forEach((instrument) => {
    const fields = [
      instrument.name || '',
      instrument.model || '',
      instrument.serialNumber || '',
      instrument.managementNumber || '',
      instrument.measureRange || '',
      instrument.id || '',
    ];

    fields.forEach((field) => {
      if (field && field.toLowerCase().includes(queryLower)) {
        uniqueSuggestions.add(field);
      }
    });
  });

  return Array.from(uniqueSuggestions).slice(0, 5);
}

export function validateInstrumentImportFile(file: File & { size: number; type: string; name: string }) {
  const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv');
  const isExcel =
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls') ||
    file.name.endsWith('.xlsm');

  if (!isCSV && !isExcel) {
    return {
      valid: false,
      message: `${file.name} 不是有效的 CSV 或 Excel 文件`,
      result: Upload.LIST_IGNORE as string,
    };
  }

  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    return {
      valid: false,
      message: `${file.name} 文件大小必须小于 5MB`,
      result: Upload.LIST_IGNORE as string,
    };
  }

  return { valid: true, result: false as const };
}

export function updateFilterValues(
  filterValues: FilterValues,
  key: keyof FilterValues,
  value: FilterValues[keyof FilterValues],
) {
  return { ...filterValues, [key]: value };
}
