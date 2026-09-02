import { message } from 'antd';
import { Instrument } from '../types';
import { mapBackendToFrontend } from '../services/instrumentService';

// Utility to export instruments to CSV
export const exportInstrumentsToCSV = (instruments: Instrument[]) => {
  if (!instruments || instruments.length === 0) {
    message.warning('没有数据可导出');
    return;
  }
  
  // 生成CSV数据
  const headers = ['仪器类型', '数量', '仪器名称', '型号规格', '出厂编号', '管理编号', '生产厂商', '测量范围', '测量不确定度', '溯源方式', '校准日期', '复校日期', '校准周期', '校准机构', '科室', '存放位置', '仪器状态', '出入库状态', '备注', '采购日期'];
  
  // CSV字段到仪器字段的映射
  const fieldMap: { [key: string]: string } = {
    '仪器类型': 'type',
    '数量': 'quantity',
    '仪器名称': 'name',
    '型号规格': 'model',
    '出厂编号': 'serialNumber',
    '管理编号': 'managementNumber',
    '生产厂商': 'manufacturer',
    '测量范围': 'measureRange',
    '测量不确定度': 'uncertainty',
    '溯源方式': 'traceabilityMethod',
    '校准日期': 'calibrationDate',
    '复校日期': 'nextCalibrationDate',
    '校准周期': 'calibrationCycle',
    '校准机构': 'calibrationInstitution',
    '科室': 'department',
    '存放位置': 'location',
    '仪器状态': 'status',
    '出入库状态': 'inOutStatus',
    '备注': 'remarks',
    '采购日期': 'purchaseDate'
  };
  
  // 构建CSV内容
  let csvContent = headers.join(',') + '\n';
  
  instruments.forEach((instrument: Instrument) => {
    // 确保使用统一的字段映射格式
    const mappedInstrument = mapBackendToFrontend(instrument) as any;
    
    // 使用字段映射生成行数据
    const row = headers.map(header => {
      const fieldName = fieldMap[header];
      // 处理undefined或null值，提供默认空字符串
      const value = mappedInstrument[fieldName] || '';
      return value;
    });
    
    // 处理包含逗号或换行符的值
    const formattedRow = row.map(cell => {
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvContent += formattedRow.join(',') + '\n';
  });
  
  // 创建Blob对象
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  
  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `仪器数据_${new Date().toLocaleDateString()}.csv`);
  link.style.visibility = 'hidden';
  
  // 触发下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  message.success('数据导出成功');
};
