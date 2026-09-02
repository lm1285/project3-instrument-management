import { useMemo, useState } from 'react';
import type { FilterValues, Instrument } from '../types';

export const useInstrumentFilters = (instruments: Instrument[]) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterValues, setFilterValues] = useState<FilterValues>({});

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (values: FilterValues) => {
    setFilterValues(values);
  };

  const filteredInstruments = useMemo(() => {
    let result = [...instruments];

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      result = result.filter((instrument) =>
        (instrument.name?.toLowerCase().includes(query))
        || (instrument.model?.toLowerCase().includes(query))
        || (instrument.serialNumber?.toLowerCase().includes(query))
        || (instrument.managementNumber?.toLowerCase().includes(query))
        || (instrument.measureRange?.toLowerCase().includes(query))
        || (instrument.id?.toLowerCase().includes(query))
      );
    }

    if (filterValues.type) {
      result = result.filter((instrument) => instrument.type === filterValues.type);
    }

    if (filterValues.traceabilityMethod) {
      result = result.filter(
        (instrument) => filterValues.traceabilityMethod === (instrument.traceabilityMethod || ''),
      );
    }

    if (filterValues.department) {
      result = result.filter(
        (instrument) => filterValues.department === (instrument.department || ''),
      );
    }

    if (filterValues.instrumentStatus) {
      result = result.filter(
        (instrument) => filterValues.instrumentStatus === (instrument.status || ''),
      );
    }

    if (filterValues.storageStatus) {
      result = result.filter(
        (instrument) => filterValues.storageStatus === (instrument.inOutStatus || ''),
      );
    }

    if (filterValues.dateRange && filterValues.dateRange[0] && filterValues.dateRange[1]) {
      const startDate = new Date(filterValues.dateRange[0]);
      const endDate = new Date(filterValues.dateRange[1]);
      const dateField = (filterValues.dateField || 'calibrationDate') as keyof Instrument;

      result = result.filter((instrument) => {
        const dateStr = instrument[dateField] as string | undefined;
        if (!dateStr) {
          return false;
        }

        const date = new Date(dateStr);
        return date >= startDate && date <= endDate;
      });
    }

    if (filterValues.groupName) {
      result = result.filter(
        (instrument) => filterValues.groupName === (instrument.groupName || instrument.mergeGroupName || ''),
      );
    }

    if (filterValues.groupModel) {
      result = result.filter(
        (instrument) => filterValues.groupModel === (instrument.groupModel || instrument.mergeGroupModel || ''),
      );
    }

    return result;
  }, [filterValues, instruments, searchQuery]);

  return {
    searchQuery,
    filterValues,
    filteredInstruments,
    handleSearch,
    handleFilterChange,
  };
};
