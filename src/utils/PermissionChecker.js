// 权限检查器 - 用于基于角色的功能权限控制

class PermissionChecker {
  constructor() {
    // 定义角色权限等级
    this.roleLevels = {
      'user': 1,
      'admin': 2,
      'super-admin': 3
    };
    // 定义不同功能所需的最低权限等级
    this.featurePermissions = {
      // 基础功能
      'view-instruments': 1,
      'search-instruments': 1,
      'filter-instruments': 1,
      'view-instrument-detail': 1,
      'generate-qrcode': 1,
      'scan-qrcode': 1,
      'view-instruments-inout': 1, // 仪器出入仪器列表
      'view-instruments-manage': 1, // 仪器管理仪器列表
      'view-users-list': 1, // 用户管理列表
      
      // 中级功能 - 仪器出入相关操作
      'instrument-check-in': 2,  // 入库
      'instrument-check-out': 2, // 出库
      'instrument-use': 2,       // 使用
      'instrument-borrow': 2,    // 借用
      'instrument-return': 2,    // 归还
      'instrument-clear': 2,     // 清除
      'search-instruments-inout': 2, // 仪器出入搜索框
      
      // 中级功能 - 其他管理功能
      'add-instrument': 2,
      'edit-instrument': 2,
      'delete-instrument': 2,
      'import-instruments': 2,
      'batch-delete': 2,
      'manage-in-out': 2,
      'manage-borrow': 2,
      'search-instruments-manage': 2, // 仪器管理搜索框
      
      // 高级功能
      'user-management': 3,
      'edit-user-roles': 3,
      'edit-user-permissions': 3,
      'clear-storage': 3,
      'add-user': 3, // 添加用户
    };
    
    this.currentUser = null;
    this.currentRole = 'user';
    this.loadCurrentUser();
  }
  
  // 从本地存储加载当前用户信息
  loadCurrentUser() {
    try {
      const userInfo = localStorage.getItem('currentUser');
      if (userInfo) {
        this.currentUser = JSON.parse(userInfo);
        this.currentRole = this.currentUser.role || 'user';
      }
    } catch (error) {
      console.error('加载当前用户信息失败:', error);
    }
  }
  
  // 获取当前用户信息
  getCurrentUser() {
    return this.currentUser;
  }
  
  // 获取当前用户角色
  getCurrentRole() {
    return this.currentRole;
  }
  
  // 检查用户是否有特定角色
  hasRole(role) {
    return this.currentRole === role;
  }
  
  // 检查用户是否为管理员或主管理员
  isAdmin() {
    return this.currentRole === 'admin' || this.currentRole === 'super-admin';
  }
  
  // 检查用户是否为主管理员
  isSuperAdmin() {
    return this.currentRole === 'super-admin';
  }
  
  // 检查用户是否具有执行特定功能的权限
  hasPermission(feature) {
    // 添加调试日志
    console.log(`[权限检查] 功能: ${feature}`);
    console.log(`[权限检查] 当前用户: ${this.currentUser ? this.currentUser.username : '未登录'}`);
    console.log(`[权限检查] 当前角色: ${this.currentRole}`);
    
    // 检查用户是否有自定义权限配置（优先级最高）
    if (this.currentUser && this.currentUser.permissions && this.currentUser.permissions[feature] !== undefined) {
      console.log(`[权限检查] 发现自定义权限配置: ${this.currentUser.permissions[feature]}`);
      return this.currentUser.permissions[feature];
    } else {
      console.log(`[权限检查] 未发现自定义权限配置`);
    }
    
    // 特殊处理删除相关权限，确保只有管理员才能使用
    if (feature === 'delete-instrument' || feature === 'batch-delete') {
      console.log(`[权限检查] 特殊处理删除相关权限: ${feature}`);
      // 检查用户是否为管理员或主管理员
      const isAdminOrSuperAdmin = this.currentRole === 'admin' || this.currentRole === 'super-admin';
      console.log(`[权限检查] 是否为管理员: ${isAdminOrSuperAdmin}`);
      return isAdminOrSuperAdmin;
    }
    
    // 如果功能在权限配置中定义，则根据用户角色等级判断
    if (this.featurePermissions[feature]) {
      const requiredLevel = this.featurePermissions[feature];
      const userLevel = this.roleLevels[this.currentRole] || 1; // 默认用户等级为1
      console.log(`[权限检查] 功能所需等级: ${requiredLevel}, 用户等级: ${userLevel}`);
      const result = userLevel >= requiredLevel;
      console.log(`[权限检查] 权限检查结果: ${result}`);
      return result;
    } else {
      console.log(`[权限检查] 功能未在权限配置中定义，默认允许访问`);
    }
    
    // 如果功能未在权限配置中定义，则默认允许访问
    return true;
  }
  
  // 检查用户是否具有多个权限中的任意一个
  hasAnyPermission(features) {
    return features.some(feature => this.hasPermission(feature));
  }
  
  // 检查用户是否具有所有指定的权限
  hasAllPermissions(features) {
    return features.every(feature => this.hasPermission(feature));
  }
  
  // 刷新当前用户信息（例如在登录或注销后）
  refresh() {
    this.loadCurrentUser();
  }
  
  // 获取当前用户的权限列表
  getUserPermissions() {
    const permissions = {};
    Object.keys(this.featurePermissions).forEach(feature => {
      permissions[feature] = this.hasPermission(feature);
    });
    return permissions;
  }
}

// 创建单例实例
const permissionChecker = new PermissionChecker();

export default permissionChecker;
export { PermissionChecker };