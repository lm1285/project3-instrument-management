import { useCallback } from 'react';
import { App } from 'antd';
import type { Instrument } from '../types';
import { exportInstrumentsExcel, borrowInstrument } from '../services/instrumentFlowService';
import apiClient from '../../../services/apiClient';
import useInstrumentActions from './useInstrumentActions';

interface UseInstrumentFlowHandlersProps {
  onRefresh: () => void;
  onSetModalStates: (states: any) => void;
  onSetSelectedInstrument: (instrument: Instrument | null) => void;
  onSetLoading: (loading: boolean) => void;
}

interface ModalHandlers {
  onViewDetail: (instrument: Instrument) => void;
  onCheckOut: (instrument: Instrument) => void;
  onCheckIn: (instrument: Instrument) => void;
  onUse: (instrument: Instrument) => void;
  onReservation: (instrument: Instrument) => void;
  onClearRecord: (instrument: Instrument) => void;
  onResetStatus: (instrument: Instrument) => void;
  onBorrow: (instrument: Instrument) => void;
}

interface ConfirmHandlers {
  onCloseDetailModal: () => void;
  onCloseCheckOutModal: () => void;
  onCloseCheckInModal: () => void;
  onCloseUseModal: () => void;
  onCloseClearModal: () => void;
  onCloseResetModal: () => void;
  onCloseReservationModal: () => void;
  onCloseBorrowModal: () => void;
  onCheckOutFromDetail: (id: string) => void;
  onCheckInFromDetail: (id: string) => void;
  onConfirmCheckOut: (instrumentId: string, operator: string, department: string, purpose: string, expectedReturnTime: string, notes?: string) => Promise<void>;
  onConfirmCheckIn: (instrumentId: string, operator: string, location: string, condition: number, usageTime?: number, notes?: string, capacityPercent?: number, capacityValue?: number, isConsumed?: boolean) => Promise<void>;
  onConfirmUse: (instrumentId: string, purpose: string, usageTime?: number, notes?: string) => Promise<void>;
  onConfirmReservation: (instrumentId: string, userId: string, action: '出库' | '入库', startTime: string, endTime: string, notes?: string) => Promise<void>;
  onConfirmClear: (instrumentId: string, keepBasicData: boolean) => Promise<void>;
  onConfirmReset: (instrumentId: string) => Promise<void>;
  onConfirmBorrow: (instrumentId: string, borrower: string, type: 'in' | 'out', notes?: string) => Promise<void>;
}

interface InstrumentFlowHandlers {
  handleSearch: () => void;
  handleReset: () => void;
  handleExport: () => Promise<void>;
  handleRefresh: () => void;
  modalHandlers: ModalHandlers;
  confirmHandlers: ConfirmHandlers;
}

