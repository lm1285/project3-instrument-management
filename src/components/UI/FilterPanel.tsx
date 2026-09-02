import React from 'react';
import { Select, DatePicker, Button } from 'antd';

// 使用内联样式代替CSS模块，因为CSS文件找不到
const styles = {
  filterPanel: '',
  filterRow: '',
  filterItem: '',
  filterSelect: '',
  filterDatePicker: ''
};

const { RangePicker } = DatePicker;

export interface FilterValues {
  type?: string;
  traceabilityMethod?: string;
  department?: string;
  instrumentStatus?: string;
  storageStatus?: string;
  dateRange?: [any, any];
}

interface Option {
  label: string;
  value: string;
}

interface FilterPanelProps {
  filterValues: FilterValues;
  onFilterChange: (values: FilterValues) => void;
  className?: string;
  typeOptions?: Option[];
  traceabilityMethodOptions?: Option[];
  departmentOptions?: Option[];
  instrumentStatusOptions?: Option[];
  storageStatusOptions?: Option[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filterValues = {},
  onFilterChange = () => {},
  className = '',
  typeOptions = [],
  traceabilityMethodOptions = [],
  departmentOptions = [],
  instrumentStatusOptions = [],
  storageStatusOptions = [],
}) => {

  // 处理单个筛选条件变化
  const handleFilterChange = (key: keyof FilterValues, value: any) => {
    const newFilterValues = { ...filterValues, [key]: value };
    onFilterChange(newFilterValues);
  };

  return (
    <div className={`${styles.filterPanel} ${className}`}>
      {/* 类型筛选 */}
      <Select
        className={styles.filterSelect}
        placeholder="类型"
        allowClear
        value={filterValues.type}
        onChange={(value) => handleFilterChange('type', value)}
        options={typeOptions}
        style={{ width: 120, height: 32, marginRight: 8, textAlign: 'center' }}
      />

      {/* 溯源方式筛选 */}
      <Select
        className={styles.filterSelect}
        placeholder="溯源方式"
        allowClear
        value={filterValues.traceabilityMethod}
        onChange={(value) => handleFilterChange('traceabilityMethod', value)}
        options={traceabilityMethodOptions}
         style={{ width: 120, height: 32, marginRight: 8, textAlign: 'center' }}
      />

      {/* 科室筛选 */}
      <Select
        className={styles.filterSelect}
        placeholder="科室"
        allowClear
        value={filterValues.department}
        onChange={(value) => handleFilterChange('department', value)}
        options={departmentOptions}
         style={{ width: 120, height: 32, marginRight: 8, textAlign: 'center' }}
      />

      {/* 仪器状态筛选 */}
      <Select
        className={styles.filterSelect}
        placeholder="仪器状态"
        allowClear
        value={filterValues.instrumentStatus}
        onChange={(value) => handleFilterChange('instrumentStatus', value)}
        options={instrumentStatusOptions}
         style={{ width: 120, height: 32, marginRight: 8, textAlign: 'center' }}
      />

      {/* 出入库状态筛选 */}
      <Select
        className={styles.filterSelect}
        placeholder="出入库状态"
        allowClear
        value={filterValues.storageStatus}
        onChange={(value) => handleFilterChange('storageStatus', value)}
        options={storageStatusOptions}
        style={{ width: 120, height: 32, marginRight: 8, textAlign: 'center' }}
      />

      {/* 时间范围选择 */}
      <RangePicker
        className={styles.filterDatePicker}
        value={filterValues.dateRange}
        onChange={(value) => handleFilterChange('dateRange', value)}
        placeholder={['开始时间', '结束时间']}
        style={{ width: 240, height: 32, marginRight: 8, textAlign: 'center' }}
      />
      
      {/* 重置按钮 */}
      <Button onClick={() => onFilterChange({})} style={{ width: 80, height: 32, textAlign: 'center', marginLeft: 10 }}>
        重置
      </Button>
    </div>
  );
};

export default FilterPanel;
