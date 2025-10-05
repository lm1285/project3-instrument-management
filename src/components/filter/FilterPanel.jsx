import React from 'react';
import '../common/FormStyles.css';

/**
 * 筛选面板组件
 * 包含部门、类型、状态、库位等筛选条件
 */
const FilterPanel = ({ 
  departments = [], 
  types = [], 
  statuses = [], 
  locations = [], 
  dateRanges = [],
  filters, 
  onFilterChange,
  onReset,
  onDateRangeChange
}) => {
  const handleSelectChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <div className="filter-panel">
      <div className="filter-row">
        {/* 部门筛选 */}
        <div className="filter-item">
          <label className="filter-label">部门</label>
          <select
            className="filter-select"
            value={filters.department || ''}
            onChange={(e) => handleSelectChange('department', e.target.value)}
          >
            <option value="">全部</option>
            {departments.map(dept => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* 类型筛选 */}
        <div className="filter-item">
          <label className="filter-label">类型</label>
          <select
            className="filter-select"
            value={filters.type || ''}
            onChange={(e) => handleSelectChange('type', e.target.value)}
          >
            <option value="">全部</option>
            {types.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* 状态筛选 */}
        <div className="filter-item">
          <label className="filter-label">状态</label>
          <select
            className="filter-select"
            value={filters.status || ''}
            onChange={(e) => handleSelectChange('status', e.target.value)}
          >
            <option value="">全部</option>
            {statuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* 库位筛选 */}
        <div className="filter-item">
          <label className="filter-label">库位</label>
          <select
            className="filter-select"
            value={filters.location || ''}
            onChange={(e) => handleSelectChange('location', e.target.value)}
          >
            <option value="">全部</option>
            {locations.map(loc => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 日期范围和重置按钮 */}
      <div className="filter-row">
        <div className="filter-item">
          <label className="filter-label">日期范围</label>
          <select
            className="filter-select"
            value={filters.dateRange || ''}
            onChange={(e) => {
              handleSelectChange('dateRange', e.target.value);
              if (onDateRangeChange) {
                onDateRangeChange(e.target.value);
              }
            }}
          >
            <option value="">全部</option>
            {dateRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <button 
            className="btn btn-reset"
            onClick={handleReset}
          >
            重置筛选
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;