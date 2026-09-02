import { extractUnit } from './unitUtils';

interface Range {
  min: number;
  max: number;
}

interface MeasurementShape {
  kind: 'point' | 'range';
  min: number;
  max: number;
  unit: string;
  raw: string;
  precision: number;
}

interface MeasurementMatchOptions {
  type?: string;
}

const RANGE_SEPARATOR_REGEX = /\s*(?:~|～|to|-)\s*/i;

const normalizeRangeInput = (value: string): string => value
  .trim()
  .replace(/\s+/g, ' ')
  .replace(/，/g, ',')
  .replace(/：/g, ':')
  .replace(/[~～]/g, '~');

const countDecimalPlaces = (rawNumber: string): number => {
  const normalized = rawNumber.trim().replace(',', '.');
  const pieces = normalized.split('.');
  return pieces[1]?.length || 0;
};

const parsePoint = (value: string): MeasurementShape | null => {
  const normalized = normalizeRangeInput(value);
  const unit = extractUnit(normalized);
  const numericMatch = normalized.match(/[-+]?\d*\.?\d+/);

  if (!numericMatch) {
    return null;
  }

  const parsed = Number.parseFloat(numericMatch[0]);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return {
    kind: 'point',
    min: parsed,
    max: parsed,
    unit,
    raw: normalized,
    precision: countDecimalPlaces(numericMatch[0]),
  };
};

const formatNumber = (value: number, precision: number): string => {
  if (precision <= 0) {
    return Math.round(value).toString();
  }

  return Number.parseFloat(value.toFixed(Math.min(precision, 6))).toString();
};

const isLikelyPointValue = (value: string): boolean => {
  const normalized = normalizeRangeInput(value);

  if (normalized.includes('±')) {
    return false;
  }

  const separatorMatches = normalized.match(/(~|～|\bto\b)/gi);
  if (separatorMatches?.length) {
    return false;
  }

  const dashBetweenNumbers = normalized.match(/\d\s*-\s*[+]?\d/);
  if (dashBetweenNumbers) {
    return false;
  }

  return /[-+]?\d*\.?\d+/.test(normalized);
};

const getPointTolerance = (left: MeasurementShape, right: MeasurementShape, type?: string): number => {
  const maxPrecision = Math.max(left.precision, right.precision);
  const step = 10 ** (-maxPrecision);
  const magnitude = Math.max(Math.abs(left.min), Math.abs(right.min), 1);
  const precisionTolerance = step * 5;
  const relativeTolerance = magnitude * 0.002;
  const referenceMaterialBonus = type === '标准物质' ? step * 2 : 0;

  return Math.max(precisionTolerance, relativeTolerance, referenceMaterialBonus);
};

const parseMeasurementShape = (value: string | undefined | null): MeasurementShape | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeRangeInput(value);

  if (normalized.includes('±')) {
    const point = parsePoint(normalized);
    if (point) {
      const numberMatch = normalized.match(/[-+]?\d*\.?\d+/);
      if (numberMatch) {
        const radius = Number.parseFloat(numberMatch[0]);
        if (!Number.isNaN(radius)) {
          return {
            kind: 'range',
            min: -radius,
            max: radius,
            unit: point.unit,
            raw: normalized,
            precision: point.precision,
          };
        }
      }
    }
  }

  const range = parseRange(normalized);
  if (range) {
    const unit = extractUnit(normalized);
    const precisionMatches = normalized.match(/[-+]?\d*\.?\d+/g) || [];
    const precision = precisionMatches.reduce((max, current) => (
      Math.max(max, countDecimalPlaces(current))
    ), 0);

    return {
      kind: 'range',
      min: range.min,
      max: range.max,
      unit,
      raw: normalized,
      precision,
    };
  }

  if (!isLikelyPointValue(normalized)) {
    return null;
  }

  return parsePoint(normalized);
};

const comparePoints = (
  left: MeasurementShape,
  right: MeasurementShape,
  options?: MeasurementMatchOptions,
): boolean => {
  const tolerance = getPointTolerance(left, right, options?.type);
  return Math.abs(left.min - right.min) <= tolerance;
};

const compareRangeAndPoint = (rangeShape: MeasurementShape, pointShape: MeasurementShape): boolean => {
  const span = rangeShape.max - rangeShape.min;
  const pointTolerance = getPointTolerance(rangeShape, pointShape);

  if (span === 0) {
    return Math.abs(rangeShape.min - pointShape.min) <= pointTolerance;
  }

  const tolerance = Math.max(span * 0.01, pointTolerance);
  return pointShape.min >= (rangeShape.min - tolerance) && pointShape.max <= (rangeShape.max + tolerance);
};

