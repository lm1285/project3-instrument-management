import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import INSTRUMENT_TABLE_COLUMNS, { InstrumentTableColumn, getInstrumentColumns, SortDirection } from './InstrumentTableColumns';
import { useSystemSettings } from '../../features/system-settings/hooks/useSystemSettings';
import { TableSettings } from '../../types/common';
import { ConfigProvider } from 'antd';
import Pagination from './Pagination';
import './DataTable.css';

interface DataTableProps<T> {
  dataSource: T[];
  columns?: InstrumentTableColumn[];
  columnKeys?: string[]; // 如果提供，将使用这些key从标准列中过滤
  rowKey?: keyof T;
  loading?: boolean;
  pagination?: boolean;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onSelectChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
  onRowClick?: (record: T, index: number) => void;
  onRowDoubleClick?: (record: T, index: number) => void;
  rowClassName?: (record: T, index: number) => string;
  onSortChange?: (columnKey: string, direction: SortDirection) => void;
  onFilterChange?: (columnKey: string, values: string[] | string) => void;
  onColumnsChange?: (columns: InstrumentTableColumn[]) => void;
  defaultSorted?: { columnKey: string; direction: SortDirection };
  defaultFiltered?: Record<string, string[] | string>;
  selectedRowKeys?: React.Key[]; // 外部传入的选中行keys
  maxTableWidth?: number | null;
  bodyMaxHeight?: number | string;
  tableId?: string; // 用于持久化存储列配置的唯一标识
  total?: number; // 总条数（用于服务端分页）
  expandable?: {
    expandedRowRender: (record: T) => React.ReactNode;
    rowExpandable?: (record: T) => boolean;
    columnIndex?: number;
  };
}

const MAX_COLUMN_WIDTH = 600;

interface GlobalScrollbarMetrics {
  hasOverflow: boolean;
  contentWidth: number;
  viewportWidth: number;
  scrollLeft: number;
  rect: DOMRect;
}

interface GlobalScrollbarEntry {
  id: string;
  container: HTMLDivElement;
  getMetrics: () => GlobalScrollbarMetrics;
}

const globalScrollbarEntries = new Map<string, GlobalScrollbarEntry>();
let globalScrollbarActiveId: string | null = null;
let globalScrollbarTrackEl: HTMLDivElement | null = null;
let globalScrollbarThumbEl: HTMLDivElement | null = null;
let globalScrollbarThumbWidth = 0;
let globalScrollbarFrame: number | null = null;
let globalScrollbarListenersBound = false;
const globalScrollbarDragState = {
  isDragging: false,
  startX: 0,
  startScrollLeft: 0,
};

const getHiddenMetrics = (): GlobalScrollbarMetrics => ({
  hasOverflow: false,
  contentWidth: 0,
  viewportWidth: 0,
  scrollLeft: 0,
  rect: new DOMRect(0, 0, 0, 0),
});

const hideGlobalScrollbar = () => {
  if (!globalScrollbarTrackEl) return;
  globalScrollbarTrackEl.style.opacity = '0';
  globalScrollbarTrackEl.style.pointerEvents = 'none';
};

const getPreferredGlobalScrollbarEntry = (): GlobalScrollbarEntry | null => {
  if (globalScrollbarDragState.isDragging && globalScrollbarActiveId) {
    const draggingEntry = globalScrollbarEntries.get(globalScrollbarActiveId) || null;
    if (draggingEntry?.getMetrics().hasOverflow) {
      return draggingEntry;
    }
  }

  const activeEntry = globalScrollbarActiveId
    ? globalScrollbarEntries.get(globalScrollbarActiveId) || null
    : null;

  if (activeEntry) {
    const metrics = activeEntry.getMetrics();
    const visibleHeight =
      Math.min(metrics.rect.bottom, window.innerHeight) - Math.max(metrics.rect.top, 0);
    if (metrics.hasOverflow && visibleHeight > 80) {
      return activeEntry;
    }
  }

  let bestEntry: GlobalScrollbarEntry | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  globalScrollbarEntries.forEach((entry) => {
    const metrics = entry.getMetrics();
    if (!metrics.hasOverflow) return;

    const visibleHeight = Math.min(metrics.rect.bottom, window.innerHeight) - Math.max(metrics.rect.top, 0);
    if (visibleHeight <= 0) return;

    const bottomAnchor = window.innerHeight - 96;
    const distanceToBottomAnchor = Math.abs(metrics.rect.bottom - bottomAnchor);
    const center = metrics.rect.top + metrics.rect.height / 2;
    const distanceToViewportCenter = Math.abs(center - window.innerHeight / 2);
    const score =
      visibleHeight * 1000 -
      distanceToBottomAnchor * 2 -
      distanceToViewportCenter * 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  });

  return bestEntry;
};

