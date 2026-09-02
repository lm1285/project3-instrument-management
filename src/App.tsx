import { memo, useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import { useMediaQuery } from 'react-responsive';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import apiClient from './services/apiClient';
import { APP_ROUTES } from './constants/routes';
import LoginPage from './features/auth/components/LoginPage/LoginPage';
import useAuth from './features/auth/hooks/useAuth';
import AppLayout from './components/Layout/AppLayout';
import { ProtectedRoute } from './features/auth/components/ProtectedRoute';
import InstrumentList from './features/instrument-mgmt/components/InstrumentList/InstrumentList';
import InstrumentFlowTable from './features/instrument-flow/components/InstrumentFlowTable/InstrumentFlowTable';
import UsageStatistics from './features/statistics/components/UsageStatistics/UsageStatistics';
import UsageConsumption from './features/statistics/components/UsageConsumption/UsageConsumption';
import InstrumentStatistics from './features/statistics/components/InstrumentStatistics/InstrumentStatistics';
import AlertsPage from './features/dashboard/components/AlertOverview/AlertsPage';
import ScheduleTable from './features/dashboard/components/ScheduleTable/ScheduleTable';
import LengthShadowLinkagePage from './features/length-shadow/components/LengthShadowLinkagePage';
import ShadowKnifeTaskBoardPage from './features/shadow-knife/components/ShadowKnifeTaskBoardPage';
import GeneralSettings from './features/system-settings/components/SystemConfig/GeneralSettings';
import useSystemSettings, { initApplySystemSettings } from './features/system-settings/hooks/useSystemSettings';
import LogViewer from './features/system-settings/components/OperationLogs/LogViewer';
import BackupManager from './features/system-settings/components/DataBackup/BackupManager';
import SystemMaintenancePage from './features/system-settings/components/SystemConfig/SystemMaintenancePage';
import OneClickTransferPage from './features/one-click-transfer/OneClickTransferPage';
import './App.css';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Shanghai');

const AppMessageInit = () => {
  const { message } = AntdApp.useApp();

  useEffect(() => {
    apiClient.setMessageHandler(message);
  }, [message]);

  return null;
};

const DashboardRoute = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  if (isMobile) {
    return <Navigate to={APP_ROUTES.instrumentFlow} replace />;
  }

  return <>{children}</>;
};

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <AppLayout>{children}</AppLayout>
);

