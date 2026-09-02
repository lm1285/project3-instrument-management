import React from 'react';
import { DatePicker, Form, Input, Select } from 'antd';
import type { InstrumentFormData } from '../../types';

interface InstrumentMetrologySectionProps {
  formData: InstrumentFormData;
  onInputChange: (fieldName: string, value: any) => void;
  onDateChange: (fieldName: string, date: any) => void;
  safeParseDate: (dateString?: string) => any;
}

const InstrumentMetrologySection: React.FC<InstrumentMetrologySectionProps> = ({
  formData,
  onInputChange,
  onDateChange,
  safeParseDate,
}) => {
  return (
    <div className="instrument-form-grid">
      <Form.Item name="traceabilityMethod" label="溯源方式" className="instrument-form-field">
        <Select
          placeholder="请选择溯源方式"
          onChange={(value) => onInputChange('traceabilityMethod', value)}
          value={formData.traceabilityMethod}
          options={[
            { label: '送检', value: '送检' },
            { label: '检定', value: '检定' },
            { label: '校准', value: '校准' },
            { label: '检测', value: '检测' },
          ]}
        />
      </Form.Item>

      <Form.Item name="calibrationInstitution" label="溯源机构" className="instrument-form-field">
        <Input
          placeholder="请输入溯源机构"
          onChange={(e) => onInputChange('calibrationInstitution', e.target.value)}
          value={formData.calibrationInstitution}
        />
      </Form.Item>

      <Form.Item name="certificateNumber" label="证书编号" className="instrument-form-field">
        <Input
          placeholder="请输入证书编号"
          onChange={(e) => onInputChange('certificateNumber', e.target.value)}
          value={formData.certificateNumber}
        />
      </Form.Item>

      <Form.Item name="calibrationCycle" label="校准周期" className="instrument-form-field">
        <Input
          placeholder="例如：12月、1年、30天"
          onChange={(e) => onInputChange('calibrationCycle', e.target.value)}
          value={formData.calibrationCycle}
        />
      </Form.Item>

      <Form.Item name="calibrationDate" label="校准日期" className="instrument-form-field">
        <DatePicker
          style={{ width: '100%' }}
          onChange={(date) => onDateChange('calibrationDate', date)}
          value={safeParseDate(formData.calibrationDate)}
        />
      </Form.Item>

      <Form.Item
        name="nextCalibrationDate"
        label="复校日期"
        className="instrument-form-field"
        tooltip="会根据校准日期和周期自动计算，也可以手动修改。"
      >
        <DatePicker
          style={{ width: '100%' }}
          onChange={(date) => onDateChange('nextCalibrationDate', date)}
          value={safeParseDate(formData.nextCalibrationDate)}
        />
      </Form.Item>
    </div>
  );
};

export default InstrumentMetrologySection;
