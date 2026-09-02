import apiClient from '../../../services/apiClient';

export const generateAlerts = async (threshold: number) => {
  const res = await apiClient.post('/alerts/generate', { threshold });
  return res;
};

export const getAlerts = async (params?: { level?: string; type?: string; status?: string; page?: number; pageSize?: number; sort?: string; direction?: 'asc' | 'desc' }, opts?: { noCache?: boolean }) => {
  const res = await apiClient.get('/alerts', { params, disableCache: !!opts?.noCache });
  return res;
};

export const updateAlertStatus = async (id: string, status: string, user?: string) => {
  const res = await apiClient.put(`/alerts/${id}/status`, { status, user });
  return res;
};

export const deleteAlert = async (id: string) => {
  const res = await apiClient.delete(`/alerts/${id}`);
  return res;
};

export const getAlertStats = async () => {
  const res = await apiClient.get('/alerts/stats');
  return res;
};

export const getAlertHistory = async () => {
  const res = await apiClient.get('/alerts/history');
  return res;
};

export const syncAlertsForInstrument = async (instrumentId: string, threshold?: number) => {
  const res = await apiClient.put(`/alerts/for-instrument/${instrumentId}/sync`, { threshold });
  return res;
};
