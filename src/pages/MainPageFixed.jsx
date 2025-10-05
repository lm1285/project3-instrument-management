import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/common/SearchBar';
import FilterPanel from '../components/filter/FilterPanel';
import InstrumentTable from '../components/table/InstrumentTable';
import Modal from '../components/modal/Modal';
import MainPageInstrumentForm from '../components/forms/MainPageInstrumentForm';
import InstrumentDetail from '../components/details/InstrumentDetail';
import { DataStorage } from '../utils/DataStorage';
import '../styles/MainPage.css';

/**
 * 主页面组件
 * 整合了搜索、筛选、表格显示和表单操作等功能
 */
function MainPageFixed() {
  // 导航钩子
  const navigate = useNavigate();
  
  // 状态管理
  const [activeMenuItem, setActiveMenuItem] = useState('instrument-management');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  const [expandedSubmenu, setExpandedSubmenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [instrumentData, setInstrumentData] = useState([]);
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(10);
  
  // 模态框状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentInstrument, setCurrentInstrument] = useState(null);
  
  // 筛选条件
  const [filterCriteria, setFilterCriteria] = useState({
    department: '',
    type: '',
    status: '',
    location: '',
    startDate: '',
    endDate: ''
  });
  
  // 数据存储实例
  const dataStorage = new DataStorage();

  // 初始化数据
  useEffect(() => {
    loadInstruments();
  }, [filterCriteria]);

  // 加载仪器数据
  const loadInstruments = () => {
    try {
      let data = dataStorage.getAllData();
      // 应用筛选
      if (filterCriteria.department) {
        data = data.filter(item => item.department === filterCriteria.department);
      }
      if (filterCriteria.type) {
        data = data.filter(item => item.type === filterCriteria.type);
      }
      if (filterCriteria.status) {
        data = data.filter(item => item.status === filterCriteria.status);
      }
      if (filterCriteria.location) {
        data = data.filter(item => item.location === filterCriteria.location);
      }
      if (filterCriteria.startDate) {
        data = data.filter(item => new Date(item.purchaseDate) >= new Date(filterCriteria.startDate));
      }
      if (filterCriteria.endDate) {
        data = data.filter(item => new Date(item.purchaseDate) <= new Date(filterCriteria.endDate));
      }
      
      setTotalItems(data.length);
      
      // 分页
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      setInstrumentData(data.slice(startIndex, endIndex));
    } catch (error) {
      console.error('加载仪器数据失败:', error);
      // 模拟数据
      const mockData = generateMockData();
      setInstrumentData(mockData.slice(0, itemsPerPage));
      setTotalItems(mockData.length);
    }
  };

  // 生成模拟数据
  const generateMockData = () => {
    const departments = ['检测部', '校准部', '研发部', '质控部'];
    const statuses = ['正常', '待校准', '已过期', '维修中'];
    const locations = ['A1-01', 'A1-02', 'A2-01', 'B1-01', 'B2-02'];
    const instruments = [];
    
    for (let i = 1; i <= 30; i++) {
      instruments.push({
        id: `INS${i.toString().padStart(4, '0')}`,
        managementNumber: `MS${i.toString().padStart(4, '0')}`,
        name: `电子天平${i}`,
        model: `FA${1000 + i}`,
        specifications: `0-200g/0.1mg`,
        manufacturer: `上海精密科学仪器有限公司`,
        measurementRange: `0-200g`,
        uncertainty: `±0.1mg`,
        calibrationStatus: statuses[Math.floor(Math.random() * statuses.length)],
        calibrationDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        nextCalibrationDate: new Date(Date.now() + Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        department: departments[Math.floor(Math.random() * departments.length)],
        location: locations[Math.floor(Math.random() * locations.length)],
        custodian: `张三${i}`,
        purchaseDate: new Date(Date.now() - Math.floor(Math.random() * 3 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        unit: `台`,
        value: Math.floor(Math.random() * 10000) + 1000,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        remarks: `仪器状态良好，定期校准`
      });
    }
    
    return instruments;
  };

  // 处理搜索
  const handleSearch = (query) => {
    setSearchQuery(query);
    // 实际项目中可以在这里实现搜索逻辑
    console.log('搜索查询:', query);
  };

  // 处理筛选
  const handleFilterChange = (newFilters) => {
    setFilterCriteria(newFilters);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理添加仪器
  const handleAddInstrument = (formData) => {
    try {
      const newInstrument = {
        ...formData,
        id: `INS${Date.now().toString().slice(-6)}`
      };
      dataStorage.addData(newInstrument);
      loadInstruments();
      setShowAddModal(false);
      alert('仪器添加成功！');
    } catch (error) {
      console.error('添加仪器失败:', error);
      alert('添加仪器失败，请重试。');
    }
  };

  // 处理编辑仪器
  const handleEditInstrument = (formData) => {
    try {
      dataStorage.updateData(currentInstrument.id, formData);
      loadInstruments();
      setShowEditModal(false);
      setCurrentInstrument(null);
      alert('仪器更新成功！');
    } catch (error) {
      console.error('更新仪器失败:', error);
      alert('更新仪器失败，请重试。');
    }
  };

  // 处理删除仪器
  const handleDeleteInstrument = (id) => {
    try {
      dataStorage.deleteData(id);
      loadInstruments();
      setShowDeleteModal(false);
      alert('仪器删除成功！');
    } catch (error) {
      console.error('删除仪器失败:', error);
      alert('删除仪器失败，请重试。');
    }
  };

  // 批量删除
  const handleBulkDelete = () => {
    try {
      selectedInstruments.forEach(id => dataStorage.deleteData(id));
      loadInstruments();
      setSelectedInstruments([]);
      alert(`成功删除 ${selectedInstruments.length} 台仪器！`);
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败，请重试。');
    }
  };

  // 处理分页变化
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // 处理选择变化
  const handleSelectionChange = (selectedIds) => {
    setSelectedInstruments(selectedIds);
  };

  // 打开编辑模态框
  const openEditModal = (instrument) => {
    setCurrentInstrument(instrument);
    setShowEditModal(true);
  };

  // 打开详情模态框
  const openDetailModal = (instrument) => {
    setCurrentInstrument(instrument);
    setShowDetailModal(true);
  };

  // 打开删除确认模态框
  const openDeleteModal = (instrument) => {
    setCurrentInstrument(instrument);
    setShowDeleteModal(true);
  };

  // 处理延期操作
  const handleDelayCalibration = (instrument) => {
    // 这里可以实现延期校准的逻辑
    alert(`已为 ${instrument.name} 设置延期校准。`);
  };

  // 退出登录
  const handleLogout = () => {
    navigate('/');
  };

  // 菜单项配置
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
  ];

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
      if (window.innerWidth > 600) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 处理菜单项点击
  const handleMenuItemClick = (itemId) => {
    setActiveMenuItem(itemId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // 切换子菜单展开/收起
  const toggleSubmenu = (menuId) => {
    setExpandedSubmenu(expandedSubmenu === menuId ? null : menuId);
  };

  // 切换侧边栏显示/隐藏
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // 导出数据
  const handleExport = () => {
    // 这里可以实现导出逻辑
    alert('数据导出功能开发中...');
  };

  // 导入数据
  const handleImport = () => {
    // 这里可以实现导入逻辑
    alert('数据导入功能开发中...');
  };

  return (
    <div className="main-container">
      {/* 头部 */}
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

      {/* 主布局 */}
      <div className="main-layout">
        {/* 侧边栏 */}
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
                );
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
              );
            })}
          </nav>
        </aside>

        {/* 主要内容 */}
        <main className="main-content">
          <div className="page-header">
            <h2>{menuItems.find(item => item.id === activeMenuItem)?.label || 
                menuItems.find(item => item.submenu?.some(sub => sub.id === activeMenuItem))?.submenu.find(sub => sub.id === activeMenuItem)?.label || 
                '欢迎使用标准器/物质管理系统'}</h2>
            <div className="header-divider"></div>
          </div>

          {activeMenuItem === 'instrument-management' && (
            <>
              {/* 操作按钮 */}
              <div className="instrument-actions">
                <button className="action-button add-button" onClick={() => setShowAddModal(true)}>
                  <span>➕</span>
                  <span>添加仪器</span>
                </button>
                <button 
                  className="action-button delete-button" 
                  disabled={selectedInstruments.length === 0}
                  onClick={handleBulkDelete}
                >
                  <span>🗑️</span>
                  <span>批量删除</span>
                </button>
                <button className="action-button import-button" onClick={handleImport}>
                  <span>📥</span>
                  <span>导入</span>
                </button>
                <button className="action-button export-button" onClick={handleExport}>
                  <span>📤</span>
                  <span>导出</span>
                </button>
              </div>

              {/* 搜索栏 */}
              <div className="search-container">
                <SearchBar onSearch={handleSearch} placeholder="搜索仪器..." />
              </div>

              {/* 筛选面板 */}
              <FilterPanel 
                onFilterChange={handleFilterChange} 
                filterCriteria={filterCriteria}
              />

              {/* 仪器表格 */}
              <InstrumentTable
                data={instrumentData}
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                selectedIds={selectedInstruments}
                onSelectionChange={handleSelectionChange}
                onEdit={openEditModal}
                onDetail={openDetailModal}
                onDelete={openDeleteModal}
                onDelay={handleDelayCalibration}
              />
            </>
          )}

          {/* 空状态提示 */}
          {(activeMenuItem !== 'instrument-management' || instrumentData.length === 0) && (
            <div className="empty-state">
              <p className="empty-subtitle">{instrumentData.length === 0 ? '暂无数据' : '系统功能即将上线...'}</p>
            </div>
          )}
        </main>
      </div>

      {/* 页脚 */}
      <footer className="main-footer">
        <p>&copy; 2025 标准器/物质管理系统</p>
      </footer>

      {/* 添加/编辑仪器模态框 */}
      <Modal
        isOpen={showAddModal || showEditModal}
        title={showAddModal ? '添加仪器' : '编辑仪器'}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setCurrentInstrument(null);
        }}
      >
        <MainPageInstrumentForm
          initialData={showEditModal ? currentInstrument : {}}
          onSubmit={showAddModal ? handleAddInstrument : handleEditInstrument}
          onCancel={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setCurrentInstrument(null);
          }}
        />
      </Modal>

      {/* 详情模态框 */}
      <Modal
        isOpen={showDetailModal}
        title="仪器详情"
        onClose={() => {
          setShowDetailModal(false);
          setCurrentInstrument(null);
        }}
      >
        <InstrumentDetail
          data={currentInstrument || {}}
          onClose={() => {
            setShowDetailModal(false);
            setCurrentInstrument(null);
          }}
        />
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        isOpen={showDeleteModal}
        title="确认删除"
        onClose={() => {
          setShowDeleteModal(false);
          setCurrentInstrument(null);
        }}
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => {
          if (currentInstrument) {
            handleDeleteInstrument(currentInstrument.id);
          }
        }}
        type="confirm"
        danger
      >
        <p className="delete-confirm-text">
          确定要删除仪器 <strong>{currentInstrument?.name}</strong> 吗？此操作不可撤销。
        </p>
      </Modal>


    </div>
  );
}

export default MainPageFixed;