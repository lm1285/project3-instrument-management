import React, { useEffect, useMemo } from 'react';
import { Form, Input, InputNumber, Select } from 'antd';
import type { Instrument, InstrumentFormData } from '../../types';
import { InstrumentType } from '../../../../constants/instrument';
import MeasurementRangeEditor from './MeasurementRangeEditor';
import { deserializeMeasurementItems } from './measurementRangeUtils';

interface InstrumentBasicInfoSectionProps {
  formData: InstrumentFormData;
  instruments?: Instrument[];
  onInputChange: (fieldName: string, value: any) => void;
}

const InstrumentBasicInfoSection: React.FC<InstrumentBasicInfoSectionProps> = ({
  formData,
  instruments = [],
  onInputChange,
}) => {
  const shouldShowCapacityFields = formData.type === InstrumentType.STANDARD_MATERIAL;

  const measurementEditorOptions = useMemo(() => {
    const units = new Set<string>();
    const uncertaintyModes = new Set<string>(['U', 'Urel']);
    const coverageFactors = new Set<string>(['2', '3']);

    instruments.forEach((instrument) => {
      const measurementItems = deserializeMeasurementItems(
        (instrument as any).metrologicalParameterRange,
        instrument.measureRange,
      );

      measurementItems.forEach((item) => {
        if (item.unit) {
          units.add(String(item.unit).trim());
        }
        if (item.uncertaintyMode) {
          uncertaintyModes.add(String(item.uncertaintyMode).trim());
        }
        if (item.coverageFactor) {
          coverageFactors.add(String(item.coverageFactor).trim());
        }
      });
    });

    return {
      units: Array.from(units).filter(Boolean),
      uncertaintyModes: Array.from(uncertaintyModes).filter(Boolean),
      coverageFactors: Array.from(coverageFactors).filter(Boolean),
    };
  }, [instruments]);

  useEffect(() => {
    if (shouldShowCapacityFields) {
      return;
    }

    if (
      formData.initialCapacity === undefined &&
      formData.currentCapacity === undefined &&
      !formData.unit
    ) {
      return;
    }

    onInputChange('initialCapacity', undefined);
    onInputChange('currentCapacity', undefined);
    onInputChange('unit', undefined);
  }, [
    formData.currentCapacity,
    formData.initialCapacity,
    formData.unit,
    onInputChange,
    shouldShowCapacityFields,
  ]);

  return (
    <div className="instrument-form-grid">
      <Form.Item
        name="type"
        label="仪器类型"
        className="instrument-form-field"
        rules={[{ required: true, message: '请选择仪器类型' }]}
      >
        <Select
          placeholder="请选择仪器类型"
          onChange={(value) => onInputChange('type', value)}
          value={formData.type}
          options={[
            { label: InstrumentType.STANDARD_DEVICE, value: InstrumentType.STANDARD_DEVICE },
            { label: InstrumentType.STANDARD_MATERIAL, value: InstrumentType.STANDARD_MATERIAL },
            { label: InstrumentType.AUXILIARY_DEVICE, value: InstrumentType.AUXILIARY_DEVICE },
          ]}
        />
      </Form.Item>

      <Form.Item
        name="name"
        label="仪器名称"
        className="instrument-form-field"
        rules={[{ required: true, message: '请输入仪器名称' }]}
      >
        <Input
          placeholder="例如：pH 计、电导率标准物质、砝码组"
          onChange={(e) => onInputChange('name', e.target.value)}
          value={formData.name}
        />
      </Form.Item>

      <Form.Item name="model" label="型号规格" className="instrument-form-field">
        <Input
          placeholder="请输入型号规格"
          onChange={(e) => onInputChange('model', e.target.value)}
          value={formData.model}
        />
      </Form.Item>

      <Form.Item name="manufacturer" label="生产厂家" className="instrument-form-field">
        <Input
          placeholder="请输入生产厂家"
          onChange={(e) => onInputChange('manufacturer', e.target.value)}
          value={formData.manufacturer}
        />
      </Form.Item>

      <Form.Item name="managementNumber" label="管理编号" className="instrument-form-field">
        <Input
          placeholder="请输入管理编号"
          onChange={(e) => onInputChange('managementNumber', e.target.value)}
          value={formData.managementNumber}
        />
      </Form.Item>

      <Form.Item name="serialNumber" label="出厂编号" className="instrument-form-field">
        <Input
          placeholder="请输入出厂编号"
          onChange={(e) => onInputChange('serialNumber', e.target.value)}
          value={formData.serialNumber || ''}
        />
      </Form.Item>

      <Form.Item label="测量范围" className="instrument-form-field instrument-form-field--wide">
        <MeasurementRangeEditor
          value={formData.measurementItems}
          onChange={(items) => onInputChange('measurementItems', items)}
          unitOptions={measurementEditorOptions.units}
          uncertaintyModeOptions={measurementEditorOptions.uncertaintyModes}
          coverageFactorOptions={measurementEditorOptions.coverageFactors}
        />
      </Form.Item>

      {shouldShowCapacityFields ? (
        <Form.Item label="库存容量" className="instrument-form-field instrument-form-field--wide">
          <div className="instrument-form-inline-double">
            <div className="instrument-form-inline-pair">
              <Form.Item name="initialCapacity" label="初始容量" className="instrument-form-field">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="请输入初始容量"
                  onChange={(value) => onInputChange('initialCapacity', value ?? undefined)}
                  value={formData.initialCapacity as number | null | undefined}
                />
              </Form.Item>
              <Form.Item name="unit" label="单位" className="instrument-form-field">
                <Input
                  placeholder="例如：瓶、支、mL"
                  onChange={(e) => onInputChange('unit', e.target.value)}
                  value={formData.unit}
                />
              </Form.Item>
            </div>

            <div className="instrument-form-inline-pair">
              <Form.Item name="currentCapacity" label="当前容量" className="instrument-form-field">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="请输入当前容量"
                  onChange={(value) => onInputChange('currentCapacity', value ?? undefined)}
                  value={formData.currentCapacity as number | null | undefined}
                />
              </Form.Item>
              <Form.Item label="当前单位" className="instrument-form-field">
                <Input value={formData.unit} disabled placeholder="与上方单位保持一致" />
              </Form.Item>
            </div>
          </div>
        </Form.Item>
      ) : null}
    </div>
  );
};

export default InstrumentBasicInfoSection;
