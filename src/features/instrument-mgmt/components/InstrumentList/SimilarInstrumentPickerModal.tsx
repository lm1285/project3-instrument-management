import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Empty,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  InboxOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { Instrument } from '../../types';

const { Paragraph, Text, Title } = Typography;

interface SimilarInstrumentPickerModalProps {
  visible: boolean;
  instruments: Instrument[];
  currentType?: string;
  onCancel: () => void;
  onSelect: (instrument: Instrument) => void;
}

const buildSearchText = (instrument: Instrument) => [
  instrument.name,
  instrument.model,
  instrument.type,
  instrument.manufacturer,
  instrument.measureRange,
  instrument.managementNumber,
].filter(Boolean).join(' ').toLowerCase();

const SimilarInstrumentPickerModal: React.FC<SimilarInstrumentPickerModalProps> = ({
  visible,
  instruments,
  currentType,
  onCancel,
  onSelect,
}) => {
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string>();

  useEffect(() => {
    if (!visible) {
      setKeyword('');
      setSelectedId(undefined);
    }
  }, [visible]);

  const filteredInstruments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const source = instruments.filter((instrument) => Boolean(instrument?.id));

    return source
      .filter((instrument) => {
        if (!normalizedKeyword) {
          return true;
        }

        return buildSearchText(instrument).includes(normalizedKeyword);
      })
      .sort((left, right) => {
        const leftSameType = currentType && left.type === currentType ? 1 : 0;
        const rightSameType = currentType && right.type === currentType ? 1 : 0;

        if (leftSameType !== rightSameType) {
          return rightSameType - leftSameType;
        }

        return String(right.updatedAt || right.createdAt || '').localeCompare(
          String(left.updatedAt || left.createdAt || ''),
        );
      })
      .slice(0, 24);
  }, [currentType, instruments, keyword]);

  const selectedInstrument = filteredInstruments.find((instrument) => instrument.id === selectedId);

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onCancel}
      width={980}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={!selectedInstrument}
          onClick={() => selectedInstrument && onSelect(selectedInstrument)}
        >
          套用所选数据
        </Button>,
      ]}
    >
      <div className="similar-picker">
        <div className="similar-picker__hero">
          <div>
            <Space size={10} align="center">
              <div className="similar-picker__badge">
                <InboxOutlined />
              </div>
              <Title level={4} className="similar-picker__title">
                选择相似已有数据
              </Title>
            </Space>
            <Paragraph className="similar-picker__subtitle">
              选一条最接近的历史数据作为模板，系统会自动带入常用字段，并保留编号、证书号等唯一信息待你重新填写。
            </Paragraph>
          </div>
          <div className="similar-picker__hero-meta">
            <Tag color="blue">{currentType || '全部类型'}</Tag>
            <Text type="secondary">最多展示 24 条结果</Text>
          </div>
        </div>

        <div className="similar-picker__search">
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined />}
            placeholder="按名称、型号、类型、标准值、测量范围、管理编号搜索"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        {filteredInstruments.length ? (
          <div className="similar-picker__list">
            {filteredInstruments.map((instrument) => {
              const isSelected = instrument.id === selectedId;
              const isSameType = Boolean(currentType && instrument.type === currentType);

              return (
                <button
                  type="button"
                  key={instrument.id}
                  className={`similar-picker__card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(instrument.id)}
                  onDoubleClick={() => {
                    if (isSelected) {
                      setSelectedId(undefined);
                      return;
                    }
                    setSelectedId(instrument.id);
                  }}
                >
                  <div className="similar-picker__card-top">
                    <Radio checked={isSelected} />
                    <div className="similar-picker__card-heading">
                      <div className="similar-picker__name-row">
                        <Text strong className="similar-picker__name">
                          {instrument.name || '未命名仪器'}
                        </Text>
                        {isSameType ? <Tag color="blue">当前类型</Tag> : null}
                      </div>
                      <Text className="similar-picker__model">
                        {instrument.model || '未填写型号'}
                      </Text>
                    </div>
                  </div>

                  <div className="similar-picker__grid">
                    <div className="similar-picker__field">
                      <span className="similar-picker__label">类型</span>
                      <span className="similar-picker__value">
                        <CopyOutlined /> {instrument.type || '-'}
                      </span>
                    </div>
                    <div className="similar-picker__field">
                      <span className="similar-picker__label">测量范围</span>
                      <span className="similar-picker__value">{instrument.measureRange || '-'}</span>
                    </div>
                    <div className="similar-picker__field">
                      <span className="similar-picker__label">生产厂家</span>
                      <span className="similar-picker__value">{instrument.manufacturer || '-'}</span>
                    </div>
                    <div className="similar-picker__field">
                      <span className="similar-picker__label">管理编号</span>
                      <span className="similar-picker__value">{instrument.managementNumber || '-'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="similar-picker__empty">
            <Empty
              description="没有找到符合条件的相似数据"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SimilarInstrumentPickerModal;
