import React from 'react';
import './DetailStyles.css';

/**
 * 仪器详情组件
 * 用于展示仪器的详细信息
 */
const InstrumentDetail = ({ data = {}, onClose }) => {
  // 格式化日期显示
  const formatDate = (dateString) => {
    if (!dateString) return '无';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN');
    } catch (error) {
      return dateString;
    }
  };

  // 状态映射
  const statusMap = {
    '正常': { text: '正常', className: 'status-normal' },
    '禁用': { text: '禁用', className: 'status-disabled' },
    '待校准': { text: '待校准', className: 'status-pending' },
    '已过期': { text: '已过期', className: 'status-expired' },
    '维修中': { text: '维修中', className: 'status-repairing' }
  };

  // 校准状态映射
  const calibrationStatusMap = {
    '正常': { text: '正常', className: 'status-normal' },
    '待校准': { text: '待校准', className: 'status-pending' },
    '已过期': { text: '已过期', className: 'status-expired' }
  };

  // 渲染状态标签
  const renderStatusTag = (status, map) => {
    const statusInfo = map[status] || { text: status || '未知', className: 'status-unknown' };
    return (
      <span className={`status-tag ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    );
  };

  // 详情字段配置
  const detailFields = [
    { label: '管理编号', value: data.managementNumber || '无' },
    { label: '仪器名称', value: data.name || '无' },
    { label: '型号', value: data.model || '无' },
    { label: '规格', value: data.specifications || '无' },
    { label: '制造商', value: data.manufacturer || '无' },
    { label: '测量范围', value: data.measurementRange || '无' },
    { label: '不确定度', value: data.uncertainty || '无' },
    { label: '校准状态', value: renderStatusTag(data.calibrationStatus, calibrationStatusMap) },
    { label: '校准日期', value: formatDate(data.calibrationDate) },
    { label: '下次校准日期', value: formatDate(data.nextCalibrationDate) },
    { label: '部门', value: data.department || '无' },
    { label: '库位', value: data.location || '无' },
    { label: '保管人', value: data.custodian || '无' },
    { label: '采购日期', value: formatDate(data.purchaseDate) },
    { label: '单位', value: data.unit || '无' },
    { label: '价值', value: data.value ? `¥${data.value}` : '无' },
    { label: '状态', value: renderStatusTag(data.status, statusMap) },
    { label: '备注', value: data.remarks || '无' }
  ];

  return (
    <div className="instrument-detail">
      <div className="detail-header">
        <h2 className="detail-title">仪器详情</h2>
      </div>
      
      <div className="detail-content">
        <div className="detail-grid">
          {detailFields.map((field, index) => (
            <div key={index} className="detail-item">
              <div className="detail-label">{field.label}</div>
              <div className="detail-value">{field.value}</div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="detail-footer">
        <button 
          className="btn btn-primary"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  );
};

export default InstrumentDetail;