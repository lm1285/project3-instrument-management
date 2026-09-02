import React, { useEffect, useState } from 'react';
import { AutoComplete, Form, Input, Select, type FormInstance } from 'antd';
import type { MergeGroup } from '../../services/mergeGroupService';

interface MergeGroupFormProps {
  form: FormInstance;
  initialValues?: Partial<MergeGroup>;
  activeTab?: string;
  showAlertFields?: boolean;
  showDescription?: boolean;
}

const { Option } = Select;

export const MergeGroupForm: React.FC<MergeGroupFormProps> = ({
  form,
  initialValues,
  activeTab,
  showAlertFields = true,
  showDescription = true,
}) => {
  const [alertType1, setAlertType1] = useState<string>('none');
  const [alertType2, setAlertType2] = useState<string>('none');

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);

      let t1 = 'time';
      let t2 = 'none';

      if (initialValues.alertLevel) {
        if (initialValues.alertLevel.startsWith('{')) {
          try {
            const parsed = JSON.parse(initialValues.alertLevel);
            const hasTime = !!parsed.time;
            const hasCap = !!parsed.capacity;

            if (hasTime && !hasCap) {
              t1 = 'time';
              t2 = 'none';
            } else if (!hasTime && hasCap) {
              t1 = 'capacity';
              t2 = 'none';
            } else if (hasTime && hasCap) {
              t1 = 'time';
              t2 = 'capacity';
            } else {
              t1 = 'none';
              t2 = 'none';
            }

            form.setFieldsValue({
              timeAlert: parsed.time,
              capacityAlert: parsed.capacity,
            });
          } catch {
            // ignore malformed legacy value
          }
        } else {
          t1 = 'time';
          t2 = 'none';
          form.setFieldsValue({
            timeAlert: initialValues.alertLevel,
          });
        }
      } else {
        t1 = 'none';
        t2 = 'none';
      }

      setAlertType1(t1);
      setAlertType2(t2);
    } else {
      setAlertType1('none');
      setAlertType2('none');
      if (activeTab) {
        form.setFieldsValue({ type: activeTab });
      }
    }
  }, [initialValues, activeTab, form]);

  const handleAlertTypeChange = (row: 1 | 2, newType: string) => {
    const oldType = row === 1 ? alertType1 : alertType2;
    const otherRowType = row === 1 ? alertType2 : alertType1;

    if (row === 1) setAlertType1(newType);
    else setAlertType2(newType);

    if (newType === 'none' && oldType !== 'none') {
      if (otherRowType !== oldType && (oldType === 'time' || oldType === 'capacity')) {
        try {
          const currentJson = JSON.parse(form.getFieldValue('alertLevel') || '{}');
          delete currentJson[oldType];
          form.setFieldsValue({ alertLevel: JSON.stringify(currentJson) });
        } catch (error) {
          console.error(error);
        }
      }
    }
  };

  const updateAlertLevel = (type: 'time' | 'capacity', val: string) => {
    try {
      const currentJson = JSON.parse(form.getFieldValue('alertLevel') || '{}');
      currentJson[type] = val;
      form.setFieldsValue({ alertLevel: JSON.stringify(currentJson) });
    } catch {
      form.setFieldsValue({ alertLevel: JSON.stringify({ [type]: val }) });
    }
  };

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="name"
        label="合并组名称"
        rules={[{ required: true, message: '请输入合并组名称' }]}
      >
        <Input placeholder="请输入名称" />
      </Form.Item>

      <Form.Item name="model" label="合并组型号规格">
        <Input placeholder="请输入型号（可选）" />
      </Form.Item>

      <Form.Item name="measurementRange" label="合并组测量范围">
        <Input placeholder="请输入测量范围（可选）" />
      </Form.Item>

      {showAlertFields && (
        <Form.Item label="预警设置">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Select
                value={alertType1}
                onChange={(val) => handleAlertTypeChange(1, val)}
                style={{ width: 80, marginRight: 8 }}
              >
                <Option value="none">无</Option>
                <Option value="time">时间</Option>
                <Option value="capacity">容量</Option>
              </Select>
              {alertType1 !== 'none' && (
                <Form.Item
                  name={alertType1 === 'time' ? 'timeAlert' : 'capacityAlert'}
                  noStyle
                  rules={[{ required: true, message: '请输入值' }]}
                >
                  <AutoComplete
                    style={{ flex: 1 }}
                    options={alertType1 === 'time'
                      ? [
                          { value: '0', label: '0天' },
                          { value: '7', label: '7天' },
                          { value: '14', label: '14天' },
                          { value: '21', label: '21天' },
                          { value: '30', label: '30天' },
                        ]
                      : [
                          { value: '20', label: '20%' },
                          { value: '40', label: '40%' },
                          { value: '60', label: '60%' },
                          { value: '80', label: '80%' },
                        ]}
                    onChange={(val) => updateAlertLevel(alertType1 as 'time' | 'capacity', val)}
                  >
                    <Input
                      placeholder={alertType1 === 'time' ? '请输入天数' : '请输入百分比'}
                      suffix={alertType1 === 'time' ? '天' : '%'}
                    />
                  </AutoComplete>
                </Form.Item>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Select
                value={alertType2}
                onChange={(val) => handleAlertTypeChange(2, val)}
                style={{ width: 80, marginRight: 8 }}
              >
                <Option value="none">无</Option>
                <Option value="time">时间</Option>
                <Option value="capacity">容量</Option>
              </Select>
              {alertType2 !== 'none' && (
                <Form.Item
                  name={alertType2 === 'time' ? 'timeAlert' : 'capacityAlert'}
                  noStyle
                  rules={[{ required: true, message: '请输入值' }]}
                >
                  <AutoComplete
                    style={{ flex: 1 }}
                    options={alertType2 === 'time'
                      ? [
                          { value: '0', label: '0天' },
                          { value: '7', label: '7天' },
                          { value: '14', label: '14天' },
                          { value: '21', label: '21天' },
                          { value: '30', label: '30天' },
                        ]
                      : [
                          { value: '20', label: '20%' },
                          { value: '40', label: '40%' },
                          { value: '60', label: '60%' },
                          { value: '80', label: '80%' },
                        ]}
                    onChange={(val) => updateAlertLevel(alertType2 as 'time' | 'capacity', val)}
                  >
                    <Input
                      placeholder={alertType2 === 'time' ? '请输入天数' : '请输入百分比'}
                      suffix={alertType2 === 'time' ? '天' : '%'}
                    />
                  </AutoComplete>
                </Form.Item>
              )}
            </div>

            <Form.Item name="alertLevel" noStyle hidden>
              <Input />
            </Form.Item>
          </div>
        </Form.Item>
      )}

      {showDescription && (
        <Form.Item name="description" label="备注">
          <Input.TextArea placeholder="请输入备注（可选）" />
        </Form.Item>
      )}
    </Form>
  );
};