export const useInstrumentFlowHandlers = ({
  onRefresh,
  onSetModalStates,
  onSetSelectedInstrument,
  onSetLoading
}: UseInstrumentFlowHandlersProps): InstrumentFlowHandlers => {
  const { message } = App.useApp();
  // 使用仪器操作hooks
  const {
    handleCheckOut,
    handleCheckIn,
    handleUse,
    handleClearRecords,
    handleReset: resetInstrumentStatus // 重命名避免与本地handleReset冲突
  } = useInstrumentActions({ onRefresh });
  
  // 处理搜索
  const handleSearch = useCallback(() => {
    onRefresh();
  }, [onRefresh]);
  
  // 处理重置
  const handleReset = useCallback(() => {
    onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: false, showClearModal: false, showBorrowModal: false });
    // 重置搜索和筛选条件的操作应该由父组件完成
    onRefresh(); // 触发数据刷新以显示重置后的列表
  }, [onRefresh, onSetModalStates]);
  
  // 处理导出Excel
  const handleExport = useCallback(async () => {
    onSetLoading(true);
    try {
      const params = {
        search: '',
        status: undefined,
        flow_status: undefined
      };
      
      const blob = await exportInstrumentsExcel(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `仪器列表_${new Date().toLocaleDateString()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败，请重试');
      console.error('Export error:', error);
    } finally {
      onSetLoading(false);
    }
  }, [onSetLoading]);
  
  // 处理刷新
  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);
  
  // 模态框处理函数
  const modalHandlers: ModalHandlers = {
    onViewDetail: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: true });
    }, [onSetSelectedInstrument, onSetModalStates]),
    
    onCheckOut: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: true, showCheckInModal: false, showUseModal: false, showClearModal: false });
    }, [onSetSelectedInstrument, onSetModalStates]),
    
    onCheckIn: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: true, showUseModal: false, showClearModal: false });
    }, [onSetSelectedInstrument, onSetModalStates]),
    
    onUse: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: true, showClearModal: false });
    }, [onSetSelectedInstrument, onSetModalStates]),
    onReservation: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: false, showClearModal: false, showReservationModal: true });
    }, [onSetSelectedInstrument, onSetModalStates]),
    
    onClearRecord: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: false, showClearModal: true });
    }, [onSetSelectedInstrument, onSetModalStates]),
    
    onResetStatus: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: false, showClearModal: false, showResetModal: true });
    }, [onSetSelectedInstrument, onSetModalStates]),

    onBorrow: useCallback((instrument: Instrument) => {
      onSetSelectedInstrument(instrument);
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: false, showUseModal: false, showClearModal: false, showReservationModal: false, showBorrowModal: true });
    }, [onSetSelectedInstrument, onSetModalStates])
  };
  
  // 确认处理函数
  const confirmHandlers: ConfirmHandlers = {
    onCloseDetailModal: useCallback(() => {
      onSetModalStates({ showDetailModal: false });
    }, [onSetModalStates]),
    
    onCloseCheckOutModal: useCallback(() => {
      onSetModalStates({ showCheckOutModal: false });
    }, [onSetModalStates]),
    
    onCloseCheckInModal: useCallback(() => {
      onSetModalStates({ showCheckInModal: false });
    }, [onSetModalStates]),
    
    onCloseUseModal: useCallback(() => {
      onSetModalStates({ showUseModal: false });
    }, [onSetModalStates]),
    
    onCloseClearModal: useCallback(() => {
      onSetModalStates({ showClearModal: false });
    }, [onSetModalStates]),
    
    onCloseResetModal: useCallback(() => {
      onSetModalStates({ showResetModal: false });
    }, [onSetModalStates]),
    onCloseReservationModal: useCallback(() => {
      onSetModalStates({ showReservationModal: false });
    }, [onSetModalStates]),

    onCloseBorrowModal: useCallback(() => {
      onSetModalStates({ showBorrowModal: false });
    }, [onSetModalStates]),
    
    onCheckOutFromDetail: useCallback((_: string) => {
      onSetModalStates({ showDetailModal: false, showCheckOutModal: true, showCheckInModal: false, showUseModal: false, showClearModal: false });
    }, [onSetModalStates]),
    
    onCheckInFromDetail: useCallback((_: string) => {
      onSetModalStates({ showDetailModal: false, showCheckOutModal: false, showCheckInModal: true, showUseModal: false, showClearModal: false });
    }, [onSetModalStates]),
    
    onConfirmCheckOut: useCallback(async (instrumentId: string, operator: string, department: string, purpose: string, expectedReturnTime: string, notes?: string) => {
      await handleCheckOut(instrumentId, operator, department, purpose, expectedReturnTime, notes);
      onSetModalStates({ showCheckOutModal: false });
    }, [handleCheckOut, onSetModalStates]),
    
    onConfirmCheckIn: useCallback(async (instrumentId: string, operator: string, location: string, condition: number, usageTime?: number, notes?: string, capacityPercent?: number, capacityValue?: number, isConsumed?: boolean) => {
      await handleCheckIn(instrumentId, operator, location, condition, usageTime, notes, capacityPercent, capacityValue, isConsumed);
      try {
        const detail = await apiClient.get(`/instruments/${instrumentId}`);
        const inst: any = detail?.data;
        const type = String(inst?.type || inst?.instrumentType || '');
        if (type === '标准物质') {
          const initial = Number(inst?.initialCapacity ?? 0) || 0;
          const baseline = initial > 0 ? initial : Number(inst?.currentCapacity ?? 0) || 0;
          const nextCapacity = (typeof capacityValue === 'number')
            ? Math.max(0, Number(capacityValue))
            : (typeof capacityPercent === 'number')
              ? Math.max(0, Math.round((baseline * capacityPercent) / 100))
              : null;
          if (nextCapacity !== null) {
            await Promise.all([
              apiClient.patch(`/instruments/${instrumentId}`, { currentCapacity: nextCapacity, ...(initial ? {} : { initialCapacity: baseline }) }),
              apiClient.post(`/alerts/generate`, { threshold: 30 })
            ]);
          }
        }
      } catch {}
      onSetModalStates({ showCheckInModal: false });
      }, [handleCheckIn, onSetModalStates]),
    
    onConfirmUse: useCallback(async (instrumentId: string, purpose: string, usageTime?: number, notes?: string) => {
      await handleUse(instrumentId, purpose, usageTime, notes);
      onSetModalStates({ showUseModal: false });
    }, [handleUse, onSetModalStates]),
    onConfirmReservation: useCallback(async (instrumentId: string, userId: string, action: '出库' | '入库', startTime: string, endTime: string, notes?: string) => {
      try {
        await apiClient.post(`/flow/reservation`, { instrumentId, userId, startTime, endTime, purpose: `预约:${action}`, notes });
        message.success('预约创建成功');
      } catch (e) {
        message.error('预约创建失败');
      } finally {
        onSetModalStates({ showReservationModal: false });
        onRefresh();
      }
    }, [onSetModalStates, onRefresh]),
    
    onConfirmClear: useCallback(async (instrumentId: string, keepBasicData: boolean) => {
      await handleClearRecords(instrumentId, keepBasicData);
      onSetModalStates({ showClearModal: false });
    }, [handleClearRecords, onSetModalStates]),
    
    onConfirmReset: useCallback(async (instrumentId: string) => {
      await resetInstrumentStatus(instrumentId);
      onSetModalStates({ showResetModal: false });
    }, [resetInstrumentStatus, onSetModalStates]),

    onConfirmBorrow: useCallback(async (instrumentId: string, borrower: string, type: 'in' | 'out', notes?: string) => {
      // 获取当前用户信息作为operator
      let operator = '系统操作员';
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          operator = user.username || '系统操作员';
        } else {
          operator = localStorage.getItem('username') || '系统操作员';
        }
      } catch (e) {
        console.error('获取用户信息失败', e);
      }

      if (type === 'out') {
        // 借出 = 调用借用接口
        try {
          await borrowInstrument(
            instrumentId, 
            {
              borrower,
              notes
            }
          );
          message.success('仪器借用成功');
          onRefresh();
        } catch (error) {
          // borrowInstrument throws error on failure? 
          // fetchAPI usually throws. 
          // If handleApiCall wrapper was used, it caught it. Here we need to catch it or let it bubble?
          // The UI calls this async function. If it bubbles, where is it caught?
          // It's attached to onClick/onConfirm. 
          // Ideally we should catch and show error, or rely on global error handler?
          // fetchAPI might show message?
          // Let's wrap in try-catch to be safe and consistent with useInstrumentActions.
          console.error(error);
          message.error(error instanceof Error ? error.message : '借用操作失败');
        }
      } else {
        // 归还 = 入库
        await handleCheckIn(
          instrumentId,
          operator,
          undefined, // location
          undefined, // condition
          undefined, // usageTime
          notes,
          undefined, // capacityPercent
          undefined, // capacityValue
          undefined, // isConsumed,
          borrower // borrower
        );
      }
      onSetModalStates({ showBorrowModal: false });
    }, [handleCheckOut, handleCheckIn, onSetModalStates])
  };
  
  return {
    handleSearch,
    handleReset,
    handleExport,
    handleRefresh,
    modalHandlers,
    confirmHandlers
  };
};
