/**
 * 增强型表单组件
 * 提供统一的表单验证、状态管理、错误处理等功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, App } from 'antd';
import type { FormProps, FormItemProps } from 'antd';
import { ValidationRule, validateForm, isFormValid } from '../../utils/validationUtils';

/**
 * 增强型表单项属性接口
 */
export interface EnhancedFormItemProps extends FormItemProps {
  /** 字段名称 */
  name: string;
  /** 自定义验证规则 */
  validationRules?: ValidationRule[];
  /** 是否显示验证图标 */
  showValidateIcon?: boolean;
  /** 字段禁用状态 */
  disabled?: boolean;
}

/**
 * 增强型表单属性接口
 */
export interface EnhancedFormProps<T extends Record<string, any>> extends Omit<FormProps, 'onFinish'> {
  /** 表单初始数据 */
  initialValues?: T;
  /** 表单字段验证规则 */
  validationRules?: Record<keyof T, ValidationRule[]>;
  /** 表单提交成功回调 */
  onSubmit?: (values: T) => Promise<void> | void;
  /** 表单提交前回调 */
  beforeSubmit?: (values: T) => boolean | Promise<boolean>;
  /** 表单重置回调 */
  onReset?: () => void;
  /** 是否启用默认提交按钮 */
  showSubmitButton?: boolean;
  /** 是否启用默认重置按钮 */
  showResetButton?: boolean;
  /** 提交按钮文本 */
  submitButtonText?: string;
  /** 重置按钮文本 */
  resetButtonText?: string;
  /** 表单操作区域样式 */
  actionsStyle?: React.CSSProperties;
  /** 自定义操作按钮 */
  customActions?: React.ReactNode;
}

/**
 * 增强型表单项组件
 */
export const EnhancedFormItem: React.FC<EnhancedFormItemProps> = ({
  name,
  validationRules,
  showValidateIcon = true,
  disabled = false,
  ...props
}) => {
  return (
    <Form.Item
      name={name}
      {...props}
      validateStatus={props.validateStatus}
      help={props.help}
      hasFeedback={showValidateIcon && props.validateStatus !== undefined}
      rules={props.rules}
    >
        {typeof props.children === 'function' ? 
          props.children({} as any) : 
           React.isValidElement(props.children) ? 
             React.cloneElement(props.children, { disabled }) :
             props.children
         }
    </Form.Item>
  );
};

/**
 * 增强型表单组件
 */
export function EnhancedForm<T extends Record<string, any>>({
  initialValues = {} as T,
  validationRules = {} as Record<keyof T, ValidationRule[]>,
  onSubmit,
  beforeSubmit,
  onReset,
  showSubmitButton = true,
  showResetButton = true,
  submitButtonText = '提交',
  resetButtonText = '重置',
  actionsStyle = { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  customActions,
  children,
  ...props
}: EnhancedFormProps<T>) {
  const { message } = App.useApp();
  // 创建表单实例
  const [form] = Form.useForm<T>();
  
  // 表单加载状态
  const [loading, setLoading] = useState(false);
  
  // 表单验证结果

  
  // 初始化表单
  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [form, initialValues]);
  
  // 处理表单验证
  const handleValidate = useCallback(async (values: T): Promise<boolean> => {
    try {
      // 执行自定义验证规则
      const results = validateForm(values, validationRules);
      
      // 检查是否通过验证
      const isValid = isFormValid(results);
      
      if (!isValid) {
        // 找出第一个错误并显示
        for (const field in results) {
          const result = results[field as keyof T];
          if (!result.isValid) {
            message.error(result.errorMessage || '表单验证失败');
            break;
          }
        }
      }
      
      return isValid;
    } catch (error) {
      console.error('表单验证失败:', error);
      message.error('表单验证失败，请检查输入');
      return false;
    }
  }, [validationRules]);
  
  // 处理表单提交
  const handleSubmit = async (values: T) => {
    try {
      setLoading(true);
      
      // 执行验证
      const isValid = await handleValidate(values);
      if (!isValid) {
        return;
      }
      
      // 执行提交前回调
      if (beforeSubmit) {
        const shouldProceed = await beforeSubmit(values);
        if (!shouldProceed) {
          return;
        }
      }
      
      // 执行提交回调
      if (onSubmit) {
        await onSubmit(values);
      }
    } catch (error) {
      console.error('表单提交失败:', error);
      message.error('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理表单重置
  const handleReset = () => {
    form.resetFields();
    
    if (onReset) {
      onReset();
    }
  };
  
  // 渲染操作按钮
  const renderActions = () => {
    if (customActions) {
      return customActions;
    }
    
    return (
      <div style={actionsStyle}>
        {showResetButton && (
          <Button onClick={handleReset}>
            {resetButtonText}
          </Button>
        )}
        {showSubmitButton && (
          <Button type="primary" htmlType="submit" loading={loading}>
            {submitButtonText}
          </Button>
        )}
      </div>
    );
  };
  
  // 将表单实例传递给子组件
  const childrenWithForm = typeof children === 'function' 
    ? children({}, form) 
    : children;
  
  return (
    <Form
      form={form}
      layout={props.layout || 'vertical'}
      onFinish={handleSubmit}
      {...props}
    >
      {childrenWithForm}
      {renderActions()}
    </Form>
  );
}

export default EnhancedForm;