import { App } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { SystemMaintenanceSettings, SystemSettings } from '../../../types/common';
import { analyzeDatabase, clearCache } from '../services/maintenanceService';
import { loadGlobalSettings, saveGlobalSettings } from '../services/systemSettingsService';
import { defaultMaintenanceSettings, mergeMaintenanceSettings } from '../components/SystemConfig/systemMaintenanceConfig';

export function useSystemMaintenanceManager() {
  const { message } = App.useApp();
  const [maintenance, setMaintenance] = useState<SystemMaintenanceSettings>(defaultMaintenanceSettings);
  const [saving, setSaving] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const settings = await loadGlobalSettings();
      setMaintenance(mergeMaintenanceSettings(settings?.maintenance));
    } catch (error) {
      message.error('加载维护配置失败');
    }
  }, [message]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);

    try {
      const currentGlobal = (await loadGlobalSettings()) || ({} as SystemSettings);
      const success = await saveGlobalSettings({
        ...currentGlobal,
        maintenance,
      });

      if (success) {
        message.success('系统维护配置已保存');
      } else {
        message.error('保存维护配置失败');
      }
    } catch (error) {
      message.error('保存维护配置失败');
    } finally {
      setSaving(false);
    }
  }, [maintenance, message]);

  const updateSettings = useCallback((section: keyof SystemMaintenanceSettings, key: string, value: any) => {
    setMaintenance((previousMaintenance) => {
      const nextMaintenance = { ...previousMaintenance };
      const sectionData = { ...nextMaintenance[section] } as any;
      const keys = key.split('.');

      if (keys.length === 1) {
        sectionData[keys[0]] = value;
      } else if (keys.length === 2) {
        sectionData[keys[0]] = {
          ...sectionData[keys[0]],
          [keys[1]]: value,
        };
      }

      nextMaintenance[section] = sectionData;
      return nextMaintenance;
    });
  }, []);

  const handleCleanCache = useCallback(async () => {
    const hide = message.loading('正在清理缓存...', 0);

    try {
      await clearCache();
      message.success('缓存清理完成');
    } catch (error) {
      message.error('缓存清理失败');
    } finally {
      hide();
    }
  }, [message]);

  const handleAnalyzeIndex = useCallback(async () => {
    const hide = message.loading('正在分析索引...', 0);

    try {
      await analyzeDatabase();
      message.success('数据库优化完成');
    } catch (error) {
      message.error('数据库优化失败');
    } finally {
      hide();
    }
  }, [message]);

  return {
    maintenance,
    saving,
    isAdvancedMode,
    setIsAdvancedMode,
    handleSaveSettings,
    updateSettings,
    handleCleanCache,
    handleAnalyzeIndex,
  };
}