function App() {
  const [settings] = useSystemSettings();
  const [themeTick, setThemeTick] = useState(0);
  const { language } = settings.localization || { language: 'zh-CN' };
  const { isAuthenticated } = useAuth();
  const navigationFontSize = settings.theme.sidebarFontSize || 16;
  const contentFontSize = settings.theme.contentFontSize || navigationFontSize;

  useEffect(() => {
    const handleThemeChange = () => setThemeTick((value) => value + 1);
    window.addEventListener('theme-customization-change', handleThemeChange);
    return () => window.removeEventListener('theme-customization-change', handleThemeChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    initApplySystemSettings();

  }, [isAuthenticated]);

  useEffect(() => {
    dayjs.locale(language === 'zh-CN' ? 'zh-cn' : 'en');
  }, [language]);

  const antdLocale = language === 'zh-CN' ? zhCN : enUS;

  const themeConfig = useMemo(() => {
    const storedCustomization = (() => {
      try {
        return JSON.parse(localStorage.getItem('app_theme_customization') || '{}');
      } catch {
        return {};
      }
    })() as Record<string, any>;
    const storedThemeMode = localStorage.getItem('app_theme_mode');

    const isDark = settings.theme.mode === 'dark';
    const effectiveDark = storedCustomization.mode === 'dark'
      ? true
      : storedCustomization.mode === 'light'
        ? false
        : storedThemeMode === 'dark'
          ? true
          : storedThemeMode === 'light'
            ? false
            : isDark;
    let borderRadius = storedCustomization.borderRadius ?? 4;
    if (settings.layout?.borderRadius === 'sm') borderRadius = 2;
    if (settings.layout?.borderRadius === 'lg') borderRadius = 6;

    const primaryColor = storedCustomization.primaryColor || settings.theme.primaryColor || '#1677ff';

    return {
      algorithm: effectiveDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: primaryColor,
        borderRadius,
        fontFamily: settings.typography.fontFamily,
        fontSize: contentFontSize,
        lineHeight: parseFloat(settings.typography.lineHeight) || 1.6,
        colorBgLayout: effectiveDark ? '#141414' : '#f0f2f5',
        colorBgContainer: effectiveDark ? '#1f1f1f' : '#ffffff',
        colorBgElevated: effectiveDark ? '#1f1f1f' : '#ffffff',
        colorText: effectiveDark ? '#f5f5f5' : '#303133',
        colorTextSecondary: effectiveDark ? 'rgba(255,255,255,0.65)' : '#606266',
        colorBorder: effectiveDark ? '#303030' : '#dcdfe6',
        colorBorderSecondary: effectiveDark ? '#262626' : '#ebeef5',
        colorTextLightSolid: settings.theme.buttonTextColor || '#ffffff',
        colorInfo: storedCustomization.infoColor || primaryColor,
        colorSuccess: storedCustomization.successColor || '#52c41a',
        colorWarning: storedCustomization.warningColor || '#faad14',
        colorError: storedCustomization.errorColor || '#ff4d4f',
        boxShadowSecondary: effectiveDark ? '0 6px 16px rgba(0,0,0,0.32)' : '0 1px 2px rgba(0,0,0,0.04)',
      },
      components: {
        Layout: {
          bodyBg: effectiveDark ? '#141414' : '#f0f2f5',
          headerBg: effectiveDark ? '#141414' : '#ffffff',
          siderBg: effectiveDark ? '#001529' : '#ffffff',
        },
        Card: {
          borderRadiusLG: borderRadius,
          boxShadowTertiary: effectiveDark ? '0 6px 16px rgba(0,0,0,0.26)' : '0 1px 2px rgba(0,0,0,0.04)',
        },
        Button: {
          colorPrimary: primaryColor,
          algorithm: true,
          fontSize: navigationFontSize,
          borderRadius,
          controlHeight: settings.theme.buttonLineHeight
            ? Math.round(navigationFontSize * settings.theme.buttonLineHeight + 10)
            : undefined,
        },
        Input: {
          borderRadius,
          activeBorderColor: primaryColor,
          hoverBorderColor: primaryColor,
        },
        Select: {
          borderRadius,
          optionSelectedBg: effectiveDark ? 'rgba(22,119,255,0.22)' : '#ecf5ff',
        },
        Table: {
          borderColor: effectiveDark ? '#303030' : '#ebeef5',
          headerBg: effectiveDark ? '#1f1f1f' : '#fafafa',
          headerColor: effectiveDark ? '#fafafa' : '#606266',
          rowHoverBg: effectiveDark ? '#1a1a1a' : '#f5f7fa',
        },
        Tabs: {
          cardBg: effectiveDark ? '#1f1f1f' : '#fafafa',
          itemSelectedColor: primaryColor,
          itemActiveColor: primaryColor,
        },
        Modal: {
          borderRadiusLG: borderRadius,
        },
        Typography: {
          fontSize: contentFontSize,
          lineHeight: settings.theme.contentLineHeight || 1.6,
        },
      },
    };
  }, [settings.theme, settings.layout, settings.typography, themeTick]);

  const componentSize = useMemo(() => {
    switch (settings.layout?.density) {
      case 'compact':
        return 'small';
      case 'comfortable':
        return 'large';
      default:
        return 'middle';
    }
  }, [settings.layout?.density]);

  return (
    <ConfigProvider locale={antdLocale} theme={themeConfig} componentSize={componentSize}>
      <AntdApp>
        <AppMessageInit />
        <Router>
          <div className="App">
            <Routes>
              <Route path={APP_ROUTES.login} element={<LoginPage />} />

              <Route
                path={APP_ROUTES.dashboard}
                element={(
                  <ProtectedRoute permission="dashboard:alert:view">
                    <DashboardRoute>
                      <ProtectedLayout>
                        <AlertsPage />
                      </ProtectedLayout>
                    </DashboardRoute>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.dashboardSchedule}
                element={(
                  <ProtectedRoute permission="dashboard:schedule:view">
                    <ProtectedLayout>
                      <ScheduleTable />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.shadowKnifeLinkage}
                element={<Navigate to={APP_ROUTES.shadowKnifeTaskBoard} replace />}
              />

              <Route
                path={APP_ROUTES.shadowKnifeTaskBoard}
                element={(
                  <ProtectedRoute permission="shadow_knife:task:view">
                    <ProtectedLayout>
                      <ShadowKnifeTaskBoardPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.shadowKnifeLengthRules}
                element={(
                  <ProtectedRoute permission="shadow_knife:rule:view">
                    <ProtectedLayout>
                      <LengthShadowLinkagePage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.lengthShadowLinkage}
                element={<Navigate to={APP_ROUTES.shadowKnifeLengthRules} replace />}
              />

              <Route
                path={APP_ROUTES.instrumentFlow}
                element={(
                  <ProtectedRoute permission="flow:view">
                    <ProtectedLayout>
                      <InstrumentFlowTable />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.oneClickTransfer}
                element={(
                  <ProtectedRoute permission="transfer:view">
                    <ProtectedLayout>
                      <OneClickTransferPage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.instrumentManagement}
                element={(
                  <ProtectedRoute permission="instrument:view">
                    <ProtectedLayout>
                      <InstrumentList />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.statistics}
                element={(
                  <ProtectedRoute permission="stats:usage:view">
                    <ProtectedLayout>
                      <UsageStatistics />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.statisticsUsageConsumption}
                element={(
                  <ProtectedRoute permission="stats:usage:view">
                    <ProtectedLayout>
                      <UsageConsumption />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.statisticsInstrument}
                element={(
                  <ProtectedRoute permission="stats:instrument:view">
                    <ProtectedLayout>
                      <InstrumentStatistics />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettings}
                element={(
                  <ProtectedRoute permission="system:config:view">
                    <ProtectedLayout>
                      <Navigate to={APP_ROUTES.systemSettingsConfiguration} replace />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettingsUserManagement}
                element={(
                  <ProtectedRoute permission="system:user:view">
                    <ProtectedLayout>
                      <GeneralSettings />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettingsConfiguration}
                element={(
                  <ProtectedRoute permission="system:config:view">
                    <ProtectedLayout>
                      <GeneralSettings />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettingsDataBackup}
                element={(
                  <ProtectedRoute permission="system:backup:view">
                    <ProtectedLayout>
                      <BackupManager />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettingsOperationLogs}
                element={(
                  <ProtectedRoute permission="system:audit:view">
                    <ProtectedLayout>
                      <LogViewer />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route
                path={APP_ROUTES.systemSettingsMaintenance}
                element={(
                  <ProtectedRoute permission="system:maintenance:view">
                    <ProtectedLayout>
                      <SystemMaintenancePage />
                    </ProtectedLayout>
                  </ProtectedRoute>
                )}
              />

              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<Navigate to={APP_ROUTES.dashboard} replace />} />
            </Routes>
          </div>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
}

function HomeRedirect() {
  const { isAuthenticated, loading, user } = useAuth();

  const hasPermission = (permission: string) => {
    if (user?.is_system_admin) {
      return true;
    }

    const permissions = user?.permissions || [];
    if (permissions.includes(permission)) {
      return true;
    }

    const parts = permission.split(':');
    let current = '';
    for (let index = 0; index < parts.length - 1; index += 1) {
      current += `${index === 0 ? '' : ':'}${parts[index]}`;
      if (permissions.includes(current)) {
        return true;
      }
    }

    return false;
  };

  if (loading) return <div className="loading">{'\u52a0\u8f7d\u4e2d...'}</div>;

  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  const defaultRoute = [
    [APP_ROUTES.dashboard, 'dashboard:alert:view'],
    [APP_ROUTES.dashboardSchedule, 'dashboard:schedule:view'],
    [APP_ROUTES.shadowKnifeTaskBoard, 'shadow_knife:task:view'],
    [APP_ROUTES.shadowKnifeLengthRules, 'shadow_knife:rule:view'],
    [APP_ROUTES.instrumentFlow, 'flow:view'],
    [APP_ROUTES.instrumentManagement, 'instrument:view'],
    [APP_ROUTES.statisticsInstrument, 'stats:instrument:view'],
    [APP_ROUTES.statisticsUsageConsumption, 'stats:usage:view'],
    [APP_ROUTES.oneClickTransfer, 'transfer:view'],
  ].find(([, permission]) => hasPermission(permission))?.[0] || APP_ROUTES.login;

  return <Navigate to={defaultRoute} replace />;
}

export default memo(App);
