import { useState, useEffect, useCallback, useRef } from 'react';
import { App } from 'antd';
import { getInstruments } from '../services/instrumentFlowService';
import type { Instrument } from '../types';
import apiClient from '../../../services/apiClient';
import { useSystemSettings } from '../../system-settings/hooks/useSystemSettings';

interface UseInstrumentTableDataProps {
  searchQuery: string;
  flowStatusFilter?: string;
  typeFilter?: string;
  departmentFilter?: string;
  onRefresh?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

export const useInstrumentTableData = ({
  searchQuery,
  flowStatusFilter,
  typeFilter,
  departmentFilter,
  onRefresh,
  onLoadingChange
}: UseInstrumentTableDataProps) => {
  const { message: messageApi } = App.useApp();
  const [settings] = useSystemSettings();
  
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState((settings.personalization?.listView?.defaultPageSize ?? settings.table?.pageSize ?? 20));
  const [total, setTotal] = useState(0);
  
  const instrumentsRef = useRef<Instrument[]>([]);
  useEffect(() => { instrumentsRef.current = instruments; }, [instruments]);

  const inFlightRef = useRef<boolean>(false);
  const lastSigRef = useRef<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const refreshTimerRef = useRef<number | null>(null);
  const dailyIntervalRef = useRef<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(searchQuery); }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchInstruments = useCallback(async (force?: boolean) => {
    const sig = `${currentPage}|${pageSize}|${debouncedQuery}|${flowStatusFilter || ''}|${typeFilter || ''}|${departmentFilter || ''}`;
    if (inFlightRef.current && sig === lastSigRef.current && !force) {
      return;
    }
    inFlightRef.current = true;
    lastSigRef.current = force ? `${sig}|force` : sig;
    
    try {
      onLoadingChange?.(true);
      setLoading(true);
      
      const response = await getInstruments({
        page: currentPage,
        pageSize: pageSize,
        search: debouncedQuery,
        flow_status: flowStatusFilter,
        type: typeFilter,
        department: departmentFilter
      });
      
      const instrumentList: Instrument[] = response.data || [];
      const serverTotal = (response as any).total || instrumentList.length;
      
      // Server side filtering is now implemented for 'Daily Log' view (when no search/filters).
      // So we can trust instrumentList and serverTotal.
      // But we still need to filter if search is active but user wants to filter further on client?
      // Actually, getInstruments sends 'search' param to server.
      // The server handles search.
      // So we should just use the server response directly.
      
      setTotal(serverTotal);
      setInstruments(instrumentList);
      
      // UX: If searching by exact ID/Number and no result found, check if it's because status is invalid
      if (!!debouncedQuery && instrumentList.length === 0) {
         try {
           const res = await apiClient.get(`/instruments/management/${debouncedQuery.trim()}`);
           const inst: any = res?.data;
           if (inst && (inst.status === '停用' || inst.status === '已使用')) {
             messageApi.warning(`仪器状态为${inst.status}，不得进行出入库操作`);
           }
         } catch {}
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据时发生错误');
      console.error('加载仪器列表失败:', err);
      setTotal(0);
      setInstruments([]);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
      onLoadingChange?.(false);
    }
  }, [currentPage, pageSize, debouncedQuery, flowStatusFilter, typeFilter, departmentFilter, onLoadingChange, messageApi]);

  const getCurrentUserName = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.name || user.username || '系统操作员';
      }
      return localStorage.getItem('username') || localStorage.getItem('userName') || '系统操作员';
    } catch {
      return '系统操作员';
    }
  };

  const applyOptimisticUpdate = useCallback((action: 'checkout' | 'checkin' | 'use' | 'clear', instrumentId: string) => {
    const list = instrumentsRef.current.slice();
    const idx = list.findIndex(i => i.id === instrumentId);
    if (idx === -1) return;
    
    // 构造本地时间字符串 YYYY-MM-DD HH:mm:ss，避免 UTC 时间显示为 10:00 的问题
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const item = { ...list[idx] };
    
    if (action === 'checkout') {
      item.inOutStatus = '已出库';
      item.checkoutTime = nowStr;
      item.operator = getCurrentUserName();
    } else if (action === 'checkin') {
      item.inOutStatus = '在库中';
      item.checkinOrUseTime = nowStr;
      item.operator = getCurrentUserName();
    } else if (action === 'use') {
      item.checkinOrUseTime = `${nowStr}（使用）`;
      item.operator = getCurrentUserName();
    } else if (action === 'clear') {
      item.checkoutTime = '';
      item.checkinOrUseTime = '';
    }
    
    list[idx] = item;
    setInstruments(list);
  }, []);

  // Initial fetch and when params change
  useEffect(() => {
    fetchInstruments();
  }, [fetchInstruments]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') {
        fetchInstruments(true);
      }
    };

    const onVisible = () => {
      tick();
    };

    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => {
      tick();
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [fetchInstruments]);

  // Polling logic
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (dailyIntervalRef.current) {
      clearInterval(dailyIntervalRef.current);
      dailyIntervalRef.current = null;
    }
    
    const hasRecords = instruments.some(i => !!i.checkoutTime && !!i.checkinOrUseTime && !!i.operator);
    if (!hasRecords) return;
    
    const now = new Date();
    const target = new Date(now);
    target.setHours(23, 59, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    
    const ms = target.getTime() - now.getTime();
    const t = window.setTimeout(() => {
      onRefresh?.();
      const d = window.setInterval(() => {
        onRefresh?.();
      }, 24 * 60 * 60 * 1000);
      dailyIntervalRef.current = d;
    }, ms);
    
    refreshTimerRef.current = t;
    
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (dailyIntervalRef.current) {
        clearInterval(dailyIntervalRef.current);
        dailyIntervalRef.current = null;
      }
    };
  }, [instruments, onRefresh]);

  return {
    instruments,
    loading,
    error,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    total,
    fetchInstruments,
    applyOptimisticUpdate,
    instrumentsRef
  };
};
