// Sidebar组件，显示侧边导航菜单
import React from 'react';
import '../../styles/MainPage.css';

const Sidebar = ({ isOpen, onMenuItemClick, activeMenuItem, onClose }) => {
  const menuItems = [
    {
      id: 'instrumentList',
      label: '仪器列表',
      subMenu: [
        { id: 'allInstruments', label: '所有仪器' },
        { id: 'inStock', label: '在库仪器' },
        { id: 'outStock', label: '出库仪器' }
      ]
    },
    {
      id: 'instrumentManagement',
      label: '仪器管理',
      subMenu: [
        { id: 'addInstrument', label: '新增仪器' },
        { id: 'updateInstrument', label: '修改仪器' },
        { id: 'deleteInstrument', label: '删除仪器' }
      ]
    },
    {
      id: 'stockManagement',
      label: '出入库管理',
      subMenu: [
        { id: 'stockIn', label: '入库登记' },
        { id: 'stockOut', label: '出库登记' },
        { id: 'stockHistory', label: '出入库记录' }
      ]
    },
    {
      id: 'reports',
      label: '报表统计',
      subMenu: [
        { id: 'inventoryReport', label: '库存报表' },
        { id: 'usageReport', label: '使用报表' },
        { id: 'maintenanceReport', label: '维护报表' }
      ]
    },
    {
      id: 'system',
      label: '系统设置',
      subMenu: [
        { id: 'userManagement', label: '用户管理' },
        { id: 'roleManagement', label: '角色管理' },
        { id: 'logManagement', label: '日志管理' }
      ]
    }
  ];

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h3>仪器管理系统</h3>
        <button 
          className="sidebar-close-btn" 
          onClick={onClose} 
          aria-label="关闭菜单"
        >
          ×
        </button>
      </div>
      <div className="sidebar-content">
        {menuItems.map((menuItem) => (
          <div key={menuItem.id} className="menu-group">
            <div 
              className={`menu-group-title ${activeMenuItem.startsWith(menuItem.id) ? 'active' : ''}`}
              onClick={() => onMenuItemClick(menuItem.id)}
            >
              {menuItem.label}
              <span className="menu-arrow">▼</span>
            </div>
            <div className="menu-subgroup">
              {menuItem.subMenu.map((subItem) => (
                <div 
                  key={subItem.id} 
                  className={`menu-item ${activeMenuItem === subItem.id ? 'active' : ''}`}
                  onClick={() => onMenuItemClick(subItem.id)}
                >
                  {subItem.label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;