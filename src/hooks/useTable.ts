import { useState, useEffect, useCallback, useRef } from 'react';
import type { FilterCondition, SortConfig } from '../types/common';

interface TableState<T> {
  data: T[];
  loading: boolean;
  selectedRowKeys: string[];
  currentPage: number;
  pageSize: number;
  total: number;
  filters: Record<string, any>;
  sorter: { field: string; order: 'ascend' | 'descend' } | null;
}

interface UseTableProps<T> {
  apiService: (params: {
    page?: number;
    pageSize?: number;
    filters?: FilterCondition[];
    sorter?: SortConfig;
    search?: any;
  }) => Promise<{ data: T[]; total: number }>;
  initialFilters?: Record<string, any>;
  autoLoad?: boolean;
  pageSize?: number;
}

interface UseTableReturn<T> {
  tableState: TableState<T>;
  loadData: (page?: number, filters?: Record<string, any>, sorter?: any) => Promise<void>;
  refreshData: () => Promise<void>;
  setFilters: (filters: Record<string, any>) => void;
  setSorter: (sorter: { field: string; order: 'ascend' | 'descend' } | null) => void;
  setPageSize: (pageSize: number) => void;
  setSelectedRowKeys: (keys: string[]) => void;
  clearSelection: () => void;
}

/**
 * 通用表格管理Hook
 * 用于统一处理各种表格数据的加载、分页、排序和筛选功能
 */
export function useTable<T extends Record<string, any>>({
  apiService,
  initialFilters = {},
  autoLoad = true,
  pageSize = 20,
}: UseTableProps<T>): UseTableReturn<T> {
  // 初始化表格状态
  const [tableState, setTableState] = useState<TableState<T>>({
    data: [],
    loading: false,
    selectedRowKeys: [],
    currentPage: 1,
    pageSize,
    total: 0,
    filters: initialFilters,
    sorter: null,
  });

  // 取消请求的信号量
  const abortControllerRef = useRef<AbortController | null>(null);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 自动加载数据
  useEffect(() => {
    if (autoLoad) {
      loadData(1, initialFilters);
    }
  }, [autoLoad]);

  // 加载数据的函数
  const loadData = useCallback(async (
    page: number = 1,
    filters: Record<string, any> = tableState.filters,
    sorter: any = tableState.sorter
  ) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    setTableState(prev => ({
      ...prev,
      loading: true,
      currentPage: page,
      filters,
      sorter,
    }));

    try {
      // 构建API请求参数
      const apiParams: any = {
        page,
        pageSize: tableState.pageSize,
      };

      // 添加筛选条件
      if (filters && Object.keys(filters).length > 0) {
        apiParams.filters = Object.entries(filters)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([field, value]) => ({
            field,
            value,
            operator: Array.isArray(value) ? 'in' : 'like',
          }));
      }

      // 添加排序条件
      if (sorter && sorter.field) {
        apiParams.sorter = {
          field: sorter.field,
          order: sorter.order === 'ascend' ? 'asc' : 'desc',
        };
      }

      // 调用服务获取数据
      const response = await apiService(apiParams);

      setTableState(prev => ({
        ...prev,
        data: response.data || [],
        total: response.total || 0,
        loading: false,
      }));
    } catch (error) {
      setTableState(prev => ({
        ...prev,
        data: [],
        total: 0,
        loading: false,
      }));
      console.error('加载数据出错:', error);
    } finally {
      // 清除选中状态
      setTableState(prev => ({
        ...prev,
        selectedRowKeys: [],
      }));
    }
  }, [apiService, tableState.pageSize]);

  // 刷新数据
  const refreshData = useCallback(async () => {
    await loadData(tableState.currentPage, tableState.filters, tableState.sorter);
  }, [loadData, tableState.currentPage, tableState.filters, tableState.sorter]);

  // 设置筛选条件
  const setFilters = useCallback((filters: Record<string, any>) => {
    setTableState(prev => ({
      ...prev,
      filters,
    }));
    loadData(1, filters, tableState.sorter);
  }, [loadData, tableState.sorter]);

  // 设置排序
  const setSorter = useCallback((sorter: { field: string; order: 'ascend' | 'descend' } | null) => {
    setTableState(prev => ({
      ...prev,
      sorter,
    }));
    loadData(1, tableState.filters, sorter);
  }, [loadData, tableState.filters]);

  // 设置页面大小
  const setPageSize = useCallback((pageSize: number) => {
    setTableState(prev => ({
      ...prev,
      pageSize,
    }));
    loadData(1, tableState.filters, tableState.sorter);
  }, [loadData, tableState.filters, tableState.sorter]);

  // 设置选中行
  const setSelectedRowKeys = useCallback((keys: string[]) => {
    setTableState(prev => ({
      ...prev,
      selectedRowKeys: keys,
    }));
  }, []);

  // 清除选中状态
  const clearSelection = useCallback(() => {
    setTableState(prev => ({
      ...prev,
      selectedRowKeys: [],
    }));
  }, []);

  return {
    tableState,
    loadData,
    refreshData,
    setFilters,
    setSorter,
    setPageSize,
    setSelectedRowKeys,
    clearSelection,
  };
}

export default useTable;