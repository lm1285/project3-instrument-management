import React, { useEffect, useRef } from 'react';
import { ToolOutlined } from '@ant-design/icons';
import { App, Spin } from 'antd';
import ExcelToolbar from './ExcelToolbar';
import { ScheduleTableGrid } from './ScheduleTableGrid';
import Pagination from '../../../../components/UI/Pagination';
import { usePermission } from '../../../../hooks/usePermission';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import { useScheduleTableInteractions } from './useScheduleTableInteractions';
import { useScheduleTableManager } from './useScheduleTableManager';

const ScheduleTable: React.FC = () => {
  const { message } = App.useApp();
  const { hasPermission } = usePermission();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const {
    columns,
    rows,
    spans,
    colWidths,
    editingCell,
    selection,
    dirty,
    draggedColIndex,
    currentPage,
    pageSize,
    isLoading,
    setColumns,
    setRows,
    setSpans,
    setColWidths,
    setSelection,
    setDirty,
    setDraggedColIndex,
    setCurrentPage,
    handlePageChange,
    inSelection,
    getSelectionBounds,
    pushUndo,
    handleUndo,
    startEdit,
    commitEdit,
    toolbarActions,
  } = useScheduleTableManager({
    hasUndoPermission: hasPermission('dashboard:schedule:undo'),
  });

  const handleCellMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    const handler = () => {
      isDraggingRef.current = false;
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, []);

  const requestStartEdit = (r: number, c: number, initialValue?: string) => {
    if (!hasPermission('dashboard:schedule:edit')) {
      message.warning('您没有编辑权限');
      return;
    }
    startEdit(r, c, initialValue);
  };

  const handleCellMouseDown = (r: number, c: number) => {
    if (!hasPermission('dashboard:schedule:edit')) return;
    gridRef.current?.focus();
    setSelection({ start: { row: r, col: c }, end: { row: r, col: c } });
    isDraggingRef.current = true;
  };

  const handleCellMouseEnter = (r: number, c: number) => {
    if (!isDraggingRef.current || !hasPermission('dashboard:schedule:edit')) return;
    setSelection(prev => ({ ...prev, end: { row: r, col: c } }));
  };

  const {
    handlePaste,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleResizeStart,
    handleKeyDown,
  } = useScheduleTableInteractions({
    columns,
    rows,
    spans,
    colWidths,
    selection,
    editingCell,
    currentPage,
    pageSize,
    hasEditPermission: hasPermission('dashboard:schedule:edit'),
    hasUndoPermission: hasPermission('dashboard:schedule:undo'),
    message,
    getSelectionBounds,
    pushUndo,
    handleUndo,
    startEdit: requestStartEdit,
    setSelection,
    setRows,
    setColumns,
    setSpans,
    setColWidths,
    setCurrentPage,
    setDraggedColIndex,
    setDirty,
  });

  return (
    <PermissionGuard permission="dashboard:schedule:view">
      <div ref={containerRef} style={{ padding: 12 }}>
        <div className="module-header">
          <div className="module-header-title-group">
            <span className="module-header-icon"><ToolOutlined /></span>
            <h2 className="module-header-title">下场安排</h2>
          </div>
        </div>
        <div style={{ marginTop: 10 }}></div>
        <Spin spinning={isLoading}>
          <ExcelToolbar
            {...toolbarActions}
            canEdit={hasPermission('dashboard:schedule:edit')}
          />
          <ScheduleTableGrid
            ref={gridRef}
            columns={columns}
            rows={rows}
            spans={spans}
            colWidths={colWidths}
            draggedColIndex={draggedColIndex}
            currentPage={currentPage}
            pageSize={pageSize}
            editingCell={editingCell}
            inSelection={inSelection}
            onCellMouseDown={handleCellMouseDown}
            onCellMouseEnter={handleCellMouseEnter}
            onCellMouseUp={handleCellMouseUp}
            onStartEdit={requestStartEdit}
            onCommitEdit={commitEdit}
            onColumnDragStart={handleColumnDragStart}
            onColumnDragOver={(event, targetIndex) => handleColumnDragOver(event, draggedColIndex, targetIndex)}
            onColumnDragEnd={handleColumnDragEnd}
            onResizeStart={handleResizeStart}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
          />
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#999', fontSize: 12 }}>{dirty ? '未保存更改' : '已保存'}</div>
            <Pagination
              total={rows.length}
              pageSize={pageSize}
              current={currentPage}
              onChange={handlePageChange}
              showSizeChanger
              showTotal
            />
          </div>
        </Spin>
      </div>
    </PermissionGuard>
  );
};

export default ScheduleTable;
