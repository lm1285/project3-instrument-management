import React, { useMemo, useState } from 'react';
import { Button, Input, Modal, Segmented, Space, Table, Tag, Typography } from 'antd';
import { CopyOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { Instrument, InstrumentFormData, InstrumentSetEntryItem } from '../../types';
import InstrumentBatchDetailsEditor from './InstrumentBatchDetailsEditor';
import MeasurementRangeEditor from './MeasurementRangeEditor';
import SimilarInstrumentPickerModal from './SimilarInstrumentPickerModal';
import {
  buildMeasurementRangeDetail,
  buildMeasurementRangeSummary,
  buildMeasurementUncertaintySummary,
  createEmptyMeasurementItem,
  deserializeMeasurementItems,
} from './measurementRangeUtils';

const { Paragraph, Text } = Typography;

const createEmptySetEntry = (): InstrumentSetEntryItem => ({
  id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  model: '',
  serialNumber: '',
  managementNumber: '',
  measureRange: '',
  uncertainty: '',
  metrologicalParameterRange: '',
  measurementItems: [createEmptyMeasurementItem()],
});

const normalizeSetEntry = (entry?: InstrumentSetEntryItem): InstrumentSetEntryItem => {
  const measurementItems =
    Array.isArray(entry?.measurementItems) && entry.measurementItems.length > 0
      ? entry.measurementItems
      : deserializeMeasurementItems(entry?.metrologicalParameterRange, entry?.measureRange);

  return {
    ...createEmptySetEntry(),
    ...entry,
    measurementItems,
    measureRange: buildMeasurementRangeSummary(measurementItems) || String(entry?.measureRange || ''),
    uncertainty:
      buildMeasurementUncertaintySummary(measurementItems) || String(entry?.uncertainty || ''),
    metrologicalParameterRange:
      buildMeasurementRangeDetail(measurementItems) || String(entry?.metrologicalParameterRange || ''),
  };
};

interface InstrumentEntryModeSectionProps {
  formData: InstrumentFormData;
  instruments: Instrument[];
  batchDetails: any[];
  showBatchDetailTable: boolean;
  disabled?: boolean;
  onInputChange: (fieldName: string, value: any) => void;
  onBatchItemChange: (index: number, field: string, value: string) => void;
  onToggleBatchTable: () => void;
}

const InstrumentEntryModeSection: React.FC<InstrumentEntryModeSectionProps> = ({
  formData,
  instruments,
  batchDetails,
  showBatchDetailTable,
  disabled,
  onInputChange,
  onBatchItemChange,
  onToggleBatchTable,
}) => {
  const entryMode = formData.entryMode || 'single';
  const setEntries =
    Array.isArray(formData.setEntries) && formData.setEntries.length > 0
      ? formData.setEntries.map((entry) => normalizeSetEntry(entry))
      : [createEmptySetEntry()];
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [similarTargetEntryId, setSimilarTargetEntryId] = useState<string | null>(null);

  const measurementEditorOptions = useMemo(() => {
    const units = new Set<string>();
    const uncertaintyModes = new Set<string>(['U', 'Urel', 'MPE']);
    const coverageFactors = new Set<string>(['2', '3']);

    instruments.forEach((instrument) => {
      const measurementItems = deserializeMeasurementItems(
        (instrument as any).metrologicalParameterRange,
        instrument.measureRange,
      );

      measurementItems.forEach((item) => {
        if (item.unit) units.add(String(item.unit).trim());
        if (item.uncertaintyMode) uncertaintyModes.add(String(item.uncertaintyMode).trim());
        if (item.coverageFactor) coverageFactors.add(String(item.coverageFactor).trim());
      });
    });

    return {
      units: Array.from(units).filter(Boolean),
      uncertaintyModes: Array.from(uncertaintyModes).filter(Boolean),
      coverageFactors: Array.from(coverageFactors).filter(Boolean),
    };
  }, [instruments]);

  const editingEntry = setEntries.find((entry) => entry.id === editingEntryId) || null;
  const completedEntryCount = setEntries.filter(
    (entry) =>
      String(entry.model || '').trim() &&
      String(entry.serialNumber || '').trim() &&
      String(entry.managementNumber || '').trim() &&
      String(entry.measureRange || '').trim() &&
      String(entry.uncertainty || '').trim(),
  ).length;

  const updateSetEntries = (nextEntries: InstrumentSetEntryItem[]) => {
    onInputChange(
      'setEntries',
      (nextEntries.length > 0 ? nextEntries : [createEmptySetEntry()]).map((entry) =>
        normalizeSetEntry(entry),
      ),
    );
  };

  const updateSetEntry = (
    entryId: string,
    updater: (entry: InstrumentSetEntryItem) => InstrumentSetEntryItem,
  ) => {
    updateSetEntries(
      setEntries.map((entry) => (entry.id === entryId ? normalizeSetEntry(updater(entry)) : entry)),
    );
  };

  const handleSetEntryChange = (
    entryId: string,
    field: keyof InstrumentSetEntryItem,
    value: string,
  ) => {
    updateSetEntry(entryId, (entry) => ({ ...entry, [field]: value }));
  };

  const handleSetEntryMeasurementChange = (
    entryId: string,
    measurementItems: InstrumentSetEntryItem['measurementItems'],
  ) => {
    updateSetEntry(entryId, (entry) => ({
      ...entry,
      measurementItems,
      measureRange: buildMeasurementRangeSummary(measurementItems || []),
      uncertainty: buildMeasurementUncertaintySummary(measurementItems || []),
      metrologicalParameterRange: buildMeasurementRangeDetail(measurementItems || []),
    }));
  };

  const applySimilarToSetEntry = (entryId: string, instrument: Instrument) => {
    const measurementItems = deserializeMeasurementItems(
      (instrument as any).metrologicalParameterRange,
      instrument.measureRange,
    );

    updateSetEntry(entryId, (entry) => ({
      ...entry,
      model: instrument.model || entry.model,
      measurementItems,
      measureRange: buildMeasurementRangeSummary(measurementItems) || instrument.measureRange || '',
      uncertainty:
        buildMeasurementUncertaintySummary(measurementItems) || instrument.uncertainty || '',
      metrologicalParameterRange:
        buildMeasurementRangeDetail(measurementItems) || instrument.metrologicalParameterRange || '',
    }));
    setSimilarTargetEntryId(null);
  };

  return (
    <section className="instrument-form-section">
      <div className="instrument-form-section-head">
        <div>
          <Typography.Title level={4} className="instrument-form-section-title">
            录入方式
          </Typography.Title>
          <Text className="instrument-form-section-subtitle">
            单台、批量和整套录入共用一个入口。整套录入时，通用信息在下方主表单填写，成员差异在成员明细里补充。
          </Text>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented
          block
          disabled={disabled}
          value={entryMode}
          onChange={(value) => onInputChange('entryMode', value)}
          options={[
            { label: '单台录入', value: 'single' },
            { label: '数量与批次', value: 'batch' },
            { label: '整套录入', value: 'set' },
          ]}
        />

        {entryMode === 'batch' ? (
          <div
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 12,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <Text type="secondary">批量模式适合管理编号、出厂编号、证书编号按规则递增录入。</Text>
            <div style={{ marginTop: 12 }}>
              <InstrumentBatchDetailsEditor
                quantity={formData.quantity}
                incrementMode={formData.incrementMode}
                batchDetails={batchDetails}
                showBatchDetailTable={showBatchDetailTable}
                onToggleTable={onToggleBatchTable}
                onQuantityChange={(value) => onInputChange('quantity', value)}
                onIncrementModeChange={(value) => onInputChange('incrementMode', value)}
                onBatchItemChange={onBatchItemChange}
              />
            </div>
          </div>
        ) : null}

        {entryMode === 'set' ? (
          <div className="instrument-set-entry-shell">
            <div className="instrument-set-entry-toolbar">
              <div className="instrument-set-entry-intro">
                <Paragraph className="instrument-set-entry-desc">
                  整套录入按成员台账维护。这里看每个成员的完成情况和编号概况，具体编辑统一在成员明细弹窗中处理。
                </Paragraph>
                <div className="instrument-set-entry-kpis">
                  <div className="instrument-set-entry-kpi">
                    <span className="instrument-set-entry-kpi__label">成员数</span>
                    <strong className="instrument-set-entry-kpi__value">{setEntries.length}</strong>
                  </div>
                  <div className="instrument-set-entry-kpi">
                    <span className="instrument-set-entry-kpi__label">已完善</span>
                    <strong className="instrument-set-entry-kpi__value">{completedEntryCount}</strong>
                  </div>
                  <div className="instrument-set-entry-kpi">
                    <span className="instrument-set-entry-kpi__label">待完善</span>
                    <strong className="instrument-set-entry-kpi__value">
                      {Math.max(0, setEntries.length - completedEntryCount)}
                    </strong>
                  </div>
                </div>
              </div>

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => updateSetEntries([...setEntries, createEmptySetEntry()])}
              >
                新增成员
              </Button>
            </div>

            <Table
              size="small"
              pagination={false}
              rowKey="id"
              scroll={{ x: 1080, y: 320 }}
              dataSource={setEntries}
              columns={[
                {
                  title: '序号',
                  width: 64,
                  render: (_value: unknown, _record: InstrumentSetEntryItem, index: number) =>
                    index + 1,
                },
                {
                  title: '成员信息',
                  dataIndex: 'model',
                  width: 220,
                  render: (text: string, record: InstrumentSetEntryItem, index: number) => (
                    <div className="instrument-set-entry-card">
                      <Text strong className="instrument-set-entry-card__title">
                        {text || `成员 ${index + 1}`}
                      </Text>
                      <Text className="instrument-set-entry-card__meta">
                        {record.measurementItems?.length
                          ? `${record.measurementItems.length} 个测量项目`
                          : '待补充测量项目'}
                      </Text>
                    </div>
                  ),
                },
                {
                  title: '编号信息',
                  width: 260,
                  render: (_value: unknown, record: InstrumentSetEntryItem) => (
                    <div className="instrument-set-entry-ids">
                      <div className="instrument-set-entry-ids__row">
                        <span className="instrument-set-entry-ids__label">管理编号</span>
                        <span className="instrument-set-entry-ids__value">
                          {record.managementNumber || '待填写'}
                        </span>
                      </div>
                      <div className="instrument-set-entry-ids__row">
                        <span className="instrument-set-entry-ids__label">出厂编号</span>
                        <span className="instrument-set-entry-ids__value">
                          {record.serialNumber || '待填写'}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  title: '测量范围概览',
                  dataIndex: 'measureRange',
                  width: 340,
                  render: (text: string, record: InstrumentSetEntryItem) => {
                    const measurementItems = record.measurementItems || [];

                    return (
                      <div className="instrument-set-entry-summary">
                        <Text className="instrument-set-entry-summary-text">
                          {text || '未填写测量项目'}
                        </Text>
                        <div className="instrument-set-entry-summary-tags">
                          <Tag>{measurementItems.length} 个项目</Tag>
                          {record.uncertainty ? (
                            <Tag color="blue">已带不确定度</Tag>
                          ) : (
                            <Tag>待补不确定度</Tag>
                          )}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: '填写状态',
                  width: 120,
                  render: (_value: unknown, record: InstrumentSetEntryItem) => {
                    const isReady =
                      String(record.model || '').trim() &&
                      String(record.serialNumber || '').trim() &&
                      String(record.managementNumber || '').trim() &&
                      String(record.measureRange || '').trim() &&
                      String(record.uncertainty || '').trim();

                    return isReady ? (
                      <Tag color="success">已完善</Tag>
                    ) : (
                      <Tag color="warning">待完善</Tag>
                    );
                  },
                },
                {
                  title: '操作',
                  width: 170,
                  fixed: 'right',
                  render: (_value: unknown, record: InstrumentSetEntryItem) => (
                    <Space size={4} wrap className="instrument-set-entry-actions">
                      <Button
                        type="default"
                        icon={<EditOutlined />}
                        onClick={() => setEditingEntryId(record.id)}
                      >
                        编辑成员
                      </Button>
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        disabled={setEntries.length <= 1}
                        onClick={() =>
                          updateSetEntries(setEntries.filter((entry) => entry.id !== record.id))
                        }
                      />
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </div>

      <Modal
        title={editingEntry ? `成员明细：${editingEntry.managementNumber || editingEntry.model || '未命名成员'}` : '成员明细'}
        open={Boolean(editingEntry)}
        onCancel={() => setEditingEntryId(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setEditingEntryId(null)}>
            完成
          </Button>,
        ]}
        width={1100}
        destroyOnHidden={false}
        className="instrument-management-overlay"
      >
        {editingEntry ? (
          <div className="instrument-set-entry-editor">
            <div className="instrument-form-grid">
              <div className="instrument-form-field">
                <Text className="instrument-set-entry-editor__label">型号规格</Text>
                <Input
                  value={editingEntry.model}
                  placeholder="型号规格"
                  onChange={(event) => handleSetEntryChange(editingEntry.id, 'model', event.target.value)}
                />
              </div>
              <div className="instrument-form-field">
                <Text className="instrument-set-entry-editor__label">出厂编号</Text>
                <Input
                  value={editingEntry.serialNumber}
                  placeholder="出厂编号"
                  onChange={(event) =>
                    handleSetEntryChange(editingEntry.id, 'serialNumber', event.target.value)
                  }
                />
              </div>
              <div className="instrument-form-field">
                <Text className="instrument-set-entry-editor__label">管理编号</Text>
                <Input
                  value={editingEntry.managementNumber}
                  placeholder="管理编号"
                  onChange={(event) =>
                    handleSetEntryChange(editingEntry.id, 'managementNumber', event.target.value)
                  }
                />
              </div>
              <div className="instrument-form-field">
                <Text className="instrument-set-entry-editor__label">测量范围摘要</Text>
                <Input
                  value={editingEntry.measureRange}
                  placeholder="会根据下方测量项目自动生成"
                  readOnly
                />
              </div>
            </div>

            <div className="instrument-set-entry-editor__actions">
              <Button icon={<CopyOutlined />} onClick={() => setSimilarTargetEntryId(editingEntry.id)}>
                套用相似已有数据到当前成员
              </Button>
              <Text type="secondary">
                会复制型号和测量项目，但保留当前成员自己的管理编号、出厂编号。
              </Text>
            </div>

            <div className="instrument-set-entry-editor__measurement">
              <MeasurementRangeEditor
                value={editingEntry.measurementItems}
                onChange={(items) => handleSetEntryMeasurementChange(editingEntry.id, items)}
                unitOptions={measurementEditorOptions.units}
                uncertaintyModeOptions={measurementEditorOptions.uncertaintyModes}
                coverageFactorOptions={measurementEditorOptions.coverageFactors}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      <SimilarInstrumentPickerModal
        visible={Boolean(similarTargetEntryId)}
        instruments={instruments}
        currentType={formData.type}
        onCancel={() => setSimilarTargetEntryId(null)}
        onSelect={(instrument) => {
          if (similarTargetEntryId) {
            applySimilarToSetEntry(similarTargetEntryId, instrument);
          }
        }}
      />
    </section>
  );
};

export default InstrumentEntryModeSection;
