import React from 'react';
import { Modal, Checkbox, Button, Typography } from 'antd';
import type { ModalProps } from 'antd';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import type { Instrument } from '../../types';

const { Text } = Typography;

interface ClearConfirmModalProps extends ModalProps {
  instrument?: Instrument | null;
  onConfirm: (instrumentId: string, keepBasicData: boolean) => void;
}

const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  instrument,
  onConfirm,
  ...modalProps
}) => {
  const [checked, setChecked] = React.useState(false);
  const [confirmLoading, setConfirmLoading] = React.useState(false);

  const handleOk = async () => {
    if (instrument) {
      setConfirmLoading(true);
      try {
        await onConfirm(instrument.id, checked);
        setChecked(false);
      } finally {
        setConfirmLoading(false);
      }
    }
  };

  const handleCancel = () => {
    setChecked(false);
    modalProps.onCancel?.({} as React.MouseEvent<HTMLButtonElement>);
  };

  return (
    <Modal
      {...modalProps}
      title={<div style={{ display: 'flex', alignItems: 'center', color: '#ff4d4f' }}>
        <DeleteOutlined style={{ marginRight: 8, fontSize: 18 }} />
        清除记录确认
      </div>}
      onOk={handleOk}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel} disabled={confirmLoading}>
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          danger
          onClick={handleOk} 
          loading={confirmLoading}
          disabled={confirmLoading}
        >
          确认清除
        </Button>
      ]}
      width={600}
      destroyOnHidden
    >
      <div style={{ padding: 20 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'flex-start', 
          marginBottom: 20,
          padding: 16,
          backgroundColor: '#fff1f0',
          border: '1px solid #ffa39e',
          borderRadius: 4
        }}>
          <WarningOutlined style={{ color: '#ff4d4f', fontSize: 20, marginRight: 12, marginTop: 2 }} />
          <div>
            <Text strong style={{ color: '#ff4d4f', display: 'block', marginBottom: 8 }}>
              警告：此操作不可逆！
            </Text>
            <Text type="secondary" style={{ lineHeight: 1.6 }}>
              清除记录将删除该仪器的所有使用记录和出入库历史。请谨慎操作。
            </Text>
          </div>
        </div>
        
        {instrument && (
          <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
            <h4>将清除以下仪器的记录</h4>
            <p><strong>仪器名称：</strong>{instrument.name}</p>
            <p><strong>型号规格：</strong>{instrument.model}</p>
            <p><strong>管理编号：</strong>{(instrument as any).managementNumber || (instrument as any).management_number}</p>
          </div>
        )}
        
        <Checkbox 
          checked={checked} 
          onChange={(e) => setChecked(e.target.checked)}
          style={{ marginBottom: 20 }}
        >
          仅清除记录，保留基础信息和校准数据
        </Checkbox>
        
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
          注意事项：<br />
          1. 清除记录后，无法恢复已删除的历史数据<br />
          2. 请确保已备份重要数据<br />
          3. 清除操作将被记录在系统日志中
        </Text>
      </div>
    </Modal>
  );
};

export default ClearConfirmModal;