const syncGlobalScrollbarThumb = (entry: GlobalScrollbarEntry, metrics?: GlobalScrollbarMetrics) => {
  if (!globalScrollbarTrackEl || !globalScrollbarThumbEl) return;

  const nextMetrics = metrics ?? entry.getMetrics();
  const trackWidth = globalScrollbarTrackEl.clientWidth;
  const maxThumbOffset = Math.max(trackWidth - globalScrollbarThumbWidth, 0);
  const maxScrollLeft = Math.max(nextMetrics.contentWidth - nextMetrics.viewportWidth, 1);
  const thumbOffset = Math.min(maxThumbOffset, (nextMetrics.scrollLeft / maxScrollLeft) * maxThumbOffset);

  globalScrollbarThumbEl.style.transform = `translate3d(${Number.isFinite(thumbOffset) ? thumbOffset : 0}px, 0, 0)`;
};

const refreshGlobalScrollbar = () => {
  if (typeof window === 'undefined') return;
  if (!globalScrollbarTrackEl || !globalScrollbarThumbEl) return;

  const entry = getPreferredGlobalScrollbarEntry();
  if (!entry) {
    hideGlobalScrollbar();
    return;
  }

  globalScrollbarActiveId = entry.id;
  const metrics = entry.getMetrics();
  if (!metrics.hasOverflow) {
    hideGlobalScrollbar();
    return;
  }

  const margin = 20;
  const safeViewportWidth = Math.max(window.innerWidth - margin * 2, 160);
  const trackWidth = Math.max(160, Math.min(metrics.rect.width - 20, safeViewportWidth));
  const left = Math.max(margin, Math.min(metrics.rect.left + 10, window.innerWidth - margin - trackWidth));
  globalScrollbarThumbWidth = Math.max(
    56,
    Math.round((metrics.viewportWidth / metrics.contentWidth) * trackWidth),
  );

  globalScrollbarTrackEl.style.left = `${Math.round(left)}px`;
  globalScrollbarTrackEl.style.width = `${Math.round(trackWidth)}px`;
  globalScrollbarTrackEl.style.opacity = '1';
  globalScrollbarTrackEl.style.pointerEvents = 'auto';
  globalScrollbarThumbEl.style.width = `${globalScrollbarThumbWidth}px`;

  syncGlobalScrollbarThumb(entry, metrics);
};

const scheduleGlobalScrollbarRefresh = () => {
  if (typeof window === 'undefined') return;
  if (globalScrollbarFrame !== null) {
    cancelAnimationFrame(globalScrollbarFrame);
  }

  globalScrollbarFrame = requestAnimationFrame(() => {
    refreshGlobalScrollbar();
    globalScrollbarFrame = null;
  });
};

const handleGlobalScrollbarMouseMove = (event: MouseEvent) => {
  if (!globalScrollbarDragState.isDragging) return;

  const entry = globalScrollbarActiveId
    ? globalScrollbarEntries.get(globalScrollbarActiveId) || null
    : null;

  if (!entry || !globalScrollbarTrackEl) return;

  const metrics = entry.getMetrics();
  const deltaX = event.clientX - globalScrollbarDragState.startX;
  const maxThumbOffset = Math.max(globalScrollbarTrackEl.clientWidth - globalScrollbarThumbWidth, 1);
  const maxScrollLeft = Math.max(metrics.contentWidth - metrics.viewportWidth, 0);
  const ratio = maxScrollLeft / maxThumbOffset;

  entry.container.scrollLeft = Math.max(
    0,
    Math.min(maxScrollLeft, globalScrollbarDragState.startScrollLeft + deltaX * ratio),
  );
};

const handleGlobalScrollbarMouseUp = () => {
  globalScrollbarDragState.isDragging = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
};

const handleGlobalScrollbarTrackMouseDown = (event: MouseEvent) => {
  if (!globalScrollbarTrackEl) return;
  if (event.target !== globalScrollbarTrackEl) return;

  const entry = globalScrollbarActiveId
    ? globalScrollbarEntries.get(globalScrollbarActiveId) || null
    : null;

  if (!entry) return;

  const metrics = entry.getMetrics();
  const rect = globalScrollbarTrackEl.getBoundingClientRect();
  const clickOffset = event.clientX - rect.left - globalScrollbarThumbWidth / 2;
  const maxThumbOffset = Math.max(globalScrollbarTrackEl.clientWidth - globalScrollbarThumbWidth, 1);
  const maxScrollLeft = Math.max(metrics.contentWidth - metrics.viewportWidth, 0);
  const nextThumbOffset = Math.max(0, Math.min(maxThumbOffset, clickOffset));

  entry.container.scrollLeft = (nextThumbOffset / maxThumbOffset) * maxScrollLeft;
};

const handleGlobalScrollbarThumbMouseDown = (event: MouseEvent) => {
  event.preventDefault();
  event.stopPropagation();

  const entry = globalScrollbarActiveId
    ? globalScrollbarEntries.get(globalScrollbarActiveId) || null
    : null;

  if (!entry) return;

  globalScrollbarDragState.isDragging = true;
  globalScrollbarDragState.startX = event.clientX;
  globalScrollbarDragState.startScrollLeft = entry.container.scrollLeft;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'grabbing';
};

