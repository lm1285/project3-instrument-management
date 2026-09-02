import apiClient from '../../../services/apiClient';
import { getInstrumentById, getInstrumentHistory as getHistoryFromService } from '../../instrument-mgmt/services/instrumentService';

export async function getInstrumentHistory(instrumentId: string) {
  try {
    const history = await getHistoryFromService(instrumentId);
    return {
      items: history.map(item => ({
        ...item,
        scope: 'instrument', // Default scope
      }))
    };
  } catch (error) {
    console.error('Failed to fetch instrument history', error);
    return { items: [] };
  }
}

export async function getInstrumentDetail(instrumentId: string) {
  try {
    const result = await getInstrumentById(instrumentId);
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Failed to fetch instrument detail', error);
    return null;
  }
}

// 获取使用记录历史
export const getUsageHistory = async (params?: { 
  start?: string; 
  end?: string; 
  page?: number; 
  pageSize?: number; 
  actions?: string 
}) => {
  const res = await apiClient.get('/history/usage', { params });
  return res.data;
};

export const getGeneralStats = async () => {
  const res = await apiClient.get('/statistics/general');
  return res.data.data;
};

export const getDistribution = async (groupBy: 'status' | 'type' | 'department') => {
  const res = await apiClient.get('/statistics/distribution', { params: { groupBy } });
  return res.data.data;
};
