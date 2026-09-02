import type { MeasurementRangeItem } from '../../types';

const DETAIL_PREFIX = 'MR2|';
const LEGACY_DETAIL_PREFIX = 'MR|';

const createId = () => `mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const trimValue = (value?: string) => String(value || '').trim();

const encodeField = (value?: string) => encodeURIComponent(trimValue(value));

const decodeField = (value?: string) => decodeURIComponent(String(value || ''));

const createMeasurementItem = (
  measurementType = '',
  element = '',
  value = '',
  unit = '',
  uncertaintyMode: MeasurementRangeItem['uncertaintyMode'] = '',
  uncertaintyValue = '',
  coverageFactor: MeasurementRangeItem['coverageFactor'] = '',
): MeasurementRangeItem => ({
  id: createId(),
  measurementType,
  element,
  value,
  unit,
  uncertaintyMode,
  uncertaintyValue,
  coverageFactor,
});

export const createEmptyMeasurementItem = (
  measurementType = '',
): MeasurementRangeItem => createMeasurementItem(measurementType);

const normalizeCoverageFactor = (value?: string): MeasurementRangeItem['coverageFactor'] =>
  trimValue(value).replace(/^k\s*=\s*/i, '');

const normalizeUncertaintyMode = (
  value?: string,
): MeasurementRangeItem['uncertaintyMode'] => {
  const normalized = trimValue(value).toLowerCase();
  if (normalized === 'u') {
    return 'U';
  }
  if (normalized === 'urel') {
    return 'Urel';
  }
  if (normalized === 'mpe') {
    return 'MPE';
  }
  return trimValue(value);
};

export const normalizeMeasurementItems = (items: MeasurementRangeItem[] = []) =>
  items
    .map((item) => ({
      ...item,
      measurementType: trimValue(item.measurementType),
      element: trimValue(item.element),
      value: trimValue(item.value),
      unit: trimValue(item.unit),
      uncertaintyMode: normalizeUncertaintyMode(item.uncertaintyMode),
      uncertaintyValue: trimValue(item.uncertaintyValue),
      coverageFactor: normalizeCoverageFactor(item.coverageFactor),
    }))
    .filter(
      (item) =>
        item.measurementType ||
        item.element ||
        item.value ||
        item.unit ||
        item.uncertaintyMode ||
        item.uncertaintyValue ||
        item.coverageFactor,
    );

export const resolveInheritedMeasurementTypes = (items: MeasurementRangeItem[] = []) => {
  let currentType = '';

  return normalizeMeasurementItems(items).map((item) => {
    const nextType = item.measurementType || currentType;
    currentType = nextType;

    return {
      ...item,
      measurementType: nextType,
    };
  });
};

type MeasurementTypeGroup = {
  typeName: string;
  items: MeasurementRangeItem[];
};

const groupMeasurementItemsByType = (items: MeasurementRangeItem[] = []): MeasurementTypeGroup[] => {
  const resolvedItems = resolveInheritedMeasurementTypes(items);
  const result: MeasurementTypeGroup[] = [];

  resolvedItems.forEach((item) => {
    const typeName = trimValue(item.measurementType) || '未命名类型';
    const lastGroup = result[result.length - 1];

    if (lastGroup && lastGroup.typeName === typeName) {
      lastGroup.items.push(item);
      return;
    }

    result.push({
      typeName,
      items: [item],
    });
  });

  return result;
};

export const formatMeasurementValue = (item: Partial<MeasurementRangeItem>) => {
  const value = trimValue(item.value);
  const unit = trimValue(item.unit);

  if (value && unit) {
    return `${value} ${unit}`;
  }

  return value || unit;
};

export const formatUncertaintySymbol = (
  mode?: MeasurementRangeItem['uncertaintyMode'],
) => {
  const normalizedMode = normalizeUncertaintyMode(mode);

  if (normalizedMode === 'Urel') {
    return 'Urel';
  }
  if (normalizedMode === 'U') {
    return 'U';
  }
  if (normalizedMode === 'MPE') {
    return 'MPE';
  }
  return normalizedMode;
};

export const formatUncertaintyValue = (item: Partial<MeasurementRangeItem>) => {
  const symbol = formatUncertaintySymbol(item.uncertaintyMode);
  const value = trimValue(item.uncertaintyValue);
  const coverage = normalizeCoverageFactor(item.coverageFactor);

  if (!symbol && !value && !coverage) {
    return '';
  }

  const left = symbol && value ? `${symbol}=${value}` : symbol || value;
  return coverage ? `${left} (k=${coverage})` : left;
};

const parseUncertaintyText = (value?: string) => {
  const raw = trimValue(value);
  if (!raw) {
    return {
      uncertaintyMode: '' as MeasurementRangeItem['uncertaintyMode'],
      uncertaintyValue: '',
      coverageFactor: '' as MeasurementRangeItem['coverageFactor'],
    };
  }

  const match = raw.match(
    /(Urel|U|MPE)\s*=?\s*([^()（）]+?)?\s*(?:[(（]?\s*k\s*=\s*([^)\]）]+)\s*[)）]?)?$/i,
  );
  if (!match) {
    return {
      uncertaintyMode: '',
      uncertaintyValue: raw,
      coverageFactor: '',
    };
  }

  return {
    uncertaintyMode: normalizeUncertaintyMode(match[1]),
    uncertaintyValue: trimValue(match[2]),
    coverageFactor: normalizeCoverageFactor(match[3]),
  };
};

export const attachUncertaintyToMeasurementItems = (
  items: MeasurementRangeItem[] = [],
  uncertaintyItems: string[] = [],
  fallbackText?: string,
) => {
  const resolvedItems = resolveInheritedMeasurementTypes(items);
  const fallbackParts = String(fallbackText || '')
    .split(/[;\n；]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const base = uncertaintyItems.length > 0 ? uncertaintyItems : fallbackParts;

  return resolvedItems.map((item, index) => {
    if (item.uncertaintyMode || item.uncertaintyValue || item.coverageFactor) {
      return item;
    }

    return {
      ...item,
      ...parseUncertaintyText(base[index]),
    };
  });
};

export const buildUncertaintyItems = (items: MeasurementRangeItem[] = []) =>
  resolveInheritedMeasurementTypes(items).map((item) => formatUncertaintyValue(item));

export const formatMeasurementItemLabel = (item: Partial<MeasurementRangeItem>, index?: number) => {
  const parts = [
    trimValue(item.measurementType),
    trimValue(item.element),
    formatMeasurementValue(item),
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' / ');
  }

  if (typeof index === 'number') {
    return `测量项目 ${index + 1}`;
  }

  return '测量项目';
};

export const formatMeasurementWorkbenchRow = (item: Partial<MeasurementRangeItem>) => {
  const left = formatMeasurementItemLabel(item);
  const uncertainty = formatUncertaintyValue(item);
  if (left && uncertainty) {
    return `${left} | ${uncertainty}`;
  }
  return left || uncertainty;
};

const buildGroupedMeasurementText = (group: MeasurementTypeGroup) => {
  const itemText = group.items
    .map((item) => {
      const element = trimValue(item.element);
      const measurementValue = formatMeasurementValue(item);
      if (element && measurementValue) {
        return `${element} ${measurementValue}`;
      }
      return element || measurementValue;
    })
    .filter(Boolean)
    .join('；');

  return itemText ? `${group.typeName}: ${itemText}` : group.typeName;
};

const buildGroupedUncertaintyText = (group: MeasurementTypeGroup) => {
  const uncertaintyTexts = group.items
    .map((item) => formatUncertaintyValue(item))
    .filter(Boolean);

  if (uncertaintyTexts.length === 0) {
    return '';
  }

  const uniqueUncertaintyTexts = Array.from(new Set(uncertaintyTexts));
  if (uniqueUncertaintyTexts.length === 1) {
    return `${group.typeName}: ${uniqueUncertaintyTexts[0]}`;
  }

  const detailedText = group.items
    .map((item) => {
      const element = trimValue(item.element);
      const uncertainty = formatUncertaintyValue(item);
      if (element && uncertainty) {
        return `${element} ${uncertainty}`;
      }
      return uncertainty;
    })
    .filter(Boolean)
    .join('；');

  return detailedText ? `${group.typeName}: ${detailedText}` : '';
};

export const serializeMeasurementItems = (items: MeasurementRangeItem[]) =>
  normalizeMeasurementItems(items)
    .map(
      (item) =>
        `${DETAIL_PREFIX}${encodeField(item.measurementType)}|${encodeField(item.element)}|${encodeField(item.value)}|${encodeField(item.unit)}|${encodeField(item.uncertaintyMode)}|${encodeField(item.uncertaintyValue)}|${encodeField(item.coverageFactor)}`,
    )
    .join('\n');

const parseLegacyLine = (line: string): MeasurementRangeItem[] => {
  const [, typeRaw = '', elementRaw = '', thirdRaw = '', fourthRaw = ''] = line.split('|');
  const measurementType = decodeField(typeRaw);
  const element = decodeField(elementRaw);

  if (thirdRaw === 'standard' || thirdRaw === 'range') {
    return fourthRaw
      .split(',')
      .map((value) => decodeField(value))
      .filter((value) => trimValue(value))
      .map((value) => createMeasurementItem(measurementType, element, value));
  }

  const value = decodeField(thirdRaw);
  return trimValue(value) || measurementType || element
    ? [createMeasurementItem(measurementType, element, value)]
    : [];
};

export const deserializeMeasurementItems = (
  detailText?: string,
  fallbackSummary?: string,
): MeasurementRangeItem[] => {
  const lines = String(detailText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const structuredItems = lines.flatMap((line) => {
    if (line.startsWith(DETAIL_PREFIX)) {
      const [
        ,
        typeRaw = '',
        elementRaw = '',
        valueRaw = '',
        unitRaw = '',
        uncertaintyModeRaw = '',
        uncertaintyValueRaw = '',
        coverageFactorRaw = '',
      ] = line.split('|');

      return [
        createMeasurementItem(
          decodeField(typeRaw),
          decodeField(elementRaw),
          decodeField(valueRaw),
          decodeField(unitRaw),
          normalizeUncertaintyMode(decodeField(uncertaintyModeRaw)),
          decodeField(uncertaintyValueRaw),
          normalizeCoverageFactor(decodeField(coverageFactorRaw)),
        ),
      ].filter(
        (item) =>
          item.measurementType ||
          item.element ||
          item.value ||
          item.unit ||
          item.uncertaintyMode ||
          item.uncertaintyValue ||
          item.coverageFactor,
      );
    }

    if (line.startsWith(LEGACY_DETAIL_PREFIX)) {
      return parseLegacyLine(line);
    }

    return [];
  });

  if (structuredItems.length > 0) {
    return structuredItems;
  }

  const summaryLines = String(fallbackSummary || '')
    .split(/[;\n；]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (summaryLines.length > 0) {
    return summaryLines.map((line) => createMeasurementItem('', '', line));
  }

  return [createEmptyMeasurementItem()];
};

export const buildMeasurementRangeSummary = (items: MeasurementRangeItem[]) =>
  groupMeasurementItemsByType(items)
    .map((group) => buildGroupedMeasurementText(group))
    .filter(Boolean)
    .join('；');

export const buildMeasurementUncertaintySummary = (items: MeasurementRangeItem[]) =>
  groupMeasurementItemsByType(items)
    .map((group) => buildGroupedUncertaintyText(group))
    .filter(Boolean)
    .join('；');

export const buildMeasurementRangeDetail = (items: MeasurementRangeItem[]) =>
  serializeMeasurementItems(items);