const ensureGlobalScrollbar = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!globalScrollbarTrackEl) {
    globalScrollbarTrackEl = document.createElement('div');
    globalScrollbarTrackEl.className = 'data-table-global-scrollbar';
    globalScrollbarTrackEl.addEventListener('mousedown', handleGlobalScrollbarTrackMouseDown);

    globalScrollbarThumbEl = document.createElement('div');
    globalScrollbarThumbEl.className = 'data-table-global-scrollbar-thumb';
    globalScrollbarThumbEl.addEventListener('mousedown', handleGlobalScrollbarThumbMouseDown);

    globalScrollbarTrackEl.appendChild(globalScrollbarThumbEl);
    document.body.appendChild(globalScrollbarTrackEl);
    hideGlobalScrollbar();
  }

  if (!globalScrollbarListenersBound) {
    window.addEventListener('mousemove', handleGlobalScrollbarMouseMove);
    window.addEventListener('mouseup', handleGlobalScrollbarMouseUp);
    window.addEventListener('resize', scheduleGlobalScrollbarRefresh, { passive: true });
    window.addEventListener('scroll', scheduleGlobalScrollbarRefresh, { passive: true });
    globalScrollbarListenersBound = true;
  }
};

const registerGlobalScrollbarEntry = (entry: GlobalScrollbarEntry) => {
  ensureGlobalScrollbar();
  globalScrollbarEntries.set(entry.id, entry);
  scheduleGlobalScrollbarRefresh();
};

const unregisterGlobalScrollbarEntry = (id: string) => {
  globalScrollbarEntries.delete(id);

  if (globalScrollbarActiveId === id) {
    globalScrollbarActiveId = null;
  }

  if (globalScrollbarEntries.size === 0) {
    hideGlobalScrollbar();
  } else {
    scheduleGlobalScrollbarRefresh();
  }
};

