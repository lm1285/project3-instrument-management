import React, { useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import { Modal, Form, Input, DatePicker, Button } from 'antd';
import type { ModalProps } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface UseInstrumentModalProps extends ModalProps {
  instrument?: Instrument | null;
  onConfirm: (instrumentId: string, purpose: string, usageTime?: number, notes?: string) => void;
}

const UseInstrumentModal: React.FC<UseInstrumentModalProps> = ({
  instrument,
  onConfirm,
  ...modalProps
}) => {
  const [form] = Form.useForm();
  const isMobile = useMediaQuery({ query: '(max-width: 767px)' });

  const visible = modalProps.open;

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        purpose: undefined,
        timeRange: undefined,
        notes: undefined
      });
    }
  }, [visible, form]);

  const handleOk = () => {
    form.validateFields().then(values => {
      if (instrument) {
        const usageHours = values.timeRange ? Math.max(0, (values.timeRange[1].valueOf() - values.timeRange[0].valueOf()) / 3600000) : undefined;
        onConfirm(
          instrument.id,
          values.purpose,
          usageHours,
          values.notes ? `${values.notes}（使用）` : '（使用）'
        );
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
        <PlayCircleOutlined style={{ marginRight: 8, fontSize: 18 }} />
        确认使用仪器
      </div>}
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} style={{ minHeight: '44px', padding: '0 16px' }} size={isMobile ? 'large' : 'middle'}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk} style={{ minHeight: '44px', padding: '0 16px' }} size={isMobile ? 'large' : 'middle'}>
          确认使用
        </Button>
      ]}
      width={isMobile ? '90vw' : 600}
    >
      <Form form={form} layout="vertical" size={isMobile ? 'large' : 'middle'}>
        {!instrument && <div style={{ display: 'none' }} />}
        {instrument && (
          <div>
            <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <h4>仪器信息</h4>
              <p><strong>仪器名称：</strong>{instrument.name}</p>
              <p><strong>型号规格：</strong>{instrument.model}</p>
              <p><strong>管理编号：</strong>{(instrument as any).managementNumber || (instrument as any).management_number}</p>
              <p><strong>仪器状态：</strong>{instrument.status} / {(instrument as any).inOutStatus || (instrument as any).flowStatus || (instrument as any).flow_status}</p>
            </div>
            
            <Form.Item
              name="purpose"
              label="使用用途"
              rules={[{ required: true, message: '请输入使用用途' }]}
              style={{ marginBottom: isMobile ? 16 : 24 }}
            >
              <Input placeholder="请输入使用用途" style={{ minHeight: '44px' }} />
            </Form.Item>
            <Form.Item
              name="timeRange"
              label="使用时间段"
              rules={[{ required: true, message: '请选择使用时间段' }]}
              style={{ marginBottom: isMobile ? 16 : 24 }}
            >
              <RangePicker showTime style={{ width: '100%', minHeight: '44px' }} />
            </Form.Item>
            
            <Form.Item
              name="notes"
              label="备注"
              style={{ marginBottom: isMobile ? 16 : 24 }}
            >
              <TextArea rows={isMobile ? 2 : 4} placeholder="请输入使用备注信息" style={{ minHeight: '80px' }} />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UseInstrumentModal;
