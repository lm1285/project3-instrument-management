import { InOutStatus, InstrumentStatus } from '../../../constants/instrument';
import { mapApiResponseToInstrument } from '../../../utils/instrumentMapping';

export function buildQueryString(params?: Record<string, string | undefined>) {
  if (!params) {
    return '';
  }

  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export function mapFlowInstrumentList(response: any) {
  const rows: any[] = Array.isArray(response)
    ? response
    : Array.isArray((response || {}).data)
      ? (response || {}).data
      : [];

  const allowedStatuses = new Set([
    InstrumentStatus.IN_USE,
    InstrumentStatus.OVERDUE,
    InstrumentStatus.USED,
    InstrumentStatus.STOPPED,
  ]);

  const mappedList = rows.map((inst) => {
    const processed = mapApiResponseToInstrument(inst);
    const finalStatus = allowedStatuses.has(processed.status as any)
      ? processed.status
      : processed.status
        ? InstrumentStatus.IN_USE
        : '';

    return {
      id: processed.id,
      name: processed.name,
      model: processed.model,
      serialNumber: processed.serialNumber,
      managementNumber: processed.managementNumber,
      type: processed.type as any,
      measureRange: processed.measureRange,
      inOutStatus:
        processed.inOutStatus === InOutStatus.OUT_FOR_USE ? InOutStatus.OUT_STOCK : processed.inOutStatus,
      status: finalStatus,
      notes: processed.notes || processed.remarks || '',
      checkoutTime: (inst as any).lastCheckoutTime || '',
      checkinOrUseTime: (inst as any).lastCheckinOrUseTime
        ? `${(inst as any).lastCheckinOrUseTime}${(inst as any).lastAction === '使用' ? '（使用）' : ''}`
        : '',
      operator: (inst as any).lastOperator || '',
    };
  });

  return {
    data: mappedList,
    total: Array.isArray(response)
      ? response.length
      : response && typeof response.total === 'number'
        ? response.total
        : mappedList.length,
  };
}

export function mapFlowRecordsResponse(response: any) {
  if (Array.isArray(response)) {
    return { data: response, total: response.length };
  }

  return response;
}
