import React, { useState, useEffect, useRef } from 'react';
import '../styles/FieldArrangement.css';

const FieldArrangement = () => {
  // 状态管理
  const [tableData, setTableData] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [mergedCells, setMergedCells] = useState([]);
  const [editingHistory, setEditingHistory] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [columnWidths, setColumnWidths] = useState([120, 180, 120, 150, 200]);

  // 引用
  const inputRef = useRef(null);
  const resizeStartX = useRef(0);
  const startWidth = useRef(0);

  // 初始化数据
  useEffect(() => {
    // 检查用户权限
    const role = localStorage.getItem('userRole') || 'user';
    setUserRole(role);
    setIsAdmin(role === 'admin' || role === 'superAdmin');

    // 加载保存的数据
    const savedData = localStorage.getItem('fieldArrangementData');
    const savedMergedCells = localStorage.getItem('fieldArrangementMergedCells');
    const savedHistory = localStorage.getItem('fieldArrangementHistory');
    const savedColumnWidths = localStorage.getItem('columnWidths');

    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setTableData(parsedData);
      } catch (error) {
        console.error('Failed to parse saved data:', error);
        initializeDefaultData();
      }
    } else {
      initializeDefaultData();
    }

    if (savedMergedCells) {
      try {
        setMergedCells(JSON.parse(savedMergedCells));
      } catch (error) {
        console.error('Failed to parse saved merged cells:', error);
      }
    }

    if (savedHistory) {
      try {
        setEditingHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Failed to parse saved history:', error);
      }
    }

    if (savedColumnWidths) {
      try {
        const parsedWidths = JSON.parse(savedColumnWidths);
        // 确保列宽数组有5个元素
        if (Array.isArray(parsedWidths) && parsedWidths.length >= 5) {
          setColumnWidths(parsedWidths.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to parse saved column widths:', error);
      }
    }
  }, []);

  // 初始化默认数据
  const initializeDefaultData = () => {
    const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
    const defaultData = Array(20).fill().map((_, rowIndex) => {
      if (rowIndex === 0) {
        return headers;
      }
      return Array(5).fill('');
    });
    setTableData(defaultData);
  };

  // 规范化表格数据，确保保持5列
  const normalizeTableData = (data) => {
    const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
    const normalizedData = [...data];
    
    // 确保有表头行
    if (normalizedData.length === 0) {
      normalizedData.push(headers);
    } else {
      // 确保表头行有5列
      if (normalizedData[0].length < 5) {
        while (normalizedData[0].length < 5) {
          normalizedData[0].push('');
        }
      }
      // 设置正确的表头
      headers.forEach((header, index) => {
        if (!normalizedData[0][index]) {
          normalizedData[0][index] = header;
        }
      });
    }

    // 确保所有数据行都有5列
    return normalizedData.map((row, rowIndex) => {
      if (rowIndex === 0) return row.slice(0, 5);
      
      const normalizedRow = [...row];
      while (normalizedRow.length < 5) {
        normalizedRow.push('');
      }
      return normalizedRow.slice(0, 5);
    });
  };

  // 保存表格数据到本地存储
  const saveTableData = (data, mergedData) => {
    try {
      const normalizedData = normalizeTableData(data);
      localStorage.setItem('fieldArrangementData', JSON.stringify(normalizedData));
      localStorage.setItem('fieldArrangementMergedCells', JSON.stringify(mergedData));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  };

  // 保存编辑历史
  const saveEditingHistory = (action) => {
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const newHistory = {
      user: userRole === 'superAdmin' ? '主管理员' : (isAdmin ? '管理员' : '查看者'),
      action,
      time: formattedTime
    };

    const updatedHistory = [newHistory, ...editingHistory].slice(0, 50); // 只保留最近50条记录
    setEditingHistory(updatedHistory);
    localStorage.setItem('fieldArrangementHistory', JSON.stringify(updatedHistory));
  };

  // 显示保存成功消息
  const showSaveMessage = () => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 2000);
  };

  // 处理单元格点击事件
  const handleCellClick = (row, col, e) => {
    if (!isAdmin) return;
    
    // 从事件对象获取Ctrl/Meta键状态
    const isCtrlKey = e && (e.ctrlKey || e.metaKey);
    
    if (isCtrlKey) {
      // 按住Ctrl键时，添加或移除单元格到选中集合
      setSelectedCells(prev => {
        const cellExists = prev.some(cell => cell.row === row && cell.col === col);
        if (cellExists) {
          return prev.filter(cell => !(cell.row === row && cell.col === col));
        } else {
          return [...prev, { row, col }];
        }
      });
    } else {
      // 普通点击，替换选中的单元格
      setSelectedCells([{ row, col }]);
      
      // 只有在不是多选模式时才设置编辑单元格
      setEditingCell({ row, col });
      
      // 聚焦输入框
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 0);
    }
  };

  // 单元格内容变更处理
  const handleCellChange = (row, col, value) => {
    const newData = [...tableData];
    newData[row][col] = value;
    setTableData(newData);
  };

  // 插入行
  const insertRow = (index) => {
    if (!isAdmin) return;
    
    const newData = [...tableData];
    // 创建5列的新行
    const newRow = Array(5).fill('');
    newData.splice(index, 0, newRow);
    setTableData(newData);
    
    // 保存数据和历史
    saveTableData(newData, mergedCells);
    saveEditingHistory('插入了一行数据');
    showSaveMessage();
  };

  // 删除选中的行
  const deleteSelectedRows = () => {
    if (!isAdmin || selectedCells.length === 0) return;
    
    // 确保至少保留表头行
    const selectedRowIndices = [...new Set(selectedCells.map(cell => cell.row))].filter(row => row > 0);
    if (tableData.length - selectedRowIndices.length <= 1) {
      alert('至少需要保留一行数据');
      return;
    }
    
    if (window.confirm(`确定要删除选中的 ${selectedRowIndices.length} 行吗？`)) {
      // 按降序删除行，避免索引问题
      const sortedRowIndices = selectedRowIndices.sort((a, b) => b - a);
      const newData = [...tableData];
      
      sortedRowIndices.forEach(rowIndex => {
        newData.splice(rowIndex, 1);
      });
      
      setTableData(newData);
      setSelectedCells([]);
      
      // 更新合并单元格数据
      const updatedMergedCells = mergedCells.filter(cell => 
        !sortedRowIndices.some(rowIndex => 
          rowIndex >= cell.startRow && rowIndex <= cell.endRow
        )
      );
      setMergedCells(updatedMergedCells);
      
      // 保存数据和历史
      saveTableData(newData, updatedMergedCells);
      saveEditingHistory(`删除了 ${selectedRowIndices.length} 行数据`);
      showSaveMessage();
    }
  };

  // 合并单元格
  const mergeCells = () => {
    if (!isAdmin || selectedCells.length < 2) {
      alert('请至少选择两个单元格进行合并');
      return;
    }
    
    // 找出选中区域的最小和最大行/列
    const minRow = Math.min(...selectedCells.map(cell => cell.row));
    const maxRow = Math.max(...selectedCells.map(cell => cell.row));
    const minCol = Math.min(...selectedCells.map(cell => cell.col));
    let maxCol = Math.min(Math.max(...selectedCells.map(cell => cell.col)), 4); // 限制最大列数不超过4
    
    // 检查是否与现有合并单元格重叠
    const overlaps = mergedCells.some(cell => 
      !(cell.endRow < minRow || cell.startRow > maxRow || 
        cell.endCol < minCol || cell.startCol > maxCol)
    );
    
    if (overlaps) {
      alert('选择的区域与现有合并单元格重叠，请重新选择。');
      return;
    }
    
    // 创建新的合并单元格
    const newMergedCell = {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol
    };
    
    const updatedMergedCells = [...mergedCells, newMergedCell];
    setMergedCells(updatedMergedCells);
    
    // 清空合并区域内的其他单元格内容
    const newData = [...tableData];
    const mainCellValue = newData[minRow][minCol];
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row !== minRow || col !== minCol) {
          newData[row][col] = '';
        }
      }
    }
    
    setTableData(newData);
    setSelectedCells([newMergedCell]);
    
    saveTableData(newData, updatedMergedCells);
    saveEditingHistory('合并了单元格');
    showSaveMessage();
  };

  // 取消合并单元格
  const unmergeCells = () => {
    if (!isAdmin || selectedCells.length !== 1) return;
    
    const { row, col } = selectedCells[0];
    // 查找包含当前单元格的合并单元格
    const mergedCellIndex = mergedCells.findIndex(cell => 
      row >= cell.startRow && row <= cell.endRow && 
      col >= cell.startCol && col <= cell.endCol
    );
    
    if (mergedCellIndex === -1) {
      alert('当前选中的单元格不是合并单元格。');
      return;
    }
    
    const updatedMergedCells = mergedCells.filter((_, index) => index !== mergedCellIndex);
    setMergedCells(updatedMergedCells);
    
    saveTableData(tableData, updatedMergedCells);
    saveEditingHistory('取消合并了单元格');
    showSaveMessage();
  };

  // 检查单元格是否在合并区域内，并且是否是左上角单元格
  const isMergedCellTopLeft = (row, col) => {
    return mergedCells.some(cell => 
      cell.startRow === row && cell.startCol === col
    );
  };

  // 检查单元格是否在合并区域内，但不是左上角单元格
  const isMergedCellHidden = (row, col) => {
    return mergedCells.some(cell => 
      row >= cell.startRow && row <= cell.endRow && 
      col >= cell.startCol && col <= cell.endCol && 
      !(cell.startRow === row && cell.startCol === col)
    );
  };

  // 获取合并单元格的跨度样式
  const getMergedCellStyle = (row, col) => {
    const mergedCell = mergedCells.find(cell => 
      cell.startRow === row && cell.startCol === col
    );
    
    if (!mergedCell) return {};
    
    const rowSpan = mergedCell.endRow - mergedCell.startRow + 1;
    const colSpan = mergedCell.endCol - mergedCell.startCol + 1;
    
    return {
      gridRow: `span ${rowSpan}`,
      gridColumn: `span ${colSpan}`
    };
  };



  // 手动保存数据
  const manualSave = () => {
    if (!isAdmin) return;
    saveTableData(tableData, mergedCells);
    saveEditingHistory('手动保存了表格数据');
    showSaveMessage();
  };

  // 清空表格数据
  const clearTable = () => {
    if (!isAdmin) return;
    
    if (window.confirm('确定要清空所有表格数据吗？此操作不可撤销。')) {
      const defaultData = Array(20).fill().map((_, rowIndex) => 
        Array(5).fill().map((_, colIndex) => {
          if (rowIndex === 0) {
            const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
            return headers[colIndex];
          }
          return '';
        })
      );
      setTableData(defaultData);
      setMergedCells([]);
      saveTableData(defaultData, []);
      saveEditingHistory('清空了表格数据');
      showSaveMessage();
    }
  };
  


  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAdmin) return;
      
      // Ctrl+S 保存
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        manualSave();
      }
      // Ctrl+Z 撤销操作（这里简化处理，仅提示）
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        alert('撤销功能暂未实现。');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, manualSave]);

  // 列宽调整相关事件处理
  const handleResizeStart = (colIndex, event) => {
    if (!isAdmin) return;
    event.preventDefault();
    setResizingColumn(colIndex);
    resizeStartX.current = event.clientX;
    startWidth.current = columnWidths[colIndex];
  };

  const handleResize = (event) => {
    if (resizingColumn === null) return;
    const deltaX = event.clientX - resizeStartX.current;
    const newWidth = Math.max(80, startWidth.current + deltaX); // 最小宽度80px
    const newColumnWidths = [...columnWidths];
    newColumnWidths[resizingColumn] = newWidth;
    setColumnWidths(newColumnWidths);
  };

  const handleResizeEnd = () => {
    if (resizingColumn !== null) {
      // 保存调整后的列宽
      localStorage.setItem('columnWidths', JSON.stringify(columnWidths));
      saveEditingHistory('调整了列宽');
      showSaveMessage();
      setResizingColumn(null);
    }
  };

  // 列宽调整事件监听
  useEffect(() => {
    if (resizingColumn !== null) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResize, handleResizeEnd]);

  // 重置列宽为默认值
  const resetColumnWidths = () => {
    if (!isAdmin) return;
    if (window.confirm('确定要重置所有列宽吗？')) {
      const defaultWidths = [120, 180, 120, 150, 200];
      setColumnWidths(defaultWidths);
      saveTableData(tableData, mergedCells);
      saveEditingHistory('重置了列宽');
      showSaveMessage();
    }
  };

  // 渲染表格单元格
  const renderTableCell = (row, col, value) => {
    // 检查单元格是否在合并区域内且被隐藏
    if (isMergedCellHidden(row, col)) {
      return null;
    }
    
    // 获取合并单元格样式
    const mergedStyle = getMergedCellStyle(row, col);
    
    // 检查单元格是否被选中
    const isSelected = selectedCells.some(cell => 
      cell.row === row && cell.col === col
    );
    
    return (
      <div
        key={`cell-${row}-${col}`}
        className={`table-cell ${isSelected ? 'selected' : ''} ${col === 0 ? 'frozen' : ''}`}
        style={mergedStyle}
        onClick={(e) => handleCellClick(row, col, e.ctrlKey || e.metaKey)}
        onMouseDown={(e) => {
            e.preventDefault();
            const startRow = row;
            const startCol = col;
            
            // 获取当前单元格的位置信息
            const cellElement = e.currentTarget;
            const cellRect = cellElement.getBoundingClientRect();
            
            const handleMouseMove = (e) => {
              // 获取表格容器位置
              const tableContainer = document.querySelector('.table-wrapper');
              const tableRect = tableContainer.getBoundingClientRect();
              
              // 计算鼠标相对于表格的位置
              const relativeX = e.clientX - tableRect.left;
              const relativeY = e.clientY - tableRect.top;
              
              // 计算当前鼠标所在的单元格
              let currentRow = startRow;
              let currentCol = startCol;
              
              // 简单估算：根据行高和列宽计算
              const rowHeight = 36; // 假设行高为36px
              const colWidths = columnWidths;
              
              // 计算列索引
              let cumulativeWidth = 0;
              for (let c = 0; c < colWidths.length; c++) {
                cumulativeWidth += colWidths[c];
                if (relativeX <= cumulativeWidth) {
                  currentCol = c;
                  break;
                }
              }
              
              // 计算行索引
              currentRow = Math.floor(relativeY / rowHeight);
              
              // 确保索引在有效范围内
              currentRow = Math.max(0, Math.min(tableData.length - 1, currentRow));
              currentCol = Math.max(0, Math.min(4, currentCol));
              
              // 计算选择区域内的所有单元格
              const minRow = Math.min(startRow, currentRow);
              const maxRow = Math.max(startRow, currentRow);
              const minCol = Math.min(startCol, currentCol);
              const maxCol = Math.max(startCol, currentCol);
              
              const newSelectedCells = [];
              for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                  // 跳过合并单元格的隐藏部分
                  if (!isMergedCellHidden(r, c)) {
                    newSelectedCells.push({ row: r, col: c });
                  }
                }
              }
              
              setSelectedCells(newSelectedCells);
            };
            
            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
      >
        {isAdmin ? (
            // 只在当前编辑的单元格显示输入框
            editingCell && editingCell.row === row && editingCell.col === col ? (
              <input
                ref={inputRef}
                type="text"
                value={value || ''}
                onChange={(e) => handleCellChange(row, col, e.target.value)}
                onBlur={() => setEditingCell(null)}
                onKeyDown={(e) => {
                  // 支持Tab和Enter键导航
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    // 计算下一个可编辑单元格
                    let nextRow = row;
                    let nextCol = col + (e.shiftKey ? -1 : 1);
                    
                    // 处理边界情况
                    if (nextCol < 0) {
                      nextRow--;
                      nextCol = 4; // 最后一列
                    } else if (nextCol > 4) {
                      nextRow++;
                      nextCol = 0; // 第一列
                    }
                    
                    // 确保行索引有效
                    if (nextRow >= 1 && nextRow < tableData.length) {
                      // 如果是合并单元格的隐藏部分，继续查找
                      let attempts = 0;
                      while (attempts < 10 && 
                             (isMergedCellHidden(nextRow, nextCol) || 
                              (nextRow === 0)) && 
                             nextRow < tableData.length) {
                        nextCol++;
                        if (nextCol > 4) {
                          nextRow++;
                          nextCol = 0;
                        }
                        attempts++;
                      }
                      
                      if (nextRow < tableData.length && nextRow >= 1) {
                        setEditingCell({ row: nextRow, col: nextCol });
                        setSelectedCells([{ row: nextRow, col: nextCol }]);
                      }
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // 计算下一行同一列
                    let nextRow = row + 1;
                    if (nextRow < tableData.length) {
                      // 确保不是表头且不是合并单元格的隐藏部分
                      if (nextRow >= 1 && !isMergedCellHidden(nextRow, col)) {
                        setEditingCell({ row: nextRow, col: col });
                        setSelectedCells([{ row: nextRow, col: col }]);
                      }
                    }
                  } else if (e.key === 'Escape') {
                    // 取消编辑
                    setEditingCell(null);
                  }
                }}
                className="cell-input"
              />
            ) : (
              // 其他单元格显示文本内容
              <span 
                className="cell-value"
                onClick={(e) => handleCellClick(row, col, e)}
                onMouseDown={(e) => {
                  // 只在管理员模式下允许选择
                  if (isAdmin && !editingCell) {
                    e.preventDefault();
                    // 初始化选择区域
                    const startRow = row;
                    const startCol = col;
                    
                    // 处理Ctrl/Meta键多选逻辑
                    if (e.ctrlKey || e.metaKey) {
                      // 检查单元格是否已被选中
                      const isAlreadySelected = selectedCells.some(cell => 
                        cell.row === row && cell.col === col
                      );
                      
                      if (isAlreadySelected) {
                        // 如果已选中且按住Ctrl，移除该单元格
                        setSelectedCells(selectedCells.filter(cell => 
                          !(cell.row === row && cell.col === col)
                        ));
                      } else {
                        // 如果未选中且按住Ctrl，添加该单元格
                        setSelectedCells([...selectedCells, { row, col }]);
                      }
                    } else {
                      // 没有按住Ctrl，清空之前的选择并选中当前单元格
                      setSelectedCells([{ row, col }]);
                    }
                    
                    const handleMouseMove = (moveEvent) => {
                      const rect = moveEvent.currentTarget.getBoundingClientRect();
                      const relativeX = moveEvent.clientX - rect.left;
                      const relativeY = moveEvent.clientY - rect.top;
                      
                      // 计算列索引和行索引
                      let currentCol = 0;
                      let accumulatedWidth = 0;
                      for (let c = 0; c < columnWidths.length; c++) {
                        accumulatedWidth += columnWidths[c];
                        if (relativeX <= accumulatedWidth) {
                          currentCol = c;
                          break;
                        }
                      }
                      
                      // 行高估计
                      const rowHeight = 40; // 大致行高，可根据实际情况调整
                      let currentRow = Math.floor(relativeY / rowHeight);
                      
                      // 确保索引在有效范围内
                      currentRow = Math.max(0, Math.min(tableData.length - 1, currentRow));
                      currentCol = Math.max(0, Math.min(4, currentCol));
                      
                      // 计算选择区域内的所有单元格
                      const minRow = Math.min(startRow, currentRow);
                      const maxRow = Math.max(startRow, currentRow);
                      const minCol = Math.min(startCol, currentCol);
                      const maxCol = Math.max(startCol, currentCol);
                      
                      const newSelectedCells = [];
                      for (let r = minRow; r <= maxRow; r++) {
                        for (let c = minCol; c <= maxCol; c++) {
                          // 跳过合并单元格的隐藏部分
                          if (!isMergedCellHidden(r, c)) {
                            newSelectedCells.push({ row: r, col: c });
                          }
                        }
                      }
                      
                      setSelectedCells(newSelectedCells);
                    };
                    
                    const handleMouseUp = () => {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }
                }}
              >
                {value || ''}
              </span>
            )
          ) : (
            <span className="cell-value">{value || ''}</span>
          )}
      </div>
    );
  };

  return (
    <div className="field-arrangement-container">
      <div className="header">
        <h1>下场安排</h1>
        
        {!isAdmin && (
          <div className="view-mode-notice">
            当前为查看模式，仅主管理员和管理员可编辑数据
          </div>
        )}
        
        {showSuccessMessage && (
          <div className="success-message">
            保存成功！
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="toolbar">
          <div className="tool-group">
            <button onClick={() => insertRow(tableData.length)} className="tool-btn">
              插入行
            </button>
            <button onClick={deleteSelectedRows} className="tool-btn">
              删除选中行
            </button>
            <button onClick={mergeCells} className="tool-btn">
              合并单元格
            </button>
            <button onClick={unmergeCells} className="tool-btn">
              取消合并
            </button>
            <button onClick={resetColumnWidths} className="tool-btn">
              重置列宽
            </button>
          </div>
          
          <div className="tool-group">
              <button onClick={manualSave} className="tool-btn">
                保存
              </button>
              <button onClick={clearTable} className="tool-btn danger">
                清空表格
              </button>
            </div>
        </div>
      )}

      <div className="table-wrapper">
        <div className="table-container">
          {/* 表头固定区域 */}
          {tableData.length > 0 && (
            <div className="frozen-header-row" style={{
              gridTemplateColumns: columnWidths.map(w => `${w}px`).join(' ')
            }}>
              {tableData[0].slice(0, 5).map((header, colIndex) => (
                <div 
                  key={`header-${colIndex}`}
                  className={`header-cell ${colIndex === 0 ? 'frozen' : ''}`}
                >
                  {header || `列${colIndex + 1}`}
                </div>
              ))}
            </div>
          )}
          
          {/* 列宽调整器层 - 跨越表头和表格主体 */}
          {isAdmin && (
            <div className="column-resizers-layer">
              {Array.from({ length: columnWidths.length - 1 }).map((_, colIndex) => (
                <div 
                  key={`resizer-${colIndex}`}
                  className="column-resizer full-height"
                  onMouseDown={(e) => handleResizeStart(colIndex, e)}
                  style={{ left: `${columnWidths.slice(0, colIndex + 1).reduce((a, b) => a + b, 0)}px` }}
                />
              ))}
            </div>
          )}
          
          {/* 表格主体 */}
          <div className="table-body" style={{ cursor: resizingColumn !== null ? 'col-resize' : 'default' }}>
            {tableData.slice(1).map((row, rowIndex) => ( // 从索引1开始，跳过表头行
              <div key={`row-${rowIndex+1}`} className="table-row" style={{
                gridTemplateColumns: columnWidths.map(w => `${w}px`).join(' ')
              }}>
                {/* 单元格 - 只显示前5列 */}
                {row.slice(0, 5).map((cellValue, colIndex) => 
                  renderTableCell(rowIndex + 1, colIndex, cellValue)
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 编辑历史面板 */}
      <div className="history-panel">
        <h3>编辑历史</h3>
        <div className="history-list">
          {editingHistory.length > 0 ? (
            editingHistory.map((history, index) => (
              <div key={index} className="history-item">
                <span className="history-user">{history.user}</span>
                <span className="history-action">{history.action}</span>
                <span className="history-time">{history.time}</span>
              </div>
            ))
          ) : (
            <div className="no-history">暂无编辑历史</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldArrangement;