import React from 'react';
import './TableStyles.css';

/**
 * 仪器列表表格组件
 * 用于展示仪器数据，支持分页、排序、选择等功能
 */
const InstrumentTable = ({ 
  data = [], 
  columns = [], 
  selectedItems = [], 
  onSelectAll, 
  onSelectItem, 
  onPageChange, 
  onSort, 
  currentPage, 
  pageSize, 
  totalItems, 
  onEdit, 
  onDelete,
  onDetail,
  onExtend,
  onExport,
  sortConfig
}) => {
  // 计算总页数
  const totalPages = Math.ceil(totalItems / pageSize);

  // 处理全选
  const handleSelectAll = (checked) => {
    onSelectAll(checked);
  };

  // 处理单个选择
  const handleSelectItem = (id) => {
    onSelectItem(id);
  };

  // 处理页码变化
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  // 处理排序
  const handleSort = (column) => {
    onSort(column);
  };

  // 格式化日期显示
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN');
    } catch (error) {
      return dateString;
    }
  };

  // 渲染状态标签
  const renderStatusTag = (status) => {
    const statusMap = {
      '正常': 'status-normal',
      '禁用': 'status-disabled',
      '待校准': 'status-pending',
      '已过期': 'status-expired',
      '维修中': 'status-repairing'
    };

    return (
      <span className={`status-tag ${statusMap[status] || ''}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="table-container">
      {/* 表格头部 - 操作按钮 */}
      <div className="table-header-actions">
        <div className="action-buttons">
          <button 
            className={`btn btn-primary ${selectedItems.length === 0 ? 'disabled' : ''}`}
            onClick={onDelete}
            disabled={selectedItems.length === 0}
          >
            批量删除
          </button>
          <button 
            className="btn btn-secondary"
            onClick={onExport}
          >
            导出
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {/* 复选框列 */}
              <th className="checkbox-column">
                <input
                  type="checkbox"
                  checked={selectedItems.length > 0 && selectedItems.length === data.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              
              {/* 列标题 */}
              {columns.map(column => (
                <th 
                  key={column.key}
                  className={column.sortable ? 'sortable' : ''}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  {column.title}
                  {column.sortable && sortConfig && sortConfig.key === column.key && (
                    <span className={`sort-icon ${sortConfig.direction}`}>
                      {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map(item => (
                <tr key={item.id} className="table-row">
                  {/* 复选框 */}
                  <td className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                    />
                  </td>
                  
                  {/* 数据列 */}
                  {columns.map(column => {
                    const value = item[column.key];
                    
                    // 根据列类型渲染不同的内容
                    if (column.key === 'status') {
                      return <td key={column.key}>{renderStatusTag(value)}</td>;
                    } else if (column.type === 'date') {
                      return <td key={column.key}>{formatDate(value)}</td>;
                    } else if (column.render) {
                      return <td key={column.key}>{column.render(item)}</td>;
                    } else {
                      return <td key={column.key}>{value || ''}</td>;
                    }
                  })}
                  
                  {/* 操作列 */}
                  <td className="action-column">
                    <div className="action-buttons-group">
                      <button 
                        className="btn btn-action btn-detail"
                        onClick={() => onDetail(item.id)}
                        title="查看详情"
                      >
                        详情
                      </button>
                      <button 
                        className="btn btn-action btn-edit"
                        onClick={() => onEdit(item.id)}
                        title="编辑"
                      >
                        编辑
                      </button>
                      <button 
                        className="btn btn-action btn-extend"
                        onClick={() => onExtend(item.id)}
                        title="延期"
                      >
                        延期
                      </button>
                      <button 
                        className="btn btn-action btn-delete"
                        onClick={() => onDelete([item.id])}
                        title="删除"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 2} className="empty-row">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页控件 */}
      <div className="pagination">
        <div className="pagination-info">
          共 {totalItems} 条记录，每页 {pageSize} 条
        </div>
        <div className="pagination-controls">
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            首页
          </button>
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            上一页
          </button>
          
          {/* 页码按钮 */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button 
                key={pageNum}
                className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            下一页
          </button>
          <button 
            className="pagination-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            末页
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstrumentTable;