// 通用类型定义

// 表格配置接口
export interface TableConfig<T> {
  columns: TableColumn<T>[];
  dataSource: T[];
  rowKey: keyof T | ((record: T) => string);
  pagination?: PaginationConfig;
  loading?: boolean;
}

// 表格列配置接口
export interface TableColumn<T> {
  title: string;
  dataIndex: keyof T | string;
  key: string;
  render?: (text: any, record: T, index: number) => React.ReactNode;
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: {
    text: string;
    value: any;
  }[];
  onFilter?: (value: any, record: T) => boolean;
  width?: string | number;
}

// 分页配置接口
export interface PaginationConfig {
  current?: number;
  pageSize?: number;
  total?: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => React.ReactNode;
  onChange?: (page: number, pageSize: number) => void;
  onShowSizeChange?: (current: number, pageSize: number) => void;
}

// 模态框配置接口
export interface ModalConfig {
  title: string;
  visible: boolean;
  onOk: () => void;
  onCancel: () => void;
  width?: string | number;
  footer?: React.ReactNode;
  maskClosable?: boolean;
  destroyOnHidden?: boolean;
}

// 表单字段配置接口
export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'textarea' | 'file';
  placeholder?: string;
  required?: boolean;
  rules?: FormRule[];
  options?: {
    label: string;
    value: string;
  }[];
  defaultValue?: any;
}

// 表单规则接口
export interface FormRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  validator?: (rule: any, value: any) => Promise<void>;
}

// API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

// 通用记录接口
export interface Record {
  id: string;
  [key: string]: any;
}

// 用户接口
export interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
  roles?: string[];
  password_plain?: string;
  permissions?: string[];
  is_system_admin?: boolean;
  name?: string;
  department?: string;
}

// 筛选条件接口
export interface FilterCondition {
  field: string;
  value: any;
  operator?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in';
}

// 排序配置接口
export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

// 批量操作结果接口
export interface BatchOperationResult {
  successCount: number;
  failedCount: number;
  failedItems?: Array<{ id: string; error: string }>;
}

// 导出配置接口
export interface ExportConfig {
  fileName?: string;
  columns?: string[];
  data?: any[];
  format?: 'csv' | 'json';
}

// 导入配置接口
export interface ImportConfig {
  file: File;
  validate?: (data: any[]) => Array<{ index: number; error: string }>;
  transform?: (data: any[]) => any[];
}

// 工具函数类型定义
export type FormatDateFunction = (date: Date | string | number) => string;
export type ValidateFunction = (value: any) => boolean | string;
export type DebounceFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => void;
export type ThrottleFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => void;

export interface ThemeSettings {
  mode?: 'light' | 'dark' | 'system' | 'custom';
  
  // Content (内容)
  background: string;
  cardBackground: string;
  textPrimary: string;
  textSecondary: string;
  contentFontSize?: number;
  contentLineHeight?: number;
  
  // Border (边框)
  borderColor: string;
  
  // Button (按钮) - Using primaryColor as background usually, but can separate
  primaryColor: string;
  infoColor?: string;
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonFontSize?: number;
  buttonLineHeight?: number;

  secondaryColor?: string;
  
  // Sidebar (导航栏)
  sidebarColor?: string;
  sidebarTextColor?: string;
  sidebarItemHoverBg?: string;
  sidebarUserBg?: string;
  sidebarFontSize?: number;
  sidebarLineHeight?: number;
  
  // Module Header (模块标题)
  moduleTitleColor?: string;
  moduleTitleTextColor?: string;
  moduleTitleFontSize?: number;
  moduleTitleLineHeight?: number;

  customBorderRadius?: number;
  grayMode?: boolean;
  colorWeak?: boolean;
  
  enableAnimation?: boolean;
}

export interface TypographySettings {
  fontFamily: string;
  baseFontSize: string;
  lineHeight: string;
}

export interface LocalizationSettings {
  language: 'zh-CN' | 'en-US' | string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
}


export interface TableColumnSettings {
  key: string;
  width?: number;
  visible?: boolean;
  order?: number;
}

export interface TableSettings {
  columns: TableColumnSettings[];
  updatedAt?: number;
}

import { SystemMaintenanceSettings } from './maintenance';

export interface SystemSettings {
  theme: ThemeSettings;
  typography: TypographySettings;
  darkMode: boolean; // Deprecated, kept for backward compatibility
  layout?: {
    borderRadius: 'sm' | 'md' | 'lg';
    shadow: 'sm' | 'md' | 'lg';
    density: 'compact' | 'standard' | 'comfortable';
  };
  table?: {
    rowHeight: number;
    pageSize: number;
    dateFormat: string; // Kept for backward compatibility, sync with localization.dateFormat
  };
  numberFormat?: {
    thousandSeparator: boolean;
    decimals: number;
  };
  localization?: LocalizationSettings;
  personalization?: PersonalizationSettings;
  tableConfigs?: { [key: string]: TableSettings }; // Table specific settings
  maintenance?: SystemMaintenanceSettings;
  backup?: {
    strategy: 'auto' | 'manual';
    autoBackupDays?: number;
    manualBackupSuggestedDays?: number;
    retentionDays?: number;
    maxBackupCount?: number;
  };
  templates?: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  name: string;
  type: string;
  content: string;
  fileName?: string;
  fileData?: string;
  relatedFunction?: string;
  mappings?: { [key: string]: string }; // Field mappings: instrument field -> template cell
  createdAt: string;
  updatedAt: string;
}


export interface PersonalizationSettings {
  workbench: {
    showHomeModule: boolean;
    shortcutSorting: string[];
    topFunctions: string[];
    dashboardLayout: any;
    moduleSorting?: string[];
    statisticsSorting?: string[];
  };
  listView: {
    defaultPageSize: number;
    defaultSortField?: string;
    defaultVisibleColumns?: string[];
  };
}
export * from './maintenance';
