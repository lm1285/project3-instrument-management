import React from 'react';

/**
 * 可排序的表格头部组件
 * @param {Object} props - 组件属性
 * @param {string} props.column - 列名
 * @param {Object} props.config - 列配置
 * @param {string} props.sortField - 当前排序字段
 * @param {string} props.sortDirection - 当前排序方向
 * @param {Function} props.handleSort - 排序处理函数
 * @param {Function} props.handleDragStart - 拖拽开始处理函数
 * @param {Function} props.handleDragOver - 拖拽悬停处理函数
 * @param {Function} props.handleDrop - 拖拽放置处理函数
 * @param {Object} props.columnWidths - 列宽配置
 * @param {boolean} props.selectAll - 是否全选
 * @param {Array} props.instruments - 仪器数据数组
 * @param {Function} props.handleSelectAll - 全选处理函数
 * @param {Function} props.handleColumnResize - 列宽调整处理函数
 */
const SortableTableHeader = ({ 
  column, 
  config, 
  sortField, 
  sortDirection, 
  handleSort, 
  handleDragStart, 
  handleDragOver, 
  handleDrop, 
  columnWidths,
  selectAll = false,
  instruments = [],
  handleSelectAll,
  handleColumnResize
}) => {
  const isSortable = config.sortable && column !== 'checkbox' && column !== 'action';
  const isActive = isSortable && sortField === column;
  
  // 处理列宽调整
  const handleResize = (e) => {
    const startX = e.pageX;
    const startWidth = columnWidths[column] || config.width;
      
    const handleMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.pageX - startX);
      if (newWidth > 50) { // 最小宽度限制
        if (handleColumnResize) {
          handleColumnResize(column, newWidth);
        }
      }
    }
      
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
      
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };
  
  return (
    <th
      key={column}
      className={column === 'checkbox' ? 'checkbox-col' : column === 'action' ? 'action-col' : ''}
      style={{
        width: `${columnWidths[column] || config.width}px`,
        cursor: isSortable ? 'pointer' : (column !== 'checkbox' && column !== 'action' ? 'grab' : 'default')
      }}
      draggable={column !== 'checkbox' && column !== 'action'}
      onDragStart={(e) => handleDragStart(column, e)}
      onDragOver={handleDragOver}
      onDrop={() => handleDrop(column)}
      onClick={() => isSortable && handleSort(column)}
    >
      {column === 'checkbox' && handleSelectAll ? (
        <input
          type="checkbox"
          checked={selectAll && instruments.length > 0}
          onChange={handleSelectAll}
        />
      ) : (
        <div className="column-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {config.label}
          {isSortable && (
            <div style={{ marginLeft: '4px', fontSize: '12px', color: '#666' }}>
              {isActive ? (
                sortDirection === 'asc' ? '▲' : '▼'
              ) : '↕'}
            </div>
          )}
          {column !== 'checkbox' && (
            <div 
              className="column-resizer"
              onMouseDown={handleResize}
            >
              <div className="resizer-handle"></div>
            </div>
          )}
        </div>
      )}
    </th>
  );
};

export default SortableTableHeader;