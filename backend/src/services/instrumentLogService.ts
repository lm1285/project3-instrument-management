import dbConfig from '../config/dbConfig';
import type { Instrument } from '../types/instrument';

type FlowRecordRow = {
  id: string;
  instrumentId: string;
  instrumentName: string;
  instrumentManagementNumber?: string | null;
  action: string;
  operator: string;
  details?: string | Record<string, unknown> | null;
  timestamp: string;
  usageAmount?: number | null;
};

type InstrumentLogFilter = {
  limit?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
  actionType?: string;
};

type ChangeItem = {
  field: string;
  label: string;
  before: string;
  after: string;
};

const TRACKED_FIELDS: Array<{ key: keyof Instrument | string; label: string }> = [
  { key: 'type', label: '仪器类型' },
  { key: 'name', label: '仪器名称' },
  { key: 'model', label: '型号规格' },
  { key: 'managementNumber', label: '管理编号' },
  { key: 'serialNumber', label: '出厂编号' },
  { key: 'manufacturer', label: '生产厂家' },
  { key: 'measureRange', label: '测量范围' },
  { key: 'uncertainty', label: '测量不确定度' },
  { key: 'metrologicalParameterRange', label: '计量参数范围' },
  { key: 'calibrationDate', label: '校准日期' },
  { key: 'nextCalibrationDate', label: '复校日期' },
  { key: 'calibrationCycle', label: '校准周期' },
  { key: 'calibrationInstitution', label: '溯源机构' },
  { key: 'certificateNumber', label: '溯源证书编号' },
  { key: 'department', label: '科室' },
  { key: 'location', label: '存放位置' },
  { key: 'status', label: '仪器状态' },
  { key: 'inOutStatus', label: '出入库状态' },
  { key: 'initialCapacity', label: '初始容量' },
  { key: 'currentCapacity', label: '当前容量' },
  { key: 'unit', label: '单位' },
  { key: 'groupName', label: '合并组名称' },
  { key: 'groupModel', label: '合并组型号规格' },
  { key: 'groupMeasureRange', label: '合并组测量范围' },
  { key: 'purchaseDate', label: '采购日期' },
  { key: 'acceptanceDate', label: '验收日期' },
  { key: 'purchasePerson', label: '采购负责人' },
  { key: 'enableDate', label: '启用日期' },
  { key: 'remarks', label: '备注' },
];

const ACTION_META: Record<
  string,
  { type: string; label: string; category: string; source: string }
> = {
  create: { type: 'create', label: '创建', category: 'lifecycle', source: 'instrument.form' },
  创建: { type: 'create', label: '创建', category: 'lifecycle', source: 'instrument.form' },
  update: { type: 'update', label: '编辑', category: 'change', source: 'instrument.form' },
  编辑: { type: 'update', label: '编辑', category: 'change', source: 'instrument.form' },
  delete: { type: 'delete', label: '删除', category: 'lifecycle', source: 'instrument.form' },
  删除: { type: 'delete', label: '删除', category: 'lifecycle', source: 'instrument.form' },
  checkin: { type: 'checkin', label: '入库', category: 'flow', source: 'instrument.flow' },
  入库: { type: 'checkin', label: '入库', category: 'flow', source: 'instrument.flow' },
  checkout: { type: 'checkout', label: '出库', category: 'flow', source: 'instrument.flow' },
  出库: { type: 'checkout', label: '出库', category: 'flow', source: 'instrument.flow' },
  use: { type: 'use', label: '使用', category: 'flow', source: 'instrument.flow' },
  使用: { type: 'use', label: '使用', category: 'flow', source: 'instrument.flow' },
  maintenance: { type: 'maintenance', label: '维修', category: 'service', source: 'manual.log' },
  维修: { type: 'maintenance', label: '维修', category: 'service', source: 'manual.log' },
  保养: { type: 'maintenance', label: '保养', category: 'service', source: 'manual.log' },
  calibration: { type: 'calibration', label: '校准', category: 'service', source: 'manual.log' },
  校准: { type: 'calibration', label: '校准', category: 'service', source: 'manual.log' },
  故障: { type: 'issue', label: '故障', category: 'service', source: 'manual.log' },
  备注: { type: 'note', label: '备注', category: 'note', source: 'manual.log' },
  其他: { type: 'other', label: '其他', category: 'other', source: 'manual.log' },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeJsonParse = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (isPlainObject(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).join('、');
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '-';
  }

  if (isPlainObject(value)) {
    return JSON.stringify(value);
  }

  return String(value);
};

