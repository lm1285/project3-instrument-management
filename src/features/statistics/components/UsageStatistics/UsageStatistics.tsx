import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Spin, DatePicker, Radio, Table, message } from 'antd';
import { BarChartOutlined, LineChartOutlined, OrderedListOutlined } from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import styles from './UsageStatistics.module.css';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import apiClient from '../../../../services/apiClient';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const COLORS = ['#1677ff', '#13c2c2', '#faad14', '#722ed1', '#52c41a', '#eb2f96'];

const UsageStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [trendType, setTrendType] = useState<'day' | 'month'>('day');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [topUsedData, setTopUsedData] = useState<any[]>([]);
  const [recentData, setRecentData] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [start, end] = dateRange;
      const startDate = start.format('YYYY-MM-DD');
      const endDate = end.format('YYYY-MM-DD');

      const trendRes = await apiClient.get('/statistics/trends', {
        params: { startDate, endDate, type: trendType },
      });
      if (trendRes.success) setTrendData(trendRes.data);

      const topRes = await apiClient.get('/statistics/top-used', { params: { limit: 10 } });
      if (topRes.success) setTopUsedData(topRes.data);

      const recentRes = await apiClient.get('/statistics/recent', { params: { limit: 10 } });
      if (recentRes.success) setRecentData(recentRes.data);
    } catch (error) {
      console.error(error);
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange, trendType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recentColumns = [
    { title: '仪器名称', dataIndex: 'name', key: 'name' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: '操作人', dataIndex: 'operator', key: 'operator' },
    { title: '动作', dataIndex: 'action', key: 'action' },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
    },
  ];

  return (
    <PermissionGuard permission="stats:usage:view">
      <div className={styles.container}>
        <ModuleHeader
          title="使用统计"
          icon={<BarChartOutlined />}
          eyebrow="Usage Analytics"
          subtitle="按时间趋势、常用设备和最近记录观察仪器使用情况。"
          meta={['趋势分析', 'Top 排行与最近记录']}
        />

        <Card className={styles.content} variant="borderless">
          <Card className={styles.filterCard} style={{ marginBottom: 12 }} variant="borderless">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span>时间范围:</span>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
                  allowClear={false}
                />
              </div>
              <Radio.Group value={trendType} onChange={(e) => setTrendType(e.target.value)}>
                <Radio.Button value="day">按日</Radio.Button>
                <Radio.Button value="month">按月</Radio.Button>
              </Radio.Group>
            </div>
          </Card>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 50 }}>
              <Spin size="large" />
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              <Col span={24}>
                <Card title={<span><LineChartOutlined /> 使用趋势</span>} variant="borderless">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" name="使用次数" stroke="#1677ff" activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              <Col span={12}>
                <Card title={<span><BarChartOutlined /> 常用仪器 Top 10</span>} variant="borderless">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={topUsedData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="使用次数" fill="#1677ff">
                        {topUsedData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>

              <Col span={12}>
                <Card title={<span><OrderedListOutlined /> 最近使用记录</span>} variant="borderless">
                  <Table
                    dataSource={recentData}
                    columns={recentColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                    scroll={{ y: 350 }}
                  />
                </Card>
              </Col>
            </Row>
          )}
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default UsageStatistics;
