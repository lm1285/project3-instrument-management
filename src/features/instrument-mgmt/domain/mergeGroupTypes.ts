import { InstrumentType } from '../../../constants/instrument';
import type { Instrument } from '../types';

export type MergeGroupType =
  | typeof InstrumentType.STANDARD_DEVICE
  | typeof InstrumentType.STANDARD_MATERIAL
  | typeof InstrumentType.AUXILIARY_DEVICE
  | '全部';

export const GROUP_TYPE_OPTIONS = [
  { key: InstrumentType.STANDARD_DEVICE, label: InstrumentType.STANDARD_DEVICE },
  { key: InstrumentType.STANDARD_MATERIAL, label: InstrumentType.STANDARD_MATERIAL },
  { key: InstrumentType.AUXILIARY_DEVICE, label: InstrumentType.AUXILIARY_DEVICE },
];

export interface MergeGroupDefinition {
  type: string;
  name: string;
  model: string;
  measureRange: string;
}

export interface MergeGroupEntity {
  key: string;
  name: string;
  model: string;
  range: string;
  list: Instrument[];
}

export interface MergeGroupSummary {
  key: string;
  rowKind: 'collection';
  rowKey: string;
  collectionKind: 'group' | 'set' | 'series';
  collectionLabel: string;
  name: string;
  model: string;
  range: string;
  departmentText: string;
  locationText: string;
  nextCalibrationText: string;
  count: number;
  statusSummary: string;
  list: Instrument[];
  children?: MergeGroupSummary[];
  parentCollectionKey?: string;
}

export interface MergeWorkbenchMetrics {
  totalInstruments: number;
  currentType: string;
  singles: number;
  collections: number;
  collectionMembers: number;
  sets: number;
  series: number;
  pendingApprovalGroups: number;
}

export interface MergeWorkbenchResult {
  typeName: string;
  explicitGroups: MergeGroupEntity[];
  setGroups: MergeGroupEntity[];
  autoGroups: MergeGroupEntity[];
  pendingApprovalGroups: MergeGroupEntity[];
  emptyDefinitions: MergeGroupEntity[];
  combinedGroups: MergeGroupEntity[];
  singlesList: Instrument[];
  collectionRows: MergeGroupSummary[];
  pendingGroupRows: MergeGroupSummary[];
  metrics: MergeWorkbenchMetrics;
}

export interface SaveGroupDraftInput {
  existingGroupId?: string | null;
  typeName: string;
  initial: {
    name: string;
    model: string;
    measureRange: string;
  };
  members: Instrument[];
  nextMembers: Instrument[];
  nextValues: {
    name: string;
    model: string;
    measureRange: string;
  };
}

export interface SaveGroupDraftResult {
  kept: number;
  removed: number;
}
