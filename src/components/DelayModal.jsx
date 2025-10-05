import React, { useState, useEffect } from 'react';

const DelayModal = ({ isOpen, onClose, onConfirm, managementNumber }) => {
  const [delayDaysInput, setDelayDaysInput] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    console.log('🔍 DelayModal - isOpen 变化:', isOpen);
    console.log('🔍 DelayModal - managementNumber:', managementNumber);

    if (isOpen) {
      console.log('✅ 模态框应该显示');
      setIsVisible(true);
    } else {
      console.log('❌ 模态框应该隐藏');
      setIsVisible(false);
      setDelayDaysInput('');
    }
  }, [isOpen, managementNumber]);

  const handleConfirm = () => {
    console.log('🔄 确认按钮点击，输入值:', delayDaysInput);
    if (delayDaysInput && !isNaN(delayDaysInput) && parseInt(delayDaysInput) > 0) {
      console.log('✅ 输入有效，调用 onConfirm');
      onConfirm(parseInt(delayDaysInput));
      setDelayDaysInput('');
    } else {
      console.log('❌ 输入无效');
      alert('请输入有效的延期天数');
    }
  };

  const handleCancel = () => {
    console.log('🔄 取消按钮点击');
    setDelayDaysInput('');
    onClose();
  };

  // 如果isOpen为false，不渲染任何内容
  if (!isOpen) {
    return null;
  }

  console.log('🎨 渲染模态框 UI');

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
        console.log('🖱️ 遮罩层点击');
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
          仪器延期申请 - 调试版本
        </h3>
        
        <div style={{
          marginBottom: '16px',
          padding: '8px',
          backgroundColor: '#e6f7ff',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#0050b3'
        }}>
          调试信息: isOpen={isOpen.toString()}, managementNumber={managementNumber}
        </div>
        
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
            onChange={(e) => {
              console.log('📝 输入变化:', e.target.value);
              setDelayDaysInput(e.target.value);
            }}
            min="1"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            autoFocus
          />
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