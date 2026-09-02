import { useEffect, useMemo, useState } from 'react';
import type { MergeSuggestion } from '../services/mergeGroupService';
import * as instrumentService from '../services/instrumentService';
import { analyzeMergeSuggestions } from '../logic/mergeSuggestionAnalyzer';
import { buildMergeExecutionDraft } from '../logic/mergeSuggestionReview';
import {
  executeMergeDraft,
  resolveGroupAlertSettings,
} from '../logic/mergeSuggestionExecutor';
import type { MergeExecutionResult } from '../domain/mergeSuggestionTypes';
import type { Instrument } from '../types';

type AlertSyncSettings = {
  alertMode?: string;
  alertLevel?: string;
};

type CheckAndSync = (
  targetSettings: AlertSyncSettings,
  instruments: Instrument[],
  onSync: (syncSettings?: AlertSyncSettings) => Promise<void>,
) => Promise<void>;

export const useMergeSuggestionFlow = ({
  checkAndSync,
  filterType,
  onFetchSuggestions,
}: {
  checkAndSync: CheckAndSync;
  filterType?: string;
  onFetchSuggestions: (filterType?: string) => Promise<MergeSuggestion | null>;
}) => {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rawSuggestions, setRawSuggestions] = useState<MergeSuggestion | null>(null);
  const [selectedAdditions, setSelectedAdditions] = useState<Map<string, Set<string>>>(new Map());
  const [selectedCreateNew, setSelectedCreateNew] = useState<Map<number, Set<string>>>(new Map());
  const [instrumentMap, setInstrumentMap] = useState<Map<string, Instrument>>(new Map());
  const [newGroupSettingsByIndex, setNewGroupSettingsByIndex] = useState<Record<number, Record<string, any>>>({});
  const [lastResult, setLastResult] = useState<MergeExecutionResult | null>(null);

  const analysis = useMemo(() => analyzeMergeSuggestions(rawSuggestions), [rawSuggestions]);

  const draft = useMemo(
    () =>
      buildMergeExecutionDraft({
        analysis,
        instrumentMap,
        selectedAdditions,
        selectedCreateNew,
      }),
    [analysis, instrumentMap, selectedAdditions, selectedCreateNew],
  );

  const primeInstrumentMap = async (suggestions: MergeSuggestion | null) => {
    if (!suggestions) {
      setInstrumentMap(new Map());
      return;
    }

    const ids = new Set<string>();
    suggestions.addToExisting.forEach((item) =>
      item.candidates.forEach((candidate) => ids.add(candidate.id)),
    );
    suggestions.createNew.forEach((item) =>
      item.candidates.forEach((candidate) => ids.add(candidate.id)),
    );

    const results = await Promise.allSettled(
      Array.from(ids).map((id) => instrumentService.getInstrumentById(id)),
    );

    const nextMap = new Map<string, Instrument>();
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success && result.value.data) {
        nextMap.set(String(result.value.data.id), result.value.data);
      }
    });

    setInstrumentMap(nextMap);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const nextSuggestions = await onFetchSuggestions(filterType);
      setRawSuggestions(nextSuggestions);
      setSelectedAdditions(new Map());
      setSelectedCreateNew(new Map());
      setNewGroupSettingsByIndex({});
      setLastResult(null);
      await primeInstrumentMap(nextSuggestions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!filterType) {
      setRawSuggestions(null);
      setInstrumentMap(new Map());
      return;
    }
    refresh();
  }, [filterType]);

  const updateExistingSelection = (groupId: string, selectedRowKeys: React.Key[]) => {
    setSelectedAdditions((prev) => {
      const next = new Map(prev);
      next.set(groupId, new Set(selectedRowKeys as string[]));
      return next;
    });
  };

  const updateNewGroupSelection = (index: number, selectedRowKeys: React.Key[]) => {
    setSelectedCreateNew((prev) => {
      const next = new Map(prev);
      next.set(index, new Set(selectedRowKeys as string[]));
      return next;
    });
  };

  const prepareNewGroupDefaults = async (index: number) => {
    const item = draft.newGroupItems[index];
    if (!item) return null;

    return {
      name: item.suggestedName,
      model: item.suggestedModel,
      measurementRange: item.suggestedRange,
    };
  };

  const execute = async () => {
    setProcessing(true);
    try {
      const result = await executeMergeDraft({
        checkAndSync,
        draft,
        filterType,
        newGroupSettingsByIndex,
      });
      setLastResult(result);
      return result;
    } finally {
      setProcessing(false);
    }
  };

  const executeExistingOnly = async () => {
    setProcessing(true);
    try {
      const result = await executeMergeDraft({
        checkAndSync,
        draft: {
          existingGroupItems: draft.existingGroupItems,
          newGroupItems: [],
        },
        filterType,
      });
      setLastResult(result);
      return result;
    } finally {
      setProcessing(false);
    }
  };

  const executeSingleNewGroup = async (index: number, values: Record<string, any>) => {
    const item = draft.newGroupItems[index];
    if (!item) {
      return null;
    }

    setProcessing(true);
    try {
      const result = await executeMergeDraft({
        checkAndSync,
        draft: {
          existingGroupItems: [],
          newGroupItems: [item],
        },
        filterType,
        newGroupSettingsByIndex: {
          0: values,
        },
      });
      setLastResult(result);
      return result;
    } finally {
      setProcessing(false);
    }
  };

  const setNewGroupSettings = (index: number, values: Record<string, any>) => {
    setNewGroupSettingsByIndex((prev) => ({
      ...prev,
      [index]: values,
    }));
  };

  return {
    analysis,
    draft,
    execute,
    executeExistingOnly,
    executeSingleNewGroup,
    lastResult,
    loading,
    prepareNewGroupDefaults,
    processing,
    refresh,
    resolveGroupAlertSettings,
    selectedAdditions,
    selectedCreateNew,
    setNewGroupSettings,
    updateExistingSelection,
    updateNewGroupSelection,
  };
};
