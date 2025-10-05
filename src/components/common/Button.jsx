// Button组件，提供通用的按钮功能
import React from 'react';
import '../../styles/FormStyles.css';

const Button = ({ 
  children, 
  type = 'button', 
  onClick, 
  className = '', 
  variant = 'primary', // 'primary', 'secondary', 'success', 'danger', 'warning', 'info'
  size = 'medium', // 'small', 'medium', 'large', 'block'
  disabled = false,
  loading = false,
  ...rest
}) => {
  // 构建按钮的CSS类名
  const baseClasses = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  const stateClasses = [];
  
  if (disabled) stateClasses.push('btn-disabled');
  if (loading) stateClasses.push('btn-loading');
  
  const finalClassName = `${baseClasses} ${variantClass} ${sizeClass} ${stateClasses.join(' ')} ${className}`;

  return (
    <button
      type={type}
      className={finalClassName}
      onClick={onClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="btn-loading-content">
          <span className="loading-spinner"></span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;