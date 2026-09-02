import { useState, useMemo } from 'react';

/**
 * 通用搜索和筛选 Hook
 * 用于统一处理各种列表数据的搜索和筛选功能
 */
export function useSearchFilter<T extends Record<string, any>>(
  data: T[],
  searchFields: (keyof T)[],
  initialFilters: Record<string, any> = {}
) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // 处理筛选条件变化
  const handleFilterChange = (newFilters: Record<string, any>) => {
    setFilters(newFilters);
  };

  // 重置筛选条件
  const resetFilters = () => {
    setSearchQuery('');
    setFilters(initialFilters);
  };

  // 应用搜索和筛选逻辑
  const filteredData = useMemo(() => {
    let result = [...data];

    // 应用搜索条件
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        searchFields.some(field => {
          const value = item[field];
          return typeof value === 'string' && value.toLowerCase().includes(query);
        })
      );
    }

    // 应用筛选条件
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && value !== 'all') {
        result = result.filter(item => item[key] === value);
      }
    });

    return result;
  }, [data, searchQuery, filters, searchFields]);

  return {
    searchQuery,
    filters,
    filteredData,
    handleSearch,
    handleFilterChange,
    resetFilters
  };
}

export default useSearchFilter;