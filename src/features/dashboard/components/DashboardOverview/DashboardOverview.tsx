import React from 'react';
import { Select, Button } from 'antd';
import { DashboardOutlined } from '@ant-design/icons';
import ModuleHeader from '../../../../components/UI/ModuleHeader';
import SearchBar from '../../../../components/UI/SearchBar';
import Pagination from '../../../../components/UI/Pagination';
import styles from './DashboardOverview.module.css';
import { useDashboardOverview, AlertItem } from '../../hooks/useDashboardOverview';

const { Option } = Select;

const DashboardOverview: React.FC = () => {
  const {
    stats,
    loading,
    total,
    currentPage,
    pageSize,
    handleSearch,
    handlePageChange,
    getCurrentPageData,
    handleDelete,
    handleStatusChange
  } = useDashboardOverview();

  // 获取状态对应的样式类名
  const getStatusClassName = (status: AlertItem['status']) => {
    switch (status) {
      case 'warning':
        return styles.statusWarning;
      case 'danger':
        return styles.statusDanger;
      case 'info':
        return styles.statusInfo;
      case 'success':
        return styles.statusSuccess;
      default:
        return '';
    }
  };

  const filteredAlerts = getCurrentPageData();

  return (
    <div className={styles.container}>
      {/* 仪表板头部 */}
      <ModuleHeader 
        title="信息看板" 
        icon={<DashboardOutlined />}
        extra={
          <div className={styles.searchContainer}>
            <SearchBar
              placeholder="搜索预警信息、仪器ID或位置..."
              onSearch={handleSearch}
              className={styles.searchBar}
            />
          </div>
        }
      />
      <div style={{ marginTop: 10 }}></div>

      {/* 统计卡片 */}
      <div className={styles.statsContainer}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{stats.totalAlerts}</div>
          <div className={styles.statLabel}>总预警数</div>
        </div>
        <div className={`${styles.statCard} ${styles.warningCard}`}>
          <div className={styles.statNumber}>{stats.pendingAlerts}</div>
          <div className={styles.statLabel}>待处理</div>
        </div>
        <div className={`${styles.statCard} ${styles.dangerCard}`}>
          <div className={styles.statNumber}>{stats.criticalAlerts}</div>
          <div className={styles.statLabel}>危急预警</div>
        </div>
        <div className={`${styles.statCard} ${styles.successCard}`}>
          <div className={styles.statNumber}>{stats.resolvedAlerts}</div>
          <div className={styles.statLabel}>已解决</div>
        </div>
      </div>

      {/* 预警列表 */}
      <div className={styles.alertListContainer}>
        <div className={styles.listHeader}>
          <h3>预警信息列表</h3>
          <span className={styles.resultCount}>共 {total} 条记录</span>
        </div>

        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : total === 0 ? (
          <div className={styles.emptyState}>
            <p>没有找到符合条件的预警信息</p>
          </div>
        ) : (
          <div className={styles.alertTableContainer}>
            <table className={styles.alertTable}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>状态</th>
                  <th>位置</th>
                  <th>仪器ID</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td>{alert.id}</td>
                    <td>{alert.title}</td>
                    <td>
                      <Select 
                        value={alert.processedStatus} 
                        onChange={(v) => handleStatusChange(alert.id, v)}
                        style={{ width: 120 }}
                        size="small"
                        className={`${styles.statusBadge} ${getStatusClassName(alert.status)}`}
                        variant="borderless"
                      >
                        <Option value="预警">预警</Option>
                        <Option value="已提交质量">已提交质量</Option>
                        <Option value="已送检">已送检</Option>
                        <Option value="更新信息">更新信息</Option>
                        <Option value="溯源确认">溯源确认</Option>
                        <Option value="已完成">已完成</Option>
                      </Select>
                    </td>
                    <td>{alert.location}</td>
                    <td>{alert.instrumentId}</td>
                    <td>{alert.createTime}</td>
                    <td>
                      <Button 
                        type="link" 
                        danger 
                        size="small" 
                        onClick={() => handleDelete(alert.id)}
                      >
                        删除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页组件 */}
        {!loading && total > 0 && (
          <div className={styles.paginationContainer}>
            <Pagination
              total={total}
              pageSize={pageSize}
              current={currentPage}
              onChange={handlePageChange}
              showSizeChanger
              showTotal
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
