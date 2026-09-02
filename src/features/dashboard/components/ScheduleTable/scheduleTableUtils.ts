import type { Cell, Selection } from './scheduleTableTypes';

export const DEFAULT_COLUMNS = ['日期', '客户名称', '人员', '仪器名称', '备注'];
export const DEFAULT_ROWS = 20;

export const makeCellId = (row: number, col: number) => `${row}:${col}`;

export function createDefaultRows(rowCount = DEFAULT_ROWS, columns = DEFAULT_COLUMNS): Cell[][] {
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    columns.map((_, colIndex) => ({
      id: makeCellId(rowIndex, colIndex),
      value: '',
    })),
  );
}

export function createDefaultColumnWidths(columns = DEFAULT_COLUMNS) {
  return columns.reduce<Record<number, number>>((accumulator, _column, index) => {
    accumulator[index] = 160;
    return accumulator;
  }, {});
}

export function cloneRows(input: Cell[][]) {
  return input.map((row) =>
    row.map((cell) => ({
      ...cell,
      mergedTo: cell.mergedTo ? { ...cell.mergedTo } : cell.mergedTo,
    })),
  );
}

export function getSelectionBounds(selection: Selection) {
  if (!selection.start || !selection.end) {
    return null;
  }

  return {
    r1: Math.min(selection.start.row, selection.end.row),
    r2: Math.max(selection.start.row, selection.end.row),
    c1: Math.min(selection.start.col, selection.end.col),
    c2: Math.max(selection.start.col, selection.end.col),
  };
}

export function isCellInSelection(selection: Selection, row: number, col: number) {
  const bounds = getSelectionBounds(selection);
  if (!bounds) {
    return false;
  }

  return row >= bounds.r1 && row <= bounds.r2 && col >= bounds.c1 && col <= bounds.c2;
}

export function reindexRows(rows: Cell[][]) {
  return rows.map((row, rowIndex) =>
    row.map((cell, colIndex) => ({
      ...cell,
      id: makeCellId(rowIndex, colIndex),
    })),
  );
}

export function insertEmptyRow(rows: Cell[][], index: number, columnCount: number) {
  const nextRows = rows.map((row) => row.slice());
  const newRow: Cell[] = Array.from({ length: columnCount }, (_, colIndex) => ({
    id: makeCellId(index, colIndex),
    value: '',
  }));

  nextRows.splice(index, 0, newRow);
  return reindexRows(nextRows);
}

export function removeRow(rows: Cell[][], index: number) {
  return reindexRows(rows.filter((_, rowIndex) => rowIndex !== index).map((row) => row.slice()));
}

export function createClipboardText(
  rows: Cell[][],
  bounds: { r1: number; r2: number; c1: number; c2: number },
) {
  const lines: string[] = [];

  for (let rowIndex = bounds.r1; rowIndex <= bounds.r2; rowIndex += 1) {
    const columns: string[] = [];

    for (let colIndex = bounds.c1; colIndex <= bounds.c2; colIndex += 1) {
      const cell = rows[rowIndex]?.[colIndex];
      const displayValue = cell?.mergedTo
        ? rows[cell.mergedTo.row]?.[cell.mergedTo.col]?.value
        : cell?.value;

      columns.push(displayValue ?? '');
    }

    lines.push(columns.join('\t'));
  }

  return lines.join('\n');
}

export function parseClipboardMatrix(text: string) {
  const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = rawLines.length > 0 && rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;
  return lines.map((line) => line.split('\t'));
}

export function selectionContainsMergedCells(
  rows: Cell[][],
  matrix: string[][],
  anchor: { row: number; col: number },
) {
  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    for (let colOffset = 0; colOffset < matrix[rowOffset].length; colOffset += 1) {
      const cell = rows[anchor.row + rowOffset]?.[anchor.col + colOffset];

      if (cell?.mergedTo) {
        return true;
      }
    }
  }

  return false;
}

export function applyPastedMatrix(
  rows: Cell[][],
  matrix: string[][],
  anchor: { row: number; col: number },
) {
  const nextRows = rows.map((row) => row.slice());

  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    for (let colOffset = 0; colOffset < matrix[rowOffset].length; colOffset += 1) {
      const rowIndex = anchor.row + rowOffset;
      const colIndex = anchor.col + colOffset;

      if (!nextRows[rowIndex]?.[colIndex]) {
        continue;
      }

      nextRows[rowIndex][colIndex] = {
        ...nextRows[rowIndex][colIndex],
        value: matrix[rowOffset][colOffset] ?? '',
      };
    }
  }

  return nextRows;
}
