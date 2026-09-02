import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Input, Select, Button, Typography, Rate, Space, Checkbox } from 'antd';
import type { ModalProps } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';
import apiClient from '../../../../services/apiClient';

const { TextArea } = Input;
const { Title } = Typography;

interface CheckInModalProps extends ModalProps {
    instrument?: Instrument | null;
    locations?: string[];
    onConfirm: (instrumentId: string, operator: string, location: string, condition: number, usageTime?: number, notes?: string, capacityPercent?: number, capacityValue?: number, isConsumed?: boolean) => void;
  }

const CheckInModal: React.FC<CheckInModalProps> = ({
  instrument,
  locations = [],
  onConfirm,
  ...modalProps
}) => {
  const [form] = Form.useForm();
  
  const [baseCapacity, setBaseCapacity] = useState<number | null>(null);
  const [unit, setUnit] = useState<string>('');
  
  const visible = modalProps.open;

  useEffect(() => {
    if (visible) {
      let operatorName = '系统操作员';
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          operatorName = user.username || '系统操作员';
        } else {
          operatorName = localStorage.getItem('username') || '系统操作员';
        }
      } catch (e) {
        console.error('获取用户信息失败', e);
      }

      form.setFieldsValue({
        operator: operatorName,
        location: undefined,
        status: undefined,
        notes: undefined
      });
    }
  }, [visible, form]);

  useEffect(() => {
    const id = instrument?.id;
    if (!id || !modalProps.open) return;
    (async () => {
      try {
        const detail = await apiClient.get(`/instruments/${id}`);
        const inst: any = detail?.data || {};
        const current = Number(inst?.currentCapacity ?? 0) || 0;
        const initial = Number(inst?.initialCapacity ?? 0) || 0;
        const baseline = (typeof inst?.currentCapacity === 'number') ? current : (initial > 0 ? initial : current);
        setBaseCapacity(baseline);
        setUnit(String(inst?.unit || ''));
      } catch {}
    })();
  }, [instrument?.id, modalProps.open]);

  const capacityOptions = useMemo(() => {
    const b = baseCapacity ?? 0;
    const fmt = (v: number) => {
      const num = Number(v.toFixed(2));
      return `${num}${unit ? ` ${unit}` : ''}`;
    };
    return [
      { value: 0, text: '已用完' },
      { value: 20, text: `20%（${fmt(b * 0.20)}）` },
      { value: 50, text: `50%（${fmt(b * 0.50)}）` },
      { value: 80, text: `80%（${fmt(b * 0.80)}）` },
      { value: 100, text: `未使用（${fmt(b)}）` }
    ];
  }, [baseCapacity, unit]);

  const handleOk = () => {
    form.validateFields().then(values => {
      if (instrument) {
        const isStd = (instrument.type || '').trim().toLowerCase() === '标准物质';
        const capacityPercent = isStd ? (values.capacityPercent !== undefined ? Number(values.capacityPercent) : undefined) : undefined;
        const capacityValue = isStd ? (values.capacityValue !== undefined ? Number(values.capacityValue) : undefined) : undefined;
        if (isStd) {
          if (capacityPercent === undefined && (capacityValue === undefined || isNaN(Number(capacityValue)))) {
            form.setFields([{
              name: 'capacityPercent',
              errors: ['请选择或输入当前容量']
            }]);
            return;
          }
        }
        if (isStd) {
          const location = locations[0] || '默认位置';
          const condition = 5;
          onConfirm(instrument.id, values.operator, location, condition, undefined, undefined, capacityPercent, capacityValue, values.isConsumed);
        } else {
          onConfirm(
            instrument.id,
            values.operator,
            values.location,
            values.condition,
            values.usageTime,
            values.notes,
            capacityPercent,
            undefined,
            false
          );
        }
        form.resetFields();
      }
    });
  };

  const handleCancel = () => {
    form.resetFields();
    modalProps.onCancel?.({} as React.MouseEvent<HTMLButtonElement>);
  };

  return (
    <Modal
      {...modalProps}
      forceRender
      title={<div style={{ display: 'flex', alignItems: 'center' }}>
        <ArrowLeftOutlined style={{ marginRight: 8, fontSize: 18 }} />
        仪器入库
      </div>}
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          确认入库
        </Button>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        {!instrument && <div style={{ display: 'none' }} />}
        {instrument && (
          <div>
            <Form.Item name="operator" label="操作人" rules={[{ required: true, message: '请输入操作人姓名' }]}> 
              <Input disabled />
            </Form.Item>
            {((instrument.type || '').trim().toLowerCase() !== '标准物质') ? (
              <>
                <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f6ffed', borderRadius: 4 }}>
                  <Title level={5} style={{ marginBottom: 10, marginTop: 0 }}>仪器信息</Title>
                  <p><strong>仪器名称：</strong>{instrument.name}</p>
                  <p><strong>型号规格：</strong>{instrument.model}</p>
                  <p><strong>管理编号：</strong>{(instrument as any).managementNumber || (instrument as any).management_number}</p>
                  <p><strong>出入库状态：</strong>{(instrument as any).flowStatus || (instrument as any).flow_status}</p>
                </div>
                <Form.Item name="location" label="存放位置" rules={[{ required: true, message: '请选择存放位置' }]}> 
                  <Select placeholder="请选择存放位置">
                    {locations.map(location => (<Select.Option key={location} value={location}>{location}</Select.Option>))}
                  </Select>
                </Form.Item>
                <Form.Item name="condition" label="仪器状况评分" rules={[{ required: true, message: '请对仪器状况进行评分' }]} initialValue={5}> 
                  <Space direction="vertical">
                    <Rate allowHalf defaultValue={5} />
                    <div style={{ color: '#8c8c8c', fontSize: 12 }}>5分：良好 | 4分：一般 | 3分：需维护 | 2分：故障 | 1分：严重故障</div>
                  </Space>
                </Form.Item>
                <Form.Item name="usageTime" label="累计使用时间(小时)"> 
                  <Input placeholder="请输入累计使用时间" type="number" min={0} />
                </Form.Item>
                <Form.Item name="notes" label="入库备注"> 
                  <TextArea rows={3} placeholder="请输入入库备注信息，如使用情况、维护记录等" />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="capacityPercent" label="当前容量"> 
                  <Select placeholder="请选择当前容量" onChange={(val) => {
                    if (val === 0) {
                      form.setFieldsValue({ isConsumed: true, capacityValue: 0 });
                    } else if (val === 100) {
                       form.setFieldsValue({ isConsumed: false });
                       form.setFieldsValue({ capacityValue: undefined });
                    } else {
                      form.setFieldsValue({ isConsumed: false });
                      // Calculate capacityValue based on percent
                      if (baseCapacity) {
                        const valNum = Number(val);
                        const calculated = Number((baseCapacity * valNum / 100).toFixed(2));
                        form.setFieldsValue({ capacityValue: calculated });
                      }
                    }
                  }}>
                    {capacityOptions.map(opt => (
                      <Select.Option key={opt.value} value={opt.value}>{opt.text}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="capacityValue" label={`或手动输入容量${unit ? `（单位：${unit}）` : ''}`}> 
                  <Input placeholder="请输入容量数值" type="number" min={0} onChange={() => form.setFieldsValue({ isConsumed: false })} />
                </Form.Item>
                <Form.Item name="isConsumed" valuePropName="checked">
                  <Checkbox onChange={(e) => {
                    if (e.target.checked) {
                      form.setFieldsValue({ capacityPercent: 0, capacityValue: 0 });
                    }
                  }}>
                    已使用完（标记为已使用）
                  </Checkbox>
                </Form.Item>
              </>
            )}
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default CheckInModal;
