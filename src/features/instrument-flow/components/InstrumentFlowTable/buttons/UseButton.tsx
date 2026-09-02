import React from 'react';
import { Button } from 'antd';

interface UseButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
}

const UseButton: React.FC<UseButtonProps> = ({ instrumentId, onClick, disabled = false }) => {
  const handleClick = () => {
    onClick(instrumentId);
  };

  return (
    <Button
      type="primary"
      danger={false}
      size="small"
      onClick={handleClick}
      disabled={disabled}
      title="使用"
    >
      使用
    </Button>
  );
};

export default UseButton;