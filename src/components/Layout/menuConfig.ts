import { APP_ROUTES } from '../../constants/routes';

export interface MenuItemConfig {
  id: string;
  label: string;
  icon?: string;
  path: string;
  children?: MenuItemConfig[];
}

export const MENU_PERMISSION_MAP: Record<string, string> = {
  dashboard: 'dashboard:alert:view',
  schedule: 'dashboard:schedule:view',
  shadowKnifeLinkage: 'shadow_knife:task:view',
  shadowKnifeTaskBoard: 'shadow_knife:task:view',
  shadowKnifeLengthRules: 'shadow_knife:rule:view',
  instrumentFlow: 'flow:view',
  instrumentMgmt: 'instrument:view',
  statistics: 'stats',
  instrumentStats: 'stats:instrument:view',
  usageConsumption: 'stats:usage:view',
  systemSettings: 'system',
  userManagement: 'system:user:view',
  systemConfiguration: 'system:config:view',
  dataBackup: 'system:backup:view',
  maintenance: 'system:maintenance:view',
  oneClickTransfer: 'transfer:view',
};

export const DEFAULT_MODULE_SORTING = [
  'dashboard',
  'schedule',
  'shadowKnifeLinkage',
  'instrumentFlow',
  'instrumentMgmt',
  'statistics',
  'oneClickTransfer',
];

export const DEFAULT_STATISTICS_SORTING = ['instrumentStats', 'usageConsumption'];

export const MAIN_MODULE_IDS = new Set([
  'dashboard',
  'schedule',
  'shadowKnifeLinkage',
  'instrumentFlow',
  'instrumentMgmt',
  'statistics',
  'oneClickTransfer',
]);

export const MOBILE_HIDDEN_MENU_IDS = new Set(['dashboard', 'statistics']);

export const EXPANDABLE_MENU_IDS = ['statistics'];

export const BASE_MENU_ITEMS: MenuItemConfig[] = [
  {
    id: 'dashboard',
    label: '\u9884\u8b66\u603b\u89c8',
    icon: '\ud83d\udcf3',
    path: APP_ROUTES.dashboard,
  },
  {
    id: 'schedule',
    label: '\u4e0b\u573a\u5b89\u6392',
    icon: '\ud83d\udcee',
    path: APP_ROUTES.dashboardSchedule,
  },
  {
    id: 'shadowKnifeLinkage',
    label: '\u5f71\u5200\u8054\u7528',
    icon: '\ud83d\udccf',
    path: APP_ROUTES.shadowKnifeLinkage,
    children: [
      {
        id: 'shadowKnifeTaskBoard',
        label: '\u8054\u7528\u4efb\u52a1\u53f0',
        path: APP_ROUTES.shadowKnifeTaskBoard,
      },
      {
        id: 'shadowKnifeLengthRules',
        label: '\u5199\u5165\u89c4\u5219',
        path: APP_ROUTES.shadowKnifeLengthRules,
      },
    ],
  },
  {
    id: 'instrumentFlow',
    label: '\u4eea\u5668\u51fa\u5165',
    icon: '\ud83d\udee0',
    path: APP_ROUTES.instrumentFlow,
  },
  {
    id: 'instrumentMgmt',
    label: '\u4eea\u5668\u7ba1\u7406',
    icon: '\ud83d\udccb',
    path: APP_ROUTES.instrumentManagement,
  },
  {
    id: 'statistics',
    label: '\u6570\u636e\u7edf\u8ba1',
    icon: '\ud83d\udcca',
    path: APP_ROUTES.statistics,
    children: [
      {
        id: 'instrumentStats',
        label: '\u4eea\u5668\u7edf\u8ba1',
        path: APP_ROUTES.statisticsInstrument,
      },
      {
        id: 'usageConsumption',
        label: '\u4f7f\u7528\u4e0e\u6d88\u8017',
        path: APP_ROUTES.statisticsUsageConsumption,
      },
    ],
  },
  {
    id: 'oneClickTransfer',
    label: '一键转送',
    icon: '↗',
    path: APP_ROUTES.oneClickTransfer,
  },
];
