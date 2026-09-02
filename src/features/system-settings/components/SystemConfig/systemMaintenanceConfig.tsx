import { TabsProps } from 'antd';
import { DatabaseOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { SystemMaintenanceSettings } from '../../../../types/common';
import {
  CacheMaintenanceSection,
  DatabaseMaintenanceSection,
  OptimizationMaintenanceSection,
} from './systemMaintenanceSections';

export const defaultMaintenanceSettings: SystemMaintenanceSettings = {
  cache: {
    enableCache: true,
    autoClean: false,
    cleanInterval: 24,
    enableWarming: false,
    warmingStrategies: [],
    distributed: {
      enabled: false,
      nodes: [],
      strategy: 'round-robin',
    },
  },
  database: {
    connectionPool: {
      minSize: 5,
      maxSize: 20,
      idleTimeout: 30000,
    },
    slowQuery: {
      enabled: false,
      threshold: 1000,
      logFile: '/var/log/slow-query.log',
    },
    indexOptimization: {
      autoAnalyze: true,
      recommendations: true,
    },
  },
  optimization: {
    imageCompression: {
      enabled: true,
      quality: 80,
      format: 'original',
    },
    cdn: {
      enabled: false,
      domain: '',
      versionControl: true,
    },
    pageLoad: {
      lazyLoad: true,
      prefetch: false,
      minify: true,
    },
  },
};

export const mergeMaintenanceSettings = (
  loadedMaintenance?: Partial<SystemMaintenanceSettings>,
): SystemMaintenanceSettings => ({
  ...defaultMaintenanceSettings,
  ...loadedMaintenance,
  cache: {
    ...defaultMaintenanceSettings.cache,
    ...(loadedMaintenance?.cache || {}),
    distributed: {
      ...defaultMaintenanceSettings.cache.distributed,
      ...(loadedMaintenance?.cache?.distributed || {}),
    },
  },
  database: {
    ...defaultMaintenanceSettings.database,
    ...(loadedMaintenance?.database || {}),
    connectionPool: {
      ...defaultMaintenanceSettings.database.connectionPool,
      ...(loadedMaintenance?.database?.connectionPool || {}),
    },
    slowQuery: {
      ...defaultMaintenanceSettings.database.slowQuery,
      ...(loadedMaintenance?.database?.slowQuery || {}),
    },
    indexOptimization: {
      ...defaultMaintenanceSettings.database.indexOptimization,
      ...(loadedMaintenance?.database?.indexOptimization || {}),
    },
  },
  optimization: {
    ...defaultMaintenanceSettings.optimization,
    ...(loadedMaintenance?.optimization || {}),
    imageCompression: {
      ...defaultMaintenanceSettings.optimization.imageCompression,
      ...(loadedMaintenance?.optimization?.imageCompression || {}),
    },
    cdn: {
      ...defaultMaintenanceSettings.optimization.cdn,
      ...(loadedMaintenance?.optimization?.cdn || {}),
    },
    pageLoad: {
      ...defaultMaintenanceSettings.optimization.pageLoad,
      ...(loadedMaintenance?.optimization?.pageLoad || {}),
    },
  },
});

interface BuildSystemMaintenanceTabItemsOptions {
  maintenance: SystemMaintenanceSettings;
  updateSettings: (section: keyof SystemMaintenanceSettings, key: string, value: any) => void;
  onCleanCache: () => Promise<void>;
  onAnalyzeIndex: () => Promise<void>;
}

export const buildSystemMaintenanceTabItems = ({
  maintenance,
  updateSettings,
  onCleanCache,
  onAnalyzeIndex,
}: BuildSystemMaintenanceTabItemsOptions): TabsProps['items'] => [
  {
    key: 'cache',
    label: (
      <span>
        <ThunderboltOutlined />
        缓存管理
      </span>
    ),
    children: (
      <CacheMaintenanceSection maintenance={maintenance} updateSettings={updateSettings} onCleanCache={onCleanCache} />
    ),
  },
  {
    key: 'database',
    label: (
      <span>
        <DatabaseOutlined />
        数据库维护
      </span>
    ),
    children: (
      <DatabaseMaintenanceSection maintenance={maintenance} updateSettings={updateSettings} onAnalyzeIndex={onAnalyzeIndex} />
    ),
  },
  {
    key: 'optimization',
    label: (
      <span>
        <RocketOutlined />
        系统优化
      </span>
    ),
    children: (
      <OptimizationMaintenanceSection maintenance={maintenance} updateSettings={updateSettings} />
    ),
  },
];
