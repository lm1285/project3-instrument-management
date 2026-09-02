import { InstrumentType } from '../../../constants/instrument';
import type {
  MergeGroupEntity,
  MergeGroupSummary,
  MergeWorkbenchResult,
} from '../domain/mergeGroupTypes';
import type { Instrument } from '../types';
import {
  readGroupDefinitions,
  readHiddenAutoGroupKeys,
  readRecentlyUngroupedIds,
} from './mergeGroupCompatibilityStore';
import { formatDateValue } from '../components/InstrumentList/tableViewUtils';

export function getMergeGroupTypeName(viewType?: 'std' | 'mat' | 'aux') {
  if (viewType === 'std') return InstrumentType.STANDARD_DEVICE;
  if (viewType === 'mat') return InstrumentType.STANDARD_MATERIAL;
  if (viewType === 'aux') return InstrumentType.AUXILIARY_DEVICE;
  return '全部';
}

const buildExplicitGroups = (instruments: Instrument[], typeName: string): MergeGroupEntity[] => {
  const recentlyUngrouped = new Set(readRecentlyUngroupedIds(typeName).map(String));
  const groups = new Map<string, Instrument[]>();

  instruments.forEach((instrument) => {
    if (recentlyUngrouped.has(String(instrument.id))) return;

    const mergeGroupId = String(instrument.mergeGroupId || '');
    if (!mergeGroupId) return;

    const groupKey = `id:${mergeGroupId}`;
    const current = groups.get(groupKey) || [];
    current.push(instrument);
    groups.set(groupKey, current);
  });

  return Array.from(groups.entries()).map(([key, list]) => {
    const first = list[0];
    return {
      key: `explicit:${key}`,
      name: first.mergeGroupName || first.groupName || first.name,
      model: first.mergeGroupModel || first.groupModel || first.model || '',
      range: first.mergeGroupMeasurementRange || first.groupMeasureRange || '',
      list,
    };
  });
};

const buildSetGroups = (instruments: Instrument[], typeName: string): MergeGroupEntity[] => {
  const recentlyUngrouped = new Set(readRecentlyUngroupedIds(typeName).map(String));
  const groups = new Map<string, Instrument[]>();

  instruments.forEach((instrument) => {
    if (recentlyUngrouped.has(String(instrument.id))) return;
    if (instrument.mergeGroupId) return;

    const setName = String(instrument.groupName || '').trim();
    const setModel = String(instrument.groupModel || '').trim();
    const setRange = String(instrument.groupMeasureRange || '').trim();

    if (!setName) return;

    const groupKey = `${setName}||${setModel}||${setRange}`;
    const current = groups.get(groupKey) || [];
    current.push(instrument);
    groups.set(groupKey, current);
  });

  return Array.from(groups.entries()).map(([key, list]) => ({
    key: `set:${key}`,
    name: list[0].groupName || list[0].name,
    model: list[0].groupModel || list[0].model || '',
    range: list[0].groupMeasureRange || '',
    list,
  }));
};

const buildPendingApprovalGroups = (
  instruments: Instrument[],
  typeName: string,
): MergeGroupEntity[] => {
  const hiddenKeys = readHiddenAutoGroupKeys(typeName);
  const buckets = new Map<string, Instrument[]>();

  instruments.forEach((instrument) => {
    if (instrument.groupName || instrument.mergeGroupId) {
      return;
    }

    const autoKeyBase = [
      instrument.type || '',
      instrument.name || '',
      instrument.model || '',
      instrument.measureRange || '',
    ].join('||');

    if (!instrument.name || !instrument.model) {
      return;
    }

    const bucketKey = `auto:${autoKeyBase}`;
    const current = buckets.get(bucketKey) || [];
    current.push(instrument);
    buckets.set(bucketKey, current);
  });

  return Array.from(buckets.entries())
    .filter(([key, list]) => list.length >= 2 && !hiddenKeys.has(key))
    .map(([key, list]) => ({
      key,
      name: list[0].name,
      model: list[0].model || '',
      range: list[0].measureRange || '',
      list,
    }));
};

const buildEmptyDefinitions = (
  existingGroups: MergeGroupEntity[],
  typeName: string,
): MergeGroupEntity[] => {
  const definitions = readGroupDefinitions();
  const scoped = definitions.filter((definition) => definition.type === typeName);
  const existingKeys = new Set(existingGroups.map((group) => `${group.name}||${group.model}`));

  return scoped
    .filter((definition) => !existingKeys.has(`${definition.name}||${definition.model}`))
    .map((definition) => ({
      key: `def:${definition.name}||${definition.model}`,
      name: definition.name,
      model: definition.model,
      range: definition.measureRange,
      list: [],
    }));
};

