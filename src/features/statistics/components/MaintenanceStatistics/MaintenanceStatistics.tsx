import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Spin, Table, Statistic, Button, message } from 'antd';
import { ToolOutlined, ScheduleOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import apiClient from '../../../../services/apiClient';
import dayjs from 'dayjs';

const MaintenanceStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    valid: 0,
    expiringSoon: 0,
    expired: 0,
  });
  const [monthlyDue, setMonthlyDue] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all instruments (limit 1000 for now) to calculate calibration stats
      // Ideally backend should provide this aggregation
      const res = await apiClient.get('/instruments', {
        params: { pageSize: 1000, type: '标准器,标准物质,辅助设备' } // Only these types need calibration usually
      });
      
      if (res.success && res.data && res.data.data) {
        const list = res.data.data;
        setInstruments(list);
        
        // Process stats
        const now = dayjs();
        const nextMonth = now.add(30, 'day');
        
        let valid = 0;
        let expiringSoon = 0;
        let expired = 0;
        
        const monthlyCount: Record<string, number> = {};
        // Initialize next 12 months
        for (let i = 0; i < 12; i++) {
          monthlyCount[now.add(i, 'month').format('YYYY-MM')] = 0;
        }

        list.forEach((inst: any) => {
          if (!inst.nextCalibrationDate) return;
          const due = dayjs(inst.nextCalibrationDate);
          
          if (due.isBefore(now, 'day')) {
            expired++;
          } else if (due.isBefore(nextMonth, 'day')) {
            expiringSoon++;
          } else {
            valid++;
          }
          
          const monthKey = due.format('YYYY-MM');
          if (monthlyCount[monthKey] !== undefined) {
            monthlyCount[monthKey]++;
          }
        });
        
        setStats({
          total: list.length,
          valid,
          expiringSoon,
          expired
        });
        
        setMonthlyDue(Object.keys(monthlyCount).map(k => ({
          month: k,
          count: monthlyCount[k]
        })));
      }

    } catch (error) {
      console.error(error);
      message.error('获取维护统计数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pieData = [
    { name: '有效', value: stats.valid },
    { name: '即将到期', value: stats.expiringSoon },
    { name: '已过期', value: stats.expired },
  ].filter(d => d.value > 0);

  const columns = [
    { title: '仪器名称', dataIndex: 'name', key: 'name' },
    { title: '管理编号', dataIndex: 'managementNumber', key: 'managementNumber' },
    { title: '下次校准日期', dataIndex: 'nextCalibrationDate', key: 'nextCalibrationDate', render: (t: string) => <span style={{ color: dayjs(t).isBefore(dayjs()) ? 'red' : 'inherit' }}>{t}</span> },
    { title: '存放位置', dataIndex: 'location', key: 'location' },
  ];

  // Filter instruments for the table (show expired/expiring first)
  const tableData = instruments
    .filter((i: any) => i.nextCalibrationDate)
    .sort((a: any, b: any) => dayjs(a.nextCalibrationDate).valueOf() - dayjs(b.nextCalibrationDate).valueOf())
    .slice(0, 10);

  return (
    <PermissionGuard permission="stats:maintenance:view">
      <>
        <ModuleHeader 
          title="维护统计" 
          icon={<ToolOutlined />} 
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
                      title="校准状态正常"
                      value={stats.valid}
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<CheckCircleOutlined />}
                      suffix={`/ ${stats.total}`}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ border: 'none' }}>
                    <Statistic
                      title="即将到期 (30天内)"
                      value={stats.expiringSoon}
                      valueStyle={{ color: '#faad14' }}
                      prefix={<ScheduleOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ border: 'none' }}>
                    <Statistic
                      title="已过期"
                      value={stats.expired}
                      valueStyle={{ color: '#f5222d' }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                {/* Monthly Due Chart */}
                <Col span={24}>
                  <Card title="未来12个月校准计划" style={{ marginBottom: 16, border: 'none' }}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyDue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="待校准数量" fill="#1890ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </Col>

                {/* Pie Chart */}
                <Col span={8}>
                  <Card title="校准状态分布" style={{ height: '100%', border: 'none' }}>
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
                            <Cell key={`cell-${index}`} fill={entry.name === '有效' ? '#52c41a' : entry.name === '即将到期' ? '#faad14' : '#f5222d'} />
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
                  <Card title="近期需校准仪器" style={{ height: '100%', border: 'none' }}>
                    <Table
                      dataSource={tableData}
                      columns={columns}
                      rowKey="id"
                      pagination={false}
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

export default MaintenanceStatistics;
