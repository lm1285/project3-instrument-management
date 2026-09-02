import React, { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, DatePicker, Select, Space, Tag, Upload } from 'antd';
import {
  ClearOutlined,
  DownloadOutlined,
  DownOutlined,
  FilterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs from 'dayjs';
import type { FilterValues, Instrument } from '../../types';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import {
  DEPARTMENT_OPTIONS,
  getSearchSuggestions,
  INSTRUMENT_STATUS_OPTIONS,
  STORAGE_STATUS_OPTIONS,
  TRACEABILITY_METHOD_OPTIONS,
  updateFilterValues,
  validateInstrumentImportFile,
} from './searchFilterUtils';
import './SearchFilter.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

interface SearchFilterProps {
  searchQuery: string;
  filterValues: FilterValues;
  onSearch: (value: string) => void;
  onFilterChange: (values: FilterValues) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onAddInstrument: () => void;
  onMergeGroupManage: () => void;
  isMobile: boolean;
  instruments: Instrument[];
}

const SearchFilter: React.FC<SearchFilterProps> = ({
  searchQuery,
  filterValues,
  onSearch,
  onFilterChange,
  onImport,
  onExport,
  onAddInstrument,
  onMergeGroupManage,
  instruments = [],
  isMobile = false,
}) => {
  const { message } = App.useApp();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(searchQuery);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!isMobile) {
      setSearchExpanded(true);
    }
  }, [isMobile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      onSearch('');
      return;
    }

    const nextSuggestions = getSearchSuggestions(instruments, value);
    setSuggestions(nextSuggestions);
    setShowSuggestions(nextSuggestions.length > 0);
  };

  const triggerSearch = (value: string) => {
    setShowSuggestions(false);
    onSearch(value.trim());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      triggerSearch(inputValue);
    }

    if (showSuggestions && event.key === 'Escape') {
      setShowSuggestions(false);
      event.preventDefault();
    }
  };

  const handleDateRangeChange: RangePickerProps['onChange'] = (_, dateStrings) => {
    if (dateStrings && dateStrings.length === 2) {
      onFilterChange(updateFilterValues(filterValues, 'dateRange', dateStrings as [string, string]));
      return;
    }

    onFilterChange(updateFilterValues(filterValues, 'dateRange', undefined));
  };

  const handleUpload = (file: File & { size: number; type: string; name: string }) => {
    const validation = validateInstrumentImportFile(file);
    if (!validation.valid) {
      message.error(validation.message);
      return validation.result;
    }

    onImport(file);
    return false;
  };

  const resetFilters = () => {
    setInputValue('');
    setSuggestions([]);
    setShowSuggestions(false);
    setAdvancedExpanded(false);
    onSearch('');
    onFilterChange({
      dateField: filterValues.dateField || 'calibrationDate',
    });
  };

  const dateRangeValue: [dayjs.Dayjs, dayjs.Dayjs] | null = filterValues.dateRange
    ? [dayjs(filterValues.dateRange[0]), dayjs(filterValues.dateRange[1])]
    : null;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery?.trim()) count += 1;
    if (filterValues.instrumentStatus) count += 1;
    if (filterValues.storageStatus) count += 1;
    if (filterValues.department) count += 1;
    if (filterValues.traceabilityMethod) count += 1;
    if (filterValues.dateRange?.length === 2) count += 1;
    return count;
  }, [filterValues, searchQuery]);

  return (
    <div className="instrument-search-panel">
      <div className="instrument-search-toolbar">
        <div className="instrument-search-toolbar-main">
          {!isMobile && (
            <Button
              icon={searchExpanded ? <UpOutlined /> : <DownOutlined />}
              onClick={() => setSearchExpanded((current) => !current)}
              className="instrument-action-button"
            >
              {searchExpanded ? '收起筛选' : '展开筛选'}
            </Button>
          )}

          <div className="instrument-search-box">
            <div className="instrument-search-input-shell">
              <span className="instrument-search-leading">
                <SearchOutlined />
              </span>
              <input
                type="text"
                placeholder="输入名称、型号、编号、管理编号、测量范围或仪器 ID"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="instrument-search-input"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => {
                    setInputValue('');
                    setSuggestions([]);
                    setShowSuggestions(false);
                    onSearch('');
                  }}
                  className="instrument-search-clear"
                  aria-label="clear"
                >
                  <ClearOutlined />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="instrument-search-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion}-${index}`}
                    type="button"
                    onClick={() => {
                      setInputValue(suggestion);
                      triggerSearch(suggestion);
                    }}
                    className="instrument-search-suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`instrument-action-cluster ${isMobile ? 'mobile' : ''}`}>
          <PermissionGuard permission="instrument:add">
            <Button
              type="primary"
              onClick={onAddInstrument}
              icon={<PlusOutlined />}
              className="instrument-action-button instrument-action-button-primary"
            >
              新增仪器
            </Button>
          </PermissionGuard>

          {!isMobile && (
            <>
              <PermissionGuard permission="instrument:merge">
                <Button onClick={onMergeGroupManage} className="instrument-action-button">
                  合并组管理
                </Button>
              </PermissionGuard>

              <PermissionGuard permission="instrument:import">
                <Space.Compact>
                  <Upload beforeUpload={handleUpload} showUploadList={false} accept=".csv,.xlsx,.xls,.xlsm">
                    <Button icon={<UploadOutlined />} className="instrument-action-button">
                      导入数据
                    </Button>
                  </Upload>
                </Space.Compact>
              </PermissionGuard>

              <PermissionGuard permission="instrument:export">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={onExport}
                  className="instrument-action-button"
                >
                  导出数据
                </Button>
              </PermissionGuard>
            </>
          )}
        </div>
      </div>

      {searchExpanded && (
        <div className="instrument-filter-shell">
          <div className="instrument-filter-row">
            <div className="instrument-filter-state-row">
              <div className="instrument-filter-overview-title">
                <FilterOutlined />
                <span>筛选条件</span>
              </div>
              <Space size={[8, 8]} wrap>
                {activeFilterCount > 0 ? (
                  <>
                    {searchQuery?.trim() && <Tag>搜索: {searchQuery}</Tag>}
                    {filterValues.instrumentStatus && <Tag>状态: {filterValues.instrumentStatus}</Tag>}
                    {filterValues.storageStatus && <Tag>出入库: {filterValues.storageStatus}</Tag>}
                    {filterValues.department && <Tag>科室: {filterValues.department}</Tag>}
                    {filterValues.traceabilityMethod && <Tag>溯源: {filterValues.traceabilityMethod}</Tag>}
                    {filterValues.dateRange?.length === 2 && (
                      <Tag>{filterValues.dateRange[0]} ~ {filterValues.dateRange[1]}</Tag>
                    )}
                  </>
                ) : (
                  <Tag bordered={false}>当前未启用筛选条件</Tag>
                )}
              </Space>
            </div>

            <div className="instrument-filter-grid basic">
              <div className="instrument-filter-item">
                <Select
                  placeholder="仪器状态"
                  value={filterValues.instrumentStatus}
                  onChange={(value) =>
                    onFilterChange(updateFilterValues(filterValues, 'instrumentStatus', value))
                  }
                  allowClear
                >
                  {INSTRUMENT_STATUS_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>

              <div className="instrument-filter-item">
                <Select
                  placeholder="出入库状态"
                  value={filterValues.storageStatus}
                  onChange={(value) =>
                    onFilterChange(updateFilterValues(filterValues, 'storageStatus', value))
                  }
                  allowClear
                >
                  {STORAGE_STATUS_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>

              <div className="instrument-filter-item">
                <Select
                  placeholder="科室"
                  value={filterValues.department}
                  onChange={(value) =>
                    onFilterChange(updateFilterValues(filterValues, 'department', value))
                  }
                  allowClear
                >
                  {DEPARTMENT_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>

              <div className="instrument-filter-item">
                <Select
                  placeholder="溯源方式"
                  value={filterValues.traceabilityMethod}
                  onChange={(value) =>
                    onFilterChange(updateFilterValues(filterValues, 'traceabilityMethod', value))
                  }
                  allowClear
                >
                  {TRACEABILITY_METHOD_OPTIONS.map((option) => (
                    <Option key={option} value={option}>
                      {option}
                    </Option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="instrument-filter-actions">
              <Button
                icon={<ReloadOutlined />}
                onClick={resetFilters}
                className="instrument-filter-action-button"
              >
                重置
              </Button>
              <Button
                type="default"
                onClick={() => setAdvancedExpanded((current) => !current)}
                className="instrument-filter-action-button"
              >
                {advancedExpanded ? '收起高级筛选' : '高级筛选'}
              </Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => triggerSearch(inputValue)}
                className="instrument-filter-action-button"
              >
                搜索
              </Button>
            </div>
          </div>

          {advancedExpanded && (
            <div className="instrument-advanced-shell">
              <div className="instrument-advanced-title">高级筛选</div>
              <div className="instrument-filter-grid advanced">
                <div className="instrument-filter-item instrument-filter-item-wide">
                  <Space.Compact style={{ width: '100%' }}>
                    <Select
                      value={filterValues.dateField || 'calibrationDate'}
                      onChange={(value) =>
                        onFilterChange(
                          updateFilterValues(
                            filterValues,
                            'dateField',
                            value as 'calibrationDate' | 'nextCalibrationDate',
                          ),
                        )
                      }
                      style={{ width: 140 }}
                    >
                      <Option value="calibrationDate">校准日期</Option>
                      <Option value="nextCalibrationDate">复校日期</Option>
                    </Select>
                    <RangePicker
                      value={dateRangeValue}
                      placeholder={['开始日期', '结束日期']}
                      onChange={handleDateRangeChange}
                      style={{ width: 'calc(100% - 140px)' }}
                    />
                  </Space.Compact>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div className="instrument-mobile-actions">
          <Button
            icon={searchExpanded ? <UpOutlined /> : <DownOutlined />}
            className="instrument-mobile-action"
            onClick={() => setSearchExpanded((current) => !current)}
          >
            筛选
          </Button>

          <PermissionGuard permission="instrument:import">
            <Upload beforeUpload={handleUpload} showUploadList={false} accept=".csv,.xlsx,.xls,.xlsm">
              <Button icon={<UploadOutlined />} className="instrument-mobile-action">
                导入
              </Button>
            </Upload>
          </PermissionGuard>

          <PermissionGuard permission="instrument:export">
            <Button icon={<DownloadOutlined />} onClick={onExport} className="instrument-mobile-action">
              导出
            </Button>
          </PermissionGuard>

          <PermissionGuard permission="instrument:merge">
            <Button onClick={onMergeGroupManage} className="instrument-mobile-action">
              合并组
            </Button>
          </PermissionGuard>

        </div>
      )}
    </div>
  );
};

export default SearchFilter;
