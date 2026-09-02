import type { Instrument } from '../types';
import type {
  MergeExecutionDraft,
  MergeSuggestionAnalysis,
  NewGroupExecutionItem,
} from '../domain/mergeSuggestionTypes';

const selectIds = (
  selectedSet: Set<string> | undefined,
  candidates: Array<{ id: string }>,
) => {
  if (selectedSet && selectedSet.size > 0) {
    return Array.from(selectedSet);
  }

  return candidates.map((candidate) => candidate.id);
};

export const buildMergeExecutionDraft = ({
  analysis,
  instrumentMap,
  selectedAdditions,
  selectedCreateNew,
}: {
  analysis: MergeSuggestionAnalysis;
  instrumentMap: Map<string, Instrument>;
  selectedAdditions: Map<string, Set<string>>;
  selectedCreateNew: Map<number, Set<string>>;
}): MergeExecutionDraft => {
  const existingGroupItems = analysis.addToExisting.map((item) => ({
    groupId: item.groupId,
    groupName: item.groupName,
    candidateIds: selectIds(selectedAdditions.get(item.groupId), item.candidates),
    instruments: selectIds(selectedAdditions.get(item.groupId), item.candidates)
      .map((id) => instrumentMap.get(id))
      .filter((instrument): instrument is Instrument => Boolean(instrument)),
  }));

  const newGroupItems: NewGroupExecutionItem[] = analysis.createNew.map((item, index) => {
    const candidateIds = selectIds(selectedCreateNew.get(index), item.candidates);
    const instruments = candidateIds
      .map((id) => instrumentMap.get(id))
      .filter((instrument): instrument is Instrument => Boolean(instrument));

      return {
        suggestedName: item.suggestedName,
        suggestedModel: item.suggestedModel,
        suggestedRange: item.suggestedRange,
        candidateIds,
        instruments,
      };
  });

  return {
    existingGroupItems,
    newGroupItems,
  };
};
