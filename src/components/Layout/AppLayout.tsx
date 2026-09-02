import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { App as AntdApp, Badge, Divider, Drawer, Dropdown, Empty, Form, Input, InputNumber, Modal, Switch, Table, Tooltip } from 'antd';
import dayjs from 'dayjs';
import {
  BellRing,
  DatabaseBackup,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Languages,
  LayoutDashboard,
  LogOut,
  Maximize,
  Menu,
  Minimize,
  MoonStar,
  PackageSearch,
  Palette,
  Ruler,
  Search,
  Settings2,
  SunMedium,
  UserCircle2,
  Wrench,
  Zap,
} from 'lucide-react';
import useAuth from '../../features/auth/hooks/useAuth';
import { changePasswordApi } from '../../features/auth/services/authService';
import { fetchInstruments } from '../../features/instrument-mgmt/services/instrumentService';
import { getAlerts } from '../../features/dashboard/services/alertService';
import { useSystemSettings } from '../../features/system-settings/hooks/useSystemSettings';
import { useSystemVersion } from '../../hooks/useSystemVersion';
import { usePermission } from '../../hooks/usePermission';
import { SystemSettings } from '../../types/common';
import type { Instrument } from '../../features/instrument-mgmt/types';
import MessagesModal from '../../features/messages/components/MessagesModal';
import { getBackups } from '../../features/system-settings/services/backupService';
import { messageService } from '../../services/messageService';
import { applyThemeSettings } from '../../utils/theme/applyThemeSettings';
import { APP_ROUTES } from '../../constants/routes';
import { DatabaseStatus } from '../UI/DatabaseStatus';
import {
  BASE_MENU_ITEMS,
  DEFAULT_MODULE_SORTING,
  DEFAULT_STATISTICS_SORTING,
  EXPANDABLE_MENU_IDS,
  MAIN_MODULE_IDS,
  MENU_PERMISSION_MAP,
  MOBILE_HIDDEN_MENU_IDS,
  MenuItemConfig,
} from './menuConfig';
import './AppLayout.css';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface MenuItemProps {
  item: MenuItemConfig;
  level: number;
  sidebarOpen: boolean;
  expandedMenus: Record<string, boolean>;
  isActive: (path: string) => boolean;
  onToggleMenu: (menuId: string) => void;
  onMenuItemClick: () => void;
}

interface ThemeCustomization {
  mode: 'light' | 'dark';
  primaryColor: string;
  infoColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  borderRadius: number;
  grayMode: boolean;
  colorWeak: boolean;
}

interface GlobalSearchRow {
  key: string;
  kind: 'page' | 'instrument' | 'alert' | 'summary';
  page: string;
  pagePath: string;
  name: string;
  model: string;
  specification: string;
  serialNumber: string;
  managementNumber: string;
  locateValue?: string;
}

const DEFAULT_EXPANDED_MENUS: Record<string, boolean> = {
  statistics: true,
};

const THEME_PRESETS = ['#1677ff', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

const LANGUAGE_OPTIONS = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
];

const HIDDEN_ROUTE_ITEMS: MenuItemConfig[] = [
  {
    id: 'systemSettings',
    label: '菜单设置',
    path: APP_ROUTES.systemSettingsConfiguration,
    children: [
      {
        id: 'userManagement',
        label: '用户管理',
        path: APP_ROUTES.systemSettingsUserManagement,
      },
      {
        id: 'systemConfiguration',
        label: '菜单设置',
        path: APP_ROUTES.systemSettingsConfiguration,
      },
      {
        id: 'dataBackup',
        label: '备份设置',
        path: APP_ROUTES.systemSettingsDataBackup,
      },
      {
        id: 'maintenance',
        label: '系统维护',
        path: APP_ROUTES.systemSettingsMaintenance,
      },
    ],
  },
];

