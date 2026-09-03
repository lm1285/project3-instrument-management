import React, { useMemo } from 'react';
import { Card, Tabs } from 'antd';
import {
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSystemSettings } from '../../hooks/useSystemSettings';
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

  const items = useMemo(() => hasPermission('system:user:view') ? [{
    key: 'users',
    label: <span><TeamOutlined /> 用户管理</span>,
    children: <UserManagement />,
  }] : [], [hasPermission]);

  const activeKey = useMemo(() => {
    if (location.pathname === APP_ROUTES.systemSettingsUserManagement && items.some((item) => item.key === 'users')) {
      return 'users';
    }

    return items[0]?.key;
  }, [items, location.pathname]);

  const handleTabChange = (key: string) => {
    if (key === 'users') {
      navigate(APP_ROUTES.systemSettingsUserManagement);
      return;
    }

    return;
  };

  return (
    <PermissionGuard permission={['system:config:view', 'system:user:view']}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModuleHeader
          title="系统配置"
          icon={<SettingOutlined />}
          eyebrow="System Configuration"
          subtitle="统一管理系统用户与基础菜单配置。"
          meta={['用户管理与系统配置已合并', '个性化与模板配置暂未启用']}
        />

        <Card variant="borderless" styles={{ body: { padding: '0 14px 14px' } }}>
          <Tabs activeKey={activeKey} items={items} onChange={handleTabChange} />
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default GeneralSettings;
