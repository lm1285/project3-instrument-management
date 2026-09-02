import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Popconfirm,
  Popover,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  ReadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import styled from '@emotion/styled';
import type { Instrument } from '../../types';
import DataTable from '../../../../components/UI/DataTable';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import EditGroupModal from './EditGroupModal';
import HistoryModal from './HistoryModal';
import InstrumentCard from './InstrumentCard';
import {
  buildMeasurementRangeSummary,
  buildMeasurementUncertaintySummary,
  deserializeMeasurementItems,
} from './measurementRangeUtils';
import { buildInstrumentQrContent, downloadCanvasQr, printCanvasQr } from './qrCodeUtils';
import {
  formatDateValue,
  getInstrumentSerialNumber,
  getStatusColor,
} from './tableViewUtils';
import { useSystemSettings } from '../../../system-settings/hooks/useSystemSettings';
import { useMergeGroupWorkbench } from '../../hooks/useMergeGroupWorkbench';
import type { MergeGroupEntity, MergeGroupSummary } from '../../domain/mergeGroupTypes';

const { Text, Title } = Typography;

const TwoLineHeader = styled.div`
  height: 60px !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  align-items: center !important;
  font-size: var(--table-font-size, 15px) !important;
  font-family: var(--app-font-family) !important;
  line-height: 1.4 !important;
  padding: 4px !important;
  overflow: hidden !important;
  white-space: normal !important;
  word-break: keep-all !important;
`;

interface TableViewProps {
  dataSource: Instrument[];
  loading: boolean;
  onEdit: (instrument: Instrument) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: () => void;
  selectedRowKeys?: React.Key[];
  onSelectionChange?: (selectedRowKeys: React.Key[], selectedRows: Instrument[]) => void;
  viewType?: 'std' | 'mat' | 'aux';
  groupDefsTick?: number;
  onRefresh?: () => Promise<void> | void;
}

type ScopeMode = 'all' | 'collections' | 'singles';

type CollectionRow = MergeGroupSummary;

type InstrumentRow = Instrument & {
  rowKind: 'instrument';
  rowKey: string;
};

type ExpandedInstrumentRow = InstrumentRow & {
  collectionHint?: string;
  collectionHintKind?: 'group' | 'set' | 'series';
};

type UnifiedRow = CollectionRow | InstrumentRow;

const DISPLAY_COLUMN_STORAGE_PREFIX = 'instrument_table_visible_columns';
const VIEW_MODE_STORAGE_PREFIX = 'instrument_table_view_mode';
const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'name',
  'type',
  'model',
  'managementNumber',
  'department',
  'instrumentStatus',
  'recalibrationDate',
] as const;
const REQUIRED_COLUMN_KEYS = new Set(['name']);

const COLUMN_LABELS: Record<string, string> = {
  type: '仪器类型',
  name: '仪器名称',
  model: '型号规格',
  serialNumber: '出厂编号',
  managementNumber: '管理编号',
  manufacturer: '生产厂家',
  measurementRange: '测量范围',
  measurementUncertainty: '测量不确定度',
  currentCapacity: '当前容量',
  traceabilityMethod: '溯源方式',
  calibrationDate: '校准日期',
  cycle: '校准周期',
  recalibrationDate: '复校日期',
  traceabilityCertificate: '溯源证书编号',
  traceabilityAgency: '溯源机构',
  department: '科室',
  storageLocation: '存放位置',
  instrumentStatus: '仪器状态',
  storageStatus: '出入库状态',
  remarks: '备注',
  attachments: '附件',
};
const DISPLAY_COLUMN_ORDER = Object.keys(COLUMN_LABELS);

const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return String(value);
};

const getCollectionTagColor = (collectionKind: CollectionRow['collectionKind']) => {
  if (collectionKind === 'set') return 'cyan';
  if (collectionKind === 'series') return 'purple';
  return 'processing';
};

const getCollectionActionLabel = (collectionKind: CollectionRow['collectionKind']) =>
  collectionKind === 'set' ? '编辑套系' : '编辑合并组';

const getCollectionMemberCount = (record: CollectionRow) =>
  record.count + (record.children?.reduce((total, child) => total + child.count, 0) || 0);

const getReadableInstrumentType = (
  record: UnifiedRow,
  fallbackTypeName?: string,
) => {
  if (record.rowKind !== 'collection') {
    return record.type || '-';
  }

  const memberList = [
    ...record.list,
    ...(record.children?.flatMap((child) => child.list) || []),
  ];
  const rawType = memberList.find((item) => item.type)?.type;
  if (rawType) {
    return rawType;
  }

  if (fallbackTypeName && !fallbackTypeName.includes('?')) {
    return fallbackTypeName;
  }

  return '仪器';
};

