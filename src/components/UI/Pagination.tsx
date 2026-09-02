import React from 'react';
import styles from './Pagination.module.css';
import useResponsive from '../../hooks/useResponsive';

interface PaginationProps {
  total: number; // 总条数
  pageSize: number; // 每页条数
  current: number; // 当前页码
  onChange: (page: number, pageSize?: number) => void;
  showSizeChanger?: boolean; // 是否显示每页条数选择器
  pageSizeOptions?: number[]; // 每页条数选项
  showTotal?: boolean; // 是否显示总条数
  className?: string;
}

/**
 * 分页组件
 * 提供数据分页、页码切换、每页条数选择功能
 */
const Pagination: React.FC<PaginationProps> = ({
  total,
  pageSize,
  current,
  onChange,
  showSizeChanger = true,
  pageSizeOptions = [10, 20, 50, 100],
  showTotal = true,
  className = '',
}) => {
  const { isMobile } = useResponsive();

  // 计算总页数
  const totalPages = Math.ceil(total / pageSize);

  // 处理页码点击
  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== current) {
      // 只传递页码参数，符合接口定义
      onChange(page);
    }
  };

  // 处理每页条数变化
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(e.target.value);
    const newCurrent = Math.min(current, Math.ceil(total / newPageSize));
    onChange(newCurrent, newPageSize);
  };

  // 生成页码数组
  const getPageItems = () => {
    // 移动端简化显示：只显示 上一页 [当前页/总页数] 下一页
    if (isMobile) {
      return [
        <button
          key="prev"
          className={`${styles.pageButton} ${current === 1 ? styles.disabled : ''}`}
          onClick={() => handlePageClick(current - 1)}
          disabled={current === 1}
        >
          上一页
        </button>,
        <span key="info" style={{ margin: '0 4px', fontSize: '12px' }}>
          {current}/{totalPages}
        </span>,
        <button
          key="next"
          className={`${styles.pageButton} ${current === totalPages ? styles.disabled : ''}`}
          onClick={() => handlePageClick(current + 1)}
          disabled={current === totalPages}
        >
          下一页
        </button>
      ];
    }

    const items = [];
    const startPage = Math.max(1, current - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    // 调整起始页码，确保显示5个页码
    const adjustedStartPage = Math.max(1, endPage - 4);

    // 上一页
    items.push(
      <button
        key="prev"
        className={`${styles.pageButton} ${current === 1 ? styles.disabled : ''}`}
        onClick={() => handlePageClick(current - 1)}
        disabled={current === 1}
      >
        上一页
      </button>
    );

    // 页码
    for (let i = adjustedStartPage; i <= endPage; i++) {
      items.push(
        <button
          key={i}
          className={`${styles.pageButton} ${current === i ? styles.active : ''}`}
          onClick={() => handlePageClick(i)}
        >
          {i}
        </button>
      );
    }

    // 下一页
    items.push(
      <button
        key="next"
        className={`${styles.pageButton} ${current === totalPages ? styles.disabled : ''}`}
        onClick={() => handlePageClick(current + 1)}
        disabled={current === totalPages}
      >
        下一页
      </button>
    );

    return items;
  };

  if (total < 0) {
    return null;
  }

  return (
    <div className={`${styles.paginationContainer} ${className}`}>
      {showTotal && (
        <div className={styles.totalInfo}>
          {isMobile ? `共${total}条` : `共 ${total} 条记录`}
        </div>
      )}
      
      {showSizeChanger && (
        <div className={styles.sizeChanger}>
          {isMobile ? '' : '每页显示'}
          <select
            value={pageSize}
            onChange={handleSizeChange}
            className={styles.sizeSelect}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}{isMobile ? '' : ''}
              </option>
            ))}
          </select>
          {isMobile ? '/页' : '条'}
        </div>
      )}
      
      <div className={styles.pageButtons}>
        {getPageItems()}
      </div>
      
      {!isMobile && (
        <div className={styles.pageInfo}>
          第 {current} / {totalPages} 页
        </div>
      )}
    </div>
  );
};

export default Pagination;