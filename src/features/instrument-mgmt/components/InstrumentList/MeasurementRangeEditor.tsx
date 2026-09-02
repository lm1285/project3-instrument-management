import React, { useMemo, useState } from 'react';
import { AutoComplete, Button, Input } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { MeasurementRangeItem } from '../../types';
import { createEmptyMeasurementItem } from './measurementRangeUtils';

interface MeasurementRangeEditorProps {
  value?: MeasurementRangeItem[];
  onChange: (items: MeasurementRangeItem[]) => void;
  unitOptions?: string[];
  uncertaintyModeOptions?: string[];
  coverageFactorOptions?: string[];
}

type EditorGroup = {
  typeKey: string;
  typeName: string;
  rows: Array<{ item: MeasurementRangeItem; itemIndex: number }>;
};

type AutoCompleteOption = {
  value: string;
  label: React.ReactNode;
};

const cloneItem = (item: MeasurementRangeItem): MeasurementRangeItem => ({
  ...item,
  measurementType: String(item.measurementType || ''),
  element: String(item.element || ''),
  value: String(item.value || ''),
  unit: String(item.unit || ''),
  uncertaintyMode: item.uncertaintyMode || '',
  uncertaintyValue: String(item.uncertaintyValue || ''),
  coverageFactor: item.coverageFactor || '',
});

const isMeasurementItemEmpty = (item?: MeasurementRangeItem) =>
  !String(item?.measurementType || '').trim() &&
  !String(item?.element || '').trim() &&
  !String(item?.value || '').trim() &&
  !String(item?.unit || '').trim() &&
  !String(item?.uncertaintyMode || '').trim() &&
  !String(item?.uncertaintyValue || '').trim() &&
  !String(item?.coverageFactor || '').trim();

const buildEditorGroups = (items: MeasurementRangeItem[]): EditorGroup[] => {
  if (items.length === 0) {
    return [
      {
        typeKey: 'empty-group',
        typeName: '',
        rows: [{ item: createEmptyMeasurementItem(), itemIndex: 0 }],
      },
    ];
  }

  const groups: EditorGroup[] = [];
  let currentType = '';

  items.forEach((item, itemIndex) => {
    const rawType = String(item.measurementType || '').trim();
    const nextType = rawType || currentType;
    currentType = nextType;

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.typeName === nextType) {
      lastGroup.rows.push({ item, itemIndex });
      return;
    }

    groups.push({
      typeKey: `${nextType || 'empty'}-${item.id}`,
      typeName: nextType,
      rows: [{ item, itemIndex }],
    });
  });

  return groups.length > 0
    ? groups
    : [
        {
          typeKey: 'empty-group',
          typeName: '',
          rows: [{ item: createEmptyMeasurementItem(), itemIndex: 0 }],
        },
      ];
};

const buildAutoCompleteOptions = (
  values: string[],
  renderLabel?: (value: string) => React.ReactNode,
): AutoCompleteOption[] =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))).map(
    (value) => ({
      value,
      label: renderLabel ? renderLabel(value) : value,
    }),
  );

const renderUncertaintyModeLabel = (value: string) => {
  if (value === 'Urel') {
    return (
      <span>
        <em>U</em>
        <sub>rel</sub>
      </span>
    );
  }

  if (value === 'U') {
    return <em>U</em>;
  }

  if (value === 'MPE') {
    return 'MPE';
  }

  return value;
};

const renderCoverageFactorLabel = (value: string) => (
  <span>
    {String(value || '').startsWith('k=') ? value : <><em>k</em>={value}</>}
  </span>
);

const getFilteredAutoCompleteOptions = (
  currentValue: string,
  options: AutoCompleteOption[],
  allowEmpty: boolean,
) => {
  const keyword = String(currentValue || '').trim().toLowerCase();

  if (keyword.length < 1) {
    return allowEmpty ? options : [];
  }

  return options.filter((option) => option.value.toLowerCase().includes(keyword));
};

