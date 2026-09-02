import apiClient from '../../../services/apiClient';
import type { LengthShadowQueryResult, LengthShadowRule, LengthShadowRulePayload } from '../types';

const BASE_PATH = '/length-shadow-linkage';

export async function fetchLengthShadowRules(params: { page: number; pageSize: number; search?: string }) {
  const response = await apiClient.get<{
    rows: LengthShadowRule[];
    total: number;
  }>(`${BASE_PATH}/rules`, {
    params,
    disableCache: true,
  });

  return response.data || { rows: [], total: 0 };
}

export async function createLengthShadowRule(payload: LengthShadowRulePayload) {
  const response = await apiClient.post<LengthShadowRule>(`${BASE_PATH}/rules`, payload);
  return response.data as LengthShadowRule;
}

export async function updateLengthShadowRule(id: string, payload: LengthShadowRulePayload) {
  const response = await apiClient.put<LengthShadowRule>(`${BASE_PATH}/rules/${id}`, payload);
  return response.data as LengthShadowRule;
}

export async function deleteLengthShadowRule(id: string) {
  await apiClient.delete(`${BASE_PATH}/rules/${id}`);
}

export async function bulkDeleteLengthShadowRules(ids: string[]) {
  const response = await apiClient.post<{ count: number }>(`${BASE_PATH}/rules/bulk-delete`, { ids });
  return response.data || { count: 0 };
}

export async function bulkImportLengthShadowRules(items: LengthShadowRulePayload[]) {
  const response = await apiClient.post<{
    successCount: number;
    failureCount: number;
    errors: Array<{ index: number; message: string }>;
  }>(`${BASE_PATH}/rules/bulk-import`, { items });
  return response.data || { successCount: 0, failureCount: 0, errors: [] };
}

export async function queryLengthShadowRules(payload: {
  department?: string;
  instrumentName: string;
  modelSpec?: string;
  templateCode?: string;
  procedureCode?: string;
  elementText?: string;
}) {
  const response = await apiClient.post<LengthShadowQueryResult>(`${BASE_PATH}/query`, payload);
  return response.data as LengthShadowQueryResult;
}
