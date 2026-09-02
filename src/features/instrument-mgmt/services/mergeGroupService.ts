import apiClient from '../../../services/apiClient';

export interface MergeGroupMember {
  id: string;
  name: string;
  model: string;
  managementNumber: string;
  measurementRange: string;
}

export interface MergeGroup {
  id: string;
  name: string;
  model?: string;
  measurementRange?: string;
  description?: string;
  type?: string;
  alertLevel?: string;
  alertMode?: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  members?: MergeGroupMember[];
}

export interface MergeCandidate {
  id: string;
  name: string;
  model: string;
  managementNumber: string;
  measurementRange: string;
}

export interface MergeSuggestion {
  addToExisting: Array<{
    targetGroup: { id: string; name: string; model: string; measurementRange: string };
    candidates: MergeCandidate[];
  }>;
  createNew: Array<{
    suggestedName: string;
    suggestedModel: string;
    suggestedRange: string;
    candidates: MergeCandidate[];
  }>;
}

export interface CreateGroupParams {
  name: string;
  model?: string;
  measurementRange?: string;
  description?: string;
  type?: string;
  alertLevel?: string;
  alertMode?: string;
}

export interface UpdateGroupParams extends Partial<CreateGroupParams> {}

export const mergeGroupService = {
  /**
   * 获取合并组列表
   */
  async getGroups(search?: string) {
    const response = await apiClient.get<MergeGroup[]>('/merge-groups', {
      params: {
        search,
        _t: Date.now(), // Prevent caching
      },
    });
    return response;
  },

  /**
   * 获取智能合并建议
   */
  async getSuggestions(type?: string) {
    const response = await apiClient.get<MergeSuggestion>('/merge-groups/suggestions', {
      params: {
        type,
        _t: Date.now(),
      },
    });
    return response;
  },

  /**
   * 获取合并组详情
   */
  async getGroupById(id: string) {
    const response = await apiClient.get<MergeGroup>(`/merge-groups/${id}`);
    return response;
  },

  /**
   * 创建合并组
   */
  async createGroup(data: CreateGroupParams) {
    const response = await apiClient.post<MergeGroup>('/merge-groups', data);
    return response;
  },

  /**
   * 更新合并组
   */
  async updateGroup(id: string, data: UpdateGroupParams) {
    const response = await apiClient.put<MergeGroup>(`/merge-groups/${id}`, data);
    return response;
  },

  /**
   * 删除合并组
   */
  async deleteGroup(id: string) {
    const response = await apiClient.delete<void>(`/merge-groups/${id}`);
    return response;
  },

  /**
   * 添加成员（Move In）
   */
  async addMember(
    groupId: string,
    instrumentId: string,
    syncAlerts?: { alertLevel?: string; alertMode?: string },
  ) {
    const response = await apiClient.post(`/merge-groups/${groupId}/members`, {
      instrumentId,
      syncAlerts,
    });
    return response;
  },

  /**
   * 移除成员（Move Out）
   */
  async removeMember(groupId: string, instrumentId: string) {
    const response = await apiClient.delete(
      `/merge-groups/${groupId}/members/${instrumentId}`,
    );
    return response;
  },

  /**
   * 同步旧版数据
   */
  async syncLegacyGroups() {
    const response = await apiClient.post('/merge-groups/sync', {});
    return response;
  },
};
