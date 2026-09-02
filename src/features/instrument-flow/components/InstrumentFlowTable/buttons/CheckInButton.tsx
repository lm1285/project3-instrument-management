import React from 'react';
import { Button } from 'antd';

interface CheckInButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const CheckInButton: React.FC<CheckInButtonProps> = ({ instrumentId, onClick, disabled = false, size = 'middle', className }) => {
  const handleClick = () => {
    onClick(instrumentId);
  };

  return (
    <Button
      type="default"
      onClick={handleClick}
      disabled={disabled}
      title="入库"
      size={size}
      className={className}
    >
      入库
    </Button>
  );
};

export default CheckInButton;