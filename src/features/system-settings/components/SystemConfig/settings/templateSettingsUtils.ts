import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { TemplateItem } from '../../../../../types/common';
import { CSV_FIELD_MAP } from '../../../../../constants/instrument';

export const TEMPLATE_FUNCTION_OPTIONS = [
  '预警总览-溯源确认',
  '预警总览-已送检',
  '预警总览-已完成',
  '仪器管理-批量导入',
];

export const TEMPLATE_TYPE_OPTIONS = ['通知', '报告', '邮件', 'Excel模板', '其他'];

export const EXCEL_TEMPLATE_TYPE = 'Excel模板';
export const DEFAULT_TEMPLATE_TYPE = '通知';

function buildImportTemplate(now: string): TemplateItem {
  const headers = Object.keys(CSV_FIELD_MAP);
  const noteRow = ['说明：支持 Excel 格式自动识别，请勿修改表头。'];
  const data = [headers, noteRow];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet['!merges'] = [{ s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } }];
  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');

  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;

  return {
    id: `${Date.now() + 1}`,
    name: '批量导入模板',
    type: EXCEL_TEMPLATE_TYPE,
    content: '仪器批量导入标准模板',
    relatedFunction: '仪器管理-批量导入',
    fileName: '仪器导入模板.xlsx',
    fileData: dataUri,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMissingDefaultTemplates(templates: TemplateItem[]) {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const templatesToAdd: TemplateItem[] = [];

  const hasTraceabilityTemplate = templates.some(
    (template) => template.relatedFunction === '预警总览-溯源确认',
  );

  if (!hasTraceabilityTemplate) {
    templatesToAdd.push({
      id: `${Date.now()}`,
      name: '溯源确认',
      type: EXCEL_TEMPLATE_TYPE,
      content: '预置模板，请点击编辑上传 Excel 文件',
      relatedFunction: '预警总览-溯源确认',
      createdAt: now,
      updatedAt: now,
    });
  }

  const hasImportTemplate = templates.some(
    (template) => template.relatedFunction === '仪器管理-批量导入',
  );

  if (!hasImportTemplate) {
    templatesToAdd.push(buildImportTemplate(now));
  }

  return templatesToAdd;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export function isExcelFile(file: File) {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel' ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  );
}

export function downloadTemplateFile(fileName: string, fileData: string) {
  const link = document.createElement('a');
  link.href = fileData;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
