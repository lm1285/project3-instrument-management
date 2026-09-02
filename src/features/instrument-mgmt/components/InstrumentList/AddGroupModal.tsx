import React, { useMemo, useState } from 'react';
import { App, Button, Input, Modal, Select, Space } from 'antd';

const { Option } = Select;

interface GroupDef {
  type: string;
  name: string;
  model: string;
  measureRange: string;
}

interface AddGroupModalProps {
  visible: boolean;
  onClose: () => void;
  defaultType?: 'std' | 'mat' | 'aux';
  onCreated: () => void;
}

const AddGroupModal: React.FC<AddGroupModalProps> = ({
  visible,
  onClose,
  defaultType = 'std',
  onCreated,
}) => {
  const { message } = App.useApp();
  const typeMap: Record<'std' | 'mat' | 'aux', string> = {
    std: '标准器',
    mat: '标准物质',
    aux: '辅助设备',
  };
  const [type, setType] = useState<string>(typeMap[defaultType]);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [measureRange, setMeasureRange] = useState('');

  const disabledOk = useMemo(() => !type || !name || !model, [type, name, model]);

  const saveDef = (def: GroupDef) => {
    try {
      const raw = localStorage.getItem('instrumentGroupDefs');
      const list: GroupDef[] = raw ? JSON.parse(raw) : [];
      const index = list.findIndex(
        (group) =>
          group.type === def.type &&
          group.name.trim() === def.name.trim() &&
          group.model.trim() === def.model.trim(),
      );

      if (index >= 0) {
        list[index] = def;
      } else {
        list.push(def);
      }

      localStorage.setItem('instrumentGroupDefs', JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    if (disabledOk) {
      message.warning('请填写完整的类型、组名称与型号规格');
      return;
    }

    const success = saveDef({
      type,
      name: name.trim(),
      model: model.trim(),
      measureRange: measureRange.trim(),
    });

    if (!success) {
      message.error('保存失败');
      return;
    }

    message.success('已创建合并组');
    onCreated();
    onClose();
  };

  return (
    <Modal
      title="新增合并组"
      open={visible}
      onCancel={onClose}
      footer={[
        <Space key="actions" size="middle">
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSubmit} disabled={disabledOk}>
            确定
          </Button>
        </Space>,
      ]}
      width={560}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Select
          placeholder="选择仪器类型"
          value={type}
          onChange={setType}
          style={{ width: '100%' }}
        >
          <Option value="标准器">标准器</Option>
          <Option value="标准物质">标准物质</Option>
          <Option value="辅助设备">辅助设备</Option>
        </Select>
        <Input placeholder="组名称" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="组型号规格"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
        <Input
          placeholder="组测量范围"
          value={measureRange}
          onChange={(e) => setMeasureRange(e.target.value)}
        />
      </div>
    </Modal>
  );
};

export default AddGroupModal;
