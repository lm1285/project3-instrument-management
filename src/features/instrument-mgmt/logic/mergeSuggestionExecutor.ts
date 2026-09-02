import type { Instrument } from '../types';
import { mergeGroupService } from '../services/mergeGroupService';
import { removeRecentlyUngroupedIds } from './mergeGroupCompatibilityStore';
import type {
  MergeExecutionDraft,
  MergeExecutionResult,
} from '../domain/mergeSuggestionTypes';

type AlertSyncSettings = {
  alertMode?: string;
  alertLevel?: string;
};

type CheckAndSync = (
  targetSettings: AlertSyncSettings,
  instruments: Instrument[],
  onSync: (syncSettings?: AlertSyncSettings) => Promise<void>,
) => Promise<void>;

const countSuggestedAlertValues = (instruments: Instrument[]) => {
  const levelCounts: Record<string, number> = {};
  const modeCounts: Record<string, number> = {};

  instruments.forEach((instrument) => {
    if (instrument.alertLevel) {
      levelCounts[instrument.alertLevel] = (levelCounts[instrument.alertLevel] || 0) + 1;
    }

    if (instrument.alertMode) {
      modeCounts[instrument.alertMode] = (modeCounts[instrument.alertMode] || 0) + 1;
    }
  });

  return {
    suggestedAlertLevel: Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
    suggestedAlertMode: Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0],
  };
};

export const resolveGroupAlertSettings = async (groupId: string) => {
  try {
    const response = await mergeGroupService.getGroupById(groupId);
    if (response.success && response.data) {
      return {
        alertMode: response.data.alertMode,
        alertLevel: response.data.alertLevel,
      };
    }
  } catch {
    // ignore
  }

  return {};
};

export const executeMergeDraft = async ({
  checkAndSync,
  draft,
  filterType,
  newGroupSettingsByIndex,
}: {
  checkAndSync: CheckAndSync;
  draft: MergeExecutionDraft;
  filterType?: string;
  newGroupSettingsByIndex?: Record<number, Record<string, any>>;
}): Promise<MergeExecutionResult> => {
  let successCount = 0;
  let failedCount = 0;
  let createdGroups = 0;
  const processedInstrumentIds: string[] = [];

  for (const item of draft.existingGroupItems) {
    const groupSettings = await resolveGroupAlertSettings(item.groupId);

    await checkAndSync(groupSettings, item.instruments, async (syncSettings) => {
      const results = await Promise.allSettled(
        item.candidateIds.map((instrumentId) =>
          mergeGroupService.addMember(item.groupId, instrumentId, syncSettings),
        ),
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount += 1;
          processedInstrumentIds.push(item.candidateIds[index]);
        } else {
          failedCount += 1;
        }
      });
    });
  }

  for (let index = 0; index < draft.newGroupItems.length; index += 1) {
    const item = draft.newGroupItems[index];
    if (item.candidateIds.length < 2) {
      failedCount += item.candidateIds.length;
      continue;
    }
    const suggestedAlerts = countSuggestedAlertValues(item.instruments);
    const overrideSettings = newGroupSettingsByIndex?.[index] || {};

    await checkAndSync(
      {
        alertMode: overrideSettings.alertMode || suggestedAlerts.suggestedAlertMode,
        alertLevel: overrideSettings.alertLevel || suggestedAlerts.suggestedAlertLevel,
      },
      item.instruments,
      async (syncSettings) => {
        const response = await mergeGroupService.createGroup({
          name: overrideSettings.name || item.suggestedName,
          model: overrideSettings.model || item.suggestedModel,
          measurementRange: overrideSettings.measurementRange || item.suggestedRange,
          type: filterType || '标准器',
          alertMode: overrideSettings.alertMode || suggestedAlerts.suggestedAlertMode,
          alertLevel: overrideSettings.alertLevel || suggestedAlerts.suggestedAlertLevel,
        });

        if (!response.success || !response.data) {
          failedCount += item.candidateIds.length;
          return;
        }

        createdGroups += 1;

        const results = await Promise.allSettled(
          item.candidateIds.map((instrumentId) =>
            mergeGroupService.addMember(response.data!.id, instrumentId, syncSettings),
          ),
        );

        results.forEach((result, resultIndex) => {
          if (result.status === 'fulfilled') {
            successCount += 1;
            processedInstrumentIds.push(item.candidateIds[resultIndex]);
          } else {
            failedCount += 1;
          }
        });
      },
    );
  }

  removeRecentlyUngroupedIds(filterType, processedInstrumentIds);

  return {
    successCount,
    failedCount,
    createdGroups,
    processedInstrumentIds,
  };
};
