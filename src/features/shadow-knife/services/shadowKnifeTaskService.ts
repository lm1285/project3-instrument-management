import apiClient from '../../../services/apiClient';
import type { ShadowKnifeTask, ShadowKnifeTaskListResponse, ShadowKnifeTaskPayload } from '../types';

const BASE_PATH = '/shadow-knife-linkage';

export async function fetchShadowKnifeTasks(params: {
  page: number;
  pageSize: number;
  search?: string;
  department?: string;
}) {
  const response = await apiClient.get<ShadowKnifeTaskListResponse>(`${BASE_PATH}/tasks`, {
    params,
    disableCache: true,
  });

  return response.data || {
    rows: [] as ShadowKnifeTask[],
    total: 0,
    summary: {
      taskCount: 0,
      pendingCount: 0,
      inProgressCount: 0,
      completedStatusCount: 0,
      currentRunningCount: 0,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
    },
  };
}

export async function createShadowKnifeTask(payload: ShadowKnifeTaskPayload) {
  const response = await apiClient.post<ShadowKnifeTask>(`${BASE_PATH}/tasks`, payload);
  return response.data as ShadowKnifeTask;
}

export async function updateShadowKnifeTask(id: string, payload: Partial<ShadowKnifeTaskPayload>) {
  const response = await apiClient.put<ShadowKnifeTask>(`${BASE_PATH}/tasks/${id}`, payload);
  return response.data as ShadowKnifeTask;
}

export async function deleteShadowKnifeTask(id: string) {
  await apiClient.delete(`${BASE_PATH}/tasks/${id}`);
}
