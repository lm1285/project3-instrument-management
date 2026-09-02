/**
 * 流程操作类型
 */
export type FlowAction = '出库' | '入库' | '使用' | '报废' | '转移' | '维护' | '编辑' | '创建' | '删除' | '状态更新' | '处理状态更新' | '预约';

/**
 * 流程记录
 */
export interface FlowRecord {
  id: string;
  instrumentId: string;
  instrumentName: string;
  instrumentManagementNumber: string;
  action: FlowAction;
  operator: string;
  details: Record<string, any>;
  timestamp: string;
  usageAmount?: number;
}

/**
 * 预约状态
 */
export type ReservationStatus = 'confirmed' | 'cancelled' | 'completed';

/**
 * 预约记录
 */
export interface Reservation {
  id: string;
  instrumentId: string;
  instrumentName: string;
  userId: string;
  startTime: string;
  endTime: string;
  purpose: string;
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * 流程记录查询参数
 */
export interface FlowRecordQuery {
  instrumentId?: string;
  action?: FlowAction;
  operator?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * 预约冲突检查参数
 */
export interface ConflictCheckParams {
  instrumentId: string;
  startTime: string;
  endTime: string;
  excludeReservationId?: string;
}

/**
 * 仪器当前状态信息
 */
export interface InstrumentStatusInfo {
  inUse: boolean;
  currentAction?: FlowAction;
  lastActionTime?: string;
  operator?: string;
  reservation?: Reservation;
}