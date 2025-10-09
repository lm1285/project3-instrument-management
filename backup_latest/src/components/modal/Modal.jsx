import React from 'react';
import './ModalStyles.css';

/**
 * 通用模态框组件
 * 可用于添加/编辑表单、详情查看、确认对话框等
 */
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  width = '500px',
  className = ''
}) => {
  if (!isOpen) return null;

  // 阻止事件冒泡，防止点击内容区域关闭模态框
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${className}`}
        style={{ width }}
        onClick={handleContentClick}
      >
        {/* 模态框头部 */}
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button 
              className="modal-close-btn"
              onClick={onClose}
              title="关闭"
            >
              ×
            </button>
          </div>
        )}

        {/* 模态框内容 */}
        <div className="modal-body">
          {children}
        </div>

        {/* 模态框底部 */}
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;