const createInstrumentSnapshot = (instrument?: Partial<Instrument> | null) => {
  if (!instrument) {
    return null;
  }

  return {
    type: stringifyValue(instrument.type),
    name: stringifyValue(instrument.name),
    model: stringifyValue(instrument.model),
    managementNumber: stringifyValue(instrument.managementNumber),
    serialNumber: stringifyValue((instrument as any).serialNumber),
    department: stringifyValue((instrument as any).department),
    location: stringifyValue((instrument as any).location),
    status: stringifyValue((instrument as any).status),
    inOutStatus: stringifyValue((instrument as any).inOutStatus),
  };
};

const buildChangeItems = (
  before?: Partial<Instrument> | null,
  after?: Partial<Instrument> | null,
): ChangeItem[] => {
  return TRACKED_FIELDS.reduce<ChangeItem[]>((result, field) => {
    const beforeValue = stringifyValue(before ? (before as any)[field.key] : undefined);
    const afterValue = stringifyValue(after ? (after as any)[field.key] : undefined);
    if (beforeValue === afterValue) {
      return result;
    }

    result.push({
      field: String(field.key),
      label: field.label,
      before: beforeValue,
      after: afterValue,
    });
    return result;
  }, []);
};

const inferActionMeta = (action: string, details: Record<string, unknown>) => {
  const sourceAction = typeof details.actionType === 'string' ? details.actionType : action;
  return (
    ACTION_META[sourceAction] ||
    ACTION_META[action] || {
      type: sourceAction,
      label: sourceAction,
      category: 'other',
      source: typeof details.source === 'string' ? details.source : 'instrument.flow',
    }
  );
};

const buildSummary = (
  actionType: string,
  actionLabel: string,
  details: Record<string, unknown>,
  changeItems: ChangeItem[],
  record: FlowRecordRow,
) => {
  if (typeof details.summary === 'string' && details.summary.trim()) {
    return details.summary.trim();
  }

  const instrumentName = record.instrumentName || '仪器';
  const managementNumber = record.instrumentManagementNumber
    ? `（${record.instrumentManagementNumber}）`
    : '';

  if (actionType === 'create') {
    return `创建仪器 ${instrumentName}${managementNumber}`;
  }

  if (actionType === 'update') {
    if (changeItems.length > 0) {
      return `编辑仪器信息，更新 ${changeItems.length} 项字段`;
    }
    return `编辑仪器信息`;
  }

  if (actionType === 'delete') {
    return `删除仪器 ${instrumentName}${managementNumber}`;
  }

  if (actionType === 'checkout') {
    const purpose = stringifyValue(details.purpose);
    return purpose !== '-'
      ? `仪器出库，用途：${purpose}`
      : `仪器出库`;
  }

  if (actionType === 'checkin') {
    if (details.isConsumed === true) {
      return '仪器入库并登记已使用完';
    }

    const capacityPercent = stringifyValue(details.capacityPercent);
    if (capacityPercent !== '-') {
      return `仪器入库，剩余容量 ${capacityPercent}%`;
    }
    return '仪器入库';
  }

  if (actionType === 'use') {
    const purpose = stringifyValue(details.purpose);
    return purpose !== '-' ? `登记仪器使用，用途：${purpose}` : '登记仪器使用';
  }

  return `${actionLabel}记录`;
};

