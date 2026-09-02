import React from 'react';
import type { Cell, SpanMap } from './scheduleTableTypes';
import { makeCellId } from './scheduleTableUtils';

interface ScheduleTableGridProps {
  columns: string[];
  rows: Cell[][];
  spans: SpanMap;
  colWidths: Record<number, number>;
  draggedColIndex: number | null;
  currentPage: number;
  pageSize: number;
  editingCell: { row: number; col: number; initialValue?: string } | null;
  inSelection: (row: number, col: number) => boolean;
  onCellMouseDown: (row: number, col: number) => void;
  onCellMouseEnter: (row: number, col: number) => void;
  onCellMouseUp: () => void;
  onStartEdit: (row: number, col: number, initialValue?: string) => void;
  onCommitEdit: (row: number, col: number, value: string) => void;
  onColumnDragStart: (e: React.DragEvent, colIndex: number) => void;
  onColumnDragOver: (e: React.DragEvent, targetIndex: number) => void;
  onColumnDragEnd: () => void;
  onResizeStart: (e: React.MouseEvent, colIndex: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

const rowHeaderStyle: React.CSSProperties = {
  width: 25,
  minWidth: 25,
  background: '#f8f9fa',
  border: '1px solid #999',
  borderRight: '2px solid #999',
  zIndex: 3,
  position: 'sticky',
  left: 0,
  top: 0,
};

const rowIndexStyle: React.CSSProperties = {
  background: '#f8f9fa',
  border: '1px solid #999',
  borderRight: '2px solid #999',
  textAlign: 'center',
  verticalAlign: 'middle',
  color: '#5f6368',
  fontSize: '14px',
  userSelect: 'none',
  position: 'sticky',
  left: 0,
  zIndex: 1,
};

const gridContainerStyle: React.CSSProperties = {
  outline: 'none',
  overflow: 'auto',
  maxHeight: '70vh',
  border: '1px solid #d9d9d9',
  borderRadius: 0,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const tableStyle: React.CSSProperties = {
  width: 'max-content',
  minWidth: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'Arial, sans-serif',
  fontSize: '15px',
};

export const ScheduleTableGrid = React.forwardRef<HTMLDivElement, ScheduleTableGridProps>(function ScheduleTableGrid(
  {
    columns,
    rows,
    spans,
    colWidths,
    draggedColIndex,
    currentPage,
    pageSize,
    editingCell,
    inSelection,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onStartEdit,
    onCommitEdit,
    onColumnDragStart,
    onColumnDragOver,
    onColumnDragEnd,
    onResizeStart,
    onKeyDown,
    onPaste,
  },
  ref,
) {
  return (
    <div ref={ref} tabIndex={0} onKeyDown={onKeyDown} onPaste={onPaste} style={gridContainerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={rowHeaderStyle}></th>
            {columns.map((title, colIndex) => (
              <th
                key={colIndex}
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  width: colWidths[colIndex],
                  minWidth: colWidths[colIndex],
                  padding: '8px 4px',
                  background: draggedColIndex === colIndex ? '#e8f0fe' : '#f8f9fa',
                  color: '#5f6368',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: draggedColIndex === colIndex ? '2px dashed #1a73e8' : '1px solid #c0c0c0',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  opacity: draggedColIndex === colIndex ? 0.5 : 1,
                  cursor: 'move',
                  userSelect: 'none',
                }}
                draggable
                onDragStart={(event) => onColumnDragStart(event, colIndex)}
                onDragOver={(event) => onColumnDragOver(event, colIndex)}
                onDragEnd={onColumnDragEnd}
              >
                {title}
                <div
                  style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 4, cursor: 'col-resize', zIndex: 1 }}
                  onMouseDown={(event) => onResizeStart(event, colIndex)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, rowOffset) => {
            const globalRow = (currentPage - 1) * pageSize + rowOffset;

            return (
              <tr key={globalRow}>
                <td style={rowIndexStyle}>{globalRow + 1}</td>
                {row.map((cell, colIndex) => {
                  if (cell.mergedTo) {
                    return null;
                  }

                  const key = makeCellId(globalRow, colIndex);
                  const span = spans[key];
                  const isSelected = inSelection(globalRow, colIndex);
                  const isEditing = editingCell?.row === globalRow && editingCell.col === colIndex;
                  const cellPadding = '4px 8px';

                  return (
                    <td
                      key={key}
                      rowSpan={span?.rowSpan || 1}
                      colSpan={span?.colSpan || 1}
                      onMouseDown={() => onCellMouseDown(globalRow, colIndex)}
                      onMouseEnter={() => onCellMouseEnter(globalRow, colIndex)}
                      onMouseUp={onCellMouseUp}
                      onDoubleClick={() => onStartEdit(globalRow, colIndex)}
                      style={{
                        width: colWidths[colIndex],
                        minWidth: colWidths[colIndex],
                        maxWidth: colWidths[colIndex],
                        border: '1px solid #e0e0e0',
                        borderRight: '1px solid #c0c0c0',
                        borderBottom: '1px solid #c0c0c0',
                        padding: isEditing ? 0 : cellPadding,
                        fontSize: 15,
                        color: '#000',
                        background: isSelected ? '#e8f0fe' : '#fff',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        overflow: 'hidden',
                        userSelect: 'none',
                        height: 40,
                      }}
                    >
                      {isEditing ? (
                        <textarea
                          autoFocus
                          defaultValue={editingCell?.initialValue !== undefined ? editingCell.initialValue : cell.value}
                          onFocus={(event) => {
                            const value = event.target.value;
                            event.target.setSelectionRange(value.length, value.length);
                          }}
                          onBlur={(event) => onCommitEdit(globalRow, colIndex, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                              event.preventDefault();
                              onCommitEdit(globalRow, colIndex, (event.target as HTMLTextAreaElement).value);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            border: '2px solid #1a73e8',
                            outline: 'none',
                            borderRadius: 0,
                            padding: '4px 8px',
                            resize: 'none',
                            overflow: 'hidden',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            background: '#fff',
                            fontSize: 15,
                            textAlign: 'center',
                            fontFamily: 'inherit',
                            zIndex: 10,
                          }}
                        />
                      ) : (
                        cell.value || ''
                      )}

                      {isSelected && !isEditing && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -1,
                            left: -1,
                            right: -1,
                            bottom: -1,
                            borderTop: inSelection(globalRow - 1, colIndex) ? '1px solid #e0e0e0' : '2px solid #1a73e8',
                            borderBottom: inSelection(globalRow + 1, colIndex) ? '1px solid #e0e0e0' : '2px solid #1a73e8',
                            borderLeft: inSelection(globalRow, colIndex - 1) ? '1px solid #e0e0e0' : '2px solid #1a73e8',
                            borderRight: inSelection(globalRow, colIndex + 1) ? '1px solid #e0e0e0' : '2px solid #1a73e8',
                            pointerEvents: 'none',
                            zIndex: 5,
                          }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
