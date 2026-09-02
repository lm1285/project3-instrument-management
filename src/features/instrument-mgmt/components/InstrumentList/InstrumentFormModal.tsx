import React, { useMemo, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, Space, Tag, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { Instrument, InstrumentFormData as FormData, ModalState } from '../../types';
import { useInstrumentFormModal } from '../../hooks/useInstrumentFormModal';
import InstrumentAttachmentUpload from './InstrumentAttachmentUpload';
import InstrumentBasicInfoSection from './InstrumentBasicInfoSection';
import InstrumentDisableReasonModal from './InstrumentDisableReasonModal';
import InstrumentEntryModeSection from './InstrumentEntryModeSection';
import InstrumentMetrologySection from './InstrumentMetrologySection';
import InstrumentPurchaseSection from './InstrumentPurchaseSection';
import InstrumentStatusSection from './InstrumentStatusSection';
import SimilarInstrumentPickerModal from './SimilarInstrumentPickerModal';
import { getAlertConfig, safeParseDate } from './instrumentFormModalUtils';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface InstrumentFormModalProps {
  modalState: ModalState;
  formData: FormData;
  instruments: Instrument[];
  errorReason?: string | null;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onInputChange: (fieldName: string, value: any) => void;
  onFileChange: (file: File | null) => void;
  onApplySimilarInstrument: (instrument: Instrument) => void;
}

const SECTION_ITEMS = [
  { key: 'entry', label: '录入方式' },
  { key: 'basic', label: '基础信息' },
  { key: 'metrology', label: '计量溯源' },
  { key: 'status', label: '状态分组' },
  { key: 'purchase', label: '采购启用' },
  { key: 'notes', label: '附件备注' },
] as const;

const buildSummaryValue = (value?: string | number | null, fallback = '未设置') => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
};

