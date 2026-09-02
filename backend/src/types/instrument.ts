/**
 * 统一的字段映射关系常量
 * 用于前后端字段转换，确保数据一致性
 */
export const INSTRUMENT_FIELD_MAPPINGS = {
  // 前端字段名 -> 后端字段名
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
    metrologicalParameterRange: 'metrologicalParameterRange',
    acceptanceDate: 'acceptanceDate',
    purchaseDate: 'purchaseDate',
    purchasePerson: 'purchasePerson'
  },
  
  // 后端字段名 -> 前端字段名（反向映射）
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
    metrologicalParameterRange: 'metrologicalParameterRange',
    acceptanceDate: 'acceptanceDate',
    purchaseDate: 'purchaseDate',
    purchasePerson: 'purchasePerson'
  }
};

/**
 * 后端数据库存储的仪器类型接口
 * 包含所有需要存储到数据库的字段
 */
export interface Instrument {
  id: string;
  type: string;
  name: string;
  model: string;
  factoryNumber: string; // 出厂编号
  managementNumber: string; // 管理编号
  manufacturer: string;
  measurementRange: string;
  measurementUncertainty: string;
  traceabilityMethod: string;
  calibrationDate: string;
  recalibrationDate: string;
  cycle: string;
  traceabilityAgency: string;
  traceabilityCertificate: string; // 溯源证书
  department: string;
  storageLocation: string;
  instrumentStatus: string;
  storageStatus: string;
  remarks: string;
  createdAt?: string;
  updatedAt?: string;
  currentCapacity?: number;
  unit?: string;
  initialCapacity?: number;
  groupName?: string;
  groupModel?: string;
  groupMeasurementRange?: string;
  excludeFromAutoGroup?: number | boolean;
  alertLevel?: string;
  alertMode?: string;
  quantity?: number;
  splitRecord?: boolean;
  incrementMode?: 'sequential' | 'suffix';
  mergeGroupId?: string;
  attachment?: string;
  enableDate?: string;
  metrologicalParameterRange?: string; // 计量参数范围
  acceptanceDate?: string; // 验收日期
  purchaseDate?: string; // 采购日期
  purchasePerson?: string; // 采购负责人
  batchDetails?: Array<{
    managementNumber: string;
    serialNumber?: string;
    certificateNumber?: string;
  }>;
  disableReason?: string;
  disabler?: string;
  disableTime?: string;
}

/**
 * 前端表单数据类型
 * 定义前端UI组件使用的字段命名
 */
export interface InstrumentFormData {
  type: string;
  name: string;
  model: string;
  serialNumber: string; // 出厂编号，提交时会映射到factoryNumber
  managementNumber: string;
  manufacturer: string;
  measureRange: string; // 测量范围
  uncertainty: string; // 测量不确定度
  traceabilityMethod: string;
  calibrationDate: string;
  nextCalibrationDate: string; // 复校日期
  calibrationCycle: string; // 校准周期
  calibrationInstitution: string; // 溯源机构
  traceabilityCertificate: string; // 溯源证书
  certificateNumber?: string; // 前端可能使用的字段名
  department: string;
  location: string; // 存放位置
  status: string; // 仪器状态
  inOutStatus: string; // 出入库状态
  remarks: string;
  currentCapacity?: number;
  unit?: string;
  initialCapacity?: number;
  groupName?: string;
  groupModel?: string;
  groupMeasurementRange?: string;
  alertLevel?: string;
  alertMode?: string;
  enableDate?: string;
  quantity?: number;
  splitRecord?: boolean;
  incrementMode?: 'sequential' | 'suffix';
  mergeGroupId?: string;
  attachment?: string;
  metrologicalParameterRange?: string;
  acceptanceDate?: string;
  purchaseDate?: string;
  purchasePerson?: string;
  disableReason?: string;
  disabler?: string;
  disableTime?: string;
  batchDetails?: Array<{
    managementNumber: string;
    serialNumber?: string;
    certificateNumber?: string;
  }>;
}

/**
 * 将前端表单数据映射转换为后端数据格式
 * @param frontendData 前端表单数据
 * @returns 转换后的后端数据格式
 */
export function mapFrontendToBackend(frontendData: InstrumentFormData | any): Partial<Instrument> {
  const backendData: Partial<Instrument> = { ...frontendData };
  
  // 应用字段映射
  for (const [frontendField, backendField] of Object.entries(INSTRUMENT_FIELD_MAPPINGS.frontendToBackend)) {
    if (frontendField in backendData) {
      backendData[backendField as keyof Instrument] = backendData[frontendField as keyof typeof backendData] as any;
    }
  }
  
  return backendData;
}

/**
 * 将后端数据映射转换为前端格式
 * @param backendData 后端数据
 * @returns 转换后的前端数据格式
 */
export function mapBackendToFrontend(backendData: Instrument | any): any {
  const frontendData: any = { ...backendData };
  
  // 应用字段映射
  for (const [backendField, frontendField] of Object.entries(INSTRUMENT_FIELD_MAPPINGS.backendToFrontend)) {
    if (backendField in frontendData) {
      frontendData[frontendField] = frontendData[backendField];
    }
  }
  
  // 优先使用合并组表中的名称和型号
  if (backendData.mergeGroupName) {
    frontendData.groupName = backendData.mergeGroupName;
  }
  if (backendData.mergeGroupModel) {
    frontendData.groupModel = backendData.mergeGroupModel;
  }
  
  // 映射 lastOperator 到 operator (用于前端显示操作人)
  if (backendData.lastOperator) {
    frontendData.operator = backendData.lastOperator;
  }
  
  return frontendData;
}

/**
 * 仪器分页查询参数
 */
export interface InstrumentQueryParams {
  page: number;
  pageSize: number;
  searchKeyword?: string;
  filters?: Record<string, any>;
}

/**
 * 仪器分页响应数据
 */
export interface InstrumentPageResponse {
  data: Instrument[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