/**
 * Parse a numeric range string.
 * Supported examples:
 * - "0-100"
 * - "0~100"
 * - "0 to 100"
 * - "±50"
 * - "(0~100)kPa"
 */
export function parseRange(rangeStr: string | undefined | null): Range | null {
  if (!rangeStr) return null;
  let s = normalizeRangeInput(rangeStr.toString());

  if (s.includes('±')) {
    const m = s.match(/(\d+\.?\d*)/);
    if (m) {
      const v = Number.parseFloat(m[1]);
      return Number.isNaN(v) ? null : { min: -v, max: v };
    }
  }

  s = s.replace(/\s+(to|TO|To)\s+/g, ',');
  s = s.replace(/[~～]/g, ',');
  s = s.replace(/(\d)\s*-\s*(?=\d)/g, '$1,');

  const parts = s.split(',');
  if (parts.length < 2) {
    return null;
  }

  const extractNum = (str: string) => {
    const m = str.match(/[-+]?\d*\.?\d+/);
    return m ? Number.parseFloat(m[0]) : Number.NaN;
  };

  const v1 = extractNum(parts[0]);
  const v2 = extractNum(parts[1]);

  if (Number.isNaN(v1) || Number.isNaN(v2)) {
    return null;
  }

  return { min: Math.min(v1, v2), max: Math.max(v1, v2) };
}

/**
 * Check whether two measurement strings can be considered compatible.
 * Supports both range values and single-point reference values.
 */
export function checkMeasurementMatch(
  leftValue: string | undefined | null,
  rightValue: string | undefined | null,
  options?: MeasurementMatchOptions,
): boolean {
  if (!leftValue || !rightValue) {
    return false;
  }

  if (leftValue === rightValue) {
    return true;
  }

  const left = parseMeasurementShape(leftValue);
  const right = parseMeasurementShape(rightValue);

  if (!left || !right) {
    return false;
  }

  if (left.unit !== right.unit) {
    return false;
  }

  if (left.kind === 'point' && right.kind === 'point') {
    return comparePoints(left, right, options);
  }

  if (left.kind === 'range' && right.kind === 'point') {
    return compareRangeAndPoint(left, right);
  }

  if (left.kind === 'point' && right.kind === 'range') {
    return compareRangeAndPoint(right, left);
  }

  const groupSpan = right.max - right.min;

  if (groupSpan === 0) {
    return Math.abs(left.min - right.min) < 0.0001 && Math.abs(left.max - right.max) < 0.0001;
  }

  const tolerance = groupSpan * 0.01;
  const minOk = left.min >= (right.min - tolerance);
  const maxOk = left.max <= (right.max + tolerance);

  return minOk && maxOk;
}

/**
 * Backward-compatible alias used by the merge workflow.
 */
export function checkRangeMatch(
  memberRange: string | undefined | null,
  groupRange: string | undefined | null,
  options?: MeasurementMatchOptions,
): boolean {
  return checkMeasurementMatch(memberRange, groupRange, options);
}

/**
 * Calculate a representative average measurement string from a group of ranges or points.
 */
export function calculateAverageRange(ranges: (string | undefined | null)[]): string | null {
  const shapes = ranges
    .filter((value): value is string => Boolean(value))
    .map((value) => parseMeasurementShape(value))
    .filter((shape): shape is MeasurementShape => Boolean(shape));

  if (shapes.length === 0) {
    const validStrings = ranges.filter((value): value is string => Boolean(value));
    return validStrings[0] || null;
  }

  const allPoints = shapes.every((shape) => shape.kind === 'point');
  const commonUnit = shapes[0].unit;
  const sameUnit = shapes.every((shape) => shape.unit === commonUnit);
  const precision = shapes.reduce((max, shape) => Math.max(max, shape.precision), 0);

  if (allPoints && sameUnit) {
    const average = shapes.reduce((sum, shape) => sum + shape.min, 0) / shapes.length;
    return `${formatNumber(average, precision)}${commonUnit}`;
  }

  const sumMin = shapes.reduce((acc, shape) => acc + shape.min, 0);
  const sumMax = shapes.reduce((acc, shape) => acc + shape.max, 0);
  const avgMin = sumMin / shapes.length;
  const avgMax = sumMax / shapes.length;
  const unit = sameUnit ? commonUnit : '';

  return `${formatNumber(avgMin, precision)}~${formatNumber(avgMax, precision)}${unit}`;
}
