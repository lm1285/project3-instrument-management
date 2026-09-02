import React, { useState, useEffect } from 'react';
import { Modal, List, Input, Button, App } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { mergeGroupService, MergeGroup } from '../../services/mergeGroupService';
import { useAlertSyncCheck } from '../../hooks/useAlertSyncCheck';
import * as instrumentService from '../../services/instrumentService';

interface AddToMergeGroupModalProps {
  visible: boolean;
  onClose: () => void;
  selectedInstrumentIds: string[];
  onSuccess: () => void;
}

export const AddToMergeGroupModal: React.FC<AddToMergeGroupModalProps> = ({ 
  visible, 
  onClose, 
  selectedInstrumentIds,
  onSuccess
}) => {
  const { message } = App.useApp();
  const { checkAndSync } = useAlertSyncCheck();
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await mergeGroupService.getGroups(searchText);
      if (res.success) {
        setGroups(res.data || []);
      }
    } catch (error) {
      message.error('获取合并组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchGroups();
    }
  }, [visible, searchText]);

  const handleSelectGroup = async (group: MergeGroup) => {
    try {
      // Fetch instruments to check settings
      const instrumentsToProcess = [];
      for (const id of selectedInstrumentIds) {
        const res = await instrumentService.getInstrumentById(id);
        if (res.success && res.data) {
            instrumentsToProcess.push(res.data);
        }
      }

      // We might need to fetch full group details if the list item doesn't have alert settings
      // Usually getGroups list items have these fields if backend returns them.
      // Let's assume group object has them or fetch if needed. 
      // mergeGroupService.getGroups usually returns list of MergeGroup which has alertLevel/Mode.
      
      await checkAndSync(
        { alertMode: group.alertMode, alertLevel: group.alertLevel },
        instrumentsToProcess,
        async (syncSettings) => {
            let successCount = 0;
            for (const id of selectedInstrumentIds) {
                await mergeGroupService.addMember(group.id, id, syncSettings);
                successCount++;
            }
            message.success(`成功将 ${successCount} 个仪器加入合并组 "${group.name}"`);
            onSuccess();
            onClose();
        }
      );
    } catch (error) {
      message.error('添加失败');
    }
  };

  return (
    <Modal
      title="选择合并组"
      open={visible}
      onCancel={onClose}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <Input 
          placeholder="搜索合并组..." 
          prefix={<SearchOutlined />} 
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
      </div>
      <List
        loading={loading}
        dataSource={groups}
        renderItem={item => (
          <List.Item
            actions={[<Button type="link" onClick={() => handleSelectGroup(item)}>选择</Button>]}
          >
            <List.Item.Meta
              title={item.name}
              description={item.model ? `型号: ${item.model}` : '无特定型号'}
            />
            <div>成员: {item.memberCount || 0}</div>
          </List.Item>
        )}
      />
    </Modal>
  );
};
