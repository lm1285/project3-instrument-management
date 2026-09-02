import { SystemSettings } from '../../../types/common';
import apiClient from '../../../services/apiClient';

const KEY = 'system_settings';

export async function loadSettings(): Promise<SystemSettings | null> {
  try {
    const v = localStorage.getItem(KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function saveSettings(settings: SystemSettings): Promise<boolean> {
  try {
    // console.log('[SettingsService] Saving settings:', settings);
    localStorage.setItem(KEY, JSON.stringify(settings));
    try {
      await apiClient.put('/settings', settings);
      // console.log('[SettingsService] Remote save success');
      return true;
    } catch (e) {
      // console.error('[SettingsService] Remote save failed:', e);
      return false;
    }
  } catch {
    return false;
  }
}

export async function loadEffectiveSettings(): Promise<SystemSettings | null> {
  try {
    console.log('[SystemSettings] Loading effective settings...');
    const res = await apiClient.get<SystemSettings>('/settings', {
      disableCache: true,
      params: { _t: Date.now() }
    });
    if (res.success) {
      console.log('[SystemSettings] Loaded:', res.data);
      return res.data || null;
    }
    return null;
  } catch (e: any) {
    if (e?.statusCode === 401) {
      console.log('[SystemSettings] Load skipped: unauthorized');
      return null;
    }
    console.error('[SystemSettings] Load failed:', e);
    return null;
  }
}

export async function saveGlobalSettings(settings: SystemSettings): Promise<boolean> {
  try {
    const res = await apiClient.put('/settings/global', settings);
    return !!res.success;
  } catch { return false; }
}

export async function loadGlobalSettings(): Promise<SystemSettings | null> {
  try {
    const res = await apiClient.get<SystemSettings>('/settings/global');
    return res.success ? (res.data || null) : null;
  } catch { return null; }
}
