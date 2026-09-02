import { Instrument as GlobalInstrument } from '../../../types/instrument';

// 模态框状态类型
export interface ModalStates {
  showDetailModal: boolean;
  showCheckOutModal: boolean;
  showCheckInModal: boolean;
  showUseModal: boolean;
  showClearModal: boolean;
  showReservationModal: boolean;
  showResetModal?: boolean;
  showBorrowModal: boolean;
}

// 仪器类型定义 - 使用全局类型
export type Instrument = GlobalInstrument;

// 仪器流动记录类型
export interface InstrumentFlowRecord {
  id: string;
  instrumentId: string;
  instrumentName: string;
  instrumentModel: string;
  type: 'checkout' | 'checkin' | 'transfer' | 'use';
  operator: string;
  department: string;
  recipient?: string;
  purpose?: string;
  locationFrom: string;
  locationTo: string;
  status: 'completed' | 'pending' | 'cancelled';
  startTime: string;
  endTime?: string;
  notes?: string;
}

// 预约类型定义
export interface Reservation {
  id: string;
  instrumentId: string;
  userId: string;
  userName: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  purpose?: string;
  notes?: string;
}

// 操作按钮属性类型
export interface OperationButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

// 批量操作参数类型
export interface BatchOperationParams {
  instrumentIds: string[];
  operation: 'checkout' | 'checkin' | 'clear';
  operator?: string;
  notes?: string;
}

