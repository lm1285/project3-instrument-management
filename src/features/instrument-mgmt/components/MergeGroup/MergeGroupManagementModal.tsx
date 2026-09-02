import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd';
import {
  BulbOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { InstrumentType } from '../../../../constants/instrument';
import type { Instrument } from '../../types';
import type { MergeGroup } from '../../services/mergeGroupService';
import {
  cleanupEmptyMergeGroups,
  deleteMergeGroup,
  fetchMergeGroupDetail,
  fetchMergeGroups as fetchMergeGroupList,
  syncLegacyMergeGroups,
} from '../../logic/mergeGroupCommands';
import { GROUP_TYPE_OPTIONS, type MergeGroupEntity } from '../../domain/mergeGroupTypes';
import { useAlertSyncCheck } from '../../hooks/useAlertSyncCheck';
import { useMergeSuggestionFlow } from '../../hooks/useMergeSuggestionFlow';
import { mergeGroupService } from '../../services/mergeGroupService';
import { useMergeGroupWorkbench } from '../../hooks/useMergeGroupWorkbench';
import EditGroupModal from '../InstrumentList/EditGroupModal';
import useAuth from '../../../auth/hooks/useAuth';
import { updateInstrument } from '../../services/instrumentService';

const { Text } = Typography;

interface MergeGroupManagementModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialType?: string;
  instruments?: Instrument[];
}

type SuggestionView = 'existing' | 'create';
type SecondaryPanelKey = 'groups' | 'suggestions' | 'sets';

interface SetCollectionRow {
  key: string;
  setName: string;
  setModel: string;
  setRange: string;
  setSerialNumber: string;
  memberCount: number;
  certificates: string;
  members: Instrument[];
}

interface ManagedGroupRow {
  key: string;
  name: string;
  model: string;
  measurementRange: string;
  memberCount: number;
  description: string;
  backendGroup: MergeGroup;
}

const STANDARD_DEVICE_TAB_KEY = GROUP_TYPE_OPTIONS[0]?.key || InstrumentType.STANDARD_DEVICE;
const STANDARD_MATERIAL_TAB_KEY = GROUP_TYPE_OPTIONS[1]?.key || InstrumentType.STANDARD_MATERIAL;
const AUXILIARY_DEVICE_TAB_KEY = GROUP_TYPE_OPTIONS[2]?.key || InstrumentType.AUXILIARY_DEVICE;

const TAB_LABELS: Record<string, string> = {
  [STANDARD_DEVICE_TAB_KEY]: InstrumentType.STANDARD_DEVICE,
  [STANDARD_MATERIAL_TAB_KEY]: InstrumentType.STANDARD_MATERIAL,
  [AUXILIARY_DEVICE_TAB_KEY]: InstrumentType.AUXILIARY_DEVICE,
};

const FALLBACK_MEMBER_PAGE_SIZE = 8;

const getPanelSearchPlaceholder = (panel: SecondaryPanelKey) => {
  if (panel === 'groups') return '搜索正式合并组';
  if (panel === 'sets') return '搜索套系列表或未归套仪器';
  return '搜索待审批整理建议';
};

const buildSetKey = (instrument: Instrument) =>
  [
    String(instrument.groupName || '').trim(),
    String(instrument.groupModel || '').trim(),
    String(instrument.groupMeasureRange || '').trim(),
  ].join('||');

const getSetSerialSummary = (members: Instrument[]) => {
  const suiteSerials = Array.from(
    new Set(members.map((item) => String(item.groupSerialNumber || '').trim()).filter(Boolean)),
  );
  if (suiteSerials.length > 0) {
    return suiteSerials.join(' / ');
  }

  const memberSerials = Array.from(
    new Set(members.map((item) => String(item.serialNumber || '').trim()).filter(Boolean)),
  );
  return memberSerials.length > 0 ? memberSerials.join(' / ') : '-';
};

