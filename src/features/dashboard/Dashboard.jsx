import React from 'react';
import DashboardOverview from './components/DashboardOverview/DashboardOverview';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      {/* 使用新的DashboardOverview组件，包含搜索框和分页功能 */}
      <DashboardOverview />
    </div>
  );
};

export default Dashboard;