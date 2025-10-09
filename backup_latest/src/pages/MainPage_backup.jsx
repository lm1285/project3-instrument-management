import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/MainPage.css'

function MainPage() {
  const navigate = useNavigate()
  const [activeMenuItem, setActiveMenuItem] = useState('instrument-management')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600)
  const [expandedSubmenu, setExpandedSubmenu] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

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
                <button className="action-button delete-button">
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

          <div className="empty-state">
            <p className="empty-subtitle">系统功能即将上线...</p>
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

      <footer className="main-footer">
        <p>&copy; 2025 标准器/物质管理系统</p>
      </footer>
    </div>
  )
}

export default MainPage