export const MergeGroupManagementModal: React.FC<MergeGroupManagementModalProps> = ({
  visible,
  onClose,
  onSuccess,
  initialType,
  instruments = [],
}) => {
  const { message, modal } = App.useApp();
  const { checkAndSync } = useAlertSyncCheck();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<MergeGroup[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState(initialType || STANDARD_DEVICE_TAB_KEY);
  const [activePanel, setActivePanel] = useState<SecondaryPanelKey>('groups');
  const [suggestionView, setSuggestionView] = useState<SuggestionView>('existing');
  const [editingGroup, setEditingGroup] = useState<MergeGroup | null>(null);
  const [groupEditorVisible, setGroupEditorVisible] = useState(false);
  const [groupEditorEntity, setGroupEditorEntity] = useState<MergeGroupEntity | null>(null);
  const [suggestionEditorVisible, setSuggestionEditorVisible] = useState(false);
  const [suggestionEditorEntity, setSuggestionEditorEntity] = useState<MergeGroupEntity | null>(null);
  const [currentCreateIndex, setCurrentCreateIndex] = useState<number | null>(null);
  const [setEditorVisible, setSetEditorVisible] = useState(false);
  const [setEditorLoading, setSetEditorLoading] = useState(false);
  const [setCandidateKeyword, setSetCandidateKeyword] = useState('');
  const [editingSetKey, setEditingSetKey] = useState<string | null>(null);
  const [setEditorName, setSetEditorName] = useState('');
  const [setEditorModel, setSetEditorModel] = useState('');
  const [setEditorRange, setSetEditorRange] = useState('');
  const [setEditorSerialNumber, setSetEditorSerialNumber] = useState('');
  const [selectedSetMemberKeys, setSelectedSetMemberKeys] = useState<React.Key[]>([]);
  const [selectedSetKeys, setSelectedSetKeys] = useState<React.Key[]>([]);
  const [mergeSetSourceRows, setMergeSetSourceRows] = useState<SetCollectionRow[]>([]);

  const activeTypeLabel = TAB_LABELS[activeTab] || activeTab;
  const isStandardMaterialTab = activeTab === STANDARD_MATERIAL_TAB_KEY;

  const scopedInstruments = useMemo(() => {
    if (activeTab === STANDARD_DEVICE_TAB_KEY) {
      return instruments.filter((item) => item.type === STANDARD_DEVICE_TAB_KEY);
    }
    if (activeTab === STANDARD_MATERIAL_TAB_KEY) {
      return instruments.filter((item) => item.type === STANDARD_MATERIAL_TAB_KEY);
    }
    if (activeTab === AUXILIARY_DEVICE_TAB_KEY) {
      return instruments.filter((item) => item.type === AUXILIARY_DEVICE_TAB_KEY);
    }
    return instruments;
  }, [activeTab, instruments]);

  const workbench = useMergeGroupWorkbench({
    dateFormat: 'YYYY-MM-DD',
    instruments: scopedInstruments,
    revision: groups.length,
  });

  const suggestionFlow = useMergeSuggestionFlow({
    checkAndSync,
    filterType: activeTab,
    onFetchSuggestions: async (type) => {
      if (!type) return null;
      const response = await mergeGroupService.getSuggestions(type);
      return response.success && response.data ? response.data : null;
    },
  });

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const nextGroups = await fetchMergeGroupList();
      setGroups(nextGroups);
    } catch {
      message.error('获取合并组列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setActiveTab(initialType || STANDARD_DEVICE_TAB_KEY);
    setActivePanel('groups');
    setSuggestionView('existing');
    setSearchText('');
    setSelectedSetKeys([]);
    setMergeSetSourceRows([]);
    setSetEditorVisible(false);
    void fetchGroups();
  }, [initialType, visible]);

  useEffect(() => {
    if (!isStandardMaterialTab && activePanel === 'sets') {
      setActivePanel('groups');
    }
  }, [activePanel, isStandardMaterialTab]);

  useEffect(() => {
    setSetEditorVisible(false);
    setEditingSetKey(null);
    setSelectedSetMemberKeys([]);
    setSetCandidateKeyword('');
    setSetEditorSerialNumber('');
  }, [activePanel, activeTab]);

  const handleDrawerClose = () => {
    setGroupEditorVisible(false);
    setSuggestionEditorVisible(false);
    setSetEditorVisible(false);
    setEditingGroup(null);
    setGroupEditorEntity(null);
    setSuggestionEditorEntity(null);
    setCurrentCreateIndex(null);
    setMergeSetSourceRows([]);
    onClose();
  };

  const getApprovalRoles = () => {
    const roleBag = new Set<string>();
    const pushRole = (value?: string) => {
      if (!value) return;
      roleBag.add(String(value).trim().toLowerCase());
    };

    pushRole(user?.role);
    (user as any)?.roles?.forEach((role: string) => pushRole(role));
    return roleBag;
  };

  const hasCreateApprovalAuthority = () => {
    if (user?.is_system_admin) return true;
    const roles = getApprovalRoles();
    return ['admin', 'administrator', 'manager', 'principal', '设备管理员', '负责人', '管理员']
      .map((item) => item.toLowerCase())
      .some((role) => roles.has(role));
  };

  const requestCreateApproval = (actionLabel: string) =>
    new Promise<boolean>((resolve) => {
      if (!user) {
        modal.warning({
          title: '无法确认审批人',
          content: '当前未获取到登录用户信息，暂时无法发起该创建操作。',
          onOk: () => resolve(false),
        });
        return;
      }

      if (!hasCreateApprovalAuthority()) {
        modal.warning({
          title: '缺少创建确认权限',
          content: '创建合并组或套系前，需要设备管理员、负责人或管理员确认。',
          onOk: () => resolve(false),
        });
        return;
      }

      modal.confirm({
        title: '确认创建',
        content: `当前操作为“${actionLabel}”。确认人：${user.username}${
          user.role ? `（${user.role}）` : ''
        }。`,
        okText: '确认',
        cancelText: '取消',
        onOk: async () => resolve(true),
        onCancel: async () => resolve(false),
      });
    });

  const filteredGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return groups
      .filter((group) => (group.type ? group.type === activeTab : activeTab === STANDARD_DEVICE_TAB_KEY))
      .filter((group) => {
        if (!keyword) return true;
        return [group.name, group.model, group.measurementRange, group.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      });
  }, [activeTab, groups, searchText]);

  const fallbackMemberCountMap = useMemo(() => {
    const counter = new Map<string, number>();
    scopedInstruments.forEach((instrument) => {
      if (!instrument.mergeGroupId) return;
      const key = String(instrument.mergeGroupId);
      counter.set(key, (counter.get(key) || 0) + 1);
    });
    return counter;
  }, [scopedInstruments]);

  const managedRows = useMemo<ManagedGroupRow[]>(
    () =>
      filteredGroups.map((group) => ({
        key: group.id,
        name: group.name,
        model: group.model || '-',
        measurementRange: group.measurementRange || '-',
        memberCount: group.memberCount || fallbackMemberCountMap.get(group.id) || 0,
        description: group.description || '-',
        backendGroup: group,
      })),
    [fallbackMemberCountMap, filteredGroups],
  );

  const visibleSetCollections = useMemo<SetCollectionRow[]>(() => {
    if (!isStandardMaterialTab) return [];

    const buckets = new Map<string, Instrument[]>();
    scopedInstruments.forEach((instrument) => {
      const setName = String(instrument.groupName || '').trim();
      if (!setName) return;
      const key = buildSetKey(instrument);
      const current = buckets.get(key) || [];
      current.push(instrument);
      buckets.set(key, current);
    });

    const keyword = searchText.trim().toLowerCase();

    return Array.from(buckets.entries())
      .map(([key, members]) => {
        const first = members[0];
        const certificates = Array.from(
          new Set(members.map((item) => String(item.certificateNumber || '').trim()).filter(Boolean)),
        );

        return {
          key,
          setName: String(first.groupName || '').trim(),
          setModel: String(first.groupModel || '').trim() || '-',
          setRange: String(first.groupMeasureRange || '').trim() || '-',
          setSerialNumber: getSetSerialSummary(members),
          memberCount: members.length,
          certificates: certificates.length > 0 ? certificates.join(' / ') : '-',
          members,
        };
      })
      .filter((item) => {
        if (!keyword) return true;
        return [item.setName, item.setModel, item.setRange, item.setSerialNumber, item.certificates]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      })
      .sort((left, right) => right.memberCount - left.memberCount);
  }, [isStandardMaterialTab, scopedInstruments, searchText]);

  const visibleUnassignedSetInstruments = useMemo(() => {
    if (!isStandardMaterialTab) return [];
    const keyword = searchText.trim().toLowerCase();
    return scopedInstruments
      .filter((instrument) => !String(instrument.groupName || '').trim())
      .filter((instrument) => {
        if (!keyword) return true;
        return [
          instrument.name,
          instrument.model,
          instrument.managementNumber,
          instrument.serialNumber,
          instrument.measureRange,
          instrument.certificateNumber,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      });
  }, [isStandardMaterialTab, scopedInstruments, searchText]);

  useEffect(() => {
    setSelectedSetKeys((current) =>
      current.filter((key) => visibleSetCollections.some((item) => item.key === key)),
    );
  }, [visibleSetCollections]);

  const selectableSetInstruments = useMemo(() => {
    const keyword = setCandidateKeyword.trim().toLowerCase();
    return scopedInstruments.filter((instrument) => {
      if (!keyword) return true;
      return [
        instrument.name,
        instrument.model,
        instrument.managementNumber,
        instrument.serialNumber,
        instrument.measureRange,
        instrument.groupName,
        instrument.groupSerialNumber,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [scopedInstruments, setCandidateKeyword]);

  const selectedSetRows = useMemo(
    () => visibleSetCollections.filter((item) => selectedSetKeys.includes(item.key)),
    [selectedSetKeys, visibleSetCollections],
  );

  const selectedSetSummary = useMemo(() => {
    const memberCount = selectedSetRows.reduce((total, item) => total + item.memberCount, 0);
    const models = Array.from(
      new Set(
        selectedSetRows
          .map((item) => (item.setModel === '-' ? '' : item.setModel).trim())
          .filter(Boolean),
      ),
    );
    const ranges = Array.from(
      new Set(
        selectedSetRows
          .map((item) => (item.setRange === '-' ? '' : item.setRange).trim())
          .filter(Boolean),
      ),
    );

    return {
      setCount: selectedSetRows.length,
      memberCount,
      models,
      ranges,
      hasMixedModels: models.length > 1,
      hasMixedRanges: ranges.length > 1,
    };
  }, [selectedSetRows]);

  const metrics = [
    { label: '正式合并组', value: filteredGroups.length },
    { label: '待审批新组', value: suggestionFlow.analysis.createNew.length },
    {
      label: '待整理建议',
      value: suggestionFlow.analysis.addToExisting.length + suggestionFlow.analysis.createNew.length,
    },
    { label: '单体仪器', value: workbench.metrics.singles },
  ];

  const resetManualEditor = () => {
    setEditingGroup(null);
    setGroupEditorEntity({
      key: `manual-${activeTab}-${Date.now()}`,
      name: '',
      model: '',
      range: '',
      list: [],
    });
    setGroupEditorVisible(true);
  };

  const handleAdd = () => {
    const suggestionCount =
      suggestionFlow.analysis.addToExisting.length + suggestionFlow.analysis.createNew.length;

    if (suggestionCount > 0) {
      modal.confirm({
        title: '检测到待整理建议',
        content: `当前 ${activeTypeLabel} 存在 ${suggestionCount} 条待审批整理建议，建议先完成审批，再决定是否手动创建。`,
        okText: '先看待整理',
        cancelText: '继续手动创建',
        onOk: async () => setActivePanel('suggestions'),
        onCancel: async () => resetManualEditor(),
      });
      return;
    }

    resetManualEditor();
  };

  const handleEdit = async (record: MergeGroup) => {
    const hide = message.loading('正在加载合并组详情...', 0);
    try {
      const groupDetails = await fetchMergeGroupDetail(record);
      const memberIds = new Set((groupDetails.members || []).map((member) => String(member.id)));
      const detailMembers = instruments.filter((instrument) => memberIds.has(String(instrument.id)));

      hide();
      setEditingGroup(groupDetails);
      setGroupEditorEntity({
        key: groupDetails.id,
        name: groupDetails.name,
        model: groupDetails.model || '',
        range: groupDetails.measurementRange || '',
        list: detailMembers,
      });
      setGroupEditorVisible(true);
    } catch {
      hide();
      message.error('加载合并组详情失败');
    }
  };

  const handleDelete = async (id: string) => {
    const hide = message.loading('正在删除合并组...', 0);
    try {
      const res = await deleteMergeGroup(id);
      hide();
      if (res.success) {
        message.success('合并组已删除，成员已回到单体显示');
        await fetchGroups();
        await suggestionFlow.refresh();
        onSuccess?.();
      }
    } catch {
      hide();
      message.error('删除合并组失败');
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await syncLegacyMergeGroups();
      if (res.success) {
        message.success(res.message || '同步成功');
        await fetchGroups();
        onSuccess?.();
      }
    } catch {
      message.error('同步失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanEmptyGroups = () => {
    const emptyGroups = groups.filter((group) => (group.memberCount || 0) === 0);
    if (emptyGroups.length === 0) {
      message.info('当前没有空合并组');
      return;
    }

    modal.confirm({
      title: '清理空合并组',
      content: `检测到 ${emptyGroups.length} 个空合并组，确认后将统一清理。`,
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        const hide = message.loading('正在清理...', 0);
        try {
          await cleanupEmptyMergeGroups(emptyGroups);
          hide();
          message.success('空合并组已清理');
          await fetchGroups();
          onSuccess?.();
        } catch {
          hide();
          message.error('清理失败');
        }
      },
    });
  };

  const executeAddToExisting = async () => {
    try {
      const result = await suggestionFlow.executeExistingOnly();
      if (!result) return;
      if (result.successCount > 0) {
        message.success(`已将 ${result.successCount} 台仪器加入现有合并组`);
        await fetchGroups();
        await suggestionFlow.refresh();
        onSuccess?.();
      } else {
        message.warning('当前没有已执行的加入动作');
      }
    } catch {
      message.error('加入现有合并组失败');
    }
  };

  const openSuggestionCreateEditor = async (index: number) => {
    const defaults = await suggestionFlow.prepareNewGroupDefaults(index);
    const draftItem = suggestionFlow.draft.newGroupItems[index];
    if (!defaults || !draftItem) {
      message.warning('未找到可审批的新组合并建议');
      return;
    }

    setCurrentCreateIndex(index);
    setSuggestionEditorEntity({
      key: `suggestion-${activeTab}-${index}`,
      name: String(defaults.name || ''),
      model: String(defaults.model || ''),
      range: String(defaults.measurementRange || ''),
      list: draftItem.instruments,
    });
    setSuggestionEditorVisible(true);
  };

  const resetSetEditor = () => {
    setEditingSetKey(null);
    setSetEditorName('');
    setSetEditorModel('');
    setSetEditorRange('');
    setSetEditorSerialNumber('');
    setSelectedSetMemberKeys([]);
    setSetCandidateKeyword('');
    setSetEditorVisible(false);
  };

  const openCreateSetEditor = () => {
    setEditingSetKey(null);
    setSetEditorName('');
    setSetEditorModel('');
    setSetEditorRange('');
    setSetEditorSerialNumber('');
    setSelectedSetMemberKeys([]);
    setSetCandidateKeyword('');
    setSetEditorVisible(true);
  };

  const openEditSetEditor = (record: SetCollectionRow) => {
    setEditingSetKey(record.key);
    setSetEditorName(record.setName);
    setSetEditorModel(record.setModel === '-' ? '' : record.setModel);
    setSetEditorRange(record.setRange === '-' ? '' : record.setRange);
    setSetEditorSerialNumber(
      record.members.find((item) => String(item.groupSerialNumber || '').trim())?.groupSerialNumber || '',
    );
    setSelectedSetMemberKeys(record.members.map((item) => item.id));
    setSetCandidateKeyword('');
    setSetEditorVisible(true);
  };

  const openMergeSetsToGroupEditor = () => {
    const pickedSets = visibleSetCollections.filter((item) => selectedSetKeys.includes(item.key));
    if (pickedSets.length < 2) {
      message.warning('请至少选择两个套系后再合并为合并组');
      return;
    }

    const mergedMembers = pickedSets.flatMap((item) => item.members);
    const mergedNames = pickedSets.map((item) => item.setName).filter(Boolean);
    const mergedModels = Array.from(
      new Set(
        pickedSets
          .map((item) => (item.setModel === '-' ? '' : item.setModel).trim())
          .filter(Boolean),
      ),
    );
    const mergedRanges = Array.from(
      new Set(
        pickedSets
          .map((item) => (item.setRange === '-' ? '' : item.setRange).trim())
          .filter(Boolean),
      ),
    );

    setEditingGroup(null);
    setMergeSetSourceRows(pickedSets);
    setGroupEditorEntity({
      key: `merge-sets-${Date.now()}`,
      name: mergedNames.join(' / '),
      model: mergedModels.length === 1 ? mergedModels[0] : '',
      range: mergedRanges.length === 1 ? mergedRanges[0] : '',
      list: mergedMembers,
    });
    setGroupEditorVisible(true);
  };

  const handleSaveSet = async () => {
    const nextName = setEditorName.trim();
    const nextModel = setEditorModel.trim();
    const nextRange = setEditorRange.trim();
    const nextSerialNumber = setEditorSerialNumber.trim();
    const nextIds = new Set(selectedSetMemberKeys.map((item) => String(item)));

    if (!nextName) {
      message.warning('请先填写套系名称');
      return;
    }
    if (nextIds.size < 1) {
      message.warning('一个套系至少需要选择 1 台标准物质');
      return;
    }

    const approved = editingSetKey ? true : await requestCreateApproval(`创建${activeTypeLabel}套系`);
    if (!approved) return;

    const previousMembers = editingSetKey
      ? visibleSetCollections.find((item) => item.key === editingSetKey)?.members || []
      : [];
    const removedMembers = previousMembers.filter((item) => !nextIds.has(String(item.id)));
    const keptMembers = scopedInstruments.filter((item) => nextIds.has(String(item.id)));

    setSetEditorLoading(true);
    try {
      const updateJobs: Array<Promise<{ success: boolean }>> = [];

      removedMembers.forEach((instrument) => {
        updateJobs.push(
          updateInstrument(String(instrument.id), {
            type: instrument.type,
            groupName: '',
            groupModel: '',
            groupMeasureRange: '',
            groupSerialNumber: '',
          }),
        );
      });

      keptMembers.forEach((instrument) => {
        updateJobs.push(
          updateInstrument(String(instrument.id), {
            type: instrument.type,
            groupName: nextName,
            groupModel: nextModel,
            groupMeasureRange: nextRange,
            groupSerialNumber: nextSerialNumber,
          }),
        );
      });

      const results = await Promise.allSettled(updateJobs);
      const failedCount = results.filter(
        (result) => result.status === 'rejected' || !result.value?.success,
      ).length;

      if (failedCount > 0) {
        message.error(`套系保存未完成，失败 ${failedCount} 项`);
        return;
      }

      message.success(editingSetKey ? '套系已更新' : '套系已创建');
      resetSetEditor();
      setSelectedSetKeys([]);
      await fetchGroups();
      await suggestionFlow.refresh();
      onSuccess?.();
    } finally {
      setSetEditorLoading(false);
    }
  };

  const filteredExistingSuggestions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return suggestionFlow.analysis.addToExisting;
    return suggestionFlow.analysis.addToExisting.filter((item) =>
      [
        item.groupName,
        item.groupModel,
        item.groupRange,
        item.reason,
        ...item.candidates.flatMap((candidate) => [candidate.name, candidate.model, candidate.managementNumber]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [searchText, suggestionFlow.analysis.addToExisting]);

  const filteredCreateSuggestions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    const source = suggestionFlow.analysis.createNew.map((item, index) => ({ item, index }));
    if (!keyword) return source;
    return source.filter(({ item }) =>
      [
        item.suggestedName,
        item.suggestedModel,
        item.suggestedRange,
        item.reason,
        ...item.candidates.flatMap((candidate) => [candidate.name, candidate.model, candidate.managementNumber]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [searchText, suggestionFlow.analysis.createNew]);

  const groupColumns: TableColumnsType<ManagedGroupRow> = [
    { title: '合并组名称', dataIndex: 'name', key: 'name', align: 'center' },
    { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
    { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', align: 'center' },
    { title: '成员数量', dataIndex: 'memberCount', key: 'memberCount', align: 'center', width: 100 },
    { title: '说明', dataIndex: 'description', key: 'description', align: 'center' },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 140,
      render: (_value, record) => (
        <Space size="small">
          <Tooltip title="编辑合并组">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record.backendGroup)} />
          </Tooltip>
          <Popconfirm
            title="确定删除该合并组吗？"
            description="删除后成员会回到单体显示，但不会删除仪器本身。"
            onConfirm={() => handleDelete(record.backendGroup.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderSetPanel = () => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {setEditorVisible ? (
        <Card
          size="small"
          style={{ borderRadius: 12, borderColor: '#d9f7be', background: '#fcffe6' }}
          title={editingSetKey ? '编辑套系' : '创建套系'}
          extra={
            <Space>
              <Button size="small" onClick={resetSetEditor}>
                取消
              </Button>
              <Button size="small" type="primary" onClick={handleSaveSet} loading={setEditorLoading}>
                {editingSetKey ? '保存套系' : '创建套系'}
              </Button>
            </Space>
          }
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <Input placeholder="套系名称" value={setEditorName} onChange={(event) => setSetEditorName(event.target.value)} />
              <Input placeholder="套系型号规格" value={setEditorModel} onChange={(event) => setSetEditorModel(event.target.value)} />
              <Input placeholder="套系测量范围" value={setEditorRange} onChange={(event) => setSetEditorRange(event.target.value)} />
              <Input
                placeholder="套系出厂编号"
                value={setEditorSerialNumber}
                onChange={(event) => setSetEditorSerialNumber(event.target.value)}
              />
            </div>

            <Card
              size="small"
              title="选择套系成员"
              styles={{ body: { padding: 12 } }}
              extra={<span style={{ color: '#8c8c8c' }}>已选 {selectedSetMemberKeys.length} 台</span>}
            >
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <Input
                  placeholder="搜索仪器名称、型号、管理编号、出厂编号"
                  prefix={<SearchOutlined />}
                  value={setCandidateKeyword}
                  onChange={(event) => setSetCandidateKeyword(event.target.value)}
                />
                <Table
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  rowSelection={{
                    selectedRowKeys: selectedSetMemberKeys,
                    onChange: (keys) => setSelectedSetMemberKeys(keys),
                  }}
                  dataSource={selectableSetInstruments}
                  locale={{ emptyText: <Empty description="当前没有可选择的标准物质" /> }}
                  columns={[
                    { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                    { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                    { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                    { title: '出厂编号', dataIndex: 'serialNumber', key: 'serialNumber', align: 'center' },
                    { title: '测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center' },
                    {
                      title: '当前套系',
                      key: 'groupName',
                      align: 'center',
                      render: (_value, record: Instrument) =>
                        record.groupName ? <Tag color="blue">{record.groupName}</Tag> : <Tag>未归套</Tag>,
                    },
                  ]}
                />
              </Space>
            </Card>
          </Space>
        </Card>
      ) : null}

      <Alert
        type="info"
        showIcon
        message="套系整理与合并组整理并行管理"
        description="这里按“套系名称 + 型号规格 + 测量范围 + 套系出厂编号”统一整理标准物质套系；套系新增、编辑、删除仅允许在这里进行。"
        action={
          <Space>
            <Button size="small" onClick={openMergeSetsToGroupEditor} disabled={selectedSetKeys.length < 2}>
              合并选中套系为合并组
            </Button>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreateSetEditor}>
              创建套系
            </Button>
          </Space>
        }
      />

      {selectedSetKeys.length > 0 ? (
        <Alert
          type={selectedSetSummary.hasMixedModels || selectedSetSummary.hasMixedRanges ? 'warning' : 'success'}
          showIcon
          message={`已选 ${selectedSetSummary.setCount} 个套系，共 ${selectedSetSummary.memberCount} 台成员`}
          description={`型号${selectedSetSummary.hasMixedModels ? '存在多个' : '已统一'}，测量范围${
            selectedSetSummary.hasMixedRanges ? '存在多个' : '已统一'
          }。`}
        />
      ) : null}

      <Space wrap size={10}>
        <Card size="small" style={{ minWidth: 140 }} styles={{ body: { padding: 12 } }}>
          <Text type="secondary">套系数量</Text>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{visibleSetCollections.length}</div>
        </Card>
        <Card size="small" style={{ minWidth: 140 }} styles={{ body: { padding: 12 } }}>
          <Text type="secondary">套系成员总数</Text>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>
            {visibleSetCollections.reduce((total, item) => total + item.memberCount, 0)}
          </div>
        </Card>
        <Card size="small" style={{ minWidth: 140 }} styles={{ body: { padding: 12 } }}>
          <Text type="secondary">未归套物质</Text>
          <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{visibleUnassignedSetInstruments.length}</div>
        </Card>
      </Space>

      <Card size="small" title="套系列表" styles={{ body: { padding: 12 } }}>
        <Table
          rowKey="key"
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          rowSelection={{
            selectedRowKeys: selectedSetKeys,
            onChange: (keys) => setSelectedSetKeys(keys),
          }}
          locale={{ emptyText: <Empty description="当前没有可显示的套系" /> }}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                rowKey="id"
                size="small"
                pagination={{ pageSize: FALLBACK_MEMBER_PAGE_SIZE, showSizeChanger: false }}
                dataSource={record.members}
                columns={[
                  { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                  { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                  { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                  { title: '出厂编号', dataIndex: 'serialNumber', key: 'serialNumber', align: 'center' },
                  { title: '测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center' },
                ]}
              />
            ),
          }}
          dataSource={visibleSetCollections}
          columns={[
            { title: '套系名称', dataIndex: 'setName', key: 'setName', align: 'center' },
            { title: '型号规格', dataIndex: 'setModel', key: 'setModel', align: 'center' },
            { title: '测量范围', dataIndex: 'setRange', key: 'setRange', align: 'center' },
            { title: '套系出厂编号', dataIndex: 'setSerialNumber', key: 'setSerialNumber', align: 'center' },
            { title: '成员数量', dataIndex: 'memberCount', key: 'memberCount', align: 'center', width: 90 },
            {
              title: '操作',
              key: 'action',
              align: 'center',
              width: 160,
              render: (_value, record: SetCollectionRow) => (
                <Space size="small">
                  <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEditSetEditor(record)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setSelectedSetKeys((current) => Array.from(new Set([...current, record.key])))}
                  >
                    选中
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card size="small" title="未归套的标准物质" styles={{ body: { padding: 12 } }}>
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="当前没有未归套的标准物质" /> }}
          dataSource={visibleUnassignedSetInstruments}
          columns={[
            { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
            { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
            { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
            { title: '出厂编号', dataIndex: 'serialNumber', key: 'serialNumber', align: 'center' },
            { title: '测量范围', dataIndex: 'measureRange', key: 'measureRange', align: 'center' },
          ]}
        />
      </Card>
    </Space>
  );

  const renderSuggestionPanel = () => {
    if (suggestionFlow.loading) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin />
          <div style={{ marginTop: 8 }}>正在分析待审批建议...</div>
        </div>
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="待审批建议不会直接生效"
          description="识别出的建议不会自动进入正式合并组列表，也不会直接影响仪器管理主表，只有审批通过后才会生成。"
        />

        <Tabs
          activeKey={suggestionView}
          onChange={(key) => setSuggestionView(key as SuggestionView)}
          items={[
            {
              key: 'existing',
              label: (
                <span>
                  加入现有组
                  <Badge
                    count={suggestionFlow.analysis.addToExisting.length}
                    offset={[8, 0]}
                    size="small"
                    style={{ marginInlineStart: 6 }}
                  />
                </span>
              ),
              children: (
                <Card size="small" bordered={false} styles={{ body: { padding: 0 } }}>
                  {filteredExistingSuggestions.length === 0 ? (
                    <Empty description="暂无可审批的加入现有合并组建议" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {filteredExistingSuggestions.map((item) => (
                        <Card
                          key={item.groupId}
                          size="small"
                          title={
                            <span>
                              <UsergroupAddOutlined style={{ marginRight: 8, color: '#1677ff' }} />
                              {item.groupName} / {item.groupModel || '未填型号'} / {item.groupRange || '未填量程'}
                            </span>
                          }
                          extra={<Tag color="gold">待审批</Tag>}
                        >
                          <div style={{ color: '#595959', marginBottom: 12 }}>{item.reason}</div>
                          <Table
                            rowSelection={{
                              type: 'checkbox',
                              onChange: (selectedRowKeys) =>
                                suggestionFlow.updateExistingSelection(item.groupId, selectedRowKeys),
                              selectedRowKeys: Array.from(suggestionFlow.selectedAdditions.get(item.groupId) || []),
                            }}
                            columns={[
                              { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                              { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                              { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                              { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', align: 'center' },
                            ]}
                            dataSource={item.candidates}
                            rowKey="id"
                            pagination={{ pageSize: FALLBACK_MEMBER_PAGE_SIZE, showSizeChanger: false }}
                            size="small"
                          />
                        </Card>
                      ))}

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" onClick={executeAddToExisting} loading={suggestionFlow.processing}>
                          审批加入现有组
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ),
            },
            {
              key: 'create',
              label: (
                <span>
                  创建新组
                  <Badge
                    count={suggestionFlow.analysis.createNew.length}
                    offset={[8, 0]}
                    size="small"
                    style={{ marginInlineStart: 6 }}
                  />
                </span>
              ),
              children: (
                <Card size="small" bordered={false} styles={{ body: { padding: 0 } }}>
                  {filteredCreateSuggestions.length === 0 ? (
                    <Empty description="暂无可审批的新组合并建议" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {filteredCreateSuggestions.map(({ item, index }) => (
                        <Card
                          key={`${item.suggestedName}-${index}`}
                          size="small"
                          extra={
                            <Space>
                              <Tag color="gold" style={{ margin: 0 }}>
                                待审批
                              </Tag>
                              <Button
                                icon={<PlusOutlined />}
                                onClick={() => openSuggestionCreateEditor(index)}
                                loading={suggestionFlow.processing && currentCreateIndex === index}
                              >
                                审批创建
                              </Button>
                            </Space>
                          }
                        >
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Space wrap>
                              <span style={{ fontWeight: 700 }}>
                                <BulbOutlined style={{ marginRight: 8, color: '#faad14' }} />
                                推荐合并组：{item.suggestedName}
                              </span>
                              <Tag>{item.suggestedModel || '未填型号'}</Tag>
                              <Tag color="blue">{item.suggestedRange || '未填量程'}</Tag>
                            </Space>
                            <div style={{ color: '#595959' }}>{item.reason}</div>
                            <Table
                              rowSelection={{
                                type: 'checkbox',
                                onChange: (selectedRowKeys) =>
                                  suggestionFlow.updateNewGroupSelection(index, selectedRowKeys),
                                selectedRowKeys: Array.from(suggestionFlow.selectedCreateNew.get(index) || []),
                              }}
                              columns={[
                                { title: '仪器名称', dataIndex: 'name', key: 'name', align: 'center' },
                                { title: '型号规格', dataIndex: 'model', key: 'model', align: 'center' },
                                { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
                                { title: '测量范围', dataIndex: 'measurementRange', key: 'measurementRange', align: 'center' },
                              ]}
                              dataSource={item.candidates}
                              rowKey="id"
                              pagination={{ pageSize: FALLBACK_MEMBER_PAGE_SIZE, showSizeChanger: false }}
                              size="small"
                            />
                          </Space>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Space>
    );
  };

  return (
    <>
      <Drawer
        title="合并组管理"
        open={visible}
        onClose={handleDrawerClose}
        width={1080}
        rootClassName="instrument-management-overlay"
        extra={<Button onClick={handleDrawerClose}>关闭</Button>}
      >
        <div
          style={{
            padding: 12,
            border: '1px solid #f0f0f0',
            borderRadius: 12,
            background: '#fafafa',
            marginBottom: 14,
          }}
        >
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Text type="secondary">
              在这里集中处理正式合并组的新建、编辑、删除、空组清理，以及待审批整理建议和标准物质套系整理。
            </Text>
            <Space size={10} wrap>
              {metrics.map((item) => (
                <div
                  key={item.label}
                  style={{
                    minWidth: 132,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: '#fff',
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ color: '#8c8c8c', fontSize: 12 }}>{item.label}</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{item.value}</div>
                </div>
              ))}
            </Space>
          </Space>
        </div>

        <div
          style={{
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Space wrap>
            <Input
              placeholder={getPanelSearchPlaceholder(activePanel)}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 260 }}
            />
            <Button icon={<ReloadOutlined />} onClick={activePanel === 'groups' ? fetchGroups : suggestionFlow.refresh}>
              刷新
            </Button>
            {activePanel === 'groups' ? (
              <>
                <Tooltip title="同步历史分组数据">
                  <Button icon={<SyncOutlined />} onClick={handleSync}>
                    同步
                  </Button>
                </Tooltip>
                <Tooltip title="清理没有成员的正式合并组">
                  <Button icon={<DeleteOutlined />} onClick={handleCleanEmptyGroups} danger>
                    清理空组
                  </Button>
                </Tooltip>
              </>
            ) : null}
          </Space>

          {activePanel === 'groups' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              手动创建合并组
            </Button>
          ) : null}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={GROUP_TYPE_OPTIONS.map((item) => ({
            key: item.key,
            label: TAB_LABELS[item.key] || item.label,
          }))}
          style={{ marginBottom: 14 }}
        />

        <Tabs
          activeKey={activePanel}
          onChange={(key) => setActivePanel(key as SecondaryPanelKey)}
          items={[
            {
              key: 'groups',
              label: '合并组列表',
              children: (
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Alert
                    type="warning"
                    showIcon
                    message="这里仅显示已审批并正式建档的合并组"
                    description={`当前已审批正式合并组 ${filteredGroups.length} 个。待审批建议只在“聚合整理”中处理，在审批通过前不会出现在这里，也不会进入仪器管理列表。`}
                  />
                  <Table
                    columns={groupColumns}
                    dataSource={managedRows}
                    rowKey="key"
                    loading={loading}
                    locale={{ emptyText: <Empty description="暂无正式合并组" /> }}
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                    size="middle"
                  />
                </Space>
              ),
            },
            {
              key: 'suggestions',
              label: (
                <span>
                  聚合整理
                  <Badge
                    count={suggestionFlow.analysis.addToExisting.length + suggestionFlow.analysis.createNew.length}
                    offset={[8, 0]}
                    size="small"
                    style={{ marginInlineStart: 6 }}
                  />
                </span>
              ),
              children: renderSuggestionPanel(),
            },
            ...(isStandardMaterialTab
              ? [
                  {
                    key: 'sets',
                    label: (
                      <span>
                        套系整理
                        <Badge
                          count={visibleSetCollections.length}
                          offset={[8, 0]}
                          size="small"
                          style={{ marginInlineStart: 6 }}
                        />
                      </span>
                    ),
                    children: renderSetPanel(),
                  },
                ]
              : []),
          ]}
        />
      </Drawer>

      {groupEditorVisible && groupEditorEntity && (
        <EditGroupModal
          visible={groupEditorVisible}
          onClose={() => {
            setGroupEditorVisible(false);
            setEditingGroup(null);
            setGroupEditorEntity(null);
            setMergeSetSourceRows([]);
          }}
          typeName={activeTab}
          title={editingGroup ? '编辑合并组' : '手动创建合并组'}
          initial={{
            name: groupEditorEntity.name,
            model: groupEditorEntity.model,
            measureRange: groupEditorEntity.range || '',
          }}
          existingGroupId={editingGroup?.id || null}
          availableInstruments={workbench.singlesList}
          members={groupEditorEntity.list}
          mode="drawer"
          beforeSave={async () => {
            if (editingGroup) return true;

            if (mergeSetSourceRows.length > 0) {
              const conflictGroups = Array.from(
                new Map(
                  mergeSetSourceRows
                    .flatMap((item) => item.members)
                    .filter((item) => item.mergeGroupId)
                    .map((item) => [
                      String(item.mergeGroupId),
                      {
                        id: String(item.mergeGroupId),
                        name: String(item.mergeGroupName || '未命名合并组'),
                      },
                    ]),
                ).values(),
              );

              if (conflictGroups.length > 0) {
                const confirmed = await new Promise<boolean>((resolve) => {
                  modal.confirm({
                    title: '检测到套系成员已属于其他合并组',
                    content: `本次选中的套系成员当前关联 ${conflictGroups.length} 个合并组：${conflictGroups
                      .map((item) => item.name)
                      .join('、')}。继续保存会把这些成员迁移到新的合并组。`,
                    okText: '确认迁移',
                    cancelText: '取消',
                    onOk: async () => resolve(true),
                    onCancel: async () => resolve(false),
                  });
                });
                if (!confirmed) return false;
              }
            }

            return requestCreateApproval(`手动创建${activeTypeLabel}合并组`);
          }}
          onSaved={async () => {
            setEditingGroup(null);
            setSelectedSetKeys([]);
            setMergeSetSourceRows([]);
            await fetchGroups();
            await suggestionFlow.refresh();
            onSuccess?.();
          }}
        />
      )}

      {suggestionEditorVisible && suggestionEditorEntity && currentCreateIndex !== null && (
        <EditGroupModal
          visible={suggestionEditorVisible}
          onClose={() => {
            setSuggestionEditorVisible(false);
            setSuggestionEditorEntity(null);
            setCurrentCreateIndex(null);
          }}
          typeName={activeTab}
          mode="drawer"
          title="审批创建新合并组"
          saveText="审批创建"
          initial={{
            name: suggestionEditorEntity.name,
            model: suggestionEditorEntity.model,
            measureRange: suggestionEditorEntity.range || '',
          }}
          availableInstruments={workbench.singlesList}
          members={suggestionEditorEntity.list}
          beforeSave={() => requestCreateApproval(`通过聚合整理创建${activeTypeLabel}合并组`)}
          onSaved={async () => {
            setSuggestionEditorVisible(false);
            setSuggestionEditorEntity(null);
            setCurrentCreateIndex(null);
            await fetchGroups();
            await suggestionFlow.refresh();
            onSuccess?.();
          }}
        />
      )}
    </>
  );
};

export default MergeGroupManagementModal;
