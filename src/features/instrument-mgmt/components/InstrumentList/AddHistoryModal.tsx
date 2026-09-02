import React, { useEffect, useState } from 'react';
import { DatePicker, Form, Input, Modal, Select, message } from 'antd';
import dayjs from 'dayjs';
import useAuth from '../../../auth/hooks/useAuth';
import { addInstrumentHistoryRecord } from '../../services/instrumentService';
import type { Instrument } from '../../types';

interface AddHistoryModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
  instrument: Instrument | null;
}

const RECORD_TYPES = [
  { label: '备注', value: '备注' },
  { label: '校准', value: '校准' },
  { label: '维修', value: '维修' },
  { label: '保养', value: '保养' },
  { label: '故障', value: '故障' },
  { label: '其他', value: '其他' },
];

const AddHistoryModal: React.FC<AddHistoryModalProps> = ({
  open,
  onCancel,
  onSuccess,
  instrument,
}) => {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      type: '备注',
      operator: user?.username || '系统',
      timestamp: dayjs(),
    });
  }, [form, open, user]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!instrument?.id) {
        return;
      }

      setSubmitting(true);
      const result = await addInstrumentHistoryRecord(instrument.id, {
        type: values.type,
        operator: values.operator,
        detail: values.detail,
        timestamp: values.timestamp?.toISOString(),
      });

      if (!result.success) {
        message.error(result.message || '添加日志失败');
        return;
      }

      message.success('日志已添加');
      await onSuccess();
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        console.error('Submit history failed:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="添加仪器日志"
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="type"
          label="操作类型"
          rules={[{ required: true, message: '请选择操作类型' }]}
        >
          <Select options={RECORD_TYPES} />
        </Form.Item>

        <Form.Item
          name="timestamp"
          label="操作时间"
          rules={[{ required: true, message: '请选择操作时间' }]}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="operator"
          label="操作人"
          rules={[{ required: true, message: '请输入操作人' }]}
        >
          <Input placeholder="如：admin / 张三" />
        </Form.Item>

        <Form.Item
          name="detail"
          label="日志内容"
          rules={[{ required: true, message: '请输入日志内容' }]}
          extra="建议记录本次处理结论、原因、影响范围和后续动作。"
        >
          <Input.TextArea
            rows={5}
            placeholder="例如：完成外检校准，证书编号 XXX，复校日期更新为 2026-06-30。"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AddHistoryModal;
