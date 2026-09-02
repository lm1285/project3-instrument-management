import React from 'react';
import { Button } from 'antd';

interface DetailButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const DetailButton: React.FC<DetailButtonProps> = ({ instrumentId, onClick, disabled = false, size = 'middle', className }) => {
  const handleClick = () => {
    onClick(instrumentId);
  };

  return (
    <Button
      type="default"
      onClick={handleClick}
      disabled={disabled}
      title="详情"
      size={size}
      className={className}
    >
      详情
    </Button>
  );
};

export default DetailButton;