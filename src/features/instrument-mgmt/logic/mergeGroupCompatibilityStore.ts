import type { MergeGroupDefinition } from '../domain/mergeGroupTypes';

const GROUP_DEFS_KEY = 'instrumentGroupDefs';
const RECENTLY_UNGROUPED_KEY = 'instrumentRecentlyUngroupedIds';
const HIDDEN_AUTO_GROUP_KEY = 'instrumentAutoGroupHidden';

export const readGroupDefinitions = () => {
  try {
    const raw = localStorage.getItem(GROUP_DEFS_KEY);
    return raw ? (JSON.parse(raw) as MergeGroupDefinition[]) : [];
  } catch {
    return [] as MergeGroupDefinition[];
  }
};

export const upsertGroupDefinition = (
  definition: MergeGroupDefinition,
  previous?: { name: string; model: string },
) => {
  try {
    const definitions = readGroupDefinitions();
    const filtered = previous
      ? definitions.filter(
          (item) =>
            !(
              item.type === definition.type &&
              item.name === previous.name &&
              item.model === previous.model
            ),
        )
      : definitions;

    const existingIndex = filtered.findIndex(
      (item) =>
        item.type === definition.type &&
        item.name === definition.name &&
        item.model === definition.model,
    );

    if (existingIndex >= 0) {
      filtered[existingIndex] = definition;
    } else {
      filtered.push(definition);
    }

    localStorage.setItem(GROUP_DEFS_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
};

export const readRecentlyUngroupedIds = (typeName: string) => {
  try {
    const raw = localStorage.getItem(RECENTLY_UNGROUPED_KEY);
    const bag: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    return Array.isArray(bag[typeName]) ? bag[typeName] : [];
  } catch {
    return [] as string[];
  }
};

export const appendRecentlyUngroupedIds = (typeName: string, ids: string[]) => {
  try {
    const raw = localStorage.getItem(RECENTLY_UNGROUPED_KEY);
    const bag: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const current = Array.isArray(bag[typeName]) ? bag[typeName] : [];
    bag[typeName] = Array.from(new Set(current.concat(ids.map(String))));
    localStorage.setItem(RECENTLY_UNGROUPED_KEY, JSON.stringify(bag));
    return true;
  } catch {
    return false;
  }
};

export const removeRecentlyUngroupedIds = (typeName: string | undefined, ids: string[]) => {
  if (!typeName) return;

  try {
    const raw = localStorage.getItem(RECENTLY_UNGROUPED_KEY);
    if (!raw) return;
    const bag: Record<string, string[]> = JSON.parse(raw);
    const current = Array.isArray(bag[typeName]) ? bag[typeName] : [];
    const targetIds = new Set(ids.map(String));
    bag[typeName] = current.filter((id) => !targetIds.has(String(id)));
    localStorage.setItem(RECENTLY_UNGROUPED_KEY, JSON.stringify(bag));
  } catch {
    // ignore storage failure
  }
};

export const readHiddenAutoGroupKeys = (typeName: string) => {
  try {
    const raw = localStorage.getItem(HIDDEN_AUTO_GROUP_KEY);
    const items: Array<{ type: string; key: string }> = raw ? JSON.parse(raw) : [];
    return new Set(items.filter((item) => item.type === typeName).map((item) => item.key));
  } catch {
    return new Set<string>();
  }
};
