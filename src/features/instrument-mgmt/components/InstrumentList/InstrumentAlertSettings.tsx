import React, { useMemo } from 'react';
import { AutoComplete, Input, Select } from 'antd';

const TIME_ALERT_OPTIONS = [
  { value: '7', label: '7天' },
  { value: '14', label: '14天' },
  { value: '21', label: '21天' },
  { value: '30', label: '30天' },
];

const UNIT_OPTIONS = [
  { value: 'mL', label: 'mL' },
  { value: 'MPa', label: 'MPa' },
  { value: 'g', label: 'g' },
];

interface InstrumentAlertSettingsProps {
  alertType1: string;
  alertType2: string;
  formData: Record<string, any>;
  onAlertTypeChange: (row: 1 | 2, type: string) => void;
  onInputChange: (fieldName: string, value: any) => void;
}

type CapacityPayload = {
  value?: string;
  unit?: string;
};

const parseAlertLevel = (alertLevel?: string) => {
  if (!alertLevel) return {};
  if (!alertLevel.startsWith('{')) return { time: alertLevel };

  try {
    return JSON.parse(alertLevel);
  } catch {
    return {};
  }
};

const normalizeCapacity = (capacity: unknown): CapacityPayload => {
  if (!capacity) return {};
  if (typeof capacity === 'string') return { value: capacity };

  if (typeof capacity === 'object') {
    const source = capacity as Record<string, unknown>;
    return {
      value: typeof source.value === 'string' ? source.value : '',
      unit: typeof source.unit === 'string' ? source.unit : '',
    };
  }

  return {};
};

const normalizeDisplayTypes = (alertType1: string, alertType2: string) => {
  if (alertType1 === 'capacity' && alertType2 === 'none') {
    return {
      displayType1: 'none',
      displayType2: 'capacity',
    };
  }

  return {
    displayType1: alertType1 === 'time' ? 'time' : 'none',
    displayType2: alertType2 === 'capacity' ? 'capacity' : 'none',
  };
};

const InstrumentAlertSettings: React.FC<InstrumentAlertSettingsProps> = ({
  alertType1,
  alertType2,
  formData,
  onAlertTypeChange,
  onInputChange,
}) => {
  const parsedAlertLevel = useMemo(() => parseAlertLevel(formData.alertLevel), [formData.alertLevel]);
  const timeValue = typeof parsedAlertLevel.time === 'string' ? parsedAlertLevel.time : '';
  const capacityValue = normalizeCapacity(parsedAlertLevel.capacity);
  const { displayType1, displayType2 } = normalizeDisplayTypes(alertType1, alertType2);

  const updateTimeAlert = (nextValue: string) => {
    const nextAlertLevel = parseAlertLevel(formData.alertLevel);
    nextAlertLevel.time = nextValue;
    onInputChange('alertLevel', JSON.stringify(nextAlertLevel));
    onInputChange('alertMode', 'mixed');
  };

  const updateCapacityAlert = (nextValue: string, nextUnit?: string) => {
    const nextAlertLevel = parseAlertLevel(formData.alertLevel);
    nextAlertLevel.capacity = {
      value: nextValue,
      unit: nextUnit ?? capacityValue.unit ?? '',
    };
    onInputChange('alertLevel', JSON.stringify(nextAlertLevel));
    onInputChange('alertMode', 'mixed');
  };

  return (
    <div className="instrument-alert-settings instrument-alert-settings--singleline">
      <Select
        value={displayType1}
        onChange={(value) => onAlertTypeChange(1, value)}
        className="instrument-alert-settings__select"
        options={[
          { label: '无', value: 'none' },
          { label: '时间', value: 'time' },
        ]}
      />

      <AutoComplete
        className="instrument-alert-settings__control instrument-alert-settings__slot"
        popupMatchSelectWidth={false}
        options={TIME_ALERT_OPTIONS}
        value={displayType1 === 'time' ? timeValue : ''}
        onChange={updateTimeAlert}
        disabled={displayType1 !== 'time'}
      >
        <Input placeholder="" suffix={displayType1 === 'time' ? '天' : undefined} />
      </AutoComplete>

      <Select
        value={displayType2}
        onChange={(value) => onAlertTypeChange(2, value)}
        className="instrument-alert-settings__select"
        options={[
          { label: '无', value: 'none' },
          { label: '容量', value: 'capacity' },
        ]}
      />

      <Input
        className="instrument-alert-settings__control instrument-alert-settings__slot"
        placeholder=""
        value={displayType2 === 'capacity' ? capacityValue.value : ''}
        onChange={(event) => updateCapacityAlert(event.target.value, capacityValue.unit)}
        disabled={displayType2 !== 'capacity'}
      />

      <AutoComplete
        className="instrument-alert-settings__control instrument-alert-settings__control--unit"
        popupMatchSelectWidth={false}
        options={UNIT_OPTIONS}
        value={displayType2 === 'capacity' ? capacityValue.unit : ''}
        onChange={(value) => updateCapacityAlert(capacityValue.value || '', value)}
        disabled={displayType2 !== 'capacity'}
      >
        <Input placeholder="" />
      </AutoComplete>
    </div>
  );
};

export default InstrumentAlertSettings;
