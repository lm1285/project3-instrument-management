import { useCallback } from 'react';
import type { Cell, Selection, SpanMap } from './scheduleTableTypes';
import {
  applyPastedMatrix,
  createClipboardText,
  makeCellId,
  parseClipboardMatrix,
  selectionContainsMergedCells,
} from './scheduleTableUtils';

interface UseScheduleTableInteractionsOptions {
  columns: string[];
  rows: Cell[][];
  spans: SpanMap;
  colWidths: Record<number, number>;
  selection: Selection;
  editingCell: { row: number; col: number; initialValue?: string } | null;
  currentPage: number;
  pageSize: number;
  hasEditPermission: boolean;
  hasUndoPermission: boolean;
  message: {
    warning: (content: string) => void;
  };
  getSelectionBounds: () => { r1: number; r2: number; c1: number; c2: number } | null;
  pushUndo: () => void;
  handleUndo: () => void;
  startEdit: (row: number, col: number, initialValue?: string) => void;
  setSelection: React.Dispatch<React.SetStateAction<Selection>>;
  setRows: React.Dispatch<React.SetStateAction<Cell[][]>>;
  setColumns: React.Dispatch<React.SetStateAction<string[]>>;
  setSpans: React.Dispatch<React.SetStateAction<SpanMap>>;
  setColWidths: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  setDraggedColIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useScheduleTableInteractions({
  columns,
  rows,
  spans,
  colWidths,
  selection,
  editingCell,
  currentPage,
  pageSize,
  hasEditPermission,
  hasUndoPermission,
  message,
  getSelectionBounds,
  pushUndo,
  handleUndo,
  startEdit,
  setSelection,
  setRows,
  setColumns,
  setSpans,
  setColWidths,
  setCurrentPage,
  setDraggedColIndex,
  setDirty,
}: UseScheduleTableInteractionsOptions) {
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!hasEditPermission || editingCell) {
        return;
      }

      const text = e.clipboardData.getData('text/plain');
      if (!text) {
        return;
      }

      const anchor =
        selection.start && selection.end
          ? { row: Math.min(selection.start.row, selection.end.row), col: Math.min(selection.start.col, selection.end.col) }
          : selection.start;

      if (!anchor) {
        return;
      }

      const matrix = parseClipboardMatrix(text);
      if (selectionContainsMergedCells(rows, matrix, anchor)) {
        message.warning('目标区域包含合并单元格，无法粘贴');
        return;
      }

