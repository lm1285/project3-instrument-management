import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, Select, Button } from 'antd';
import type { ModalProps } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';



interface ReservationModalProps extends ModalProps {
  instrument?: Instrument | null;
  onConfirm: (instrumentId: string, userId: string, action: '出库' | '入库', startTime: string, endTime: string, notes?: string) => void;
}

const ReservationModal: React.FC<ReservationModalProps> = ({ instrument, onConfirm, ...modalProps }) => {
  const [form] = Form.useForm();
  const [action, setAction] = React.useState<'出库' | '入库'>('出库');

  const getOperatorName = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        // 显示账号(username)
        return user.username || '系统操作员';
      }
      return localStorage.getItem('username') || '系统操作员';
    } catch {
      return '系统操作员';
    }
  };

  const visible = modalProps.open;

  useEffect(() => {
    if (visible) {
      const currentOperator = getOperatorName();
      form.setFieldsValue({
        userId: currentOperator,
        action: '出库',
        reservationTime: undefined,
        notes: undefined
      });
    }
  }, [visible, form]);

  const handleOk = () => {
    form.validateFields().then(values => {
      if (instrument && values.reservationTime) {
        // 根据操作类型设置开始和结束时间
        // 如果是出库预约，时间点作为开始时间，结束时间默认为开始时间后2小时（仅作示例，实际业务逻辑可能不同）
        // 如果是入库预约，时间点作为结束时间，开始时间默认为当前时间（仅作示例）
        // 这里为了简化，我们暂时将该时间点同时作为开始和结束时间传递，或者根据业务需求调整
        // 根据用户需求：只填写一个时间，通过预约操作判断是入库还是出库时间
        
        const time = values.reservationTime;
        let start = time;
        let end = time;

        // 注意：onConfirm接口签名是 (id, user, action, startTime, endTime, notes)
        // 既然用户只填写一个时间，我们假设这个时间就是关键的时间点
        // 对于出库，这是"预计出库时间"
        // 对于入库，这是"预计入库时间"
        
        onConfirm(
          instrument.id,
          getOperatorName(),
          values.action,
          start.toISOString(),
          end.toISOString(),
          values.notes
        );
        form.resetFields();
      }
    });
  };

  const handleValuesChange = (changedValues: any) => {
    if (changedValues.action) {
      setAction(changedValues.action);
    }
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
        <CalendarOutlined style={{ marginRight: 8, fontSize: 18 }} />
        仪器预约
      </div>}
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" onClick={handleOk}>
          确认预约
        </Button>
      ]}
      width={600}
    >
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      {!instrument && (<div style={{ display: 'none' }} />)}
      {instrument && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <p><strong>仪器名称：</strong>{instrument.name}</p>
            <p><strong>管理编号：</strong>{(instrument as any).managementNumber || (instrument as any).management_number}</p>
          </div>
            <Form.Item name="action" label="预约操作" rules={[{ required: true, message: '请选择预约操作' }]} initialValue="出库"> 
              <Select>
                <Select.Option value="出库">出库</Select.Option>
                <Select.Option value="入库">入库</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item 
              name="reservationTime" 
              label={action === '出库' ? '预计出库时间' : '预计入库时间'} 
              rules={[{ required: true, message: '请选择时间' }]}
            > 
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <Input.TextArea rows={3} />
            </Form.Item>
        </div>
      )}
      </Form>
    </Modal>
  );
};

export default ReservationModal;
