import React from 'react';
import { formatNumber } from '../../utils/helpers';
import dayjs from 'dayjs';

/**
 * 仪器表格列配置
 * 提供标准化的仪器表格列定义，供各模块表单调用
 */

// 排序方向类型
export type SortDirection = 'ascend' | 'descend' | null;

// 仪器表格列配置类型定义
export interface InstrumentTableColumn {
  key: string;
  title: string;
  width?: number | string;
  ellipsis?: boolean;
  fixed?: 'left' | 'right' | boolean;
  align?: 'left' | 'center' | 'right';
  dataIndex?: string; // 数据索引，用于从数据中获取对应字段
  // 增强功能属性
  sorter?: boolean; // 是否可排序
  sortDirections?: SortDirection[]; // 支持的排序方向
  filterable?: boolean; // 是否可筛选
  filters?: { text: string; value: string }[]; // 筛选选项
  filterMultiple?: boolean; // 是否支持多选筛选
  resizable?: boolean; // 是否可调整列宽
  draggable?: boolean; // 是否可拖拽调整位置
  render?: (text: any, record: any, index: number) => React.ReactNode; // 自定义渲染函数
}

/**
 * 仪器表格标准列配置
 * 包含：选择框/类型/数量/名称/型号/出厂编号/管理编号/生产厂家/测量范围/测量不确定度/溯源方式/校准日期/复校日期/周期/溯源机构/科室/存放位置/仪器状态/出入库状态/备注/附件/操作
 */
export const INSTRUMENT_TABLE_COLUMNS: InstrumentTableColumn[] = [
  { key: 'selection', title: '选择框', width: 60, align: 'center', fixed: 'left' },
  {
    key: 'type',
    title: '类型',
    dataIndex: 'type',
    width: 120,
    align: 'center'
  },
  { key: 'quantity', title: '数量', width: 80, align: 'center', render: (text: any) => formatNumber(text) },
  { key: 'name', title: '名称', width: 150, ellipsis: true, align: 'center' },
  { key: 'model', title: '型号', width: 120, ellipsis: true, align: 'center' },
  { key: 'factoryNumber', title: '出厂编号', width: 140, ellipsis: true, align: 'center' },
  { key: 'managementNumber', title: '管理编号', width: 140, ellipsis: true, align: 'center' },
  { key: 'manufacturer', title: '生产厂家', width: 150, ellipsis: true, align: 'center' },
  { key: 'measurementRange', title: '测量范围', width: 120, ellipsis: true, align: 'center', render: (text: any) => formatNumber(text) },
  { key: 'measurementUncertainty', title: '测量不确定度', width: 140, ellipsis: true, align: 'center', render: (text: any) => formatNumber(text) },
  { key: 'traceabilityMethod', title: '溯源方式', width: 100, align: 'center' },
  { key: 'calibrationDate', title: '校准日期', width: 120, align: 'center', render: (text: any) => text ? dayjs(text).tz().format('YYYY-MM-DD') : '' },
  { key: 'recalibrationDate', title: '复校日期', width: 120, align: 'center', render: (text: any) => text ? dayjs(text).tz().format('YYYY-MM-DD') : '' },
  { key: 'cycle', title: '周期', width: 80, align: 'center', render: (text: any) => formatNumber(text) },
  { key: 'traceabilityAgency', title: '溯源机构', width: 140, ellipsis: true, align: 'center' },
  { key: 'traceabilityCertificate', title: '溯源证书', width: 140, ellipsis: true, align: 'center' },
  {
    key: 'department',
    title: '科室',
    dataIndex: 'department',
    width: 100,
    align: 'center'
  },
  { key: 'storageLocation', title: '存放位置', width: 120, ellipsis: true, align: 'center' },
  {
    key: 'instrumentStatus',
    title: '仪器状态',
    dataIndex: 'instrumentStatus',
    width: 120,
    align: 'center'
  },
  {
    key: 'storageStatus',
    title: '出入库状态',
    dataIndex: 'storageStatus',
    width: 120,
    align: 'center'
  },
  { key: 'metrologicalParameterRange', title: '计量参数范围', width: 140, ellipsis: true, align: 'center' },
  { key: 'purchaseDate', title: '采购日期', width: 120, align: 'center', render: (text: any) => text ? dayjs(text).format('YYYY-MM-DD') : '' },
  { key: 'acceptanceDate', title: '验收日期', width: 120, align: 'center', render: (text: any) => text ? dayjs(text).format('YYYY-MM-DD') : '' },
  { key: 'purchasePerson', title: '采购负责人', width: 100, align: 'center' },
  { key: 'enableDate', title: '启用日期', width: 120, align: 'center', render: (text: any) => text ? dayjs(text).format('YYYY-MM-DD') : '' },
  { key: 'remarks', title: '备注', width: 150, ellipsis: true, align: 'center' },
  { key: 'attachments', title: '附件', width: 80, align: 'center' },
  { key: 'action', title: '操作', width: 150, align: 'center' },
];

/**
 * 获取指定的仪器表格列
 * @param keys 需要的列的key数组
 * @returns 过滤后的列配置数组
 */
export const getInstrumentColumns = (keys: string[]): InstrumentTableColumn[] => {
  return INSTRUMENT_TABLE_COLUMNS.filter(column => keys.includes(column.key));
};

/**
 * 获取除指定列外的所有仪器表格列
 * @param excludeKeys 排除的列的key数组
 * @returns 过滤后的列配置数组
 */
export const getInstrumentColumnsExcept = (excludeKeys: string[]): InstrumentTableColumn[] => {
  return INSTRUMENT_TABLE_COLUMNS.filter(column => !excludeKeys.includes(column.key));
};

export default INSTRUMENT_TABLE_COLUMNS;