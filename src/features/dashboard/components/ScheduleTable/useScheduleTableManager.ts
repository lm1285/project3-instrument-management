import { App } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import scheduleService from '../../services/scheduleService';
import type { Cell, Selection, SpanMap, TableSnapshot } from './scheduleTableTypes';
import {
  cloneRows,
  createDefaultColumnWidths,
  createDefaultRows,
  DEFAULT_COLUMNS as DEFAULT_SCHEDULE_COLUMNS,
  getSelectionBounds as resolveSelectionBounds,
  insertEmptyRow,
  isCellInSelection,
  makeCellId,
  removeRow,
} from './scheduleTableUtils';

const AUTO_SAVE_DELAY_MS = 500;

type SavePayload = {
  columns: string[];
  rows: Cell[][];
  spans: SpanMap;
  colWidths: Record<number, number>;
};

interface UseScheduleTableManagerOptions {
  hasUndoPermission: boolean;
}

export function useScheduleTableManager({ hasUndoPermission }: UseScheduleTableManagerOptions) {
  const { message, modal } = App.useApp();
  const [columns, setColumns] = useState<string[]>(DEFAULT_SCHEDULE_COLUMNS);
  const [rows, setRows] = useState<Cell[][]>(() => createDefaultRows());
  const [spans, setSpans] = useState<SpanMap>({});
  const [colWidths, setColWidths] = useState<Record<number, number>>(() => createDefaultColumnWidths());
  const [editingCell, setEditingCell] = useState<{ row: number; col: number; initialValue?: string } | null>(null);
  const [selection, setSelection] = useState<Selection>({ start: null, end: null });
  const [dirty, setDirty] = useState(false);
  const [draggedColIndex, setDraggedColIndex] = useState<number | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<TableSnapshot | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(false);

  const handlePageChange = useCallback((page: number, size?: number) => {
    setCurrentPage(page);
    if (size) {
      setPageSize(size);
    }
  }, []);

  const savePayload = useCallback(
    async (payload: SavePayload, successText?: string) => {
      try {
        setIsLoading(true);
        await scheduleService.saveScheduleTable(payload);
        setDirty(false);
        if (successText) {
          message.success(successText);
        }
      } catch (error) {
        message.error('保存失败');
        console.error('保存下场安排数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [message],
  );

  const loadFromStorage = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await scheduleService.getScheduleTable();
      if (Array.isArray(data?.rows) && Array.isArray(data?.columns)) {
        const nextColumns = data.columns.map((column: string) => (column === '操作人' ? '人员' : column));
        setColumns(nextColumns);
        setRows(data.rows);
        setSpans(data.spans || {});
        setColWidths(data.colWidths || {});
      }
    } catch (error) {
      message.error('获取下场安排数据失败');
      console.error('获取下场安排数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [message]);

  const saveToStorage = useCallback(async () => {
    await savePayload({ columns, rows, spans, colWidths }, '保存成功');
  }, [colWidths, columns, rows, savePayload, spans]);

  useEffect(() => {
    void loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void saveToStorage();
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [dirty, saveToStorage]);

  const inSelection = useCallback((row: number, col: number) => isCellInSelection(selection, row, col), [selection]);

  const getSelectionBounds = useCallback(() => resolveSelectionBounds(selection), [selection]);

  const pushUndo = useCallback(() => {
    setUndoSnapshot({
      columns: [...columns],
      rows: cloneRows(rows),
      spans: { ...spans },
      colWidths: { ...colWidths },
      dirty,
      selection,
    });
  }, [colWidths, columns, dirty, rows, selection, spans]);

  const handleUndo = useCallback(() => {
    if (!undoSnapshot) {
      return;
    }

    if (!hasUndoPermission) {
      message.warning('您没有撤回权限');
      return;
    }

    const snapshot = undoSnapshot;
    setColumns(snapshot.columns);
    setRows(snapshot.rows);
    setSpans(snapshot.spans);
    setColWidths(snapshot.colWidths);
    setSelection(snapshot.selection);
    setUndoSnapshot(null);
    setDirty(true);
    void savePayload(
      { columns: snapshot.columns, rows: snapshot.rows, spans: snapshot.spans, colWidths: snapshot.colWidths },
      '已撤回并保存',
    );
  }, [hasUndoPermission, message, savePayload, undoSnapshot]);

  const startEdit = useCallback((row: number, col: number, initialValue?: string) => {
    setEditingCell({ row, col, initialValue });
  }, []);

  const commitEdit = useCallback(
    (row: number, col: number, value: string) => {
      if (rows[row]?.[col]?.value !== value) {
        pushUndo();
      }

      setRows((previousRows) => {
        const nextRows = previousRows.map((previousRow) => previousRow.slice());
        nextRows[row][col] = { ...nextRows[row][col], value };
        return nextRows;
      });

      setEditingCell(null);
      if (rows[row]?.[col]?.value !== value) {
        setDirty(true);
      }
    },
    [pushUndo, rows],
  );

  const mergeSelection = useCallback(() => {
    if (!selection.start || !selection.end) {
      return;
    }

    pushUndo();
    const r1 = Math.min(selection.start.row, selection.end.row);
    const r2 = Math.max(selection.start.row, selection.end.row);
    const c1 = Math.min(selection.start.col, selection.end.col);
    const c2 = Math.max(selection.start.col, selection.end.col);

    if (r1 === r2 && c1 === c2) {
      return;
    }

    const key = makeCellId(r1, c1);
    setSpans((previousSpans) => ({ ...previousSpans, [key]: { rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 } }));
    setRows((previousRows) => {
      const nextRows = previousRows.map((previousRow) => previousRow.slice());
      for (let row = r1; row <= r2; row += 1) {
        for (let col = c1; col <= c2; col += 1) {
          if (row === r1 && col === c1) {
            continue;
          }
          nextRows[row][col] = { ...nextRows[row][col], mergedTo: { row: r1, col: c1 } };
        }
      }
      return nextRows;
    });
    setDirty(true);
  }, [pushUndo, selection.end, selection.start]);

  const splitSelection = useCallback(() => {
    if (!selection.start || !selection.end) {
      return;
    }

    pushUndo();
    const r1 = Math.min(selection.start.row, selection.end.row);
    const r2 = Math.max(selection.start.row, selection.end.row);
    const c1 = Math.min(selection.start.col, selection.end.col);
    const c2 = Math.max(selection.start.col, selection.end.col);

    setRows((previousRows) => {
      const nextRows = previousRows.map((previousRow) => previousRow.slice());
      for (let row = r1; row <= r2; row += 1) {
        for (let col = c1; col <= c2; col += 1) {
          nextRows[row][col] = { ...nextRows[row][col], mergedTo: null };
        }
      }
      return nextRows;
    });

    setSpans((previousSpans) => {
      const nextSpans = { ...previousSpans };
      Object.keys(nextSpans).forEach((key) => {
        const [row, col] = key.split(':').map(Number);
        if (row >= r1 && row <= r2 && col >= c1 && col <= c2) {
          delete nextSpans[key];
        }
      });
      return nextSpans;
    });

    setDirty(true);
  }, [pushUndo, selection.end, selection.start]);

  const insertRow = useCallback(
    (index: number) => {
      pushUndo();
      setRows((previousRows) => insertEmptyRow(previousRows, index, columns.length));
      setDirty(true);
    },
    [columns.length, pushUndo],
  );

  const deleteRow = useCallback(
    (index: number) => {
      pushUndo();
      setRows((previousRows) => removeRow(previousRows, index));
      setDirty(true);
    },
    [pushUndo],
  );

  const requestClearTable = useCallback(() => {
    modal.confirm({
      title: '确认清空表格？',
      content: '清空后将无法恢复，但可以使用“撤回”恢复到上一步。',
      okText: '确认',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        pushUndo();
        const clearedRows = rows.map((row) => row.map((cell) => ({ ...cell, value: '', mergedTo: null })));
        setRows(clearedRows);
        setSpans({});
        setDirty(true);
        void savePayload({ columns, rows: clearedRows, spans: {}, colWidths }, '已清空并保存');
      },
    });
  }, [colWidths, columns, modal, pushUndo, rows, savePayload]);

  const toolbarActions = useMemo(
    () => ({
      onMerge: mergeSelection,
      onSplit: splitSelection,
      onInsertRow: () => {
        const index = selection.start ? Math.min(selection.start.row, selection.end?.row ?? selection.start.row) : rows.length;
        insertRow(index + 1);
      },
      onDeleteRow: () => {
        const index = selection.start ? Math.min(selection.start.row, selection.end?.row ?? selection.start.row) : rows.length - 1;
        if (rows.length > 0) {
          deleteRow(index);
        }
      },
      onClear: requestClearTable,
      onUndo: handleUndo,
      canUndo: !!undoSnapshot,
    }),
    [deleteRow, handleUndo, insertRow, mergeSelection, requestClearTable, rows.length, selection.end, selection.start, splitSelection, undoSnapshot],
  );

  return {
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
    undoSnapshot,
    setColumns,
    setRows,
    setSpans,
    setColWidths,
    setEditingCell,
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
  };
}
