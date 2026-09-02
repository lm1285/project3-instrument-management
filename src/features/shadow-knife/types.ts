export interface ShadowKnifeTask {
  id: string;
  department: string;
  customerName?: string;
  orderNo: string;
  startQuantity: number | null;
  endQuantity: number | null;
  status: string;
  currentRunningCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  logStatus: string;
  logNote: string;
  createdBy: string;
  updatedBy: string;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  details?: ShadowKnifeTaskDetail[];
}

export interface ShadowKnifeTaskDetail {
  id: string;
  taskId: string;
  orderNo: string;
  certificateNo: string;
  currentIndex: number;
  itemStatus: string;
  taskStatus: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShadowKnifeTaskPayload {
  department?: string;
  customerName?: string;
  orderNo: string;
  certificateNo?: string;
  startQuantity?: number | null;
  endQuantity?: number | null;
  status: string;
  logNote?: string;
  currentRunningCount?: number;
  completedCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

export interface ShadowKnifeTaskSummary {
  taskCount: number;
  pendingCount: number;
  inProgressCount: number;
  completedStatusCount: number;
  currentRunningCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface ShadowKnifeTaskListResponse {
  rows: ShadowKnifeTask[];
  total: number;
  summary: ShadowKnifeTaskSummary;
}
