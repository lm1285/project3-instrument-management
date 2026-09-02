import React from 'react';
import { Button, Popconfirm } from 'antd';

interface ClearRecordButtonProps {
  instrumentId: string;
  onConfirm: (id: string) => void;
  disabled?: boolean;
}

const ClearRecordButton: React.FC<ClearRecordButtonProps> = ({ instrumentId, onConfirm, disabled = false }) => {
  const handleConfirm = () => {
    onConfirm(instrumentId);
  };

  return (
    <Popconfirm
      title="确定删除今日操作记录吗？"
      description="此操作将删除该仪器今日的操作记录，是否继续？"
      onConfirm={handleConfirm}
      okText="确定"
      cancelText="取消"
      placement="topRight"
    >
      <Button
        type="text"
        danger
        size="small"
        disabled={disabled}
        title="删除今日记录"
      >
        删除
      </Button>
    </Popconfirm>
  );
};

export default ClearRecordButton;