const buildFacts = (details: Record<string, unknown>) => {
  const candidates: Array<{ key: string; label: string }> = [
    { key: 'department', label: '科室' },
    { key: 'location', label: '位置' },
    { key: 'purpose', label: '用途' },
    { key: 'borrower', label: '借用人' },
    { key: 'expectedReturnTime', label: '预计归还时间' },
    { key: 'condition', label: '状态说明' },
    { key: 'usageTime', label: '使用时长' },
    { key: 'capacityPercent', label: '剩余容量(%)' },
    { key: 'capacityValue', label: '当前容量' },
    { key: 'unit', label: '单位' },
    { key: 'manualDate', label: '登记时间' },
  ];

  return candidates
    .map((candidate) => ({
      key: candidate.key,
      label: candidate.label,
      value: stringifyValue(details[candidate.key]),
    }))
    .filter((item) => item.value !== '-');
};

export const createStructuredInstrumentLogDetails = (params: {
  action: string;
  before?: Partial<Instrument> | null;
  after?: Partial<Instrument> | null;
  operator?: string;
  notes?: string;
  source?: string;
  extra?: Record<string, unknown>;
}) => {
  const { action, before, after, notes, source, extra } = params;
  const meta = inferActionMeta(action, extra || {});
  const changes = buildChangeItems(before, after);

  return {
    source: source || meta.source,
    actionType: meta.type,
    category: meta.category,
    notes: notes || (typeof extra?.notes === 'string' ? extra.notes : ''),
    changes,
    beforeSnapshot: createInstrumentSnapshot(before),
    afterSnapshot: createInstrumentSnapshot(after),
    ...extra,
  };
};

class InstrumentLogService {
  async getInstrumentLogs(instrumentId: string, filter: InstrumentLogFilter = {}) {
    const db = dbConfig.getConnection();
    const whereParts = ['instrumentId = ?'];
    const params: unknown[] = [instrumentId];

    if (filter.startDate) {
      whereParts.push('timestamp >= ?');
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      whereParts.push('timestamp <= ?');
      params.push(filter.endDate);
    }

    const rows = (await db.all(
      `
        SELECT id, instrumentId, instrumentName, instrumentManagementNumber, action, operator, details, timestamp, usageAmount
        FROM flow_records
        WHERE ${whereParts.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT ?
      `,
      [...params, filter.limit || 200],
    )) as FlowRecordRow[];

    let logs = rows.map((row) => {
      const details = safeJsonParse(row.details);
      const meta = inferActionMeta(row.action, details);
      const changeItems = Array.isArray(details.changes)
        ? (details.changes as ChangeItem[]).map((change) => ({
            field: String(change.field || ''),
            label: String(change.label || change.field || ''),
            before: stringifyValue(change.before),
            after: stringifyValue(change.after),
          }))
        : [];

      const notes = typeof details.notes === 'string' ? details.notes.trim() : '';
      const facts = buildFacts(details);
      const summary = buildSummary(meta.type, meta.label, details, changeItems, row);

      return {
        id: row.id,
        instrumentId: row.instrumentId,
        timestamp: row.timestamp,
        actionType: meta.type,
        actionLabel: meta.label,
        category: meta.category,
        source: typeof details.source === 'string' ? details.source : meta.source,
        operator: row.operator || '系统',
        summary,
        notes,
        changes: changeItems,
        facts,
        usageAmount: row.usageAmount ?? null,
        rawAction: row.action,
        instrumentName: row.instrumentName,
        managementNumber: row.instrumentManagementNumber || '',
        snapshots: {
          before: isPlainObject(details.beforeSnapshot) ? details.beforeSnapshot : null,
          after: isPlainObject(details.afterSnapshot) ? details.afterSnapshot : null,
        },
      };
    });

    if (filter.actionType && filter.actionType !== 'all') {
      logs = logs.filter((item) => item.actionType === filter.actionType);
    }

    if (filter.keyword) {
      const keyword = filter.keyword.trim().toLowerCase();
      logs = logs.filter((item) => {
        const haystack = [
          item.summary,
          item.operator,
          item.notes,
          item.actionLabel,
          ...item.facts.map((fact) => `${fact.label}${fact.value}`),
          ...item.changes.map((change) => `${change.label}${change.before}${change.after}`),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(keyword);
      });
    }

    return logs;
  }
}

export default new InstrumentLogService();
