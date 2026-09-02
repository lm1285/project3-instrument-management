import React from 'react';

export const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
  return (
    <div className="placeholder-page">
      {/* 模块标题栏 - 带渐变色 */}
      <div className="module-header">
        <h1 className="module-title">{title}</h1>
      </div>
      
      <div className="development-placeholder">
        <div className="placeholder-icon">🔧</div>
        <h2 className="placeholder-heading">功能开发中</h2>
        <p className="placeholder-description">该功能模块正在积极开发中，敬请期待...</p>
        
        <div className="placeholder-stats">
          <div className="stat-card">
            <div className="stat-number">95%</div>
            <div className="stat-label">完成度</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">2周</div>
            <div className="stat-label">预计上线</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">5+</div>
            <div className="stat-label">新功能</div>
          </div>
        </div>
      </div>
    </div>
  );
};
