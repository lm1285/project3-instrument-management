import React, { useState, useEffect } from 'react';
import UserStorage from '../utils/UserStorage';
import permissionChecker from '../utils/PermissionChecker';
import '../styles/UserManagement.css';

function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    fullName: '',
    email: '',
    phone: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [editingUserPermissions, setEditingUserPermissions] = useState({});
  const [permissionFormData, setPermissionFormData] = useState({});

  // 初始化用户存储
  const userStorage = new UserStorage();

  // 加载用户列表
  const loadUsers = () => {
    const allUsers = userStorage.getAllUsers();
    setUsers(allUsers);
  };

  // 获取当前登录用户信息
  const loadCurrentUser = () => {
    const userInfo = localStorage.getItem('currentUser');
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo);
        setCurrentUser(user);
      } catch (error) {
        console.error('解析当前用户信息失败:', error);
      }
    }
  };

  // 初始化时加载用户
  useEffect(() => {
    // 确保有默认管理员用户
    userStorage.initDefaultAdmin();
    loadUsers();
    loadCurrentUser();
    // 刷新权限检查器
    permissionChecker.refresh();
  }, []);
  
  // 打开权限配置模态框
  const handleConfigurePermissions = (user) => {
    // 检查权限 - 仅主管理员可配置权限
    if (!permissionChecker.isSuperAdmin()) {
      alert('您没有配置用户权限的权限！此操作仅主管理员可用。');
      return;
    }
    
    // 保存当前编辑的用户
    setEditingUserPermissions(user);
    
    // 设置表单数据，合并用户已有权限，没有则全部默认为false，由管理员手动选择
    const allPermissions = { ...permissionChecker.featurePermissions };
    const userPermissionData = {};
    
    Object.keys(allPermissions).forEach(permission => {
      // 如果用户有自定义权限，则使用自定义权限，否则默认为false
      const hasCustomPermission = user.permissions && user.permissions[permission] !== undefined;
      if (hasCustomPermission) {
        userPermissionData[permission] = user.permissions[permission];
      } else {
        // 不再根据角色自动生成权限，全部默认为false，由管理员手动选择
        userPermissionData[permission] = false;
      }
    });
    
    setPermissionFormData(userPermissionData);
    setShowPermissionModal(true);
  };
  
  // 处理权限表单变更
  const handlePermissionChange = (permission) => {
    setPermissionFormData(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };
  
  // 保存用户权限配置
  const handleSavePermissions = () => {
    // 准备用户数据
    const userData = {
      ...editingUserPermissions,
      permissions: permissionFormData
    };
    
    const success = userStorage.updateUser(editingUserPermissions.id, userData);
    
    if (success) {
      // 关闭模态框
      setShowPermissionModal(false);
      setEditingUserPermissions({});
      setPermissionFormData({});
      
      // 重新加载用户列表
      loadUsers();
      
      // 刷新权限检查器
      permissionChecker.refresh();
      
      // 显示成功提示
      alert('用户权限配置更新成功');
    } else {
      alert('更新用户权限配置失败');
    }
  };

  // 处理表单输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // 清除对应字段的错误
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // 表单验证
  const validateForm = (isEditMode = false) => {
    const errors = {};
    
    if (!formData.username.trim()) {
      errors.username = '用户名不能为空';
    }
    
    // 编辑模式下，密码可以为空（表示不修改密码）
    if (!isEditMode || formData.password) {
      if ((!isEditMode || formData.password) && formData.password !== formData.confirmPassword) {
        errors.confirmPassword = '两次输入的密码不一致';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 处理添加用户
  const handleAddUser = (e) => {
    e.preventDefault();
    
    // 检查用户管理权限 - 仅主管理员可添加用户
    if (!permissionChecker.isSuperAdmin()) {
      alert('您没有用户管理权限！此操作仅主管理员可用。');
      return;
    }
    
    if (validateForm()) {
      const userData = {
        ...formData
      };
      
      // 不需要存储确认密码
      delete userData.confirmPassword;
      
      const success = userStorage.addUser(userData);
      
      if (success) {
        // 重置表单
        resetForm();
        
        // 关闭模态框
        setShowAddModal(false);
        
        // 重新加载用户列表
        loadUsers();
        
        // 显示成功提示
        alert('用户添加成功');
      } else {
        alert('添加用户失败，用户名可能已存在');
      }
    }
  };

  // 打开编辑模态框
  const handleEditUser = (user) => {
    setCurrentUserId(user.id);
    setFormData({
      username: user.username,
      password: '', // 编辑时不显示密码
      confirmPassword: '',
      role: user.role,
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  // 处理更新用户
  const handleUpdateUser = (e) => {
    e.preventDefault();
    
    // 检查用户管理权限 - 仅主管理员可管理用户
    if (!permissionChecker.isSuperAdmin()) {
      alert('您没有用户管理权限！此操作仅主管理员可用。');
      return;
    }
    
    // 检查是否可以编辑角色（仅限主管理员）
    if (formData.role !== users.find(u => u.id === currentUserId)?.role && 
        !permissionChecker.isSuperAdmin()) {
      alert('您没有修改用户角色的权限！此操作仅主管理员可用。');
      return;
    }
    
    if (validateForm(true)) { // true 表示是编辑模式
      const updatedData = {
        ...formData
      };
      
      // 如果密码为空，则不更新密码
      if (!updatedData.password) {
        delete updatedData.password;
      }
      
      // 不需要存储确认密码
      delete updatedData.confirmPassword;
      
      const success = userStorage.updateUser(currentUserId, updatedData);
      
      if (success) {
        // 重置表单
        resetForm();
        
        // 关闭模态框
        setShowEditModal(false);
        setCurrentUserId(null);
        
        // 重新加载用户列表
        loadUsers();
        
        // 显示成功提示
        alert('用户更新成功');
      } else {
        alert('更新用户失败，用户名可能已存在');
      }
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      role: 'user'
    });
    setFormErrors({});
  };

  // 格式化日期时间
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="user-management-container">
      <div className="page-header">
        <h1>用户管理</h1>
        {permissionChecker.isSuperAdmin() && (
          <button 
            className="add-user-button" 
            onClick={() => setShowAddModal(true)}
          >
            添加用户
          </button>
        )}
        {!permissionChecker.isSuperAdmin() && (
          <div className="user-role-info">
            您没有用户管理权限（仅主管理员可用）
          </div>
        )}
      </div>

      {/* 用户列表 */}
      <div className="user-list-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>姓名</th>
              <th>角色</th>
              <th>邮箱</th>
              <th>电话</th>
              <th>创建时间</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.length > 0 ? (
              users.map(user => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.fullName}</td>
                  <td>
                    {user.role === 'super-admin' ? '主管理员' : 
                     user.role === 'admin' ? '管理员' : '普通用户'}
                  </td>
                  <td>{user.email || '-'}</td>
                  <td>{user.phone || '-'}</td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>{formatDateTime(user.updatedAt)}</td>
                  <td>
                    {permissionChecker.isSuperAdmin() && (
                      <button 
                        className="edit-button"
                        onClick={() => handleEditUser(user)}
                      >
                        编辑
                      </button>
                    )}
                    {permissionChecker.isSuperAdmin() && (
                      <button 
                        className="permission-button"
                        onClick={() => handleConfigurePermissions(user)}
                      >
                        配置权限
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-data">暂无用户数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 添加用户模态框 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>添加用户</h2>
              <button 
                className="close-button" 
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            
            <form className="user-form" onSubmit={handleAddUser}>
              <div className="form-group">
                <label htmlFor="username">用户名 *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="请输入用户名"
                />
                {formErrors.username && (
                  <span className="error-message">{formErrors.username}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="password">密码 *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="请输入密码（无长度限制）"
                />
                {formErrors.password && (
                  <span className="error-message">{formErrors.password}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">确认密码 *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="请再次输入密码"
                />
                {formErrors.confirmPassword && (
                  <span className="error-message">{formErrors.confirmPassword}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="role">角色</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  disabled={!permissionChecker.isSuperAdmin()}
                >
                  <option value="user">普通用户</option>
                  {permissionChecker.isSuperAdmin() && (
                    <>
                      <option value="admin">管理员</option>
                      <option value="super-admin">主管理员</option>
                    </>
                  )}
                </select>
                {!permissionChecker.isSuperAdmin() && (
                  <span className="error-message">您没有修改用户角色的权限（仅主管理员可用）</span>
                )}
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowAddModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-button">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑用户模态框 */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑用户</h2>
              <button 
                className="close-button" 
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            
            <form className="user-form" onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label htmlFor="username">用户名 *</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="请输入用户名"
                />
                {formErrors.username && (
                  <span className="error-message">{formErrors.username}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="password">密码 (留空表示不修改)</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="请输入新密码（无长度限制）"
                />
                {formErrors.password && (
                  <span className="error-message">{formErrors.password}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">确认密码</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="请再次输入新密码"
                />
                {formErrors.confirmPassword && (
                  <span className="error-message">{formErrors.confirmPassword}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="role">角色</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  disabled={!permissionChecker.hasPermission('edit-user-roles')}
                >
                  <option value="user">普通用户</option>
                  {permissionChecker.hasPermission('edit-user-roles') && (
                    <>
                      <option value="admin">管理员</option>
                      <option value="super-admin">主管理员</option>
                    </>
                  )}
                </select>
                {!permissionChecker.hasPermission('edit-user-roles') && (
                  <span className="error-message">您没有修改用户角色的权限</span>
                )}
              </div>
              
              <div className="form-actions">
                <button type="button" onClick={() => setShowEditModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-button">
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 权限配置模态框 */}
      {showPermissionModal && (
        <div className="modal-overlay" onClick={() => setShowPermissionModal(false)}>
          <div className="modal-content permission-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>配置用户权限 - {editingUserPermissions.username}</h2>
              <button 
                className="close-button" 
                onClick={() => setShowPermissionModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="permission-list">
                {/* 分级菜单的权限配置 */}
                {(() => {
                  // 映射权限名称为友好显示名称
                  const permissionLabels = {
                    'view-instruments': '查看仪器列表',
                    'search-instruments': '搜索仪器',
                    'filter-instruments': '筛选仪器',
                    'view-instrument-detail': '查看仪器详情',
                    'generate-qrcode': '生成二维码',
                    'scan-qrcode': '扫描二维码',
                    'instrument-check-in': '入库',
                    'instrument-check-out': '出库',
                    'instrument-use': '使用',
                    'instrument-borrow': '借用',
                    'instrument-clear': '清除',
                    'add-instrument': '添加仪器',
                    'edit-instrument': '编辑仪器',
                    'delete-instrument': '删除仪器',
                    'import-instruments': '导入',
                    'batch-delete': '批量删除',
                    'manage-in-out': '管理入库出库',
                    'manage-borrow': '管理借用',
                    'user-management': '用户管理',
                    'edit-user-roles': '编辑用户',
                    'edit-user-permissions': '权限配置',
                    'clear-storage': '清除存储数据'
                  };
                  
                  // 分级菜单的权限配置
                  const permissionCategories = [
                    {
                      id: 'dashboard',
                      label: '信息看板',
                      icon: '📊',
                      permissions: []
                    },
                    {
                      id: 'instrument-inout',
                      label: '仪器出入',
                      icon: '🚪',
                      permissions: [
                        { key: 'search-instruments-inout', name: '仪器出入搜索框' },
                        { key: 'scan-qrcode', name: '扫描二维码' },
                        { key: 'view-instruments-inout', name: '仪器出入仪器列表' },
                        { key: 'instrument-check-out', name: '出库' },
                        { key: 'instrument-check-in', name: '入库' },
                        { key: 'instrument-use', name: '使用' },
                        { key: 'view-instrument-detail', name: '详情' },
                        { key: 'instrument-borrow', name: '借用' },
                        { key: 'instrument-clear', name: '清除' }
                      ]
                    },
                    {
                      id: 'instrument-management',
                      label: '仪器管理',
                      icon: '⚖️',
                      permissions: [
                        { key: 'search-instruments-manage', name: '仪器管理搜索框' },
                        { key: 'add-instrument', name: '添加仪器' },
                        { key: 'batch-delete', name: '批量删除' },
                        { key: 'import-instruments', name: '导入' },
                        { key: 'filter-instruments', name: '筛选框' },
                        { key: 'view-instruments-manage', name: '仪器管理仪器列表' },
                        { key: 'edit-instrument', name: '仪器管理编辑' },
                        { key: 'delete-instrument', name: '删除' },
                        { key: 'generate-qrcode', name: '二维码' }
                      ]
                    },
                    {
                      id: 'user-settings',
                      label: '用户设置',
                      icon: '⚙️',
                      subcategories: [
                        {
                          id: 'user-management-settings',
                          label: '用户管理',
                          permissions: [
                            { key: 'add-user', name: '添加用户' },
                            { key: 'edit-user-roles', name: '用户管理编辑' },
                            { key: 'edit-user-permissions', name: '权限配置' },
                            { key: 'view-users-list', name: '用户管理列表' }
                          ]
                        },
                        {
                          id: 'system-settings',
                          label: '系统设置',
                          permissions: []
                        }
                      ]
                    }
                  ];
                  
                  // 渲染权限分类
                  return permissionCategories.map(category => (
                    <div key={category.id} className="permission-category">
                      <h3 className="category-title">{category.icon} {category.label}</h3>
                      
                      {/* 渲染子分类 */}
                      {category.subcategories && category.subcategories.map(subcategory => (
                        <div key={subcategory.id} className="permission-subcategory">
                          <h4 className="subcategory-title">{subcategory.label}</h4>
                          <div className="category-permissions">
                            {subcategory.permissions.map(item => (
                              <div key={item.key} className="permission-item">
                                <label className="permission-label">
                                  <input
                                    type="checkbox"
                                    checked={permissionFormData[item.key] || false}
                                    onChange={() => handlePermissionChange(item.key)}
                                  />
                                  <span className="permission-name">{item.name}</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {/* 渲染直接权限 */}
                      {!category.subcategories && category.permissions.length > 0 && (
                        <div className="category-permissions">
                          {category.permissions.map(item => (
                            <div key={item.key} className="permission-item">
                              <label className="permission-label">
                                <input
                                  type="checkbox"
                                  checked={permissionFormData[item.key] || false}
                                  onChange={() => handlePermissionChange(item.key)}
                                />
                                <span className="permission-name">{item.name}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 无权限提示 */}
                      {(!category.subcategories && category.permissions.length === 0) ||
                       (category.subcategories && category.subcategories.every(sub => sub.permissions.length === 0)) ? (
                        <div className="no-permissions">
                          该分类暂无功能，不需要设置权限
                        </div>
                      ) : null}
                    </div>
                  ));
                })()}
              </div>
            </div>
            
            <div className="form-actions">
              <button type="button" onClick={() => setShowPermissionModal(false)}>
                取消
              </button>
              <button type="button" className="submit-button" onClick={handleSavePermissions}>
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagementPage;