import { App, Form } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { InOutStatus, InstrumentStatus } from '../../../constants/instrument';
import type { InstrumentFormData, ModalState } from '../types';
import { mergeGroupService, type MergeGroup, type MergeSuggestion } from '../services/mergeGroupService';
import {
  buildPreparedInstrumentFormData,
  createBatchDetails,
  resolveInitialAlertTypes,
} from '../components/InstrumentList/instrumentFormModalUtils';

interface UseInstrumentFormModalParams {
  modalState: ModalState;
  formData: InstrumentFormData;
  onClose: () => void;
  onSubmit: () => void;
  onInputChange: (fieldName: string, value: any) => void;
  onFileChange: (file: File | null) => void;
}

interface BatchDetailItem {
  index: number;
  managementNumber: string;
  serialNumber?: string;
  certificateNumber?: string;
}

function hasManualBatchOverrides(
  currentBatchDetails: BatchDetailItem[],
  generatedBatchDetails: BatchDetailItem[],
) {
  if (currentBatchDetails.length === 0) {
    return false;
  }

  return currentBatchDetails.some((item, index) => {
    const generated = generatedBatchDetails[index];
    if (!generated) {
      return true;
    }

    return (
      (item.managementNumber || '') !== (generated.managementNumber || '') ||
      (item.serialNumber || '') !== (generated.serialNumber || '') ||
      (item.certificateNumber || '') !== (generated.certificateNumber || '')
    );
  });
}

function safeTrim(value: unknown) {
  return String(value || '').trim();
}

function candidateMatchesForm(
  candidate: { name?: string; model?: string; measurementRange?: string },
  formData: InstrumentFormData,
) {
  const formName = safeTrim(formData.name);
  if (!formName) {
    return false;
  }

  const candidateName = safeTrim(candidate.name);
  if (candidateName !== formName) {
    return false;
  }

  const formRange = safeTrim(formData.measureRange);
  if (formRange && safeTrim(candidate.measurementRange) !== formRange) {
    return false;
  }

  return true;
}

function findMatchedSuggestion(suggestions: MergeSuggestion | null, formData: InstrumentFormData) {
  if (!suggestions) {
    return null;
  }

  for (const item of suggestions.addToExisting || []) {
    if (item.candidates.some((candidate) => candidateMatchesForm(candidate, formData))) {
      return {
        name: item.targetGroup.name || '',
        model: item.targetGroup.model || '',
        range: item.targetGroup.measurementRange || '',
        mergeGroupId: item.targetGroup.id ? String(item.targetGroup.id) : null,
      };
    }
  }

  for (const item of suggestions.createNew || []) {
    if (item.candidates.some((candidate) => candidateMatchesForm(candidate, formData))) {
      return {
        name: item.suggestedName || '',
        model: item.suggestedModel || '',
        range: item.suggestedRange || '',
        mergeGroupId: null,
      };
    }
  }

  return null;
}

const STATUS_USED = InstrumentStatus.USED;
const STATUS_DISABLED = InstrumentStatus.STOPPED;
const STORAGE_CONSUMED = InOutStatus.OUT_STOCK;

