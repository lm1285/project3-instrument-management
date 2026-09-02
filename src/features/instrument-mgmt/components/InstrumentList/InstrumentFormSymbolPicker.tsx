import React from 'react';
import { Button, Tabs, Tooltip } from 'antd';

interface InstrumentFormSymbolPickerProps {
  targetField: string;
  formData: Record<string, any>;
  onInputChange: (fieldName: string, value: any) => void;
}

const commonSymbols = ['±', 'μ', '℃', '°', '≤', '≥', 'Ω', '×', '·', '△', 'α', 'β'];
const uncertaintySymbols = [
  { label: '斜体 U', value: '𝑈', display: '𝑈' },
  { label: '斜体 k', value: '𝑘', display: '𝑘' },
  { label: '下标 rel', value: 'ᵣₑₗ', display: 'ᵣₑₗ' },
];
const superscripts = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

const InstrumentFormSymbolPicker: React.FC<InstrumentFormSymbolPickerProps> = ({
  targetField,
  formData,
  onInputChange,
}) => {
  const handleInsert = (symbol: string) => {
    const currentValue = formData[targetField] || '';
    onInputChange(targetField, currentValue + symbol);
  };

  return (
    <div style={{ width: 320 }}>
      <Tabs
        defaultActiveKey="common"
        size="small"
        items={[
          {
            key: 'common',
            label: '常用符号',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {commonSymbols.map((symbol) => (
                  <Button key={symbol} size="small" onClick={() => handleInsert(symbol)}>
                    {symbol}
                  </Button>
                ))}
              </div>
            ),
          },
          {
            key: 'uncertainty',
            label: '不确定度',
            children: (
              <div style={{ display: 'flex', gap: 8 }}>
                {uncertaintySymbols.map((symbol) => (
                  <Tooltip key={symbol.value} title={symbol.label}>
                    <Button size="small" onClick={() => handleInsert(symbol.value)}>
                      {symbol.display}
                    </Button>
                  </Tooltip>
                ))}
              </div>
            ),
          },
          {
            key: 'superscript',
            label: '上标数字',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {superscripts.map((symbol) => (
                  <Button key={symbol} size="small" onClick={() => handleInsert(symbol)}>
                    {symbol}
                  </Button>
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default InstrumentFormSymbolPicker;
