import type { InstrumentStatusType, InstrumentTypeType, InOutStatusType } from '../constants/instrument';

export interface Instrument {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  managementNumber: string;
  type: InstrumentTypeType | string;
  
  // Technical Specs
  measureRange: string;
  uncertainty?: string;
  manufacturer?: string;
  traceabilityMethod?: string;
  
  // Calibration
  calibrationDate: string;
  nextCalibrationDate: string;
  calibrationCycle?: string;
  certificateNumber?: string;
  traceabilityCertificate?: string;
  calibrationInstitution?: string;
  
  // Location & Status
  department?: string;
  location: string;
  status: InstrumentStatusType | string;
  inOutStatus: InOutStatusType | string;
  
  // Quantity & Stock
  quantity?: number;
  stock?: number;
  initialCapacity?: number;
  currentCapacity?: number;
  unit?: string;
  
  // Meta
  remarks?: string; // also known as notes
  notes?: string;   // alias for remarks in some contexts
  purchaseDate?: string;
  acceptanceDate?: string;
  purchasePerson?: string;
  metrologicalParameterRange?: string;
  enableDate?: string;
  attachment?: File | string | null;
  
  // Grouping
  groupName?: string;
  groupModel?: string;
  groupMeasureRange?: string;
  groupSerialNumber?: string;
  mergeGroupId?: string;
  mergeGroupName?: string;
  mergeGroupModel?: string;
  mergeGroupMeasurementRange?: string;
  
  // Alerting
  alertLevel?: string;
  alertMode?: string;
  
  // Flow / Runtime Data
  checkoutTime?: string;
  checkinOrUseTime?: string;
  operator?: string;
  
  // Batch Operations
  splitRecord?: boolean;
  incrementMode?: 'sequential' | 'suffix';
}