const buildSingles = (
  instruments: Instrument[],
  explicitGroups: MergeGroupEntity[],
  setGroups: MergeGroupEntity[],
  typeName: string,
) => {
  const explicitIds = new Set<string>();
  explicitGroups.forEach((group) =>
    group.list.forEach((instrument) => explicitIds.add(String(instrument.id))),
  );
  setGroups.forEach((group) =>
    group.list.forEach((instrument) => explicitIds.add(String(instrument.id))),
  );

  const recentlyUngrouped = new Set(readRecentlyUngroupedIds(typeName).map(String));
  const deduped = new Map<string, Instrument>();

  instruments.forEach((instrument) => {
    const id = String(instrument.id);
    if (!explicitIds.has(id)) {
      deduped.set(id, instrument);
    }
  });

  instruments.forEach((instrument) => {
    const id = String(instrument.id);
    if (recentlyUngrouped.has(id)) {
      deduped.set(id, instrument);
    }
  });

  return Array.from(deduped.values());
};

const buildSummaryRow = (
  key: string,
  group: MergeGroupEntity,
  dateFormat: string,
  collectionKind: 'group' | 'set' | 'series' = 'group',
): MergeGroupSummary => {
  const departments = Array.from(
    new Set(group.list.map((instrument) => instrument.department).filter(Boolean)),
  );
  const locations = Array.from(
    new Set(group.list.map((instrument) => instrument.location).filter(Boolean)),
  );
  const nextCalibrationDates = group.list
    .map((instrument) => instrument.nextCalibrationDate)
    .filter(Boolean)
    .sort();
  const statuses = Array.from(
    new Set(group.list.map((instrument) => instrument.status).filter(Boolean)),
  );

  return {
    key,
    rowKind: 'collection',
    rowKey: `collection-${key}`,
    collectionKind,
    collectionLabel: collectionKind === 'set' ? '套系组' : '合并组',
    name: group.name,
    model: group.model,
    range: group.range,
    departmentText: departments.length > 0 ? departments.join(' / ') : '-',
    locationText: locations.length > 0 ? locations.slice(0, 2).join(' / ') : '-',
    nextCalibrationText:
      nextCalibrationDates.length > 0 ? formatDateValue(nextCalibrationDates[0], dateFormat) : '-',
    count: group.list.length,
    statusSummary: statuses.length > 0 ? statuses.join(' / ') : '-',
    list: group.list,
  };
};

const buildGroupSummaryRows = (
  groups: MergeGroupEntity[],
  dateFormat: string,
  collectionKind: 'group' | 'set' | 'series' = 'group',
): MergeGroupSummary[] =>
  groups.map((group) => buildSummaryRow(group.key, group, dateFormat, collectionKind));

export const buildMergeWorkbenchResult = ({
  dateFormat,
  instruments,
  viewType,
}: {
  dateFormat: string;
  instruments: Instrument[];
  viewType?: 'std' | 'mat' | 'aux';
}): MergeWorkbenchResult => {
  const typeName = getMergeGroupTypeName(viewType);
  const explicitGroups = buildExplicitGroups(instruments, typeName);
  const setGroups = buildSetGroups(instruments, typeName);
  const pendingApprovalGroups = buildPendingApprovalGroups(instruments, typeName);
  const combinedGroups = explicitGroups.filter((group) => group.list.length > 0);
  const emptyDefinitions = buildEmptyDefinitions(combinedGroups, typeName);
  const singlesList = buildSingles(instruments, explicitGroups, setGroups, typeName);
  const standaloneSetRows = buildGroupSummaryRows(setGroups, dateFormat, 'set');
  const collectionRows = buildGroupSummaryRows(combinedGroups, dateFormat).map((groupRow) => {
    const childSetMap = new Map<string, Instrument[]>();
    const directMembers: Instrument[] = [];

    groupRow.list.forEach((instrument) => {
      const setName = String(instrument.groupName || '').trim();
      const setModel = String(instrument.groupModel || '').trim();
      const setRange = String(instrument.groupMeasureRange || '').trim();

      if (!setName) {
        directMembers.push(instrument);
        return;
      }

      const childKey = `${setName}||${setModel}||${setRange}`;
      const current = childSetMap.get(childKey) || [];
      current.push(instrument);
      childSetMap.set(childKey, current);
    });

    const children = Array.from(childSetMap.entries()).map(([childKey, list]) =>
      buildSummaryRow(
        `${groupRow.key}::set::${childKey}`,
        {
          key: childKey,
          name: list[0].groupName || list[0].name,
          model: list[0].groupModel || list[0].model || '',
          range: list[0].groupMeasureRange || '',
          list,
        },
        dateFormat,
        'set',
      ),
    );

    return {
      ...groupRow,
      children,
      list: directMembers,
    };
  });
  const pendingGroupRows = buildGroupSummaryRows(pendingApprovalGroups, dateFormat);
  const groupMembers = combinedGroups.reduce((sum, group) => sum + group.list.length, 0);

  return {
    typeName,
    explicitGroups,
    setGroups,
    autoGroups: pendingApprovalGroups,
    pendingApprovalGroups,
    emptyDefinitions,
    combinedGroups,
    singlesList,
    collectionRows: [...collectionRows, ...standaloneSetRows],
    pendingGroupRows,
    metrics: {
      totalInstruments: instruments.length,
      currentType: typeName,
      singles: singlesList.length,
      collections: combinedGroups.length + setGroups.length,
      collectionMembers: groupMembers,
      sets: setGroups.length,
      series: 0,
      pendingApprovalGroups: pendingApprovalGroups.length,
    },
  };
};
