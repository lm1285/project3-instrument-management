import { createPersistentStore, useStore } from '../../../hooks/useStore';
import { SystemSettings } from '../../../types/common';
import { loadEffectiveSettings, saveSettings } from '../services/systemSettingsService';
import debounce from 'lodash/debounce';
import { applyThemeSettings } from '../../../utils/theme/applyThemeSettings';

const defaultSettings: SystemSettings = {
  theme: {
    mode: 'light',
    background: '#f8fafc',
    cardBackground: '#ffffff',
    textPrimary: '#1a202c',
    textSecondary: '#4a5568',
    borderColor: '#e2e8f0',
    primaryColor: '#1976d2',
    infoColor: '#1976d2',
    successColor: '#52c41a',
    warningColor: '#faad14',
    errorColor: '#ff4d4f',
    customBorderRadius: 12,
    grayMode: false,
    colorWeak: false,
    enableAnimation: true
  },
  typography: {
    fontFamily: "'Times New Roman', 'SimSun', 'Songti SC', serif",
    baseFontSize: '16px',
    lineHeight: '1.6'
  },
  darkMode: false,
  layout: {
    borderRadius: 'md',
    shadow: 'sm',
    density: 'standard'
  },
  table: {
    rowHeight: 47,
    pageSize: 20,
    dateFormat: 'YYYY-MM-DD'
  },
  numberFormat: {
    thousandSeparator: true,
    decimals: 2
  },
  localization: {
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h'
  },
  personalization: {
    workbench: {
      showHomeModule: true,
      shortcutSorting: [],
      topFunctions: [],
      dashboardLayout: {},
      moduleSorting: ['dashboard', 'schedule', 'instrumentFlow', 'instrumentMgmt', 'statistics'],
      statisticsSorting: ['instrumentStats', 'usageConsumption'],
    },
    listView: {
      defaultPageSize: 20,
      defaultVisibleColumns: []
    }
  },
  maintenance: {
    cache: {
      enableCache: true,
      autoClean: false,
      cleanInterval: 24,
      enableWarming: false,
      warmingStrategies: [],
      distributed: {
        enabled: false,
        nodes: [],
        strategy: 'round-robin'
      }
    },
    database: {
      connectionPool: {
        minSize: 5,
        maxSize: 20,
        idleTimeout: 30000
      },
      slowQuery: {
        enabled: false,
        threshold: 1000,
        logFile: '/var/log/slow-query.log'
      },
      indexOptimization: {
        autoAnalyze: true,
        recommendations: true
      }
    },
    optimization: {
      imageCompression: {
        enabled: true,
        quality: 80,
        format: 'original'
      },
      cdn: {
        enabled: false,
        domain: '',
        versionControl: true
      },
      pageLoad: {
        lazyLoad: true,
        prefetch: false,
        minify: true
      }
    }
  },
  tableConfigs: {},
  backup: {
    strategy: 'manual',
    autoBackupDays: 7,
    manualBackupSuggestedDays: 7,
    retentionDays: 30,
    maxBackupCount: 30,
  }
};

const store = createPersistentStore<SystemSettings>(defaultSettings, 'system_settings');

function apply(settings: SystemSettings) {
  applyThemeSettings(settings);
}

// Debounced auto-save function
const debouncedSave = debounce((settings: SystemSettings) => {
  saveSettings(settings).catch(err => console.error('Auto-save settings failed:', err));
}, 2000);

store.subscribe(apply);
store.subscribe((settings) => {
  debouncedSave(settings);
});

export function useSystemSettings() {
  return useStore(store);
}

export function initApplySystemSettings() {
  const s = store.getState();
  apply(s);
  loadEffectiveSettings().then((server) => {
    console.log('[SystemSettings] Loaded from server:', server);
    if (server) {
      // Deep merge server settings into current state to preserve defaults
      const current = store.getState();
      
      console.log('[SystemSettings] Merging with local deepMerge');
      try {
        let merged = deepMerge(current, server);
        
        console.log('[SystemSettings] Merged result:', merged);
        store.setState(merged);
        apply(merged);
      } catch (e) {
        console.error('[SystemSettings] Merge failed:', e);
      }
    } else {
       console.log('[SystemSettings] No settings from server');
    }
  }).catch((err) => {
     console.error('[SystemSettings] Load failed:', err);
  });
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

export default useSystemSettings;
