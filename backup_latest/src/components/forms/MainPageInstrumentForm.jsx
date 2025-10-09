import React, { useState, useEffect } from 'react';
import '../common/FormStyles.css';

/**
 * MainPageFix专用仪器表单组件
 * 与MainPageFix.jsx中的表单字段完全匹配
 */
const MainPageInstrumentForm = ({ 
  initialData = {}, 
  departments = [], 
  types = [], 
  statuses = [], 
  locations = [], 
  calibrationMethods = [],
  onSubmit,
  onCancel,
  loading = false,
  isEditing = false
}) => {
  // 表单数据状态
  const [formData, setFormData] = useState({ 
    id: initialData.id || '',
    managementNumber: initialData.managementNumber || '',
    name: initialData.name || '',
    model: initialData.model || '',
    specifications: initialData.specifications || '',
    manufacturer: initialData.manufacturer || '',
    measurementRange: initialData.measurementRange || '',
    uncertainty: initialData.uncertainty || '',
    calibrationStatus: initialData.calibrationStatus || '正常',
    calibrationDate: initialData.calibrationDate || '',
    nextCalibrationDate: initialData.nextCalibrationDate || '',
    department: initialData.department || '',
    location: initialData.location || '',
    custodian: initialData.custodian || '',
    purchaseDate: initialData.purchaseDate || '',
    unit: initialData.unit || '',
    value: initialData.value || '',
    status: initialData.status || '正常',
    remarks: initialData.remarks || ''
  });

  // 表单错误状态
  const [errors, setErrors] = useState({});

  // 当初始数据变化时更新表单数据
  useEffect(() => {
    setFormData({
      id: initialData.id || '',
      managementNumber: initialData.managementNumber || '',
      name: initialData.name || '',
      model: initialData.model || '',
      specifications: initialData.specifications || '',
      manufacturer: initialData.manufacturer || '',
      measurementRange: initialData.measurementRange || '',
      uncertainty: initialData.uncertainty || '',
      calibrationStatus: initialData.calibrationStatus || '正常',
      calibrationDate: initialData.calibrationDate || '',
      nextCalibrationDate: initialData.nextCalibrationDate || '',
      department: initialData.department || '',
      location: initialData.location || '',
      custodian: initialData.custodian || '',
      purchaseDate: initialData.purchaseDate || '',
      unit: initialData.unit || '',
      value: initialData.value || '',
      status: initialData.status || '正常',
      remarks: initialData.remarks || ''
    });
    // 重置错误
    setErrors({});
  }, [initialData]);

  // 处理输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除对应的错误信息
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = () => {
    const newErrors = {};
    
    // 必填字段验证
    if (!formData.managementNumber.trim()) {
      newErrors.managementNumber = '管理编号不能为空';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = '仪器名称不能为空';
    }
    
    if (!formData.model.trim()) {
      newErrors.model = '型号不能为空';
    }
    
    if (!formData.department) {
      newErrors.department = '请选择部门';
    }
    
    if (!formData.location) {
      newErrors.location = '请选择库位';
    }
    
    if (!formData.custodian.trim()) {
      newErrors.custodian = '保管人不能为空';
    }
    
    if (!formData.calibrationDate) {
      newErrors.calibrationDate = '校准日期不能为空';
    }
    
    if (!formData.nextCalibrationDate) {
      newErrors.nextCalibrationDate = '下次校准日期不能为空';
    }
    
    // 日期逻辑验证
    if (formData.calibrationDate && formData.nextCalibrationDate) {
      const calibrationDate = new Date(formData.calibrationDate);
      const nextCalibrationDate = new Date(formData.nextCalibrationDate);
      
      if (nextCalibrationDate <= calibrationDate) {
        newErrors.nextCalibrationDate = '下次校准日期必须晚于校准日期';
      }
    }
    
    // 数值验证
    if (formData.value && isNaN(Number(formData.value))) {
      newErrors.value = '请输入有效的数值';
    }
    
    // 不确定度验证
    if (formData.uncertainty && !/^\d+(\.\d+)?%?$/.test(formData.uncertainty)) {
      newErrors.uncertainty = '请输入有效的不确定度格式';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理表单提交
  const handleSubmit = (e) => {
    e.preventDefault();
    
    try {
      if (validateForm()) {
        // 确保提交的数据包含ID，如果是新增则生成一个更安全的唯一ID
        const submitData = {
          ...formData,
          id: formData.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          updatedAt: new Date().toISOString()
        };
        
        // 添加创建时间（仅当新增时）
        if (!isEditing) {
          submitData.createdAt = new Date().toISOString();
        }
        
        onSubmit(submitData);
      }
    } catch (error) {
      console.error('表单提交过程中发生错误:', error);
      setErrors(prev => ({
        ...prev,
        form: '提交过程中发生错误，请重试'
      }));
    }
  };

  return (
    <form className="instrument-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <h2>{isEditing ? '编辑仪器' : '新增仪器'}</h2>
        {errors.form && (
          <div className="form-error">{errors.form}</div>
        )}
      </div>
      
      <div className="form-grid">
        {/* 第一行 */}
        <div className="form-group">
          <label htmlFor="managementNumber">管理编号 *</label>
          <input
            type="text"
            id="managementNumber"
            name="managementNumber"
            value={formData.managementNumber}
            onChange={handleInputChange}
            className={errors.managementNumber ? 'error' : ''}
            disabled={loading}
            placeholder="请输入管理编号"
          />
          {errors.managementNumber && (
            <span className="error-message">{errors.managementNumber}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="name">仪器名称 *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className={errors.name ? 'error' : ''}
            disabled={loading}
            placeholder="请输入仪器名称"
          />
          {errors.name && (
            <span className="error-message">{errors.name}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="model">型号 *</label>
          <input
            type="text"
            id="model"
            name="model"
            value={formData.model}
            onChange={handleInputChange}
            className={errors.model ? 'error' : ''}
            disabled={loading}
            placeholder="请输入型号"
          />
          {errors.model && (
            <span className="error-message">{errors.model}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="specifications">规格</label>
          <input
            type="text"
            id="specifications"
            name="specifications"
            value={formData.specifications}
            onChange={handleInputChange}
            disabled={loading}
            placeholder="请输入规格"
          />
        </div>

        {/* 第二行 */}
        <div className="form-group">
          <label htmlFor="manufacturer">制造商</label>
          <input
            type="text"
            id="manufacturer"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleInputChange}
            disabled={loading}
            placeholder="请输入制造商"
          />
        </div>

        <div className="form-group">
          <label htmlFor="measurementRange">测量范围</label>
          <input
            type="text"
            id="measurementRange"
            name="measurementRange"
            value={formData.measurementRange}
            onChange={handleInputChange}
            disabled={loading}
            placeholder="请输入测量范围"
          />
        </div>

        <div className="form-group">
          <label htmlFor="uncertainty">不确定度</label>
          <input
            type="text"
            id="uncertainty"
            name="uncertainty"
            value={formData.uncertainty}
            onChange={handleInputChange}
            className={errors.uncertainty ? 'error' : ''}
            disabled={loading}
            placeholder="请输入不确定度，如：0.5%"
          />
          {errors.uncertainty && (
            <span className="error-message">{errors.uncertainty}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="calibrationStatus">校准状态</label>
          <select
            id="calibrationStatus"
            name="calibrationStatus"
            value={formData.calibrationStatus}
            onChange={handleInputChange}
            disabled={loading}
          >
            <option value="正常">正常</option>
            <option value="待校准">待校准</option>
            <option value="已过期">已过期</option>
          </select>
        </div>

        {/* 第三行 */}
        <div className="form-group">
          <label htmlFor="calibrationDate">校准日期 *</label>
          <input
            type="date"
            id="calibrationDate"
            name="calibrationDate"
            value={formData.calibrationDate}
            onChange={handleInputChange}
            className={errors.calibrationDate ? 'error' : ''}
            disabled={loading}
          />
          {errors.calibrationDate && (
            <span className="error-message">{errors.calibrationDate}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="nextCalibrationDate">下次校准日期 *</label>
          <input
            type="date"
            id="nextCalibrationDate"
            name="nextCalibrationDate"
            value={formData.nextCalibrationDate}
            onChange={handleInputChange}
            className={errors.nextCalibrationDate ? 'error' : ''}
            disabled={loading}
          />
          {errors.nextCalibrationDate && (
            <span className="error-message">{errors.nextCalibrationDate}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="department">部门 *</label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleInputChange}
            className={errors.department ? 'error' : ''}
            disabled={loading}
          >
            <option value="">请选择部门</option>
            {departments.map(dept => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
          {errors.department && (
            <span className="error-message">{errors.department}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="location">库位 *</label>
          <select
            id="location"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            className={errors.location ? 'error' : ''}
            disabled={loading}
          >
            <option value="">请选择库位</option>
            {locations.map(loc => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
          {errors.location && (
            <span className="error-message">{errors.location}</span>
          )}
        </div>

        {/* 第四行 */}
        <div className="form-group">
          <label htmlFor="custodian">保管人 *</label>
          <input
            type="text"
            id="custodian"
            name="custodian"
            value={formData.custodian}
            onChange={handleInputChange}
            className={errors.custodian ? 'error' : ''}
            disabled={loading}
            placeholder="请输入保管人"
          />
          {errors.custodian && (
            <span className="error-message">{errors.custodian}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="purchaseDate">采购日期</label>
          <input
            type="date"
            id="purchaseDate"
            name="purchaseDate"
            value={formData.purchaseDate}
            onChange={handleInputChange}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="unit">单位</label>
          <input
            type="text"
            id="unit"
            name="unit"
            value={formData.unit}
            onChange={handleInputChange}
            disabled={loading}
            placeholder="请输入单位"
          />
        </div>

        <div className="form-group">
          <label htmlFor="value">价值</label>
          <input
            type="number"
            id="value"
            name="value"
            value={formData.value}
            onChange={handleInputChange}
            className={errors.value ? 'error' : ''}
            disabled={loading}
            step="0.01"
            min="0"
            placeholder="请输入价值"
          />
          {errors.value && (
            <span className="error-message">{errors.value}</span>
          )}
        </div>

        {/* 第五行 */}
        <div className="form-group">
          <label htmlFor="status">状态</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            disabled={loading}
          >
            {statuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group full-width">
        <label htmlFor="remarks">备注</label>
        <textarea
          id="remarks"
          name="remarks"
          value={formData.remarks}
          onChange={handleInputChange}
          disabled={loading}
          placeholder="请输入备注信息"
          rows="3"
        />
      </div>

      {/* 表单操作按钮 */}
      <div className="form-actions">
        <button 
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          取消
        </button>
        <button 
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? '提交中...' : (isEditing ? '更新' : '保存')}
        </button>
      </div>
    </form>
  );
};

export default MainPageInstrumentForm;