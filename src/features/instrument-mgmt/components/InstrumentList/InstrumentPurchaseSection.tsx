import React from 'react';
import { DatePicker, Form, Input } from 'antd';
import type { InstrumentFormData } from '../../types';

interface InstrumentPurchaseSectionProps {
  formData: InstrumentFormData;
  onInputChange: (fieldName: string, value: any) => void;
  onDateChange: (fieldName: string, date: any) => void;
  safeParseDate: (dateString?: string) => any;
}

const InstrumentPurchaseSection: React.FC<InstrumentPurchaseSectionProps> = ({
  formData,
  onInputChange,
  onDateChange,
  safeParseDate,
}) => {
  return (
    <div className="instrument-form-grid">
      <Form.Item name="purchaseDate" label="采购日期" className="instrument-form-field">
        <DatePicker
          style={{ width: '100%' }}
          onChange={(date) => onDateChange('purchaseDate', date)}
          value={safeParseDate(formData.purchaseDate)}
        />
      </Form.Item>

      <Form.Item name="acceptanceDate" label="验收日期" className="instrument-form-field">
        <DatePicker
          style={{ width: '100%' }}
          onChange={(date) => onDateChange('acceptanceDate', date)}
          value={safeParseDate(formData.acceptanceDate)}
        />
      </Form.Item>

      <Form.Item name="enableDate" label="启用日期" className="instrument-form-field">
        <DatePicker
          style={{ width: '100%' }}
          onChange={(date) => onDateChange('enableDate', date)}
          value={safeParseDate(formData.enableDate)}
        />
      </Form.Item>

      <Form.Item name="purchasePerson" label="采购负责人" className="instrument-form-field">
        <Input
          placeholder="请输入采购负责人"
          onChange={(e) => onInputChange('purchasePerson', e.target.value)}
          value={formData.purchasePerson}
        />
      </Form.Item>
    </div>
  );
};

export default InstrumentPurchaseSection;
