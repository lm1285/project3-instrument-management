// InstrumentTable组件，用于显示仪器列表
import React from 'react';
import '../../styles/FormStyles.css';

const InstrumentTable = ({ 
  data = [], 
  onEdit, 
  onDelete, 
  onView, 
  loading = false,
  selectedItems = [],
  onSelectItem,
  showCheckbox = false
}) => {
  // 表格列配置
  const columns = [
    {
      key: 'name',
      title: '仪器名称',
      width: '180px'
    },
    {
      key: 'model',
      title: '型号',
      width: '120px'
    },
    {
      key: 'serialNumber',
      title: '序列号',
      width: '150px'
    },
    {
      key: 'manufacturer',
      title: '生产厂商',
      width: '120px'
    },
    {
      key: 'purchaseDate',
      title: '购买日期',
      width: '100px'
    },
    {
      key: 'location',
      title: '存放位置',
      width: '100px'
    },
    {
      key: 'status',
      title: '状态',
      width: '80px',
      render: (value) => {
        const statusMap = {
          inStock: { text: '在库', className: 'status-instock' },
          outStock: { text: '出库', className: 'status-outstock' },
          maintenance: { text: '维护中', className: 'status-maintenance' },
          broken: { text: '故障', className: 'status-broken' }
        };
        const status = statusMap[value] || { text: value, className: '' };
        return <span className={`status-badge ${status.className}`}>{status.text}</span>;
      }
    },
    {
      key: 'responsiblePerson',
      title: '负责人',
      width: '100px'
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      render: (_, record) => (
        <div className="table-actions">
          {onView && (
            <button 
              className="btn-action btn-view"
              onClick={() => onView(record)}
              title="查看"
            >
              👁️
            </button>
          )}
          {onEdit && (
            <button 
              className="btn-action btn-edit"
              onClick={() => onEdit(record)}
              title="编辑"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button 
              className="btn-action btn-delete"
              onClick={() => onDelete(record)}
              title="删除"
            >
              🗑️
            </button>
          )}
        </div>
      )
    }
  ];

  // 全选/取消全选
  const handleSelectAll = (e) => {
    if (onSelectItem) {
      if (e.target.checked) {
        data.forEach(item => onSelectItem(item.id, true));
      } else {
        data.forEach(item => onSelectItem(item.id, false));
      }
    }
  };

  // 单行选择
  const handleSelectItem = (e, id) => {
    if (onSelectItem) {
      onSelectItem(id, e.target.checked);
    }
  };

  // 检查是否全选
  const isAllSelected = data.length > 0 && selectedItems.length === data.length;

  return (
    <div className="table-container">
      {loading ? (
        <div className="table-loading">加载中...</div>
      ) : data.length === 0 ? (
        <div className="table-empty">暂无数据</div>
      ) : (
        <table className="instrument-table">
          <thead>
            <tr>
              {showCheckbox && (
                <th className="checkbox-column">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    aria-label="全选"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} style={{ width: column.width }}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record) => (
              <tr key={record.id}>
                {showCheckbox && (
                  <td className="checkbox-column">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(record.id)}
                      onChange={(e) => handleSelectItem(e, record.id)}
                      aria-label={`选择${record.name}`}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render ? column.render(record[column.key], record) : record[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default InstrumentTable;