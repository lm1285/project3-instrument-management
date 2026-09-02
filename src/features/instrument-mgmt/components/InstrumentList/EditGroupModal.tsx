import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Input,
  List,
  Space,
  Tag,
  message,
} from 'antd';
import type { Instrument } from '../../types';
import DetailModal from '../../../instrument-flow/components/OperationModals/DetailModal';
import { useMergeGroupEditor } from '../../hooks/useMergeGroupEditor';

interface EditGroupModalProps {
  availableInstruments?: Instrument[];
  existingGroupId?: string | null;
  visible: boolean;
  onClose: () => void;
  typeName: string;
  initial: { name: string; model: string; measureRange: string };
  members: Instrument[];
  mode?: 'modal' | 'drawer';
  title?: string;
  saveText?: string;
  beforeSave?: () => Promise<boolean> | boolean;
  onSaved: (changedCount: { kept: number; removed: number }) => Promise<void> | void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({
  availableInstruments = [],
  existingGroupId,
  visible,
  onClose,
  typeName,
  initial,
  members,
  title,
  saveText = '保存',
  beforeSave,
  onSaved,
}) => {
  const [detailInstrument, setDetailInstrument] = useState<Instrument | null>(null);
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [memberKeyword, setMemberKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    addMember,
    candidateInstruments,
    currentMembers: editorMembers,
    disabledOk,
    measureRange,
    model,
    name,
    removeMember,
    save,
    setMeasureRange,
    setModel,
    setName,
  } = useMergeGroupEditor({
    availableInstruments,
    existingGroupId,
    initial,
    members,
    typeName,
    visible,
  });

  const filteredCandidates = useMemo(() => {
    const keyword = candidateKeyword.trim().toLowerCase();
    if (!keyword) return candidateInstruments;

    return candidateInstruments.filter((instrument) =>
      [instrument.name, instrument.model, instrument.managementNumber, instrument.serialNumber]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [candidateInstruments, candidateKeyword]);

  const filteredMembers = useMemo(() => {
    const keyword = memberKeyword.trim().toLowerCase();
    if (!keyword) return editorMembers;

    return editorMembers.filter((instrument) =>
      [
        instrument.name,
        instrument.model,
        instrument.managementNumber,
        instrument.serialNumber,
        instrument.groupName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [editorMembers, memberKeyword]);

  const suiteCount = useMemo(() => {
    const suiteKeys = new Set(
      editorMembers
        .filter((item) => String(item.groupName || '').trim())
        .map((item) =>
          [
            String(item.groupName || '').trim(),
            String(item.groupModel || '').trim(),
            String(item.groupMeasureRange || '').trim(),
            String(item.groupSerialNumber || '').trim(),
          ].join('||'),
        ),
    );
    return suiteKeys.size;
  }, [editorMembers]);

  const handleSubmit = async () => {
    if (disabledOk) {
      message.warning('请填写完整的合并组名称和型号规格');
      return;
    }

    if (editorMembers.length < 2) {
      message.warning('创建或编辑合并组时，至少需要保留两台仪器成员');
      return;
    }

    try {
      setSubmitting(true);

      if (beforeSave) {
        const shouldContinue = await beforeSave();
        if (!shouldContinue) {
          setSubmitting(false);
          return;
        }
      }

      const result = await save();
      await onSaved(result);
      message.success('合并组已保存');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Drawer
        title={title || (existingGroupId ? '编辑合并组' : '创建合并组')}
        placement="right"
        width={820}
        open={visible}
        onClose={onClose}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSubmit} disabled={disabledOk} loading={submitting}>
              {saveText}
            </Button>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Input placeholder="合并组名称" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="合并组型号规格" value={model} onChange={(e) => setModel(e.target.value)} />
            <Input
              placeholder="合并组测量范围"
              value={measureRange}
              onChange={(e) => setMeasureRange(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #f0f0f0',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ color: '#595959' }}>
              当前已选择 <strong>{editorMembers.length}</strong> 台成员，关联套系 <strong>{suiteCount}</strong> 个。
            </span>
            <Tag color={editorMembers.length >= 2 ? 'processing' : 'warning'} style={{ margin: 0 }}>
              {existingGroupId ? '编辑中' : '待创建'}
            </Tag>
          </div>

          <Card
            size="small"
            title="当前成员"
            extra={
              <Input
                placeholder="搜索成员名称、编号、型号或所属套系"
                value={memberKeyword}
                onChange={(event) => setMemberKeyword(event.target.value)}
                style={{ width: 260 }}
              />
            }
          >
            {filteredMembers.length > 0 ? (
              <List
                size="small"
                dataSource={filteredMembers}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key="detail" type="link" onClick={() => setDetailInstrument(item)}>
                        详情
                      </Button>,
                      <Button key="remove-group" type="link" onClick={() => removeMember(String(item.id))}>
                        移出合并组
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={[8, 8]} wrap>
                          {item.groupName ? (
                            <Tag color="cyan" style={{ margin: 0, borderRadius: 999 }}>
                              {item.groupName}
                            </Tag>
                          ) : null}
                          <span>{item.name}</span>
                        </Space>
                      }
                      description={`出厂编号: ${item.serialNumber || '-'} | 管理编号: ${
                        item.managementNumber || '-'
                      } | 型号: ${item.model || '-'} | 所属套系: ${item.groupName || '未归套'}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有可显示的合并组成员" />
            )}
          </Card>

          <div>
            <Divider orientation="left">增加单个仪器</Divider>
            <Input
              placeholder="搜索单个仪器名称、型号、管理编号或出厂编号"
              value={candidateKeyword}
              onChange={(event) => setCandidateKeyword(event.target.value)}
              style={{ marginBottom: 12 }}
            />

            {filteredCandidates.length > 0 ? (
              <List
                style={{ maxHeight: 320, overflowY: 'auto' }}
                dataSource={filteredCandidates}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key="add" type="link" onClick={() => addMember(item)}>
                        加入合并组
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={[8, 8]} wrap>
                          {item.groupName ? (
                            <Tag color="cyan" style={{ margin: 0 }}>
                              {item.groupName}
                            </Tag>
                          ) : null}
                          <span>{item.name}</span>
                        </Space>
                      }
                      description={`管理编号: ${item.managementNumber || '-'} | 出厂编号: ${
                        item.serialNumber || '-'
                      } | 型号: ${item.model || '-'} | 测量范围: ${item.measureRange || '-'}`}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可加入的单个仪器" />
            )}
          </div>
        </div>

        <DetailModal
          open={!!detailInstrument}
          instrument={detailInstrument}
          onCancel={() => setDetailInstrument(null)}
        />
      </Drawer>
    </>
  );
};

export default EditGroupModal;
