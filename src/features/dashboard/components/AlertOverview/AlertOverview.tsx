import React, { useEffect, useMemo, useState } from 'react';
import { Card } from 'antd';
import { generateAlerts, getAlertStats } from '../../services/alertService';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';

const AlertOverview: React.FC = () => {
  const [overdueCount, setOverdueCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [stockLowCount, setStockLowCount] = useState(0);

  const refresh = async () => {
    const last = parseInt(localStorage.getItem('alerts_last_generate_at') || '0', 10);
    const needGenerate = Number.isNaN(last) || Date.now() - last > 10 * 60 * 1000;
    if (needGenerate) {
      await generateAlerts(30);
      localStorage.setItem('alerts_last_generate_at', String(Date.now()));
    }
    const res = await getAlertStats();
    const stats = (res.data as any) || { overdue: 0, upcoming: 0, stockLow: 0 };
    setOverdueCount(stats.overdue || 0);
    setUpcomingCount(stats.upcoming || 0);
    setStockLowCount(stats.stockLow || 0);
  };

  useEffect(() => {
    refresh();
  }, []);

  const stats = useMemo(
    () => ([
      {
        title: '超期预警',
        value: overdueCount,
        desc: '已超出复校日期的在用标准器和标准物质。',
      },
      {
        title: '即将到期',
        value: upcomingCount,
        desc: '根据预警提前天数识别的近期风险项目。',
      },
      {
        title: '库存不足',
        value: stockLowCount,
        desc: '低于容量阈值的仪器或合并组。',
      },
    ]),
    [overdueCount, upcomingCount, stockLowCount],
  );

  return (
    <PermissionGuard permission="dashboard:alert:view">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {stats.map((item) => (
          <Card key={item.title} title={item.title} variant="borderless">
            <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 700, color: '#303133', marginBottom: 10 }}>
              {item.value}
            </div>
            <div style={{ color: '#909399', fontSize: 12 }}>{item.desc}</div>
          </Card>
        ))}
      </div>
    </PermissionGuard>
  );
};

export default AlertOverview;
