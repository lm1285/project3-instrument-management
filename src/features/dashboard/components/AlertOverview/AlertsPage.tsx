import React from 'react';
import { AlertOutlined } from '@ant-design/icons';
import AlertOverview from './AlertOverview';
import AlertList from '../AlertList/AlertList';
import AlertHistory from '../AlertHistory/AlertHistory';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import './AlertsPage.css';

const AlertsPage: React.FC = () => {
  return (
    <PermissionGuard permission="dashboard:alert:view">
      <div className="alerts-page">
        <ModuleHeader
          title="预警总览"
          eyebrow="Operations Center"
          subtitle="把临期、超期、库存不足和处理进度收拢到同一个工作区，让风险判断和后续处理更直接。"
          icon={<AlertOutlined />}
          meta={['全局风险监控', '支持单项与分组处理']}
        />

        <section className="alerts-section">
          <AlertOverview />
        </section>

        <section className="alerts-section">
          <AlertList />
        </section>

        <section className="alerts-section">
          <AlertHistory />
        </section>
      </div>
    </PermissionGuard>
  );
};

export default AlertsPage;
