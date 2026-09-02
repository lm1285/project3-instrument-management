import React from 'react';
import DetailModal from './DetailModal';
import CheckOutModal from './CheckOutModal';
import CheckInModal from './CheckInModal';
import ClearConfirmModal from './ClearConfirmModal';
import UseInstrumentModal from './UseInstrumentModal';
import ReservationModal from './ReservationModal';
import BorrowModal from './BorrowModal';
import type { Instrument } from '../../types';

interface OperationModalsProps {
  // 详情模态框
  showDetailModal: boolean;
  selectedInstrument?: Instrument | null;
  onCloseDetailModal: () => void;
  onCheckOutFromDetail?: (id: string) => void;
  onCheckInFromDetail?: (id: string) => void;
  
  // 出库模态框
  showCheckOutModal: boolean;
  onCloseCheckOutModal: () => void;
  onConfirmCheckOut: (instrumentId: string, operator: string, department: string, purpose: string, expectedReturnTime: string, notes?: string) => void;
  
  // 入库模态框
  showCheckInModal: boolean;
  onCloseCheckInModal: () => void;
  onConfirmCheckIn: (instrumentId: string, operator: string, location: string, condition: number, usageTime?: number, notes?: string, capacityPercent?: number, capacityValue?: number, isConsumed?: boolean) => void;
  
  // 清除记录模态框
  showClearModal: boolean;
  onCloseClearModal: () => void;
  onConfirmClear: (instrumentId: string, keepBasicData: boolean) => void;
  
  // 使用模态框
  showUseModal: boolean;
  onCloseUseModal: () => void;
  onConfirmUse: (instrumentId: string, purpose: string, usageTime?: number, notes?: string) => void;

  // 预约模态框
  showReservationModal: boolean;
  onCloseReservationModal: () => void;
  onConfirmReservation: (instrumentId: string, userId: string, action: '出库' | '入库', startTime: string, endTime: string, notes?: string) => void;

  // 借用模态框
  showBorrowModal: boolean;
  onCloseBorrowModal: () => void;
  onConfirmBorrow: (instrumentId: string, borrower: string, type: 'in' | 'out', notes?: string) => void;
  
  // 可选数据源
  departments?: string[];
  locations?: string[];
  purposes?: string[];
}

const OperationModals: React.FC<OperationModalsProps> = ({
  // 详情模态框
  showDetailModal,
  selectedInstrument,
  onCloseDetailModal,
  onCheckOutFromDetail,
  onCheckInFromDetail,
  
  // 出库模态框
  showCheckOutModal,
  onCloseCheckOutModal,
  onConfirmCheckOut,
  
  // 入库模态框
  showCheckInModal,
  onCloseCheckInModal,
  onConfirmCheckIn,
  
  // 清除记录模态框
  showClearModal,
  onCloseClearModal,
  onConfirmClear,
  
  // 使用模态框
  showUseModal,
  onCloseUseModal,
  onConfirmUse,
  showReservationModal,
  onCloseReservationModal,
  onConfirmReservation,

  // 借用模态框
  showBorrowModal,
  onCloseBorrowModal,
  onConfirmBorrow,
  
  // 数据源
  departments = [],
  locations = [],
  purposes = [],
}) => {
  return (
    <>
      {/* 详情模态框 */}
      <DetailModal
        open={showDetailModal}
        onCancel={onCloseDetailModal}
        instrument={selectedInstrument}
        onCheckOut={onCheckOutFromDetail}
        onCheckIn={onCheckInFromDetail}
      />
      
      {/* 出库模态框 */}
      <CheckOutModal
        open={showCheckOutModal}
        onCancel={onCloseCheckOutModal}
        onConfirm={onConfirmCheckOut}
        instrument={selectedInstrument}
        departments={departments}
        purposes={purposes}
      />
      
      {/* 入库模态框 */}
      <CheckInModal
        open={showCheckInModal}
        onCancel={onCloseCheckInModal}
        instrument={selectedInstrument}
        locations={locations}
        onConfirm={onConfirmCheckIn}
      />
      
      {/* 清除记录模态框 */}
      <ClearConfirmModal
        open={showClearModal}
        onCancel={onCloseClearModal}
        instrument={selectedInstrument}
        onConfirm={onConfirmClear}
      />
      
      {/* 使用模态框 */}
      <UseInstrumentModal
        open={showUseModal}
        onCancel={onCloseUseModal}
        instrument={selectedInstrument}
        onConfirm={onConfirmUse}
      />

      {/* 预约模态框 */}
      <ReservationModal
        open={showReservationModal}
        onCancel={onCloseReservationModal}
        onConfirm={onConfirmReservation}
        instrument={selectedInstrument}
      />

      {/* 借用模态框 */}
      <BorrowModal
        open={showBorrowModal}
        onCancel={onCloseBorrowModal}
        onConfirm={onConfirmBorrow}
        instrument={selectedInstrument}
      />
    </>
  );
};

export default OperationModals;
