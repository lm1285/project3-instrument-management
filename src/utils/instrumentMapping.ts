import type { Instrument } from '../types/instrument';
import { 
  INSTRUMENT_FIELD_MAPPINGS, 
  InstrumentStatus, 
  InstrumentType, 
  InOutStatus 
} from '../constants/instrument';

/**
 * Safely format date to YYYY-MM-DD
 */
export const safeFormatDate = (dateValue: any): string => {
  if (!dateValue) return '';
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Invalid date format:', error);
    return '';
  }
};

/**
 * Process date fields in instrument data
 */
export const processInstrumentDates = (instrument: Partial<Instrument>): Partial<Instrument> => {
  const processed = { ...instrument };
  
  if (processed.calibrationDate) {
    processed.calibrationDate = safeFormatDate(processed.calibrationDate);
  }
  
  if (processed.nextCalibrationDate) {
    processed.nextCalibrationDate = safeFormatDate(processed.nextCalibrationDate);
  }
  
  if (processed.purchaseDate) {
    processed.purchaseDate = safeFormatDate(processed.purchaseDate);
  }

  if (processed.enableDate) {
    processed.enableDate = safeFormatDate(processed.enableDate);
  }
  
  return processed;
};

/**
 * Determine instrument type based on available fields
 */
export const determineInstrumentType = (data: any): string => {
  const rawType = (data?.type ?? (data?.instrumentType)) as any;
  const v = String(rawType || '').trim().toLowerCase();
  
  if (['标准器','std','standard','instrument','仪器','标准仪器'].some(x => v === String(x).toLowerCase())) {
    return InstrumentType.STANDARD_DEVICE;
  } else if (['标准物质','material','standard material','std-material','标物','试剂','样品','样材'].some(x => v === String(x).toLowerCase())) {
    return InstrumentType.STANDARD_MATERIAL;
  } else if (['辅助设备','aux','equipment','device','附件','配件','设备'].some(x => v === String(x).toLowerCase())) {
    return InstrumentType.AUXILIARY_DEVICE;
  } else {
    // Inference logic
    const hasUnit = !!(data.unit);
    const hasCapacity = !!(data.currentCapacity);
    const hasMeasure = !!(data.measureRange || data.measurementRange);
    const hasCycle = !!(data.calibrationCycle || data.cycle);
    
    if (hasUnit || hasCapacity) return InstrumentType.STANDARD_MATERIAL;
    if (hasMeasure || hasCycle) return InstrumentType.STANDARD_DEVICE;
    return InstrumentType.AUXILIARY_DEVICE;
  }
};

/**
 * Map frontend fields to backend format
 */
export const mapFrontendToBackend = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const mappedData = { ...data };
  const mappings = INSTRUMENT_FIELD_MAPPINGS.frontendToBackend;
  
  for (const [frontendField, backendField] of Object.entries(mappings)) {
    if (frontendField in mappedData) {
      mappedData[backendField] = mappedData[frontendField];
      if (frontendField !== backendField) {
        delete mappedData[frontendField];
      }
    }
  }
  
  return mappedData;
};

/**
 * Map backend data to frontend format
 */
export const mapBackendToFrontend = (data: any): Partial<Instrument> => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const mappedData: Partial<Instrument> = { ...data };
  const mappings = INSTRUMENT_FIELD_MAPPINGS.backendToFrontend;
  
  // Handle serial number with priority
  const possibleSerialNumberFields = [
    data.factoryNumber,
    data.serialNumber,
    data.factory_num,
    data.serial_num,
    data.factory_no,
    data.serial_no,
    data['factory_number'],
    data['serial_number']
  ];
  
  const validSerialNumbers = possibleSerialNumberFields.filter(value => 
    value && value !== '' && value !== undefined && value !== null
  );
  
  mappedData.serialNumber = validSerialNumbers[0] || '';
  
  // Apply other mappings
  for (const [backendField, frontendField] of Object.entries(mappings)) {
    if (frontendField === 'serialNumber') continue;
    
    if (backendField in mappedData) {
      const val = (mappedData as any)[backendField];
      (mappedData as any)[frontendField] = val ?? '';
    }
  }

  // Handle merge group fields
  if (data.mergeGroupId) (mappedData as any).mergeGroupId = data.mergeGroupId;
  if (data.mergeGroupName) {
    (mappedData as any).mergeGroupName = data.mergeGroupName;
  }
  if (data.mergeGroupModel) {
    (mappedData as any).mergeGroupModel = data.mergeGroupModel;
  }
  if (data.mergeGroupMeasurementRange) {
    (mappedData as any).mergeGroupMeasurementRange = data.mergeGroupMeasurementRange;
  }

  (mappedData as any).excludeFromAutoGroup = !!(data?.excludeFromAutoGroup);
  
  // Handle operator
  if (data.lastOperator) {
    (mappedData as any).operator = data.lastOperator;
  }
  
  // Determine type
  (mappedData as any).type = determineInstrumentType(mappedData);
  
  return mappedData;
};

/**
 * Transform frontend data for backend submission
 */
export const transformDataForBackend = (instrumentData: Partial<Instrument>): any => {
  const dataToTransform: any = { ...instrumentData };
  
  // Model conversion logic
  if (dataToTransform.model === 'PH-100') {
    dataToTransform.model = '100/1/1';
  }
  
  const transformed = mapFrontendToBackend(dataToTransform);
  
  // Explicitly set type if provided
  if ((instrumentData as any).type !== undefined) {
    transformed.type = determineInstrumentType(instrumentData);
  }
  
  // Remove undefined only (preserve null for explicit clearing)
  Object.keys(transformed).forEach(key => {
    if (transformed[key] === undefined) {
      delete transformed[key];
    }
  });
  
  return transformed;
};

/**
 * Map API response to Instrument object (Standardized entry point)
 */
export const mapApiResponseToInstrument = (apiData: any): Instrument => {
  if (!apiData) {
    return {} as Instrument;
  }
  
  const mapped = mapBackendToFrontend(apiData);
  
  // Process dates
  const withDates = processInstrumentDates(mapped);
  
  // Model display conversion
  if (withDates.model === '100/1/1') {
    withDates.model = 'PH-100';
  }
  
  // Default values
  withDates.status = withDates.status || InstrumentStatus.IN_USE;
  withDates.inOutStatus = withDates.inOutStatus || InOutStatus.IN_STOCK;
  withDates.quantity = withDates.quantity || 1;
  
  return withDates as Instrument;
};
