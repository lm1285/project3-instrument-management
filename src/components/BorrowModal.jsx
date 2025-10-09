import React, { useState, useEffect } from 'react';

function BorrowModal({ isOpen, onClose, onConfirm, managementNumber }) {
  const [borrowerName, setBorrowerName] = useState('');
  const [error, setError] = useState('');

  // 当模态框关闭时重置表单
  useEffect(() => {
    if (!isOpen) {
      setBorrowerName('');
      setError('');
    }
  }, [isOpen]);

  // 处理确认按钮点击
  const handleConfirm = () => {
    if (!borrowerName.trim()) {
      setError('请输入借用人姓名');
      return;
    }
    onConfirm(borrowerName.trim());
  };

  // 处理取消按钮点击
  const handleCancel = () => {
    setBorrowerName('');
    setError('');
    onClose();
  };

  // 处理键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        onKeyPress={handleKeyPress}
        tabIndex={0}
        style={{ maxWidth: '400px', width: '90%' }}
      >
        <div className="modal-header">
          <h2>借用仪器</h2>
          <button 
            className="close-button" 
            onClick={handleCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}>
              管理编号：
            </label>
            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '4px', 
              fontSize: '14px', 
              color: '#666'
            }}>
              {managementNumber}
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label 
              htmlFor="borrowerName" 
              style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#333' }}
            >
              借用人姓名
            </label>
            <input
              id="borrowerName"
              type="text"
              value={borrowerName}
              onChange={(e) => {
                setBorrowerName(e.target.value);
                setError('');
              }}
              placeholder="请输入借用人姓名"
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                border: error ? '1px solid #ff4d4f' : '1px solid #d0d7de',
                borderRadius: '4px',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.3s'
              }}
            />
            {error && (
              <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                {error}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            className="cancel-button" 
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ffffff',
              border: '1px solid #d0d7de',
              borderRadius: '4px',
              color: '#666',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            取消
          </button>
          <button 
            className="submit-button" 
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1890ff',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

export default BorrowModal;