const GLOBAL_SEARCH_PAGE_ITEMS: Array<{ key: string; page: string; name: string; pagePath: string }> = [
  { key: 'route-dashboard', page: '工作台', name: '预警总览', pagePath: APP_ROUTES.dashboard },
  { key: 'route-dashboard-schedule', page: '工作台', name: '下场安排', pagePath: APP_ROUTES.dashboardSchedule },
  { key: 'route-shadow-knife-task-board', page: '影刀联用', name: '联用任务台', pagePath: APP_ROUTES.shadowKnifeTaskBoard },
  { key: 'route-shadow-knife-length-rules', page: '影刀联用', name: '写入规则', pagePath: APP_ROUTES.shadowKnifeLengthRules },
  { key: 'route-instrument-flow', page: '仪器业务', name: '仪器出入', pagePath: APP_ROUTES.instrumentFlow },
  { key: 'route-instrument-management', page: '仪器业务', name: '仪器管理', pagePath: APP_ROUTES.instrumentManagement },
  { key: 'route-statistics', page: '数据统计', name: '使用统计', pagePath: APP_ROUTES.statistics },
  { key: 'route-statistics-instrument', page: '数据统计', name: '仪器统计', pagePath: APP_ROUTES.statisticsInstrument },
  { key: 'route-statistics-usage-consumption', page: '数据统计', name: '使用与消耗', pagePath: APP_ROUTES.statisticsUsageConsumption },
  { key: 'route-system-settings', page: '系统设置', name: '菜单设置', pagePath: APP_ROUTES.systemSettingsConfiguration },
  { key: 'route-system-user-management', page: '系统设置', name: '用户管理', pagePath: APP_ROUTES.systemSettingsUserManagement },
  { key: 'route-system-configuration', page: '系统设置', name: '系统配置', pagePath: APP_ROUTES.systemSettingsConfiguration },
  { key: 'route-system-data-backup', page: '系统设置', name: '备份设置', pagePath: APP_ROUTES.systemSettingsDataBackup },
  { key: 'route-system-operation-logs', page: '系统设置', name: '操作日志', pagePath: APP_ROUTES.systemSettingsOperationLogs },
  { key: 'route-system-maintenance', page: '系统设置', name: '系统维护', pagePath: APP_ROUTES.systemSettingsMaintenance },
  { key: 'route-one-click-transfer', page: '仪器业务', name: '一键转送', pagePath: APP_ROUTES.oneClickTransfer },
];

function flattenMenuItems(items: MenuItemConfig[], parentLabel?: string): Array<MenuItemConfig & { parentLabel?: string }> {
  return items.flatMap((item) => {
    const current = { ...item, parentLabel };
    if (!item.children?.length) {
      return [current];
    }

    return [current, ...flattenMenuItems(item.children, item.label)];
  });
}

const MENU_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} strokeWidth={2} />,
  schedule: <PackageSearch size={18} strokeWidth={2} />,
  shadowKnifeLinkage: <Ruler size={18} strokeWidth={2} />,
  shadowKnifeTaskBoard: <Ruler size={18} strokeWidth={2} />,
  shadowKnifeLengthRules: <Ruler size={18} strokeWidth={2} />,
  instrumentFlow: <Wrench size={18} strokeWidth={2} />,
  instrumentMgmt: <PackageSearch size={18} strokeWidth={2} />,
  statistics: <ChevronsUpDown size={18} strokeWidth={2} />,
  systemSettings: <Settings2 size={18} strokeWidth={2} />,
  stationMessage: <BellRing size={18} strokeWidth={2} />,
  oneClickTransfer: <Zap size={18} strokeWidth={2} />,
};

function buildThemeCustomization(settings: SystemSettings): ThemeCustomization {
  return {
    mode: settings.theme.mode === 'dark' ? 'dark' : 'light',
    primaryColor: settings.theme.primaryColor || '#1677ff',
    infoColor: settings.theme.infoColor || settings.theme.primaryColor || '#1677ff',
    successColor: settings.theme.successColor || '#52c41a',
    warningColor: settings.theme.warningColor || '#faad14',
    errorColor: settings.theme.errorColor || '#ff4d4f',
    borderRadius: settings.theme.customBorderRadius ?? 12,
    grayMode: Boolean(settings.theme.grayMode),
    colorWeak: Boolean(settings.theme.colorWeak),
  };
}

function sortByOrder<T extends { id: string }>(items: T[], order: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = order.indexOf(left.id);
    const rightIndex = order.indexOf(right.id);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    return normalizedLeft - normalizedRight;
  });
}

function canAccessMenuItem(item: MenuItemConfig, hasPermission: (permission: string) => boolean) {
  const permission = MENU_PERMISSION_MAP[item.id];

  if (!permission) {
    return true;
  }

  if (!item.children?.length) {
    return hasPermission(permission);
  }

  const hasChildAccess = item.children.some((child) => {
    const childPermission = MENU_PERMISSION_MAP[child.id];
    return childPermission ? hasPermission(childPermission) : true;
  });

  return hasChildAccess || hasPermission(permission);
}

