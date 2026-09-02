import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, Button, Typography } from 'antd';
import type { ModalProps } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Instrument } from '../../types';

const { TextArea } = Input;
const { Title } = Typography;

interface CheckOutModalProps extends ModalProps {
  instrument?: Instrument | null;
  departments?: string[];
  purposes?: string[];
  onConfirm: (instrumentId: string, operator: string, department: string, purpose: string, expectedReturnTime: string, notes?: string) => void;
}

const CheckOutModal: React.FC<CheckOutModalProps> = ({
  instrument,
  departments = [],
  purposes = [],
  onConfirm,
  ...modalProps
}) => {
  const [form] = Form.useForm();

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
        department: undefined,
        purpose: undefined,
        notes: undefined,
        expectedReturnTime: dayjs().add(7, 'day')
      });
    }
  }, [visible, form]);

  const handleOk = () => {
    form.validateFields().then(values => {
      if (instrument && values.expectedReturnTime) {
        onConfirm(
          instrument.id,
          values.operator,
          values.department,
          values.purpose,
          values.expectedReturnTime.toISOString(),
          values.notes
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
        <ArrowRightOutlined style={{ marginRight: 8, fontSize: 18 }} />
        仪器出库
      </div>}
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          确认出库
        </Button>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical">
        {!instrument && <div style={{ display: 'none' }} />}
        {instrument && (
          <div>
            <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#e6f7ff', borderRadius: 4 }}>
              <Title level={5} style={{ marginBottom: 10, marginTop: 0 }}>仪器信息</Title>
              <p><strong>仪器名称：</strong>{instrument.name}</p>
              <p><strong>型号规格：</strong>{instrument.model}</p>
              <p><strong>管理编号：</strong>{(instrument as any).managementNumber || (instrument as any).management_number}</p>
              <p><strong>当前位置：</strong>{instrument.location}</p>
            </div>
            
            <Form.Item
              name="operator"
              label="操作人"
              rules={[{ required: true, message: '操作人不能为空' }]}
            >
              <Input disabled />
            </Form.Item>
            
            <Form.Item
              name="department"
              label="使用部门"
              rules={[{ required: true, message: '请选择使用部门' }]}
            >
              <Select placeholder="请选择使用部门">
                {departments.map(dept => (
                  <Select.Option key={dept} value={dept}>{dept}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="purpose"
              label="出库用途"
            >
              <Select placeholder="请选择出库用途">
                {purposes.map(purpose => (
                  <Select.Option key={purpose} value={purpose}>{purpose}</Select.Option>
                ))}
                <Select.Option key="other" value="other">其他</Select.Option>
              </Select>
            </Form.Item>
            
            <Form.Item
              name="expectedReturnTime"
              label="预计归还时间"
              rules={[{ required: true, message: '请选择预计归还时间' }]}
            >
              <DatePicker showTime placeholder="请选择预计归还时间" style={{ width: '100%' }} />
            </Form.Item>
            
            <Form.Item
              name="notes"
              label="出库备注"
            >
              <TextArea rows={3} placeholder="请输入出库备注信息" />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default CheckOutModal;
