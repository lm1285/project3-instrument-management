import React, { useState, useEffect } from 'react';

const DelayModal = ({ isOpen, onClose, onConfirm, managementNumber }) => {
  const [delayDaysInput, setDelayDaysInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setDelayDaysInput('');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (delayDaysInput && !isNaN(delayDaysInput) && parseInt(delayDaysInput) > 0) {
      onConfirm(parseInt(delayDaysInput));
      setDelayDaysInput('');
      setErrorMessage('');
    } else {
      setErrorMessage('请输入有效的延期天数');
      // 3秒后自动清除错误消息
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleCancel = () => {
    setDelayDaysInput('');
    onClose();
  };

  // 如果isOpen为false，不渲染任何内容
  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleCancel();
        }
      }}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#333'
        }}>
          仪器延期申请
        </h3>
        
        {managementNumber && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '14px',
            color: '#666'
          }}>
            <strong>管理编号:</strong> {managementNumber}
          </div>
        )}
        
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            color: '#666'
          }}>
            请输入延期天数：
          </label>
          <input
            type="number"
            value={delayDaysInput}
            onChange={(e) => setDelayDaysInput(e.target.value)}
            min="1"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              fontSize: '14px',
              borderColor: errorMessage ? '#ff4d4f' : '#d9d9d9'
            }}
            autoFocus
          />
          {errorMessage && (
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#ff4d4f',
              display: 'flex',
              alignItems: 'center'
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ marginRight: '4px', fill: 'currentColor' }}>
                <path d="M11.396 5.728l-4.184-4.184A1.5 1.5 0 0 0 6 0h0A1.5 1.5 0 0 0 1.5 1.5L5.672 5.672v4.184l-1.672 1.672a1.5 1.5 0 1 0 2.122 2.122l1.672-1.672v-4.184L10.5 11.396a1.5 1.5 0 1 0 2.122-2.122L11.396 5.728z"></path>
              </svg>
              {errorMessage}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #d9d9d9',
              backgroundColor: 'white',
              color: '#666',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              backgroundColor: '#1890ff',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            确认延期
          </button>
        </div>
      </div>
    </div>
  );
};

export default DelayModal;