export function useInstrumentFormModal({
  modalState,
  formData,
  onClose,
  onSubmit,
  onInputChange,
  onFileChange,
}: UseInstrumentFormModalParams) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [alertType1, setAlertType1] = useState('time');
  const [alertType2, setAlertType2] = useState('capacity');
  const [disableReasonVisible, setDisableReasonVisible] = useState(false);
  const [tempDisableReason, setTempDisableReason] = useState('');
  const [batchDetails, setBatchDetails] = useState<BatchDetailItem[]>([]);
  const [isBatchManual, setIsBatchManual] = useState(false);
  const [showBatchDetailTable, setShowBatchDetailTable] = useState(false);
  const [hasManualGroupEdit, setHasManualGroupEdit] = useState(false);

  const isEditMode = !!modalState.selectedInstrument;

  useEffect(() => {
    if (modalState.visible) {
      setHasManualGroupEdit(false);
    }
  }, [modalState.visible]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await mergeGroupService.getGroups();
        if (res.success && res.data) {
          setMergeGroups(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch merge groups', error);
      }
    };

    if (modalState.visible) {
      fetchGroups();
    }
  }, [modalState.visible]);

  const filteredMergeGroups = useMemo(() => {
    if (!formData.type) {
      return mergeGroups;
    }

    return mergeGroups.filter((group) => !group.type || group.type === formData.type);
  }, [formData.type, mergeGroups]);

  const uniqueNames = useMemo(() => {
    const names = filteredMergeGroups.map((group) => group.name).filter(Boolean) as string[];
    return Array.from(new Set(names));
  }, [filteredMergeGroups]);

  const uniqueModels = useMemo(() => {
    if (!formData.groupName) {
      return [];
    }

    const models = filteredMergeGroups
      .filter((group) => group.name === formData.groupName)
      .map((group) => group.model || '');

    return Array.from(new Set(models));
  }, [filteredMergeGroups, formData.groupName]);

  const uniqueRanges = useMemo(() => {
    if (!formData.groupName || formData.groupModel === undefined) {
      return [];
    }

    const currentModel = formData.groupModel || '';
    const ranges = filteredMergeGroups
      .filter(
        (group) =>
          group.name === formData.groupName && (group.model || '') === currentModel,
      )
      .map((group) => group.measurementRange || '');

    return Array.from(new Set(ranges));
  }, [filteredMergeGroups, formData.groupModel, formData.groupName]);

  useEffect(() => {
    const autoPrefillMergeGroup = async () => {
      if (!modalState.visible || isEditMode || hasManualGroupEdit || !formData.type) {
        return;
      }

      const currentName = safeTrim(formData.name);
      const currentModel = safeTrim(formData.model);
      const currentRange = safeTrim(formData.measureRange);

      if (!currentName) {
        if (formData.groupName || formData.groupModel || formData.groupMeasureRange || formData.mergeGroupId) {
          onInputChange('groupName', '');
          onInputChange('groupModel', '');
          onInputChange('groupMeasureRange', '');
          onInputChange('mergeGroupId', null);
        }
        return;
      }

      try {
        const response = await mergeGroupService.getSuggestions(formData.type);
        const matched = findMatchedSuggestion(response.success ? response.data || null : null, formData);

        if (matched) {
          if (safeTrim(formData.groupName) !== matched.name) {
            onInputChange('groupName', matched.name);
          }
          if (safeTrim(formData.groupModel) !== matched.model) {
            onInputChange('groupModel', matched.model);
          }
          if (safeTrim(formData.groupMeasureRange) !== matched.range) {
            onInputChange('groupMeasureRange', matched.range);
          }
          if ((formData.mergeGroupId || null) !== matched.mergeGroupId) {
            onInputChange('mergeGroupId', matched.mergeGroupId);
          }
          return;
        }

        if ((currentName || currentModel || currentRange) && (
          formData.groupName || formData.groupModel || formData.groupMeasureRange || formData.mergeGroupId
        )) {
          onInputChange('groupName', '');
          onInputChange('groupModel', '');
          onInputChange('groupMeasureRange', '');
          onInputChange('mergeGroupId', null);
        }
      } catch (error) {
        console.error('Failed to auto match merge group suggestion', error);
      }
    };

    autoPrefillMergeGroup();
  }, [
    formData.groupMeasureRange,
    formData.groupModel,
    formData.groupName,
    formData.measureRange,
    formData.mergeGroupId,
    formData.model,
    formData.name,
    formData.type,
    hasManualGroupEdit,
    isEditMode,
    modalState.visible,
    onInputChange,
  ]);

  useEffect(() => {
    if (!modalState.visible || !formData.mergeGroupId || mergeGroups.length === 0) {
      return;
    }

    const group = mergeGroups.find((item) => item.id === formData.mergeGroupId);
    if (!group) {
      return;
    }

    if (formData.groupName !== group.name) {
      onInputChange('groupName', group.name);
    }

    const groupModel = group.model || '';
    if ((formData.groupModel || '') !== groupModel) {
      onInputChange('groupModel', groupModel);
    }

    const groupRange = group.measurementRange || '';
    if ((formData.groupMeasureRange || '') !== groupRange) {
      onInputChange('groupMeasureRange', groupRange);
    }
  }, [
    formData.groupMeasureRange,
    formData.groupModel,
    formData.groupName,
    formData.mergeGroupId,
    mergeGroups,
    modalState.visible,
    onInputChange,
  ]);

  useEffect(() => {
    if (!modalState.visible) {
      return;
    }

    setShowBatchDetailTable(false);

    const preparedData = buildPreparedInstrumentFormData(formData);
    const {
      alertType1: initialAlertType1,
      alertType2: initialAlertType2,
      legacyTimeAlert,
    } = resolveInitialAlertTypes(preparedData.alertLevel);

    if (legacyTimeAlert) {
      preparedData.timeAlert = legacyTimeAlert;
    }

    if (initialAlertType1 === 'capacity' && initialAlertType2 === 'none') {
      setAlertType1('none');
      setAlertType2('capacity');
    } else {
      setAlertType1(initialAlertType1);
      setAlertType2(initialAlertType2);
    }
    form.setFieldsValue(preparedData);

    if (formData.attachment) {
      const attachmentName =
        typeof formData.attachment === 'string'
          ? formData.attachment
          : formData.attachment.name;
      setFileList([{ uid: '1', name: attachmentName, status: 'done' }]);
    } else {
      setFileList([]);
    }

    const generatedBatchDetails = createBatchDetails(formData);
    const existingBatchDetails = Array.isArray(formData.batchDetails)
      ? formData.batchDetails
          .filter(Boolean)
          .map((item, index) => ({
            index: index + 1,
            managementNumber: item.managementNumber || '',
            serialNumber: item.serialNumber,
            certificateNumber: item.certificateNumber,
          }))
      : [];

    if (existingBatchDetails.length > 0) {
      setBatchDetails(existingBatchDetails);
      setIsBatchManual(hasManualBatchOverrides(existingBatchDetails, generatedBatchDetails));
    } else if ((formData.quantity || 0) > 1) {
      setBatchDetails(generatedBatchDetails);
      setIsBatchManual(false);
    } else {
      setBatchDetails([]);
      setIsBatchManual(false);
    }
  }, [form, formData, modalState.visible]);

  useEffect(() => {
    if (formData.entryMode !== 'batch') {
      return;
    }

    if ((formData.quantity || 0) > 1 && !isBatchManual) {
      const generatedBatchDetails = createBatchDetails(formData);
      setBatchDetails(generatedBatchDetails);
      onInputChange('batchDetails', generatedBatchDetails);
    }
  }, [
    formData.entryMode,
    formData.certificateNumber,
    formData.incrementMode,
    formData.managementNumber,
    formData.quantity,
    formData.serialNumber,
    isBatchManual,
    onInputChange,
  ]);

  useEffect(() => {
    if (formData.entryMode === 'batch' && (formData.quantity || 0) > 1 && !formData.splitRecord) {
      onInputChange('splitRecord', true);
    }

    if (formData.entryMode !== 'batch' || (formData.quantity || 0) <= 1) {
      setShowBatchDetailTable(false);
    }
  }, [formData.entryMode, formData.quantity, formData.splitRecord, onInputChange]);

  const handleStatusChange = (value: string) => {
    onInputChange('status', value);

    if (value === STATUS_USED) {
      onInputChange('inOutStatus', STORAGE_CONSUMED);
    }

    if (value === STATUS_DISABLED) {
      setTempDisableReason('');
      setDisableReasonVisible(true);
      return;
    }

    onInputChange('disableReason', null);
    onInputChange('disabler', null);
    onInputChange('disableTime', null);
  };

  const handleDisableReasonSubmit = () => {
    onInputChange('disableReason', tempDisableReason);
    const storedUser = localStorage.getItem('user');
    const user = storedUser ? JSON.parse(storedUser) : { name: 'admin' };

    onInputChange('disabler', user.name || 'admin');
    onInputChange('disableTime', dayjs().format('YYYY-MM-DD HH:mm:ss'));
    setDisableReasonVisible(false);
  };

  const handleGroupNameChange = (value: string) => {
    setHasManualGroupEdit(true);
    onInputChange('groupName', value || '');
    onInputChange('groupModel', null);
    onInputChange('groupMeasureRange', null);
    onInputChange('mergeGroupId', null);
  };

  const handleGroupModelChange = (value: string) => {
    setHasManualGroupEdit(true);
    onInputChange('groupModel', value || '');
    onInputChange('groupMeasureRange', null);
    onInputChange('mergeGroupId', null);

    const matches = filteredMergeGroups.filter(
      (group) => group.name === formData.groupName && (group.model || '') === (value || ''),
    );

    if (matches.length === 1 && !matches[0].measurementRange) {
      onInputChange('mergeGroupId', matches[0].id);
    }
  };

  const handleGroupRangeChange = (value: string) => {
    setHasManualGroupEdit(true);
    onInputChange('groupMeasureRange', value || '');

    const currentModel = formData.groupModel || '';
    const match = filteredMergeGroups.find(
      (group) =>
        group.name === formData.groupName &&
        (group.model || '') === currentModel &&
        (group.measurementRange || '') === (value || ''),
    );

    onInputChange('mergeGroupId', match?.id ?? null);
  };

  const handleBatchItemChange = (index: number, field: string, value: string) => {
    if (!isBatchManual) {
      setIsBatchManual(true);
    }

    const nextBatchDetails = [...batchDetails];
    if (!nextBatchDetails[index]) {
      return;
    }

    nextBatchDetails[index] = { ...nextBatchDetails[index], [field]: value };
    setBatchDetails(nextBatchDetails);
    onInputChange('batchDetails', nextBatchDetails);
  };

  const handleFileUpload: UploadProps['onChange'] = ({ fileList: nextFileList }) => {
    setFileList(nextFileList);

    const latestFile = nextFileList[nextFileList.length - 1];
    if (latestFile?.originFileObj) {
      onFileChange(latestFile.originFileObj);
      return;
    }

    onFileChange(null);
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    beforeUpload: () => false,
    onChange: handleFileUpload,
    maxCount: 1,
    fileList,
  };

  const handleAlertTypeChange = (row: 1 | 2, newType: string) => {
    const oldType = row === 1 ? alertType1 : alertType2;
    const otherType = row === 1 ? alertType2 : alertType1;

    if (row === 1) {
      setAlertType1(newType);
    } else {
      setAlertType2(newType);
    }

    if (newType === 'none' && oldType !== 'none' && otherType !== oldType) {
      try {
        const currentJson = JSON.parse(form.getFieldValue('alertLevel') || '{}');
        delete currentJson[oldType];
        onInputChange('alertLevel', JSON.stringify(currentJson));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleFormSubmit = () => {
    form
      .validateFields()
      .then(() => {
        onSubmit();
      })
      .catch((info) => {
        message.error('表单校验未通过，请检查必填项');
        console.error('表单校验失败:', info);
      });
  };

  const handleModalClose = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const handleDateChange = (fieldName: string, date: dayjs.Dayjs | null) => {
    onInputChange(fieldName, date ? date.format('YYYY-MM-DD') : '');
  };

  return {
    form,
    isEditMode,
    uploadProps,
    uniqueNames,
    uniqueModels,
    uniqueRanges,
    alertType1,
    alertType2,
    batchDetails,
    showBatchDetailTable,
    disableReasonVisible,
    tempDisableReason,
    setTempDisableReason,
    setDisableReasonVisible,
    setShowBatchDetailTable,
    handleAlertTypeChange,
    handleBatchItemChange,
    handleDateChange,
    handleDisableReasonSubmit,
    handleFormSubmit,
    handleGroupModelChange,
    handleGroupNameChange,
    handleGroupRangeChange,
    handleModalClose,
    handleStatusChange,
  };
}
