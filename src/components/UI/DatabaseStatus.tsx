import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';

export const DatabaseStatus: React.FC = () => {
  const [dbInfo, setDbInfo] = useState<{ status: string; path: string } | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await apiClient.get('/settings/database');
        const data: any = res?.data || {};
        if (mounted) {
          setDbInfo({ status: String(data.status || 'unknown'), path: String(data.path || '') });
        }
      } catch {
        if (mounted) {
          setDbInfo({ status: 'error', path: '' });
        }
      }
    };

    void load();
    const timer = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const dbColor = useMemo(() => {
    const status = String(dbInfo?.status || 'unknown');
    if (status === 'connected') return '#52c41a';
    if (status === 'disconnected' || status === 'error') return '#ff4d4f';
    return '#faad14';
  }, [dbInfo]);

  const dbText = useMemo(() => {
    const status = String(dbInfo?.status || 'unknown');
    if (status === 'connected') return '数据库 已连接';
    if (status === 'disconnected') return '数据库 未连接';
    if (status === 'error') return '数据库 错误';
    return '数据库 状态未知';
  }, [dbInfo]);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span
        title={dbInfo?.path || ''}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 16,
          padding: '4px 12px',
          fontSize: 12,
          border: '1px solid #d9d9d9',
          background: '#fff',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: dbColor,
            marginRight: 8,
          }}
        />
        <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>{dbText}</span>
      </span>
    </div>
  );
};
