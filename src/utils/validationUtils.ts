/**
 * 表单验证工具函数集合
 * 提供各种常见的验证规则和工具函数
 */

/**
 * 验证结果接口
 */
export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * 验证规则接口
 */
export interface ValidationRule {
  validate: (value: any) => ValidationResult;
  message?: string;
}

/**
 * 验证是否为空
 * @param value 要验证的值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function required(value: any, message: string = '此字段为必填项'): ValidationResult {
  const isValid = value !== undefined && value !== null && value !== '';
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 验证字符串长度
 * @param value 要验证的值
 * @param min 最小长度
 * @param max 最大长度
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function length(value: any, min: number, max: number, message?: string): ValidationResult {
  const strValue = String(value || '');
  const isValid = strValue.length >= min && strValue.length <= max;
  
  return {
    isValid,
    errorMessage: isValid ? undefined : 
      message || `长度应在 ${min} 到 ${max} 个字符之间`
  };
}

/**
 * 验证是否为有效的数字
 * @param value 要验证的值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function isNumber(value: any, message: string = '请输入有效的数字'): ValidationResult {
  const isValid = !isNaN(Number(value)) && isFinite(Number(value));
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 验证是否为有效的整数
 * @param value 要验证的值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function isInteger(value: any, message: string = '请输入有效的整数'): ValidationResult {
  const numValue = Number(value);
  const isValid = !isNaN(numValue) && Number.isInteger(numValue);
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 验证数字范围
 * @param value 要验证的值
 * @param min 最小值
 * @param max 最大值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function range(value: any, min: number, max: number, message?: string): ValidationResult {
  const numValue = Number(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      errorMessage: message || '请输入有效的数字'
    };
  }
  
  const isValid = numValue >= min && numValue <= max;
  
  return {
    isValid,
    errorMessage: isValid ? undefined : 
      message || `值应在 ${min} 到 ${max} 之间`
  };
}

/**
 * 验证是否为有效的邮箱地址
 * @param value 要验证的值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function email(value: any, message: string = '请输入有效的邮箱地址'): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = typeof value === 'string' && emailRegex.test(value);
  
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 验证是否为有效的手机号码（中国）
 * @param value 要验证的值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function phone(value: any, message: string = '请输入有效的手机号码'): ValidationResult {
  const phoneRegex = /^1[3-9]\d{9}$/;
  const isValid = typeof value === 'string' && phoneRegex.test(value);
  
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 验证两个值是否相等
 * @param value1 第一个值
 * @param value2 第二个值
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function equals(value1: any, value2: any, message: string = '两次输入不匹配'): ValidationResult {
  const isValid = value1 === value2;
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 使用正则表达式验证
 * @param value 要验证的值
 * @param regex 正则表达式
 * @param message 自定义错误消息
 * @returns 验证结果
 */
export function pattern(value: any, regex: RegExp, message: string): ValidationResult {
  const isValid = typeof value === 'string' && regex.test(value);
  return {
    isValid,
    errorMessage: isValid ? undefined : message
  };
}

/**
 * 运行一系列验证规则
 * @param value 要验证的值
 * @param rules 验证规则数组
 * @returns 验证结果
 */
export function runValidations(value: any, rules: ValidationRule[]): ValidationResult {
  for (const rule of rules) {
    const result = rule.validate(value);
    if (!result.isValid) {
      return result;
    }
  }
  
  return { isValid: true };
}

/**
 * 验证整个表单
 * @param formData 表单数据对象
 * @param validations 验证规则配置
 * @returns 包含每个字段验证结果的对象
 */
export function validateForm<T extends Record<string, any>>(
  formData: T,
  validations: Record<keyof T, ValidationRule[]>
): Record<keyof T, ValidationResult> {
  const results: Record<string, ValidationResult> = {};
  
  for (const field in validations) {
    const rules = validations[field as keyof T];
    const value = formData[field as keyof T];
    results[field] = runValidations(value, rules);
  }
  
  return results as Record<keyof T, ValidationResult>;
}

/**
 * 检查表单验证结果是否全部有效
 * @param validationResults 表单验证结果
 * @returns 是否全部有效
 */
export function isFormValid<T extends Record<string, ValidationResult>>(validationResults: T): boolean {
  return Object.values(validationResults).every(result => result.isValid);
}

export default {
  required,
  length,
  isNumber,
  isInteger,
  range,
  email,
  phone,
  equals,
  pattern,
  runValidations,
  validateForm,
  isFormValid
};