// InstrumentForm组件，用于仪器信息的输入和编辑
import React, { useState, useEffect } from 'react';
import '../../styles/FormStyles.css';

const InstrumentForm = ({ 
  initialData = {}, 
  onSubmit, 
  onCancel, 
  isEditing = false 
}) => {
  // 初始化表单数据
  const [formData, setFormData] = useState({
    id: initialData.id || '',
    name: initialData.name || '',
    model: initialData.model || '',
    serialNumber: initialData.serialNumber || '',
    manufacturer: initialData.manufacturer || '',
    purchaseDate: initialData.purchaseDate || '',
    price: initialData.price || '',
    location: initialData.location || '',
    status: initialData.status || 'inStock',
    category: initialData.category || '',
    description: initialData.description || '',
    maintenanceCycle: initialData.maintenanceCycle || '',
    lastMaintenanceDate: initialData.lastMaintenanceDate || '',
    nextMaintenanceDate: initialData.nextMaintenanceDate || '',
    responsiblePerson: initialData.responsiblePerson || '',
    contactPhone: initialData.contactPhone || '',
    notes: initialData.notes || ''
  });

  // 表单验证状态
  const [errors, setErrors] = useState({});

  // 当初始数据变化时更新表单
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id || '',
        name: initialData.name || '',
        model: initialData.model || '',
        serialNumber: initialData.serialNumber || '',
        manufacturer: initialData.manufacturer || '',
        purchaseDate: initialData.purchaseDate || '',
        price: initialData.price || '',
        location: initialData.location || '',
        status: initialData.status || 'inStock',
        category: initialData.category || '',
        description: initialData.description || '',
        maintenanceCycle: initialData.maintenanceCycle || '',
        lastMaintenanceDate: initialData.lastMaintenanceDate || '',
        nextMaintenanceDate: initialData.nextMaintenanceDate || '',
        responsiblePerson: initialData.responsiblePerson || '',
        contactPhone: initialData.contactPhone || '',
        notes: initialData.notes || ''
      });
      setErrors({});
    }
  }, [initialData]);

  // 处理输入变化
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除对应字段的错误
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
    
    if (!formData.name.trim()) {
      newErrors.name = '仪器名称不能为空';
    }
    
    if (!formData.model.trim()) {
      newErrors.model = '型号不能为空';
    }
    
    if (!formData.serialNumber.trim()) {
      newErrors.serialNumber = '序列号不能为空';
    }
    
    if (!formData.manufacturer.trim()) {
      newErrors.manufacturer = '生产厂商不能为空';
    }
    
    if (!formData.purchaseDate) {
      newErrors.purchaseDate = '购买日期不能为空';
    }
    
    if (!formData.location.trim()) {
      newErrors.location = '存放位置不能为空';
    }
    
    if (!formData.responsiblePerson.trim()) {
      newErrors.responsiblePerson = '负责人不能为空';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理表单提交
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      // 确保提交的数据包含ID，如果是新增则生成一个
      const submitData = {
        ...formData,
        id: formData.id || Date.now().toString()
      };
      onSubmit(submitData);
    }
  };

  return (
    <form className="instrument-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>{isEditing ? '编辑仪器' : '新增仪器'}</h2>
      </div>
      
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="name">仪器名称 *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={errors.name ? 'error' : ''}
            placeholder="请输入仪器名称"
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="model">型号 *</label>
          <input
            type="text"
            id="model"
            name="model"
            value={formData.model}
            onChange={handleChange}
            className={errors.model ? 'error' : ''}
            placeholder="请输入仪器型号"
          />
          {errors.model && <span className="error-message">{errors.model}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="serialNumber">序列号 *</label>
          <input
            type="text"
            id="serialNumber"
            name="serialNumber"
            value={formData.serialNumber}
            onChange={handleChange}
            className={errors.serialNumber ? 'error' : ''}
            placeholder="请输入序列号"
          />
          {errors.serialNumber && <span className="error-message">{errors.serialNumber}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="manufacturer">生产厂商 *</label>
          <input
            type="text"
            id="manufacturer"
            name="manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            className={errors.manufacturer ? 'error' : ''}
            placeholder="请输入生产厂商"
          />
          {errors.manufacturer && <span className="error-message">{errors.manufacturer}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="purchaseDate">购买日期 *</label>
          <input
            type="date"
            id="purchaseDate"
            name="purchaseDate"
            value={formData.purchaseDate}
            onChange={handleChange}
            className={errors.purchaseDate ? 'error' : ''}
          />
          {errors.purchaseDate && <span className="error-message">{errors.purchaseDate}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="price">价格</label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price}
            onChange={handleChange}
            placeholder="请输入价格"
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label htmlFor="location">存放位置 *</label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className={errors.location ? 'error' : ''}
            placeholder="请输入存放位置"
          />
          {errors.location && <span className="error-message">{errors.location}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="status">状态</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="inStock">在库</option>
            <option value="outStock">出库</option>
            <option value="maintenance">维护中</option>
            <option value="broken">故障</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="category">类别</label>
          <input
            type="text"
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            placeholder="请输入仪器类别"
          />
        </div>

        <div className="form-group">
          <label htmlFor="responsiblePerson">负责人 *</label>
          <input
            type="text"
            id="responsiblePerson"
            name="responsiblePerson"
            value={formData.responsiblePerson}
            onChange={handleChange}
            className={errors.responsiblePerson ? 'error' : ''}
            placeholder="请输入负责人姓名"
          />
          {errors.responsiblePerson && <span className="error-message">{errors.responsiblePerson}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="contactPhone">联系电话</label>
          <input
            type="tel"
            id="contactPhone"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            placeholder="请输入联系电话"
          />
        </div>

        <div className="form-group">
          <label htmlFor="maintenanceCycle">维护周期（天）</label>
          <input
            type="number"
            id="maintenanceCycle"
            name="maintenanceCycle"
            value={formData.maintenanceCycle}
            onChange={handleChange}
            placeholder="请输入维护周期"
            min="1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="lastMaintenanceDate">上次维护日期</label>
          <input
            type="date"
            id="lastMaintenanceDate"
            name="lastMaintenanceDate"
            value={formData.lastMaintenanceDate}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="nextMaintenanceDate">下次维护日期</label>
          <input
            type="date"
            id="nextMaintenanceDate"
            name="nextMaintenanceDate"
            value={formData.nextMaintenanceDate}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="form-group full-width">
        <label htmlFor="description">描述</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="请输入仪器描述信息"
          rows="4"
        />
      </div>

      <div className="form-group full-width">
        <label htmlFor="notes">备注</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="请输入备注信息"
          rows="3"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {isEditing ? '更新' : '保存'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
};

export default InstrumentForm;