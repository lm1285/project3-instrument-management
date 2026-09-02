export const InstrumentStatus = {
  IN_USE: '\u4f7f\u7528\u4e2d',
  OVERDUE: '\u8d85\u671f\u4f7f\u7528',
  USED: '\u5df2\u4f7f\u7528',
  STOPPED: '\u505c\u7528',
  SCRAPPED: '\u62a5\u5e9f',
} as const;

export type InstrumentStatusType = typeof InstrumentStatus[keyof typeof InstrumentStatus];

export const InOutStatus = {
  IN_STOCK: '\u5728\u5e93\u4e2d',
  OUT_STOCK: '\u5df2\u51fa\u5e93',
  OUT_FOR_USE: '\u5916\u51fa\u4f7f\u7528',
} as const;

export type InOutStatusType = typeof InOutStatus[keyof typeof InOutStatus];

export const InstrumentType = {
  STANDARD_DEVICE: '\u6807\u51c6\u5668',
  STANDARD_MATERIAL: '\u6807\u51c6\u7269\u8d28',
  AUXILIARY_DEVICE: '\u8f85\u52a9\u8bbe\u5907',
} as const;

export type InstrumentTypeType = typeof InstrumentType[keyof typeof InstrumentType];

export const INSTRUMENT_FIELD_MAPPINGS = {
  frontendToBackend: {
    serialNumber: 'factoryNumber',
    measureRange: 'measurementRange',
    uncertainty: 'measurementUncertainty',
    nextCalibrationDate: 'recalibrationDate',
    calibrationCycle: 'cycle',
    calibrationInstitution: 'traceabilityAgency',
    certificateNumber: 'traceabilityCertificate',
    location: 'storageLocation',
    status: 'instrumentStatus',
    inOutStatus: 'storageStatus',
    groupName: 'groupName',
    groupModel: 'groupModel',
    groupMeasureRange: 'groupMeasurementRange',
    excludeFromAutoGroup: 'excludeFromAutoGroup',
    mergeGroupId: 'mergeGroupId',
  },
  backendToFrontend: {
    factoryNumber: 'serialNumber',
    measurementRange: 'measureRange',
    measurementUncertainty: 'uncertainty',
    recalibrationDate: 'nextCalibrationDate',
    cycle: 'calibrationCycle',
    traceabilityAgency: 'calibrationInstitution',
    traceabilityCertificate: 'certificateNumber',
    storageLocation: 'location',
    instrumentStatus: 'status',
    storageStatus: 'inOutStatus',
    groupName: 'groupName',
    groupModel: 'groupModel',
    groupMeasurementRange: 'groupMeasureRange',
    excludeFromAutoGroup: 'excludeFromAutoGroup',
    mergeGroupId: 'mergeGroupId',
  },
} as const;

export const CSV_FIELD_MAP = {
  '\u7c7b\u578b': 'type',
  '\u6570\u91cf': 'quantity',
  '\u540d\u79f0': 'name',
  '\u578b\u53f7': 'model',
  '\u51fa\u5382\u7f16\u53f7': 'serialNumber',
  '\u7ba1\u7406\u7f16\u53f7': 'managementNumber',
  '\u751f\u4ea7\u5382\u5bb6': 'manufacturer',
  '\u6d4b\u91cf\u8303\u56f4': 'measureRange',
  '\u6d4b\u91cf\u4e0d\u786e\u5b9a\u5ea6': 'uncertainty',
  '\u6eaf\u6e90\u65b9\u5f0f': 'traceabilityMethod',
  '\u6821\u51c6\u65e5\u671f': 'calibrationDate',
  '\u590d\u6821\u65e5\u671f': 'nextCalibrationDate',
  '\u5468\u671f': 'calibrationCycle',
  '\u6eaf\u6e90\u673a\u6784': 'calibrationInstitution',
  '\u6eaf\u6e90\u8bc1\u4e66\u7f16\u53f7': 'certificateNumber',
  '\u79d1\u5ba4': 'department',
  '\u5b58\u653e\u4f4d\u7f6e': 'location',
  '\u4eea\u5668\u72b6\u6001': 'status',
  '\u51fa\u5165\u5e93\u72b6\u6001': 'inOutStatus',
  '\u5f53\u524d\u5bb9\u91cf': 'currentCapacity',
  '\u5355\u4f4d': 'unit',
  '\u91c7\u8d2d\u65e5\u671f': 'purchaseDate',
  '\u9a8c\u6536\u65e5\u671f': 'acceptanceDate',
  '\u91c7\u8d2d\u8d1f\u8d23\u4eba': 'purchasePerson',
  '\u542f\u7528\u65e5\u671f': 'enableDate',
  '\u8ba1\u91cf\u53c2\u6570\u8303\u56f4': 'metrologicalParameterRange',
  '\u5907\u6ce8': 'remarks',
} as const;
