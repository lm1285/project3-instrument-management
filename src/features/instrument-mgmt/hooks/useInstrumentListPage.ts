import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Instrument } from '../types';
import {
  INSTRUMENT_VIEW_TYPE_TO_DOMAIN_TYPE,
  INSTRUMENT_VIEW_TYPE_TO_TABLE_VIEW,
} from '../components/InstrumentList/instrumentListConfig';

type UseInstrumentListPageParams = {
  instruments: Instrument[];
  viewType: string;
  setViewType: (value: string) => void;
  filterValues: Record<string, any>;
  handleFilterChange: (value: Record<string, any>) => void;
  handleEdit: (instrument: Instrument) => void;
};

export function useInstrumentListPage({
  instruments,
  viewType,
  setViewType,
  filterValues,
  handleFilterChange,
  handleEdit,
}: UseInstrumentListPageParams) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dataSource = useMemo(() => {
    const targetType = INSTRUMENT_VIEW_TYPE_TO_DOMAIN_TYPE[viewType];
    if (!targetType) {
      return instruments;
    }

    return instruments.filter((instrument) => instrument.type === targetType);
  }, [instruments, viewType]);

  const clearTypeFilter = useCallback(() => {
    if (!filterValues.type) {
      return;
    }

    const nextFilters = { ...filterValues };
    delete nextFilters.type;
    handleFilterChange(nextFilters);
  }, [filterValues, handleFilterChange]);

  const handleTabChange = useCallback((key: string) => {
    setViewType(key);
    clearTypeFilter();
  }, [clearTypeFilter, setViewType]);

  useEffect(() => {
    if (viewType === 'all') {
      clearTypeFilter();
    }
  }, [clearTypeFilter, viewType]);

  useEffect(() => {
    const managementNumber = localStorage.getItem('editInstrumentManagementNumber');
    if (!managementNumber) {
      return;
    }

    const target = instruments.find((instrument) => instrument.managementNumber === managementNumber);
    if (!target) {
      return;
    }

    handleEdit(target);
    localStorage.removeItem('editInstrumentManagementNumber');
    localStorage.removeItem('editIntent');
  }, [handleEdit, instruments]);

  return {
    dataSource,
    handleTabChange,
    isMobile,
    selectedRowKeys,
    setSelectedRowKeys,
    selectedFilterType: INSTRUMENT_VIEW_TYPE_TO_DOMAIN_TYPE[viewType],
    tableViewType: INSTRUMENT_VIEW_TYPE_TO_TABLE_VIEW[viewType],
  };
}
