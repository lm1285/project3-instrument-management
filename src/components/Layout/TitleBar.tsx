import React from 'react';
import './TitleBar.css';

interface TitleBarProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  extraActions?: React.ReactNode;
}

const TitleBar: React.FC<TitleBarProps> = ({
  title,
  showBackButton = false,
  onBack,
  extraActions
}) => {
  return (
    <div className="title-bar">
      {showBackButton && (
        <button 
          className="back-button"
          onClick={onBack}
          title="返回"
        >
          ←
        </button>
      )}
      <h2 className="page-title">{title}</h2>
      {extraActions && (
        <div className="title-bar-actions">
          {extraActions}
        </div>
      )}
    </div>
  );
};

export default TitleBar;