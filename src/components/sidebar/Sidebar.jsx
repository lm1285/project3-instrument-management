// Sidebar组件，显示侧边导航菜单
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/MainPage.css';
import permissionChecker from '../../utils/PermissionChecker';

const Sidebar = ({ isOpen, activeMenuItem, onClose }) => {
  const navigate = useNavigate();
  
  const handleMenuItemClick = (itemId) => {
    onClose();
    // 根据菜单项ID导航到相应路由
    switch (itemId) {
      case 'userManagement':
        navigate('/user-management');
        break;
      case 'allInstruments':
      case 'inStock':
      case 'outStock':
      case 'addInstrument':
      case 'updateInstrument':
      case 'deleteInstrument':
      case 'stockIn':
      case 'stockOut':
      case 'stockHistory':
      case 'inventoryReport':
      case 'usageReport':
      case 'maintenanceReport':
      case 'roleManagement':
      case 'logManagement':
        // 对于其他菜单项，可以导航到主页面或相应功能页面
        // 这里暂时导航到主页面，可以根据实际需求修改
        navigate('/main');
        break;
      default:
        navigate('/main');
    }
  };
  
  // 检查菜单项权限的函数
  const hasMenuItemPermission = (itemId) => {
    // 为每个菜单项映射相应的权限检查
    const permissionMap = {
      'instrumentList': 'view-instruments',
      'allInstruments': 'view-instruments',
      'inStock': 'view-instruments',
      'outStock': 'view-instruments',
      'instrumentManagement': 'view-instruments-manage',
      'addInstrument': 'add-instrument',
      'updateInstrument': 'edit-instrument',
      'deleteInstrument': 'delete-instrument',
      'stockManagement': 'manage-in-out',
      'stockIn': 'instrument-check-in',
      'stockOut': 'instrument-check-out',
      'stockHistory': 'manage-in-out',
      'reports': 'view-instruments',
      'inventoryReport': 'view-instruments',
      'usageReport': 'view-instruments',
      'maintenanceReport': 'view-instruments',
      'system': 'view-users-list',
      'userManagement': 'user-management',
      'roleManagement': 'user-management',
      'logManagement': 'user-management'
    };
    
    // 如果映射中没有该菜单项，默认返回true
    if (!permissionMap[itemId]) return true;
    
    return permissionChecker.hasPermission(permissionMap[itemId]);
  };
  
  // 过滤菜单项的函数
  const filterMenuItems = (menuItems) => {
    return menuItems.map(item => {
      // 检查子菜单项的权限
      const filteredSubMenu = item.subMenu.filter(subItem => 
        hasMenuItemPermission(subItem.id)
      );
      
      // 如果有子菜单项或当前菜单项有权限，则显示该菜单项
      if (filteredSubMenu.length > 0 || hasMenuItemPermission(item.id)) {
        return {
          ...item,
          subMenu: filteredSubMenu
        };
      }
      
      return null;
    }).filter(Boolean); // 过滤掉null值
  };
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
        {filterMenuItems(menuItems).map((menuItem) => (
          <div key={menuItem.id} className="menu-group">
            <div 
              className={`menu-group-title ${activeMenuItem.startsWith(menuItem.id) ? 'active' : ''}`}
              onClick={() => handleMenuItemClick(menuItem.id)}
            >
              {menuItem.label}
              <span className="menu-arrow">▼</span>
            </div>
            <div className="menu-subgroup">
              {menuItem.subMenu.map((subItem) => (
                <div 
                  key={subItem.id} 
                  className={`menu-item ${activeMenuItem === subItem.id ? 'active' : ''}`}
                  onClick={() => handleMenuItemClick(subItem.id)}
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