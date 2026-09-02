import React from 'react';
import { Card, Statistic, Row, Col, Spin, Select, Tabs, Radio, Modal, Input, Space } from 'antd';
import { 
  BarChartOutlined, 
  ExperimentOutlined, 
  DatabaseOutlined, 
  PieChartOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { 
  BarChart, Bar, PieChart, Pie, LineChart, Line, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import styles from './InstrumentStatistics.module.css';
import { PermissionGuard } from '../../../../features/auth/components/PermissionGuard';
import { useInstrumentStatistics } from '../../hooks/useInstrumentStatistics';
import ModuleHeader from '../../../../components/UI/ModuleHeader';

const { Option } = Select;

// 定义颜色常量
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const STATUS_COLORS: Record<string, string> = {
  '使用中': '#52c41a', // green
  '停用': '#faad14',   // orange
  '已使用': '#1890ff', // blue
  '超期': '#f5222d',   // red
};

const InstrumentStatistics: React.FC = () => {
  const {
    loading,
    selectedDept,
    setSelectedDept,
    selectedType,
    setSelectedType,
    selectedStatus,
    setSelectedStatus,
    deptChartType,
    setDeptChartType,
    statusChartType,
    setStatusChartType,
    purchaseDateDimension,
    setPurchaseDateDimension,
    isSaveModalVisible,
    setIsSaveModalVisible,
    viewName,
    setViewName,
    stats,
    chartData,
    departments,
    handleSaveView
  } = useInstrumentStatistics();

  if (loading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" tip="正在加载统计数据...">
          <div style={{ height: 50 }} />
        </Spin>
      </div>
    );
  }

  return (
    <PermissionGuard permission="stats:instrument:view">
    <>
      <ModuleHeader title="仪器统计" icon={<PieChartOutlined />} />
      {/* 顶部筛选栏 */}
      <Card className={styles.filterCard} variant="borderless" style={{ marginBottom: '10px', marginTop: '10px' }}>
        <Space size={7}>
          <Select 
            value={selectedDept} 
            onChange={setSelectedDept} 
            style={{ width: '150px', height: '48px' }}
          >
            <Option value="all">全部科室</Option>
            {departments.map(d => <Option key={d} value={d}>{d}</Option>)}
          </Select>
          <Select 
            value={selectedType} 
            onChange={setSelectedType} 
            style={{ width: '150px', height: '48px' }}
          >
            <Option value="all">全部类型</Option>
            <Option value="标准器">标准器</Option>
            <Option value="标准物质">标准物质</Option>
            <Option value="辅助设备">辅助设备</Option>
          </Select>
          <Select 
            value={selectedStatus} 
            onChange={setSelectedStatus} 
            style={{ width: '150px', height: '48px' }}
          >
            <Option value="all">全部状态</Option>
            <Option value="使用中">使用中</Option>
            <Option value="超期">超期</Option>
            <Option value="停用">停用</Option>
            <Option value="已使用">已使用</Option>
          </Select>
        </Space>
      </Card>

      {/* 概览卡片 */}
      <Row gutter={[16, 16]} className={styles.statisticsRow}>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="仪器总数"
              value={stats.totalCount}
              prefix={<AppstoreOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="使用中"
              value={stats.statusCounts.inUse}
              valueStyle={{ color: '#52c41a' }}
              suffix={<span style={{ fontSize: 12, color: '#999' }}>({((stats.statusCounts.inUse / stats.totalCount || 0) * 100).toFixed(1)}%)</span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="超期/预警"
              value={stats.statusCounts.expired}
              valueStyle={{ color: '#f5222d' }}
              prefix={<span style={{width: 8, height: 8, borderRadius: '50%', background: '#f5222d', display: 'inline-block', marginRight: 8}}></span>}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="标准器"
              value={stats.typeCounts.standard}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="标准物质"
              value={stats.typeCounts.material}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" className={styles.card}>
            <Statistic
              title="在库率"
              value={stats.stockCounts.inStock}
              suffix={`/ ${stats.totalCount}`}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细统计视图 */}
      <div className={styles.chartSection}>
        <Tabs 
          defaultActiveKey="overview" 
          type="card"
          items={[
            {
              key: 'overview',
              label: <span><PieChartOutlined />分布概览</span>,
              children: (
                <>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Card 
                      title="仪器状态分布" 
                      variant="borderless" 
                      className={styles.chartCard}
                      extra={
                        <Radio.Group size="small" value={statusChartType} onChange={e => setStatusChartType(e.target.value)}>
                          <Radio.Button value="pie"><PieChartOutlined /></Radio.Button>
                          <Radio.Button value="bar"><BarChartOutlined /></Radio.Button>
                        </Radio.Group>
                      }
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        {statusChartType === 'pie' ? (
                          <PieChart>
                            <Pie
                              data={chartData.statusData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {chartData.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : (
                          <BarChart data={chartData.statusData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" name="数量">
                              {chartData.statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="仪器类型分布" variant="borderless" className={styles.chartCard}>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={chartData.typeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                            label
                          >
                            {chartData.typeData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card 
                      title="科室分布" 
                      variant="borderless" 
                      className={styles.chartCard}
                      extra={
                        <Radio.Group size="small" value={deptChartType} onChange={e => setDeptChartType(e.target.value)}>
                          <Radio.Button value="bar"><BarChartOutlined /></Radio.Button>
                          <Radio.Button value="pie"><PieChartOutlined /></Radio.Button>
                        </Radio.Group>
                      }
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        {deptChartType === 'bar' ? (
                          <BarChart data={chartData.deptData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={80} />
                            <Tooltip />
                            <Bar dataKey="value" name="仪器数量" fill="#8884d8">
                              {chartData.deptData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        ) : (
                          <PieChart>
                            <Pie
                              data={chartData.deptData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {chartData.deptData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        )}
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                </Row>
                {/* 购置趋势图表 */}
                <Row style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <Card 
                      title="购置趋势 (启用日期)" 
                      variant="borderless" 
                      className={styles.chartCard}
                      extra={
                        <Radio.Group value={purchaseDateDimension} onChange={e => setPurchaseDateDimension(e.target.value)}>
                          <Radio.Button value="year">按年</Radio.Button>
                          <Radio.Button value="month">按月</Radio.Button>
                        </Radio.Group>
                      }
                    >
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={chartData.purchaseTrendData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="value" name="购置数量" stroke="#8884d8" activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </Col>
                </Row>
                </>
              )
            }
          ]}
        />
      </div>

      <Modal
        title="保存统计视图"
        open={isSaveModalVisible}
        onOk={handleSaveView}
        okText="保存"
        cancelText="取消"
        onCancel={() => setIsSaveModalVisible(false)}
      >
        <p>请输入视图名称：</p>
        <Input 
          placeholder="例如：月度热工仪表统计" 
          value={viewName} 
          onChange={e => setViewName(e.target.value)} 
        />
      </Modal>
    </>
    </PermissionGuard>
  );
};

export default InstrumentStatistics;
