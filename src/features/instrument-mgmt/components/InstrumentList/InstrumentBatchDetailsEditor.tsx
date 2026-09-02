import React from 'react';
import { Button, Input, InputNumber, Segmented, Table } from 'antd';

interface BatchDetailItem {
  index: number;
  managementNumber: string;
  serialNumber?: string;
  certificateNumber?: string;
}

interface InstrumentBatchDetailsEditorProps {
  quantity?: number;
  incrementMode?: string | boolean;
  batchDetails: BatchDetailItem[];
  showBatchDetailTable: boolean;
  onToggleTable: () => void;
  onQuantityChange: (value: number) => void;
  onIncrementModeChange: (value: string) => void;
  onBatchItemChange: (index: number, field: string, value: string) => void;
}

const InstrumentBatchDetailsEditor: React.FC<InstrumentBatchDetailsEditorProps> = ({
  quantity,
  incrementMode,
  batchDetails,
  showBatchDetailTable,
  onToggleTable,
  onQuantityChange,
  onIncrementModeChange,
  onBatchItemChange,
}) => {
  const currentQuantity = quantity || 1;
  const currentMode = String(incrementMode || 'sequential');

  return (
    <div className="instrument-batch-editor">
      <InputNumber
        min={1}
        max={999}
        style={{ width: '100%' }}
        onChange={(value) => onQuantityChange(value || 1)}
        value={currentQuantity}
      />

      {currentQuantity > 1 ? (
        <div className="instrument-batch-editor__details">
          <div className="instrument-batch-editor__rulebar">
            <Segmented
              className="instrument-batch-editor__segmented"
              value={currentMode}
              onChange={(value) => onIncrementModeChange(String(value))}
              options={[
                { label: '顺序递增', value: 'sequential' },
                { label: '后缀递增', value: 'suffix' },
              ]}
            />

            <Button
              type="link"
              onClick={onToggleTable}
              className="instrument-batch-editor__toggle"
            >
              {showBatchDetailTable ? '收起明细' : '查看明细'}
            </Button>
          </div>

          {showBatchDetailTable ? (
            <Table
              className="instrument-batch-editor__table"
              dataSource={batchDetails}
              size="small"
              pagination={false}
              scroll={{ y: 208 }}
              rowKey="index"
              columns={[
                { title: '序号', dataIndex: 'index', width: 56 },
                {
                  title: '管理编号',
                  dataIndex: 'managementNumber',
                  render: (text: string, _record: BatchDetailItem, index: number) => (
                    <Input
                      value={text}
                      onChange={(e) => onBatchItemChange(index, 'managementNumber', e.target.value)}
                      size="small"
                    />
                  ),
                },
                {
                  title: '出厂编号',
                  dataIndex: 'serialNumber',
                  render: (text: string, _record: BatchDetailItem, index: number) => (
                    <Input
                      value={text}
                      onChange={(e) => onBatchItemChange(index, 'serialNumber', e.target.value)}
                      size="small"
                    />
                  ),
                },
                {
                  title: '证书编号',
                  dataIndex: 'certificateNumber',
                  render: (text: string, _record: BatchDetailItem, index: number) => (
                    <Input
                      value={text}
                      onChange={(e) =>
                        onBatchItemChange(index, 'certificateNumber', e.target.value)
                      }
                      size="small"
                    />
                  ),
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default InstrumentBatchDetailsEditor;
