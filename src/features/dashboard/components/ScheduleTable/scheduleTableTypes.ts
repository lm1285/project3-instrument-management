export type Cell = {
  id: string;
  value: string;
  mergedTo?: { row: number; col: number } | null;
};

export type SpanMap = Record<string, { rowSpan: number; colSpan: number }>;

export type Selection = {
  start: { row: number; col: number } | null;
  end: { row: number; col: number } | null;
};

export type TableSnapshot = {
  columns: string[];
  rows: Cell[][];
  spans: SpanMap;
  colWidths: Record<number, number>;
  dirty: boolean;
  selection: Selection;
};
