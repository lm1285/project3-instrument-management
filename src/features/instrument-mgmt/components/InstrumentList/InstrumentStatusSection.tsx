import React from 'react';
import { Form, Input, Select, Typography } from 'antd';
import type { InstrumentFormData } from '../../types';
import { InOutStatus, InstrumentStatus } from '../../../../constants/instrument';
import InstrumentAlertSettings from './InstrumentAlertSettings';

interface InstrumentStatusSectionProps {
  formData: InstrumentFormData;
  uniqueNames: string[];
  uniqueModels: string[];
  uniqueRanges: string[];
  alertType1: string;
  alertType2: string;
  onInputChange: (fieldName: string, value: any) => void;
  onStatusChange: (value: string) => void;
  onAlertTypeChange: (row: 1 | 2, type: string) => void;
  onGroupNameChange: (value: string) => void;
  onGroupModelChange: (value: string) => void;
  onGroupRangeChange: (value: string) => void;
}

const InstrumentStatusSection: React.FC<InstrumentStatusSectionProps> = ({
  formData,
  uniqueNames,
  uniqueModels,
  uniqueRanges,
  alertType1,
  alertType2,
  onInputChange,
  onStatusChange,
  onAlertTypeChange,
  onGroupNameChange,
  onGroupModelChange,
  onGroupRangeChange,
}) => {
  return (
    <div className="instrument-form-grid">
      <Form.Item name="department" label="科室" className="instrument-form-field">
        <Select
          placeholder="请选择科室"
          onChange={(value) => onInputChange('department', value)}
          value={formData.department}
          options={[
            { label: '理化', value: '理化' },
            { label: '热工', value: '热工' },
          ]}
        />
      </Form.Item>

      <Form.Item name="location" label="存放位置" className="instrument-form-field">
        <Input
          placeholder="请输入存放位置"
          onChange={(e) => onInputChange('location', e.target.value)}
          value={formData.location}
        />
      </Form.Item>

      <Form.Item name="status" label="仪器状态" className="instrument-form-field">
        <Select
          placeholder="请选择仪器状态"
          onChange={onStatusChange}
          value={formData.status}
          options={[
            { label: InstrumentStatus.IN_USE, value: InstrumentStatus.IN_USE },
            { label: InstrumentStatus.OVERDUE, value: InstrumentStatus.OVERDUE },
            { label: InstrumentStatus.USED, value: InstrumentStatus.USED },
            { label: InstrumentStatus.STOPPED, value: InstrumentStatus.STOPPED },
            { label: InstrumentStatus.SCRAPPED, value: InstrumentStatus.SCRAPPED },
          ]}
        />
      </Form.Item>

      <Form.Item name="inOutStatus" label="出入库状态" className="instrument-form-field">
        <Select
          placeholder="请选择出入库状态"
          onChange={(value) => onInputChange('inOutStatus', value)}
          value={formData.inOutStatus}
          options={[
            { label: InOutStatus.IN_STOCK, value: InOutStatus.IN_STOCK },
            { label: InOutStatus.OUT_STOCK, value: InOutStatus.OUT_STOCK },
            { label: InOutStatus.OUT_FOR_USE, value: InOutStatus.OUT_FOR_USE },
          ]}
        />
      </Form.Item>

      <Form.Item
        label="预警设置"
        className="instrument-form-field instrument-form-field--wide"
      >
        <InstrumentAlertSettings
          alertType1={alertType1}
          alertType2={alertType2}
          formData={formData}
          onAlertTypeChange={onAlertTypeChange}
          onInputChange={onInputChange}
        />
      </Form.Item>

      <Form.Item
        label="套系/聚合说明"
        className="instrument-form-field instrument-form-field--wide"
      >
        <Typography.Text type="secondary">
          单台录入时，如果当前仪器属于某一整套，只要为同一套成员填写一致的套系名称，即可在工作台中聚合查看；型号规格和测量范围可继续细分同一套下的不同成员。
        </Typography.Text>
      </Form.Item>

      <Form.Item name="groupName" label="套系名称" className="instrument-form-field">
        <Input
          list="instrument-group-name-options"
          placeholder="请输入套系名称，相同套系请保持一致"
          value={formData.groupName || ''}
          onChange={(e) => onGroupNameChange(e.target.value)}
        />
        <datalist id="instrument-group-name-options">
          {uniqueNames.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Form.Item>

      <Form.Item name="groupModel" label="套系型号规格" className="instrument-form-field">
        <Input
          list="instrument-group-model-options"
          placeholder="请输入套系型号规格，可留空"
          value={formData.groupModel || ''}
          onChange={(e) => onGroupModelChange(e.target.value)}
          disabled={!formData.groupName}
        />
        <datalist id="instrument-group-model-options">
          {uniqueModels.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Form.Item>

      <Form.Item
        name="groupMeasureRange"
        label="套系测量范围"
        className="instrument-form-field instrument-form-field--wide"
      >
        <Input
          list="instrument-group-range-options"
          placeholder="请输入套系测量范围，可留空"
          value={formData.groupMeasureRange || ''}
          onChange={(e) => onGroupRangeChange(e.target.value)}
          disabled={!formData.groupName}
        />
        <datalist id="instrument-group-range-options">
          {uniqueRanges.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Form.Item>
    </div>
  );
};

export default InstrumentStatusSection;
