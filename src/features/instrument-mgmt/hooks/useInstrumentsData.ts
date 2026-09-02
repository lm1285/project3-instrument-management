import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import * as instrumentService from '../services/instrumentService';
import { mapFrontendToBackend } from '../services/instrumentService';
import type { Instrument } from '../types';

export const useInstrumentsData = () => {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstruments = useCallback(async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;

    try {
      if (!silent) setLoading(true);
      setError(null);

      const result = await instrumentService.getInstruments();
      if (result.success && result.data) {
        const frontendInstruments = result.data.map((instrument: any) =>
          instrumentService.mapApiResponseToInstrument(instrument),
        );
        setInstruments(frontendInstruments);
      } else {
        setError(result.message || '加载仪器列表失败');
      }
    } catch (err) {
      console.error('加载仪器数据时出错:', err);
      setError('加载失败，请重试');
      toast.error('加载仪器数据失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const deleteInstrument = async (id: string) => {
    try {
      const success = await instrumentService.deleteInstrument(id);
      if (success) {
        await loadInstruments();
        return true;
      }
      return false;
    } catch (err) {
      console.error('后端删除操作失败，重新加载数据:', err);
      await loadInstruments();
      return false;
    }
  };

  const batchDelete = async (ids: string[]) => {
    try {
      setLoading(true);
      const result = await instrumentService.batchDeleteInstruments(ids);
      if (result.success) {
        await loadInstruments();
      }
      return result;
    } catch (err) {
      console.error('批量删除操作失败:', err);
      return { success: false, message: '批量删除失败', deletedCount: 0 };
    } finally {
      setLoading(false);
    }
  };

  const importInstruments = async (file: File) => {
    try {
      setLoading(true);

      let instrumentData: Omit<Instrument, 'id'>[] = [];
      if (file.name.endsWith('.csv')) {
        const csvContent = await instrumentService.readCSVFile(file);
        instrumentData = instrumentService.parseCSVToInstruments(csvContent);
      } else if (file.name.match(/\.(xlsx|xls|xlsm)$/)) {
        const excelData = await instrumentService.readExcelFile(file);
        instrumentData = instrumentService.parseExcelToInstruments(excelData);
      } else {
        throw new Error('不支持的文件格式');
      }

      const result = await instrumentService.batchImportInstruments(instrumentData);
      if (result.success) {
        await loadInstruments();
      }
      return result;
    } catch (err) {
      console.error('导入失败:', err);
      return { success: false, message: '导入失败，请检查文件格式并重试', count: 0 };
    } finally {
      setLoading(false);
    }
  };

  const updateInstrument = useCallback(
    async (
      id: string,
      updatedData: Partial<Instrument>,
    ): Promise<{ success: boolean; message?: string; reason?: string; status?: number }> => {
      try {
        setLoading(true);
        const backendData = mapFrontendToBackend(updatedData);
        const result = await instrumentService.updateInstrument(id, backendData);

        if (result.success) {
          await loadInstruments();
          return { success: true };
        }

        toast.error(`更新仪器失败${result.message ? `: ${result.message}` : ''}`);
        return {
          success: false,
          message: result.message,
          reason: result.reason,
          status: result.status,
        };
      } catch (err) {
        const status = (err as any)?.statusCode;
        const data = (err as any)?.data;
        const msg = (data && (data.message || data.error)) || (err instanceof Error ? err.message : '未知错误');
        const reason =
          (data && data.reason) ||
          (status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : undefined);
        toast.error(`更新仪器失败: ${msg}`);
        return { success: false, message: msg, reason, status };
      } finally {
        setLoading(false);
      }
    },
    [loadInstruments],
  );

  const addInstrument = useCallback(
    async (instrumentData: Omit<Instrument, 'id'>) => {
      try {
        setLoading(true);
        const backendData = mapFrontendToBackend(instrumentData);
        const result = await instrumentService.addInstrument(backendData);

        if (result.success) {
          await loadInstruments();
          return result.data || null;
        }

        toast.error(result.message || '添加仪器失败');
        return null;
      } catch (err) {
        console.error('添加仪器失败:', err);
        toast.error('添加仪器失败');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [loadInstruments],
  );

  useEffect(() => {
    loadInstruments();
  }, [loadInstruments]);

  useEffect(() => {
    const tryRefresh = () => {
      if (document.visibilityState === 'visible') {
        loadInstruments({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', tryRefresh);
    const interval = window.setInterval(tryRefresh, 10000);

    return () => {
      document.removeEventListener('visibilitychange', tryRefresh);
      window.clearInterval(interval);
    };
  }, [loadInstruments]);

  return {
    instruments,
    loading,
    error,
    loadInstruments: loadInstruments as unknown as () => Promise<void>,
    deleteInstrument,
    batchDeleteInstruments: batchDelete,
    importInstruments,
    updateInstrument,
    addInstrument,
  };
};
