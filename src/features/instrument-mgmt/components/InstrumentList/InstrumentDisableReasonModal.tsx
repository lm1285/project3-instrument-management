import React from 'react';
import { Form, Input, Modal } from 'antd';

const { TextArea } = Input;

interface InstrumentDisableReasonModalProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onOk: () => void;
  onCancel: () => void;
}

const InstrumentDisableReasonModal: React.FC<InstrumentDisableReasonModalProps> = ({
  open,
  value,
  onChange,
  onOk,
  onCancel,
}) => {
  return (
    <Modal title="停用原因" open={open} onOk={onOk} onCancel={onCancel}>
      <Form layout="vertical">
        <Form.Item label="请输入停用原因" required>
          <TextArea
            rows={4}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="例如：仪器损坏、报废、送检中等"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default InstrumentDisableReasonModal;
