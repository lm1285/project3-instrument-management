import dayjs from 'dayjs';

export function safeParseDate(dateString?: string) {
  if (!dateString) {
    return undefined;
  }

  try {
    const parsedDate = dayjs(dateString);
    return parsedDate.isValid() ? parsedDate : undefined;
  } catch (error) {
    console.error('Invalid date string:', error);
    return undefined;
  }
}

export function getAlertConfig(reason?: string | null, message?: string | null) {
  const currentReason = reason || '';
  let type: 'error' | 'warning' | 'info' = 'error';
  let title = '';

  if (currentReason === 'UNAUTHORIZED' || currentReason === 'NO_USER') {
    type = 'error';
    title = '未登录';
  } else if (currentReason === 'FORBIDDEN' || currentReason === 'NO_PERMISSION') {
    type = 'warning';
    title = '无权限';
  } else if (currentReason === 'DUPLICATE_MANAGEMENT_NUMBER') {
    type = 'warning';
    title = '编号重复';
  } else if (currentReason === 'NOT_FOUND') {
    type = 'warning';
    title = '未找到仪器';
  } else if (currentReason) {
    type = 'error';
    title = '保存失败';
  }

  return { type, title, desc: message || '' };
}

export function buildPreparedInstrumentFormData(formData: Record<string, any>) {
  const preparedData = { ...formData };

  preparedData.calibrationDate = safeParseDate(formData.calibrationDate);
  preparedData.nextCalibrationDate = safeParseDate(formData.nextCalibrationDate);
  preparedData.enableDate = safeParseDate(formData.enableDate);
  preparedData.purchaseDate = safeParseDate(formData.purchaseDate);
  preparedData.acceptanceDate = safeParseDate(formData.acceptanceDate);

  if (preparedData.alertLevel && preparedData.alertLevel.startsWith('{')) {
    try {
      const parsed = JSON.parse(preparedData.alertLevel);
      preparedData.timeAlert = parsed.time;

      if (typeof parsed.capacity === 'string') {
        preparedData.capacityAlert = parsed.capacity;
        preparedData.capacityAlertUnit = '';
      } else if (parsed.capacity && typeof parsed.capacity === 'object') {
        preparedData.capacityAlert = parsed.capacity.value || '';
        preparedData.capacityAlertUnit = parsed.capacity.unit || '';
      }
    } catch (error) {
      console.error('Failed to parse alertLevel JSON', error);
    }
  }

  if (!preparedData.groupName) preparedData.groupName = '';
  if (!preparedData.groupModel) preparedData.groupModel = '';
  if (!preparedData.groupMeasureRange) preparedData.groupMeasureRange = '';

  return preparedData;
}

export function resolveInitialAlertTypes(alertLevel?: string) {
  let alertType1 = 'time';
  let alertType2 = 'none';
  let legacyTimeAlert: string | undefined;

  if (alertLevel) {
    if (alertLevel.startsWith('{')) {
      try {
        const parsed = JSON.parse(alertLevel);
        const hasTime = !!parsed.time;
        const hasCapacity = !!(
          typeof parsed.capacity === 'string'
            ? parsed.capacity
            : parsed.capacity?.value || parsed.capacity?.unit
        );

        if (hasTime && !hasCapacity) {
          alertType1 = 'time';
          alertType2 = 'none';
        } else if (!hasTime && hasCapacity) {
          alertType1 = 'capacity';
          alertType2 = 'none';
        } else if (hasTime && hasCapacity) {
          alertType1 = 'time';
          alertType2 = 'capacity';
        } else {
          alertType1 = 'none';
          alertType2 = 'none';
        }
      } catch (error) {
        console.error('Failed to parse alertLevel JSON', error);
      }
    } else {
      alertType1 = 'time';
      alertType2 = 'none';
      legacyTimeAlert = alertLevel;
    }
  } else {
    alertType1 = 'none';
    alertType2 = 'none';
  }

  return { alertType1, alertType2, legacyTimeAlert };
}

export function createBatchDetails(formData: Record<string, any>) {
  const count = formData.quantity || 1;
  const baseManagementNumber = formData.managementNumber || '';
  const incrementMode = formData.incrementMode || 'sequential';

  return Array.from({ length: count }, (_, index) => {
    let managementNumber = '';

    if (baseManagementNumber) {
      if (incrementMode === 'suffix') {
        managementNumber = `${baseManagementNumber}-${index + 1}`;
      } else {
        const match = baseManagementNumber.match(/(\d+)$/);
        if (match) {
          const prefix = baseManagementNumber.substring(0, match.index);
          const numericString = match[0];
          const nextNumber = parseInt(numericString, 10) + index;
          managementNumber = prefix + String(nextNumber).padStart(numericString.length, '0');
        } else {
          managementNumber = `${baseManagementNumber}-${String(index + 1).padStart(3, '0')}`;
        }
      }
    }

    return {
      index: index + 1,
      managementNumber,
      serialNumber: formData.serialNumber,
      certificateNumber: formData.certificateNumber,
    };
  });
}
