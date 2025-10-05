// Modal组件，提供通用的模态框功能
import React, { useEffect } from 'react';
import '../../styles/FormStyles.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium', // 'small', 'medium', 'large'
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = ''
}) => {
  // 阻止模态框内部点击事件冒泡到覆盖层
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // 处理覆盖层点击关闭
  const handleOverlayClick = () => {
    if (closeOnOverlayClick && onClose) {
      onClose();
    }
  };

  // 处理键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 阻止页面滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // 如果模态框未打开，则不渲染
  if (!isOpen) return null;

  // 根据size设置CSS类名
  const sizeClass = `modal-${size}`;

  return (
    <div className={`modal-overlay ${className}`} onClick={handleOverlayClick}>
      <div className={`modal-container ${sizeClass}`} onClick={handleModalClick}>
        <div className="modal-header">
          {title && <h2 className="modal-title">{title}</h2>}
          {showCloseButton && (
            <button 
              className="modal-close-btn"
              onClick={onClose}
              aria-label="关闭"
            >
              ×
            </button>
          )}
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;