import React, { useEffect, useState } from 'react';
import { Modal, Tabs, Button, Card, Tag, App, Badge, Empty, Spin, Table, Alert } from 'antd';
import { BulbOutlined, UsergroupAddOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { MergeGroupFormModal } from './MergeGroupFormModal';
import { useAlertSyncCheck } from '../../hooks/useAlertSyncCheck';
import { useMergeSuggestionFlow } from '../../hooks/useMergeSuggestionFlow';
import { mergeGroupService } from '../../services/mergeGroupService';

interface MergeSuggestionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  filterType?: string;
}

export const MergeSuggestionModal: React.FC<MergeSuggestionModalProps> = ({
  visible,
  onClose,
  onSuccess,
  filterType,
}) => {
  const { message } = App.useApp();
  const { checkAndSync } = useAlertSyncCheck();
  const [activeTab, setActiveTab] = useState('1');
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [currentCreateIndex, setCurrentCreateIndex] = useState<number | null>(null);
  const [currentCreateDefaults, setCurrentCreateDefaults] = useState<Record<string, any> | null>(null);

  const flow = useMergeSuggestionFlow({
    checkAndSync,
    filterType,
    onFetchSuggestions: async (type) => {
      if (!type) return null;
      const response = await mergeGroupService.getSuggestions(type);
      return response.success && response.data ? response.data : null;
    },
  });

  useEffect(() => {
    if (visible) {
      setActiveTab('1');
      flow.refresh();
    }
  }, [visible]);

  const executeAddToExisting = async () => {
    try {
      const result = await flow.executeExistingOnly();
      if (!result) return;

      if (result.successCount > 0) {
        message.success(`成功聚合 ${result.successCount} 台仪器`);
        onSuccess();
        onClose();
      } else {
        message.warning('没有仪器被加入分组');
      }
    } catch {
      message.error('聚合执行失败');
    }
  };

  const openCreateGroupModal = async (index: number) => {
    const defaults = await flow.prepareNewGroupDefaults(index);
    if (!defaults) {
      message.warning('未找到可创建的分组草案');
      return;
    }

    setCurrentCreateIndex(index);
    setCurrentCreateDefaults(defaults);
    setCreateGroupModalVisible(true);
  };

  const handleCreateGroupSubmit = async (values: any) => {
    if (currentCreateIndex === null) return;

    try {
      const result = await flow.executeSingleNewGroup(currentCreateIndex, values);
      if (!result) return;

      message.success(`成功创建 ${result.createdGroups} 个合并组，并处理 ${result.successCount} 台仪器`);
      setCreateGroupModalVisible(false);
      setCurrentCreateIndex(null);
      setCurrentCreateDefaults(null);
      await flow.refresh();
      onSuccess();
    } catch {
      message.error('创建并聚合失败');
    }
  };

  const renderAddToExisting = () => {
    if (!flow.analysis.addToExisting.length) {
      return <Empty description="暂无可加入的现有分组" />;
    }

    return (
      <div className="space-y-4">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="系统已生成加入现有合并组的执行草案"
          description="你可以按组勾选候选成员，未勾选时默认处理该组下全部候选成员。"
        />

        {flow.analysis.addToExisting.map((item) => (
          <Card
            key={item.groupId}
            size="small"
            title={(
              <div className="flex justify-between items-center">
                <span>
                  <UsergroupAddOutlined className="mr-2 text-blue-500" />
                  加入现有分组：{item.groupName} / {item.groupModel || '无型号'} / {item.groupRange || '无范围'}
                </span>
              </div>
            )}
            extra={<span style={{ color: '#6b7280', fontSize: 12 }}>{item.reason}</span>}
          >
            <div style={{ marginBottom: 8, fontWeight: 600 }}>待加入成员：</div>
            <Table
              rowSelection={{
                type: 'checkbox',
                onChange: (selectedRowKeys) => flow.updateExistingSelection(item.groupId, selectedRowKeys),
                selectedRowKeys: Array.from(flow.selectedAdditions.get(item.groupId) || []),
              }}
              columns={[
                { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', align: 'center' },
              ]}
              dataSource={item.candidates}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </Card>
        ))}

        <div className="text-right mt-4 p-4 bg-gray-50 fixed bottom-0 left-0 right-0 border-t flex justify-end">
          <Button type="primary" onClick={executeAddToExisting} loading={flow.processing}>
            执行加入草案
          </Button>
        </div>
        <div className="h-16"></div>
      </div>
    );
  };

  const renderCreateNew = () => {
    if (!flow.analysis.createNew.length) {
      return <Empty description="暂无新的聚合建议" />;
    }

    return (
      <div className="space-y-4">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="系统已生成建议新组草案"
          description="每张卡片代表一个候选新组合并方案，点击“创建并聚合”后可先确认组信息，再执行。"
        />

        {flow.analysis.createNew.map((item, idx) => (
          <Card key={`${item.suggestedName}-${idx}`} hoverable className="border-l-4 border-l-green-500">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginRight: 24, whiteSpace: 'nowrap' }}>
                  <BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  <span style={{ fontWeight: 600 }}>建议组名：{item.suggestedName}</span>
                </div>
                <div style={{ marginRight: 24, whiteSpace: 'nowrap' }}>
                  组型号：<Tag>{item.suggestedModel || '未指定'}</Tag>
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  组测量范围：<Tag color="blue">{item.suggestedRange || '未指定'}</Tag>
                </div>
              </div>
              <Button
                icon={<PlusCircleOutlined />}
                onClick={() => openCreateGroupModal(idx)}
                loading={flow.processing && currentCreateIndex === idx}
                style={{ color: 'black', flexShrink: 0, marginLeft: 16 }}
              >
                创建并聚合
              </Button>
            </div>

            <div style={{ marginBottom: 10, color: '#6b7280' }}>{item.reason}</div>
            <div className="mb-2 font-medium">建议组成员：</div>
            <Table
              rowSelection={{
                type: 'checkbox',
                onChange: (selectedRowKeys) => flow.updateNewGroupSelection(idx, selectedRowKeys),
                selectedRowKeys: Array.from(flow.selectedCreateNew.get(idx) || []),
              }}
              columns={[
                { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', align: 'center' },
              ]}
              dataSource={item.candidates}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      <Modal
        title={(
          <span>
            <BulbOutlined className="text-yellow-500 mr-2" />
            聚合整理建议
          </span>
        )}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={900}
        rootClassName="instrument-management-overlay"
        styles={{ body: { padding: '0 24px 24px' } }}
      >
        {!filterType ? (
          <div className="py-12">
            <Empty description="请先切换到具体分类视图后再使用聚合整理功能" />
          </div>
        ) : flow.loading ? (
          <div className="text-center py-12">
            <Spin />
            <div style={{ marginTop: 8 }}>正在分析聚合建议...</div>
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: '1',
                label: (
                  <span>
                    推荐加入现有组
                    <Badge count={flow.analysis.addToExisting.length} offset={[8, 0]} size="small" className="ml-1" />
                  </span>
                ),
                children: renderAddToExisting(),
              },
              {
                key: '2',
                label: (
                  <span>
                    推荐创建新组
                    <Badge
                      count={flow.analysis.createNew.length}
                      offset={[8, 0]}
                      size="small"
                      className="ml-1"
                      color="green"
                    />
                  </span>
                ),
                children: renderCreateNew(),
              },
            ]}
          />
        )}
      </Modal>

      <MergeGroupFormModal
        visible={createGroupModalVisible}
        title="创建合并组"
        initialValues={currentCreateDefaults || {}}
        activeTab={filterType}
        onCancel={() => {
          setCreateGroupModalVisible(false);
          setCurrentCreateIndex(null);
          setCurrentCreateDefaults(null);
        }}
        onSubmit={handleCreateGroupSubmit}
      />
    </>
  );
};
