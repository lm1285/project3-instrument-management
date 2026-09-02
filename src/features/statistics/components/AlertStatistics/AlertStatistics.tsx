import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Spin, Table, Tag, Statistic, Button, message } from 'antd';
import { AlertOutlined, WarningOutlined, ExclamationCircleOutlined, DatabaseOutlined, ReloadOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import apiClient from '../../../../services/apiClient';
import dayjs from 'dayjs';

const COLORS = {
  '超期': '#f5222d',
  '预到期': '#faad14',
  '库存不足': '#722ed1',
};

const AlertStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ overdue: 0, upcoming: 0, stockLow: 0 });
  const [alertList, setAlertList] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Stats
      const statsRes = await apiClient.get('/alerts/stats');
      if (statsRes.success) {
        setStats(statsRes.data);
      }

      // Fetch Active Alerts List
      const listRes = await apiClient.get('/alerts', {
        params: { status: '预警', pageSize: 100 } // Get top 100 active alerts
      });
      if (listRes.success) {
        setAlertList(listRes.data);
      }

    } catch (error) {
      console.error(error);
      message.error('获取告警数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pieData = [
    { name: '超期', value: stats.overdue },
    { name: '预到期', value: stats.upcoming },
    { name: '库存不足', value: stats.stockLow },
  ].filter(d => d.value > 0);

  const columns = [
    {
      title: '类型',
      dataIndex: 'alertType',
      key: 'alertType',
      render: (type: string) => (
        <Tag color={COLORS[type as keyof typeof COLORS] || 'default'}>{type}</Tag>
      ),
    },
    { title: '仪器名称', dataIndex: 'name', key: 'name' },
    { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber' },
    { title: '剩余天数', dataIndex: 'remainingDays', key: 'remainingDays', render: (d: number) => d < 0 ? `逾期 ${Math.abs(d)} 天` : `${d} 天` },
    { title: '生成时间', dataIndex: 'generatedTime', key: 'generatedTime', render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm') },
  ];

  return (
    <PermissionGuard permission="stats:alert:view">
      <>
        <ModuleHeader 
          title="告警统计" 
          icon={<AlertOutlined />} 
          extra={<Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>}
        />
        
        <div style={{ padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 50 }}>
              <Spin size="large" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card style={{ border: 'none' }}>
                    <Statistic
                      title="超期告警"
                      value={stats.overdue}
                      valueStyle={{ color: '#f5222d' }}
                      prefix={<ExclamationCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ border: 'none' }}>
                    <Statistic
                      title="预到期提醒"
                      value={stats.upcoming}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<WarningOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ border: 'none' }}>
                    <Statistic
                      title="库存不足"
                      value={stats.stockLow}
                      valueStyle={{ color: '#722ed1' }}
                      prefix={<DatabaseOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                {/* Chart */}
                <Col span={8}>
                  <Card title="告警分布" style={{ height: '100%', border: 'none' }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                {/* List */}
                <Col span={16}>
                  <Card title="当前活跃告警" style={{ height: '100%', border: 'none' }}>
                    <Table
                      dataSource={alertList}
                      columns={columns}
                      rowKey="id"
                      pagination={{ pageSize: 5 }}
                      size="small"
                    />
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </div>
      </>
    </PermissionGuard>
  );
};

export default AlertStatistics;
