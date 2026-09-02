import type { Instrument } from '../../types';

const BLOCKED_STATUSES = new Set(['停用', '已使用']);

export function getBlockedFlowActionMessage(instrument?: Instrument | null) {
  if (!instrument?.status || !BLOCKED_STATUSES.has(instrument.status)) {
    return null;
  }

  return `仪器状态为${instrument.status}，不得进行出入库操作`;
}

export function isMaterialInstrument(instrument?: Instrument | null) {
  if (!instrument) {
    return false;
  }

  return instrument.type === '标准物质' || instrument.name.includes('标准物质');
}

export function getInstrumentCapacityBase(
  instrument: Instrument | null,
  fetchedCapacity: { initial: number; current: number; unit: string } | null,
) {
  if (fetchedCapacity) {
    const { current, initial } = fetchedCapacity;
    return current > 0 ? current : initial > 0 ? initial : 0;
  }

  if (!instrument) {
    return 0;
  }

  const current = Number((instrument as any).currentCapacity || 0);
  const initial = Number(
    (instrument as any).initialCapacity || (instrument as any).totalCapacity || (instrument as any).capacity || 0,
  );
  return current > 0 ? current : initial > 0 ? initial : 0;
}

export function buildCapacityOptions(baseCapacity: number, unit: string) {
  const format = (value: number) => {
    const num = Number(value.toFixed(2));
    return `${num}${unit ? ` ${unit}` : ''}`;
  };

  return [
    { value: 0, text: '已用完' },
    { value: 20, text: `20%（${format(baseCapacity * 0.2)}）` },
    { value: 50, text: `50%（${format(baseCapacity * 0.5)}）` },
    { value: 80, text: `80%（${format(baseCapacity * 0.8)}）` },
    { value: 100, text: `未使用（${format(baseCapacity)}）` },
  ];
}
