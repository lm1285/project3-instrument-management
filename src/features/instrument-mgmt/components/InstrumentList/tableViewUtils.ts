import dayjs from 'dayjs';
import { parseExcelSerialDate } from '../../../../utils/dateUtils';
import type { Instrument } from '../../types';

export interface GroupViewModel {
  key: string;
  name: string;
  model: string;
  range: string;
  list: Instrument[];
}

export function getInstrumentTypeName(viewType?: 'std' | 'mat' | 'aux') {
  if (viewType === 'std') return '标准器';
  if (viewType === 'mat') return '标准物质';
  if (viewType === 'aux') return '辅助设备';
  return '全部';
}

export function formatDateValue(text: string | undefined, dateFormat: string) {
  if (!text) return '-';
  const excelDate = parseExcelSerialDate(text);
  if (excelDate) {
    return dayjs(excelDate).format(dateFormat);
  }
  return dayjs(text).isValid() ? dayjs(text).format(dateFormat) : text;
}

export function getStatusColor(status?: string) {
  if (status === '使用中') return 'green';
  if (status === '停用') return 'red';
  if (status === '待校准') return 'orange';
  if (status === '已报废') return 'default';
  return 'blue';
}

export function getInstrumentSerialNumber(value: string, record: Record<string, any>) {
  const possibleFields = [
    'factoryNumber',
    'serialNumber',
    'factory_num',
    'serial_num',
    'factory_no',
    'serial_no',
    'factory_number',
    'serial_number',
  ];

  let validValue = '';
  if (record) {
    for (const field of possibleFields) {
      if (record[field]) {
        const currentValue = record[field];
        if (
          currentValue !== null &&
          currentValue !== undefined &&
          (typeof currentValue !== 'string' || currentValue.toString().trim() !== '')
        ) {
          validValue = String(currentValue);
          break;
        }
      }
    }
  }

  if (!validValue && value && value !== '-') {
    validValue = String(value);
  }

  return validValue || '-';
}

function getRecentlyUngroupedIds(typeName: string) {
  try {
    const raw = localStorage.getItem('instrumentRecentlyUngroupedIds');
    const bag: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    return Array.isArray(bag[typeName]) ? bag[typeName] : [];
  } catch {
    return [];
  }
}

export function buildExplicitGroups(filteredList: Instrument[], typeName: string) {
  const forceSet = new Set(getRecentlyUngroupedIds(typeName).map(String));
  const groups = new Map<string, Instrument[]>();

  filteredList.forEach((instrument) => {
    if (forceSet.has(String(instrument.id))) return;

    const mergeGroupId = (instrument as any).mergeGroupId || '';
    const groupName = String((instrument as any).groupName || '').trim();
    if (!groupName) return;

    const groupModel = String((instrument as any).groupModel || '').trim();
    const key = mergeGroupId ? `id:${mergeGroupId}` : `nm:${groupName}||${groupModel}`;
    const list = groups.get(key) || [];
    list.push(instrument);
    groups.set(key, list);
  });

  return Array.from(groups.entries()).map(([key, list]) => {
    const first = list[0] as any;
    return {
      key: `explicit:${key}`,
      name: first.groupName || first.name,
      model: first.groupModel || first.model || '',
      range: first.groupMeasureRange || '',
      list,
    } satisfies GroupViewModel;
  });
}

export function getHiddenAutoKeys(typeName: string) {
  try {
    const raw = localStorage.getItem('instrumentAutoGroupHidden');
    const list: Array<{ type: string; key: string }> = raw ? JSON.parse(raw) : [];
    return new Set(list.filter((item) => item.type === typeName).map((item) => item.key));
  } catch {
    return new Set<string>();
  }
}

export function buildSinglesList(
  filteredList: Instrument[],
  explicitGroups: GroupViewModel[],
  autoGroups: GroupViewModel[],
  typeName: string,
) {
  const explicitMemberIds = new Set<string>();
  explicitGroups.forEach((group) =>
    group.list.forEach((instrument) => explicitMemberIds.add(String(instrument.id))),
  );

  const visibleAutoMemberIds = new Set<string>();
  autoGroups.forEach((group) =>
    group.list.forEach((instrument) => visibleAutoMemberIds.add(String(instrument.id))),
  );

  const forceSet = new Set(getRecentlyUngroupedIds(typeName).map(String));
  const base = filteredList.filter(
    (instrument) =>
      !explicitMemberIds.has(String(instrument.id)) &&
      !visibleAutoMemberIds.has(String(instrument.id)),
  );
  const forceAdds = filteredList.filter((instrument) => forceSet.has(String(instrument.id)));
  const deduped = new Map<string, Instrument>();

  [...base, ...forceAdds].forEach((instrument) => deduped.set(String(instrument.id), instrument));
  return Array.from(deduped.values());
}

export function buildEmptyGroupDefinitions(
  combinedGroupsBase: GroupViewModel[],
  typeName: string,
) {
  try {
    const raw = localStorage.getItem('instrumentGroupDefs');
    const defs: Array<{ type: string; name: string; model: string; measureRange: string }> =
      raw ? JSON.parse(raw) : [];
    const scopedDefs = defs.filter((def) => def.type === typeName);
    const exists = new Set(combinedGroupsBase.map((group) => `${group.name}||${group.model}`));

    return scopedDefs
      .filter((def) => !exists.has(`${def.name}||${def.model}`))
      .map(
        (def) =>
          ({
            key: `def:${def.name}||${def.model}`,
            name: def.name,
            model: def.model,
            range: def.measureRange,
            list: [],
          }) satisfies GroupViewModel,
      );
  } catch {
    return [] as GroupViewModel[];
  }
}
