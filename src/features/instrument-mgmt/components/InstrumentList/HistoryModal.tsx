import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ClockCircleOutlined,
  DiffOutlined,
  HistoryOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Instrument } from '../../types';
import { getInstrumentHistory } from '../../services/instrumentService';
import AddHistoryModal from './AddHistoryModal';

const { RangePicker } = DatePicker;
const { Paragraph, Text, Title } = Typography;

interface HistoryModalProps {
  open: boolean;
  onCancel: () => void;
  instrument: Instrument | null;
}

interface ChangeItem {
  field: string;
  label: string;
  before: string;
  after: string;
}

interface FactItem {
  key: string;
  label: string;
  value: string;
}

interface LogItemDetails {
  actionLabel?: string;
  actionType?: string;
  category?: string;
  source?: string;
  summary?: string;
  notes?: string;
  changes?: ChangeItem[];
  facts?: FactItem[];
}

interface HistoryItem {
  id: string;
  timestamp: string;
  type: string;
  operator: string;
  detail: string;
  details?: LogItemDetails;
}

const ACTION_OPTIONS = [
  { label: '全部记录', value: 'all' },
  { label: '创建', value: 'create' },
  { label: '编辑', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '出库', value: 'checkout' },
  { label: '入库', value: 'checkin' },
  { label: '使用', value: 'use' },
  { label: '校准', value: 'calibration' },
  { label: '维修/保养', value: 'maintenance' },
  { label: '备注', value: 'note' },
  { label: '其他', value: 'other' },
] as const;

const ACTION_COLOR_MAP: Record<string, string> = {
  create: 'blue',
  update: 'gold',
  delete: 'red',
  checkout: 'orange',
  checkin: 'green',
  use: 'cyan',
  calibration: 'purple',
  maintenance: 'volcano',
  issue: 'magenta',
  note: 'default',
  other: 'default',
};

const SOURCE_LABEL_MAP: Record<string, string> = {
  'instrument.form': '仪器台账',
  'instrument.flow': '流转记录',
  'manual.log': '人工补录',
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return '-';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
};

const getActionLabel = (item: HistoryItem) =>
  item.details?.actionLabel || ACTION_OPTIONS.find((option) => option.value === item.type)?.label || item.type;

const getSourceLabel = (source?: string) => {
  if (!source) {
    return '系统记录';
  }

  return SOURCE_LABEL_MAP[source] || source;
};

const renderFactTags = (facts?: FactItem[]) => {
  if (!facts || facts.length === 0) {
    return null;
  }

  return (
    <Space wrap size={[8, 8]}>
      {facts.map((fact) => (
        <Tag key={`${fact.key}-${fact.value}`} bordered={false}>
          {fact.label}: {fact.value}
        </Tag>
      ))}
    </Space>
  );
};

