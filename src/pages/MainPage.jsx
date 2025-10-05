import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/MainPage.css';
import Alert from '../components/common/Alert.jsx';
import DelayModal from '../components/DelayModal';
import DataStorage from '../utils/DataStorage';

function MainPage() {
  const navigate = useNavigate();
  const [activeMenuItem, setActiveMenuItem] = useState('instrument-management');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const [expandedSubmenu, setExpandedSubmenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // 仪器表单状态
  const [instrumentForm, setInstrumentForm] = useState({
    type: '',
    name: '',
    model: '',
    factoryNumber: '',
    managementNumber: '',
    manufacturer: '',
    measurementRange: '',
    measurementUncertainty: '',
    calibrationStatus: '',
    calibrationDate: '',
    recalibrationDate: '',
    period: '',
    traceabilityAgency: '',
    traceabilityCertificate: '',
    department: '',
    storageLocation: '',
    instrumentStatus: '',
    inOutStatus: '',
    remarks: '',
    attachments: ''
  })

  const handleLogout = () => {
    navigate('/')
  }

  // 创建数据存储实例
  const instrumentStorage = new DataStorage('standard-instruments')

  // 获取当前时间，精确到秒
  const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
  };

  const menuItems = [
    { id: 'dashboard', label: '仪器看板', icon: '📊' },
    { id: 'instrument-inout', label: '仪器出入', icon: '🚪' },
    { id: 'instrument-management', label: '仪器管理', icon: '⚖️' },
    {
      id: 'user-settings',
      label: '用户设置',
      icon: '⚙️',
      submenu: [
        { id: 'user-management', label: '用户管理', icon: '👥' },
        { id: 'system-settings', label: '系统设置', icon: '⚙️' }
      ]
    }
  ]

  const handleSearch = (query) => {
    setSearchQuery(query)
    console.log('搜索查询:', query)
  }

  // 处理表单输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setInstrumentForm(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 打开添加仪器模态框
  const openAddModal = () => {
    setShowAddModal(true)
  }

  // 关闭添加仪器模态框
  const closeAddModal = () => {
    setShowAddModal(false)
    // 重置表单
    setInstrumentForm({
      type: '',
      name: '',
      model: '',
      factoryNumber: '',
      managementNumber: '',
      manufacturer: '',
      measurementRange: '',
      measurementUncertainty: '',
      calibrationStatus: '',
      calibrationDate: '',
      recalibrationDate: '',
      period: '',
      traceabilityAgency: '',
      traceabilityCertificate: '',
      department: '',
      storageLocation: '',
      instrumentStatus: '',
      inOutStatus: '',
      remarks: '',
      attachments: ''
    })
  }

  // 提交添加仪器表单
  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('提交的仪器数据:', instrumentForm)
    // 这里可以添加提交数据到服务器的逻辑
    closeAddModal()
    // 显示成功提示
    alert('仪器添加成功！')
  }

  // 延期操作的状态
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [selectedManagementNumber, setSelectedManagementNumber] = useState('');

  // 打开延期模态框
  const handleDelayInstrument = (managementNumber) => {
    console.log('handleDelayInstrument called with:', managementNumber);
    setSelectedManagementNumber(managementNumber || 'TEMP-' + Date.now());
    setShowDelayModal(true);
    console.log('showDelayModal set to:', true);
  };

  // 处理延期确认
  const handleDelayConfirm = (delayDays) => {
    console.log('handleDelayConfirm called with:', { delayDays, selectedManagementNumber });
    
    // 输入验证
    if (isNaN(delayDays) || delayDays <= 0) {
      alert('请输入有效的延期天数（必须是大于0的整数）');
      return;
    }
    
    try {
      // 获取当前所有仪器数据
      const allInstruments = instrumentStorage.getAll();
      console.log('Found instruments:', allInstruments.length);
      
      // 查找要延期的仪器
      const instrument = allInstruments.find(item => item.managementNumber === selectedManagementNumber);
      console.log('Found instrument:', instrument);
      
      if (!instrument) {
        throw new Error('未找到指定的仪器');
      }
      
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 计算新的应归还日期
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + delayDays);
      
      // 准备更新的数据
      const updatedInstrument = {
        ...instrument,
        id,
        delayDays,
        expectedReturnDate: currentDate.toLocaleDateString('zh-CN'),
        delayTime: getCurrentDateTime()
      };
      
      // 更新存储
      const updateResult = instrumentStorage.update(id, updatedInstrument);
      
      if (updateResult) {
        // 显示成功提示
        alert(`仪器 ${instrument.name} (${selectedManagementNumber}) 已成功延期 ${delayDays} 天！`);
        
        // 关闭模态框
        setShowDelayModal(false);
      } else {
        throw new Error('更新存储失败');
      }
    } catch (error) {
      console.error('延期操作失败:', error);
      alert(`延期操作失败：${error.message}`);
    }
  };

  // 处理延期取消
  const handleDelayCancel = () => {
    setShowDelayModal(false);
  };
  
  // 删除确认对话框状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [managementNumberToDelete, setManagementNumberToDelete] = useState('');

  // 打开删除确认对话框
  const openDeleteConfirm = (managementNumber) => {
    console.log('openDeleteConfirm called with:', managementNumber);
    setManagementNumberToDelete(managementNumber);
    setShowDeleteConfirm(true);
    console.log('showDeleteConfirm set to:', true);
  };

  // 确认删除操作
  const confirmDelete = () => {
    console.log('confirmDelete called with:', managementNumberToDelete);
    const allInstruments = instrumentStorage.getAll()
    
    // 查找要删除的仪器
    const instrument = allInstruments.find(item => item.managementNumber === managementNumberToDelete)
    console.log('Found instrument to delete:', instrument);
    
    if (instrument) {
      // 创建新的ID（如果没有）
      const id = instrument.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // 准备更新的数据 - 标记为已删除当天记录
      const updatedInstrument = {
        ...instrument,
        id,
        deletedTodayRecord: true,
        deletedTime: getCurrentDateTime()
      }
      
      // 更新存储
      instrumentStorage.update(id, updatedInstrument)
      
      // 显示成功提示
      alert(`仪器 ${instrument.name} (${managementNumberToDelete}) 的当天操作记录已删除！`)
    }
    
    // 关闭确认对话框
    setShowDeleteConfirm(false);
    setManagementNumberToDelete('');
  };

  // 取消删除操作
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setManagementNumberToDelete('');
  };

  // 处理删除当天记录操作
  const handleDeleteTodayRecord = (managementNumber) => {
    openDeleteConfirm(managementNumber);
  };

  // 批量删除操作
  const handleBatchDelete = () => {
    alert('批量删除功能即将实现！');
  };

  const toggleSubmenu = (menuId) => {
    setExpandedSubmenu(expandedSubmenu === menuId ? null : menuId)
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600)
      if (window.innerWidth > 600) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleMenuItemClick = (itemId) => {
    setActiveMenuItem(itemId)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="main-container">
      <header className="main-header">
        <div className="header-left">
          {isMobile && (
            <button className="menu-toggle" onClick={toggleSidebar}>
              ☰
            </button>
          )}
          <h1>标准器/物质管理系统</h1>
        </div>
        <div className="header-right">
          <button className="logout-button" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
          <nav className="sidebar-nav">
            {menuItems.map(item => {
              if (item.submenu) {
                return (
                  <div key={item.id} className="nav-group">
                    <button
                      className={`nav-item ${activeMenuItem === item.id ? 'active' : ''}`}
                      onClick={() => toggleSubmenu(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      <span className={`nav-arrow ${expandedSubmenu === item.id ? 'open' : ''}`}>
                        ▼
                      </span>
                    </button>
                    {expandedSubmenu === item.id && (
                      <div className="submenu">
                        {item.submenu.map(subItem => (
                          <button
                            key={subItem.id}
                            className={`submenu-item ${activeMenuItem === subItem.id ? 'active' : ''}`}
                            onClick={() => {
                              handleMenuItemClick(subItem.id)
                              if (isMobile) setSidebarOpen(false)
                            }}
                          >
                            <span className="nav-icon">{subItem.icon}</span>
                            <span className="nav-label">{subItem.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <button
                  key={item.id}
                  className={`nav-item ${activeMenuItem === item.id ? 'active' : ''}`}
                  onClick={() => handleMenuItemClick(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="main-content">
          <div className="page-header">
            <h2>{menuItems.find(item => item.id === activeMenuItem)?.label || 
                menuItems.find(item => item.submenu?.some(sub => sub.id === activeMenuItem))?.submenu.find(sub => sub.id === activeMenuItem)?.label || 
                '欢迎使用标准器/物质管理系统'}</h2>
            <div className="header-divider"></div>
          </div>

          {activeMenuItem === 'instrument-management' && (
            <>
              <div className="instrument-actions">
                <button className="action-button add-button" onClick={openAddModal}>
                  <span>➕</span>
                  <span>添加仪器</span>
                </button>
                <button className="action-button delete-button" onClick={handleBatchDelete}>
                  <span>🗑️</span>
                  <span>批量删除</span>
                </button>
                <button className="action-button import-button">
                  <span>📥</span>
                  <span>导入</span>
                </button>
                <button className="action-button export-button">
                  <span>📤</span>
                  <span>导出</span>
                </button>
              </div>

              <div className="search-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="搜索仪器..."
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="instrument-list">
            <table className="instrument-table">
              <thead>
                <tr>
                  <th>仪器名称</th>
                  <th>管理编号</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>测试仪器1</td>
                  <td>TEST-001</td>
                  <td>已出库</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="action-btn delay-btn"
                        onClick={() => handleDelayInstrument('TEST-001')}
                      >
                        延期
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteTodayRecord('TEST-001')}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>测试仪器2</td>
                  <td>TEST-002</td>
                  <td>已出库</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="action-btn delay-btn"
                        onClick={() => handleDelayInstrument('TEST-002')}
                      >
                        延期
                      </button>
                      <button 
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteTodayRecord('TEST-002')}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 添加仪器模态框 */}
          {showAddModal && (
            <div className="modal-overlay" onClick={closeAddModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>添加仪器</h3>
                  <button className="modal-close" onClick={closeAddModal}>&times;</button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleSubmit} className="instrument-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label htmlFor="type">类型</label>
                        <input
                          type="text"
                          id="type"
                          name="type"
                          value={instrumentForm.type}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="name">名称</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={instrumentForm.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="model">型号</label>
                        <input
                          type="text"
                          id="model"
                          name="model"
                          value={instrumentForm.model}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="factoryNumber">出厂编号</label>
                        <input
                          type="text"
                          id="factoryNumber"
                          name="factoryNumber"
                          value={instrumentForm.factoryNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="managementNumber">管理编号</label>
                        <input
                          type="text"
                          id="managementNumber"
                          name="managementNumber"
                          value={instrumentForm.managementNumber}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="manufacturer">生产厂家</label>
                        <input
                          type="text"
                          id="manufacturer"
                          name="manufacturer"
                          value={instrumentForm.manufacturer}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="measurementRange">测量范围</label>
                        <input
                          type="text"
                          id="measurementRange"
                          name="measurementRange"
                          value={instrumentForm.measurementRange}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="measurementUncertainty">测量不确定度</label>
                        <input
                          type="text"
                          id="measurementUncertainty"
                          name="measurementUncertainty"
                          value={instrumentForm.measurementUncertainty}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="calibrationStatus">检定/校准</label>
                        <select
                          id="calibrationStatus"
                          name="calibrationStatus"
                          value={instrumentForm.calibrationStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="calibrated">已校准</option>
                          <option value="to-calibrate">待校准</option>
                          <option value="uncalibrated">未校准</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="calibrationDate">校准日期</label>
                        <input
                          type="date"
                          id="calibrationDate"
                          name="calibrationDate"
                          value={instrumentForm.calibrationDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="recalibrationDate">复校日期</label>
                        <input
                          type="date"
                          id="recalibrationDate"
                          name="recalibrationDate"
                          value={instrumentForm.recalibrationDate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="period">周期</label>
                        <input
                          type="text"
                          id="period"
                          name="period"
                          value={instrumentForm.period}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="traceabilityAgency">溯源机构</label>
                        <input
                          type="text"
                          id="traceabilityAgency"
                          name="traceabilityAgency"
                          value={instrumentForm.traceabilityAgency}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="traceabilityCertificate">溯源证书</label>
                        <input
                          type="text"
                          id="traceabilityCertificate"
                          name="traceabilityCertificate"
                          value={instrumentForm.traceabilityCertificate}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="department">科室</label>
                        <input
                          type="text"
                          id="department"
                          name="department"
                          value={instrumentForm.department}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="storageLocation">存放位置</label>
                        <input
                          type="text"
                          id="storageLocation"
                          name="storageLocation"
                          value={instrumentForm.storageLocation}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="instrumentStatus">仪器状态</label>
                        <select
                          id="instrumentStatus"
                          name="instrumentStatus"
                          value={instrumentForm.instrumentStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="normal">正常</option>
                          <option value="abnormal">异常</option>
                          <option value="repairing">维修中</option>
                          <option value="scrapped">已报废</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="inOutStatus">出入库状态</label>
                        <select
                          id="inOutStatus"
                          name="inOutStatus"
                          value={instrumentForm.inOutStatus}
                          onChange={handleInputChange}
                        >
                          <option value="">请选择</option>
                          <option value="in">在库</option>
                          <option value="out">出库</option>
                        </select>
                      </div>
                      <div className="form-group full-width">
                        <label htmlFor="remarks">备注</label>
                        <textarea
                          id="remarks"
                          name="remarks"
                          value={instrumentForm.remarks}
                          onChange={handleInputChange}
                          rows="3"
                        ></textarea>
                      </div>
                      <div className="form-group full-width">
                        <label htmlFor="attachments">附件</label>
                        <input
                          type="file"
                          id="attachments"
                          name="attachments"
                          onChange={(e) => setInstrumentForm(prev => ({
                            ...prev,
                            attachments: e.target.files[0]?.name || ''
                          }))}
                        />
                        {instrumentForm.attachments && (
                          <p className="file-name">已选择: {instrumentForm.attachments}</p>
                        )}
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="button" className="cancel-button" onClick={closeAddModal}>
                        取消
                      </button>
                      <button type="submit" className="submit-button">
                        确认添加
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 延期操作模态框 */}
      <DelayModal 
        isOpen={showDelayModal}
        onClose={handleDelayCancel}
        onConfirm={handleDelayConfirm}
        managementNumber={selectedManagementNumber}
      />

      {/* 删除确认模态框 */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '400px',
            maxWidth: '90%',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#333'
            }}>
              确认删除
            </h3>
            
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#666'
            }}>
              您确定要删除管理编号为 <strong>{managementNumberToDelete}</strong> 的仪器当天操作记录吗？
            </p>
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={cancelDelete}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d9d9d9',
                  backgroundColor: 'white',
                  color: '#666',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#40a9ff';
                  e.target.style.color = '#40a9ff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#d9d9d9';
                  e.target.style.color = '#666';
                }}
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#ff4d4f',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'background-color 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#ff7875';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#ff4d4f';
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="main-footer">
        <p>&copy; 2025 标准器/物质管理系统</p>
      </footer>
    </div>
  )
}

export default MainPage