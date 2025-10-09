import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';
import DataStorage from '../utils/DataStorage';

// 引入 recharts 用于数据可视化
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

function Dashboard() {
  const [warningStats, setWarningStats] = useState({
    redAlert: 0, // 超期数量
    yellowAlert: 0, // 临近到期数量（30天内）
    stockShortage: 0, // 库存短缺预警
    totalTodayTasks: 0 // 今日/本周待处理预警总数
  });
  const [allAlerts, setAllAlerts] = useState([]); // 统一的预警列表
  const [filteredAlerts, setFilteredAlerts] = useState([]); // 筛选后的预警列表
  const [isLoading, setIsLoading] = useState(true);
  const [pieChartData, setPieChartData] = useState([]); // 饼图数据
  const [barChartData, setBarChartData] = useState([]); // 柱状图数据
  
  // 筛选状态
  const [filterOptions, setFilterOptions] = useState({
    level: 'all', // all, red, yellow, blue
    type: 'all'   // all, calibration, expiry, stock
  });
  
  // 排序状态
  const [sortField, setSortField] = useState('daysToAction');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // 当前用户信息
  const [currentUser, setCurrentUser] = useState('当前用户');
  const [currentUserInfo, setCurrentUserInfo] = useState(null);
  
  // 任务处理状态定义
  const taskStatuses = [
    '发现预警',
    '已提交质量',
    '已送检',
    '等待证书',
    '已完成',
    '已更新系统信息'
  ];
  
  // 用户待办任务状态
  const [userTasks, setUserTasks] = useState([]);
  const [taskStatusMap, setTaskStatusMap] = useState({});

  // 创建数据存储实例
  const instrumentStorage = new DataStorage('standard-instruments');
  const taskStorage = new DataStorage('alert-tasks');

  // 计算日期差异
  const getDaysDifference = (dateString) => {
    if (!dateString || dateString === '-') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    const difference = targetDate.getTime() - today.getTime();
    return Math.ceil(difference / (1000 * 3600 * 24));
  };

  // 统计预警信息
  const calculateWarningStats = () => {
    try {
      setIsLoading(true);
      
      const allInstruments = instrumentStorage.getAll();
      const unifiedAlerts = [];
      
      // 遍历所有仪器，生成统一的预警列表
      allInstruments.forEach(instrument => {
        // 检查校准/检定到期情况
        if (instrument.type === 'standard' || instrument.type === 'reference-material') {
          const daysDiff = getDaysDifference(instrument.recalibrationDate);
          
          if (daysDiff !== null) {
            if (daysDiff < 0) {
              // 红色警报：已超期
              unifiedAlerts.push({
                ...instrument,
                alertLevel: 'red',
                alertType: 'calibration',
                daysToAction: daysDiff,
                keyDate: instrument.recalibrationDate,
                alertTitle: '校准/检定超期'
              });
            } else if (daysDiff <= 30) {
              // 黄色预警：临期（30天内）
              unifiedAlerts.push({
                ...instrument,
                alertLevel: 'yellow',
                alertType: 'calibration',
                daysToAction: daysDiff,
                keyDate: instrument.recalibrationDate,
                alertTitle: '校准/检定即将到期'
              });
            }
          }
        }
        
        // 检查库存不足情况（标准物质）
        if (instrument.type === 'reference-material' &&
            instrument.stock !== undefined &&
            instrument.safetyStock !== undefined &&
            instrument.stock < instrument.safetyStock) {
          
          unifiedAlerts.push({
            ...instrument,
            alertLevel: 'blue',
            alertType: 'stock',
            daysToAction: 0, // 库存不足没有天数概念
            keyDate: null,
            alertTitle: '库存不足'
          });
        }
      });
      
      // 计算各类型预警数量
      const redAlertCount = unifiedAlerts.filter(alert => alert.alertLevel === 'red').length;
      const yellowAlertCount = unifiedAlerts.filter(alert => alert.alertLevel === 'yellow').length;
      const blueAlertCount = unifiedAlerts.filter(alert => alert.alertLevel === 'blue').length;
      
      setWarningStats({
        redAlert: redAlertCount,
        yellowAlert: yellowAlertCount,
        stockShortage: blueAlertCount,
        totalTodayTasks: unifiedAlerts.length
      });
      
      // 更新图表数据
      setPieChartData([
        { name: '超期', value: redAlertCount, color: '#f44336' },
        { name: '临期', value: yellowAlertCount, color: '#ff9800' },
        { name: '库存不足', value: blueAlertCount, color: '#2196F3' }
      ]);
      
      // 生成柱状图数据（模拟过去7天数据）
      const generateBarChartData = () => {
        const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const data = [];
        
        for (let i = 0; i < 7; i++) {
          // 模拟数据，基于当前数据上下浮动
          const multiplier = 0.8 + Math.random() * 0.4;
          data.push({
            name: labels[i],
            超期: Math.floor(redAlertCount * multiplier),
            临期: Math.floor(yellowAlertCount * multiplier),
            库存不足: Math.floor(blueAlertCount * multiplier)
          });
        }
        return data;
      };
      
      setBarChartData(generateBarChartData());
      
      setAllAlerts(unifiedAlerts);
      applyFiltersAndSort(unifiedAlerts);
      
    } catch (error) {
      console.error('计算预警统计信息失败:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 应用筛选和排序
  const applyFiltersAndSort = (alerts) => {
    // 筛选
    let filtered = alerts;
    
    if (filterOptions.level !== 'all') {
      filtered = filtered.filter(alert => alert.alertLevel === filterOptions.level);
    }
    
    if (filterOptions.type !== 'all') {
      filtered = filtered.filter(alert => alert.alertType === filterOptions.type);
    }
    
    // 排序
    const sorted = [...filtered].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // 特殊处理日期和数字
      if (sortField === 'daysToAction') {
        // 将null值视为最大（放在最后）
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // 字符串排序
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? 
          aValue.localeCompare(bValue) : 
          bValue.localeCompare(aValue);
      }
      
      return 0;
    });
    
    setFilteredAlerts(sorted);
  };
  
  // 处理筛选变化
  const handleFilterChange = (filterType, value) => {
    setFilterOptions(prev => ({
      ...prev,
      [filterType]: value
    }));
  };
  
  // 处理排序变化
  const handleSortChange = (field) => {
    setSortField(field);
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  // 生成模拟库存数据
  const generateMockStockData = () => {
    const existingData = instrumentStorage.getAll();
    if (existingData.length === 0) {
      const mockData = [
        {
          id: '1',
          managementNumber: 'STD-2023-001',
          name: '数字万用表',
          model: 'Fluke 8846A',
          type: 'standard',
          manufacturer: 'Fluke',
          measurementRange: '0-1000V',
          recalibrationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5天前已超期
          storageLocation: '计量室',
          department: '质检部'
        },
        {
          id: '2',
          managementNumber: 'STD-2023-002',
          name: '标准电阻箱',
          model: 'ZX-75',
          type: 'standard',
          manufacturer: '上海电表厂',
          measurementRange: '0.1Ω-111111.1Ω',
          recalibrationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天后到期
          storageLocation: '计量室',
          department: '质检部'
        },
        {
          id: '3',
          managementNumber: 'RM-2023-001',
          name: '标准溶液A',
          model: 'CRM-001',
          type: 'reference-material',
          manufacturer: '国家标准物质中心',
          measurementRange: '1000±0.1 mg/L',
          recalibrationDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(), // 40天后到期
          storageLocation: '试剂柜',
          department: '化验室',
          stock: 2,
          safetyStock: 5
        },
        {
          id: '4',
          managementNumber: 'RM-2023-002',
          name: '标准溶液B',
          model: 'CRM-002',
          type: 'reference-material',
          manufacturer: '国家标准物质中心',
          measurementRange: '100±0.01 mg/L',
          recalibrationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20天后到期
          storageLocation: '试剂柜',
          department: '化验室',
          stock: 10,
          safetyStock: 5
        },
        {
          id: '5',
          managementNumber: 'STD-2023-003',
          name: '电子天平',
          model: 'Mettler Toledo XS205',
          type: 'standard',
          manufacturer: 'Mettler Toledo',
          measurementRange: '0-220g',
          recalibrationDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15天前已超期
          storageLocation: '天平室',
          department: '质检部'
        }
      ];
      instrumentStorage.saveAll(mockData);
    }
  };
  
  // 生成模拟任务数据
  const generateMockTaskData = () => {
    const existingTasks = taskStorage.getAll();
    if (!existingTasks || existingTasks.length === 0) {
      const mockTasks = [
        {
          id: 'calibration-STD-2023-001',
          type: 'calibration',
          status: '已送检',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          alertDetails: {
            name: '数字万用表',
            managementNumber: 'STD-2023-001',
            alertTitle: '校准/检定超期'
          }
        },
        {
          id: 'calibration-STD-2023-002',
          type: 'calibration',
          status: '发现预警',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          alertDetails: {
            name: '标准电阻箱',
            managementNumber: 'STD-2023-002',
            alertTitle: '校准/检定即将到期'
          }
        }
      ];
      taskStorage.saveAll(mockTasks);
    } else {
      // 初始化任务状态映射
      const statusMap = {};
      existingTasks.forEach(task => {
        statusMap[task.id] = task.status;
      });
      setTaskStatusMap(statusMap);
    }
  };
  
  // 从localStorage获取当前用户信息
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user.fullName || user.username || '当前用户');
        setCurrentUserInfo(user);
      } catch (error) {
        console.error('解析用户信息失败:', error);
      }
    }
  }, []);
  
  useEffect(() => {
    generateMockStockData(); // 生成模拟库存数据（仅当没有时）
    generateMockTaskData(); // 生成模拟任务数据（仅当没有时）
    calculateWarningStats();
    
    // 定期更新数据（每分钟）
    const interval = setInterval(calculateWarningStats, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  // 当allAlerts或filterOptions变化时，重新应用筛选
  useEffect(() => {
    if (allAlerts.length > 0) {
      applyFiltersAndSort(allAlerts);
    }
  }, [allAlerts, filterOptions, sortField, sortDirection]);
  
  // 为预警项生成任务ID
  const generateTaskId = (alert) => {
    return `${alert.alertType}-${alert.id || alert.managementNumber || 'unknown'}`;
  };

  // 更新任务状态
  const updateTaskStatus = (alert, newStatus) => {
    try {
      const taskId = generateTaskId(alert);
      const existingTasks = taskStorage.getAll() || [];
      
      // 查找或创建任务
      const taskIndex = existingTasks.findIndex(task => task.id === taskId);
      
      if (taskIndex >= 0) {
        // 更新现有任务
        existingTasks[taskIndex] = {
          ...existingTasks[taskIndex],
          status: newStatus,
          updatedAt: new Date().toISOString()
        };
      } else {
        // 创建新任务
        existingTasks.push({
          id: taskId,
          type: alert.alertType,
          status: newStatus,
          createdAt: new Date().toISOString(),
          alertDetails: {
            name: alert.name,
            managementNumber: alert.managementNumber,
            alertTitle: alert.alertTitle
          }
        });
      }
      
      taskStorage.saveAll(existingTasks);
      
      // 更新任务状态映射
      setTaskStatusMap(prev => ({
        ...prev,
        [taskId]: newStatus
      }));

      // 如果任务状态更新为"已完成"，从allAlerts中删除对应的预警信息
      if (newStatus === '已完成') {
        setAllAlerts(prevAlerts => {
          // 过滤掉当前预警信息
          const updatedAlerts = prevAlerts.filter(item => 
            !(item.id === alert.id && item.alertType === alert.alertType)
          );
          // 立即更新filteredAlerts以确保表格立即反映变化
          applyFiltersAndSort(updatedAlerts);
          return updatedAlerts;
        });
        
        // 重新计算预警统计数据，确保汇总卡片和待办区域的数据更新
        calculateWarningStats();
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
    }
  };
  
  // 刷新数据
  const refreshData = () => {
    calculateWarningStats();
  };
  
  // 获取完整日期时间
  const getFullDate = () => {
    const now = new Date();
    return now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '-');
  };

  // 格式化日期显示
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };
  
  // 获取预警级别样式类
  const getAlertLevelClass = (level) => {
    return `alert-level-${level}`;
  };

  // 获取预警天数显示文本
  const getDaysText = (days) => {
    if (days === null || days === undefined) return '-';
    if (days < 0) return `已超期${Math.abs(days)}天`;
    if (days > 0) return `剩余${days}天`;
    return '今日到期';
  };

  if (isLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <h2>📊 信息看板</h2>
          <div className="current-time">{getFullDate()}</div>
        </div>
        <button className="refresh-button" onClick={refreshData}>
          🔄 刷新
        </button>
      </div>
      
      <div className="dashboard-summary">
        <div className="summary-card red-alert">
          <div className="summary-icon">🔴</div>
          <div className="summary-content">
            <div className="summary-title">紧急（超期）</div>
            <div className="summary-value">{warningStats.redAlert}</div>
            <div className="summary-trend">
              <span className={warningStats.redAlert > 0 ? "trend-negative" : "trend-neutral"}>
                {warningStats.redAlert > 0 ? "⚠️ 急需处理" : "✓ 状态良好"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="summary-card yellow-alert">
          <div className="summary-icon">🟡</div>
          <div className="summary-content">
            <div className="summary-title">重要（30天内到期）</div>
            <div className="summary-value">{warningStats.yellowAlert}</div>
            <div className="summary-trend">
              <span className={warningStats.yellowAlert > 0 ? "trend-warning" : "trend-neutral"}>
                {warningStats.yellowAlert > 0 ? "⏱️ 即将到期" : "✓ 状态良好"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="summary-card stock-alert">
          <div className="summary-icon">🔵</div>
          <div className="summary-content">
            <div className="summary-title">提示（库存不足）</div>
            <div className="summary-value">{warningStats.stockShortage}</div>
            <div className="summary-trend">
              <span className={warningStats.stockShortage > 0 ? "trend-info" : "trend-neutral"}>
                {warningStats.stockShortage > 0 ? "📦 需要补充" : "✓ 库存充足"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="summary-card total-alert">
          <div className="summary-icon">📋</div>
          <div className="summary-content">
            <div className="summary-title">今日待处理总数</div>
            <div className="summary-value">{warningStats.totalTodayTasks}</div>
            <div className="summary-trend">
              <span className={warningStats.totalTodayTasks === 0 ? "trend-positive" : "trend-warning"}>
                {warningStats.totalTodayTasks === 0 ? "🎉 一切正常" : "📝 有任务待处理"}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* 我的预警待办 */}
      <div className="dashboard-todos">
        <h3>📋 我的预警待办</h3>
        <div className="todo-summary">
          <div className="todo-item">
            <span className="todo-icon">📝</span>
            <div className="todo-content">
              <p>您好，{currentUser}！</p>
              {warningStats.redAlert > 0 && (
                <p>您需要处理 <strong>{warningStats.redAlert} 台已超期</strong> 的标准器，这些设备急需校准！</p>
              )}
              {warningStats.yellowAlert > 0 && (
                <p>您需要为 <strong>{warningStats.yellowAlert} 台即将到期</strong> 的标准器向质量部发起校准申请。</p>
              )}
              {warningStats.stockShortage > 0 && (
                <p>有 <strong>{warningStats.stockShortage} 种</strong> 标准物质库存不足，需要及时补充。</p>
              )}
              {warningStats.totalTodayTasks === 0 && (
                <p>🎉 目前没有需要处理的预警事项，继续保持！</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 预警规则提示 */}
      <div className="dashboard-rules-info">
        <p className="rules-text">📌 校准预警规则：到期前30天、7天触发</p>
        {currentUserInfo && currentUserInfo.permissions && 
         (currentUserInfo.permissions.admin || 
          currentUserInfo.permissions.manageAlertRules) && (
          <button 
            className="settings-button"
            onClick={() => {
              alert('即将跳转到预警规则设置页面');
              // 实际项目中这里应该使用路由导航到设置页面
              // navigate('/alert-settings');
            }}
          >
            ⚙️ 预警规则设置
          </button>
        )}
      </div>

      {/* 智能筛选器 */}
      <div className="dashboard-filter">
        <div className="filter-group">
          <label htmlFor="level-filter">预警级别：</label>
          <select 
            id="level-filter" 
            value={filterOptions.level} 
            onChange={(e) => handleFilterChange('level', e.target.value)}
            className="filter-select"
          >
            <option value="all">全部</option>
            <option value="red">🔴 紧急（已超期）</option>
            <option value="yellow">🟡 重要（临期30天内）</option>
            <option value="blue">🔵 提示（库存不足）</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="type-filter">预警类型：</label>
          <select 
            id="type-filter" 
            value={filterOptions.type} 
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="filter-select"
          >
            <option value="all">全部</option>
            <option value="calibration">校准/检定到期</option>
            <option value="stock">库存不足</option>
          </select>
        </div>
      </div>
      
      {/* 预警列表表格 */}
      <div className="dashboard-details">
        <div className="details-header">
          <h3>📋 预警信息列表</h3>
          <div className="table-summary">
            共 {filteredAlerts.length} 条预警信息
          </div>
        </div>
        
        {filteredAlerts.length > 0 ? (
          <div className="alert-table-container">
            <table className="alert-table">
              <thead>
                <tr>
                  <th className="alert-level-header">
                    <button 
                      className="sort-button"
                      onClick={() => handleSortChange('alertLevel')}
                    >
                      预警级别 {sortField === 'alertLevel' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button 
                      className="sort-button"
                      onClick={() => handleSortChange('managementNumber')}
                    >
                      管理编号 {sortField === 'managementNumber' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>
                    <button 
                      className="sort-button"
                      onClick={() => handleSortChange('name')}
                    >
                      名称 {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>型号</th>
                  <th>测量范围</th>
                  <th>预警类型</th>
                  <th>
                    <button 
                      className="sort-button"
                      onClick={() => handleSortChange('daysToAction')}
                    >
                      剩余/超期天数 {sortField === 'daysToAction' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th>关键日期</th>
                  <th>处理状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert, index) => (
                  <tr key={`${alert.id || index}-${alert.alertType}`} className="alert-row">
                    <td>
                      <div className={`alert-level-indicator ${getAlertLevelClass(alert.alertLevel)}`}>
                        {alert.alertLevel === 'red' ? '🔴' : 
                         alert.alertLevel === 'yellow' ? '🟡' : '🔵'}
                      </div>
                    </td>
                    <td className="highlight-cell">{alert.managementNumber || '-'}</td>
                    <td className="highlight-cell">{alert.name || '-'}</td>
                    <td>{alert.model || '-'}</td>
                    <td>{alert.measurementRange || '-'}</td>
                    <td className="alert-type-cell">{alert.alertTitle || '-'}</td>
                    <td className={alert.daysToAction < 0 ? 'overdue-days' : alert.daysToAction <= 7 ? 'critical-days' : 'remaining-days'}>
                      {getDaysText(alert.daysToAction)}
                    </td>
                    <td>{formatDate(alert.keyDate)}</td>
                    <td>
                      {(() => {
                        const taskId = generateTaskId(alert);
                        const currentStatus = taskStatusMap[taskId] || '发现预警';
                        const statusIndex = taskStatuses.indexOf(currentStatus);
                        
                        return (
                          <select 
                            value={currentStatus}
                            onChange={(e) => updateTaskStatus(alert, e.target.value)}
                            className="status-select"
                            disabled={statusIndex >= taskStatuses.length - 1}
                          >
                            {taskStatuses
                              .filter((_, index) => index >= statusIndex)
                              .map((status, index) => (
                                <option key={index} value={status}>{status}</option>
                              ))
                            }
                          </select>
                        );
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const taskId = generateTaskId(alert);
                        const currentStatus = taskStatusMap[taskId] || '发现预警';
                        const statusIndex = taskStatuses.indexOf(currentStatus);
                        
                        if (statusIndex < taskStatuses.length - 1) {
                          const nextStatus = taskStatuses[statusIndex + 1];
                          return (
                            <button 
                              className="next-status-button"
                              onClick={() => updateTaskStatus(alert, nextStatus)}
                            >
                              → {nextStatus}
                            </button>
                          );
                        }
                        return (
                          <span className="status-completed">✓ 已完成</span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-alerts">
            <div className="no-alerts-icon">🎉</div>
            <p>没有符合条件的预警信息！</p>
            <div className="no-alerts-subtitle">系统运行状态良好</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;