import type { MergeSuggestion } from '../services/mergeGroupService';
import type {
  ExistingGroupSuggestionView,
  MergeSuggestionAnalysis,
  NewGroupSuggestionView,
} from '../domain/mergeSuggestionTypes';

const buildExistingReason = (groupName: string) => `候选仪器与现有合并组“${groupName}”的名称、型号或量程特征接近`;

const buildNewReason = (name: string) => `候选仪器形成了稳定的聚合簇，适合新建“${name}”合并组`;

export const analyzeMergeSuggestions = (
  suggestions: MergeSuggestion | null,
): MergeSuggestionAnalysis => {
  if (!suggestions) {
    return {
      addToExisting: [],
      createNew: [],
    };
  }

  const addToExisting: ExistingGroupSuggestionView[] = suggestions.addToExisting.map((item) => ({
    kind: 'existing',
    groupId: item.targetGroup.id,
    groupName: item.targetGroup.name,
    groupModel: item.targetGroup.model,
    groupRange: item.targetGroup.measurementRange,
    reason: buildExistingReason(item.targetGroup.name),
    candidates: item.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      model: candidate.model,
      managementNumber: candidate.managementNumber,
      measurementRange: candidate.measurementRange,
    })),
  }));

  const createNew: NewGroupSuggestionView[] = suggestions.createNew.map((item) => ({
    kind: 'new',
    suggestedName: item.suggestedName,
    suggestedModel: item.suggestedModel,
    suggestedRange: item.suggestedRange,
    reason: buildNewReason(item.suggestedName),
    candidates: item.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      model: candidate.model,
      managementNumber: candidate.managementNumber,
      measurementRange: candidate.measurementRange,
    })),
  }));

  return {
    addToExisting,
    createNew,
  };
};