const InstrumentFormModal: React.FC<InstrumentFormModalProps> = ({
  modalState,
  formData,
  instruments,
  errorReason,
  errorMessage,
  onClose,
  onSubmit,
  onInputChange,
  onFileChange,
  onApplySimilarInstrument,
}) => {
  const [similarPickerVisible, setSimilarPickerVisible] = useState(false);

  const {
    alertType1,
    alertType2,
    batchDetails,
    disableReasonVisible,
    form,
    handleAlertTypeChange,
    handleBatchItemChange,
    handleDateChange,
    handleDisableReasonSubmit,
    handleFormSubmit,
    handleGroupModelChange,
    handleGroupNameChange,
    handleGroupRangeChange,
    handleModalClose,
    handleStatusChange,
    isEditMode,
    setDisableReasonVisible,
    setShowBatchDetailTable,
    setTempDisableReason,
    showBatchDetailTable,
    tempDisableReason,
    uniqueModels,
    uniqueNames,
    uniqueRanges,
    uploadProps,
  } = useInstrumentFormModal({
    modalState,
    formData,
    onClose,
    onFileChange,
    onInputChange,
    onSubmit,
  });

  const canUseSimilarPicker = useMemo(
    () => !isEditMode && instruments.length > 0,
    [instruments.length, isEditMode],
  );

  const entryModeSummary = useMemo(() => {
    if (formData.entryMode === 'set') {
      return `整套录入 (${formData.setEntries?.length || 0} 项)`;
    }
    if (formData.entryMode === 'batch') {
      return `数量与批次 (${formData.quantity || 1} 件)`;
    }
    return '单台录入';
  }, [formData.entryMode, formData.quantity, formData.setEntries?.length]);

  const overviewCards = useMemo(
    () => [
      {
        label: '录入模式',
        value: isEditMode ? '编辑已有仪器' : '新增仪器',
      },
      {
        label: '仪器类型',
        value: buildSummaryValue(formData.type, '待选择'),
      },
      {
        label: '录入方式',
        value: entryModeSummary,
      },
      {
        label: '当前状态',
        value: buildSummaryValue(formData.status, '待设置'),
      },
    ],
    [entryModeSummary, formData.status, formData.type, isEditMode],
  );

  const checklist = useMemo(
    () => [
      { label: '已选择仪器类型', done: Boolean(formData.type) },
      { label: '已填写仪器名称', done: Boolean(String(formData.name || '').trim()) },
      {
        label: '已填写管理编号',
        done:
          formData.entryMode === 'set'
            ? Boolean(formData.setEntries?.some((item) => String(item.managementNumber || '').trim()))
            : Boolean(String(formData.managementNumber || '').trim()),
      },
      {
        label: '已填写测量范围',
        done:
          formData.entryMode === 'set'
            ? Boolean(formData.setEntries?.some((item) => String(item.measureRange || '').trim()))
            : Boolean(String(formData.measureRange || '').trim()),
      },
      { label: '已填写存放位置', done: Boolean(String(formData.location || '').trim()) },
      { label: '已设置状态', done: Boolean(String(formData.status || '').trim()) },
    ],
    [
      formData.entryMode,
      formData.location,
      formData.managementNumber,
      formData.measureRange,
      formData.name,
      formData.setEntries,
      formData.status,
      formData.type,
    ],
  );

  const completedCount = checklist.filter((item) => item.done).length;

  const summaryRows = useMemo(
    () => [
      {
        label: '管理编号',
        value:
          formData.entryMode === 'set'
            ? `${formData.setEntries?.length || 0} 条成员明细`
            : buildSummaryValue(formData.managementNumber, '待填写'),
      },
      { label: '测量范围', value: buildSummaryValue(formData.measureRange, '待填写') },
      { label: '存放位置', value: buildSummaryValue(formData.location, '待填写') },
      { label: '所属分组', value: buildSummaryValue(formData.groupName, '未加入') },
      { label: '复校日期', value: buildSummaryValue(formData.nextCalibrationDate, '待计划') },
      { label: '附件状态', value: formData.attachment ? '已上传' : '未上传' },
    ],
    [
      formData.attachment,
      formData.entryMode,
      formData.groupName,
      formData.location,
      formData.managementNumber,
      formData.measureRange,
      formData.nextCalibrationDate,
      formData.setEntries?.length,
    ],
  );

  const scrollToSection = (key: string) => {
    const node = document.getElementById(`instrument-form-section-${key}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Drawer
        title={
          <div className="instrument-form-titlebar">
            <div className="instrument-form-titlegroup">
              <Tag className="instrument-form-mode">{isEditMode ? '编辑模式' : '新增模式'}</Tag>
              <div>
                <Title level={3} className="instrument-form-title">
                  {isEditMode ? '编辑仪器信息' : '新增仪器信息'}
                </Title>
                <Text className="instrument-form-subtitle">
                  先用相似已有数据快速带入，再在下方选择单台、数量与批次或整套录入方式。
                </Text>
              </div>
            </div>

            {canUseSimilarPicker ? (
              <Button
                icon={<CopyOutlined />}
                className="instrument-form-similar-trigger"
                onClick={() => setSimilarPickerVisible(true)}
              >
                相似已有数据
              </Button>
            ) : null}
          </div>
        }
        open={modalState.visible}
        onClose={handleModalClose}
        rootClassName="instrument-management-overlay"
        className="instrument-form-drawer"
        width={1040}
        destroyOnHidden={false}
        footer={
          <div className="instrument-form-footer">
            <Text className="instrument-form-footer-note">
              已完成 {completedCount}/{checklist.length} 项关键信息
            </Text>
            <Space>
              <Button onClick={handleModalClose}>取消</Button>
              <Button type="primary" onClick={handleFormSubmit}>
                保存
              </Button>
            </Space>
          </div>
        }
      >
        {errorReason ? (
          (() => {
            const cfg = getAlertConfig(errorReason, errorMessage);
            return (
              <Alert
                type={cfg.type}
                message={cfg.title}
                description={cfg.desc}
                showIcon
                style={{ marginBottom: 16 }}
              />
            );
          })()
        ) : null}

        <Form form={form} layout="vertical" className="instrument-form-shell">
          <section className="instrument-form-topbar">
            <div className="instrument-form-overview">
              {overviewCards.map((item) => (
                <div key={item.label} className="instrument-form-overview-card">
                  <span className="instrument-form-overview-label">{item.label}</span>
                  <strong className="instrument-form-overview-value">{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="instrument-form-stepnav">
              <span className="instrument-form-stepnav-title">录入流程</span>
              <div className="instrument-form-stepnav-list">
                {SECTION_ITEMS.filter((section) => !isEditMode || section.key !== 'entry').map(
                  (section, index) => (
                    <button
                      key={section.key}
                      type="button"
                      className="instrument-form-step"
                      onClick={() => scrollToSection(section.key)}
                    >
                      <span className="instrument-form-step-index">{index + 1}</span>
                      <span className="instrument-form-step-text">{section.label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </section>

          <div className="instrument-form-layout">
            <div className="instrument-form-main">
              {!isEditMode ? (
                <section id="instrument-form-section-entry" className="instrument-form-section">
                  <InstrumentEntryModeSection
                    formData={formData}
                    instruments={instruments}
                    batchDetails={batchDetails}
                    showBatchDetailTable={showBatchDetailTable}
                    onInputChange={onInputChange}
                    onBatchItemChange={handleBatchItemChange}
                    onToggleBatchTable={() => setShowBatchDetailTable(!showBatchDetailTable)}
                  />
                </section>
              ) : null}

              <section id="instrument-form-section-basic" className="instrument-form-section">
                <div className="instrument-form-section-head">
                  <div>
                    <Title level={4} className="instrument-form-section-title">
                      基础信息
                    </Title>
                    <Text className="instrument-form-section-subtitle">
                      定义仪器的基础身份信息。整套录入时，通用信息在这里填，成员差异在上方整套表格中填。
                    </Text>
                  </div>
                </div>
                <InstrumentBasicInfoSection
                  formData={formData}
                  instruments={instruments}
                  onInputChange={onInputChange}
                />
              </section>

              <section id="instrument-form-section-metrology" className="instrument-form-section">
                <div className="instrument-form-section-head">
                  <div>
                    <Title level={4} className="instrument-form-section-title">
                      计量溯源
                    </Title>
                    <Text className="instrument-form-section-subtitle">
                      维护测量项预览、证书、溯源机构和校准信息，便于查询和到期提醒。
                    </Text>
                  </div>
                </div>
                <InstrumentMetrologySection
                  formData={formData}
                  onInputChange={onInputChange}
                  onDateChange={handleDateChange}
                  safeParseDate={safeParseDate}
                />
              </section>

              <section id="instrument-form-section-status" className="instrument-form-section">
                <div className="instrument-form-section-head">
                  <div>
                    <Title level={4} className="instrument-form-section-title">
                      状态分组
                    </Title>
                    <Text className="instrument-form-section-subtitle">
                      维护库存状态、预警规则和分组归属，保证后续运营与提醒准确。
                    </Text>
                  </div>
                </div>
                <InstrumentStatusSection
                  formData={formData}
                  uniqueNames={uniqueNames}
                  uniqueModels={uniqueModels}
                  uniqueRanges={uniqueRanges}
                  alertType1={alertType1}
                  alertType2={alertType2}
                  onInputChange={onInputChange}
                  onStatusChange={handleStatusChange}
                  onAlertTypeChange={handleAlertTypeChange}
                  onGroupNameChange={handleGroupNameChange}
                  onGroupModelChange={handleGroupModelChange}
                  onGroupRangeChange={handleGroupRangeChange}
                />
              </section>

              <section id="instrument-form-section-purchase" className="instrument-form-section">
                <div className="instrument-form-section-head">
                  <div>
                    <Title level={4} className="instrument-form-section-title">
                      采购启用
                    </Title>
                    <Text className="instrument-form-section-subtitle">
                      把采购、验收与启用节点放在一起，减少跨区域来回填写。
                    </Text>
                  </div>
                </div>
                <InstrumentPurchaseSection
                  formData={formData}
                  onInputChange={onInputChange}
                  onDateChange={handleDateChange}
                  safeParseDate={safeParseDate}
                />
              </section>
            </div>

            <aside id="instrument-form-section-notes" className="instrument-form-side">
              <div className="instrument-form-side-card instrument-form-side-card--compact">
                <Title level={5} className="instrument-form-side-title">
                  录入概览
                </Title>
                <div className="instrument-form-summary-list">
                  {summaryRows.map((row) => (
                    <div key={row.label} className="instrument-form-summary-item">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="instrument-form-checklist">
                  {checklist.map((item) => (
                    <div
                      key={item.label}
                      className={`instrument-form-checklist-item${item.done ? ' is-done' : ''}`}
                    >
                      <span className="instrument-form-checklist-dot" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="instrument-form-side-card">
                <Title level={5} className="instrument-form-side-title">
                  附件资料
                </Title>
                <InstrumentAttachmentUpload
                  uploadProps={uploadProps}
                  attachment={formData.attachment}
                />
              </div>

              <div className="instrument-form-side-card">
                <Title level={5} className="instrument-form-side-title">
                  补充备注
                </Title>
                <Form.Item label="备注" className="instrument-form-field">
                  <TextArea
                    className="instrument-form-textarea"
                    placeholder="可记录使用限制、维护说明、特殊标签等补充信息"
                    rows={5}
                    onChange={(e) => onInputChange('remarks', e.target.value)}
                    value={formData.remarks}
                  />
                </Form.Item>
              </div>
            </aside>
          </div>
        </Form>
      </Drawer>

      <InstrumentDisableReasonModal
        open={disableReasonVisible}
        value={tempDisableReason}
        onChange={setTempDisableReason}
        onOk={handleDisableReasonSubmit}
        onCancel={() => setDisableReasonVisible(false)}
      />

      <SimilarInstrumentPickerModal
        visible={similarPickerVisible}
        instruments={instruments}
        currentType={formData.type}
        onCancel={() => setSimilarPickerVisible(false)}
        onSelect={(instrument) => {
          onApplySimilarInstrument(instrument);
          setSimilarPickerVisible(false);
        }}
      />
    </>
  );
};

export default InstrumentFormModal;
