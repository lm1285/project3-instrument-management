import { useCallback } from 'react';
import { App } from 'antd';
import { Instrument, InstrumentFormData as FormData } from '../types';
import { mapFrontendToBackend, mapBackendToFrontend } from '../services/instrumentService';
import { generateAlerts } from '../../dashboard/services/alertService';
import { useNavigate } from 'react-router-dom';

import { useInstrumentsData } from './useInstrumentsData';
import { useInstrumentFilters } from './useInstrumentFilters';
import { useInstrumentSelection } from './useInstrumentSelection';
import { useInstrumentForm } from './useInstrumentForm';
import {
  buildMeasurementRangeDetail,
  buildMeasurementRangeSummary,
  buildMeasurementUncertaintySummary,
  normalizeMeasurementItems,
} from '../components/InstrumentList/measurementRangeUtils';

export const useInstrumentManagement = () => {
  const { message } = App.useApp();

  const {
    instruments,
    loading,
    error,
    deleteInstrument: apiDeleteInstrument,
    batchDeleteInstruments: apiBatchDeleteInstruments,
    importInstruments: apiImportInstruments,
    updateInstrument: apiUpdateInstrument,
    addInstrument: apiAddInstrument,
    loadInstruments,
  } = useInstrumentsData();

  const {
    searchQuery,
    filterValues,
    filteredInstruments,
    handleSearch,
    handleFilterChange,
  } = useInstrumentFilters(instruments);

  const {
    selectedRowKeys,
    handleSelectionChange,
    clearSelection,
  } = useInstrumentSelection();

  const navigate = useNavigate();

  const handleUpdateSuccess = useCallback(async () => {
    clearSelection();
    await loadInstruments();
    const raw = localStorage.getItem('alert_threshold_days');
    const threshold = raw ? parseInt(raw, 10) : 30;
    try {
      await generateAlerts(isNaN(threshold) ? 30 : threshold);
    } catch {}
    const intent = localStorage.getItem('editIntent');
    if (intent === 'alertUpdate') {
      localStorage.removeItem('editIntent');
      navigate('/dashboard/alerts');
    }
  }, [clearSelection, loadInstruments, navigate]);

  const handleAddSuccess = useCallback(async () => {
    clearSelection();
    await loadInstruments();
  }, [clearSelection, loadInstruments]);

  const {
    modalState,
    formData,
    errorReason,
    errorMessage,
    handleInputChange,
    handleFileChange,
    applySimilarInstrument,
    handleAddInstrument,
    handleEdit: formHandleEdit,
    handleCloseModal: formHandleCloseModal,
    handleSubmit: formHandleSubmit,
  } = useInstrumentForm(handleUpdateSuccess, handleAddSuccess);

  const handleEdit = useCallback((instrument: Instrument) => {
    const frontendInstrument = mapBackendToFrontend(instrument);
    if (frontendInstrument.id) {
      handleSelectionChange([frontendInstrument.id]);
    } else {
      handleSelectionChange([]);
    }
    formHandleEdit(frontendInstrument as Instrument);
  }, [formHandleEdit, handleSelectionChange]);

  const handleCloseModal = useCallback(() => {
    formHandleCloseModal();
    clearSelection();
  }, [clearSelection, formHandleCloseModal]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const success = await apiDeleteInstrument(id);
      if (success) {
        message.success('删除成功');
        clearSelection();
      } else {
        message.error('删除失败');
      }
    } catch (err) {
      console.error('鍒犻櫎鎿嶄綔澶辫触:', err);
      if (err instanceof Error && err.message.includes('鏉冮檺涓嶈冻')) {
        message.error('删除操作失败：权限不足，无法执行删除');
      } else {
        message.error('删除失败，请重试');
      }
    }
  }, [apiDeleteInstrument, clearSelection, message]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('璇烽€夋嫨瑕佸垹闄ょ殑浠櫒');
      return;
    }

    try {
      const idsToDelete = selectedRowKeys as string[];
      const result = await apiBatchDeleteInstruments(idsToDelete);

      if (result.success) {
        const deletedCount = result.deletedCount ?? idsToDelete.length;
        message.success(`批量删除成功，共删除 ${deletedCount} 台仪器`);
      } else {
        message.error(result.message || '鎵归噺鍒犻櫎澶辫触');
      }

      clearSelection();
    } catch (err) {
      console.error('鎵归噺鍒犻櫎鎿嶄綔澶辫触:', err);
      if (err instanceof Error && err.message.includes('鏉冮檺涓嶈冻')) {
        message.error('批量删除失败：权限不足，无法执行删除');
      } else {
        message.error('批量删除失败');
      }
    }
  }, [apiBatchDeleteInstruments, clearSelection, message, selectedRowKeys]);

  const handleImport = useCallback(async (file: File) => {
    try {
      message.loading('姝ｅ湪瀵煎叆鏁版嵁锛岃绋嶅€?..', 0);
      const result = await apiImportInstruments(file);

      if (result.success) {
        message.success(`导入成功，共导入 ${result.count || 0} 条数据`);
      } else {
        message.error(result.message || '导入失败');
      }
    } catch (err) {
      console.error('瀵煎叆澶辫触:', err);
      message.error('瀵煎叆澶辫触锛岃妫€鏌ユ枃浠舵牸寮忓苟閲嶈瘯');
    } finally {
      message.destroy();
    }
  }, [apiImportInstruments, message]);

  const handleSubmit = useCallback(async () => {
    const handleUpdate = async (
      id: string,
      data: FormData,
    ): Promise<{ success: boolean; message?: string; reason?: string; status?: number }> => {
      const apiData = mapFrontendToBackend({
        ...data,
        attachment: data.attachment || undefined,
        measurementItems: undefined,
        uncertaintyItems: undefined,
        setEntries: undefined,
      });

      const res = await apiUpdateInstrument(id, apiData);
      if (res.success) {
        const intent = localStorage.getItem('editIntent');
        if (intent === 'alertUpdate') {
          try {
            const raw = localStorage.getItem('alert_threshold_days');
            const threshold = raw ? parseInt(raw, 10) : 30;
            const { syncAlertsForInstrument } = await import('../../dashboard/services/alertService');
            await syncAlertsForInstrument(id, isNaN(threshold) ? 30 : threshold);
          } catch {}
        }
      }
      return res;
    };

    const handleAdd = async (data: FormData): Promise<Instrument | null> => {
      if (data.entryMode === 'set') {
        const setEntries = (data.setEntries || []).filter((entry) =>
          [
            entry.model,
            entry.serialNumber,
            entry.managementNumber,
            entry.measureRange,
            entry.uncertainty,
            ...normalizeMeasurementItems(entry.measurementItems || []).map((item) =>
              [item.measurementType, item.element, item.value, item.unit].join(' '),
            ),
          ].some((value) => String(value || '').trim()),
        );

        let firstCreated: Instrument | null = null;

        for (const entry of setEntries) {
          const memberMeasurementItems = normalizeMeasurementItems(entry.measurementItems || []);
          const memberMeasureRange =
            buildMeasurementRangeSummary(memberMeasurementItems) || entry.measureRange || data.measureRange;
          const memberUncertainty =
            buildMeasurementUncertaintySummary(memberMeasurementItems) || entry.uncertainty || data.uncertainty;
          const memberMeasurementDetail =
            buildMeasurementRangeDetail(memberMeasurementItems) ||
            entry.metrologicalParameterRange ||
            data.metrologicalParameterRange;

          const itemPayload = mapFrontendToBackend({
            ...data,
            entryMode: 'single',
            quantity: 1,
            splitRecord: false,
            batchDetails: undefined,
            setEntries: undefined,
            model: entry.model,
            serialNumber: entry.serialNumber,
            managementNumber: entry.managementNumber,
            measureRange: memberMeasureRange,
            uncertainty: memberUncertainty,
            metrologicalParameterRange: memberMeasurementDetail,
            measurementItems: undefined,
            uncertaintyItems: undefined,
            attachment: data.attachment || undefined,
          });

          const created = await apiAddInstrument(itemPayload);
          if (!created && !firstCreated) {
            return null;
          }
          firstCreated = firstCreated || created;
        }

        return firstCreated;
      }

      const apiData = mapFrontendToBackend({
        ...data,
        splitRecord: data.entryMode === 'batch' ? data.splitRecord : false,
        quantity: data.entryMode === 'batch' ? data.quantity : 1,
        batchDetails: data.entryMode === 'batch' ? data.batchDetails : undefined,
        measurementItems: undefined,
        uncertaintyItems: undefined,
        setEntries: undefined,
        attachment: data.attachment || undefined,
      });
      return await apiAddInstrument(apiData);
    };

    return await formHandleSubmit(handleUpdate, handleAdd);
  }, [apiAddInstrument, apiUpdateInstrument, formHandleSubmit]);

  return {
    instruments: filteredInstruments,
    allInstruments: instruments,
    loading,
    error,
    searchQuery,
    filterValues,
    selectedRowKeys,
    modalState,
    formData,
    errorReason,
    errorMessage,
    handleSearch,
    handleFilterChange,
    handleAddInstrument,
    handleEdit,
    handleDelete,
    handleBatchDelete,
    handleImport,
    handleCloseModal,
    handleSubmit,
    handleSelectionChange,
    handleInputChange,
    handleFileChange,
    applySimilarInstrument,
    loadInstruments,
  };
};