function DataTable<T extends Record<string, any>>({
  dataSource = [],
  columns: customColumns,
  columnKeys,
  rowKey = 'id',
  pagination = true,
  pageSize: propPageSize,
  currentPage: propCurrentPage,
  onPageChange,
  onSelectChange,
  onRowClick,
  onRowDoubleClick,
  rowClassName,
  onSortChange,
  onFilterChange,
  onColumnsChange,
  defaultSorted,
  defaultFiltered,
  selectedRowKeys: externalSelectedRowKeys,
  maxTableWidth,
  bodyMaxHeight,
  tableId,
  total,
  expandable
}: DataTableProps<T>) {
  // 系统设置
  const [settings, setSettings] = useSystemSettings();
  
  // 计算默认分页大小
  const defaultPageSize = settings.personalization?.listView?.defaultPageSize || settings.table?.pageSize || 20;
  
  // 内部状态用于非受控分页
  const [internalCurrentPage, setInternalCurrentPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  // 确定最终使用的分页参数
  const isControlled = propCurrentPage !== undefined;
  const currentPage = isControlled ? propCurrentPage : internalCurrentPage;
  const pageSize = propPageSize !== undefined ? propPageSize : internalPageSize;
  
  // 处理页码变化
  const handlePageChange = (page: number, size?: number) => {
    const newSize = size || pageSize;
    
    // 如果不是受控组件，更新内部状态
    if (!isControlled) {
      setInternalCurrentPage(page);
    }
    
    if (propPageSize === undefined && newSize !== pageSize) {
      setInternalPageSize(newSize);
      // 如果改变了页大小，通常重置到第一页，但这里让Pagination组件或父组件处理逻辑
      if (!isControlled) setInternalCurrentPage(1); 
    }
    
    if (onPageChange) {
      onPageChange(page, newSize);
    }
  };

  // 计算总页数
  // const totalPages = total !== undefined 
  //   ? Math.ceil(total / pageSize) 
  //   : Math.ceil(dataSource.length / pageSize);

  // 状态管理
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>(externalSelectedRowKeys || []);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [sortedColumn, setSortedColumn] = useState<string | null>(defaultSorted?.columnKey || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSorted?.direction || null);
  const [filteredColumns, setFilteredColumns] = useState<Record<string, string[] | string>>(defaultFiltered || {});
  const [showFilterMenu, setShowFilterMenu] = useState<string | null>(null);
  const [columns, setColumns] = useState<InstrumentTableColumn[]>([]);
  const [stickyScrollbarVisible, setStickyScrollbarVisible] = useState(false);
  const [stickyScrollbarWidth, setStickyScrollbarWidth] = useState(0);
  const [stickyScrollbarViewportWidth, setStickyScrollbarViewportWidth] = useState(0);
  const lastEmittedColumnsRef = useRef<string>('');
  const initializedColumnsRef = useRef<boolean>(false);
  const instanceIdRef = useRef(`data-table-${Math.random().toString(36).slice(2, 11)}`);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tableElementRef = useRef<HTMLTableElement | null>(null);
  const stickyScrollbarWidthRef = useRef(0);
  const stickyScrollbarViewportWidthRef = useRef(0);
  // 拖拽相关的引用和状态
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  // 列宽调整相关引用
  const resizeStateRef = useRef<{
    isResizing: boolean;
    columnKey: string;
    startX: number;
    startWidth: number;
    currentWidth?: number;
  }>({ isResizing: false, columnKey: '', startX: 0, startWidth: 0 });
  // 存储表头单元格的引用，以便直接操作DOM
  const headerCellRefs = useRef<Record<string, HTMLElement | null>>({});
  
  // 保存列配置到系统设置
  const saveColumnSettings = (currentColumns: InstrumentTableColumn[], currentWidths: Record<string, number>) => {
    // 使用 setTimeout 将状态更新推迟到渲染周期之后，避免 "Cannot update a component while rendering" 警告
    setTimeout(() => {
      // 通知外部列配置变更
      if (onColumnsChange) {
        const columnsSignature = JSON.stringify(currentColumns.map(c => c.key)) + JSON.stringify(currentWidths);
        if (lastEmittedColumnsRef.current !== columnsSignature) {
          lastEmittedColumnsRef.current = columnsSignature;
          // Create a new array with updated widths
          const updatedColumns = currentColumns.map(col => ({
            ...col,
            width: currentWidths[col.key] || col.width
          }));
          onColumnsChange(updatedColumns);
        }
      }

      if (!tableId) return;
      
      const newTableSettings: TableSettings = {
        updatedAt: Date.now(),
        columns: currentColumns.map((col, index) => ({
          key: col.key,
          width: currentWidths[col.key] || (typeof col.width === 'number' ? col.width : parseInt(col.width as string, 10) || 100),
          visible: true,
          order: index
        }))
      };

      setSettings(prev => ({
        ...prev,
        tableConfigs: {
          ...prev.tableConfigs,
          [tableId]: newTableSettings
        }
      }));
    }, 0);
  };

  // 处理列宽调整
  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    
    // 获取当前实际宽度，避免从自动宽度跳变到默认值
    let startWidth = columnWidths[columnKey];
    if (startWidth === undefined || isNaN(startWidth)) {
      const cell = headerCellRefs.current[columnKey];
      startWidth = cell ? cell.offsetWidth : 100;
    }
    
    resizeStateRef.current = {
      isResizing: true,
      columnKey,
      startX,
      startWidth: startWidth || 100, // Ensure strictly number
      currentWidth: startWidth || 100
    };
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeStateRef.current.isResizing) return;
      
      const diff = moveEvent.clientX - resizeStateRef.current.startX;
      const newWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(50, resizeStateRef.current.startWidth + diff));
      
      // 直接更新DOM，避免频繁React渲染
      const headerCell = headerCellRefs.current[columnKey];
      if (headerCell) {
        // 强制设置宽度、最小宽度和最大宽度，确保浏览器立即响应
        headerCell.style.width = `${newWidth}px`;
        headerCell.style.minWidth = `${newWidth}px`;
        headerCell.style.maxWidth = `${newWidth}px`;
        
        // 同时更新列中所有单元格的宽度
        const table = headerCell.closest('table');
        if (table) {
          const colIndex = Array.from(headerCell.parentElement?.children || []).indexOf(headerCell);
          if (colIndex !== -1) {
             // 记录当前宽度，供 mouseup 使用
             resizeStateRef.current.currentWidth = newWidth;
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      if (resizeStateRef.current.isResizing) {
        const finalWidth = resizeStateRef.current.currentWidth;
        if (finalWidth) {
          setColumnWidths(prev => {
             const next = { ...prev, [columnKey]: finalWidth };
             saveColumnSettings(columns, next); // Save on resize end
             return next;
          });
        }
        
        resizeStateRef.current = { isResizing: false, columnKey: '', startX: 0, startWidth: 0 };
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 处理列拖拽
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    // 设置拖拽图像，避免遮挡
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };
  
  const handleDragOver = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetKey) return;
    
    // 简单的重新排序逻辑
    const fromIndex = columns.findIndex(c => c.key === draggedColumn);
    const toIndex = columns.findIndex(c => c.key === targetKey);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const newColumns = [...columns];
    const [movedColumn] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, movedColumn);
    
    setColumns(newColumns);
    // 这里不立即保存，等待拖拽结束
  };
  
  const handleDragEnd = () => {
    if (draggedColumn) {
      saveColumnSettings(columns, columnWidths); // Save on drag end
    }
    setDraggedColumn(null);
  };

  // 记录上一次的tableId，用于检测变化
  const mergeColumnsByReferenceOrder = useCallback(
    (
      currentColumns: InstrumentTableColumn[],
      referenceColumns: InstrumentTableColumn[],
    ): InstrumentTableColumn[] => {
      if (currentColumns.length === 0) {
        return referenceColumns;
      }

      const referenceMap = new Map(referenceColumns.map((column) => [column.key, column]));
      const mergedColumns = currentColumns
        .filter((column) => referenceMap.has(column.key))
        .map((column) => referenceMap.get(column.key) || column);
      const existingKeys = new Set(mergedColumns.map((column) => column.key));

      referenceColumns.forEach((column, referenceIndex) => {
        if (existingKeys.has(column.key)) {
          return;
        }

        const nextKnownColumn = referenceColumns
          .slice(referenceIndex + 1)
          .find((candidate) => existingKeys.has(candidate.key));
        const insertIndex = nextKnownColumn
          ? mergedColumns.findIndex((candidate) => candidate.key === nextKnownColumn.key)
          : mergedColumns.length;

        mergedColumns.splice(insertIndex, 0, column);
        existingKeys.add(column.key);
      });

      return mergedColumns;
    },
    [],
  );

  const prevTableIdRef = useRef(tableId);
  // 记录上次应用配置的时间戳，用于决定是否需要更新
  const lastAppliedUpdatedAtRef = useRef<number>(0);

  // 初始化列配置
  useEffect(() => {
    // 如果tableId变化，强制重新初始化
    if (tableId !== prevTableIdRef.current) {
      initializedColumnsRef.current = false;
      lastAppliedUpdatedAtRef.current = 0;
      prevTableIdRef.current = tableId;
    }

    const currentConfig = tableId && settings.tableConfigs?.[tableId];
    const configUpdatedAt = (currentConfig && typeof currentConfig === 'object' && (currentConfig as TableSettings).updatedAt) || 0;

    // 决定是否需要运行初始化逻辑：
    // 1. 尚未初始化
    // 2. 已初始化，但检测到更新的配置（时间戳更大）
    const shouldInitialize = !initializedColumnsRef.current || (currentConfig && configUpdatedAt > lastAppliedUpdatedAtRef.current);

    if (!shouldInitialize) return;

    let initialColumns = customColumns || (columnKeys ? getInstrumentColumns(columnKeys) : INSTRUMENT_TABLE_COLUMNS);
    
    // 如果有保存的配置，应用配置
    if (currentConfig) {
      const savedConfig = currentConfig;
      
      // 1. 应用宽度
      // 2. 应用顺序
      
      // 创建一个包含所有初始列的Map，方便查找
      const initialColumnsMap = new Map(initialColumns.map(c => [c.key, c]));
      
      // 根据保存的顺序重构columns
      const newColumns: InstrumentTableColumn[] = [];
      const processedKeys = new Set<string>();
      
      // 添加保存的列
      savedConfig.columns
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach(savedCol => {
          const col = initialColumnsMap.get(savedCol.key);
          if (col) {
            newColumns.push(col);
            processedKeys.add(savedCol.key);
          }
        });
        
      // 添加未保存但存在的列（可能是新增的列）
      initialColumns.forEach(col => {
        if (!processedKeys.has(col.key)) {
          newColumns.push(col);
        }
      });
      
      if (newColumns.length > 0) {
        initialColumns = mergeColumnsByReferenceOrder(newColumns, initialColumns);
      }

      // 更新最后应用的时间戳
      lastAppliedUpdatedAtRef.current = configUpdatedAt;
    }

    setColumns(initialColumns);
    
    const initialWidths: Record<string, number> = {};
    initialColumns.forEach(col => {
      // 优先使用保存的宽度
      if (currentConfig) {
        const savedCol = currentConfig.columns.find(c => c.key === col.key);
        if (savedCol && savedCol.width) {
          initialWidths[col.key] = savedCol.width;
          return;
        }
      }
      
      if (col.width) {
        initialWidths[col.key] = typeof col.width === 'number' ? col.width : parseInt(col.width as string, 10) || 100;
      }
    });
    setColumnWidths(initialWidths);
    initializedColumnsRef.current = true;
  }, [columnKeys, customColumns, mergeColumnsByReferenceOrder, settings.tableConfigs, tableId]);

  useEffect(() => {
    if (!customColumns || !initializedColumnsRef.current) {
      return;
    }

    const nextColumns = mergeColumnsByReferenceOrder(columns, customColumns);
    const currentKeys = columns.map((column) => column.key).join('|');
    const nextKeys = nextColumns.map((column) => column.key).join('|');

    if (currentKeys !== nextKeys) {
      setColumns(nextColumns);
    }
  }, [columns, customColumns, mergeColumnsByReferenceOrder]);
  
  // 当外部selectedRowKeys变化时更新内部状态
  useEffect(() => {
    if (externalSelectedRowKeys !== undefined) {
      setSelectedRowKeys(externalSelectedRowKeys);
    }
  }, [externalSelectedRowKeys]);
  
  // 处理选择变化
  const handleSelectChange = (checked: boolean, record: T) => {
    const newSelectedRowKeys = checked 
      ? [...selectedRowKeys, record[rowKey]]
      : selectedRowKeys.filter(key => key !== record[rowKey]);
      
    const newSelectedRows = checked
      ? [...selectedRows, record]
      : selectedRows.filter(row => row[rowKey] !== record[rowKey]);
      
    setSelectedRowKeys(newSelectedRowKeys);
    setSelectedRows(newSelectedRows);
    
    if (onSelectChange) {
      onSelectChange(newSelectedRowKeys, newSelectedRows);
    }
  };
  
  // 根据分页计算显示的数据
  const safeDataSource = Array.isArray(dataSource) ? dataSource : [];
  
  // 智能判断是否需要客户端分页切片
  // 如果 total 存在且大于当前数据量，或者 total 存在且当前数据量小于等于 pageSize，通常意味着是服务端分页
  // 这种情况下不应该再次切片
  const isServerSide = total !== undefined && (safeDataSource.length < total || safeDataSource.length <= pageSize);
  
  const displayData = (pagination && !isServerSide)
    ? safeDataSource.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : safeDataSource;
    
  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = safeDataSource.map(item => item[rowKey]);
      setSelectedRowKeys(allKeys);
      setSelectedRows(safeDataSource);
      if (onSelectChange) {
        onSelectChange(allKeys, safeDataSource);
      }
    } else {
      setSelectedRowKeys([]);
      setSelectedRows([]);
      if (onSelectChange) {
        onSelectChange([], []);
      }
    }
  };
  
  // 处理排序
  const handleSort = (columnKey: string, column: InstrumentTableColumn) => {
    if (!column.sorter) return;
    
    let newDirection: SortDirection = null;
    if (sortedColumn === columnKey) {
      // 切换排序方向
      if (sortDirection === 'ascend') {
        newDirection = 'descend';
      } else if (sortDirection === 'descend') {
        newDirection = null;
      } else {
        newDirection = 'ascend';
      }
    } else {
      newDirection = 'ascend';
    }
    
    setSortedColumn(newDirection ? columnKey : null);
    setSortDirection(newDirection);
    
    if (onSortChange) {
      onSortChange(columnKey, newDirection);
    }
  };
  
  // 处理筛选
  const handleFilter = (columnKey: string, value: string, checked: boolean, column: InstrumentTableColumn) => {
    if (!column.filterable) return;
    
    let newFilteredColumns = { ...filteredColumns };
    const filterMultiple = column.filterMultiple !== false;
    
    if (filterMultiple) {
      // 多选筛选
      const currentFilters = (newFilteredColumns[columnKey] as string[]) || [];
      if (checked) {
        newFilteredColumns[columnKey] = [...currentFilters, value];
      } else {
        newFilteredColumns[columnKey] = currentFilters.filter(v => v !== value);
      }
    } else {
      // 单选筛选
      newFilteredColumns[columnKey] = checked ? value : '';
    }
    
    setFilteredColumns(newFilteredColumns);
    
    if (onFilterChange) {
      onFilterChange(columnKey, newFilteredColumns[columnKey]);
    }
  };
  
  // 切换筛选菜单显示
  const toggleFilterMenu = (columnKey: string) => {
    setShowFilterMenu(showFilterMenu === columnKey ? null : columnKey);
  };
  
  // 组件卸载时确保清理所有样式
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);
  
  // 渲染排序图标
  const renderSortIcon = (column: InstrumentTableColumn) => {
    if (!column.sorter) return null;
    
    return (
      <span className={`data-table-sort-icon ${sortDirection || ''}`}>
        <span className="sort-icon-asc">▲</span>
        <span className="sort-icon-desc">▼</span>
      </span>
    );
  };
  
  // 渲染筛选图标
  const renderFilterIcon = (column: InstrumentTableColumn) => {
    if (!column.filterable) return null;
    
    const isFiltered = filteredColumns[column.key] && 
      ((Array.isArray(filteredColumns[column.key]) && (filteredColumns[column.key] as string[]).length > 0) || 
       (typeof filteredColumns[column.key] === 'string' && filteredColumns[column.key] !== ''));
    
    return (
      <span 
        className={`data-table-filter-icon ${isFiltered ? 'filtered' : ''}`}
        onClick={() => toggleFilterMenu(column.key)}
      >
        筛选
      </span>
    );
  };
  
  // 渲染筛选菜单
  const renderFilterMenu = (column: InstrumentTableColumn) => {
    if (!column.filterable || showFilterMenu !== column.key || !column.filters) return null;
    
    const currentFilters = (filteredColumns[column.key] as string[]) || [];
    const filterMultiple = column.filterMultiple !== false;
    
    return (
      <div className="data-table-filter-menu">
        {column.filters.map(filter => {
          const isChecked = filterMultiple 
            ? currentFilters.includes(filter.value)
            : filteredColumns[column.key] === filter.value;
          
          return (
            <div key={filter.value} className="filter-option">
              <input
                type={filterMultiple ? 'checkbox' : 'radio'}
                id={`filter-${column.key}-${filter.value}`}
                name={filterMultiple ? `filter-${column.key}` : `radio-filter-${column.key}`}
                checked={isChecked}
                onChange={(e) => handleFilter(column.key, filter.value, e.target.checked, column)}
              />
              <label htmlFor={`filter-${column.key}-${filter.value}`}>{filter.text}</label>
            </div>
          );
        })}
      </div>
    );
  };
  
  // 渲染单元格内容
  const renderCell = (record: T, column: InstrumentTableColumn, index: number) => {
    if (column.key === 'selection' && onSelectChange) {
      return (
        <input
          type="checkbox"
          checked={selectedRowKeys.includes(record[rowKey])}
          onChange={(e) => handleSelectChange(e.target.checked, record)}
          className="data-table-checkbox"
        />
      );
    }
    
    if (column.render) {
      const dataKey = (column as any).dataIndex || column.key;
      return column.render((record as any)[dataKey], record, index);
    }
    
    if (column.key.includes('Date') && (record as any)[column.key]) {
      return new Date((record as any)[column.key]).toLocaleDateString();
    }
    
    const dataKey = (column as any).dataIndex || column.key;
    return (record as any)[dataKey] ?? '-';
  };
  
  // 处理行点击
  const handleRowClick = (record: T, index: number) => {
    if (onRowClick) {
      onRowClick(record, index);
    }
  };

  const handleRowDoubleClick = (record: T, index: number) => {
    if (onRowDoubleClick) {
      onRowDoubleClick(record, index);
    }
  };
  
  // 处理点击外部关闭筛选菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.data-table-th')) {
        setShowFilterMenu(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  
  const toggleRow = useCallback((record: T) => {
    const key = record[rowKey];
    setExpandedRowKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, [rowKey]);

  const displayedColumns = useMemo(() => {
    let result: InstrumentTableColumn[] = [];
    
    if (!customColumns || customColumns.length === 0) {
      result = columns;
    } else if (columns.length === 0) {
      result = customColumns;
    } else {
      result = mergeColumnsByReferenceOrder(columns, customColumns);
    }
    
    if (expandable) {
      const expandCol: InstrumentTableColumn = {
        key: '__expand__',
        title: '',
        width: 48,
        align: 'center',
        resizable: false,
        fixed: 'left',
        render: (_, record) => {
           if (expandable.rowExpandable && !expandable.rowExpandable(record)) return null;
           const isExpanded = expandedRowKeys.includes(record[rowKey]);
           return (
             <span 
               onClick={(e) => { e.stopPropagation(); toggleRow(record); }} 
               style={{ cursor: 'pointer', display: 'inline-block', width: '100%', height: '100%', userSelect: 'none', fontSize: '12px' }}
             >
               {isExpanded ? '▼' : '▶'}
             </span>
           );
        }
      };
      const nextColumns = [...result];
      const targetIndex = Math.max(0, Math.min(expandable.columnIndex ?? 0, nextColumns.length));
      nextColumns.splice(targetIndex, 0, expandCol);
      return nextColumns;
    }
    
    return result;
  }, [columns, customColumns, expandable, expandedRowKeys, mergeColumnsByReferenceOrder, rowKey, toggleRow]);

  const updateStickyScrollbar = useCallback(() => {
    const container = scrollContainerRef.current;
    const table = tableElementRef.current;
    if (!container) return;

    const contentWidth = Math.max(
      container.scrollWidth,
      table?.scrollWidth || 0,
      table?.offsetWidth || 0,
    );
    const hasHorizontalOverflow = contentWidth > container.clientWidth + 1;
    setStickyScrollbarVisible(hasHorizontalOverflow);
    setStickyScrollbarWidth(contentWidth);
    setStickyScrollbarViewportWidth(container.clientWidth);
    stickyScrollbarWidthRef.current = contentWidth;
    stickyScrollbarViewportWidthRef.current = container.clientWidth;

    scheduleGlobalScrollbarRefresh();
  }, []);

  const getGlobalScrollbarMetrics = useCallback((): GlobalScrollbarMetrics => {
    const container = scrollContainerRef.current;
    if (!container) {
      return getHiddenMetrics();
    }

    return {
      hasOverflow: stickyScrollbarVisible,
      contentWidth: stickyScrollbarWidth,
      viewportWidth: stickyScrollbarViewportWidth,
      scrollLeft: container.scrollLeft,
      rect: container.getBoundingClientRect(),
    };
  }, [stickyScrollbarVisible, stickyScrollbarViewportWidth, stickyScrollbarWidth]);

  useEffect(() => {
    updateStickyScrollbar();
  }, [displayData.length, displayedColumns, pageSize, currentPage, updateStickyScrollbar]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const table = tableElementRef.current;
    if (!container || !table || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      updateStickyScrollbar();
    });

    observer.observe(container);
    observer.observe(table);

    return () => observer.disconnect();
  }, [displayedColumns, displayData.length, updateStickyScrollbar]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (globalScrollbarActiveId === instanceIdRef.current) {
        scheduleGlobalScrollbarRefresh();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    registerGlobalScrollbarEntry({
      id: instanceIdRef.current,
      container,
      getMetrics: getGlobalScrollbarMetrics,
    });

    return () => unregisterGlobalScrollbarEntry(instanceIdRef.current);
  }, [getGlobalScrollbarMetrics]);
  
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
    <div ref={containerRef} className="data-table-container">
      <div className="data-table-scroll-shell">
        <div
          ref={scrollContainerRef}
          className="data-table-scroll-area"
          style={{
            maxWidth: maxTableWidth ? maxTableWidth : '100%',
            overflowX: 'auto',
            overflowY: bodyMaxHeight ? 'auto' : 'visible',
            maxHeight: bodyMaxHeight,
            boxSizing: 'border-box'
          }}
        >
        <table ref={tableElementRef} className="data-table" style={{ minWidth: '100%' }}>
        {/* 表头总是显示，确保在无数据时也能看到列标题 */}
        <thead>
          <tr>
            {displayedColumns.map((column) => {
              // Determine width logic
              const isResized = Object.prototype.hasOwnProperty.call(columnWidths, column.key);
              const initialWidth = column.width;
              const resizedWidth = columnWidths[column.key];
              const isResizable = (column as any).resizable !== false;

              let styleWidth: string | number | undefined;
              let styleMinWidth: string | number | undefined;

              if (isResized) {
                // User explicitly resized it -> Fixed width
                styleWidth = resizedWidth;
                styleMinWidth = resizedWidth;
              } else if (!isResizable && initialWidth) {
                // Not resizable (e.g. selection) -> Fixed width
                styleWidth = initialWidth;
                styleMinWidth = initialWidth;
              } else {
                // Resizable but not yet resized -> Auto width with min limit
                styleWidth = undefined; // Allow expansion
                styleMinWidth = initialWidth; // Use initial as minimum
              }

              return (
                <th 
                  key={column.key} 
                  className={`data-table-th ${column.align || 'center'} ${column.fixed ? `fixed-${column.fixed}` : ''}`}
                  // 存储DOM引用
                  ref={(el) => {
                    headerCellRefs.current[column.key] = el;
                  }}
                  style={{ 
                    width: styleWidth,
                    minWidth: styleMinWidth,
                    position: 'relative',
                    boxSizing: 'border-box',
                    paddingRight: (column as any).resizable === false ? 0 : undefined,
                    maxWidth: (column as any).resizable === false ? (initialWidth as number) : undefined
                  }}
                  draggable={column.draggable !== false && column.key !== 'selection'}
                  onDragStart={(e) => handleDragStart(e, column.key)}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragEnd={handleDragEnd}
                >
                  <div 
                    className="data-table-th-content" 
                    onClick={() => handleSort(column.key, column)}
                    style={{ cursor: column.sorter ? 'pointer' : 'default' }}
                  >
                    {column.key === 'selection' && onSelectChange ? (
                      <input
                        type="checkbox"
                        checked={safeDataSource.length > 0 && selectedRowKeys.length === safeDataSource.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      column.title
                    )}
                    {renderSortIcon(column)}
                    {renderFilterIcon(column)}
                    {renderFilterMenu(column)}
                  </div>
                  {column.resizable !== false && (
                    <div 
                      className="col-resizer"
                      onMouseDown={(e) => handleMouseDown(e, column.key)}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayData.length > 0 ? (
            displayData.map((record, rowIndex) => (
              <React.Fragment key={record[rowKey]}>
                <tr 
                  className={rowClassName ? rowClassName(record, rowIndex) : ''}
                  onClick={() => handleRowClick(record, rowIndex)}
                  onDoubleClick={() => handleRowDoubleClick(record, rowIndex)}
                >
                  {displayedColumns.map((column) => (
                    <td 
                      key={`${record[rowKey]}-${column.key}`}
                      className={`data-table-td ${column.align || 'center'} ${column.fixed ? `fixed-${column.fixed}` : ''}`}
                    >
                      {renderCell(record, column, rowIndex)}
                    </td>
                  ))}
                </tr>
                {expandable && expandedRowKeys.includes(record[rowKey]) && (
                  <tr>
                    <td colSpan={displayedColumns.length} style={{ padding: 0, border: 'none' }}>
                      {expandable.expandedRowRender(record)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          ) : (
            <tr>
              <td colSpan={displayedColumns.length} className="data-table-td no-data">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
        </table>
        </div>
      </div>
      {pagination && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <Pagination 
            total={total !== undefined ? total : dataSource.length}
            pageSize={pageSize}
            current={currentPage}
            onChange={handlePageChange}
            pageSizeOptions={[10, 20, 50, 100]}
            showSizeChanger={true}
            showTotal={true}
          />
        </div>
      )}
    </div>
    </ConfigProvider>
  );
}

export default DataTable;