const TableView: React.FC<TableViewProps> = ({
  dataSource,
  loading,
  onEdit,
  onDelete,
  onBatchDelete,
  selectedRowKeys = [],
  onSelectionChange,
  viewType,
  groupDefsTick,
  onRefresh,
}) => {
  const [settings] = useSystemSettings();
  const isMobile = window.innerWidth <= 768;
  const [currentInstrument, setCurrentInstrument] = useState<Instrument | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [lsTick, setLsTick] = useState(0);
  const [editVisible, setEditVisible] = useState(false);
  const [editGroup, setEditGroup] = useState<MergeGroupEntity | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrData, setQrData] = useState('');
  const [qrInstrument, setQrInstrument] = useState<Instrument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(settings.table?.pageSize ?? 10);
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});
  const [displayColumnsOpen, setDisplayColumnsOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    ...DEFAULT_VISIBLE_COLUMN_KEYS,
  ]);
  const [scopeMode, setScopeMode] = useState<ScopeMode>('all');
  const [drawerRecord, setDrawerRecord] = useState<UnifiedRow | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<UnifiedRow[]>([]);
  const lastDesktopClickRef = React.useRef<{ rowKey: string; timestamp: number } | null>(null);

  const dateFormat = settings.table?.dateFormat || 'YYYY-MM-DD';
  const storageKey = `${DISPLAY_COLUMN_STORAGE_PREFIX}_${viewType}`;
  const viewModeStorageKey = `${VIEW_MODE_STORAGE_PREFIX}_${viewType}`;

  const defaultRender = (value: any) => value || '-';
  const summaryRender = (value: any) => {
    const text = String(value || '').trim();
    if (!text) {
      return '-';
    }

    return (
      <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.7 }}>
        {text}
      </span>
    );
  };
  const uncertaintySummaryRender = (value: any) => {
    const text = String(value || '').trim();
    if (!text) {
      return '-';
    }

    const parts = text.split(/(Urel|U|k)(?=\s*=)/g);

    return (
      <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.7 }}>
        {parts.map((part, index) => {
          if (part === 'Urel') {
            return (
              <React.Fragment key={`${part}-${index}`}>
                <em>U</em>
                <sub>rel</sub>
              </React.Fragment>
            );
          }

          if (part === 'U' || part === 'k') {
            return <em key={`${part}-${index}`}>{part}</em>;
          }

          return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
        })}
      </span>
    );
  };
  const buildMeasurementDisplay = (record: InstrumentRow | Instrument) => {
    const measurementItems = deserializeMeasurementItems(
      (record as any).metrologicalParameterRange,
      record.measureRange,
    );

    return {
      measurementRange: buildMeasurementRangeSummary(measurementItems) || record.measureRange || '-',
      measurementUncertainty:
        buildMeasurementUncertaintySummary(measurementItems) || record.uncertainty || '-',
    };
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleColumnKeys(parsed);
          return;
        }
      }
    } catch {
      // ignore invalid storage
    }

    setVisibleColumnKeys([...DEFAULT_VISIBLE_COLUMN_KEYS]);
  }, [storageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(viewModeStorageKey);
      if (raw === 'all' || raw === 'collections' || raw === 'singles') {
        setScopeMode(raw);
        return;
      }
    } catch {
      // ignore invalid storage
    }
    setScopeMode('all');
  }, [viewModeStorageKey]);

  const persistVisibleColumnKeys = (keys: string[]) => {
    const normalized = Array.from(new Set([...keys, ...Array.from(REQUIRED_COLUMN_KEYS)])).sort(
      (left, right) => {
        const leftIndex = DISPLAY_COLUMN_ORDER.indexOf(left);
        const rightIndex = DISPLAY_COLUMN_ORDER.indexOf(right);
        const safeLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
        const safeRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
        return safeLeftIndex - safeRightIndex;
      },
    );
    setVisibleColumnKeys(normalized);
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  };

  const handleScopeModeChange = (next: ScopeMode) => {
    setScopeMode(next);
    localStorage.setItem(viewModeStorageKey, next);
  };

  const openQrCode = (instrument: Instrument) => {
    setQrData(buildInstrumentQrContent(instrument));
    setQrInstrument(instrument);
    setQrModalVisible(true);
  };

  const handleDownloadQr = () => {
    downloadCanvasQr('qr-code-canvas', `${qrInstrument?.managementNumber || 'qrcode'}.png`);
  };

  const handlePrintQr = () => {
    if (!qrInstrument) return;
    printCanvasQr('qr-code-canvas', `打印二维码 - ${qrInstrument.managementNumber}`);
  };

  const openHistory = (instrument: Instrument) => {
    setCurrentInstrument(instrument);
    setHistoryVisible(true);
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setCurrentPage(newPage);
    if (newPageSize !== pageSize) {
      setPageSize(newPageSize);
    }
  };

  const filteredList = dataSource || [];
  const workbench = useMergeGroupWorkbench({
    dateFormat,
    instruments: filteredList,
    revision: lsTick + (groupDefsTick || 0),
    viewType,
  });
  const typeName = workbench.typeName;
  const singlesList = workbench.singlesList;
  const collectionRows = workbench.collectionRows;

  const openEditGroup = (group: MergeGroupEntity) => {
    setEditGroup(group);
    setEditVisible(true);
  };

  const afterSaved = async () => {
    setEditVisible(false);
    setEditGroup(null);
    if (onRefresh) {
      await onRefresh();
    }
    setLsTick((tick) => tick + 1);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getGroupMembersForEdit = (group: CollectionRow) => {
    const combined = [...group.list, ...(group.children?.flatMap((child) => child.list) || [])];
    const deduped = new Map<string, Instrument>();
    combined.forEach((instrument) => {
      deduped.set(String(instrument.id), instrument);
    });
    return Array.from(deduped.values());
  };

  const getExistingGroupIdFromEntity = (group: MergeGroupEntity) => {
    const memberGroupId = group.list.find((item) => item.mergeGroupId)?.mergeGroupId;
    if (memberGroupId) {
      return String(memberGroupId);
    }

    const explicitPrefix = 'explicit:id:';
    if (group.key.startsWith(explicitPrefix)) {
      return group.key.slice(explicitPrefix.length);
    }

    return null;
  };

  const mapGroupToEditModel = (group: CollectionRow): MergeGroupEntity => ({
    key: group.key,
    name: group.name,
    model: group.model,
    range: group.range,
    list: getGroupMembersForEdit(group),
  });

  const buildExpandedMemberRows = (group: CollectionRow): ExpandedInstrumentRow[] => {
    const directMembers = group.list.map((instrument) => ({
      ...instrument,
      rowKind: 'instrument' as const,
      rowKey: `instrument-${instrument.id}`,
      collectionHint:
        group.collectionKind === 'group' ? '未归套成员' : `${group.collectionLabel}成员`,
      collectionHintKind: group.collectionKind,
    }));

    const childMembers =
      group.children?.flatMap((child) =>
        child.list.map((instrument) => ({
          ...instrument,
          rowKind: 'instrument' as const,
          rowKey: `instrument-${instrument.id}`,
          collectionHint: instrument.groupName || child.name,
          collectionHintKind: child.collectionKind,
        })),
      ) || [];

    return [...childMembers, ...directMembers].sort((left, right) => {
      const leftHint = String(left.collectionHint || '');
      const rightHint = String(right.collectionHint || '');
      if (leftHint !== rightHint) {
        return leftHint.localeCompare(rightHint, 'zh-CN');
      }

      return String(left.managementNumber || '').localeCompare(
        String(right.managementNumber || ''),
        'zh-CN',
      );
    });
  };

  const unifiedRows = useMemo<UnifiedRow[]>(() => {
    const singleRows: InstrumentRow[] = singlesList.map((instrument) => ({
      ...instrument,
      rowKind: 'instrument',
      rowKey: `instrument-${instrument.id}`,
    }));

    if (scopeMode === 'singles') {
      return singleRows;
    }

    if (scopeMode === 'collections') {
      return collectionRows;
    }

    return [...collectionRows, ...singleRows];
  }, [collectionRows, scopeMode, singlesList]);

  const selectableInstrumentRows = useMemo(
    () => unifiedRows.filter((row): row is InstrumentRow => row.rowKind === 'instrument'),
    [unifiedRows],
  );

  const selectableInstrumentMap = useMemo(
    () => new Map(selectableInstrumentRows.map((row) => [row.id, row])),
    [selectableInstrumentRows],
  );

  const effectiveSelectedInstrumentIds = useMemo(
    () =>
      (selectedRowKeys as string[]).filter(
        (key): key is string => typeof key === 'string' && selectableInstrumentMap.has(key),
      ),
    [selectableInstrumentMap, selectedRowKeys],
  );

  const selectedInstrumentRows = useMemo(
    () =>
      effectiveSelectedInstrumentIds
        .map((id) => selectableInstrumentMap.get(id))
        .filter((row): row is InstrumentRow => Boolean(row)),
    [effectiveSelectedInstrumentIds, selectableInstrumentMap],
  );

  const allSelectableChecked =
    selectableInstrumentRows.length > 0 &&
    effectiveSelectedInstrumentIds.length === selectableInstrumentRows.length;

  const partiallySelected =
    effectiveSelectedInstrumentIds.length > 0 &&
    effectiveSelectedInstrumentIds.length < selectableInstrumentRows.length;

  const toggleInstrumentSelection = (instrument: InstrumentRow, checked: boolean) => {
    if (!onSelectionChange || !instrument.id) {
      return;
    }

    const nextIds = checked
      ? Array.from(new Set([...effectiveSelectedInstrumentIds, instrument.id]))
      : effectiveSelectedInstrumentIds.filter((id) => id !== instrument.id);
    const nextRows = nextIds
      .map((id) => selectableInstrumentMap.get(id))
      .filter((row): row is InstrumentRow => Boolean(row));

    onSelectionChange(nextIds, nextRows);
  };

  const handleSelectAllVisible = (checked: boolean) => {
    if (!onSelectionChange) {
      return;
    }

    if (!checked) {
      onSelectionChange([], []);
      return;
    }

    const nextIds = selectableInstrumentRows
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));
    onSelectionChange(nextIds, selectableInstrumentRows);
  };

  useEffect(() => {
    if (!onSelectionChange) {
      return;
    }

    if (effectiveSelectedInstrumentIds.length !== selectedRowKeys.length) {
      onSelectionChange(effectiveSelectedInstrumentIds, selectedInstrumentRows);
    }
  }, [
    effectiveSelectedInstrumentIds,
    onSelectionChange,
    selectedInstrumentRows,
    selectedRowKeys.length,
  ]);

  const overviewMetrics = [
    { label: '顶层对象', value: unifiedRows.length },
    { label: '当前类型', value: workbench.metrics.currentType },
    { label: '单体', value: workbench.metrics.singles },
    { label: '集合', value: workbench.metrics.collections },
    { label: '套系组', value: workbench.metrics.sets },
    { label: '集合成员', value: workbench.metrics.collectionMembers },
  ];

  const columns: any[] = [
    {
      key: 'type',
      title: '仪器类型',
      dataIndex: 'type',
      width: 120,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') {
          return <Tag color="blue">{getReadableInstrumentType(record, typeName)}</Tag>;
        }
        return defaultRender(value);
      },
    },
    {
      key: 'name',
      title: '仪器名称',
      dataIndex: 'name',
      width: 260,
      ellipsis: true,
      align: 'left',
      render: (_: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') {
          return (
            <Space size={8}>
              <Tag color={getCollectionTagColor(record.collectionKind)} style={{ marginInlineEnd: 0 }}>
                {record.collectionLabel}
              </Tag>
              <span style={{ fontWeight: 700 }}>{record.name}</span>
            </Space>
          );
        }
        const instrumentRecord = record as ExpandedInstrumentRow;
        if (instrumentRecord.collectionHint) {
          return (
            <Space size={8} wrap>
              {instrumentRecord.collectionHintKind === 'set' ? (
                <Tag color="cyan" style={{ marginInlineEnd: 0 }}>
                  {instrumentRecord.collectionHint}
                </Tag>
              ) : (
                <Tag style={{ marginInlineEnd: 0 }}>{instrumentRecord.collectionHint}</Tag>
              )}
              <span>{defaultRender(record.name)}</span>
            </Space>
          );
        }
        return defaultRender(record.name);
      },
    },
    {
      key: 'model',
      title: '型号规格',
      dataIndex: 'model',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return record.model || '-';
        return defaultRender(value);
      },
    },
    {
      key: 'serialNumber',
      title: '出厂编号',
      dataIndex: 'serialNumber',
      width: 140,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return getInstrumentSerialNumber(value, record as Record<string, any>);
      },
    },
    {
      key: 'managementNumber',
      title: '管理编号',
      dataIndex: 'managementNumber',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') {
          const childSummary =
            record.children && record.children.length > 0 ? ` | ${record.children.length} 个套系子组` : '';
          return `${record.count} 台成员${childSummary}`;
        }
        return defaultRender(value);
      },
    },
    {
      key: 'manufacturer',
      title: '生产厂家',
      dataIndex: 'manufacturer',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'measurementRange',
      title: '测量范围',
      dataIndex: 'measureRange',
      width: 170,
      ellipsis: false,
      align: 'center',
      render: (_value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return record.range || '-';
        return summaryRender(buildMeasurementDisplay(record).measurementRange);
      },
    },
    {
      key: 'measurementUncertainty',
      title: (
        <TwoLineHeader>
          测量不确定度
          <br />
          最大允许误差
        </TwoLineHeader>
      ),
      dataIndex: 'uncertainty',
      width: 220,
      ellipsis: false,
      align: 'center',
      render: (_value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return uncertaintySummaryRender(buildMeasurementDisplay(record).measurementUncertainty);
      },
    },
    {
      key: 'currentCapacity',
      title: '当前容量',
      dataIndex: 'currentCapacity',
      width: 120,
      align: 'center',
      render: (value: any, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        if (value === null || value === undefined || value === '') return '-';
        const unit = record.unit ? String(record.unit) : '';
        return `${value}${unit ? ` ${unit}` : ''}`;
      },
    },
    {
      key: 'traceabilityMethod',
      title: '溯源方式',
      dataIndex: 'traceabilityMethod',
      width: 120,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'calibrationDate',
      title: '校准日期',
      dataIndex: 'calibrationDate',
      width: 120,
      align: 'center',
      render: (text: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return formatDateValue(text, settings.table?.dateFormat || 'YYYY-MM-DD');
      },
    },
    {
      key: 'cycle',
      title: '校准周期',
      dataIndex: 'calibrationCycle',
      width: 100,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'recalibrationDate',
      title: '复校日期',
      dataIndex: 'nextCalibrationDate',
      width: 140,
      align: 'center',
      render: (text: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return record.nextCalibrationText;
        return formatDateValue(text, settings.table?.dateFormat || 'YYYY-MM-DD');
      },
    },
    {
      key: 'traceabilityCertificate',
      title: '溯源证书编号',
      dataIndex: 'certificateNumber',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'traceabilityAgency',
      title: '溯源机构',
      dataIndex: 'calibrationInstitution',
      width: 150,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'department',
      title: '科室',
      dataIndex: 'department',
      width: 140,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return record.departmentText;
        return defaultRender(value);
      },
    },
    {
      key: 'storageLocation',
      title: '存放位置',
      dataIndex: 'location',
      width: 160,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return record.locationText;
        return defaultRender(value);
      },
    },
    {
      key: 'instrumentStatus',
      title: '仪器状态',
      dataIndex: 'status',
      width: 140,
      align: 'center',
      render: (status: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') {
          return <Tag color={getCollectionTagColor(record.collectionKind)}>{record.statusSummary}</Tag>;
        }
        return <Tag color={getStatusColor(status)}>{status || '-'}</Tag>;
      },
    },
    {
      key: 'storageStatus',
      title: '出入库状态',
      dataIndex: 'inOutStatus',
      width: 120,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        return defaultRender(value);
      },
    },
    {
      key: 'remarks',
      title: '备注',
      dataIndex: 'remarks',
      width: 170,
      ellipsis: true,
      align: 'center',
      render: (value: string, record: UnifiedRow) => {
        if (record.rowKind === 'collection') return `包含 ${record.count} 台成员`;
        return defaultRender(value);
      },
    },
    {
      key: 'attachments',
      title: '附件',
      dataIndex: 'attachments',
      width: 100,
      align: 'center',
      render: (attachments: any[], record: UnifiedRow) => {
        if (record.rowKind === 'collection') return '-';
        if (!attachments || attachments.length === 0) return '-';
        return `${attachments.length} 个附件`;
      },
    },
  ];

  const selectionColumn = {
    key: 'selection',
    title: (
      <Checkbox
        checked={allSelectableChecked}
        indeterminate={partiallySelected}
        disabled={selectableInstrumentRows.length === 0}
        onChange={(event) => handleSelectAllVisible(event.target.checked)}
        onClick={(event) => event.stopPropagation()}
      />
    ),
    width: 56,
    align: 'center' as const,
    resizable: false,
    draggable: false,
    render: (_: unknown, record: UnifiedRow) => {
      if (record.rowKind !== 'instrument' || !record.id) {
        return <Text type="secondary">-</Text>;
      }

      return (
        <Checkbox
          checked={effectiveSelectedInstrumentIds.includes(record.id)}
          onChange={(event) => toggleInstrumentSelection(record, event.target.checked)}
          onClick={(event) => event.stopPropagation()}
        />
      );
    },
  };

  const displayableColumns = [selectionColumn, ...columns];

  const filteredColumns = useMemo(() => {
    if (isMobile) {
      const mobileKeys = new Set(['name', 'type', 'instrumentStatus']);
      return displayableColumns.filter((column) => mobileKeys.has(column.key));
    }

    const visibleKeys = new Set([
      ...visibleColumnKeys,
      ...Array.from(REQUIRED_COLUMN_KEYS),
      'selection',
    ]);
    return displayableColumns.filter((column) => visibleKeys.has(column.key));
  }, [displayableColumns, isMobile, visibleColumnKeys]);

  const convertedColumns = filteredColumns.map((column: any) => ({
    ...column,
    key: column.key,
    resizable: column.resizable ?? column.key !== 'type',
    draggable: column.draggable ?? true,
    align: column.align || 'center',
    className: column.key === 'type' ? 'no-left-resize' : column.className || '',
  }));

  const handleColumnsChange = (newColumns: any) => {
    console.log('列顺序变化', newColumns);
  };

  const openInstrumentDetail = (record: UnifiedRow, parentRecord?: UnifiedRow | null) => {
    setDrawerHistory(parentRecord ? [parentRecord] : []);
    setDrawerRecord(record);
  };

  const handleDrawerBack = () => {
    setDrawerHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousRecord = next.pop() || null;
      setDrawerRecord(previousRecord);
      return next;
    });
  };

  const openInstrumentEditor = (instrument: Instrument) => {
    setDrawerRecord(null);
    setDrawerHistory([]);
    onEdit(instrument);
  };

  const handleRowClick = (record: UnifiedRow) => {
    if (isMobile) {
      if (record.rowKind === 'collection') {
        toggleGroup(record.key);
        return;
      }
      openInstrumentEditor(record);
      return;
    }

    const now = Date.now();
    const previousClick = lastDesktopClickRef.current;
    if (
      previousClick &&
      previousClick.rowKey === record.rowKey &&
      now - previousClick.timestamp <= 320
    ) {
      lastDesktopClickRef.current = null;
      openInstrumentDetail(record);
      return;
    }

    lastDesktopClickRef.current = {
      rowKey: record.rowKey,
      timestamp: now,
    };
  };

  const getRowClassName = (record: UnifiedRow) =>
    record.rowKind === 'collection' ? 'table-row-hover instrument-group-row' : 'table-row-hover';

  const displayColumnContent = (
    <div style={{ width: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>显示列</div>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {displayableColumns
          .filter((column) => column.key !== 'selection')
          .map((column) => {
          const checked =
            visibleColumnKeys.includes(column.key) || REQUIRED_COLUMN_KEYS.has(column.key);
          const disabled = REQUIRED_COLUMN_KEYS.has(column.key);
          return (
            <Checkbox
              key={column.key}
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                const next = event.target.checked
                  ? Array.from(new Set([...visibleColumnKeys, column.key]))
                  : visibleColumnKeys.filter((key) => key !== column.key);
                persistVisibleColumnKeys(next);
              }}
            >
              {COLUMN_LABELS[column.key] || String(column.key)}
            </Checkbox>
          );
        })}
      </Space>
      <Space style={{ marginTop: 12 }}>
        <Button
          size="small"
          onClick={() => persistVisibleColumnKeys([...DEFAULT_VISIBLE_COLUMN_KEYS])}
        >
          恢复默认
        </Button>
        <Button
          size="small"
          onClick={() =>
            persistVisibleColumnKeys(
              displayableColumns
                .filter((column) => column.key !== 'selection')
                .map((column) => column.key),
            )
          }
        >
          显示全部
        </Button>
      </Space>
    </div>
  );

  const renderDrawerContent = () => {
    if (!drawerRecord) {
      return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未选择记录" />;
    }

    if (drawerRecord.rowKind === 'collection') {
      return (
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          <div
            style={{
              padding: 16,
              border: '1px solid #f0f0f0',
              borderRadius: 12,
              background: '#fafafa',
            }}
          >
            <Space direction="vertical" size={8}>
              <Space size={8}>
                <Tag
                  color={getCollectionTagColor(drawerRecord.collectionKind)}
                  style={{ marginInlineEnd: 0, borderRadius: 999 }}
                >
                  {drawerRecord.collectionLabel}
                </Tag>
                <Title level={5} style={{ margin: 0 }}>
                  {drawerRecord.name}
                </Title>
              </Space>
              <Text type="secondary">
                {drawerRecord.model || '未填写型号'} | {getCollectionMemberCount(drawerRecord)} 台成员
              </Text>
            </Space>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              background: '#fff',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Space wrap>
              {drawerHistory.length > 0 ? (
                <Button onClick={handleDrawerBack} style={{ borderRadius: 10 }}>
                  返回上一级
                </Button>
              ) : null}
            </Space>
            {drawerRecord.collectionKind === 'group' ? (
              <Button
                type="primary"
                style={{ borderRadius: 10 }}
                onClick={() => openEditGroup(mapGroupToEditModel(drawerRecord))}
              >
                {getCollectionActionLabel(drawerRecord.collectionKind)}
              </Button>
            ) : null}
          </div>

          <Descriptions
            title="分组概览"
            column={1}
            size="small"
            bordered
            items={[
              { key: 'range', label: '组测量范围', children: formatValue(drawerRecord.range) },
              { key: 'department', label: '科室', children: drawerRecord.departmentText },
              { key: 'location', label: '主要位置', children: drawerRecord.locationText },
              { key: 'date', label: '最早复校日期', children: drawerRecord.nextCalibrationText },
              { key: 'status', label: '状态汇总', children: drawerRecord.statusSummary },
            ]}
          />

          <div>
            <Title level={5} style={{ marginBottom: 12 }}>
              {drawerRecord.collectionKind === 'group' && drawerRecord.children?.length
                ? '套系子组与成员'
                : '成员列表'}
            </Title>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {drawerRecord.collectionKind === 'group' &&
                drawerRecord.children?.map((child) => (
                  <div
                    key={child.key}
                    style={{
                      border: '1px solid #d6f5ff',
                      borderRadius: 12,
                      padding: '10px 12px',
                      background: '#f6ffed',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <Space size={8} wrap>
                          <Tag color={getCollectionTagColor(child.collectionKind)} style={{ margin: 0 }}>
                            {child.collectionLabel}
                          </Tag>
                          <div style={{ fontWeight: 700 }}>{child.name}</div>
                        </Space>
                        <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                          型号: {child.model || '未填写'} | 出厂编号:{' '}
                          {child.list
                            .map((member) => member.groupSerialNumber || member.serialNumber)
                            .filter(Boolean)
                            .join(' / ') || '-'}{' '}
                          | {child.count} 台成员
                        </div>
                      </div>
                      <Button
                        size="small"
                        style={{ borderRadius: 8 }}
                        onClick={() => openInstrumentDetail(child, drawerRecord)}
                      >
                        查看套系
                      </Button>
                    </div>
                  </div>
                ))}
              {drawerRecord.list.length === 0 && !drawerRecord.children?.length ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前集合下暂无直接成员" />
              ) : null}
              {drawerRecord.list.map((member) => (
                <div
                  key={member.id}
                  style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: '#fff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{member.name}</div>
                      <div style={{ color: '#8c8c8c', marginTop: 4 }}>
                        {member.managementNumber || '-'} | {member.model || '-'}
                      </div>
                    </div>
                    <Button
                      size="small"
                      style={{ borderRadius: 8 }}
                      onClick={() => openInstrumentEditor(member)}
                    >
                      编辑仪器
                    </Button>
                  </div>
                </div>
              ))}
            </Space>
          </div>
        </Space>
      );
    }

    const measurementDisplay = buildMeasurementDisplay(drawerRecord);

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div
          style={{
            padding: 18,
            border: '1px solid #f0f0f0',
            borderRadius: 16,
            background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)',
          }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <Space size={8} wrap>
                  <Tag color={getStatusColor(drawerRecord.status)} style={{ marginInlineEnd: 0 }}>
                    {drawerRecord.status || '未知状态'}
                  </Tag>
                  <Title level={5} style={{ margin: 0 }}>
                    {drawerRecord.name}
                  </Title>
                </Space>
                <Text type="secondary">
                  {drawerRecord.managementNumber || '-'} | {drawerRecord.model || '-'}
                </Text>
              </div>
              <Tag bordered={false} color="processing" style={{ marginInlineEnd: 0 }}>
                {formatValue(drawerRecord.type)}
              </Tag>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {[
                { key: 'department', label: '科室', value: formatValue(drawerRecord.department) },
                { key: 'location', label: '位置', value: formatValue(drawerRecord.location) },
                {
                  key: 'recalibration',
                  label: '复校日期',
                  value: formatValue(
                    formatDateValue(
                      drawerRecord.nextCalibrationDate,
                      settings.table?.dateFormat || 'YYYY-MM-DD',
                    ),
                  ),
                },
                {
                  key: 'group',
                  label: '所属套系/合并组',
                  value: formatValue(drawerRecord.mergeGroupName || drawerRecord.groupName),
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: '#fff',
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>{item.label}</div>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </Space>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            padding: 12,
            borderRadius: 14,
            border: '1px solid #f0f0f0',
            background: '#fafafa',
          }}
        >
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => openInstrumentEditor(drawerRecord)}
            style={{ borderRadius: 10 }}
          >
            编辑仪器
          </Button>
          <Button
            icon={<ReadOutlined />}
            onClick={() => openHistory(drawerRecord)}
            style={{ borderRadius: 10 }}
          >
            查看日志
          </Button>
          <Button
            icon={<QrcodeOutlined />}
            onClick={() => openQrCode(drawerRecord)}
            style={{ borderRadius: 10 }}
          >
            二维码
          </Button>
          <PermissionGuard permission="instrument:delete">
            <Popconfirm
              title="确定要删除这台仪器吗？"
              onConfirm={() => onDelete(drawerRecord.id!)}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} style={{ borderRadius: 10 }}>
                删除
              </Button>
            </Popconfirm>
          </PermissionGuard>
        </div>

        <Descriptions
          title="基础信息"
          column={1}
          size="small"
          bordered
          items={[
            { key: 'type', label: '仪器类型', children: formatValue(drawerRecord.type) },
            { key: 'name', label: '仪器名称', children: formatValue(drawerRecord.name) },
            { key: 'model', label: '型号规格', children: formatValue(drawerRecord.model) },
            {
              key: 'serial',
              label: '出厂编号',
              children: formatValue(drawerRecord.serialNumber),
            },
            {
              key: 'management',
              label: '管理编号',
              children: formatValue(drawerRecord.managementNumber),
            },
            {
              key: 'manufacturer',
              label: '生产厂家',
              children: formatValue(drawerRecord.manufacturer),
            },
            { key: 'department', label: '科室', children: formatValue(drawerRecord.department) },
            { key: 'location', label: '存放位置', children: formatValue(drawerRecord.location) },
          ]}
        />

        <Descriptions
          title="计量信息"
          column={1}
          size="small"
          bordered
          items={[
            {
              key: 'range',
              label: '测量范围',
              children: summaryRender(measurementDisplay.measurementRange),
            },
            {
              key: 'uncertainty',
              label: '测量不确定度',
              children: summaryRender(measurementDisplay.measurementUncertainty),
            },
            {
              key: 'method',
              label: '溯源方式',
              children: formatValue(drawerRecord.traceabilityMethod),
            },
            {
              key: 'date',
              label: '校准日期',
              children: formatValue(
                formatDateValue(
                  drawerRecord.calibrationDate,
                  settings.table?.dateFormat || 'YYYY-MM-DD',
                ),
              ),
            },
            {
              key: 'recalibration',
              label: '复校日期',
              children: formatValue(
                formatDateValue(
                  drawerRecord.nextCalibrationDate,
                  settings.table?.dateFormat || 'YYYY-MM-DD',
                ),
              ),
            },
            {
              key: 'cycle',
              label: '校准周期',
              children: formatValue(drawerRecord.calibrationCycle),
            },
            {
              key: 'certificate',
              label: '溯源证书编号',
              children: formatValue(drawerRecord.certificateNumber),
            },
          ]}
        />

        <Descriptions
          title="状态与备注"
          column={1}
          size="small"
          bordered
          items={[
            { key: 'status', label: '仪器状态', children: formatValue(drawerRecord.status) },
            {
              key: 'stock',
              label: '出入库状态',
              children: formatValue(drawerRecord.inOutStatus),
            },
            { key: 'remark', label: '备注', children: formatValue(drawerRecord.remarks) },
            {
              key: 'group',
              label: '所属套系/合并组',
              children: formatValue(drawerRecord.mergeGroupName || drawerRecord.groupName),
            },
          ]}
        />
      </Space>
    );
  };

  return (
    <div>
      {isMobile ? (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>仪器总览</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {collectionRows.map((group) => (
                <div
                  key={group.key}
                  style={{
                    background: '#fafafa',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ cursor: 'pointer' }} onClick={() => toggleGroup(group.key)}>
                    <Space size={8}>
                      <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                        {group.collectionLabel}
                      </Tag>
                      <span style={{ fontWeight: 700 }}>{group.name}</span>
                    </Space>
                    <div style={{ color: '#666', fontSize: 14, marginTop: 6 }}>
                      型号规格: {group.model || '-'} | 数量: {getCollectionMemberCount(group)}
                    </div>
                  </div>

                  {expandedGroupKeys[group.key] && (
                    <div style={{ marginTop: 12 }}>
                      {group.list.map((instrument) => (
                        <InstrumentCard
                          key={instrument.id}
                          data={instrument}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onHistory={openHistory}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {singlesList.map((instrument) => (
                <InstrumentCard
                  key={instrument.id}
                  data={instrument}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onHistory={openHistory}
                />
              ))}

              {singlesList.length === 0 && collectionRows.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                  暂无仪器数据
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div
            style={{
              padding: '14px 16px',
              marginBottom: 10,
              background: '#fafafa',
              border: '1px solid #f0f0f0',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 14,
                flexWrap: 'wrap',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#262626' }}>统一工作台</div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(92px, 120px))',
                  gap: 8,
                  width: 'fit-content',
                  flex: '0 0 auto',
                }}
              >
                {overviewMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      minWidth: 0,
                      padding: '6px 9px',
                      borderRadius: 12,
                      border: '1px solid #f0f0f0',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ color: '#8c8c8c', fontSize: 11 }}>{metric.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#262626' }}>{metric.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <Space wrap size={10} style={{ flexShrink: 0, marginLeft: 'auto' }}>
              <Space size={[8, 8]} wrap>
                {[
                  { label: '全部', value: 'all' as const },
                  { label: '只看集合', value: 'collections' as const },
                  { label: '只看单体', value: 'singles' as const },
                ].map((item) => (
                  <Button
                    key={item.value}
                    type={scopeMode === item.value ? 'primary' : 'default'}
                    onClick={() => handleScopeModeChange(item.value)}
                    style={{ borderRadius: 999 }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Space>
              <Popover
                trigger="click"
                placement="bottomRight"
                open={displayColumnsOpen}
                onOpenChange={setDisplayColumnsOpen}
                content={displayColumnContent}
                destroyOnHidden
              >
                <Button icon={<SettingOutlined />} style={{ borderRadius: 10 }}>
                  显示列
                </Button>
              </Popover>
            </Space>
          </div>

          <div
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 14,
              border: '1px solid #f0f0f0',
              background: '#ffffff',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Tag
              color={effectiveSelectedInstrumentIds.length > 0 ? 'processing' : 'default'}
              style={{ marginInlineEnd: 0, borderRadius: 999, paddingInline: 10 }}
            >
              已选 {effectiveSelectedInstrumentIds.length} 台
            </Tag>

            <Space wrap size={[8, 8]}>
              <Popconfirm
                title="确定删除已选中的仪器吗？"
                onConfirm={onBatchDelete}
                okText="确定"
                cancelText="取消"
                disabled={effectiveSelectedInstrumentIds.length === 0}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={effectiveSelectedInstrumentIds.length === 0}
                  style={{ borderRadius: 10 }}
                >
                  批量删除
                </Button>
              </Popconfirm>
              <Button
                onClick={() => onSelectionChange?.([], [])}
                disabled={effectiveSelectedInstrumentIds.length === 0}
                style={{ borderRadius: 10 }}
              >
                清空选择
              </Button>
            </Space>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #f0f0f0',
              borderRadius: 16,
              padding: '12px 12px 14px',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.05)',
            }}
          >
            <DataTable
              tableId={`instrument_list_unified_${viewType}`}
              dataSource={unifiedRows}
              columns={convertedColumns}
              rowKey="rowKey"
              loading={loading}
              pagination
              currentPage={currentPage}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              rowClassName={getRowClassName}
              onRowClick={handleRowClick}
              onColumnsChange={handleColumnsChange}
              maxTableWidth={null}
              expandable={{
                columnIndex: 1,
                rowExpandable: (row: UnifiedRow) =>
                  row.rowKind === 'collection' &&
                  ((row.children && row.children.length > 0) || row.list.length > 0),
                expandedRowRender: (row: UnifiedRow) => (
                  <div style={{ padding: '12px' }}>
                    {row.rowKind === 'collection' ? (
                      <DataTable
                        tableId={`instrument_list_group_${viewType}_${row.key}`}
                        dataSource={buildExpandedMemberRows(row)}
                        columns={convertedColumns.filter((column: any) => column.key !== 'selection')}
                        rowKey="rowKey"
                        loading={loading}
                        pagination={false}
                        rowClassName={() => 'table-row-hover'}
                        onRowClick={(record: ExpandedInstrumentRow) => handleRowClick(record)}
                        onColumnsChange={handleColumnsChange}
                        maxTableWidth={null}
                      />
                    ) : null}
                  </div>
                ),
              }}
            />
          </div>
        </div>
      )}

      <Drawer
        title={drawerRecord?.rowKind === 'collection' ? '集合详情' : '仪器详情'}
        placement="right"
        width={460}
        open={Boolean(drawerRecord) && !isMobile}
        onClose={() => {
          setDrawerRecord(null);
          setDrawerHistory([]);
        }}
      >
        {renderDrawerContent()}
      </Drawer>

      {editVisible && editGroup && (
        <EditGroupModal
          visible={editVisible}
          onClose={() => {
            setEditVisible(false);
            setEditGroup(null);
          }}
          typeName={typeName}
          title="编辑合并组"
          initial={{
            name: editGroup.name,
            model: editGroup.model,
            measureRange: editGroup.range || '',
          }}
          existingGroupId={getExistingGroupIdFromEntity(editGroup)}
          availableInstruments={workbench.singlesList}
          members={editGroup.list}
          mode="drawer"
          onSaved={async () => {
            await afterSaved();
          }}
        />
      )}

      <HistoryModal
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        instrument={currentInstrument}
      />

      <Modal
        title="仪器二维码"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={handleDownloadQr}>
            下载
          </Button>,
          <Button key="print" icon={<PrinterOutlined />} onClick={handlePrintQr}>
            打印
          </Button>,
          <Button key="close" onClick={() => setQrModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={400}
        centered
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 0',
          }}
        >
          {qrInstrument && (
            <div style={{ marginBottom: 20, width: '100%' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>仪器名称:</strong> {qrInstrument.name}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>型号:</strong> {qrInstrument.model}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>出厂编号:</strong> {qrInstrument.serialNumber || '-'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>管理编号:</strong> {qrInstrument.managementNumber}
              </div>
            </div>
          )}

          <div
            style={{
              padding: 10,
              background: 'white',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
            }}
          >
            {qrData && (
              <QRCodeCanvas
                id="qr-code-canvas"
                value={qrData}
                size={256}
                level="H"
                includeMargin
              />
            )}
          </div>
          <div style={{ marginTop: 16, color: '#666', fontSize: 12 }}>
            请使用通用扫码工具进行识别
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TableView;

