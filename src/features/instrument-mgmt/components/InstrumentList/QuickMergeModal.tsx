import React, { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal } from 'antd';
import { useAlertSyncCheck } from '../../hooks/useAlertSyncCheck';
import { mergeGroupService } from '../../services/mergeGroupService';
import * as instrumentService from '../../services/instrumentService';

interface QuickMergeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedInstrumentIds: string[];
}

const QuickMergeModal: React.FC<QuickMergeModalProps> = ({
  visible,
  onClose,
  onSuccess,
  selectedInstrumentIds,
}) => {
  const { message } = App.useApp();
  const { checkAndSync } = useAlertSyncCheck();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.resetFields();
    }
  }, [form, visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await mergeGroupService.createGroup({
        name: values.name,
        model: values.model,
        description: values.description,
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || '创建合并组失败');
      }

      const group = response.data;
      const instrumentsToProcess = [];

      for (const id of selectedInstrumentIds) {
        const res = await instrumentService.getInstrumentById(id);
        if (res.success && res.data) {
          instrumentsToProcess.push(res.data);
        }
      }

      await checkAndSync(
        { alertMode: group.alertMode, alertLevel: group.alertLevel },
        instrumentsToProcess,
        async (syncSettings) => {
          let successCount = 0;
          for (const id of selectedInstrumentIds) {
            try {
              await mergeGroupService.addMember(group.id, id, syncSettings);
              successCount++;
            } catch (error) {
              console.error(`添加成员 ${id} 失败`, error);
            }
          }

          message.success(`成功创建合并组“${group.name}”并添加了 ${successCount} 个成员`);
          onSuccess();
          onClose();
          form.resetFields();
        },
      );
    } catch (error) {
      console.error(error);
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="创建合并组（从已选中项）"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          确定创建
        </Button>,
      ]}
      width={600}
      forceRender
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="合并组名称"
          rules={[{ required: true, message: '请输入合并组名称' }]}
        >
          <Input placeholder="请输入合并组名称" />
        </Form.Item>
        <Form.Item name="model" label="合并组型号">
          <Input placeholder="请输入合并组型号" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea placeholder="请输入描述信息" rows={3} />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 16 }}>
        <p>已选择 {selectedInstrumentIds.length} 个仪器将被加入此新组。</p>
      </div>
    </Modal>
  );
};

export default QuickMergeModal;
