class UserStorage {
  constructor() {
    this.storageKey = 'users';
  }

  // 获取所有用户数据
  getAllUsers() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('获取用户数据失败:', error);
      return [];
    }
  }

  // 保存所有用户数据
  saveAllUsers(users) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(users));
      return true;
    } catch (error) {
      console.error('保存用户数据失败:', error);
      return false;
    }
  }

  // 添加用户
  addUser(userData) {
    try {
      const users = this.getAllUsers();
      
      // 检查用户名是否已存在
      const existingUser = users.find(user => user.username === userData.username);
      if (existingUser) {
        console.error('用户名已存在');
        return false;
      }
      
      // 生成唯一ID和时间戳，默认添加空的权限对象
      const newUser = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...userData,
        permissions: userData.permissions || {}, // 存储用户自定义权限
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      users.push(newUser);
      return this.saveAllUsers(users);
    } catch (error) {
      console.error('添加用户失败:', error);
      return false;
    }
  }

  // 更新用户
  updateUser(id, updatedData) {
    try {
      const users = this.getAllUsers();
      const index = users.findIndex(user => user.id === id);
      
      if (index !== -1) {
        // 检查更新后的用户名是否与其他用户冲突
        if (updatedData.username && updatedData.username !== users[index].username) {
          const usernameExists = users.some(user => user.id !== id && user.username === updatedData.username);
          if (usernameExists) {
            console.error('用户名已存在');
            return false;
          }
        }
        
        users[index] = {
          ...users[index],
          ...updatedData,
          updatedAt: new Date().toISOString()
        };
        
        return this.saveAllUsers(users);
      }
      
      console.error('未找到要更新的用户');
      return false;
    } catch (error) {
      console.error('更新用户失败:', error);
      return false;
    }
  }

  // 删除用户
  deleteUser(id) {
    try {
      const users = this.getAllUsers();
      const filteredUsers = users.filter(user => user.id !== id);
      return this.saveAllUsers(filteredUsers);
    } catch (error) {
      console.error('删除用户失败:', error);
      return false;
    }
  }

  // 根据用户名查找用户（用于登录验证）
  findUserByUsername(username) {
    const users = this.getAllUsers();
    return users.find(user => user.username === username);
  }

  // 初始化默认主管理员用户（如果没有用户存在）
  initDefaultAdmin() {
    const users = this.getAllUsers();
    if (users.length === 0) {
      // 创建默认主管理员用户
      const defaultSuperAdmin = {
        username: 'admin',
        password: 'admin123', // 注意：实际项目中应使用加密存储
        role: 'super-admin',
        fullName: '系统主管理员',
        email: 'admin@example.com',
        phone: '13800138000',
        permissions: {} // 默认空权限对象
      };
      
      this.addUser(defaultSuperAdmin);
      console.log('默认主管理员用户已创建');
    }
  }
};

export default UserStorage;