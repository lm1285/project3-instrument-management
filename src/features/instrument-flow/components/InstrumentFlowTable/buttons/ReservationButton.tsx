import React from 'react';
import { Button } from 'antd';

interface ReservationButtonProps {
  instrumentId: string;
  onClick: (id: string) => void;
  disabled?: boolean;
}

const ReservationButton: React.FC<ReservationButtonProps> = ({ instrumentId, onClick, disabled = false }) => {
  const handleClick = () => {
    onClick(instrumentId);
  };

  return (
    <Button
      type="default"
      size="small"
      onClick={handleClick}
      disabled={disabled}
      title="预约"
    >
      预约
    </Button>
  );
};

export default ReservationButton;