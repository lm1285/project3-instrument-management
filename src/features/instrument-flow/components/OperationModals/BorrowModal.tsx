import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Button } from 'antd';
import type { ModalProps } from 'antd';
import { UserOutlined, SwapOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';

interface BorrowModalProps extends ModalProps {
  instrument?: Instrument | null;
  onConfirm: (
    instrumentId: string, 
    borrower: string, 
    type: 'in' | 'out', 
    notes?: string
  ) => void;
}

const BorrowModal: React.FC<BorrowModalProps> = ({
  instrument,
  onConfirm,
  ...modalProps
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (modalProps.open) {
      form.resetFields();
      form.setFieldsValue({
        type: 'out' // Default to check-out
      });
    }
  }, [modalProps.open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      if (instrument) {
        await onConfirm(
          instrument.id,
          values.borrower,
          values.type,
          values.notes
        );
        form.resetFields();
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (e: React.MouseEvent<HTMLButtonElement>) => {
    form.resetFields();
    modalProps.onCancel?.(e);
  };

  return (
    <Modal
      {...modalProps}
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SwapOutlined style={{ marginRight: 8, fontSize: 18 }} />
          仪器借用
        </div>
      }
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleOk}>
          保存
        </Button>
      ]}
      width={500}
    >
      <Form form={form} layout="vertical">
        {instrument && (
          <div style={{ marginBottom: 20, padding: 12, backgroundColor: '#f0f2f5', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontWeight: 'bold' }}>{instrument.name}</span>
              <span style={{ color: '#666' }}>{instrument.managementNumber}</span>
            </div>
            <div style={{ color: '#888', fontSize: '12px' }}>
              当前状态: {instrument.status}
            </div>
          </div>
        )}

        <Form.Item
          name="borrower"
          label="借用人"
          rules={[{ required: true, message: '请输入借用人姓名' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="请输入借用人姓名" />
        </Form.Item>

        <Form.Item
          name="type"
          label="出入库操作"
          rules={[{ required: true, message: '请选择操作类型' }]}
        >
          <Radio.Group buttonStyle="solid">
            <Radio.Button value="out">出库 (借出)</Radio.Button>
            <Radio.Button value="in">入库 (归还)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="notes"
          label="备注"
        >
          <Input.TextArea rows={3} placeholder="可选备注信息" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BorrowModal;
