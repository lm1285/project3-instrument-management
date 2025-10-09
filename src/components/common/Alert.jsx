// Alert组件，提供提示信息功能
import React, { useState, useEffect } from 'react';
import '../../styles/FormStyles.css';

const Alert = ({ 
  message, 
  type = 'info', // 'success', 'error', 'warning', 'info'
  duration = 3000, 
  onClose, 
  showIcon = true,
  showCloseButton = true,
  position = 'top-right' // 'top-right', 'top-center', 'bottom-right', 'bottom-center'
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // 图标映射
  const iconMap = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  // 样式类名映射
  const typeClass = `alert-${type}`;
  const positionClass = `alert-${position}`;

  // 设置自动关闭计时器
  useEffect(() => {
    let autoCloseTimer = null;
    
    if (duration > 0) {
      autoCloseTimer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
    }

    return () => {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    };
  }, [duration, onClose]);

  // 手动关闭
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  // 如果消息为空或不可见，则不渲染
  if (!message || !isVisible) return null;

  return (
    <div className={`alert ${typeClass} ${positionClass}`}>
      {showIcon && <span className="alert-icon">{iconMap[type]}</span>}
      <span className="alert-message">{message}</span>
      {showCloseButton && (
        <button 
          className="alert-close-btn"
          onClick={handleClose}
          aria-label="关闭提示"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Alert;