import React, { useMemo } from 'react';
import { Card, Tabs } from 'antd';
import {
  LayoutOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import PersonalizationSettings from './settings/PersonalizationSettings';
import TemplateSettings from './settings/TemplateSettings';
import UserManagement from '../UserManagement/UserManagement';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import { usePermission } from '../../../../hooks/usePermission';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import { APP_ROUTES } from '../../../../constants/routes';

const GeneralSettings: React.FC = () => {
  useSystemSettings();
  const { hasPermission } = usePermission();
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(() => [
    {
      key: 'users',
      label: <span><TeamOutlined /> 用户管理</span>,
      children: <UserManagement />,
    },
    {
      key: 'personalization',
      label: <span><SettingOutlined /> 个性化设置</span>,
      children: <PersonalizationSettings />,
    },
    {
      key: 'template',
      label: <span><LayoutOutlined /> 模板设置</span>,
      children: <TemplateSettings />,
    },
  ].filter((item) => {
    if (item.key === 'users') {
      return hasPermission('system:user:view');
    }

    if (item.key === 'template') {
      return hasPermission('system:template:view');
    }

    if (item.key === 'personalization') {
      return hasPermission('system:config:view');
    }

    return true;
  }), [hasPermission]);

  const activeKey = useMemo(() => {
    if (location.pathname === APP_ROUTES.systemSettingsUserManagement && items.some((item) => item.key === 'users')) {
      return 'users';
    }

    if (items.some((item) => item.key === 'personalization')) {
      return 'personalization';
    }

    return items[0]?.key;
  }, [items, location.pathname]);

  const handleTabChange = (key: string) => {
    if (key === 'users') {
      navigate(APP_ROUTES.systemSettingsUserManagement);
      return;
    }

    navigate(APP_ROUTES.systemSettingsConfiguration);
  };

  return (
    <PermissionGuard permission={['system:config:view', 'system:user:view', 'system:template:view']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModuleHeader
          title="系统配置"
          icon={<SettingOutlined />}
          eyebrow="System Configuration"
          subtitle="统一管理用户、个性化和模板配置，用户管理与菜单设置已整合到同一套界面中。"
          meta={['用户管理与系统配置已合并', '保留顶部用户菜单作为主入口']}
        />

        <Card variant="borderless" styles={{ body: { padding: '0 14px 14px' } }}>
          <Tabs activeKey={activeKey} items={items} onChange={handleTabChange} />
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default GeneralSettings;
