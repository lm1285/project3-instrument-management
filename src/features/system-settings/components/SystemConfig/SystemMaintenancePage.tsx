import React from 'react';
import { Alert, Button, Card, Tabs } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import { useSystemMaintenanceManager } from '../../hooks/useSystemMaintenanceManager';
import MaintenanceSimpleView from './MaintenanceSimpleView';
import { buildSystemMaintenanceTabItems } from './systemMaintenanceConfig';

const SystemMaintenancePage: React.FC = () => {
  const {
    maintenance,
    saving,
    isAdvancedMode,
    setIsAdvancedMode,
    handleSaveSettings,
    updateSettings,
    handleCleanCache,
    handleAnalyzeIndex,
  } = useSystemMaintenanceManager();

  const items = buildSystemMaintenanceTabItems({
    maintenance,
    updateSettings,
    onCleanCache: handleCleanCache,
    onAnalyzeIndex: handleAnalyzeIndex,
  });

  return (
    <PermissionGuard permission="system:maintenance:view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ModuleHeader
          title="系统维护"
          icon={<SafetyCertificateOutlined />}
          eyebrow="System Maintenance"
          subtitle="集中执行缓存清理、索引分析和维护参数管理。"
          meta={['维护控制台', isAdvancedMode ? '高级模式' : '简易模式']}
          extra={isAdvancedMode ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setIsAdvancedMode(false)}>
                返回简易模式
              </Button>
              <PermissionGuard permission="system:maintenance:edit">
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveSettings} loading={saving}>
                  保存配置
                </Button>
              </PermissionGuard>
            </div>
          ) : null}
        />

        {!isAdvancedMode ? (
          <MaintenanceSimpleView onSwitchToAdvanced={() => setIsAdvancedMode(true)} />
        ) : (
          <Card variant="borderless" styles={{ body: { padding: '14px' } }}>
            <Alert
              message="系统维护操作可能影响系统性能，建议在业务低峰期执行。"
              type="warning"
              showIcon
              closable
              style={{ marginBottom: 14 }}
            />
            <Tabs defaultActiveKey="cache" items={items} size="large" />
          </Card>
        )}
      </div>
    </PermissionGuard>
  );
};

export default SystemMaintenancePage;
