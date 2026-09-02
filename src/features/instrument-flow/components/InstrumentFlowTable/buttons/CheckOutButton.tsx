import React from 'react';
import { Button } from 'antd';

interface CheckOutButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const CheckOutButton: React.FC<CheckOutButtonProps> = ({ instrumentId, onClick, disabled = false, size = 'middle', className }) => {
  const handleClick = () => {
    onClick(instrumentId);
  };

  return (
    <Button
      type="primary"
      onClick={handleClick}
      disabled={disabled}
      title="出库"
      size={size}
      className={className}
    >
      出库
    </Button>
  );
};

export default CheckOutButton;