const MeasurementRangeEditor: React.FC<MeasurementRangeEditorProps> = ({
  value = [],
  onChange,
  unitOptions = [],
  uncertaintyModeOptions = [],
  coverageFactorOptions = [],
}) => {
  const items = value.length > 0 ? value.map(cloneItem) : [createEmptyMeasurementItem()];
  const groups = useMemo(() => buildEditorGroups(items), [items]);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);

  const unitAutoCompleteOptions = useMemo(
    () => buildAutoCompleteOptions(unitOptions),
    [unitOptions],
  );
  const uncertaintyModeAutoCompleteOptions = useMemo(
    () =>
      buildAutoCompleteOptions(
        ['U', 'Urel', 'MPE', ...uncertaintyModeOptions],
        renderUncertaintyModeLabel,
      ),
    [uncertaintyModeOptions],
  );
  const coverageFactorAutoCompleteOptions = useMemo(
    () =>
      buildAutoCompleteOptions(
        ['k=2', 'k=3', ...coverageFactorOptions],
        renderCoverageFactorLabel,
      ),
    [coverageFactorOptions],
  );

  const updateItems = (nextItems: MeasurementRangeItem[]) => {
    onChange(nextItems.length > 0 ? nextItems : [createEmptyMeasurementItem()]);
  };

  const handleItemChange = (
    index: number,
    field: keyof Pick<
      MeasurementRangeItem,
      | 'measurementType'
      | 'element'
      | 'value'
      | 'unit'
      | 'uncertaintyMode'
      | 'uncertaintyValue'
      | 'coverageFactor'
    >,
    nextValue: string,
  ) => {
    updateItems(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: nextValue } : item,
      ),
    );
  };

  const handleTypeNameChange = (group: EditorGroup, nextType: string) => {
    const targetIndexes = new Set(group.rows.map((row) => row.itemIndex));
    updateItems(
      items.map((item, index) =>
        targetIndexes.has(index) ? { ...item, measurementType: nextType } : item,
      ),
    );
  };

  const handleAddType = () => {
    updateItems([...items, createEmptyMeasurementItem()]);
  };

  const handleAddItemToType = (group: EditorGroup) => {
    const insertIndex = group.rows[group.rows.length - 1]?.itemIndex ?? items.length - 1;
    const nextItems = [...items];
    nextItems.splice(insertIndex + 1, 0, createEmptyMeasurementItem(group.typeName));
    updateItems(nextItems);
  };

  const handleDeleteItem = (itemIndex: number) => {
    const nextItems = items.filter((_, index) => index !== itemIndex);
    updateItems(nextItems.length > 0 ? nextItems : [createEmptyMeasurementItem()]);
  };

  const handleClearAllMeasurementItems = () => {
    updateItems([createEmptyMeasurementItem()]);
  };

  const allRowsEmpty = items.every((item) => isMeasurementItemEmpty(item));

  const buildAutoCompleteProps = (
    fieldKey: string,
    currentValue: string,
    options: AutoCompleteOption[],
    allowEmpty: boolean,
  ) => {
    const filteredOptions = getFilteredAutoCompleteOptions(currentValue, options, allowEmpty);

    return {
      options: filteredOptions,
      open: focusedFieldKey === fieldKey && filteredOptions.length > 0,
      popupMatchSelectWidth: true,
      popupClassName: 'measurement-range-editor__dropdown',
      onFocus: () => setFocusedFieldKey(fieldKey),
      onBlur: () => {
        window.setTimeout(() => {
          setFocusedFieldKey((currentKey) => (currentKey === fieldKey ? null : currentKey));
        }, 120);
      },
      onSelect: () => setFocusedFieldKey(null),
    };
  };

  return (
    <div className="measurement-range-editor">
      <div className="measurement-range-editor__head">
        <div />
        <div className="measurement-range-editor__toolbar">
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddType}>
            新增类型
          </Button>
          <Button onClick={handleClearAllMeasurementItems} disabled={allRowsEmpty}>
            清空
          </Button>
        </div>
      </div>

      <div className="measurement-range-editor__list measurement-range-editor__list--grouped">
        {groups.map((group) => (
          <section key={group.typeKey} className="measurement-range-editor__group">
            <div className="measurement-range-editor__group-head">
              <div className="measurement-range-editor__group-type">
                <span className="measurement-range-editor__group-kicker">当前类型</span>
                <Input
                  value={group.typeName}
                  placeholder="如：浓度、容量、质量浓度"
                  onChange={(event) => handleTypeNameChange(group, event.target.value)}
                />
              </div>
              <Button type="text" icon={<PlusOutlined />} onClick={() => handleAddItemToType(group)}>
                新增本类型项目
              </Button>
            </div>

            <div className="measurement-range-editor__columns" aria-hidden="true">
              <span>元素/项目</span>
              <span>标准值</span>
              <span>单位</span>
              <span>不确定度/误差</span>
              <span>操作</span>
            </div>

            <div className="measurement-range-editor__group-body">
              {group.rows.map(({ item, itemIndex }) => (
                <div key={item.id} className="measurement-range-editor__row">
                  <Input
                    placeholder="如：Cr、Cu、pH"
                    value={item.element}
                    onChange={(event) => handleItemChange(itemIndex, 'element', event.target.value)}
                  />
                  <Input
                    placeholder="如：5、0.5、100"
                    value={item.value}
                    onChange={(event) => handleItemChange(itemIndex, 'value', event.target.value)}
                  />
                  <AutoComplete
                    {...buildAutoCompleteProps(
                      `${item.id}-unit`,
                      item.unit || '',
                      unitAutoCompleteOptions,
                      false,
                    )}
                    value={item.unit}
                    onChange={(nextValue) => handleItemChange(itemIndex, 'unit', nextValue)}
                  >
                    <Input placeholder="如：mg/L、mL" />
                  </AutoComplete>
                  <div className="measurement-range-editor__uncertainty">
                    <AutoComplete
                      {...buildAutoCompleteProps(
                        `${item.id}-uncertaintyMode`,
                        item.uncertaintyMode || '',
                        uncertaintyModeAutoCompleteOptions,
                        true,
                      )}
                      value={item.uncertaintyMode}
                      onChange={(nextValue) =>
                        handleItemChange(itemIndex, 'uncertaintyMode', nextValue)
                      }
                    >
                      <Input placeholder="U / Urel / MPE" />
                    </AutoComplete>
                    <Input
                      placeholder="如：2%"
                      value={item.uncertaintyValue}
                      onChange={(event) =>
                        handleItemChange(itemIndex, 'uncertaintyValue', event.target.value)
                      }
                    />
                    <AutoComplete
                      {...buildAutoCompleteProps(
                        `${item.id}-coverageFactor`,
                        item.coverageFactor || '',
                        coverageFactorAutoCompleteOptions,
                        true,
                      )}
                      value={item.coverageFactor}
                      onChange={(nextValue) =>
                        handleItemChange(itemIndex, 'coverageFactor', nextValue)
                      }
                    >
                      <Input placeholder="k=2 / k=3" />
                    </AutoComplete>
                  </div>
                  <div className="measurement-range-editor__actions">
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      disabled={items.length <= 1}
                      onClick={() => handleDeleteItem(itemIndex)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default MeasurementRangeEditor;
