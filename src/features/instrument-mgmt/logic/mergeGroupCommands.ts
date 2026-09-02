import type { MergeGroup } from '../services/mergeGroupService';
import { mergeGroupService } from '../services/mergeGroupService';
import { updateInstrument } from '../services/instrumentService';
import type { SaveGroupDraftInput, SaveGroupDraftResult } from '../domain/mergeGroupTypes';
import {
  appendRecentlyUngroupedIds,
  upsertGroupDefinition,
} from './mergeGroupCompatibilityStore';

export const fetchMergeGroups = async (searchText?: string) => {
  const response = await mergeGroupService.getGroups(searchText);
  return response.data || [];
};

export const fetchMergeGroupDetail = async (record: MergeGroup) => {
  const response = await mergeGroupService.getGroupById(record.id);
  return response.success && response.data ? response.data : record;
};

export const createMergeGroup = async (values: Record<string, unknown>, activeTab: string) =>
  mergeGroupService.createGroup({ ...values, name: String(values.name || ''), type: activeTab });

export const updateMergeGroup = async (
  id: string,
  values: Record<string, unknown>,
  activeTab: string,
) => mergeGroupService.updateGroup(id, { ...values, type: activeTab });

export const saveMergeGroupEntity = async ({
  activeTab,
  editingGroup,
  values,
}: {
  activeTab: string;
  editingGroup: MergeGroup | null;
  values: Record<string, unknown>;
}) => {
  if (editingGroup) {
    return updateMergeGroup(editingGroup.id, values, activeTab);
  }

  return createMergeGroup(values, activeTab);
};

export const deleteMergeGroup = async (id: string) => {
  try {
    const detail = await mergeGroupService.getGroupById(id);
    if (detail.success && detail.data?.members?.length) {
      await Promise.allSettled(
        detail.data.members.map((member) => mergeGroupService.removeMember(id, String(member.id))),
      );
    }
  } catch {
    // ignore and still try to delete group itself
  }

  return mergeGroupService.deleteGroup(id);
};

export const syncLegacyMergeGroups = async () => mergeGroupService.syncLegacyGroups();

export const cleanupEmptyMergeGroups = async (groups: MergeGroup[]) =>
  Promise.allSettled(groups.map((group) => deleteMergeGroup(group.id)));

const removeMembersFromGroup = async (removedMembers: SaveGroupDraftInput['members']) => {
  let removedCount = 0;

  for (const member of removedMembers) {
    try {
      let success = false;

      if (member.mergeGroupId) {
        try {
          await mergeGroupService.removeMember(member.mergeGroupId, String(member.id));
          success = true;
        } catch {
          // fallback to direct instrument update below
        }
      }

      if (!success) {
        const response = await updateInstrument(String(member.id), {
          type: member.type,
          mergeGroupId: null as any,
          mergeGroupName: '',
          mergeGroupModel: '',
          mergeGroupMeasurementRange: '',
        });

        success = response.success;
      }

      if (success) {
        removedCount += 1;
      }
    } catch {
      // ignore single member failure
    }
  }

  return removedCount;
};

const syncMembersToGroup = async ({
  existingGroupId,
  members,
  values,
}: {
  existingGroupId?: string | null;
  members: SaveGroupDraftInput['members'];
  values: SaveGroupDraftInput['nextValues'];
}) => {
  let keptCount = 0;

  for (const member of members) {
    try {
      let success = false;

      if (existingGroupId && member.mergeGroupId !== existingGroupId) {
        try {
          if (member.mergeGroupId) {
            await mergeGroupService.removeMember(member.mergeGroupId, String(member.id));
          }
          await mergeGroupService.addMember(existingGroupId, String(member.id));
          success = true;
        } catch {
          // fallback to direct update below
        }
      }

      const response = await updateInstrument(String(member.id), {
        type: member.type,
        mergeGroupId: existingGroupId || member.mergeGroupId || undefined,
        mergeGroupName: values.name,
        mergeGroupModel: values.model,
        mergeGroupMeasurementRange: values.measureRange,
        groupName: member.groupName || '',
        groupModel: member.groupModel || '',
        groupMeasureRange: member.groupMeasureRange || '',
        groupSerialNumber: member.groupSerialNumber || '',
      });

      if (response.success || success) {
        keptCount += 1;
      }
    } catch {
      // ignore single member failure
    }
  }

  return keptCount;
};

export const saveMergeGroupDraft = async (
  input: SaveGroupDraftInput,
): Promise<SaveGroupDraftResult> => {
  const {
    existingGroupId,
    typeName,
    initial,
    members,
    nextMembers,
    nextValues,
  } = input;

  if (nextMembers.length < 2) {
    throw new Error('手动创建或编辑合并组时，至少需要选择两条仪器数据');
  }

  const savedDefinition = upsertGroupDefinition(
    {
      type: typeName,
      name: nextValues.name.trim(),
      model: nextValues.model.trim(),
      measureRange: nextValues.measureRange.trim(),
    },
    { name: initial.name, model: initial.model },
  );

  if (!savedDefinition) {
    throw new Error('保存组定义失败');
  }

  const nextMemberIds = new Set(nextMembers.map((member) => String(member.id)));
  const removedMembers = members.filter((member) => !nextMemberIds.has(String(member.id)));
  const keptMembers = nextMembers;

  let groupId = existingGroupId || members.find((member) => member.mergeGroupId)?.mergeGroupId || null;

  if (groupId) {
    await mergeGroupService.updateGroup(groupId, {
      name: nextValues.name.trim(),
      model: nextValues.model.trim(),
      measurementRange: nextValues.measureRange.trim(),
      type: typeName,
    });
  } else {
    const createResponse = await mergeGroupService.createGroup({
      name: nextValues.name.trim(),
      model: nextValues.model.trim(),
      measurementRange: nextValues.measureRange.trim(),
      type: typeName,
    });

    if (!createResponse.success || !createResponse.data?.id) {
      throw new Error(createResponse.message || '创建合并组失败');
    }

    groupId = createResponse.data.id;
  }

  const removed = await removeMembersFromGroup(removedMembers);
  const kept = await syncMembersToGroup({
    existingGroupId: groupId,
    members: keptMembers,
    values: nextValues,
  });

  if (removedMembers.length > 0) {
    appendRecentlyUngroupedIds(
      typeName,
      removedMembers.map((member) => String(member.id)),
    );
  }

  return { kept, removed };
};
