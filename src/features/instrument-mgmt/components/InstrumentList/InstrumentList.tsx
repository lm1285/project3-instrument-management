import React, { useEffect } from 'react';
import { App, Card, Tabs } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import SearchFilter from './SearchFilter';
import { MergeGroupManagementModal } from '../MergeGroup/MergeGroupManagementModal';
import InstrumentFormModal from './InstrumentFormModal';
import TableView from './TableView';
import { useInstrumentManagement } from '../../hooks/useInstrumentManagement';
import { useInstrumentListState } from '../../hooks/useInstrumentListState';
import { useInstrumentListPage } from '../../hooks/useInstrumentListPage';
import { exportInstrumentsToCSV } from '../../utils/csvExportUtils';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import { INSTRUMENT_LIST_TABS } from './instrumentListConfig';
import './InstrumentList.css';

const InstrumentList: React.FC = () => {
  App.useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    viewType,
    setViewType,
    isMergeGroupModalVisible,
    setIsMergeGroupModalVisible,
    fetchMergeGroups,
  } = useInstrumentListState();

  const {
    instruments = [],
    allInstruments = [],
    loading = false,
    searchQuery = '',
    filterValues = {},
    modalState = { visible: false, type: 'add' },
    formData,
    errorReason,
    errorMessage,
    handleSearch,
    handleFilterChange,
    handleAddInstrument,
    handleEdit,
    loadInstruments,
    handleDelete,
    handleBatchDelete,
    handleImport,
    handleCloseModal,
    handleSubmit,
    handleInputChange,
    handleFileChange,
    applySimilarInstrument,
  } = useInstrumentManagement();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const locateValue = searchParams.get('locate');

    if (!locateValue) {
      return;
    }

    handleSearch(locateValue);
    searchParams.delete('locate');
    navigate(
      {
        pathname: location.pathname,
        search: searchParams.toString() ? `?${searchParams.toString()}` : '',
      },
      { replace: true },
    );
  }, [handleSearch, location.pathname, location.search, navigate]);

  const {
    dataSource,
    handleTabChange,
    isMobile,
    selectedRowKeys,
    setSelectedRowKeys,
    selectedFilterType,
    tableViewType,
  } = useInstrumentListPage({
    instruments,
    viewType,
    setViewType,
    filterValues,
    handleFilterChange,
    handleEdit,
  });

  return (
    <PermissionGuard permission="instrument:view">
      <div className="instrument-workspace">
        <section className="instrument-panel">
          <SearchFilter
            searchQuery={searchQuery}
            filterValues={filterValues}
            onSearch={handleSearch}
            onFilterChange={handleFilterChange}
            onAddInstrument={handleAddInstrument}
            onImport={handleImport}
            onExport={() => exportInstrumentsToCSV(instruments)}
            onMergeGroupManage={() => setIsMergeGroupModalVisible(true)}
            instruments={instruments}
            isMobile={isMobile}
          />
        </section>

        <Card
          variant="borderless"
          className="instrument-data-card"
          styles={{ body: { padding: 0 } }}
        >
          <div className="instrument-data-card-head compact">
            <Tabs
              className="instrument-type-tabs"
              activeKey={viewType}
              onChange={handleTabChange}
              items={INSTRUMENT_LIST_TABS as any}
              type="card"
              tabBarStyle={{ marginBottom: 0 }}
            />
          </div>

          <div className="instrument-table-shell">
            <TableView
              dataSource={dataSource}
              loading={loading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onBatchDelete={handleBatchDelete}
              selectedRowKeys={selectedRowKeys}
              onSelectionChange={setSelectedRowKeys}
              viewType={tableViewType}
              groupDefsTick={0}
              onRefresh={loadInstruments}
            />
          </div>
        </Card>

        <InstrumentFormModal
          modalState={modalState}
          formData={formData}
          instruments={allInstruments}
          errorReason={errorReason}
          errorMessage={errorMessage}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          onInputChange={handleInputChange}
          onFileChange={handleFileChange}
          onApplySimilarInstrument={applySimilarInstrument}
        />

        <MergeGroupManagementModal
          visible={isMergeGroupModalVisible}
          onClose={() => setIsMergeGroupModalVisible(false)}
          onSuccess={() => {
            loadInstruments();
            fetchMergeGroups();
          }}
          initialType={selectedFilterType}
          instruments={instruments}
        />
      </div>
    </PermissionGuard>
  );
};

export default InstrumentList;
