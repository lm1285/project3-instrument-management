import { useState } from 'react';
import type { TableSelection } from '../types';

/**
 * 负责仪器表格选择状态管理的 Hook
 */
export const useInstrumentSelection = () => {
  const [selection, setSelection] = useState<TableSelection>({
    selectedRowKeys: []
  });

  // 更新选中行
  const handleSelectionChange = (selectedRowKeys: React.Key[]) => {
    setSelection({ selectedRowKeys });
  };

  // 清空选中状态
  const clearSelection = () => {
    setSelection({ selectedRowKeys: [] });
  };

  // 获取选中的行数
  const getSelectedCount = () => {
    return selection.selectedRowKeys.length;
  };

  // 检查是否有选中项
  const hasSelection = () => {
    return selection.selectedRowKeys.length > 0;
  };

  // 获取选中的ID列表
  const getSelectedIds = () => {
    return [...selection.selectedRowKeys] as string[];
  };

  // 设置单选
  const setSingleSelection = (id: string) => {
    setSelection({ selectedRowKeys: [id] });
  };

  return {
    selection,
    selectedRowKeys: selection.selectedRowKeys,
    handleSelectionChange,
    clearSelection,
    getSelectedCount,
    hasSelection,
    getSelectedIds,
    setSingleSelection
  };
};