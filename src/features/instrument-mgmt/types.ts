export interface Instrument {
  id: string;
  type: string;
  name: string;
  groupName?: string;
  groupModel?: string;
  groupMeasureRange?: string;
  groupSerialNumber?: string;
  mergeGroupId?: string;
  mergeGroupName?: string;
  mergeGroupModel?: string;
  mergeGroupMeasurementRange?: string;
  model: string;
  serialNumber: string;
  managementNumber: string;
  manufacturer?: string;
  measureRange: string;
  uncertainty?: string;
  traceabilityMethod?: string;
  calibrationDate: string;
  nextCalibrationDate: string;
  calibrationCycle?: string;
  calibrationInstitution?: string;
  traceabilityCertificate?: string;
  certificateNumber?: string;
  department?: string;
  location: string;
  status: string;
  inOutStatus: string;
  remarks?: string;
  currentCapacity?: number;
  unit?: string;
  initialCapacity?: number;
  excludeFromAutoGroup?: boolean;
  quantity?: number;
  purchaseDate?: string;
  acceptanceDate?: string;
  purchasePerson?: string;
  metrologicalParameterRange?: string;
  enableDate?: string;
  attachment?: File | string | null;
  alertLevel?: string;
  alertMode?: string;
  disableReason?: string;
  disabler?: string;
  disableTime?: string;
  createdAt?: string;
  updatedAt?: string;
  batchDetails?: Array<{
    managementNumber: string;
    serialNumber?: string;
    certificateNumber?: string;
  }>;
}

export interface MeasurementRangeItem {
  id: string;
  measurementType?: string;
  element?: string;
  value: string;
  unit?: string;
  uncertaintyMode?: string;
  uncertaintyValue?: string;
  coverageFactor?: string;
}

export interface InstrumentSetEntryItem {
  id: string;
  model: string;
  serialNumber: string;
  managementNumber: string;
  measureRange: string;
  uncertainty: string;
  metrologicalParameterRange?: string;
  measurementItems?: MeasurementRangeItem[];
}

export interface InstrumentFormData extends Partial<Instrument> {
  entryMode?: 'single' | 'batch' | 'set';
  certificateNumber?: string;
  splitRecord?: boolean;
  incrementMode?: boolean | string;
  alertMode?: string;
  alertLevel?: string;
  quantity?: number;
  mergeGroupId?: string;
  batchDetails?: Array<{
    managementNumber: string;
    serialNumber?: string;
    certificateNumber?: string;
  }>;
  measurementItems?: MeasurementRangeItem[];
  uncertaintyItems?: string[];
  setEntries?: InstrumentSetEntryItem[];
}

export interface ModalState {
  visible: boolean;
  type: 'add' | 'edit' | 'view';
  selectedInstrument?: Instrument | null;
}

export interface FilterValues {
  type?: string;
  traceabilityMethod?: string;
  department?: string;
  instrumentStatus?: string;
  storageStatus?: string;
  dateRange?: [string, string] | undefined;
  dateField?: 'calibrationDate' | 'nextCalibrationDate';
  groupName?: string;
  groupModel?: string;
}

export interface TableSelection {
  selectedRowKeys: React.Key[];
}

export interface MergeCandidate {
  id: string;
  name: string;
  model: string;
  managementNumber: string;
  measureRange: string;
  manufacturer: string;
}

export interface AddToExistingSuggestion {
  targetGroup: {
    id: string;
    name: string;
    model: string;
    measureRange: string;
  };
  candidates: MergeCandidate[];
}

export interface CreateNewSuggestion {
  proposedGroup: {
    name: string;
    model: string;
    measureRange: string;
  };
  candidates: MergeCandidate[];
}

export interface MergeSuggestion {
  addToExisting: AddToExistingSuggestion[];
  createNew: CreateNewSuggestion[];
}

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export type FormFieldChangeEvent = React.ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

export type FileChangeEvent = React.ChangeEvent<HTMLInputElement>;
