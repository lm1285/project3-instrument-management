import { InstrumentType } from '../../../../constants/instrument';

export const INSTRUMENT_LIST_TABS = [
  { key: 'all', label: '\u5168\u90e8' },
  { key: 'standard', label: '\u6807\u51c6\u5668' },
  { key: 'material', label: '\u6807\u51c6\u7269\u8d28' },
  { key: 'auxiliary', label: '\u8f85\u52a9\u8bbe\u5907' },
] as const;

export const INSTRUMENT_VIEW_TYPE_TO_DOMAIN_TYPE: Record<string, string | undefined> = {
  all: undefined,
  standard: InstrumentType.STANDARD_DEVICE,
  material: InstrumentType.STANDARD_MATERIAL,
  auxiliary: InstrumentType.AUXILIARY_DEVICE,
};

export const INSTRUMENT_VIEW_TYPE_TO_TABLE_VIEW: Record<string, 'std' | 'mat' | 'aux' | undefined> = {
  all: undefined,
  standard: 'std',
  material: 'mat',
  auxiliary: 'aux',
};
