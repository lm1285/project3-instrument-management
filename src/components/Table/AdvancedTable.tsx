/**
 * 高级表格组件
 * 统一处理表格数据、分页、排序、筛选、选择等功能
 */
import React, { useState, useMemo, useRef } from 'react';
import { Button } from 'antd';
import type { TableProps } from 'antd';

import { Table, Pagination } from 'antd';
import type { SorterResult } from 'antd/es/table/interface';

/**
 * 表格列配置接口
 */
export interface EnhancedTableColumn<T> {
  key: string;
  title: React.ReactNode;
  dataIndex?: keyof T;
  width?: number | string;
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: {
    text: string;
    value: string;
  }[];
  onFilter?: (value: string | number | boolean, record: T) => boolean;
  render?: (text: any, record: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

/**
 * 表格操作接口
 */
export interface TableActions<T> {
  onAdd?: () => void;
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void;
  onBatchDelete?: (selectedKeys: React.Key[]) => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  [key: string]: ((...args: any[]) => void) | undefined;
}

/**
 * 高级表格属性接口
 */
export interface AdvancedTableProps<T> {
  /** 数据源 */
  dataSource: T[];
  /** 表格列配置 */
  columns: EnhancedTableColumn<T>[];
  /** 表格行的唯一键 */
  rowKey?: keyof T | ((record: T) => string | number);
  /** 加载状态 */
  loading?: boolean;
  /** 是否启用分页 */
  pagination?: boolean | TableProps<T>['pagination'];
  /** 表格标题 */
  title?: string;
  /** 表格操作配置 */
  actions?: TableActions<T>;
  /** 是否启用行选择 */
  enableSelection?: boolean;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 表格行点击处理 */
  onRowClick?: (record: T, index: number) => void;
  /** 表格变化处理 */
  onChange?: (pagination: any, filters: any, sorter: any) => void;
  /** 选中行变化处理 */
  onSelectChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
  /** 表格样式 */
  style?: React.CSSProperties;
  /** 表格类名 */
  className?: string;
  /** 空状态渲染 */
  locale?: TableProps<T>['locale'];
  /** 是否自动展开 */
  expandable?: TableProps<T>['expandable'];
  /** 自定义工具栏 */
  customToolbar?: React.ReactNode;
}

/**
 * 高级表格组件
 */
export function AdvancedTable<T extends Record<string, any>>({
  dataSource = [],
  columns,
  rowKey = 'id',
  loading = false,
  pagination = true,
  title,
  actions = {},
  enableSelection = false,
  showToolbar = true,
  onRowClick,
  onChange,
  onSelectChange,
  style,
  className,
  locale,
  expandable,
  customToolbar
}: AdvancedTableProps<T>) {
  // 选中行状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 表格引用
  const tableRef = useRef<any>(null);
  
  // 转换列配置为 Ant Design Table 所需格式
  const tableColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      dataIndex: col.dataIndex || col.key,
      sorter: typeof col.sorter === 'function' 
        ? col.sorter 
        : col.sorter === true 
          ? (a: T, b: T) => {
              const aValue = a[col.dataIndex as keyof T];
              const bValue = b[col.dataIndex as keyof T];
              
              if (typeof aValue === 'string' && typeof bValue === 'string') {
                return aValue.localeCompare(bValue);
              }
              
              if (typeof aValue === 'number' && typeof bValue === 'number') {
                return aValue - bValue;
              }
              
              return 0;
            }
          : false,
      render: col.render,
      align: col.align || 'center'
    }));
  }, [columns]);
  
  // 处理选择变化
  const handleSelectChange = (newSelectedRowKeys: React.Key[], newSelectedRows: T[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
    
    if (onSelectChange) {
      onSelectChange(newSelectedRowKeys, newSelectedRows);
    }
  };
  
  // 处理表格变化
  const handleTableChange = (pagination: any, filters: any, sorter: SorterResult<T> | SorterResult<T>[]) => {
    if (onChange) {
      onChange(pagination, filters, sorter);
    }
  };
  
  // 处理批量删除
  const handleBatchDelete = () => {
    if (actions.onBatchDelete) {
      actions.onBatchDelete(selectedRowKeys);
    }
  };
  
  // 处理行选择配置
  const rowSelectionConfig = enableSelection ? {
    selectedRowKeys,
    onChange: handleSelectChange,
    onSelect: (_record: any, _selected: boolean) => {
        // 可以在这里添加额外的选择逻辑
      },
    onSelectAll: (_selected: boolean, _selectedRows: any[], _changeRows: any[]) => {
        // 可以在这里添加全选逻辑
      }
  } : undefined;
  
  // 处理行点击
  const rowProps = onRowClick ? {
    onClick: (_e: React.MouseEvent, record: T, index: number) => {
      onRowClick(record, index);
    }
  } : {};
  
  // 渲染工具栏
  const renderToolbar = () => {
    if (!showToolbar) return null;
    
    return (
      <div className="advanced-table-toolbar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.onAdd && (
            <Button type="primary" onClick={actions.onAdd}>
              添加
            </Button>
          )}
          
          {actions.onImport && (
            <Button onClick={actions.onImport}>
              导入
            </Button>
          )}
          
          {actions.onExport && (
            <Button onClick={actions.onExport}>
              导出
            </Button>
          )}
          
          {actions.onRefresh && (
            <Button onClick={actions.onRefresh}>
              刷新
            </Button>
          )}
          
          {customToolbar}
        </div>
        
        <div>
          {actions.onBatchDelete && selectedRowKeys.length > 0 && (
            <Button type="primary" danger onClick={handleBatchDelete}>
              批量删除 ({selectedRowKeys.length})
            </Button>
          )}
        </div>
      </div>
    );
  };
  
  // 渲染表格标题
  const renderTitle = () => {
    if (!title) return null;
    
    return (
      <div className="advanced-table-title" style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 16 }}>
        {title}
      </div>
    );
  };
  
  // 智能判断是否为服务端分页
  // 如果提供了 total 且 total > dataSource.length，或者明确指定了 current/pageSize 但 dataSource 数量不足
  const isServerSidePagination = useMemo(() => {
    if (typeof pagination === 'object' && pagination) {
      const { total, pageSize = 20 } = pagination as any;
      if (total !== undefined && (dataSource.length < total || dataSource.length <= pageSize)) {
        return true;
      }
    }
    return false;
  }, [pagination, dataSource.length]);

  const paginationConfig = typeof pagination === 'object' ? {
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条记录`,
    ...pagination
  } : (pagination ? { 
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条记录`
  } : false);

  return (
    <div className={`advanced-table-container ${className || ''}`} style={style}>
      {renderTitle()}
      {renderToolbar()}
      
      <Table
        ref={tableRef}
        columns={tableColumns as any}
        dataSource={dataSource}
        rowKey={rowKey}
        loading={loading}
        pagination={isServerSidePagination ? false : paginationConfig}
        rowSelection={rowSelectionConfig}
        onChange={handleTableChange}
        onRow={rowProps as any}
        locale={{
          emptyText: '暂无数据',
          ...locale
        }}
        expandable={expandable}
        scroll={{ x: 'max-content' }}
      />
      
      {isServerSidePagination && paginationConfig && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Pagination
            {...paginationConfig}
            onChange={(page, pageSize) => {
              if (paginationConfig.onChange) {
                paginationConfig.onChange(page, pageSize);
              }
              // 如果使用了 AdvancedTable 的 onChange，也触发它
              // 注意：这里模拟 Table 的 onChange，但是 filters 和 sorter 拿不到最新的状态
              // 如果是服务端分页，通常 onChange 会直接触发加载
              if (onChange) {
                onChange({ ...paginationConfig, current: page, pageSize }, {}, {} as any);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

export default AdvancedTable;