import type { Instrument } from '../types';

export interface MergeSuggestionCandidateView {
  id: string;
  name: string;
  model: string;
  managementNumber: string;
  measurementRange: string;
}

export interface ExistingGroupSuggestionView {
  kind: 'existing';
  groupId: string;
  groupName: string;
  groupModel: string;
  groupRange: string;
  reason: string;
  candidates: MergeSuggestionCandidateView[];
}

export interface NewGroupSuggestionView {
  kind: 'new';
  suggestedName: string;
  suggestedModel: string;
  suggestedRange: string;
  reason: string;
  candidates: MergeSuggestionCandidateView[];
}

export interface MergeSuggestionAnalysis {
  addToExisting: ExistingGroupSuggestionView[];
  createNew: NewGroupSuggestionView[];
}

export interface ExistingGroupExecutionItem {
  groupId: string;
  groupName: string;
  candidateIds: string[];
  instruments: Instrument[];
}

export interface NewGroupExecutionItem {
  suggestedName: string;
  suggestedModel: string;
  suggestedRange: string;
  candidateIds: string[];
  instruments: Instrument[];
}

export interface MergeExecutionDraft {
  existingGroupItems: ExistingGroupExecutionItem[];
  newGroupItems: NewGroupExecutionItem[];
}

export interface MergeExecutionResult {
  successCount: number;
  failedCount: number;
  createdGroups: number;
  processedInstrumentIds: string[];
}
