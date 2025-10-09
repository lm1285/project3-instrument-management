import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import permissionChecker from '../utils/PermissionChecker';
import '../styles/FieldArrangement.css';

const FieldArrangement = () => {
  // 状态管理
  const [tableData, setTableData] = useState([]);
  const [selectedCells, setSelectedCells] = useState([]);
  const [mergedCells, setMergedCells] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [editingHistory, setEditingHistory] = useState([]);
  const [currentEdit, setCurrentEdit] = useState(null);

  // 初始化表格数据和权限检查
  useEffect(() => {
    // 检查用户是否为管理员
    const adminStatus = permissionChecker.isAdmin();
    setIsAdmin(adminStatus);

    // 数据规范化函数：确保表格只有5列
    const normalizeTableData = (data) => {
      if (!data || !Array.isArray(data)) return [];
      
      // 表头
      const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
      
      // 规范化每一行，确保只有5列
      return data.map((row, rowIndex) => {
        const normalizedRow = Array(5).fill('');
        
        // 复制现有数据，但最多只保留前5列
        if (Array.isArray(row)) {
          row.forEach((cell, colIndex) => {
            if (colIndex < 5) {
              normalizedRow[colIndex] = cell;
            }
          });
        }
        
        // 确保表头行是正确的
        if (rowIndex === 0) {
          headers.forEach((header, colIndex) => {
            normalizedRow[colIndex] = header;
          });
        }
        
        return normalizedRow;
      });
    };

    // 加载表格数据
    const loadTableData = () => {
      try {
        const savedData = localStorage.getItem('fieldArrangementData');
        const savedMergedCells = localStorage.getItem('mergedCells');
        const savedHistory = localStorage.getItem('editingHistory');
        
        // 先加载合并单元格数据
        let loadedMergedCells = [];
        if (savedMergedCells) {
          loadedMergedCells = JSON.parse(savedMergedCells);
          setMergedCells(loadedMergedCells);
        }
        
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          // 规范化数据，确保只有5列
          const normalizedData = normalizeTableData(parsedData);
          setTableData(normalizedData);
          // 保存规范化后的数据，避免再次出现问题
          saveTableData(normalizedData, loadedMergedCells);
        } else {
          // 初始化默认表格数据
        const defaultData = Array(20).fill().map((_, rowIndex) => 
          Array(5).fill().map((_, colIndex) => {
            // 添加表头
            if (rowIndex === 0) {
              const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
              return headers[colIndex] || `列${colIndex + 1}`;
            }
            return '';
          })
        );
          setTableData(defaultData);
          saveTableData(defaultData, []);
        }

        if (savedHistory) {
          setEditingHistory(JSON.parse(savedHistory));
        }
      } catch (error) {
        console.error('加载表格数据失败:', error);
      }
    };

    loadTableData();
  }, []);

  // 保存表格数据到本地存储
  const saveTableData = useCallback((data, merged) => {
    try {
      localStorage.setItem('fieldArrangementData', JSON.stringify(data));
      localStorage.setItem('mergedCells', JSON.stringify(merged));
    } catch (error) {
      console.error('保存表格数据失败:', error);
    }
  }, []);

  // 保存编辑历史
  const saveEditingHistory = useCallback((action) => {
    try {
      const user = permissionChecker.getCurrentUser();
      const username = user ? user.username : '未知用户';
      const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const newHistoryItem = {
        action,
        user: username,
        time: timestamp
      };
      
      const updatedHistory = [newHistoryItem, ...editingHistory.slice(0, 49)]; // 保留最近50条记录
      setEditingHistory(updatedHistory);
      localStorage.setItem('editingHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('保存编辑历史失败:', error);
    }
  }, [editingHistory]);

  // 显示保存成功提示
  const showSaveMessage = useCallback(() => {
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 2000);
  }, []);

  // 处理单元格点击
  const handleCellClick = (rowIndex, colIndex) => {
    if (!isAdmin) return;
    setSelectedCells([{ row: rowIndex, col: colIndex }]);
  };

  // 处理单元格范围选择
  const handleCellRangeSelect = (startRow, startCol, endRow, endCol) => {
    if (!isAdmin) return;
    
    const selected = [];
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        selected.push({ row, col });
      }
    }
    
    setSelectedCells(selected);
  };

  // 处理单元格内容变更
  const handleCellChange = (rowIndex, colIndex, value) => {
    if (!isAdmin) return;
    
    const newData = [...tableData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = [];
    }
    newData[rowIndex][colIndex] = value;
    setTableData(newData);
    
    // 记录编辑操作
    if (currentEdit) {
      clearTimeout(currentEdit);
    }
    const timeoutId = setTimeout(() => {
      saveTableData(newData, mergedCells);
      saveEditingHistory('更新了单元格内容');
      showSaveMessage();
      setCurrentEdit(null);
    }, 1000);
    
    setCurrentEdit(timeoutId);
  };

  // 插入行
  const insertRow = (position) => {
    if (!isAdmin) return;
    
    const newData = [...tableData];
    const newRow = Array(tableData[0]?.length || 5).fill('');
    newData.splice(position, 0, newRow);
    setTableData(newData);
    
    // 更新合并单元格信息
    const updatedMergedCells = mergedCells.map(cell => {
      if (cell.startRow >= position) {
        return {
          ...cell,
          startRow: cell.startRow + 1,
          endRow: cell.endRow + 1
        };
      }
      return cell;
    });
    setMergedCells(updatedMergedCells);
    
    saveTableData(newData, updatedMergedCells);
    saveEditingHistory('插入了一行数据');
    showSaveMessage();
  };

  // 删除行
  const deleteRow = (rowIndex) => {
    if (!isAdmin) return;
    
    const newData = [...tableData];
    newData.splice(rowIndex, 1);
    setTableData(newData);
    
    // 更新合并单元格信息
    const updatedMergedCells = mergedCells.filter(cell => 
      !(cell.startRow <= rowIndex && cell.endRow >= rowIndex)
    ).map(cell => {
      if (cell.startRow > rowIndex) {
        return {
          ...cell,
          startRow: cell.startRow - 1,
          endRow: cell.endRow - 1
        };
      }
      return cell;
    });
    setMergedCells(updatedMergedCells);
    
    saveTableData(newData, updatedMergedCells);
    saveEditingHistory('删除了一行数据');
    showSaveMessage();
  };

  // 合并单元格
  const mergeCells = () => {
    if (!isAdmin || selectedCells.length < 2) return;
    
    // 找出选中区域的最小和最大行/列
    const minRow = Math.min(...selectedCells.map(cell => cell.row));
    const maxRow = Math.max(...selectedCells.map(cell => cell.row));
    const minCol = Math.min(...selectedCells.map(cell => cell.col));
    let maxCol = Math.max(...selectedCells.map(cell => cell.col));
    
    // 限制最大列数不超过4（因为只有5列，索引0-4）
    maxCol = Math.min(maxCol, 4);
    
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

  // 导出表格数据为Excel文件
  const exportToExcel = () => {
    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet(tableData);
    
    // 应用合并单元格
    if (mergedCells.length > 0) {
      ws['!merges'] = mergedCells.map(cell => ({
        s: { r: cell.startRow, c: cell.startCol },
        e: { r: cell.endRow, c: cell.endCol }
      }));
    }
    
    // 设置单元格样式
    // 1. 创建样式对象
    const wscols = [
      { wch: 15 }, // 日期列宽度
      { wch: 25 }, // 客户名称列宽度
      { wch: 15 }, // 人员列宽度
      { wch: 20 }, // 仪器列宽度
      { wch: 30 }  // 备注列宽度
    ];
    ws['!cols'] = wscols;
    
    // 2. 为表头设置样式
    for (let c = 0; c < 5; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[cellAddress]) {
        // 设置表头字体加粗
        ws[cellAddress].s = {
          font: { bold: true },
          alignment: { horizontal: 'center', vertical: 'center' },
          fill: { fgColor: { rgb: 'DDEBF7' } },
          border: {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          }
        };
      }
    }
    
    // 3. 为日期列设置日期格式
    for (let r = 1; r < tableData.length; r++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellAddress]) {
        // 检查是否为日期格式
        const cellValue = tableData[r][0];
        if (cellValue && (typeof cellValue === 'string' && cellValue.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/))) {
          // 设置日期格式
          ws[cellAddress].s = {
            numberFormat: 'yyyy/m/d',
            alignment: { vertical: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        } else {
          // 设置普通单元格样式
          ws[cellAddress].s = {
            alignment: { vertical: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
      }
    }
    
    // 4. 为其他列设置统一样式
    for (let r = 1; r < tableData.length; r++) {
      for (let c = 1; c < 5; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (ws[cellAddress]) {
          ws[cellAddress].s = {
            alignment: { vertical: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
      }
    }
    
    // 创建工作簿并导出
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '下场安排');
    XLSX.writeFile(wb, `下场安排_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`);
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
            return headers[colIndex] || `列${colIndex + 1}`;
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
  
  // 重置表头（保留表格内容）
  const resetHeaders = () => {
    if (!isAdmin) return;
    
    if (window.confirm('确定要重置表头吗？表格内容将被保留。')) {
      const headers = ['日期', '客户名称', '人员', '仪器', '备注'];
      const newData = [...tableData];
      // 只更新表头行
      if (newData.length > 0) {
        headers.forEach((header, colIndex) => {
          if (newData[0][colIndex] !== undefined) {
            newData[0][colIndex] = header;
          }
        });
      }
      setTableData(newData);
      saveTableData(newData, mergedCells);
      saveEditingHistory('重置了表头');
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

  return (
    <div className="field-arrangement-container">
      <div className="header">
        <h1>下场安排</h1>
        
        {!isAdmin && (
          <div className="view-mode-notice">
            当前为查看模式，仅管理员可编辑数据
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
            <button onClick={mergeCells} className="tool-btn">
              合并单元格
            </button>
            <button onClick={unmergeCells} className="tool-btn">
              取消合并
            </button>
          </div>
          
          <div className="tool-group">
            <button onClick={manualSave} className="tool-btn primary">
              保存
            </button>
            <button onClick={exportToExcel} className="tool-btn">
              导出Excel
            </button>
            <button onClick={resetHeaders} className="tool-btn">
              重置表头
            </button>
            <button onClick={clearTable} className="tool-btn danger">
              清空表格
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <div className="table-container">
          {/* 表头固定区域 - 日期列 */}
          <div className="frozen-header-row">
            <div className="frozen-cell header-cell">
              行号
            </div>
            {tableData.length > 0 && tableData[0].slice(0, 5).map((_, colIndex) => (
              <div 
                key={`frozen-header-${colIndex}`}
                className={`header-cell ${colIndex === 0 ? 'frozen' : ''}`}
              >
                {tableData[0][colIndex] || `列${colIndex + 1}`}
              </div>
            ))}
          </div>
          
          {/* 表格主体 */}
          <div className="table-body">
            {tableData.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="table-row">
                {/* 行号 */}
                <div className="frozen-cell row-number-cell">
                  {rowIndex + 1}
                  {isAdmin && (
                    <div className="row-actions">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          insertRow(rowIndex);
                        }}
                        title="在上方插入行"
                      >
                        ⬆️
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          insertRow(rowIndex + 1);
                        }}
                        title="在下方插入行"
                      >
                        ⬇️
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRow(rowIndex);
                        }}
                        title="删除此行"
                        className="delete-btn"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                
                {/* 单元格 - 只显示前5列 */}
                {row.slice(0, 5).map((cellValue, colIndex) => {
                  // 检查单元格是否在合并区域内且被隐藏
                  if (isMergedCellHidden(rowIndex, colIndex)) {
                    return null;
                  }
                  
                  // 获取合并单元格样式
                  const mergedStyle = getMergedCellStyle(rowIndex, colIndex);
                  
                  // 检查单元格是否被选中
                  const isSelected = selectedCells.some(cell => 
                    cell.row === rowIndex && cell.col === colIndex
                  );
                  
                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      className={`table-cell ${isSelected ? 'selected' : ''} ${colIndex === 0 ? 'frozen' : ''} ${rowIndex === 0 ? 'header' : ''}`}
                      style={mergedStyle}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const startRow = rowIndex;
                        const startCol = colIndex;
                        
                        const handleMouseMove = (e) => {
                          // 简化处理：实际项目中需要计算鼠标位置对应的单元格
                          // 这里仅作示例
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
                        <input
                          type="text"
                          value={cellValue || ''}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          className="cell-input"
                        />
                      ) : (
                        <span className="cell-value">{cellValue || ''}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 编辑历史面板 */}
      <div className="history-panel">
        <h3>编辑历史</h3>
        <div className="history-list">
          {editingHistory.map((history, index) => (
            <div key={index} className="history-item">
              <span className="history-user">{history.user}</span>
              <span className="history-action">{history.action}</span>
              <span className="history-time">{history.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FieldArrangement;