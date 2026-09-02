import React, { useEffect, useState } from 'react';
import { Table } from 'antd';
import { getAlertHistory } from '../../services/alertService';

const AlertHistory: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    getAlertHistory()
      .then(res => {
        const list = (res.data as any) || [];
        // 只显示已完成或已删除的记录
        const filtered = list.filter((item: any) => 
          item.processedStatus === '已完成' || item.processedStatus === '已删除'
        );
        setData(filtered);
      })
      .catch(() => setData([]));
  }, []);
  return (
    <div>
      <h3 style={{ marginBottom: 12 }}>预警历史记录</h3>
      <Table
        dataSource={data}
        rowKey={(r) => `${r.id}-${r.processedTime}`}
        pagination={{ pageSize: 20 }}
        columns={[
          { title: '预警级别', dataIndex: 'alertType', key: 'alertType', align: 'center' },
          { title: '名称', dataIndex: 'name', key: 'name', align: 'center' },
          { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber', align: 'center' },
          { title: '复校日期', dataIndex: 'recalibrationDate', key: 'recalibrationDate', align: 'center' },
          { title: '剩余天数', dataIndex: 'remainingDays', key: 'remainingDays', align: 'center' },
          { title: '处理状态', dataIndex: 'processedStatus', key: 'processedStatus', align: 'center' },
          { title: '处理人', dataIndex: 'processedBy', key: 'processedBy', align: 'center' },
          { title: '处理时间', dataIndex: 'processedTime', key: 'processedTime', align: 'center' }
        ]}
      />
    </div>
  );
};

export default AlertHistory;