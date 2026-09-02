import React, { useState } from 'react';
import { Button, Input, Select } from 'antd';
import {
  DownOutlined,
  ReloadOutlined,
  ScanOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import WeChatLikeScanner from '../../../../components/Scanner/WeChatLikeScanner';
import styles from './SearchFilterBar.module.css';

interface SearchFilterBarProps {
  searchQuery: string;
  flowStatusFilter: string | undefined;
  typeFilter: string | undefined;
  departmentFilter: string | undefined;
  onSearch: () => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeFlowStatusFilter: (value: string | undefined) => void;
  onChangeTypeFilter: (value: string | undefined) => void;
  onChangeDepartmentFilter: (value: string | undefined) => void;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  flowStatusFilter,
  typeFilter,
  departmentFilter,
  onSearch,
  onChangeSearchQuery,
  onChangeFlowStatusFilter,
  onChangeTypeFilter,
  onChangeDepartmentFilter,
}) => {
  const [showScanner, setShowScanner] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const handleScanResult = (result: string) => {
    setShowScanner(false);
    let processedResult = result;

    try {
      const parsed = JSON.parse(result);
      if (typeof parsed === 'object' && parsed !== null) {
        const targetKeys = ['managementNumber', 'management_number', 'code', 'number', 'id'];
        for (const key of targetKeys) {
          if ((parsed as Record<string, unknown>)[key]) {
            processedResult = String((parsed as Record<string, unknown>)[key]);
            break;
          }
        }
      }
    } catch {
      if (result.startsWith('http://') || result.startsWith('https://')) {
        try {
          const url = new URL(result);
          const parts = url.pathname.split('/').filter(Boolean);
          if (parts.length > 0) processedResult = parts[parts.length - 1];
        } catch {
          processedResult = result;
        }
      }
    }

    onChangeSearchQuery(processedResult);
    window.setTimeout(() => onSearch(), 100);
  };

  const resetFilters = () => {
    onChangeSearchQuery('');
    onChangeFlowStatusFilter(undefined);
    onChangeTypeFilter(undefined);
    onChangeDepartmentFilter(undefined);
    window.setTimeout(() => onSearch(), 0);
  };

  return (
    <div className={styles.searchPanel}>
      {showScanner && <WeChatLikeScanner onScan={handleScanResult} onClose={() => setShowScanner(false)} />}

      <div className={styles.header}>
        <button
          type="button"
          className={styles.collapseTrigger}
          onClick={() => setSearchExpanded((current) => !current)}
        >
          <span className={styles.collapseIcon}>
            {searchExpanded ? <DownOutlined /> : <UpOutlined />}
          </span>
          <span>搜索</span>
        </button>
        <span className={styles.summary}>按关键字、状态、类型和科室快速定位流转记录</span>
      </div>

      {searchExpanded && (
        <div className={styles.body}>
          <div className={styles.grid}>
            <PermissionGuard permission="flow:search">
              <div className={`${styles.field} ${styles.fieldWide}`}>
                <Input
                  placeholder="请输入关键字，搜索仪器名称、型号、编号、位置或科室"
                  value={searchQuery}
                  onChange={(event) => onChangeSearchQuery(event.target.value)}
                  onPressEnter={onSearch}
                  allowClear
                  className={styles.searchInput}
                  suffix={(
                    <div className={styles.suffix}>
                      <ScanOutlined
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                          setShowScanner(true);
                        }}
                        className={styles.scanIcon}
                        title="扫码搜索"
                      />
                      <SearchOutlined />
                    </div>
                  )}
                />
              </div>
            </PermissionGuard>

            <div className={styles.field}>
              <Select
                placeholder="出入状态"
                value={flowStatusFilter}
                onChange={onChangeFlowStatusFilter}
                allowClear
                className={styles.select}
              >
                <Select.Option value="在库中">在库中</Select.Option>
                <Select.Option value="已出库">已出库</Select.Option>
              </Select>
            </div>
          </div>

          {advancedExpanded && (
            <div className={styles.advanced}>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <Select
                    placeholder="类型"
                    value={typeFilter}
                    onChange={onChangeTypeFilter}
                    allowClear
                    className={styles.select}
                  >
                    <Select.Option value="标准器">标准器</Select.Option>
                    <Select.Option value="标准物质">标准物质</Select.Option>
                    <Select.Option value="辅助设备">辅助设备</Select.Option>
                  </Select>
                </div>

                <div className={styles.field}>
                  <Select
                    placeholder="科室"
                    value={departmentFilter}
                    onChange={onChangeDepartmentFilter}
                    allowClear
                    className={styles.select}
                  >
                    <Select.Option value="理化">理化</Select.Option>
                    <Select.Option value="热工">热工</Select.Option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>
              重置
            </Button>
            <Button onClick={() => setAdvancedExpanded((current) => !current)}>
              {advancedExpanded ? '收起高级搜索' : '高级搜索'}
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={onSearch}>
              搜索
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