      e.preventDefault();
      pushUndo();
      setRows((previousRows) => applyPastedMatrix(previousRows, matrix, anchor));
      setDirty(true);
    },
    [editingCell, hasEditPermission, message, pushUndo, rows, selection.end, selection.start, setDirty, setRows],
  );

  const handleColumnDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      const hasHorizontalSpans = Object.values(spans).some((span) => span.colSpan > 1);

      if (hasHorizontalSpans) {
        e.preventDefault();
        message.warning('存在横向合并单元格，无法调整列顺序');
        return;
      }

      pushUndo();
      setDraggedColIndex(index);
      e.dataTransfer.effectAllowed = 'move';
    },
    [message, pushUndo, setDraggedColIndex, spans],
  );

  const handleColumnDragOver = useCallback(
    (e: React.DragEvent, draggedColIndex: number | null, targetIndex: number) => {
      e.preventDefault();
      if (draggedColIndex === null || draggedColIndex === targetIndex) {
        return;
      }

      const fromIdx = draggedColIndex;
      const toIdx = targetIndex;

      const nextColumns = [...columns];
      const [movedCol] = nextColumns.splice(fromIdx, 1);
      nextColumns.splice(toIdx, 0, movedCol);
      setColumns(nextColumns);

      setColWidths((previousWidths) => {
        const widthArray = columns.map((_, index) => previousWidths[index] || 160);
        const [movedWidth] = widthArray.splice(fromIdx, 1);
        widthArray.splice(toIdx, 0, movedWidth);

        const nextWidths: Record<number, number> = {};
        widthArray.forEach((width, index) => {
          nextWidths[index] = width;
        });

        return nextWidths;
      });

      setRows((previousRows) =>
        previousRows.map((row, rowIndex) => {
          const nextRow = [...row];
          const [movedCell] = nextRow.splice(fromIdx, 1);
          nextRow.splice(toIdx, 0, movedCell);
          return nextRow.map((cell, colIndex) => ({ ...cell, id: makeCellId(rowIndex, colIndex) }));
        }),
      );

      setSpans((previousSpans) => {
        const nextSpans: SpanMap = {};

        Object.entries(previousSpans).forEach(([key, span]) => {
          const [rowIndex, colIndex] = key.split(':').map(Number);
          let nextColIndex = colIndex;

          if (colIndex === fromIdx) {
            nextColIndex = toIdx;
          } else if (fromIdx < toIdx) {
            if (colIndex > fromIdx && colIndex <= toIdx) {
              nextColIndex = colIndex - 1;
            }
          } else if (colIndex >= toIdx && colIndex < fromIdx) {
            nextColIndex = colIndex + 1;
          }

          nextSpans[makeCellId(rowIndex, nextColIndex)] = span;
        });

        return nextSpans;
      });

      setDraggedColIndex(toIdx);
      setDirty(true);
    },
    [columns, setColWidths, setColumns, setDirty, setDraggedColIndex, setRows, setSpans],
  );

  const handleColumnDragEnd = useCallback(() => {
    setDraggedColIndex(null);
  }, [setDraggedColIndex]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      pushUndo();

      const startX = e.clientX;
      const startWidth = colWidths[colIndex] || 160;

      const onMove = (event: MouseEvent) => {
        const delta = event.clientX - startX;
        setColWidths((previousWidths) => ({
          ...previousWidths,
          [colIndex]: Math.max(80, Math.min(600, startWidth + delta)),
        }));
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setDirty(true);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [colWidths, pushUndo, setColWidths, setDirty],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (editingCell || !selection.start) {
        return;
      }

      const isMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (isMeta && key === 'z') {
        e.preventDefault();
        if (!hasUndoPermission) {
          message.warning('您没有撤回权限');
          return;
        }
        handleUndo();
        return;
      }

      if (isMeta && key === 'a') {
        e.preventDefault();
        setSelection({
          start: { row: 0, col: 0 },
          end: { row: rows.length - 1, col: columns.length - 1 },
        });
        return;
      }

      if (isMeta && key === 'c') {
        const bounds = getSelectionBounds();
        if (!bounds) {
          return;
        }

        e.preventDefault();
        const text = createClipboardText(rows, bounds);
        const fallbackCopy = () => {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        };

        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).catch(() => fallbackCopy());
        } else {
          fallbackCopy();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!hasEditPermission) {
          return;
        }

        const bounds = getSelectionBounds();
        if (!bounds) {
          return;
        }

        e.preventDefault();
        pushUndo();
        const { r1, r2, c1, c2 } = bounds;

        setRows((previousRows) => {
          const nextRows = previousRows.map((row) => row.slice());
          for (let rowIndex = r1; rowIndex <= r2; rowIndex += 1) {
            for (let colIndex = c1; colIndex <= c2; colIndex += 1) {
              if (!nextRows[rowIndex]?.[colIndex]) {
                continue;
              }
              nextRows[rowIndex][colIndex] = { ...nextRows[rowIndex][colIndex], value: '' };
            }
          }
          return nextRows;
        });
        setDirty(true);
        return;
      }

      const { row, col } = selection.end || selection.start;
      let nextRow = row;
      let nextCol = col;

      if (e.key === 'ArrowUp') nextRow -= 1;
      if (e.key === 'ArrowDown') nextRow += 1;
      if (e.key === 'ArrowLeft') nextCol -= 1;
      if (e.key === 'ArrowRight') nextCol += 1;

      if (e.key === 'Tab') {
        e.preventDefault();
        nextCol += e.shiftKey ? -1 : 1;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const candidateRow = Math.min(row + 1, rows.length - 1);
        setSelection({ start: { row: candidateRow, col }, end: { row: candidateRow, col } });
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        startEdit(row, col, e.key);
        return;
      }

      nextRow = Math.max(0, Math.min(nextRow, rows.length - 1));
      nextCol = Math.max(0, Math.min(nextCol, columns.length - 1));

      if (nextRow !== row || nextCol !== col) {
        e.preventDefault();
        setSelection((previousSelection) => {
          if (!previousSelection.start) {
            return { start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } };
          }

          if (e.shiftKey) {
            return { start: previousSelection.start, end: { row: nextRow, col: nextCol } };
          }

          return { start: { row: nextRow, col: nextCol }, end: { row: nextRow, col: nextCol } };
        });

        const nextPage = Math.floor(nextRow / pageSize) + 1;
        if (nextPage !== currentPage) {
          setCurrentPage(nextPage);
        }
      }
    },
    [
      columns.length,
      currentPage,
      editingCell,
      getSelectionBounds,
      handleUndo,
      hasEditPermission,
      hasUndoPermission,
      message,
      pageSize,
      pushUndo,
      rows,
      selection.end,
      selection.start,
      setCurrentPage,
      setDirty,
      setRows,
      setSelection,
      startEdit,
    ],
  );

  return {
    handlePaste,
    handleColumnDragStart,
    handleColumnDragOver,
    handleColumnDragEnd,
    handleResizeStart,
    handleKeyDown,
  };
}
