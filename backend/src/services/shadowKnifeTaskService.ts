import { v4 as uuidv4 } from 'uuid';
import dbConfig from '../config/dbConfig';

export type ShadowKnifeTaskPayload = {
  department?: string;
  customerName?: string;
  orderNo?: string;
  certificateNo?: string;
  startQuantity?: number | null;
  endQuantity?: number | null;
  status?: string;
  logNote?: string;
  currentRunningCount?: number;
  completedCount?: number;
  failedCount?: number;
  skippedCount?: number;
};

type TaskRecord = {
  id: string;
  department: string;
  customer_name: string;
  order_no: string;
  certificate_no: string | null;
  start_quantity: number | null;
  end_quantity: number | null;
  status: string;
  current_running_count: number | null;
  completed_count: number | null;
  failed_count: number | null;
  skipped_count: number | null;
  log_status: string;
  log_note: string | null;
  created_by: string | null;
  updated_by: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type TaskDetailRecord = {
  id: string;
  task_id: string;
  order_no: string;
  certificate_no: string | null;
  current_index: number;
  item_status: string;
  task_status: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type TaskSummaryRow = {
  task_count: number;
  pending_tasks: number;
  in_progress_tasks: number;
  completed_status_tasks: number;
  current_running_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
};

type WorkbenchTaskInput = Record<string, any>;

type ProgressUpdatePayload = {
  orderNo?: string;
  customerName?: string;
  certificateNo?: string;
  currentIndex?: number;
  currentRunningCount?: number;
  itemStatus?: string;
  status?: string;
  completedCount?: number;
  failedCount?: number;
  skippedCount?: number;
  startQuantity?: number | null;
  endQuantity?: number | null;
};

class ShadowKnifeTaskService {
  private normalizeDepartment(department?: string | null) {
    return String(department || '').trim();
  }

  private normalizeText(value: unknown) {
    return String(value ?? '').trim();
  }

  private toNullableNumber(value: unknown) {
    if (value === '' || value === undefined || value === null) {
      return null;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new Error('数量必须为数字');
    }

    return numeric;
  }

  private toSafeCount(value: unknown, fallback = 0) {
    if (value === '' || value === undefined || value === null) {
      return fallback;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return fallback;
    }

    return Math.max(0, Math.floor(numeric));
  }

  private normalizeStatus(status?: string | null) {
    const normalized = this.normalizeText(status).toLowerCase().replace(/\s+/g, '_');

    if (!normalized) return 'pending';
    if (['running', 'processing', 'in_progress', 'in-progress'].includes(normalized)) return 'in_progress';
    if (['completed', 'complete', 'done', 'success'].includes(normalized)) return 'completed';
    if (['failed', 'error'].includes(normalized)) return 'failed';
    if (['skipped', 'skip'].includes(normalized)) return 'skipped';
    if (['pending', 'todo', 'wait', 'waiting'].includes(normalized)) return 'pending';

    return normalized;
  }

  private deriveCounterFields(
    status: string,
    payload: Pick<ShadowKnifeTaskPayload, 'currentRunningCount' | 'completedCount' | 'failedCount' | 'skippedCount'>,
  ) {
    return {
      currentRunningCount: payload.currentRunningCount !== undefined
        ? this.toSafeCount(payload.currentRunningCount)
        : status === 'in_progress'
          ? 1
          : 0,
      completedCount: payload.completedCount !== undefined
        ? this.toSafeCount(payload.completedCount)
        : status === 'completed'
          ? 1
          : 0,
      failedCount: payload.failedCount !== undefined
        ? this.toSafeCount(payload.failedCount)
        : status === 'failed'
          ? 1
          : 0,
      skippedCount: payload.skippedCount !== undefined
        ? this.toSafeCount(payload.skippedCount)
        : status === 'skipped'
          ? 1
          : 0,
    };
  }

  private formatRecord(record: TaskRecord) {
    return {
      id: record.id,
      department: record.department,
      customerName: record.customer_name,
      orderNo: record.order_no,
      certificateNo: record.certificate_no || '',
      startQuantity: record.start_quantity,
      endQuantity: record.end_quantity,
      status: record.status,
      currentRunningCount: this.toSafeCount(record.current_running_count),
      completedCount: this.toSafeCount(record.completed_count),
      failedCount: this.toSafeCount(record.failed_count),
      skippedCount: this.toSafeCount(record.skipped_count),
      logStatus: record.log_status,
      logNote: record.log_note || '',
      createdBy: record.created_by || '',
      updatedBy: record.updated_by || '',
      lastSyncedAt: record.last_synced_at || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private formatDetailRecord(record: TaskDetailRecord) {
    return {
      id: record.id,
      taskId: record.task_id,
      orderNo: record.order_no,
      certificateNo: record.certificate_no || '',
      currentIndex: this.toSafeCount(record.current_index),
      itemStatus: record.item_status,
      taskStatus: record.task_status,
      createdBy: record.created_by || '',
      updatedBy: record.updated_by || '',
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private sanitizePayload(payload: ShadowKnifeTaskPayload, fallbackDepartment = '') {
    const department = this.normalizeDepartment(payload.department || fallbackDepartment);
    const customerName = this.normalizeText(payload.customerName);
    const orderNo = this.normalizeText(payload.orderNo);
    const certificateNo = this.normalizeText(payload.certificateNo);
    const status = this.normalizeStatus(payload.status);
    const logNote = this.normalizeText(payload.logNote);

    if (!department) {
      throw new Error('所属科室不能为空');
    }
    if (!orderNo) {
      throw new Error('单号不能为空');
    }

    const counters = this.deriveCounterFields(status, payload);

    return {
      department,
      customerName,
      orderNo,
      certificateNo,
      startQuantity: this.toNullableNumber(payload.startQuantity),
      endQuantity: this.toNullableNumber(payload.endQuantity),
      status,
      ...counters,
      logNote,
    };
  }

  private buildListFilters(params: {
    search?: string;
    department?: string;
    includeAllDepartments?: boolean;
  }) {
    const search = this.normalizeText(params.search);
    const department = this.normalizeDepartment(params.department);
    const includeAllDepartments = Boolean(params.includeAllDepartments);
    let whereClause = 'WHERE 1 = 1';
    const queryParams: any[] = [];

    if (!includeAllDepartments) {
      if (!department) {
        return { whereClause, queryParams, shouldReturnEmpty: true };
      }

      whereClause += ' AND department = ?';
      queryParams.push(department);
    } else if (department) {
      whereClause += ' AND department = ?';
      queryParams.push(department);
    }

    if (search) {
      whereClause += `
        AND (
          customer_name LIKE ?
          OR order_no LIKE ?
          OR department LIKE ?
          OR status LIKE ?
        )
      `;
      const fuzzy = `%${search}%`;
      queryParams.push(fuzzy, fuzzy, fuzzy, fuzzy);
    }

    return { whereClause, queryParams, shouldReturnEmpty: false };
  }

  private formatSummaryRow(row?: TaskSummaryRow) {
    return {
      taskCount: this.toSafeCount(row?.task_count),
      pendingCount: this.toSafeCount(row?.pending_tasks),
      inProgressCount: this.toSafeCount(row?.in_progress_tasks),
      completedStatusCount: this.toSafeCount(row?.completed_status_tasks),
      currentRunningCount: this.toSafeCount(row?.current_running_count),
      completedCount: this.toSafeCount(row?.completed_count),
      failedCount: this.toSafeCount(row?.failed_count),
      skippedCount: this.toSafeCount(row?.skipped_count),
    };
  }

  private pickFirstValue(source: Record<string, any>, keys: string[]) {
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null && `${value}`.trim() !== '') {
        return value;
      }
    }
    return undefined;
  }

  private normalizeWorkbenchTask(task: WorkbenchTaskInput, defaultDepartment = ''): ShadowKnifeTaskPayload {
    return {
      department: this.normalizeDepartment(
        this.pickFirstValue(task, ['department', 'departmentName', 'department_name']) ?? defaultDepartment,
      ),
      customerName: this.normalizeText(
        this.pickFirstValue(task, ['name', 'customerName', 'customer_name', 'customer', 'companyName', 'company']),
      ),
      orderNo: this.normalizeText(
        this.pickFirstValue(task, ['order_no', 'orderNo', 'billNo', 'bizNo', 'serialNo', 'code', 'taskNo']),
      ),
      certificateNo: this.normalizeText(
        this.pickFirstValue(task, ['certificate_no', 'certificateNo', 'certificate_number', 'certificateNumber']),
      ),
      startQuantity: this.toNullableNumber(
        this.pickFirstValue(task, ['start_qty', 'startQty', 'startQuantity', 'startNo', 'beginQty']),
      ),
      endQuantity: this.toNullableNumber(
        this.pickFirstValue(task, ['end_qty', 'endQty', 'endQuantity', 'endNo', 'finishQty']),
      ),
      status: this.normalizeStatus(this.pickFirstValue(task, ['status', 'taskStatus', 'workStatus', 'state']) as string | undefined),
      currentRunningCount: this.pickFirstValue(task, ['current_running_count', 'currentRunningCount', 'running_count', 'runningCount']) as number | undefined,
      completedCount: this.pickFirstValue(task, ['completed_count', 'completedCount']) as number | undefined,
      failedCount: this.pickFirstValue(task, ['failed_count', 'failedCount']) as number | undefined,
      skippedCount: this.pickFirstValue(task, ['skipped_count', 'skippedCount']) as number | undefined,
      logNote: this.normalizeText(this.pickFirstValue(task, ['logNote', 'note', 'remark', 'remarks'])),
    };
  }

  private async findExistingTask(match: {
    id?: string;
    department?: string;
    orderNo?: string;
    customerName?: string;
  }) {
    const db = dbConfig.getConnection();
    const id = this.normalizeText(match.id);
    const department = this.normalizeDepartment(match.department);
    const orderNo = this.normalizeText(match.orderNo);
    const customerName = this.normalizeText(match.customerName);

    if (id) {
      return db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);
    }

    if (orderNo && department) {
      return db.get<TaskRecord>(
        'SELECT * FROM shadow_knife_tasks WHERE order_no = ? AND department = ? ORDER BY updated_at DESC LIMIT 1',
        [orderNo, department],
      );
    }

    if (orderNo) {
      return db.get<TaskRecord>(
        'SELECT * FROM shadow_knife_tasks WHERE order_no = ? ORDER BY updated_at DESC LIMIT 1',
        [orderNo],
      );
    }

    if (customerName && department) {
      return db.get<TaskRecord>(
        'SELECT * FROM shadow_knife_tasks WHERE customer_name = ? AND department = ? ORDER BY updated_at DESC LIMIT 1',
        [customerName, department],
      );
    }

    return undefined;
  }

  private async listTaskDetails(taskIds: string[]) {
    const ids = Array.from(new Set(taskIds.filter(Boolean)));
    if (ids.length === 0) {
      return new Map<string, ReturnType<typeof this.formatDetailRecord>[]>();
    }

    const db = dbConfig.getConnection();
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await db.all<TaskDetailRecord[]>(
      `
        SELECT *
        FROM shadow_knife_task_details
        WHERE task_id IN (${placeholders})
        ORDER BY current_index ASC, updated_at DESC
      `,
      ids,
    );

    const map = new Map<string, ReturnType<typeof this.formatDetailRecord>[]>();
    for (const row of rows || []) {
      const list = map.get(row.task_id) || [];
      list.push(this.formatDetailRecord(row));
      map.set(row.task_id, list);
    }
    return map;
  }

  private async upsertProgressDetail(task: TaskRecord, payload: ProgressUpdatePayload, operator: string, now: string) {
    const db = dbConfig.getConnection();
    const currentIndex = this.toSafeCount(payload.currentIndex);
    const itemStatus = this.normalizeStatus(payload.itemStatus || payload.status || 'processing');
    const taskStatus = this.normalizeStatus(payload.status || 'processing');
    const certificateNo = this.normalizeText(payload.certificateNo);

    const existing = await db.get<TaskDetailRecord>(
      'SELECT * FROM shadow_knife_task_details WHERE task_id = ? AND current_index = ? ORDER BY updated_at DESC LIMIT 1',
      [task.id, currentIndex],
    );

    if (existing) {
      await db.run(
        `
          UPDATE shadow_knife_task_details
          SET order_no = ?,
              certificate_no = ?,
              item_status = ?,
              task_status = ?,
              updated_by = ?,
              updated_at = ?
          WHERE id = ?
        `,
        [
          task.order_no,
          certificateNo || null,
          itemStatus,
          taskStatus,
          operator || null,
          now,
          existing.id,
        ],
      );

      const record = await db.get<TaskDetailRecord>('SELECT * FROM shadow_knife_task_details WHERE id = ?', [existing.id]);
      return record ? this.formatDetailRecord(record) : null;
    }

    const id = uuidv4();
    await db.run(
      `
        INSERT INTO shadow_knife_task_details (
          id, task_id, order_no, certificate_no, current_index, item_status, task_status,
          created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        task.id,
        task.order_no,
        certificateNo || null,
        currentIndex,
        itemStatus,
        taskStatus,
        operator || null,
        operator || null,
        now,
        now,
      ],
    );

    const record = await db.get<TaskDetailRecord>('SELECT * FROM shadow_knife_task_details WHERE id = ?', [id]);
    return record ? this.formatDetailRecord(record) : null;
  }

  async listTasks(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    department?: string;
    includeAllDepartments?: boolean;
  }) {
    const db = dbConfig.getConnection();
    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const offset = (page - 1) * pageSize;
    const { whereClause, queryParams, shouldReturnEmpty } = this.buildListFilters(params);

    if (shouldReturnEmpty) {
      return {
        total: 0,
        rows: [] as ReturnType<typeof this.formatRecord>[],
        summary: this.formatSummaryRow(),
      };
    }

    const totalRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM shadow_knife_tasks ${whereClause}`,
      queryParams,
    );

    const summaryRow = await db.get<TaskSummaryRow>(
      `
        SELECT
          COUNT(*) AS task_count,
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_tasks,
          COALESCE(SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END), 0) AS in_progress_tasks,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_status_tasks,
          COALESCE(SUM(current_running_count), 0) AS current_running_count,
          COALESCE(SUM(completed_count), 0) AS completed_count,
          COALESCE(SUM(failed_count), 0) AS failed_count,
          COALESCE(SUM(skipped_count), 0) AS skipped_count
        FROM shadow_knife_tasks
        ${whereClause}
      `,
      queryParams,
    );

    const rows = await db.all<TaskRecord[]>(
      `
        SELECT *
        FROM shadow_knife_tasks
        ${whereClause}
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...queryParams, pageSize, offset],
    );

    const formattedRows = (rows || []).map((row) => this.formatRecord(row));
    const detailMap = await this.listTaskDetails(formattedRows.map((row) => row.id));

    return {
      total: totalRow?.count || 0,
      rows: formattedRows.map((row) => ({
        ...row,
        details: detailMap.get(row.id) || [],
      })),
      summary: this.formatSummaryRow(summaryRow),
    };
  }

  async createTask(payload: ShadowKnifeTaskPayload, operator = '', fallbackDepartment = '') {
    const db = dbConfig.getConnection();
    const sanitized = this.sanitizePayload(payload, fallbackDepartment);
    const now = new Date().toISOString();
    const id = uuidv4();

    await db.run(
      `
        INSERT INTO shadow_knife_tasks (
          id, department, customer_name, order_no, certificate_no, start_quantity, end_quantity,
          status, current_running_count, completed_count, failed_count, skipped_count,
          log_status, log_note, created_by, updated_by, last_synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        sanitized.department,
        sanitized.customerName,
        sanitized.orderNo,
        sanitized.certificateNo || null,
        sanitized.startQuantity,
        sanitized.endQuantity,
        sanitized.status,
        sanitized.currentRunningCount,
        sanitized.completedCount,
        sanitized.failedCount,
        sanitized.skippedCount,
        'manual',
        sanitized.logNote || null,
        operator || null,
        operator || null,
        null,
        now,
        now,
      ],
    );

    const record = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);
    return this.formatRecord(record as TaskRecord);
  }

  async updateTask(id: string, payload: ShadowKnifeTaskPayload, operator = '', fallbackDepartment = '') {
    const db = dbConfig.getConnection();
    const existing = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);

    if (!existing) {
      throw new Error('未找到待办任务');
    }

    const scopedDepartment = this.normalizeDepartment(fallbackDepartment);
    if (scopedDepartment && existing.department !== scopedDepartment) {
      throw new Error('无权编辑其他科室的任务');
    }

    const sanitized = this.sanitizePayload(
      {
        department: payload.department ?? existing.department,
        customerName: payload.customerName ?? existing.customer_name,
        orderNo: payload.orderNo ?? existing.order_no,
        certificateNo: payload.certificateNo ?? existing.certificate_no ?? '',
        startQuantity: payload.startQuantity ?? existing.start_quantity ?? undefined,
        endQuantity: payload.endQuantity ?? existing.end_quantity ?? undefined,
        status: payload.status ?? existing.status,
        currentRunningCount: payload.currentRunningCount ?? (payload.status ? undefined : existing.current_running_count ?? undefined),
        completedCount: payload.completedCount ?? (payload.status ? undefined : existing.completed_count ?? undefined),
        failedCount: payload.failedCount ?? (payload.status ? undefined : existing.failed_count ?? undefined),
        skippedCount: payload.skippedCount ?? (payload.status ? undefined : existing.skipped_count ?? undefined),
        logNote: payload.logNote ?? existing.log_note ?? '',
      },
      fallbackDepartment,
    );

    const now = new Date().toISOString();

    await db.run(
      `
        UPDATE shadow_knife_tasks
        SET department = ?,
            customer_name = ?,
            order_no = ?,
            certificate_no = ?,
            start_quantity = ?,
            end_quantity = ?,
            status = ?,
            current_running_count = ?,
            completed_count = ?,
            failed_count = ?,
            skipped_count = ?,
            log_note = ?,
            updated_by = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        sanitized.department,
        sanitized.customerName,
        sanitized.orderNo,
        sanitized.certificateNo || null,
        sanitized.startQuantity,
        sanitized.endQuantity,
        sanitized.status,
        sanitized.currentRunningCount,
        sanitized.completedCount,
        sanitized.failedCount,
        sanitized.skippedCount,
        sanitized.logNote || null,
        operator || null,
        now,
        id,
      ],
    );

    const record = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);
    return this.formatRecord(record as TaskRecord);
  }

  async deleteTask(id: string, department?: string, includeAllDepartments?: boolean) {
    const db = dbConfig.getConnection();
    const task = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);

    if (!task) {
      throw new Error('未找到待办任务');
    }

    const scopedDepartment = this.normalizeDepartment(department);
    if (!includeAllDepartments && scopedDepartment && task.department !== scopedDepartment) {
      throw new Error('无权删除其他科室的任务');
    }

    await db.run('DELETE FROM shadow_knife_tasks WHERE id = ?', [id]);
    await db.run('DELETE FROM shadow_knife_task_details WHERE task_id = ?', [id]);
    return { id };
  }

  async syncProgressUpdate(payload: Record<string, any>, operator = 'shadow-knife-webhook') {
    const db = dbConfig.getConnection();
    const now = new Date().toISOString();
    const progress = (payload?.progress_update || payload?.progressUpdate || payload || {}) as ProgressUpdatePayload;
    const defaultDepartment = this.normalizeDepartment(payload?.department || payload?.departmentName);
    const orderNo = this.normalizeText(progress.orderNo);
    const customerName = this.normalizeText(progress.customerName);

    if (!orderNo) {
      throw new Error('杩涘害鍚屾缂哄皯鍗曞彿 orderNo');
    }

    const existing = await this.findExistingTask({
      department: defaultDepartment,
      orderNo,
      customerName,
    });

    if (!existing) {
      throw new Error(`鏈壘鍒板崟鍙蜂负 ${orderNo} 鐨勮仈鐢ㄤ换鍔?`);
    }

    const mergedPayload: ShadowKnifeTaskPayload = {
      department: existing.department,
      customerName: customerName || existing.customer_name,
      orderNo: existing.order_no,
      certificateNo: this.normalizeText(progress.certificateNo) || existing.certificate_no || '',
      startQuantity: progress.startQuantity ?? existing.start_quantity ?? undefined,
      endQuantity: progress.endQuantity ?? existing.end_quantity ?? undefined,
      status: progress.status || 'processing',
      currentRunningCount: progress.currentRunningCount,
      completedCount: progress.completedCount,
      failedCount: progress.failedCount,
      skippedCount: progress.skippedCount,
      logNote: existing.log_note || '',
    };

    const sanitized = this.sanitizePayload(mergedPayload, existing.department);

    await db.run(
      `
        UPDATE shadow_knife_tasks
        SET customer_name = ?,
            certificate_no = ?,
            start_quantity = ?,
            end_quantity = ?,
            status = ?,
            current_running_count = ?,
            completed_count = ?,
            failed_count = ?,
            skipped_count = ?,
            log_status = ?,
            updated_by = ?,
            last_synced_at = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        sanitized.customerName,
        sanitized.certificateNo || null,
        sanitized.startQuantity,
        sanitized.endQuantity,
        sanitized.status,
        sanitized.currentRunningCount,
        sanitized.completedCount,
        sanitized.failedCount,
        sanitized.skippedCount,
        'synced',
        operator,
        now,
        now,
        existing.id,
      ],
    );

    const refreshed = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [existing.id]);
    if (!refreshed) {
      throw new Error('Failed to reload shadow knife task after progress sync');
    }

    const detail = await this.upsertProgressDetail(refreshed, progress, operator, now);

    return {
      task: {
        ...this.formatRecord(refreshed),
        details: detail ? [detail] : [],
      },
      detail,
    };
  }

  async syncWorkbenchPayload(payload: Record<string, any>, operator = 'shadow-knife-webhook') {
    const syncMode = this.normalizeText(payload?.mode).toLowerCase();
    if (syncMode === 'progress_update') {
      return this.syncProgressUpdate(payload, operator);
    }

    const db = dbConfig.getConnection();
    const now = new Date().toISOString();
    const rootPayload = (payload?.workbench_result || payload?.result || payload || {}) as Record<string, any>;
    const defaultDepartment = this.normalizeDepartment(
      payload?.department || payload?.departmentName || rootPayload?.department || rootPayload?.departmentName,
    );
    const taskInputs = Array.isArray(rootPayload?.tasks)
      ? rootPayload.tasks
      : Array.isArray(payload?.tasks)
        ? payload.tasks
        : [];

    const syncedRows: ReturnType<typeof this.formatRecord>[] = [];
    const skipped: Array<{ orderNo: string; customerName: string; reason: string }> = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const taskInput of taskInputs) {
      if (!taskInput || typeof taskInput !== 'object') {
        continue;
      }

      const normalizedTask = this.normalizeWorkbenchTask(taskInput as WorkbenchTaskInput, defaultDepartment);
      const existing = await this.findExistingTask({
        id: this.normalizeText((taskInput as Record<string, any>).id),
        department: normalizedTask.department,
        orderNo: normalizedTask.orderNo,
        customerName: normalizedTask.customerName,
      });

      if (!existing && (!normalizedTask.department || !normalizedTask.orderNo)) {
        skipped.push({
          orderNo: normalizedTask.orderNo || '',
          customerName: normalizedTask.customerName || '',
          reason: '缺少部门或单号，无法同步到任务台',
        });
        continue;
      }

      const mergedPayload: ShadowKnifeTaskPayload = existing
          ? {
            department: normalizedTask.department || existing.department,
            customerName: normalizedTask.customerName || existing.customer_name,
            orderNo: normalizedTask.orderNo || existing.order_no,
            certificateNo: normalizedTask.certificateNo || existing.certificate_no || '',
            startQuantity: normalizedTask.startQuantity ?? existing.start_quantity ?? undefined,
            endQuantity: normalizedTask.endQuantity ?? existing.end_quantity ?? undefined,
            status: normalizedTask.status || existing.status,
            currentRunningCount: normalizedTask.currentRunningCount,
            completedCount: normalizedTask.completedCount,
            failedCount: normalizedTask.failedCount,
            skippedCount: normalizedTask.skippedCount,
            logNote: normalizedTask.logNote || existing.log_note || '',
          }
        : normalizedTask;

      const sanitized = this.sanitizePayload(mergedPayload, existing?.department || defaultDepartment);

      if (existing) {
        await db.run(
          `
            UPDATE shadow_knife_tasks
            SET department = ?,
                customer_name = ?,
                order_no = ?,
                certificate_no = ?,
                start_quantity = ?,
                end_quantity = ?,
                status = ?,
                current_running_count = ?,
                completed_count = ?,
                failed_count = ?,
                skipped_count = ?,
                log_status = ?,
                log_note = ?,
                updated_by = ?,
                last_synced_at = ?,
                updated_at = ?
            WHERE id = ?
          `,
          [
            sanitized.department,
            sanitized.customerName,
            sanitized.orderNo,
            sanitized.certificateNo || null,
            sanitized.startQuantity,
            sanitized.endQuantity,
            sanitized.status,
            sanitized.currentRunningCount,
            sanitized.completedCount,
            sanitized.failedCount,
            sanitized.skippedCount,
            'synced',
            sanitized.logNote || null,
            operator,
            now,
            now,
            existing.id,
          ],
        );

        const record = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [existing.id]);
        if (record) {
          syncedRows.push(this.formatRecord(record));
        }
        updatedCount += 1;
        continue;
      }

      const id = uuidv4();
      await db.run(
        `
          INSERT INTO shadow_knife_tasks (
            id, department, customer_name, order_no, certificate_no, start_quantity, end_quantity,
            status, current_running_count, completed_count, failed_count, skipped_count,
            log_status, log_note, created_by, updated_by, last_synced_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          sanitized.department,
          sanitized.customerName,
          sanitized.orderNo,
          sanitized.certificateNo || null,
          sanitized.startQuantity,
          sanitized.endQuantity,
          sanitized.status,
          sanitized.currentRunningCount,
          sanitized.completedCount,
          sanitized.failedCount,
          sanitized.skippedCount,
          'synced',
          sanitized.logNote || null,
          operator,
          operator,
          now,
          now,
          now,
        ],
      );

      const record = await db.get<TaskRecord>('SELECT * FROM shadow_knife_tasks WHERE id = ?', [id]);
      if (record) {
        syncedRows.push(this.formatRecord(record));
      }
      createdCount += 1;
    }

    return {
      receivedTaskCount: taskInputs.length,
      syncedCount: syncedRows.length,
      createdCount,
      updatedCount,
      skippedCount: skipped.length,
      counts: {
        currentRunningCount: this.toSafeCount(rootPayload?.current_running_count ?? rootPayload?.running_count),
        completedCount: this.toSafeCount(rootPayload?.completed_count),
        failedCount: this.toSafeCount(rootPayload?.failed_count),
        skippedCount: this.toSafeCount(rootPayload?.skipped_count),
      },
      rows: syncedRows,
      skipped,
    };
  }
}

export default new ShadowKnifeTaskService();
