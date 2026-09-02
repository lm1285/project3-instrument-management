import React from 'react';
import styles from './InstrumentFlowTable.module.css';
import InstrumentListTable from './InstrumentListTable';
import SearchFilterBar from './SearchFilterBar';
import InstrumentFlowTableHeader from './InstrumentFlowTableHeader';
import OperationModals from '../OperationModals/OperationModals';
import { useInstrumentFlowState } from '../../hooks/useInstrumentFlowState';
import { useInstrumentFlowHandlers } from '../../hooks/useInstrumentFlowHandlers';
import type { ModalStates, Instrument } from '../../types';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';

const InstrumentFlowTable: React.FC = () => {
  const {
    searchQuery,
    flowStatusFilter,
    typeFilter,
    departmentFilter,
    selectedInstrument,
    modalStates,
    systemConfig,
    loading,
    refreshKey,
    setSearchQuery,
    setFlowStatusFilter,
    setTypeFilter,
    setDepartmentFilter,
    setRefreshKey,
    setModalStates,
    setSelectedInstrument,
    setLoading,
  } = useInstrumentFlowState();

  const {
    handleSearch,
    modalHandlers,
    confirmHandlers,
  } = useInstrumentFlowHandlers({
    onRefresh: () => setRefreshKey(refreshKey + 1),
    onSetModalStates: (states: Partial<ModalStates>) => setModalStates((prev) => ({ ...prev, ...states })),
    onSetSelectedInstrument: (instrument: Instrument | null) => setSelectedInstrument(instrument),
    onSetLoading: (isLoading: boolean) => setLoading(isLoading),
  });

  return (
    <PermissionGuard permission="flow:view">
      <div className={styles.page}>
        <InstrumentFlowTableHeader />

        <section className={styles.toolbarCard}>
          <SearchFilterBar
            searchQuery={searchQuery}
            flowStatusFilter={flowStatusFilter}
            typeFilter={typeFilter}
            departmentFilter={departmentFilter}
            onSearch={handleSearch}
            onChangeSearchQuery={setSearchQuery}
            onChangeFlowStatusFilter={setFlowStatusFilter}
            onChangeTypeFilter={setTypeFilter}
            onChangeDepartmentFilter={setDepartmentFilter}
          />
        </section>

        <section className={styles.tableCard}>
          {loading && <div className={styles.loadingIcon} />}
          <InstrumentListTable
            key={refreshKey}
            searchQuery={searchQuery}
            flowStatusFilter={flowStatusFilter}
            typeFilter={typeFilter}
            departmentFilter={departmentFilter}
            onRefresh={() => setRefreshKey(refreshKey + 1)}
            onLoadingChange={setLoading}
            onViewDetail={(inst) => modalHandlers.onViewDetail(inst)}
            onReservation={(inst) => modalHandlers.onReservation(inst)}
            onOpenUse={(inst) => modalHandlers.onUse(inst)}
            onOpenCheckIn={(inst) => modalHandlers.onCheckIn(inst)}
            onOpenCheckOut={(inst) => modalHandlers.onCheckOut(inst)}
            onOpenBorrow={(inst) => modalHandlers.onBorrow(inst)}
          />
        </section>

        <OperationModals
          {...modalStates}
          selectedInstrument={selectedInstrument}
          departments={systemConfig.departments}
          locations={systemConfig.locations}
          purposes={systemConfig.purposes}
          {...confirmHandlers}
        />
      </div>
    </PermissionGuard>
  );
};

export default InstrumentFlowTable;
