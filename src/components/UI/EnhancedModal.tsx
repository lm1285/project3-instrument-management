/**
 * 增强型模态框组件
 * 提供统一的模态框行为、样式和动画效果
 */
import React, { forwardRef, useState, useImperativeHandle, useRef, useEffect } from 'react';
import { Modal, Button, App } from 'antd';
import type { ModalProps } from 'antd';

/**
 * 增强型模态框属性接口
 */
export interface EnhancedModalProps extends ModalProps {
  /** 是否显示确认按钮 */
  showOkButton?: boolean;
  /** 是否显示取消按钮 */
  showCancelButton?: boolean;
  /** 确认按钮文本 */
  okButtonText?: string;
  /** 取消按钮文本 */
  cancelButtonText?: string;
  /** 确认前回调，返回false可以阻止关闭 */
  beforeOk?: () => boolean | Promise<boolean>;
  /** 确认成功回调 */
  onOkSuccess?: () => void;
  /** 是否禁用确认按钮 */
  okButtonDisabled?: boolean;
  /** 是否禁用取消按钮 */
  cancelButtonDisabled?: boolean;
  /** 确认按钮加载状态 */
  okButtonLoading?: boolean;
  /** 取消按钮加载状态 */
  cancelButtonLoading?: boolean;
  /** 是否显示关闭图标 */
  showCloseIcon?: boolean;
  /** 点击确认按钮时的动画效果 */
  confirmAnimation?: boolean;
  /** 模态框容器的额外样式 */
  containerStyle?: React.CSSProperties;
  /** 内容区域的额外样式 */
  contentStyle?: React.CSSProperties;
  /** 页脚区域的额外样式 */
  footerStyle?: React.CSSProperties;
}

/**
 * 模态框引用接口
 */
export interface EnhancedModalRef {
  /** 打开模态框 */
  open: () => void;
  /** 关闭模态框 */
  close: () => void;
  /** 切换模态框显示状态 */
  toggle: () => void;
  /** 设置确认按钮加载状态 */
  setOkButtonLoading: (loading: boolean) => void;
}

/**
 * 增强型模态框组件
 */
const EnhancedModal = forwardRef<EnhancedModalRef, EnhancedModalProps>(({
  visible: propsVisible,
  onOk: propsOnOk,
  onCancel: propsOnCancel,
  showOkButton = true,
  showCancelButton = true,
  okButtonText = '确定',
  cancelButtonText = '取消',
  beforeOk,
  onOkSuccess,
  okButtonDisabled = false,
  cancelButtonDisabled = false,
  okButtonLoading = false,
  cancelButtonLoading = false,
  showCloseIcon = true,
  confirmAnimation = false,
  containerStyle,
  contentStyle,
  footerStyle,
  // @ts-ignore - bodyStyle is deprecated but we need to handle it to avoid warning
  bodyStyle,
  styles,
  ...props
}, ref) => {
  const { message } = App.useApp();
  // 内部可见状态，用于控制动画效果
  const [internalVisible, setInternalVisible] = useState(false);
  // 确认按钮加载状态
  const [internalOkLoading, setInternalOkLoading] = useState(okButtonLoading);
  // 确认动画状态
  const [animationClass, setAnimationClass] = useState('');
  
  // 动画超时引用
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 控制模态框的方法
  useImperativeHandle(ref, () => ({
    open: () => setInternalVisible(true),
    close: () => setInternalVisible(false),
    toggle: () => setInternalVisible(prev => !prev),
    setOkButtonLoading: (loading: boolean) => setInternalOkLoading(loading),
  }));
  
  // 同步外部可见状态到内部状态
  useEffect(() => {
    if (propsVisible !== undefined) {
      setInternalVisible(propsVisible);
    }
  }, [propsVisible]);
  
  // 同步外部加载状态
  useEffect(() => {
    setInternalOkLoading(okButtonLoading);
  }, [okButtonLoading]);
  
  // 清理超时
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);
  
  // 处理确认按钮点击
  const handleOk = async () => {
    try {
      // 执行确认前回调
      if (beforeOk) {
        const shouldProceed = await beforeOk();
        if (!shouldProceed) {
          return;
        }
      }
      
      // 如果启用了确认动画
      if (confirmAnimation) {
        setAnimationClass('confirm-animation');
        
        // 延迟关闭，等待动画完成
        animationTimeoutRef.current = setTimeout(() => {
          completeOk();
        }, 300);
      } else {
        // 立即执行确认逻辑
        completeOk();
      }
    } catch (error) {
      console.error('Modal ok handler error:', error);
      message.error('操作失败，请重试');
      setInternalOkLoading(false);
    }
  };
  
  // 完成确认操作
  const completeOk = async () => {
    try {
      // 执行外部确认回调
      if (propsOnOk) {
      await propsOnOk({} as React.MouseEvent<HTMLButtonElement>);
    }
      
      // 执行确认成功回调
      if (onOkSuccess) {
        onOkSuccess();
      }
      
      // 如果是受控模式，不自动关闭
      if (propsVisible === undefined) {
        setInternalVisible(false);
      }
      
      // 重置动画状态
      setAnimationClass('');
    } finally {
      setInternalOkLoading(false);
    }
  };
  
  // 处理取消按钮点击
  const handleCancel = () => {
    // 执行外部取消回调
    if (propsOnCancel) {
      propsOnCancel({} as React.MouseEvent<HTMLButtonElement>);
    }
    
    // 如果是受控模式，不自动关闭
    if (propsVisible === undefined) {
      setInternalVisible(false);
    }
  };
  
  // 处理关闭图标点击的逻辑已直接集成到handleCancel中
  
  // 自定义页脚
  const customFooter = (
    <div style={footerStyle}>
      {showCancelButton && (
        <Button 
          onClick={handleCancel}
          disabled={cancelButtonDisabled}
          loading={cancelButtonLoading}
        >
          {cancelButtonText}
        </Button>
      )}
      {showOkButton && (
        <Button 
          type="primary" 
          onClick={handleOk}
          disabled={okButtonDisabled}
          loading={internalOkLoading}
        >
          {okButtonText}
        </Button>
      )}
    </div>
  );
  
  return (
    <Modal
      open={internalVisible}
      onOk={undefined} // 禁用默认的onOk处理
      onCancel={undefined} // 禁用默认的onCancel处理
      footer={customFooter}
      closable={showCloseIcon}
      closeIcon={showCloseIcon ? undefined : false}
      style={containerStyle}
      styles={{
        ...styles,
        body: {
          ...contentStyle,
          ...styles?.body,
          ...(bodyStyle as React.CSSProperties || {}),
          padding: contentStyle?.padding ?? styles?.body?.padding ?? (bodyStyle as React.CSSProperties)?.padding ?? '24px',
        }
      }}
      className={`enhanced-modal ${animationClass}`}
      {...props}
    />
  );
});

EnhancedModal.displayName = 'EnhancedModal';

// 导出组件和其类型
export default EnhancedModal;

/**
 * 模态框类型别名
 */
export type { ModalProps as EnhancedModalBaseProps } from 'antd';