import { useState, useCallback } from 'react';
import { App } from 'antd';
import type { Instrument } from '../types';
import {
  checkOutInstrument,
  checkInInstrument,
  useInstrument,
  clearTodayRecord,
  clearLatestRecord,
  resetInstrumentStatus
} from '../services/instrumentFlowService';

interface UseInstrumentActionsProps {
  onRefresh?: () => void;
}

export const useInstrumentActions = ({ onRefresh }: UseInstrumentActionsProps = {}) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理API调用的通用方法
  const handleApiCall = async <T>(
    apiCall: () => Promise<T>,
    successMessage: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      message.success(successMessage);
      onRefresh?.();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作失败，请重试';
      setError(errorMessage);
      message.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 出库操作
  const handleCheckOut = useCallback(
    async (
      instrumentId: string,
      operator: string,
      department?: string,
      purpose?: string,
      expectedReturnTime?: string,
      notes?: string,
      borrower?: string
    ): Promise<Instrument | null> => {
      return handleApiCall(
        () =>
          checkOutInstrument(instrumentId, {
            operator,
            department,
            purpose,
            expected_return_time: expectedReturnTime,
            notes,
            borrower
          }),
        '仪器出库成功'
      );
    },
    [handleApiCall]
  );

  // 入库操作
  const handleCheckIn = useCallback(
    async (
      instrumentId: string,
      operator: string,
      location?: string,
      condition?: number,
      usageTime?: number,
      notes?: string,
      capacityPercent?: number,
      capacityValue?: number,
      isConsumed?: boolean,
      borrower?: string
    ): Promise<Instrument | null> => {
      return handleApiCall(
        () =>
          checkInInstrument(instrumentId, {
            operator,
            location,
            condition,
            usage_time: usageTime,
            notes,
            capacityPercent,
            capacityValue,
            isConsumed,
            borrower
          }),
        '仪器入库成功'
      );
    },
    [handleApiCall]
  );

  // 使用操作
  const handleUse = useCallback(
    async (
      instrumentId: string,
      purpose: string,
      usageTime?: number,
      notes?: string
    ): Promise<Instrument | null> => {
      return handleApiCall(
        () =>
          useInstrument(instrumentId, {
            purpose,
            usage_time: usageTime,
            notes
          }),
        '仪器使用记录已保存'
      );
    },
    [handleApiCall]
  );

  // 清除记录操作
  const handleClearRecords = useCallback(
    async (instrumentId: string, keepBasicData: boolean): Promise<boolean> => {
      const result = await handleApiCall(
        () => clearTodayRecord(instrumentId, keepBasicData),
        '今日记录清除成功'
      );
      return !!result;
    },
    [handleApiCall]
  );

  // 清除最近一条记录操作
  const handleClearLatestRecord = useCallback(
    async (instrumentId: string, keepBasicData: boolean): Promise<boolean> => {
      const result = await handleApiCall(
        () => clearLatestRecord(instrumentId, keepBasicData),
        '最近一条记录清除成功'
      );
      return !!result;
    },
    [handleApiCall]
  );

  // 重置仪器状态操作
  const handleReset = useCallback(
    async (instrumentId: string): Promise<Instrument | null> => {
      return handleApiCall(
        () => resetInstrumentStatus(instrumentId),
        '仪器状态重置成功'
      );
    },
    [handleApiCall]
  );

  return {
    loading,
    error,
    handleCheckOut,
    handleCheckIn,
    handleUse,
    handleClearRecords,
    handleClearLatestRecord,
    handleReset
  };
};

export default useInstrumentActions;