const MenuItem = memo(({
  item,
  level,
  sidebarOpen,
  expandedMenus,
  isActive,
  onToggleMenu,
  onMenuItemClick,
}: MenuItemProps) => {
  const isMainModule = level === 0 && MAIN_MODULE_IDS.has(item.id);
  const hasChildren = Boolean(item.children?.length);
  const expanded = Boolean(expandedMenus[item.id]);

  if (hasChildren) {
    return (
      <div className={`menu-item-container ${level === 1 ? 'level-1' : ''}`}>
        <div
          className={`menu-item ${isActive(item.path) ? 'active' : ''} ${isMainModule ? 'main-module' : ''}`}
          onClick={() => onToggleMenu(item.id)}
        >
          <span className="menu-icon">{MENU_ICONS[item.id] || item.icon}</span>
          {sidebarOpen && <span className="menu-text">{item.label}</span>}
          <span className={`expand-icon ${expanded ? 'expanded' : ''}`}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </div>

        {expanded && (
          <div className="sub-menu">
            {item.children?.map((childItem) => (
              <MenuItem
                key={childItem.id}
                item={childItem}
                level={level + 1}
                sidebarOpen={sidebarOpen}
                expandedMenus={expandedMenus}
                isActive={isActive}
                onToggleMenu={onToggleMenu}
                onMenuItemClick={onMenuItemClick}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`menu-item-container ${level === 1 ? 'level-1' : ''}`}>
      <Link
        to={item.path}
        className={`menu-item ${isActive(item.path) ? 'active' : ''} ${isMainModule ? 'main-module' : ''}`}
        onClick={onMenuItemClick}
      >
        <span className="menu-icon">{MENU_ICONS[item.id] || item.icon}</span>
        {sidebarOpen && <span className="menu-text">{item.label}</span>}
      </Link>
    </div>
  );
});

function useFilteredMenuItems(
  isMobile: boolean,
  hasPermission: (permission: string) => boolean,
  settings: SystemSettings,
) {
  return useMemo(() => {
    const moduleSorting = settings.personalization?.workbench?.moduleSorting || DEFAULT_MODULE_SORTING;
    const statisticsSorting = settings.personalization?.workbench?.statisticsSorting || DEFAULT_STATISTICS_SORTING;

    const sortedMenuItems = sortByOrder(BASE_MENU_ITEMS, moduleSorting).map((item) => {
      if (item.id === 'statistics' && item.children) {
        return { ...item, children: sortByOrder(item.children, statisticsSorting) };
      }

      return item;
    });

    return sortedMenuItems
      .filter((item) => {
        if (isMobile && MOBILE_HIDDEN_MENU_IDS.has(item.id)) {
          return false;
        }

        if (item.id === 'dashboard' && settings.personalization?.workbench?.showHomeModule === false) {
          return false;
        }

        return canAccessMenuItem(item, hasPermission);
      })
      .map((item) => {
        if (!item.children?.length) {
          return item;
        }

        const children = item.children.filter((child) => {
          const childPermission = MENU_PERMISSION_MAP[child.id];
          if (childPermission && !hasPermission(childPermission)) {
            return false;
          }

          return !child.path.startsWith('/instrument-mgmt/');
        });

        return { ...item, children };
      })
      .filter((item) => item.id !== 'systemSettings');
  }, [hasPermission, isMobile, settings]);
}

function ThemeModeSegment({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`theme-mode-segment ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="theme-color-field">
      <span>{label}</span>
      <div className="theme-color-input-group">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className="theme-color-text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(DEFAULT_EXPANDED_MENUS);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [themeDrawerOpen, setThemeDrawerOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchData, setGlobalSearchData] = useState<GlobalSearchRow[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => messageService.getUnreadCount());
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [settings, setSettings] = useSystemSettings();
  const { hasPermission } = usePermission();
  const versionInfo = useSystemVersion();
  const { message } = AntdApp.useApp();
  const [passwordForm] = Form.useForm();
  const menuItems = useFilteredMenuItems(isMobile, hasPermission, settings);
  const themeCustomization = useMemo(() => buildThemeCustomization(settings), [settings]);
  const currentLanguage = settings.localization?.language || 'zh-CN';

  useEffect(() => {
    applyThemeSettings(settings);
  }, [settings]);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile, location.pathname]);


  useEffect(() => {
    const handleMessagesUpdate = () => {
      setUnreadCount(messageService.getUnreadCount());
    };

    window.addEventListener('internal-messages-updated', handleMessagesUpdate);
    return () => window.removeEventListener('internal-messages-updated', handleMessagesUpdate);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const checkBackup = async () => {
      if (settings.backup?.strategy !== 'manual' || !settings.backup.manualBackupSuggestedDays) {
        return;
      }

      const lastCheckKey = 'last_backup_check_time';
      const now = dayjs();
      const lastCheck = localStorage.getItem(lastCheckKey);

      if (lastCheck && now.diff(dayjs(lastCheck), 'hour') < 24) {
        return;
      }

      try {
        const backups = await getBackups();
        const hasReminder = messageService.getMessages().some(
          (message) => message.relatedId === 'backup_reminder' && message.status === 'unread',
        );

        if (!hasReminder) {
          if (backups.length > 0) {
            const lastBackupDate = dayjs(backups[0].createdAt);
            const daysDiff = now.diff(lastBackupDate, 'day');

            if (daysDiff >= settings.backup.manualBackupSuggestedDays) {
              messageService.addMessage({
                title: '备份提醒',
                content: `已有 ${daysDiff} 天未创建新备份。`,
                type: 'warning',
                relatedId: 'backup_reminder',
                source: 'alert',
              });
            }
          } else {
            messageService.addMessage({
              title: '备份提醒',
              content: '未找到任何备份记录。',
              type: 'warning',
              relatedId: 'backup_reminder',
              source: 'alert',
            });
          }
        }

        localStorage.setItem(lastCheckKey, now.toISOString());
      } catch (error) {
        console.error('Failed to check backup status', error);
      }
    };

    const timer = window.setTimeout(checkBackup, 5000);
    return () => window.clearTimeout(timer);
  }, [settings.backup]);

  const toggleSidebar = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    setSidebarOpen((current) => !current);
  }, []);

  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const toggleMenuExpansion = useCallback((menuId: string) => {
    setExpandedMenus((current) => ({
      ...current,
      [menuId]: !current[menuId],
    }));
  }, []);

  const toggleAllMenus = useCallback(() => {
    setExpandedMenus((current) => {
      const shouldExpandAll = !EXPANDABLE_MENU_IDS.every((menuId) => current[menuId]);

      return EXPANDABLE_MENU_IDS.reduce<Record<string, boolean>>((accumulator, menuId) => {
        accumulator[menuId] = shouldExpandAll;
        return accumulator;
      }, {});
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  }, [logout, navigate]);

  const handleMenuItemClick = useCallback(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const handleOpenPasswordModal = useCallback(() => {
    setPasswordModalOpen(true);
  }, []);

  const handleOpenSearchModal = useCallback(() => {
    setSearchKeyword('');
    setSearchModalOpen(true);
  }, []);

  const handleCloseSearchModal = useCallback(() => {
    setSearchModalOpen(false);
    setSearchKeyword('');
  }, []);

  useEffect(() => {
    if (!searchModalOpen) {
      return;
    }

    let cancelled = false;

    const loadGlobalSearchData = async () => {
      try {
        setGlobalSearchLoading(true);
        const [instrumentResult, alertResult] = await Promise.allSettled([
          fetchInstruments(),
          getAlerts({ page: 1, pageSize: 100 }),
        ]);

        const rows: GlobalSearchRow[] = [];

        if (instrumentResult.status === 'fulfilled') {
          rows.push(
            ...instrumentResult.value.map((item: Instrument) => ({
              key: `instrument-${item.id}`,
              kind: 'instrument' as const,
              page: '仪器管理',
              pagePath: APP_ROUTES.instrumentManagement,
              name: item.name || '-',
              model: item.model || '-',
              specification: item.measureRange || '-',
              serialNumber: item.serialNumber || '-',
              managementNumber: item.managementNumber || '-',
              locateValue: item.managementNumber || item.serialNumber || item.name || '',
            })),
          );
        }

        if (alertResult.status === 'fulfilled' && alertResult.value?.success) {
          const alertList = Array.isArray(alertResult.value.data) ? alertResult.value.data : [];
          rows.push(
            ...alertList.map((item: any, index: number) => ({
              key: `alert-${item.id || index}`,
              kind: 'alert' as const,
              page: '预警总览',
              pagePath: APP_ROUTES.dashboard,
              name: item.name || item.instrumentName || '预警记录',
              model: item.model || '-',
              specification: item.measureRange || '-',
              serialNumber: item.serialNumber || '-',
              managementNumber: item.managementNumber || '-',
              locateValue: item.managementNumber || item.serialNumber || item.name || '',
            })),
          );
        }
        if (!cancelled) {
          setGlobalSearchData(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setGlobalSearchData([]);
          message.error('全局搜索数据加载失败');
        }
        console.error('Failed to load global search data', error);
      } finally {
        if (!cancelled) {
          setGlobalSearchLoading(false);
        }
      }
    };

    void loadGlobalSearchData();

    return () => {
      cancelled = true;
    };
  }, [message, searchModalOpen]);

  const handleClosePasswordModal = useCallback(() => {
    setPasswordModalOpen(false);
    passwordForm.resetFields();
  }, [passwordForm]);

  const handleFullscreenToggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch (error) {
      console.error('Fullscreen toggle failed', error);
    }
  }, []);

  const handleLanguageChange = useCallback((language: string) => {
    setSettings((current) => ({
      ...current,
      localization: {
        ...current.localization,
        language,
      },
    } as Partial<SystemSettings>));
  }, [setSettings]);

  const handleThemeFieldChange = useCallback(<K extends keyof ThemeCustomization>(key: K, value: ThemeCustomization[K]) => {
    setSettings((current) => ({
      ...current,
      darkMode: key === 'mode' ? value === 'dark' : current.darkMode,
      theme: {
        ...current.theme,
        mode: key === 'mode' ? value : current.theme.mode,
        primaryColor: key === 'primaryColor' ? String(value) : current.theme.primaryColor,
        infoColor: key === 'infoColor' ? String(value) : current.theme.infoColor,
        successColor: key === 'successColor' ? String(value) : current.theme.successColor,
        warningColor: key === 'warningColor' ? String(value) : current.theme.warningColor,
        errorColor: key === 'errorColor' ? String(value) : current.theme.errorColor,
        customBorderRadius: key === 'borderRadius' ? Number(value) : current.theme.customBorderRadius,
        grayMode: key === 'grayMode' ? Boolean(value) : current.theme.grayMode,
        colorWeak: key === 'colorWeak' ? Boolean(value) : current.theme.colorWeak,
        buttonColor:
          key === 'primaryColor' ? String(value) : (current.theme.buttonColor || current.theme.primaryColor),
      },
    } as Partial<SystemSettings>));
  }, [setSettings]);

  const handleThemeModeToggle = useCallback(() => {
    handleThemeFieldChange('mode', themeCustomization.mode === 'light' ? 'dark' : 'light');
  }, [handleThemeFieldChange, themeCustomization.mode]);

  const resetThemeCustomization = useCallback(() => {
    setSettings((current) => ({
      ...current,
      theme: {
        ...current.theme,
        primaryColor: '#1677ff',
        infoColor: '#1677ff',
        successColor: '#52c41a',
        warningColor: '#faad14',
        errorColor: '#ff4d4f',
        customBorderRadius: 12,
        grayMode: false,
        colorWeak: false,
      },
    }));
  }, [setSettings]);

  const isActive = useCallback((path: string) => {
    if (path === '/dashboard') {
      return location.pathname === path;
    }

    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }, [location.pathname]);

  const activeItem = useMemo(() => {
    const collectItems = (items: MenuItemConfig[]): MenuItemConfig[] =>
      items.flatMap((item) => [item, ...(item.children || [])]);
    return collectItems([...menuItems, ...HIDDEN_ROUTE_ITEMS]).find((item) => isActive(item.path));
  }, [menuItems, isActive]);

  const tabItems = useMemo(() => {
    const items = [
      { id: 'dashboard', label: '首页', path: '/dashboard', icon: MENU_ICONS.dashboard },
    ];

    if (activeItem && activeItem.path !== '/dashboard') {
      items.push({
        id: activeItem.id,
        label: activeItem.label,
        path: activeItem.path,
        icon: MENU_ICONS[activeItem.id] || activeItem.icon,
      } as never);
    }

    return items;
  }, [activeItem]);

  const globalSearchPageRows = useMemo<GlobalSearchRow[]>(() => {
    const seen = new Set<string>();
    const allMenuItems = flattenMenuItems([...menuItems, ...HIDDEN_ROUTE_ITEMS]);
    const menuRows = allMenuItems
      .filter((item) => {
        const dedupeKey = `${item.path}|${item.label}|menu`;
        if (seen.has(dedupeKey)) {
          return false;
        }

        seen.add(dedupeKey);
        return Boolean(item.path);
      })
      .map((item) => ({
        key: `page-${item.id}`,
        kind: 'page' as const,
        page: item.parentLabel || '页面导航',
        pagePath: item.path,
        name: item.label,
        model: item.parentLabel ? '功能页面' : '模块入口',
        specification: item.path,
        serialNumber: '-',
        managementNumber: '-',
      }));
    const routeRows = GLOBAL_SEARCH_PAGE_ITEMS
      .filter((item) => {
        const dedupeKey = `${item.pagePath}|${item.name}|route`;
        if (seen.has(dedupeKey)) {
          return false;
        }

        seen.add(dedupeKey);
        return true;
      })
      .map((item) => ({
        key: item.key,
        kind: 'page' as const,
        page: item.page,
        pagePath: item.pagePath,
        name: item.name,
        model: '功能页面',
        specification: item.pagePath,
        serialNumber: '-',
        managementNumber: '-',
      }));

    return [...routeRows, ...menuRows];
  }, [menuItems]);

  const filteredGlobalSearchRows = useMemo<GlobalSearchRow[]>(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const source = [...globalSearchPageRows, ...globalSearchData];

    const matchedRows = source.filter((item) => {
      if (!keyword) {
        return true;
      }

      return (
        item.page.toLowerCase().includes(keyword)
        || item.name.toLowerCase().includes(keyword)
        || item.model.toLowerCase().includes(keyword)
        || item.specification.toLowerCase().includes(keyword)
        || item.serialNumber.toLowerCase().includes(keyword)
        || item.managementNumber.toLowerCase().includes(keyword)
      );
    });

    const kindPriority: Record<GlobalSearchRow['kind'], number> = {
      page: 0,
      summary: 1,
      alert: 2,
      instrument: 3,
    };

    if (!keyword) {
      return matchedRows
        .sort((left, right) => kindPriority[left.kind] - kindPriority[right.kind])
        .slice(0, 20);
    }

    return matchedRows.sort((left, right) => kindPriority[left.kind] - kindPriority[right.kind]);
  }, [globalSearchData, globalSearchPageRows, searchKeyword]);

  const hasSearchKeyword = searchKeyword.trim().length > 0;

  const userMenuItems = useMemo(() => [
    {
      key: 'profile',
      label: (
        <div className="topbar-user-menu-info">
          <strong>{user?.username || 'admin'}</strong>
          <span>{user?.role || '管理员'}</span>
        </div>
      ),
      disabled: true,
    },
    {
      key: 'users',
      label: '用户管理',
      icon: <UserCircle2 size={16} />,
      onClick: () => navigate(APP_ROUTES.systemSettingsUserManagement),
    },
    {
      key: 'changePassword',
      label: '修改密码',
      icon: <Settings2 size={16} />,
      onClick: handleOpenPasswordModal,
    },
    {
      key: 'settings',
      label: '菜单设置',
      icon: <Settings2 size={16} />,
      onClick: () => navigate(APP_ROUTES.systemSettingsConfiguration),
    },
    {
      key: 'backupSettings',
      label: '备份设置',
      icon: <DatabaseBackup size={16} />,
      onClick: () => navigate(APP_ROUTES.systemSettingsDataBackup),
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogOut size={16} />,
      onClick: handleLogout,
    },
  ].filter((item) => {
    if (item.key === 'users') {
      return hasPermission('system:user:view');
    }

    if (item.key === 'backupSettings') {
      return hasPermission('system:backup:view');
    }

    return true;
  }), [handleLogout, handleOpenPasswordModal, hasPermission, navigate, user?.role, user?.username]);

  const languageMenuItems = useMemo(() => LANGUAGE_OPTIONS.map((item) => ({
    key: item.key,
    label: item.label,
    onClick: () => handleLanguageChange(item.key),
  })), [handleLanguageChange]);

  const handleChangePassword = useCallback(async () => {
    try {
      const values = await passwordForm.validateFields();

      if (!user?.username) {
        message.error('当前用户信息无效，无法修改密码');
        return;
      }

      setPasswordSubmitting(true);
      const result = await changePasswordApi({
        username: user.username,
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });

      if (!result.success) {
        message.error(result.error || '修改密码失败');
        return;
      }

      message.success('密码修改成功');
      handleClosePasswordModal();
    } finally {
      setPasswordSubmitting(false);
    }
  }, [handleClosePasswordModal, message, passwordForm, user?.username]);

  const handleSearchNavigate = useCallback((row: GlobalSearchRow) => {
    if (row.kind === 'instrument' && row.locateValue) {
      navigate(`${row.pagePath}?locate=${encodeURIComponent(row.locateValue)}`);
    } else {
      navigate(row.pagePath);
    }
    handleCloseSearchModal();
  }, [handleCloseSearchModal, navigate]);

  return (
    <div className={`app-layout theme-${themeCustomization.mode}`}>
      {isMobile && sidebarOpen && <div className="sidebar-overlay" onClick={handleOverlayClick} />}

      {isMobile && (
        <div className="mobile-header" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={toggleSidebar} className="hamburger-button">
            {sidebarOpen ? <ChevronLeft size={22} /> : <ChevronsUpDown size={22} />}
          </button>
          <div className="mobile-header-title">
            <span className="mobile-header-kicker">Instrument OS</span>
            <h1>{activeItem?.label || '仪器系统'}</h1>
          </div>
          <div className="header-spacer" />
        </div>
      )}

      <aside
        className={`sidebar ${sidebarOpen ? 'open' : 'closed'} ${isMobile ? 'mobile' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sidebar-header">
          {sidebarOpen ? (
            <div className="brand-block">
              <div className="brand-mark">IM</div>
              <div className="brand-copy">
                <span className="brand-kicker">Instrument OS</span>
                <span className="logo">
                  {isMobile ? '仪器系统' : '仪器管理系统'}
                </span>
              </div>
            </div>
          ) : (
            <div className="brand-mark collapsed">IM</div>
          )}
          <div className="sidebar-header-actions">
            {sidebarOpen && (
              <button
                type="button"
                className="toggle-button"
                onClick={toggleAllMenus}
                title="展开或收起全部菜单"
              >
                <ChevronsDownUp size={18} />
              </button>
            )}
            <button
              type="button"
              className="toggle-button"
              onClick={toggleSidebar}
              title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <div className="sidebar-panel">
            <div className="sidebar-panel-kicker">当前模块</div>
            <div className="sidebar-panel-title">{activeItem?.label || '仪器工作台'}</div>
            <div className="sidebar-panel-subtitle">统一工作流、快速切换、清晰可控。</div>
          </div>
        )}

        <div className="menu-container">
          {menuItems.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              level={0}
              sidebarOpen={sidebarOpen}
              expandedMenus={expandedMenus}
              isActive={isActive}
              onToggleMenu={toggleMenuExpansion}
              onMenuItemClick={handleMenuItemClick}
            />
          ))}
        </div>

        <div className="sidebar-footer">
          {sidebarOpen && versionInfo && (
            <div className="version-tag">
              v{versionInfo.version}
            </div>
          )}
        </div>
      </aside>

      <div className="main-content">
        {!isMobile && (
          <>
            <header className="topbar">
              <div className="topbar-left">
                <button type="button" className="topbar-icon-button" onClick={toggleSidebar} title="切换侧边栏">
                  <Menu size={18} />
                </button>
                <div className="topbar-title">
                  <span className="topbar-title-icon">
                    {MENU_ICONS[activeItem?.id || 'dashboard'] || <LayoutDashboard size={16} />}
                  </span>
                  <span>{activeItem?.label || '首页'}</span>
                </div>
              </div>

              <div className="topbar-right">
                <div className="topbar-search-status">
                  <DatabaseStatus />
                </div>
                <button
                  type="button"
                  className="topbar-icon-button"
                  title="搜索"
                  onClick={handleOpenSearchModal}
                >
                  <Search size={17} />
                </button>
                <button
                  type="button"
                  className="topbar-icon-button"
                  title={isFullscreen ? '退出全屏' : '全屏'}
                  onClick={handleFullscreenToggle}
                >
                  {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
                <Dropdown menu={{ items: languageMenuItems, selectedKeys: [currentLanguage] }} trigger={['click']} placement="bottomRight">
                  <button type="button" className="topbar-icon-button" title="语言">
                    <Languages size={17} />
                  </button>
                </Dropdown>
                <Tooltip title={`切换到${themeCustomization.mode === 'light' ? '深色' : '浅色'}主题`}>
                  <button type="button" className="topbar-icon-button" title="主题切换" onClick={handleThemeModeToggle}>
                    {themeCustomization.mode === 'dark' ? <SunMedium size={17} /> : <MoonStar size={17} />}
                  </button>
                </Tooltip>
                <Tooltip title="主题自定义">
                  <button
                    type="button"
                    className="topbar-icon-button"
                    title="主题自定义"
                    onClick={() => setThemeDrawerOpen(true)}
                  >
                    <Palette size={17} />
                  </button>
                </Tooltip>
                <button
                  type="button"
                  className="topbar-icon-button"
                  title="站内信"
                  onClick={() => setMessagesModalVisible(true)}
                >
                  <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                    <BellRing size={17} />
                  </Badge>
                </button>
                <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                  <button type="button" className="topbar-user-button" title="用户菜单">
                    <UserCircle2 size={18} />
                    <span>{user?.username || 'admin'}</span>
                  </button>
                </Dropdown>
              </div>
            </header>

            <div className="tabbar">
              <div className="tabbar-tabs">
                {tabItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`tabbar-tab ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <span className="tabbar-tab-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="content">{children}</div>
      </div>

      <Drawer
        title="主题配置"
        placement="right"
        width={340}
        onClose={() => setThemeDrawerOpen(false)}
        open={themeDrawerOpen}
        className="theme-drawer"
      >
        <div className="theme-drawer-body">
          <div className="theme-block">
            <div className="theme-block-title">外观模式</div>
            <div className="theme-mode-group">
              <ThemeModeSegment
                active={themeCustomization.mode === 'light'}
                icon={<SunMedium size={16} />}
                label="浅色"
                onClick={() => handleThemeFieldChange('mode', 'light')}
              />
              <ThemeModeSegment
                active={themeCustomization.mode === 'dark'}
                icon={<MoonStar size={16} />}
                label="深色"
                onClick={() => handleThemeFieldChange('mode', 'dark')}
              />
            </div>
          </div>

          <Divider />

          <div className="theme-block">
            <div className="theme-block-title">品牌色</div>
            <div className="theme-preset-row">
              {THEME_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`theme-preset ${themeCustomization.primaryColor === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleThemeFieldChange('primaryColor', color)}
                />
              ))}
            </div>
            <ColorField
              label="主色"
              value={themeCustomization.primaryColor}
              onChange={(value) => handleThemeFieldChange('primaryColor', value)}
            />
          </div>

          <Divider />

          <div className="theme-grid">
            <ColorField
              label="信息色"
              value={themeCustomization.infoColor}
              onChange={(value) => handleThemeFieldChange('infoColor', value)}
            />
            <ColorField
              label="成功色"
              value={themeCustomization.successColor}
              onChange={(value) => handleThemeFieldChange('successColor', value)}
            />
            <ColorField
              label="警告色"
              value={themeCustomization.warningColor}
              onChange={(value) => handleThemeFieldChange('warningColor', value)}
            />
            <ColorField
              label="危险色"
              value={themeCustomization.errorColor}
              onChange={(value) => handleThemeFieldChange('errorColor', value)}
            />
          </div>

          <Divider />

          <div className="theme-block">
            <div className="theme-inline-field">
              <span>圆角大小</span>
              <InputNumber
                min={0}
                max={20}
                value={themeCustomization.borderRadius}
                onChange={(value) => handleThemeFieldChange('borderRadius', Number(value ?? 4))}
              />
            </div>
            <div className="theme-inline-field">
              <span>灰度模式</span>
              <Switch
                checked={themeCustomization.grayMode}
                onChange={(checked) => handleThemeFieldChange('grayMode', checked)}
              />
            </div>
            <div className="theme-inline-field">
              <span>弱色模式</span>
              <Switch
                checked={themeCustomization.colorWeak}
                onChange={(checked) => handleThemeFieldChange('colorWeak', checked)}
              />
            </div>
          </div>

          <button type="button" className="theme-reset-button" onClick={resetThemeCustomization}>
            恢复默认配置
          </button>
        </div>
      </Drawer>

      <Modal
        title={null}
        open={searchModalOpen}
        footer={null}
        onCancel={handleCloseSearchModal}
        width={hasSearchKeyword ? 980 : 560}
        destroyOnHidden
        className={hasSearchKeyword ? 'global-search-modal expanded' : 'global-search-modal compact'}
      >
          <div className="global-search-panel">
            <div className="global-search-box">
              <div className="instrument-search-input-shell global-search-input-shell">
                <span className="instrument-search-leading global-search-leading">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  placeholder="请输入关键字搜索"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  className="instrument-search-input global-search-input"
                  autoFocus
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="instrument-search-clear global-search-clear"
                    aria-label="clear"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

          {!hasSearchKeyword ? (
            <div className="global-search-empty global-search-empty-idle">
              <Empty description="无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <>
              <div className="global-search-meta">
                <span>全局搜索已接入所有页面，支持跨页面跳转与业务数据检索</span>
                <span>{filteredGlobalSearchRows.length} 条结果</span>
              </div>

              {filteredGlobalSearchRows.length === 0 && !globalSearchLoading ? (
                <div className="global-search-empty">
                  <Empty description="无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : (
                <Table<GlobalSearchRow>
                  rowKey="key"
                  loading={globalSearchLoading}
                  columns={[
                    {
                      title: '数据页面',
                      dataIndex: 'page',
                      width: 120,
                      render: (value: string) => value,
                    },
                    {
                      title: '仪器名称',
                      dataIndex: 'name',
                      ellipsis: true,
                    },
                    {
                      title: '型号',
                      dataIndex: 'model',
                      ellipsis: true,
                    },
                    {
                      title: '测量范围',
                      dataIndex: 'specification',
                      ellipsis: true,
                    },
                    {
                      title: '出厂编号',
                      dataIndex: 'serialNumber',
                      ellipsis: true,
                    },
                    {
                      title: '管理编号',
                      dataIndex: 'managementNumber',
                      ellipsis: true,
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 108,
                      render: (_, record) => (
                        <button
                          type="button"
                          className="global-search-locate-button"
                          onClick={() => handleSearchNavigate(record)}
                        >
                          转到
                        </button>
                      ),
                    },
                  ]}
                  dataSource={filteredGlobalSearchRows}
                  pagination={false}
                  scroll={{ y: 420 }}
                  size="middle"
                  className="global-search-table"
                  onRow={(record) => ({
                    onDoubleClick: () => handleSearchNavigate(record),
                  })}
                />
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={handleClosePasswordModal}
        onOk={handleChangePassword}
        confirmLoading={passwordSubmitting}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" preserve={false}>
          <Form.Item
            label="当前密码"
            name="oldPassword"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '新密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }

                  return Promise.reject(new Error('两次输入的新密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      <MessagesModal visible={messagesModalVisible} onClose={() => setMessagesModalVisible(false)} />
    </div>
  );
};

export default AppLayout;

