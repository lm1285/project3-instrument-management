import React, { useState } from 'react';
import { Modal, Form } from 'antd';
import { MergeGroup } from '../../services/mergeGroupService';
import { MergeGroupForm } from './MergeGroupForm';

interface MergeGroupFormModalProps {
  visible: boolean;
  title: string;
  initialValues?: Partial<MergeGroup>;
  activeTab?: string; // '标准器' | '标准物质' | '辅助设备'
  onCancel: () => void;
  onSubmit: (values: any) => Promise<void>;
}

export const MergeGroupFormModal: React.FC<MergeGroupFormModalProps> = ({
  visible,
  title,
  initialValues,
  activeTab,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onSubmit(values);
      setSubmitting(false);
    } catch (error) {
      console.error('Validation failed:', error);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      open={visible}
      rootClassName="instrument-management-overlay"
      onOk={handleOk}
      okText="确定"
      cancelText="取消"
      onCancel={onCancel}
      maskClosable={false}
      confirmLoading={submitting}
      forceRender
      zIndex={1001}
    >
      <MergeGroupForm
        form={form}
        initialValues={initialValues}
        activeTab={activeTab}
      />
    </Modal>
  );
};