const renderChangeList = (changes?: ChangeItem[]) => {
  if (!changes || changes.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginTop: 12,
        border: '1px solid #f0f0f0',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr 1fr',
          gap: 1,
          background: '#f0f0f0',
          fontWeight: 600,
        }}
      >
        <div style={{ padding: '10px 12px', background: '#fafafa' }}>字段</div>
        <div style={{ padding: '10px 12px', background: '#fafafa' }}>变更前</div>
        <div style={{ padding: '10px 12px', background: '#fafafa' }}>变更后</div>
      </div>
      {changes.map((change) => (
        <div
          key={`${change.field}-${change.label}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr 1fr',
            gap: 1,
            background: '#f0f0f0',
          }}
        >
          <div style={{ padding: '10px 12px', background: '#fff' }}>{change.label}</div>
          <div style={{ padding: '10px 12px', background: '#fff', color: '#8c8c8c' }}>
            {change.before || '-'}
          </div>
          <div style={{ padding: '10px 12px', background: '#fff', color: '#1677ff' }}>
            {change.after || '-'}
          </div>
        </div>
      ))}
    </div>
  );
};

const HistoryModal: React.FC<HistoryModalProps> = ({ open, onCancel, instrument }) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'table'>('timeline');
  const [filterType, setFilterType] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(
    null,
  );
  const [addModalVisible, setAddModalVisible] = useState(false);

  useEffect(() => {
    if (!open || !instrument?.id) {
      setItems([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getInstrumentHistory(instrument.id, 200);
        setItems(data as HistoryItem[]);
      } catch (error) {
        console.error('Failed to fetch history', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [instrument, open]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) {
        return false;
      }

      if (dateRange?.[0] && dateRange?.[1]) {
        const current = dayjs(item.timestamp);
        if (
          current.isBefore(dateRange[0].startOf('day')) ||
          current.isAfter(dateRange[1].endOf('day'))
        ) {
          return false;
        }
      }

      if (!searchText.trim()) {
        return true;
      }

      const keyword = searchText.trim().toLowerCase();
      const haystack = [
        item.detail,
        item.operator,
        item.details?.summary,
        item.details?.notes,
        getActionLabel(item),
        ...(item.details?.facts || []).map((fact) => `${fact.label}${fact.value}`),
        ...(item.details?.changes || []).map(
          (change) => `${change.label}${change.before}${change.after}`,
        ),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [dateRange, filterType, items, searchText]);

  const metrics = useMemo(() => {
    const latest = filteredItems[0];
    const editCount = filteredItems.filter((item) => item.type === 'update').length;
    const flowCount = filteredItems.filter((item) =>
      ['checkout', 'checkin', 'use'].includes(item.type),
    ).length;

    return [
      { label: '日志总数', value: String(filteredItems.length) },
      { label: '最近操作人', value: latest?.operator || '-' },
      { label: '最近记录时间', value: latest ? formatDateTime(latest.timestamp) : '-' },
      { label: '信息变更次数', value: String(editCount) },
      { label: '流转记录数', value: String(flowCount) },
    ];
  }, [filteredItems]);

  const tableColumns = [
    {
      title: '操作时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (_: string, record: HistoryItem) => (
        <Tag color={ACTION_COLOR_MAP[record.type] || 'default'}>{getActionLabel(record)}</Tag>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 140,
    },
    {
      title: '来源',
      dataIndex: ['details', 'source'],
      key: 'source',
      width: 120,
      render: (value: string) => getSourceLabel(value),
    },
    {
      title: '摘要',
      dataIndex: 'detail',
      key: 'detail',
      render: (_: string, record: HistoryItem) => (
        <div>
          <div style={{ fontWeight: 600 }}>{record.detail || '-'}</div>
          {record.details?.notes ? (
            <div style={{ marginTop: 4, color: '#8c8c8c' }}>{record.details.notes}</div>
          ) : null}
        </div>
      ),
    },
    {
      title: '变更项',
      key: 'changeCount',
      width: 100,
      render: (_: string, record: HistoryItem) => record.details?.changes?.length || 0,
    },
  ];

  const renderTimeline = () => {
    if (filteredItems.length === 0) {
      return <Empty description="暂无日志记录" style={{ padding: '48px 0' }} />;
    }

    return (
      <div style={{ maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              size="small"
              style={{ borderRadius: 16 }}
              bodyStyle={{ padding: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 520px' }}>
                  <Space wrap size={[8, 8]}>
                    <Tag color={ACTION_COLOR_MAP[item.type] || 'default'}>{getActionLabel(item)}</Tag>
                    <Tag bordered={false} icon={<UserOutlined />}>
                      {item.operator || '-'}
                    </Tag>
                    <Tag bordered={false} icon={<HistoryOutlined />}>
                      {getSourceLabel(item.details?.source)}
                    </Tag>
                    {(item.details?.changes?.length || 0) > 0 ? (
                      <Tag bordered={false} icon={<DiffOutlined />}>
                        {item.details?.changes?.length} 项变更
                      </Tag>
                    ) : null}
                  </Space>

                  <Title level={5} style={{ margin: '12px 0 8px' }}>
                    {item.detail || '未提供摘要'}
                  </Title>

                  {item.details?.notes ? (
                    <Paragraph style={{ marginBottom: 8, color: '#595959' }}>
                      {item.details.notes}
                    </Paragraph>
                  ) : null}

                  {renderFactTags(item.details?.facts)}
                  {renderChangeList(item.details?.changes)}
                </div>

                <div style={{ minWidth: 180, color: '#8c8c8c' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClockCircleOutlined />
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space wrap>
          <span>仪器日志</span>
          {instrument ? <Tag color="blue">{instrument.name}</Tag> : null}
          {instrument?.managementNumber ? <Tag>{instrument.managementNumber}</Tag> : null}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      width={1080}
      footer={null}
      destroyOnHidden
    >
      <div
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 18,
          border: '1px solid #f0f0f0',
          background: 'linear-gradient(180deg, #fafcff 0%, #ffffff 100%)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {metrics.map((metric) => (
            <Card
              key={metric.label}
              size="small"
              style={{ borderRadius: 14, height: '100%' }}
              bodyStyle={{
                minHeight: 88,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Text type="secondary">{metric.label}</Text>
              <div style={{ marginTop: 8, fontWeight: 700, fontSize: 24 }}>{metric.value}</div>
            </Card>
          ))}
        </div>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 16,
          borderRadius: 18,
          border: '1px solid #f0f0f0',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#262626' }}>日志筛选</div>
            <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
              按类型、关键词和时间范围快速定位记录
            </div>
          </div>

          <Segmented
            value={activeTab}
            onChange={(value) => setActiveTab(String(value) as 'timeline' | 'table')}
            options={[
              { label: '审计视图', value: 'timeline' },
              { label: '表格视图', value: 'table' },
            ]}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: '100%' }}
            options={ACTION_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
          />
          <Input.Search
            placeholder="搜索摘要、操作人、备注、字段变更"
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            style={{ width: '100%' }}
          />
          <RangePicker
            value={dateRange as any}
            onChange={(dates) => setDateRange((dates as any) || null)}
            placeholder={['开始日期', '结束日期']}
            style={{ width: '100%' }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAddModalVisible(true)}
            style={{ minWidth: 120, justifySelf: 'start' }}
          >
            添加记录
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {activeTab === 'table' ? (
          <Table
            rowKey="id"
            size="middle"
            pagination={{ pageSize: 10 }}
            dataSource={filteredItems}
            columns={tableColumns}
            scroll={{ y: 520 }}
          />
        ) : (
          renderTimeline()
        )}
      </Spin>

      <AddHistoryModal
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSuccess={async () => {
          if (!instrument?.id) {
            return;
          }

          const data = await getInstrumentHistory(instrument.id, 200);
          setItems(data as HistoryItem[]);
          setAddModalVisible(false);
        }}
        instrument={instrument}
      />
    </Modal>
  );
};

export default HistoryModal;
