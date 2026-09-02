import { useCallback, useState } from 'react';
import { App } from 'antd';
import { InOutStatus, InstrumentStatus } from '../../../constants/instrument';
import type {
  Instrument,
  InstrumentFormData as FormData,
  MeasurementRangeItem,
  ModalState,
} from '../types';
import {
  attachUncertaintyToMeasurementItems,
  buildMeasurementRangeDetail,
  buildMeasurementRangeSummary,
  buildMeasurementUncertaintySummary,
  buildUncertaintyItems,
  createEmptyMeasurementItem,
  deserializeMeasurementItems,
  normalizeMeasurementItems,
} from '../components/InstrumentList/measurementRangeUtils';

const safeTrim = (value: unknown) => String(value || '').trim();

const createEmptySetEntry = (index = 1) => ({
  id: `set-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  model: '',
  serialNumber: '',
  managementNumber: '',
  measureRange: '',
  uncertainty: '',
  metrologicalParameterRange: '',
  measurementItems: [createEmptyMeasurementItem()],
});

const normalizeMeasurementState = (
  measurementItems: MeasurementRangeItem[] = [],
  uncertaintyItems: string[] = [],
  fallbackUncertainty?: string,
) => {
  const normalizedItems = attachUncertaintyToMeasurementItems(
    measurementItems,
    uncertaintyItems,
    fallbackUncertainty,
  );
  const editableItems =
    normalizedItems.length > 0
      ? normalizedItems.map((item) => ({
          ...item,
          measurementType: String(item.measurementType || ''),
          element: String(item.element || ''),
          value: String(item.value || ''),
          unit: String(item.unit || ''),
          uncertaintyMode: item.uncertaintyMode || '',
          uncertaintyValue: String(item.uncertaintyValue || ''),
          coverageFactor: item.coverageFactor || '',
        }))
      : [createEmptyMeasurementItem()];
  const finalUncertaintyItems = buildUncertaintyItems(normalizedItems);

  return {
    measurementItems: editableItems,
    uncertaintyItems: finalUncertaintyItems,
    measureRange: buildMeasurementRangeSummary(normalizedItems),
    metrologicalParameterRange: buildMeasurementRangeDetail(normalizedItems),
    uncertainty: buildMeasurementUncertaintySummary(normalizedItems),
  };
};

const createDefaultFormData = (): FormData => {
  const measurementState = normalizeMeasurementState(deserializeMeasurementItems('', ''), []);

  return {
    entryMode: 'single',
    type: '',
    quantity: 1,
    splitRecord: false,
    incrementMode: 'sequential',
    name: '',
    model: '',
    serialNumber: '',
    managementNumber: '',
    manufacturer: '',
    measureRange: measurementState.measureRange,
    uncertainty: measurementState.uncertainty,
    uncertaintyItems: measurementState.uncertaintyItems,
    traceabilityMethod: '',
    purchaseDate: '',
    calibrationDate: '',
    calibrationCycle: '',
    nextCalibrationDate: '',
    certificateNumber: '',
    calibrationInstitution: '',
    department: '',
    location: '',
    status: InstrumentStatus.IN_USE,
    inOutStatus: InOutStatus.IN_STOCK,
    remarks: '',
    attachment: null,
    alertMode: 'none',
    alertLevel: '',
    metrologicalParameterRange: measurementState.metrologicalParameterRange,
    acceptanceDate: '',
    purchasePerson: '',
    enableDate: '',
    groupName: '',
    groupModel: '',
    groupMeasureRange: '',
    mergeGroupId: undefined,
    initialCapacity: undefined,
    currentCapacity: undefined,
    unit: undefined,
    measurementItems: measurementState.measurementItems,
    setEntries: [createEmptySetEntry()],
  };
};

export const useInstrumentForm = (
  onUpdateSuccess: () => void,
  onAddSuccess: () => void,
) => {
  const { message } = App.useApp();
  const [modalState, setModalState] = useState<ModalState>({
    visible: false,
    type: 'add',
  });
  const [formData, setFormData] = useState<FormData>(createDefaultFormData());
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeFormatDate = useCallback((dateString?: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, []);

  const calculateNextCalibrationDate = useCallback(
    (calibrationDate: string, calibrationCycle: string): string => {
      if (!calibrationDate || !calibrationCycle) return '';

      try {
        const date = new Date(calibrationDate);
        if (Number.isNaN(date.getTime())) return '';

        const match = calibrationCycle.match(/^(\d+)\s*([年月天日])$/);
        if (!match) return '';

        const number = parseInt(match[1], 10);
        const unit = match[2];
        const resultDate = new Date(date);

        switch (unit) {
          case '年':
            resultDate.setFullYear(resultDate.getFullYear() + number);
            break;
          case '月':
            resultDate.setMonth(resultDate.getMonth() + number);
            break;
          case '天':
          case '日':
            resultDate.setDate(resultDate.getDate() + number);
            break;
          default:
            return '';
        }

        resultDate.setDate(resultDate.getDate() - 1);
        return resultDate.toISOString().split('T')[0];
      } catch {
        return '';
      }
    },
    [],
  );

  const handleInputChange = useCallback(
    (fieldName: string, value: string | number | boolean | null | any[]) => {
      setFormData((prev) => {
        const next: FormData = {
          ...prev,
          [fieldName]: value,
        };

        if (fieldName === 'measurementItems') {
          const measurementState = normalizeMeasurementState(
            Array.isArray(value) ? (value as MeasurementRangeItem[]) : [],
            [],
            prev.uncertainty,
          );
          return {
            ...next,
            ...measurementState,
          };
        }

        if (fieldName === 'uncertaintyItems') {
          const measurementState = normalizeMeasurementState(
            prev.measurementItems || [],
            Array.isArray(value) ? (value as string[]) : [],
            prev.uncertainty,
          );
          return {
            ...next,
            ...measurementState,
          };
        }

        if (fieldName === 'entryMode') {
          const mode = String(value || 'single') as FormData['entryMode'];
          next.entryMode = mode;
          if (mode === 'single') {
            next.quantity = 1;
            next.splitRecord = false;
          }
          if (mode === 'set' && (!Array.isArray(prev.setEntries) || prev.setEntries.length === 0)) {
            next.setEntries = [createEmptySetEntry()];
          }
        }

        if (
          fieldName === 'measureRange' &&
          (!safeTrim(prev.metrologicalParameterRange) ||
            prev.metrologicalParameterRange === prev.measureRange)
        ) {
          next.metrologicalParameterRange = String(value || '');
        }

        if (
          (fieldName === 'calibrationDate' || fieldName === 'calibrationCycle') &&
          next.calibrationDate &&
          next.calibrationCycle
        ) {
          const calculatedDate = calculateNextCalibrationDate(
            next.calibrationDate as string,
            next.calibrationCycle as string,
          );

          if (calculatedDate) {
            next.nextCalibrationDate = calculatedDate;
          }
        }

        return next;
      });
    },
    [calculateNextCalibrationDate],
  );

  const handleFileChange = useCallback((file: File | null) => {
    setFormData((prev) => ({
      ...prev,
      attachment: file,
    }));
  }, []);

  const applySimilarInstrument = useCallback((instrument: Instrument) => {
    const measurementState = normalizeMeasurementState(
      deserializeMeasurementItems(instrument.metrologicalParameterRange, instrument.measureRange),
      [],
      instrument.uncertainty || '',
    );

    setFormData((prev) => ({
      ...createDefaultFormData(),
      ...measurementState,
      type: instrument.type || prev.type,
      name: instrument.name || '',
      model: '',
      manufacturer: instrument.manufacturer || '',
      traceabilityMethod: instrument.traceabilityMethod || '',
      calibrationCycle: instrument.calibrationCycle || '',
      calibrationInstitution: instrument.calibrationInstitution || '',
      department: instrument.department || '',
      location: instrument.location || prev.location,
      status: instrument.status || InstrumentStatus.IN_USE,
      inOutStatus: instrument.inOutStatus || InOutStatus.IN_STOCK,
      remarks: instrument.remarks || '',
      initialCapacity: instrument.initialCapacity,
      currentCapacity: instrument.initialCapacity ?? instrument.currentCapacity,
      unit: instrument.unit,
      groupName: instrument.groupName || '',
      groupModel: instrument.groupModel || '',
      groupMeasureRange: instrument.groupMeasureRange || '',
      mergeGroupId: instrument.mergeGroupId,
      alertLevel: instrument.alertLevel,
      alertMode: instrument.alertMode || 'none',
      setEntries: [createEmptySetEntry()],
    }));
  }, []);

  const resetFormData = useCallback(() => {
    setFormData(createDefaultFormData());
  }, []);

  const handleAddInstrument = useCallback(() => {
    setErrorReason(null);
    setErrorMessage(null);
    resetFormData();
    setModalState({ visible: true, type: 'add' });
  }, [resetFormData]);

  const handleEdit = useCallback(
    (instrument: Instrument) => {
      try {
        setErrorReason(null);
        setErrorMessage(null);

        const measurementState = normalizeMeasurementState(
          deserializeMeasurementItems(
            (instrument as any).metrologicalParameterRange,
            instrument.measureRange,
          ),
          [],
          instrument.uncertainty || '',
        );

        const completeFormData: FormData = {
          ...createDefaultFormData(),
          ...measurementState,
          entryMode: 'single',
          type: instrument.type || '',
          quantity: instrument.quantity || 1,
          name: instrument.name || '',
          model: instrument.model || '',
          serialNumber:
            instrument.serialNumber ||
            (instrument as any).factoryNumber ||
            (instrument as any).factory_num ||
            (instrument as any).factory_no ||
            (instrument as any).serial_num ||
            (instrument as any).serial_no ||
            '',
          managementNumber: instrument.managementNumber || '',
          manufacturer: instrument.manufacturer || '',
          traceabilityMethod: instrument.traceabilityMethod || '',
          purchaseDate: safeFormatDate(instrument.purchaseDate),
          enableDate: safeFormatDate(instrument.enableDate),
          calibrationDate: safeFormatDate(instrument.calibrationDate),
          nextCalibrationDate: safeFormatDate(instrument.nextCalibrationDate),
          calibrationCycle: instrument.calibrationCycle || '',
          certificateNumber: (instrument as any).certificateNumber || '',
          calibrationInstitution: instrument.calibrationInstitution || '',
          department: instrument.department || '',
          location: instrument.location || '',
          status: instrument.status || InstrumentStatus.IN_USE,
          inOutStatus: instrument.inOutStatus || InOutStatus.IN_STOCK,
          remarks: instrument.remarks || '',
          attachment: instrument.attachment || null,
          groupName: instrument.groupName || instrument.mergeGroupName || '',
          groupModel: instrument.groupModel || instrument.mergeGroupModel || '',
          groupMeasureRange: instrument.groupMeasureRange || '',
          mergeGroupId: instrument.mergeGroupId,
          initialCapacity: (instrument as any).initialCapacity,
          currentCapacity: (instrument as any).currentCapacity,
          unit: (instrument as any).unit,
          alertLevel: instrument.alertLevel,
          alertMode: instrument.alertMode || 'none',
          acceptanceDate: safeFormatDate((instrument as any).acceptanceDate),
          purchasePerson: (instrument as any).purchasePerson || '',
          batchDetails: instrument.batchDetails,
          splitRecord: false,
          setEntries: [createEmptySetEntry()],
        };

        setFormData(completeFormData);
        setModalState({
          visible: true,
          type: 'edit',
          selectedInstrument: instrument,
        });
      } catch {
        message.error('加载仪器数据失败，请重试');
      }
    },
    [message, safeFormatDate],
  );

  const handleCloseModal = useCallback(() => {
    setErrorReason(null);
    setErrorMessage(null);
    setModalState({ visible: false, type: 'add' });
    resetFormData();
  }, [resetFormData]);

  const handleSubmit = useCallback(
    async (
      onUpdate: (
        id: string,
        data: FormData,
      ) => Promise<{ success: boolean; message?: string; reason?: string; status?: number }>,
      onAdd: (data: FormData) => Promise<Instrument | null>,
    ) => {
      try {
        if (!safeTrim(formData.name)) {
          message.error('请输入仪器名称');
          return false;
        }

        if (!formData.type) {
          message.error('请选择仪器类型');
          return false;
        }

        if (formData.entryMode === 'set') {
          const validSetEntries = (formData.setEntries || []).filter((entry) =>
            [
              entry.model,
              entry.serialNumber,
              entry.managementNumber,
              entry.measureRange,
              entry.uncertainty,
              ...normalizeMeasurementItems(entry.measurementItems || []).map((item) =>
                [item.measurementType, item.element, item.value, item.unit].join(' '),
              ),
            ].some((entryValue) => safeTrim(entryValue)),
          );

          if (validSetEntries.length === 0) {
            message.error('请至少录入一条整套成员信息');
            return false;
          }

          const hasIncompleteEntry = validSetEntries.some(
            (entry) => {
              const measurementItems = normalizeMeasurementItems(entry.measurementItems || []);
              const resolvedRange =
                buildMeasurementRangeSummary(measurementItems) || safeTrim(entry.measureRange);
              const resolvedUncertainty =
                buildMeasurementUncertaintySummary(measurementItems) || safeTrim(entry.uncertainty);

              if (
                !safeTrim(entry.model) ||
                !safeTrim(entry.serialNumber) ||
                !safeTrim(entry.managementNumber) ||
                !resolvedRange ||
                !resolvedUncertainty
              ) {
                return true;
              }

              return measurementItems.some(
                (item) =>
                  !safeTrim(item.uncertaintyMode) ||
                  !safeTrim(item.uncertaintyValue) ||
                  !safeTrim(item.coverageFactor),
              );
            },
          );

          if (hasIncompleteEntry) {
            message.error('整套录入的每条成员都需要填写型号、出厂编号、管理编号、测量范围和不确定度');
            return false;
          }
        }

        const activeMeasurementItems = normalizeMeasurementItems(formData.measurementItems || []);

        if (activeMeasurementItems.length > 0) {
          const hasMissingUncertainty = activeMeasurementItems.some(
            (item) =>
              !safeTrim(item.uncertaintyMode) ||
              !safeTrim(item.uncertaintyValue) ||
              !safeTrim(item.coverageFactor),
          );

          if (hasMissingUncertainty) {
            message.error('请为每个测量项目补全不确定度类型、数值和覆盖因子');
            return false;
          }
        }

        if (formData.calibrationDate && Number.isNaN(new Date(formData.calibrationDate).getTime())) {
          message.error('校准日期格式不正确');
          return false;
        }

        if (
          formData.nextCalibrationDate &&
          Number.isNaN(new Date(formData.nextCalibrationDate).getTime())
        ) {
          message.error('复校日期格式不正确');
          return false;
        }

        if (modalState.selectedInstrument) {
          const result = await onUpdate(modalState.selectedInstrument.id, formData);
          if (result.success) {
            message.success('更新成功');
            onUpdateSuccess();
            handleCloseModal();
            setErrorReason(null);
            setErrorMessage(null);
          } else {
            setErrorReason(result.reason || null);
            setErrorMessage(result.message || null);
            message.error(result.message || '更新失败');
          }
          return result.success;
        }

        const newInstrument = await onAdd(formData);
        if (newInstrument) {
          message.success('新增成功');
          onAddSuccess();
          handleCloseModal();
          return true;
        }

        message.error('新增失败');
        return false;
      } catch (error) {
        message.error(error instanceof Error ? error.message : '操作失败，请重试');
        return false;
      }
    },
    [formData, handleCloseModal, message, modalState.selectedInstrument, onAddSuccess, onUpdateSuccess],
  );

  return {
    modalState,
    formData,
    errorReason,
    errorMessage,
    handleInputChange,
    handleFileChange,
    applySimilarInstrument,
    handleAddInstrument,
    handleEdit,
    handleCloseModal,
    handleSubmit,
    resetFormData,
  };
};
